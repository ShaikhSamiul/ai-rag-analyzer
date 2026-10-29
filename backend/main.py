import os
import shutil
import PyPDF2
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# Initialize environment variables
load_dotenv()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

# Initialize FastAPI application
app = FastAPI(
    title="AI RAG Analyzer API",
    description="Backend API for processing PDFs and querying them using RAG and Google Gemini.",
    version="1.0.0"
)

# Configure CORS for frontend communication (supports deployed production and local development)
cors_origins_env = os.getenv(
    "CORS_ORIGINS",
    "https://ai-rag-analyzer.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
)
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure temporary upload directory exists
UPLOAD_FOLDER = 'temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize AI Models
# Note: models/gemini-embedding-001 generates 3072-dimensional vectors matching the Pinecone index
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

# Use stable production Gemini 2.5 Flash for high token quotas (1M TPM) and fast responses
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, temperature=0.3)

class ChatRequest(BaseModel):
    """Pydantic model for incoming chat requests."""
    question: str
    session_id: str

def extract_text_from_pdf(filepath: str) -> str:
    """
    Extracts all text from a saved PDF file.
    
    Args:
        filepath (str): The local path to the PDF file.
        
    Returns:
        str: The complete extracted text from the document.
    """
    text_content = ""
    try:
        with open(filepath, "rb") as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text_content += extracted + "\n"
        return text_content
    except Exception as e:
        raise Exception(f"Failed to read PDF text: {str(e)}")
    
def chunk_text(raw_text: str) -> list:
    """
    Splits a large string of text into smaller, overlapping chunks for vectorization.
    
    Args:
        raw_text (str): The complete document text.
        
    Returns:
        list: A list of Document objects containing the chunked text.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=200,
        length_function=len
    )
    return text_splitter.create_documents([raw_text])

def format_docs(docs) -> str:
    """Helper function to format retrieved LangChain documents into a single string."""
    return "\n\n".join(doc.page_content for doc in docs)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(...)):
    """
    Endpoint to handle PDF uploads, extract text, vectorize chunks, 
    and store them in the Pinecone vector database.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDFs are allowed.")
    
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
    finally:
        file.file.close()
        
    try:
        raw_text = extract_text_from_pdf(filepath)
        document_chunks = chunk_text(raw_text)
        
        print(f"INFO: Created {len(document_chunks)} total chunks. Generating vectors...")
        
        # Ingest into Pinecone under the unique session namespace
        PineconeVectorStore.from_documents(
            document_chunks,
            embeddings,
            index_name=PINECONE_INDEX_NAME,
            namespace=session_id
        )
        print("INFO: Vectors successfully uploaded to Pinecone!")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temporary uploaded file to prevent server storage bloat
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as cleanup_err:
                print(f"WARNING: Could not remove temporary file {filepath}: {cleanup_err}")
    
    return {
        "message": "File successfully uploaded and processed.",
        "filename": file.filename,
        "total_chunks": len(document_chunks)
    }
    
@app.post("/chat")
async def chat_with_document(request: ChatRequest):
    """
    Endpoint to handle user questions. Retrieves relevant context from Pinecone 
    and generates an AI response using the RAG architecture, returning both
    the synthesized answer and the grounding context sources.
    """
    try:
        vectorstore = PineconeVectorStore(
            index_name=PINECONE_INDEX_NAME,
            embedding=embeddings,
            namespace=request.session_id
        )
        
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        
        # Retrieve grounding context documents explicitly from Pinecone
        retrieved_docs = retriever.invoke(request.question)
        context_text = format_docs(retrieved_docs)
        
        # Structure context sources for client-side grounding inspection
        sources = []
        for idx, doc in enumerate(retrieved_docs):
            snippet = doc.page_content.strip()
            if len(snippet) > 300:
                snippet = snippet[:300] + "..."
            sources.append({
                "id": idx + 1,
                "content": snippet,
                "metadata": getattr(doc, "metadata", {})
            })
        
        template = """Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know. 
        Keep the answer concise, informative, and professional.
        
        At the very end of your response, provide exactly two concise, relevant follow-up questions that the user might want to explore next based on this document context. Format them strictly like this:
        ---FOLLOW_UPS---
        - [First follow-up question]
        - [Second follow-up question]
        
        Context: {context}
        
        Question: {question}
        
        Answer:"""
        
        prompt = PromptTemplate.from_template(template)
        
        # Execute synthesis chain using retrieved context
        synthesis_chain = prompt | llm | StrOutputParser()
        raw_answer = synthesis_chain.invoke({
            "context": context_text,
            "question": request.question
        })
        
        clean_answer = raw_answer
        follow_ups = []
        
        if "---FOLLOW_UPS---" in raw_answer:
            parts = raw_answer.split("---FOLLOW_UPS---")
            clean_answer = parts[0].strip()
            if len(parts) > 1:
                lines = parts[1].strip().split("\n")
                for line in lines:
                    line_clean = line.strip().lstrip("-*•0123456789. ")
                    if line_clean and len(line_clean) > 5:
                        if not line_clean.endswith("?"):
                            line_clean += "?"
                        follow_ups.append(line_clean)
                        
        follow_ups = follow_ups[:2]
        
        return {
            "answer": clean_answer,
            "sources": sources,
            "follow_ups": follow_ups
        }
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/wakeup")
async def wake_up():
    """Lightweight endpoint to wake up the Render free tier container."""
    return {"status": "awake"}
