"""
PostgreSQL Database Connection

Provides SQLAlchemy engine and session management for SmartBI dynamic data.
"""

import logging
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Create engine only if PostgreSQL is enabled
engine = None
SessionLocal = None

if settings.postgres_enabled:
    try:
        engine = create_engine(
            settings.postgres_url,
            poolclass=QueuePool,
            pool_size=settings.postgres_pool_size,
            max_overflow=settings.postgres_max_overflow,
            pool_pre_ping=True,  # Test connections before use
            pool_recycle=3600,
            pool_timeout=10,
            echo=settings.debug,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info(f"PostgreSQL connection pool created: {settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}")
    except Exception as e:
        logger.error(f"Failed to create PostgreSQL connection: {e}")
        engine = None
        SessionLocal = None


def get_db() -> Generator[Session, None, None]:
    """
    Get database session.

    Usage:
        with get_db() as db:
            results = db.query(Model).all()

    Or as FastAPI dependency:
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    if SessionLocal is None:
        raise RuntimeError("PostgreSQL is not enabled or connection failed")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager for database session.

    Usage:
        with get_db_context() as db:
            results = db.query(Model).all()
    """
    if SessionLocal is None:
        raise RuntimeError("PostgreSQL is not enabled or connection failed")

    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def is_postgres_enabled() -> bool:
    """Check if PostgreSQL is enabled and connected"""
    return engine is not None and SessionLocal is not None


def test_connection() -> bool:
    """Test PostgreSQL connection"""
    if not is_postgres_enabled():
        return False

    try:
        with get_db_context() as db:
            db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"PostgreSQL connection test failed: {e}")
        return False
