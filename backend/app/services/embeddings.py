from typing import List
import logging
from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(
        self,
        api_key: str = None,
        model: str = "all-MiniLM-L6-v2",
        use_local: bool = True
    ):
        logger.info(f"Using ChromaDB built-in ONNX model for embeddings (runs locally, 0 APIs needed)")
        # This automatically downloads the highly compressed ONNX model (~90MB) on first run
        self.ef = ONNXMiniLM_L6_V2(preferred_providers=['CPUExecutionProvider'])
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
            
        try:
            # ONNX embedding execution
            return self.ef(texts)
        except Exception as e:
            logger.error(f"Local ONNX embedding error: {e}")
            raise
    
    def embed_query(self, query: str) -> List[float]:
        try:
            return self.ef([query])[0]
        except Exception as e:
            logger.error(f"Local ONNX query embedding error: {e}")
            raise