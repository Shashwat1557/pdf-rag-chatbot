from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "PDF RAG Chatbot"
    
    OPENAI_API_KEY: str = Field(..., env="OPENAI_API_KEY")
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    GROQ_API_KEY: str = Field(..., env="GROQ_API_KEY")
    GROQ_MODEL: str = "llama-3.1-70b-versatile"
    
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "pdf_documents"
    
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    
    TOP_K: int = 5
    SIMILARITY_THRESHOLD: float = 0.7
    
    MAX_FILE_SIZE: int = 50 * 1024 * 1024
    ALLOWED_EXTENSIONS: set = {".pdf"}
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()