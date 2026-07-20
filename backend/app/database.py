import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import declarative_base
from app.config import settings

logger = logging.getLogger(__name__)

# Create async engine for PostgreSQL connection pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

# Async session maker
SessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

Base = declarative_base()

# Yield database session to route dependency injections
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Startup initialization script
async def init_db():
    async with engine.begin() as conn:
        try:
            # Enable the pgvector extension
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            # Generate all schema tables mapped by SQLAlchemy models
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schemas initialized and pgvector loaded successfully.")
        except Exception as e:
            logger.error(f"Error during database initialization: {e}")
            raise e
