from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    debug: bool = False
    port: int = 8082
    host: str = "0.0.0.0"
    cors_origins: List[str] = ["*"]

    class Config:
        env_file = ".env"

settings = Settings()
