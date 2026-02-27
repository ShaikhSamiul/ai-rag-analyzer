import os
import shutil
import PyPDF2
from fastapi import FastAPI, UploadFile, File, HTTPException
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

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Note: Update this to the specific frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure temporary upload directory exists
UPLOAD_FOLDER = 'temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize AI Models
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
llm = ChatGoogleGenerativeAI(model="gemini-3-flash-preview", temperature=0.3)

class ChatRequest(BaseModel):
    """Pydantic model for incoming chat requests."""
    question: str

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
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    return text_splitter.create_documents([raw_text])

def format_docs(docs) -> str:
    """Helper function to format retrieved LangChain documents into a single string."""
    return "\n\n".join(doc.page_content for doc in docs)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
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
        
        PineconeVectorStore.from_documents(
            document_chunks,
            embeddings,
            index_name=PINECONE_INDEX_NAME
        )
        print("INFO: Vectors successfully uploaded to Pinecone!")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {
        "message": "File successfully uploaded and processed.",
        "filename": file.filename,
        "total_chunks": len(document_chunks)
    }
    
@app.post("/chat")
async def chat_with_document(request: ChatRequest):
    """
    Endpoint to handle user questions. Retrieves relevant context from Pinecone 
    and generates an AI response using the RAG architecture.
    """
    try:
        vectorstore = PineconeVectorStore(
            index_name=PINECONE_INDEX_NAME,
            embedding=embeddings
        )
        
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        
        template = """Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know. 
        Keep the answer concise and professional.
        
        Context: {context}
        
        Question: {question}
        
        Answer:"""
        
        prompt = PromptTemplate.from_template(template)
        
        # Build the LangChain Expression Language (LCEL) pipeline
        rag_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )
        
        answer = rag_chain.invoke(request.question)
        
        return {"answer": answer}
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=str(e))