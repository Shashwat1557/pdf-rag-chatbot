import fitz
import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter
import tiktoken
from typing import List, Dict, Any
import uuid
import logging

logger = logging.getLogger(__name__)


class DocumentProcessor:
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        encoding_name: str = "cl100k_base"
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.encoding = tiktoken.get_encoding(encoding_name)
        
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=self._token_length,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
    
    def _token_length(self, text: str) -> int:
        return len(self.encoding.encode(text))
    
    def _parse_pymupdf(self, file_path: str) -> List[Dict[str, Any]]:
        pages = []
        doc = fitz.open(file_path)
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                pages.append({
                    "page_number": page_num + 1,
                    "content": text,
                    "source": "pymupdf"
                })
        doc.close()
        return pages
    
    def _parse_pdfplumber(self, file_path: str) -> List[Dict[str, Any]]:
        pages = []
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                tables = page.extract_tables()
                
                content_parts = []
                if text and text.strip():
                    content_parts.append(text)
                
                for table in tables:
                    table_text = self._format_table(table)
                    if table_text:
                        content_parts.append(f"\n[Table]\n{table_text}\n")
                
                if content_parts:
                    pages.append({
                        "page_number": page_num + 1,
                        "content": "\n\n".join(content_parts),
                        "source": "pdfplumber"
                    })
        return pages
    
    def _format_table(self, table: List[List[str]]) -> str:
        if not table:
            return ""
        rows = []
        for row in table:
            cleaned = [str(cell).strip() if cell else "" for cell in row]
            rows.append(" | ".join(cleaned))
        return "\n".join(rows)
    
    def extract_text(self, file_path: str) -> List[Dict[str, Any]]:
        try:
            pages = self._parse_pdfplumber(file_path)
            if pages:
                return pages
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}, trying PyMuPDF")
        
        try:
            return self._parse_pymupdf(file_path)
        except Exception as e:
            logger.error(f"Both parsers failed: {e}")
            raise
    
    def chunk_pages(self, pages: List[Dict[str, Any]], document_id: str, filename: str) -> List[Dict[str, Any]]:
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
                        "source": page.get("source", "unknown")
                    }
                }
                all_chunks.append(chunk)
        
        logger.info(f"Created {len(all_chunks)} chunks from {len(pages)} pages")
        return all_chunks
    
    def process_file(self, file_path: str, document_id: str = None, filename: str = None) -> List[Dict[str, Any]]:
        if document_id is None:
            document_id = str(uuid.uuid4())
        if filename is None:
            import os
            filename = os.path.basename(file_path)
        
        pages = self.extract_text(file_path)
        if not pages:
            return []
        
        return self.chunk_pages(pages, document_id, filename)