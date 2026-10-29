# AI Document Analyzer (RAG Pipeline)

A full-stack Retrieval-Augmented Generation (RAG) application that allows users to upload PDF documents and interact with them via an AI chat interface. The application processes documents, vectorizes the text, and leverages Google's Gemini AI to provide highly accurate, context-aware answers based strictly on the uploaded content.

## Live Demo
* **Frontend:** [https://ai-rag-analyzer.vercel.app](https://ai-rag-analyzer.vercel.app)
* **API Backend:** Hosted securely on Render

## Documentation Index
Comprehensive technical documentation is available across the repository:
* **[AGENTS.md](./AGENTS.md)** — AI agent operating instructions, architectural invariants, and contribution standards.
* **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture, sequence diagrams, and multi-tenant data flow.
* **[ROADMAP.md](./ROADMAP.md)** — Prioritized technical debt backlog, bug fixes, and feature milestones.
* **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Local setup, testing, and troubleshooting guide for developers.
* **[API_SPECIFICATION.md](./API_SPECIFICATION.md)** — Complete REST API contract, request/response schemas, and cURL examples.
* **[Backend Guide](./backend/README.md)** — FastAPI, LangChain, and Pinecone backend service details.
* **[Frontend Guide](./frontend/README.md)** — React 19, Vite, and component hierarchy documentation.

---

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

Refer to **[DEVELOPMENT.md](./DEVELOPMENT.md)** for a detailed walkthrough.

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
Configure your `.env` file in the `backend` folder (refer to `backend/.env.example`):

```env
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_index_name_here
GOOGLE_API_KEY=your_gemini_api_key_here
```

### Start the Backend Server
```bash
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
