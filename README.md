# AI Document Analyzer (RAG Pipeline)

A full-stack Retrieval-Augmented Generation (RAG) application that allows users to upload PDF documents and interact with them via an AI chat interface. The application processes documents, vectorizes the text, and leverages Google's Gemini AI to provide highly accurate, context-aware answers based strictly on the uploaded content.

## Live Demo
* **Frontend:** [https://ai-rag-analyzer.vercel.app](https://ai-rag-analyzer.vercel.app)
* **API Backend:** Hosted securely on Render

## System Architecture
This project implements a modern, decoupled RAG architecture:
1. **Document Ingestion:** Users upload a PDF via the React frontend.
2. **Chunking & Vectorization:** The FastAPI backend extracts text, splits it into optimized 2000-character chunks using LangChain, and generates embeddings using Google's `gemini-embedding-001` model.
3. **Vector Storage:** The embeddings are stored in a Pinecone vector database.
4. **Multi-Tenant Isolation:** Every document upload generates a unique `session_id`. This ID is used to create isolated namespaces in Pinecone, preventing cross-contamination of user data (data leaks) when multiple users interact with the app simultaneously.
5. **Contextual Retrieval:** When a user asks a question, the query is vectorized, matching document chunks are retrieved from the specific Pinecone namespace, and passed to the Gemini LLM to synthesize an answer.

## Key Technical Features
* **Session-Based Namespacing:** Engineered multi-tenant data isolation within Pinecone to allow concurrent users without data leakage.
* **Optimized API Quota Management:** Configured LangChain `RecursiveCharacterTextSplitter` chunk sizing to strictly adhere to Google API rate limits (100 RPM).
* **CORS Secured:** Backend routing strictly configured to only accept requests from the deployed Vercel production domain.
* **Serverless Deployment:** Cloud-hosted architecture utilizing Vercel (Frontend) and Render (Backend), minimizing local dependency issues and ensuring high availability.

## Tech Stack

**Frontend:**
* React (Vite)
* HTML5 / CSS3
* Fetch API for FormData submission

**Backend:**
* Python / FastAPI
* Uvicorn (ASGI server)
* LangChain (RAG Orchestration)
* Google Generative AI (Gemini Embeddings & LLM)
* PyPDF2 (Document Parsing)

**Database & Cloud:**
* Pinecone (Vector Database)
* Vercel (Frontend Hosting)
* Render (Backend Hosting)

## Local Installation

### Prerequisites
* Python 3.11+
* Node.js & npm
* Pinecone API Key
* Google Gemini API Key

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables
To run this project locally, you will need to add the following environment variables to your `.env` file in the `backend` folder:

```env
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_index_name_here
GOOGLE_API_KEY=your_gemini_api_key_here
```

### Start the server
```text
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
