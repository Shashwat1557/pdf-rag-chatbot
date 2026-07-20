from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any
from app.core.config import settings
import tiktoken
import logging

logger = logging.getLogger(__name__)


class DocumentChunker:
    def __init__(
        self,
        chunk_size: int = None,
        chunk_overlap: int = None,
        encoding_name: str = "cl100k_base"
    ):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        self.encoding = tiktoken.get_encoding(encoding_name)
        
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=self._token_length,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
    
    def _token_length(self, text: str) -> int:
        return len(self.encoding.encode(text))
    
    def chunk_pages(self, pages: List[Dict[str, Any]], document_id: str, filename: str) -> List[Dict[str, Any]]:
        """Chunk pages into overlapping segments with metadata"""
        all_chunks = []
        
        for page in pages:
            page_num = page["page_number"]
            content = page["content"]
            
            chunks = self.splitter.split_text(content)
            
            for i, chunk_text in enumerate(chunks):
                chunk = {
                    "content": chunk_text,
                    "metadata": {
                        "document_id": document_id,
                        "filename": filename,
                        "page_number": page_num,
                        "chunk_index": i,
                        "token_count": self._token_length(chunk_text),
                    }
                }
                all_chunks.append(chunk)
        
        logger.info(f"Created {len(all_chunks)} chunks from {len(pages)} pages")
        return all_chunks
