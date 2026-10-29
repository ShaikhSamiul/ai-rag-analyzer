# API Specification & Endpoint Documentation

This document describes the REST API contract for the **AI-Powered RAG Document Analyzer** backend service.

---

## 1. Base URLs & Environment

| Environment | Base URL | Notes |
| :--- | :--- | :--- |
| **Production** | `https://ai-rag-analyzer-backend.onrender.com` | Hosted on Render Free Tier (subject to 30-60s cold start) |
| **Local Development** | `http://127.0.0.1:8000` | Default FastAPI ASGI server via Uvicorn |

---

## 2. Global Request & Response Formats

* All JSON request bodies must include `Content-Type: application/json`.
* File uploads require `multipart/form-data`.
* Standardized error response body format:
  ```json
  {
    "detail": "Descriptive error message explaining the failure condition."
  }
  ```

---

## 3. Endpoints (Current Implementation)

### 3.1 Document Ingestion
Uploads a PDF, extracts text content, splits it into semantic chunks, generates vector embeddings, and stores them in Pinecone under the given session namespace.

* **Method:** `POST`
* **Path:** `/upload`
* **Content-Type:** `multipart/form-data`

#### Request Parameters
| Name | Type | In | Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| `file` | `binary` | Form-Data | Yes | Digital text PDF document (recommended max 5MB). |
| `session_id` | `string` | Form-Data | Yes | Unique client-generated session identifier for Pinecone namespace isolation. |

#### Responses

* **`200 OK` — Processing Successful**
  ```json
  {
    "message": "File successfully uploaded and processed.",
    "filename": "sample_document.pdf",
    "total_chunks": 14
  }
  ```

* **`400 Bad Request` — Invalid File Extension**
  ```json
  {
    "detail": "Invalid file type. Only PDFs are allowed."
  }
  ```

* **`500 Internal Server Error` — Extraction or Indexing Failure**
  ```json
  {
    "detail": "Failed to read PDF text: [Underlying error detail]"
  }
  ```

#### Example Usage

**cURL:**
```bash
curl -X POST "http://127.0.0.1:8000/upload" \
  -F "file=@/path/to/contract.pdf" \
  -F "session_id=session-173000-abc123"
```

**JavaScript (Fetch):**
```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("session_id", "session-173000-abc123");

const response = await fetch("http://127.0.0.1:8000/upload", {
  method: "POST",
  body: formData,
});
const result = await response.json();
```

---

### 3.2 Conversational Retrieval (Chat)
Retrieves the top-k most relevant text chunks from the session's vector namespace, constructs an augmented prompt, and queries Google Gemini for a grounded answer.

* **Method:** `POST`
* **Path:** `/chat`
* **Content-Type:** `application/json`

#### Request Body Schema
```json
{
  "question": "string (non-empty query string)",
  "session_id": "string (the session namespace where vectors reside)"
}
```

#### Responses

* **`200 OK` — Answer Generated**
  ```json
  {
    "answer": "According to section 4 of the document, the agreement terminates on December 31, 2026."
  }
  ```

* **`422 Unprocessable Entity` — Missing or Invalid Payload**
  ```json
  {
    "detail": [
      {
        "loc": ["body", "question"],
        "msg": "field required",
        "type": "value_error.missing"
      }
    ]
  }
  ```

* **`500 Internal Server Error` — Pinecone/LLM Failure**
  ```json
  {
    "detail": "CRITICAL ERROR: Connection timeout contacting Pinecone vector index."
  }
  ```

#### Example Usage

**cURL:**
```bash
curl -X POST "http://127.0.0.1:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the primary topic of this document?", "session_id": "session-173000-abc123"}'
```

**JavaScript (Fetch):**
```javascript
const response = await fetch("http://127.0.0.1:8000/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    question: "What is the primary topic of this document?",
    session_id: "session-173000-abc123"
  })
});
const { answer } = await response.json();
```

---

### 3.3 Backend Keepalive / Cold-Start Probe
Lightweight, resource-free health probe used by frontend polling to initiate spin-up of idle cloud containers.

* **Method:** `GET`
* **Path:** `/wakeup`

#### Responses

* **`200 OK` — Container Active**
  ```json
  {
    "status": "awake"
  }
  ```

---

## 4. Planned Endpoints (Roadmap Specifications)

The following endpoints are specified for future phases of the project:

### 4.1 Streaming Chat (`POST /chat/stream`)
Returns a Server-Sent Events (SSE) stream of token deltas for real-time typewriter UI rendering.
* **Content-Type:** `text/event-stream`
* **Payload:** Same as `POST /chat`
* **Event Format:**
  ```text
  data: {"delta": "According "}
  data: {"delta": "to "}
  data: {"delta": "section "}
  ...
  data: [DONE]
  ```

### 4.2 Session Teardown (`DELETE /session/{session_id}`)
Flushes all vectors stored under the specified session namespace in Pinecone to minimize storage costs and maintain database hygiene.
* **Method:** `DELETE`
* **Path:** `/session/{session_id}`
* **Response `200 OK`:**
  ```json
  {
    "message": "Session namespace successfully flushed.",
    "session_id": "session-173000-abc123"
  }
  ```

### 4.3 Deep Health Check (`GET /health`)
Evaluates operational readiness of all downstream dependencies (Pinecone index connectivity, Gemini API reachability).
* **Method:** `GET`
* **Path:** `/health`
* **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "pinecone": "connected",
    "gemini": "connected",
    "version": "1.0.0"
  }
  ```

