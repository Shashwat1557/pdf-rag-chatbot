from groq import Groq
from typing import List, Dict, Any, Optional, AsyncGenerator
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a helpful AI assistant that answers questions based on the provided document context.

Guidelines:
- Use ONLY the information from the provided context to answer
- If the context doesn't contain enough information, say so honestly
- Cite sources using [1], [2], etc. referencing the provided sources
- Be concise but thorough
- If asked something outside the document scope, politely decline"""

SOURCE_TEMPLATE = """Source [{idx}] (Page {page}, Chunk {chunk}):
{content}"""


class LLMService:
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL
    
    def _build_context(self, chunks: List[Dict[str, Any]]) -> tuple[str, List[Dict]]:
        """Build context string and source list from chunks"""
        context_parts = []
        sources = []
        
        for i, chunk in enumerate(chunks):
            source_idx = i + 1
            page = chunk["metadata"].get("page_number", "N/A")
            chunk_idx = chunk["metadata"].get("chunk_index", "N/A")
            content = chunk["content"]
            
            context_parts.append(SOURCE_TEMPLATE.format(
                idx=source_idx, page=page, chunk=chunk_idx, content=content
            ))
            
            sources.append({
                "id": source_idx,
                "content": content,
                "metadata": chunk["metadata"],
                "score": chunk.get("score", 0)
            })
        
        return "\n\n".join(context_parts), sources
    
    def _build_messages(
        self,
        query: str,
        context: str,
        history: List[Dict[str, str]] = None
    ) -> List[Dict[str, str]]:
        """Build message list for the LLM"""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        if history:
            for msg in history[-6:]:  # Keep last 6 messages for context
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        user_content = f"""Context from documents:
{context}

Question: {query}

Answer based on the context above. Cite sources using [1], [2], etc."""
        
        messages.append({"role": "user", "content": user_content})
        return messages
    
    async def chat(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        history: List[Dict[str, str]] = None,
        temperature: float = None
    ) -> str:
        """Non-streaming chat"""
        context, _ = self._build_context(chunks)
        messages = self._build_messages(query, context, history)
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature or 0.7,
            max_tokens=2048
        )
        
        return response.choices[0].message.content
    
    async def stream_chat(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        history: List[Dict[str, str]] = None,
        temperature: float = None
    ) -> AsyncGenerator[str, None]:
        """Streaming chat with sources at the end"""
        context, sources = self._build_context(chunks)
        messages = self._build_messages(query, context, history)
        
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature or 0.7,
            max_tokens=2048,
            stream=True
        )
        
        full_response = ""
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                full_response += content
                yield content
        
        # Send sources as final chunk
        yield f"\n\n---\n**Sources:**\n"
        for src in sources:
            yield f"[{src['id']}] {src['metadata'].get('filename', 'Unknown')} - Page {src['metadata'].get('page_number', 'N/A')}\n"