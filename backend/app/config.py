import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/docmind"
    JWT_SECRET_KEY: str = "super_secret_jwt_signature_key_docmind_ai_prod_12345"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week expiration
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    UPLOAD_DIR: str = "uploads"
    PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Create upload directory on startup if it doesn't exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
