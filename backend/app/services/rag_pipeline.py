import uuid
import logging
import tempfile
import os
from typing import List, Dict, Any, Optional, AsyncGenerator

from app.services.pdf_parser import PDFParser
from app.services.chunker import DocumentChunker
from app.services.embeddings import EmbeddingService, VectorStore
from app.services.llm import LLMService

logger = logging.getLogger(__name__)


class RAGPipeline:
    def __init__(
        self,
        pdf_parser: PDFParser = None,
        chunker: DocumentChunker = None,
        embedding_service: EmbeddingService = None,
        vector_store: VectorStore = None,
        llm_service: LLMService = None
    ):
        self.pdf_parser = pdf_parser or PDFParser()
        self.chunker = chunker or DocumentChunker()
        self.embedding_service = embedding_service or EmbeddingService()
        self.vector_store = vector_store or VectorStore()
        self.llm_service = llm_service or LLMService()
    
    def ingest_document(
        self,
        file_path: str,
        document_id: str = None,
        filename: str = None
    ) -> Dict[str, Any]:
        """Process and ingest a document into the vector store"""
        if document_id is None:
            document_id = str(uuid.uuid4())
        if filename is None:
            filename = os.path.basename(file_path)
        
        # Parse PDF
        pages = self.pdf_parser.parse(file_path)
        if not pages:
            return {"success": False, "chunks": 0, "document_id": document_id, "error": "No text extracted"}
        
        # Chunk pages
        chunks = self.chunker.chunk_pages(pages, document_id, filename)
        if not chunks:
            return {"success": False, "chunks": 0, "document_id": document_id, "error": "No chunks created"}
        
        # Generate embeddings
        texts = [c["content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        embeddings = self.embedding_service.embed_texts(texts)
        
        # Store in vector DB
        ids = [f"{document_id}_{c['metadata']['chunk_index']}" for c in chunks]
        self.vector_store.add_documents(texts, embeddings, metadatas, ids)
        
        return {
            "success": True,
            "document_id": document_id,
            "filename": filename,
            "chunks": len(chunks)
        }
    
    def retrieve(
        self,
        query: str,
        n_results: int = 5,
        document_id: str = None
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant chunks for a query"""
        query_embedding = self.embedding_service.embed_query(query)
        
        where = {"document_id": document_id} if document_id else None
        
        results = self.vector_store.query(
            query_embedding=query_embedding,
            n_results=n_results,
            where=where
        )
        
        chunks = []
        for i, doc in enumerate(results.get("documents", [[]])[0]):
            chunks.append({
                "content": doc,
                "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                "score": 1 - results["distances"][0][i] if results.get("distances") else 0
            })
        
        return chunks
    
    async def query(
        self,
        query: str,
        n_results: int = 5,
        document_id: str = None,
        history: List[Dict[str, str]] = None,
        temperature: float = None,
        stream: bool = True
    ) -> AsyncGenerator[str, None] | str:
        """Query the RAG pipeline with streaming"""
        chunks = self.retrieve(query, n_results, document_id)
        
        if not chunks:
            yield "I couldn't find any relevant information in the documents to answer your question."
            return
        
        if stream:
            async for chunk in self.llm_service.stream_chat(
                query, chunks, history, temperature
            ):
                yield chunk
        else:
            response = await self.llm_service.chat(
                query, chunks, history, temperature
            )
            yield response
    
    def list_documents(self) -> List[Dict[str, Any]]:
        """List all ingested documents"""
        return self.vector_store.list_documents()
    
    def delete_document(self, document_id: str) -> bool:
        """Delete a document from the vector store"""
        return self.vector_store.delete_document(document_id)
    
    def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a document"""
        return self.vector_store.get_document_chunks(document_id)