from typing import List
import logging
import os
import requests

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(
        self,
        api_key: str = None,
        model: str = "sentence-transformers/all-MiniLM-L6-v2",
        use_local: bool = False # Ignored now, forces HF API
    ):
        self.api_key = api_key or os.getenv("HF_TOKEN")
        if not self.api_key:
            logger.warning("No HF_TOKEN found. The Hugging Face API might rate-limit or reject requests.")
        
        self.model = model
        self.api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{self.model}"
        logger.info(f"Using Hugging Face Inference API for embeddings: {self.model}")
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
            
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            
        try:
            response = requests.post(
                self.api_url, 
                headers=headers, 
                json={"inputs": texts, "options": {"wait_for_model": True}}
            )
            response.raise_for_status()
            embeddings = response.json()
            
            # The API returns a list of embeddings. Ensure it's the right format
            if isinstance(embeddings, dict) and "error" in embeddings:
                raise Exception(embeddings["error"])
                
            return embeddings
        except Exception as e:
            logger.error(f"Hugging Face API embedding error: {e}")
            # If the response has text, log it for debugging
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response body: {e.response.text}")
            raise
    
    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]