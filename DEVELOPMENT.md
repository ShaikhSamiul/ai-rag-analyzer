# Local Development & Setup Guide

This guide provides instructions for setting up, developing, testing, and troubleshooting the **AI-Powered RAG Document Analyzer** locally.

---

## 1. Prerequisites

Ensure the following runtimes and credentials are ready on your machine:
* **Python:** 3.11 or higher (`python --version`)
* **Node.js:** 18 or higher with npm (`node --version`, `npm --version`)
* **Pinecone Account:** An active Pinecone account with a serverless index created:
  * **Dimensions:** `3072` (must match `models/gemini-embedding-001`)
  * **Metric:** `cosine`
* **Google Gemini API Key:** An active key from [Google AI Studio](https://aistudio.google.com/).

---

## 2. Backend Setup

### 2.1 Virtual Environment & Dependencies
Navigate to the `backend/` directory:

```bash
cd backend
```

Create and activate a virtual environment:

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

### 2.2 Configure Environment Variables
Create a `.env` file in the `backend/` directory (refer to `.env.example`):

```env
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=rag-analyzer
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
# Optional: Allowed CORS origins (comma-separated)
CORS_ORIGINS=https://ai-rag-analyzer.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

### 2.3 Run the Development Server
Start the FastAPI server with live reloading:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Verify the server is running:
* **Interactive API Docs (Swagger UI):** Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in your browser.
* **Keepalive endpoint:** Open [http://127.0.0.1:8000/wakeup](http://127.0.0.1:8000/wakeup).

---

## 3. Frontend Setup

### 3.1 Install Node Dependencies
Open a second terminal window and navigate to the `frontend/` directory:

```bash
cd frontend
npm install
```

### 3.2 Configure Environment Variables
In the `frontend/` directory, configure your `.env` or create `.env.local` to point to your local backend server:

```env
# For local development with local backend:
VITE_API_BASE_URL=http://127.0.0.1:8000

# For local development targeting the deployed Render backend:
# VITE_API_BASE_URL=https://ai-rag-analyzer-backend.onrender.com
```

### 3.3 Start the Vite Dev Server
```bash
npm run dev
```

The frontend will be available at [http://localhost:5173](http://localhost:5173).

---

## 4. Full-Stack End-to-End Testing

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Confirm the **ServerStatusBanner** does not trigger an infinite loading spinner.
3. Drag & drop a digital PDF (under 5MB).
4. Click **"Process Document"**:
   * Observe backend console logs: `INFO: Created N total chunks. Generating vectors...`
   * Confirm vectors are successfully upserted to Pinecone under the generated session namespace.
5. In the chat interface, enter a query about the document content.
6. Verify the AI response is grounded strictly in the uploaded document.

---

## 5. Troubleshooting & Common Issues

### Issue 1: CORS Error in Browser Console
* **Symptom:** `Access to fetch at 'http://127.0.0.1:8000/upload' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`
* **Cause:** The backend's `CORSMiddleware` in `backend/main.py` is configured with `allow_origins=["https://ai-rag-analyzer.vercel.app"]` and does not include your local origin (`http://localhost:5173` or `http://127.0.0.1:5173`).
* **Fix:** `backend/main.py` now reads `CORS_ORIGINS` from `.env`, defaulting to both production and local origins. Ensure `CORS_ORIGINS` includes your local port.

### Issue 2: Pinecone Vector Dimension Mismatch
* **Symptom:** `PineconeApiException: Vector dimension 3072 does not match index dimension 1536.`
* **Cause:** The Pinecone index was created with a dimension count different from the embedding model's output.
* **Fix:** Ensure the Pinecone index is created with:
  * **Dimension:** `3072` (matching `models/gemini-embedding-001`)
  * **Metric:** `cosine`

### Issue 3: Empty Text or Poor Extraction on Scanned PDFs
* **Symptom:** `Created 0 total chunks` or the AI reports it has no context to answer questions.
* **Cause:** PyPDF2 extracts text characters from the PDF document object stream. If the PDF consists of scanned raster images (e.g. photocopied pages), PyPDF2 returns empty strings because it does not perform OCR (Optical Character Recognition).
* **Fix:** Upload digital text PDFs, or refer to [ROADMAP.md](./ROADMAP.md) Phase 2 for adding PyMuPDF or multimodal Gemini PDF processing.

### Issue 4: Rate Limit Exceeded (Google AI Studio 429)
* **Symptom:** `google.api_core.exceptions.ResourceExhausted: 429 Quota exceeded.`
* **Cause:** Large documents generate dozens of chunks simultaneously, triggering the requests-per-minute (RPM) quota on the free tier of the Gemini API.
* **Fix:** `main.py` now uses production `gemini-2.5-flash` with a 1,000,000 TPM quota. For large documents, keep files within 5–20 pages during testing.
