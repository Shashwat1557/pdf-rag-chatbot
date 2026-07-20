import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
    
    def add_documents(
        self,
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        ids: List[str] = None
    ) -> List[str]:
        if ids is None:
            import uuid
            ids = [str(uuid.uuid4()) for _ in documents]
        
        self.collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
        return ids
    
    def query(
        self,
        query_embedding: List[float],
        n_results: int = 5,
        where: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"]
        )
        return results
    
    def delete_document(self, document_id: str) -> bool:
        try:
            self.collection.delete(where={"document_id": document_id})
            return True
        except Exception as e:
            logger.error(f"Delete error: {e}")
            return False
    
    def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        results = self.collection.get(
            where={"document_id": document_id},
            include=["documents", "metadatas"]
        )
        
        chunks = []
        for i, doc in enumerate(results.get("documents", [])):
            chunks.append({
                "content": doc,
                "metadata": results["metadatas"][i] if results.get("metadatas") else {}
            })
        return chunks
    
    def list_documents(self) -> List[Dict[str, Any]]:
        results = self.collection.get(include=["metadatas"])
        docs = {}
        for meta in results.get("metadatas", []):
            doc_id = meta.get("document_id")
            filename = meta.get("filename")
            if doc_id and filename and doc_id not in docs:
                docs[doc_id] = filename
        return [{"document_id": k, "filename": v} for k, v in docs.items()]