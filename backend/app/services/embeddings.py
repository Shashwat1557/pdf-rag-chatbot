from typing import List
import logging
import os

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(
        self,
        api_key: str = None,
        model: str = "text-embedding-3-small",
        use_local: bool = False
    ):
        self.use_local = use_local
        if use_local:
            try:
                from sentence_transformers import SentenceTransformer
                self.local_model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("Using local SentenceTransformers for embeddings")
            except ImportError:
                logger.warning("sentence-transformers not installed, falling back to OpenAI")
                self.use_local = False
        
        if not self.use_local:
            from openai import OpenAI
            self.client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
            self.model = model
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        
        if self.use_local:
            try:
                embeddings = self.local_model.encode(texts, normalize_embeddings=True)
                return embeddings.tolist()
            except Exception as e:
                logger.error(f"Local embedding error: {e}")
                raise
        
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise
    
    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]