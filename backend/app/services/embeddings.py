from typing import List
import logging
import os
import google.generativeai as genai

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(
        self,
        api_key: str = None,
        model: str = "models/text-embedding-004",
        use_local: bool = False # Ignored now, forces Gemini API
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("No GEMINI_API_KEY found. Embedding requests will fail.")
        else:
            genai.configure(api_key=self.api_key)
            
        self.model = model
        logger.info(f"Using Google Gemini API for embeddings: {self.model}")
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
            
        try:
            # Gemini embedding API
            result = genai.embed_content(
                model=self.model,
                content=texts,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            logger.error(f"Google Gemini embedding error: {e}")
            raise
    
    def embed_query(self, query: str) -> List[float]:
        try:
            result = genai.embed_content(
                model=self.model,
                content=query,
                task_type="retrieval_query"
            )
            return result['embedding']
        except Exception as e:
            logger.error(f"Google Gemini query embedding error: {e}")
            raise