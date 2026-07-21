from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import tempfile
import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from app.services.document_processor import DocumentProcessor
from app.services.vector_store import VectorStore
from app.services.embeddings import EmbeddingService
from app.services.llm_service import LLMService
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global services
services = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting RAG API...")
    services["doc_processor"] = DocumentProcessor(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP
    )
    services["vector_store"] = VectorStore()
    services["embedding_service"] = EmbeddingService(use_local=True)
    services["llm_service"] = LLMService()
    logger.info("Services initialized")
    yield
    logger.info("Shutting down...")


app = FastAPI(title="PDF RAG Chatbot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )


class QueryRequest(BaseModel):
    query: str
    document_id: Optional[str] = None
    top_k: int = 5
    temperature: float = 0.7
    stream: bool = True
    history: List[dict] = []


class DocumentResponse(BaseModel):
    document_id: str
    filename: str
    chunks: int
    status: str


@app.post("/api/v1/documents/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files supported")
    
    # Save temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(413, "File too large (max 50MB)")
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Process document
        doc_processor = services["doc_processor"]
        chunks = doc_processor.process_file(tmp_path, filename=file.filename)
        
        if not chunks:
            raise HTTPException(400, "No text extracted from PDF")
        
        # Generate embeddings
        texts = [c["content"] for c in chunks]
        embeddings = services["embedding_service"].embed_texts(texts)
        
        # Store in vector DB
        metadatas = [c["metadata"] for c in chunks]
        services["vector_store"].add_documents(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas
        )
        
        doc_id = chunks[0]["metadata"]["document_id"]
        
        return DocumentResponse(
            document_id=doc_id,
            filename=file.filename,
            chunks=len(chunks),
            status="completed"
        )
    finally:
        os.unlink(tmp_path)


@app.get("/api/v1/documents")
async def list_documents():
    docs = services["vector_store"].list_documents()
    return {"documents": docs}


@app.get("/api/v1/documents/{document_id}")
async def get_document(document_id: str):
    chunks = services["vector_store"].get_document_chunks(document_id)
    if not chunks:
        raise HTTPException(404, "Document not found")
    return {"document_id": document_id, "chunks": len(chunks)}


@app.delete("/api/v1/documents/{document_id}")
async def delete_document(document_id: str):
    success = services["vector_store"].delete_document(document_id)
    if not success:
        raise HTTPException(404, "Document not found")
    return {"message": "Document deleted"}


@app.post("/api/v1/chat")
async def chat(request: QueryRequest):
    # Retrieve relevant chunks
    query_embedding = services["embedding_service"].embed_query(request.query)
    
    where = {"document_id": request.document_id} if request.document_id else None
    
    results = services["vector_store"].query(
        query_embedding=query_embedding,
        n_results=request.top_k,
        where=where
    )
    
    chunks = []
    for i, doc in enumerate(results.get("documents", [[]])[0]):
        chunks.append({
            "content": doc,
            "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
            "distance": results["distances"][0][i] if results.get("distances") else None
        })
    
    if not chunks:
        return {"response": "No relevant documents found.", "sources": []}
    
    # Stream response
    async def stream_response():
        import json
        async for token in services["llm_service"].stream_chat(
            request.query,
            chunks,
            request.history,
            request.temperature
        ):
            payload = json.dumps({"content": token})
            yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"
    
    if request.stream:
        return StreamingResponse(stream_response(), media_type="text/event-stream")
    else:
        response = await services["llm_service"].chat(
            request.query, chunks, request.history, request.temperature
        )
        return {"response": response, "sources": chunks}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)