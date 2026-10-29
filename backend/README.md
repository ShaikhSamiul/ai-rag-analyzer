# Backend — FastAPI RAG Service

The backend service for the **AI-Powered RAG Document Analyzer** is built with FastAPI, LangChain, Pinecone, and Google Gemini AI. It orchestrates document parsing, semantic text chunking, dense vector embeddings, vector indexing, and grounded LLM synthesis.

---

## 1. Core Responsibilities

1. **Document Ingestion (`POST /upload`):** Accepts PDF uploads, extracts digital text using PyPDF2, segments content using `RecursiveCharacterTextSplitter`, generates vector embeddings via `gemini-embedding-001`, and uploads them to Pinecone partitioned by `session_id`.
2. **Contextual Retrieval & Synthesis (`POST /chat`):** Performs similarity search against the session namespace in Pinecone, formats retrieved contexts, and prompts Google's Gemini LLM to synthesize a grounded answer.
3. **Container Keepalive (`GET /wakeup`):** Provides a minimal endpoint to wake up serverless/free-tier hosting instances (such as Render) during client load.

---

## 2. Dependencies & Ecosystem

Key dependencies defined in `requirements.txt`:

* **`fastapi` & `uvicorn`:** Asynchronous web framework and ASGI production server.
* **`python-multipart`:** Required for handling file uploads (`UploadFile` and `File`).
* **`PyPDF2`:** PDF extraction library for parsing page text streams.
* **`langchain`:** RAG pipeline orchestration framework.
* **`langchain-google-genai`:** Official LangChain integration with Google Generative AI (Gemini Embeddings & Chat models).
* **`langchain-pinecone`:** Integration for querying and updating Pinecone vector indexes.
* **`langchain-text-splitters`:** Semantic text chunking utilities.
* **`python-dotenv` & `pydantic`:** Environment variable parsing and request schema validation.

---

## 3. Environment Variables

Configure the following variables in `backend/.env` (refer to `.env.example`):

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=rag-analyzer
GOOGLE_API_KEY=your_gemini_api_key
# Optional: Comma-delimited list of permitted CORS origins
CORS_ORIGINS=https://ai-rag-analyzer.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

---

## 4. Local Development

### 4.1 Activate Virtual Environment & Install
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 4.2 Run Server
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 4.3 Interactive API Documentation
* **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 5. Architecture & Enhancement References

* Full pipeline diagrams and data flows: see [ARCHITECTURE.md](../ARCHITECTURE.md)
* Complete endpoint contract schemas: see [API_SPECIFICATION.md](../API_SPECIFICATION.md)
* Backlog of planned features and model upgrades: see [ROADMAP.md](../ROADMAP.md)
* Operational guidelines for AI agents: see [AGENTS.md](../AGENTS.md)

