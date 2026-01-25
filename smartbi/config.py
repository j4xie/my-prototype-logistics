from __future__ import annotations
"""
SmartBI Service Configuration
"""
import os
from functools import lru_cache

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # LLM Configuration
    llm_api_key: str = ""
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "qwen-plus"

    # Service Configuration
    debug: bool = False
    port: int = 8083
    host: str = "0.0.0.0"

    # CORS Configuration
    cors_origins: list = ["*"]

    # File Upload Configuration
    max_file_size_mb: int = 50
    allowed_extensions: list = [".xlsx", ".xls", ".csv"]

    # Cache Configuration
    cache_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
