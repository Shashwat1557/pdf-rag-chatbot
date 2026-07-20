# PDF RAG Chatbot

A full-stack PDF chat application with RAG (Retrieval-Augmented Generation) pipeline.

## Architecture

```
Frontend (Next.js) → Backend (FastAPI) → Document Parser (PyMuPDF + pdfplumber)
                                           ↓
                                    Chunking (LangChain)
                                           ↓
                                    Embeddings (OpenAI)
                                           ↓
                                    Vector DB (ChromaDB)
                                           ↓
                                    Retriever + LLM (Groq)
                                           ↓
                                    Streaming Response
```

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API key (for embeddings)
- Groq API key (free, for LLM - get at https://console.groq.com)

### Backend Setup

```bash
cd pdf-rag-chatbot/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys:
# OPENAI_API_KEY=sk-...
# GROQ_API_KEY=gsk-...

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd pdf-rag-chatbot/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/documents/upload` | Upload PDF document |
| GET | `/api/v1/documents` | List all documents |
| GET | `/api/v1/documents/{id}` | Get document info |
| DELETE | `/api/v1/documents/{id}` | Delete document |
| POST | `/api/v1/chat` | Query with streaming |

## Usage

1. Start both backend and frontend
2. Upload a PDF via the sidebar
3. Select the document (or leave unselected for all docs)
4. Ask questions in the chat

## Features

- **Multi-PDF support**: Upload and chat with multiple documents
- **Source citations**: Answers include source references with page numbers
- **Streaming responses**: Real-time token streaming from Groq
- **Drag & drop upload**: Easy PDF upload in sidebar
- **Document management**: View, select, delete documents

## Environment Variables

### Backend (.env)
```env
OPENAI_API_KEY=sk-...          # Required - for embeddings
GROQ_API_KEY=gsk-...           # Required - for LLM (free tier)
CHROMA_PERSIST_DIR=./chroma_db # Optional - vector DB location
CHUNK_SIZE=1000                # Optional - chunk size in tokens
CHUNK_OVERLAP=200              # Optional - chunk overlap
TOP_K=5                        # Optional - retrieval count
GROQ_MODEL=llama-3.1-70b-versatile # Optional - LLM model
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | FastAPI, Uvicorn |
| PDF Parsing | PyMuPDF, pdfplumber |
| Chunking | LangChain Text Splitters |
| Embeddings | OpenAI text-embedding-3-small |
| Vector DB | ChromaDB |
| LLM | Groq (Llama 3.1 70B) |
| Streaming | Server-Sent Events (SSE) |

## Project Structure

```
pdf-rag-chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── core/config.py       # Settings
│   │   ├── services/
│   │   │   ├── document_processor.py  # PDF parsing + chunking
│   │   │   ├── embeddings.py          # OpenAI embeddings
│   │   │   ├── vector_store.py        # ChromaDB wrapper
│   │   │   ├── llm_service.py         # Groq LLM with streaming
│   │   │   └── rag_pipeline.py        # Full RAG pipeline
│   │   └── api/               # (future: split routes)
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx       # Main chat page
    │   │   ├── layout.tsx     # Root layout
    │   │   ├── globals.css    # Tailwind styles
    │   │   └── api/           # API proxy routes
    │   ├── components/
    │   │   ├── MessageBubble.tsx
    │   │   ├── ChatInput.tsx
    │   │   └── DocumentSidebar.tsx
    │   ├── lib/utils.ts
    │   └── types/index.ts
    ├── package.json
    ├── tailwind.config.ts
    └── next.config.js
```