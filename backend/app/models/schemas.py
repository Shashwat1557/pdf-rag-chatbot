from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: DocumentStatus
    chunks_count: int = 0
    error: Optional[str] = None


class UploadResponse(BaseModel):
    document: DocumentResponse
    message: str


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    message: str
    document_id: Optional[str] = None
    history: List[ChatMessage] = []
    top_k: int = 5
    temperature: float = 0.7


class SourceChunk(BaseModel):
    content: str
    metadata: Dict[str, Any]
    score: float


class ChatResponse(BaseModel):
    message: str
    sources: List[SourceChunk] = []


class StreamChunk(BaseModel):
    type: str = Field(..., pattern="^(content|sources|done|error)$")
    data: Any
