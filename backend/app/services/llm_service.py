import os
import logging
from typing import AsyncGenerator, List, Dict, Any
from groq import AsyncGroq

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful, conversational AI assistant. You have access to document context provided below.

Guidelines:
- Answer naturally and conversationally - be warm, not robotic
- When the question relates to the provided documents, use that information as your primary source and cite it with [Source X]
- For casual conversation (greetings, thanks, small talk), respond naturally without needing to cite sources
- If asked something outside the document scope, you can answer from general knowledge but mention it's not from the documents
- Keep responses concise but friendly"""


class LLMService:
    def __init__(
        self,
        api_key: str = None,
        model: str = "llama-3.3-70b-versatile",
        temperature: float = 0.7
    ):
        self.client = AsyncGroq(api_key=api_key or os.getenv("GROQ_API_KEY"))
        self.model = model
        self.temperature = temperature
    
    def _build_messages(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        history: List[Dict[str, str]] = None
    ) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        if history:
            for msg in history[-6:]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        
        context_parts = []
        for i, chunk in enumerate(chunks):
            context_parts.append(f"[Source {i+1}] {chunk['content']}")
        
        context = "\n\n".join(context_parts)
        
        user_msg = f"""Here is relevant context from the uploaded documents:

{context}

User question: {query}

Please answer naturally. If the documents contain relevant information, use it and cite sources like [Source 1]. For casual conversation, just respond normally."""
        
        messages.append({"role": "user", "content": user_msg})
        return messages
    
    async def stream_chat(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        history: List[Dict[str, str]] = None,
        temperature: float = None
    ) -> AsyncGenerator[str, None]:
        messages = self._build_messages(query, chunks, history)
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature or self.temperature,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"LLM streaming error: {e}")
            raise
    
    async def chat(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        history: List[Dict[str, str]] = None,
        temperature: float = None
    ) -> str:
        messages = self._build_messages(query, chunks, history)
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature or self.temperature,
                stream=False
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM chat error: {e}")
            raise