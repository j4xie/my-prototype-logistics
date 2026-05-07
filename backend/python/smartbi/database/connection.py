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
            # Multi-worker safe pool sizing — see PR-1 spike
            # (docs/qa-audits/2026-05-07-uvicorn-workers-spike.md §5).
            # PG max_connections=100 reserves 3 for superuser → ~97 usable.
            # Budget: 4 workers × (2+3) sync × 2 engines = 40 + asyncpg ~20 +
            # Java JDBC ~30 = ~90, fits cap. Hardcoded so tuning here does not
            # require re-deriving postgres_pool_size, which is also used as
            # asyncpg max_size in smartbi/config.py:201.
            pool_size=2,
            max_overflow=3,
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


# ==========================================
# Cretas DB sync engine (cretas_prod_db / cretas_db)
# ==========================================
# Phase 2A discovered that several SmartBI analysis endpoints query tables that
# only live in cretas_prod_db (smart_bi_sales_data, smart_bi_finance_data,
# smart_bi_department_data, smart_bi_datasource), but the primary `engine` above
# is bound to smartbi_prod_db via POSTGRES_DB → produces UndefinedTableError in
# prod. Add a parallel sync engine bound to FOOD_KB_POSTGRES_DB (cretas_prod_db
# in prod, cretas_db in test) so those endpoints can route to the right pool.
#
# See spec: docs/superpowers/specs/2026-05-05-phase2a-db-pool-wiring-fix.md
# §2.1 (engine addition) and §1.3 (empirical canonical-DB mapping).
# Per spec §5.2: fail loud at use time (get_cretas_db_context raises) rather
# than degrade silently.
cretas_engine = None
CretasSessionLocal = None

if settings.food_kb_postgres_password:
    try:
        cretas_engine = create_engine(
            settings.food_kb_db_url,
            poolclass=QueuePool,
            # Same multi-worker rationale as the smartbi engine above.
            pool_size=2,
            max_overflow=3,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_timeout=10,
            echo=settings.debug,
        )
        CretasSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cretas_engine)
        logger.info(
            f"Cretas DB connection pool created: {settings.food_kb_postgres_host}:"
            f"{settings.food_kb_postgres_port}/{settings.food_kb_postgres_db}"
        )
    except Exception as e:
        logger.error(f"Failed to create Cretas DB connection: {e}")
        cretas_engine = None
        CretasSessionLocal = None


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


@contextmanager
def get_cretas_db_context() -> Generator[Session, None, None]:
    """
    Context manager for Cretas DB session (cretas_prod_db / cretas_db).

    Use this for SQL that references tables listed in the cretas_prod_db column
    of spec 2026-05-05-phase2a-db-pool-wiring-fix.md §1.3
    (smart_bi_sales_data, smart_bi_finance_data, smart_bi_department_data,
    smart_bi_datasource, etc.).

    Fails loud (RuntimeError) if FOOD_KB_POSTGRES_PASSWORD is missing — per
    spec §5.2, the cretas pool is now infra-required, not optional.

    Usage:
        with get_cretas_db_context() as db:
            results = db.execute(text("SELECT ... FROM smart_bi_sales_data ...")).all()
    """
    if CretasSessionLocal is None:
        raise RuntimeError(
            "Cretas DB pool not configured (FOOD_KB_POSTGRES_PASSWORD missing or "
            "engine init failed). See spec §2.1 / §5.2."
        )

    db = CretasSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
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
