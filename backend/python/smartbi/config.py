from __future__ import annotations
"""
SmartBI Service Configuration
"""
import os
from functools import lru_cache
from typing import List, Optional
from urllib.parse import quote

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # LLM Configuration - Text Models
    llm_api_key: str = ""
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "qwen-plus"  # Default text model

    # LLM Configuration - Vision Model (for structure detection)
    llm_vl_model: str = "qwen-vl-max"  # Vision-Language model for Excel structure analysis
    llm_vl_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    # LLM Configuration - Fast Model (for quick operations)
    llm_fast_model: str = "qwen-turbo"  # Faster, cheaper model for simple tasks

    # LLM Configuration - Reasoning Model (for complex decisions)
    llm_reasoning_model: str = "qwq-32b"  # Deep reasoning model for Layer 4

    # Zero-Code Configuration
    structure_detection_confidence_threshold: float = 0.7  # Minimum confidence for structure detection
    semantic_mapping_confidence_threshold: float = 0.8  # Minimum confidence for field mapping
    enable_multi_model_enhancement: bool = True  # Enable Layer 4 multi-model voting
    max_self_correction_rounds: int = 3  # Max rounds for self-correction loop
    use_llm_first: bool = True  # Use LLM as default detection method instead of rules

    # Service Configuration
    debug: bool = False
    port: int = 8083
    host: str = "0.0.0.0"

    # CORS Configuration
    cors_origins: List[str] = ["*"]

    # File Upload Configuration
    max_file_size_mb: int = 50
    allowed_extensions: List[str] = [".xlsx", ".xls", ".csv"]

    # Cache Configuration
    cache_ttl_seconds: int = 3600
    schema_cache_enabled: bool = True  # Enable schema caching for repeated files

    # ==========================================
    # PostgreSQL SmartBI Database Configuration
    # ==========================================
    # Enables Python service to directly query dynamic data stored in PostgreSQL
    postgres_enabled: bool = False
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "smartbi_db"
    postgres_user: str = "smartbi_user"
    postgres_password: str = ""
    postgres_pool_size: int = 5
    postgres_max_overflow: int = 10

    # ==========================================
    # Food Knowledge Base Database Configuration
    # ==========================================
    # Uses cretas_db (main DB) with pgvector for RAG
    food_kb_postgres_host: str = "localhost"
    food_kb_postgres_port: int = 5432
    food_kb_postgres_db: str = "cretas_db"
    food_kb_postgres_user: str = "cretas_user"
    food_kb_postgres_password: str = ""

    # Embedding model configuration (DashScope text-embedding-v3)
    food_kb_embedding_model: str = "text-embedding-v3"
    food_kb_embedding_dims: int = 768

    @property
    def food_kb_db_url(self) -> str:
        """Get Food KB PostgreSQL connection URL (for asyncpg)"""
        user = quote(self.food_kb_postgres_user, safe='')
        passwd = quote(self.food_kb_postgres_password, safe='')
        return f"postgresql://{user}:{passwd}@{self.food_kb_postgres_host}:{self.food_kb_postgres_port}/{self.food_kb_postgres_db}"

    @property
    def postgres_url(self) -> str:
        """Get PostgreSQL connection URL"""
        user = quote(self.postgres_user, safe='')
        passwd = quote(self.postgres_password, safe='')
        return f"postgresql://{user}:{passwd}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    @property
    def postgres_async_url(self) -> str:
        """Get PostgreSQL async connection URL (for asyncpg)"""
        user = quote(self.postgres_user, safe='')
        passwd = quote(self.postgres_password, safe='')
        return f"postgresql+asyncpg://{user}:{passwd}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    class Config:
        env_file = (".env", "smartbi/.env")
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
