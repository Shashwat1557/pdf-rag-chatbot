import fitz
import pdfplumber
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class PDFParser:
    def __init__(self):
        pass
    
    def extract_text_pymupdf(self, file_path: str) -> List[Dict[str, Any]]:
        """Extract text using PyMuPDF (faster, better for text-heavy PDFs)"""
        pages = []
        doc = fitz.open(file_path)
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                pages.append({
                    "page_number": page_num + 1,
                    "content": text,
                    "metadata": {"source": "pymupdf"}
                })
        doc.close()
        return pages
    
    def extract_text_pdfplumber(self, file_path: str) -> List[Dict[str, Any]]:
        """Extract text using pdfplumber (better for tables/structured content)"""
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
                        "metadata": {"source": "pdfplumber"}
                    })
        return pages
    
    def _format_table(self, table: List[List[str]]) -> str:
        if not table:
            return ""
        formatted = []
        for row in table:
            cleaned = [str(cell).strip() if cell else "" for cell in row]
            formatted.append(" | ".join(cleaned))
        return "\n".join(formatted)
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """Try pdfplumber first (better for tables), fallback to PyMuPDF"""
        try:
            pages = self.extract_text_pdfplumber(file_path)
            if pages:
                logger.info(f"Parsed {len(pages)} pages with pdfplumber")
                return pages
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}, trying PyMuPDF")
        
        try:
            pages = self.extract_text_pymupdf(file_path)
            logger.info(f"Parsed {len(pages)} pages with PyMuPDF")
            return pages
        except Exception as e:
            logger.error(f"Both parsers failed: {e}")
            raise
