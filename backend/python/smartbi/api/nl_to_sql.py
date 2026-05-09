"""
NL2SQL API Endpoint

Provides a POST /nl-to-sql endpoint that translates natural language queries
into SQL, optionally executes them, and returns structured results.

Part of SmartBI — mounted at /api/smartbi/nl-to-sql in main.py.
"""
from __future__ import annotations

import hashlib
import logging
import re
import time
from collections import OrderedDict
from decimal import Decimal
from threading import Lock
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import text

from smartbi.database.connection import get_db_context, is_postgres_enabled
from smartbi.database.repository import FieldDefinitionRepository
from smartbi.services.sql_generator import SQLGenerator, SQLResult

logger = logging.getLogger(__name__)

router = APIRouter(tags=["NL2SQL"])

# Singleton generator instance
_generator: Optional[SQLGenerator] = None


def _get_generator() -> SQLGenerator:
    global _generator
    if _generator is None:
        _generator = SQLGenerator()
    return _generator


# ---------------------------------------------------------------------------
# LRU cache for SQLResult (Apr 25 D2.B2)
# ---------------------------------------------------------------------------
#
# Apr 25 latency audit: every AIQuery question costs 2.5–12s LLM, even when
# the same user asks the same question twice. We mirror the chart_recommender
# LRU pattern: in-process OrderedDict keyed on (factory_id, upload_id,
# normalized_question_text). 1h TTL, 512 max entries.
#
# Note: process-local — wiped on Python restart. Acceptable for v1; promoting
# to Redis would survive restarts but Python service has no Redis client wired
# yet (see chart_recommender.py for same pattern).

_NL2SQL_CACHE_TTL_SEC = 3600
_NL2SQL_CACHE_MAX_ENTRIES = 512
_nl2sql_cache: "OrderedDict[str, tuple[float, SQLResult]]" = OrderedDict()
_nl2sql_cache_lock = Lock()
_nl2sql_cache_stats = {"hits": 0, "misses": 0, "evictions": 0}


def _normalize_question(q: str) -> str:
    """Normalize NL question for cache key — collapse whitespace + case fold."""
    q = (q or "").strip().lower()
    q = re.sub(r"\s+", " ", q)
    return q


def _nl2sql_cache_key(factory_id: str, upload_id: int, question: str) -> str:
    sig = f"{factory_id}||{upload_id}||{_normalize_question(question)}"
    return hashlib.md5(sig.encode("utf-8")).hexdigest()[:24]


def _nl2sql_cache_get(key: str) -> Optional[SQLResult]:
    with _nl2sql_cache_lock:
        entry = _nl2sql_cache.get(key)
        if entry is None:
            _nl2sql_cache_stats["misses"] += 1
            return None
        ts, result = entry
        if time.time() - ts > _NL2SQL_CACHE_TTL_SEC:
            del _nl2sql_cache[key]
            _nl2sql_cache_stats["misses"] += 1
            return None
        # Move to end (LRU touch)
        _nl2sql_cache.move_to_end(key)
        _nl2sql_cache_stats["hits"] += 1
        return result


def _nl2sql_cache_set(key: str, result: SQLResult) -> None:
    with _nl2sql_cache_lock:
        _nl2sql_cache[key] = (time.time(), result)
        _nl2sql_cache.move_to_end(key)
        # Evict oldest if over capacity
        while len(_nl2sql_cache) > _NL2SQL_CACHE_MAX_ENTRIES:
            _nl2sql_cache.popitem(last=False)
            _nl2sql_cache_stats["evictions"] += 1


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class NL2SQLRequest(BaseModel):
    """Request body for NL-to-SQL translation."""
    query: str = Field(..., min_length=1, max_length=500, description="Natural language query")
    upload_id: int = Field(..., gt=0, description="Upload dataset ID")
    factory_id: str = Field(..., min_length=1, max_length=50, description="Factory ID")
    execute: bool = Field(default=False, description="Whether to execute the SQL and return results")
    limit: int = Field(default=100, ge=1, le=1000, description="Max rows to return")


class NL2SQLResponse(BaseModel):
    """Response body for NL-to-SQL translation."""
    success: bool
    sql: Optional[str] = None
    explanation: Optional[str] = None
    intent: Optional[str] = None
    confidence: Optional[float] = None
    fields: Optional[List[Dict[str, Any]]] = None
    result: Optional[List[Dict[str, Any]]] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    warnings: Optional[List[str]] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_value(val: Any) -> Any:
    """Convert non-JSON-serializable values to JSON-safe types."""
    if val is None:
        return None
    if isinstance(val, Decimal):
        # Preserve precision: use float for display
        return float(val)
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    return val


def _load_field_definitions(upload_id: int) -> List[Dict[str, Any]]:
    """Load field definitions from the database."""
    with get_db_context() as db:
        repo = FieldDefinitionRepository(db)
        definitions = repo.get_by_upload_id(upload_id)
        return [d.to_dict() for d in definitions]


def _execute_sql(sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Execute a read-only SQL query and return results as list of dicts.

    Uses a fresh DB session with read-only intent (no commit).
    """
    with get_db_context() as db:
        result = db.execute(text(sql), params)
        columns = list(result.keys())
        rows = []
        for row in result.fetchall():
            row_dict = {}
            for i, col in enumerate(columns):
                row_dict[col] = _serialize_value(row[i])
            rows.append(row_dict)
        return rows


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/nl-to-sql")
async def nl_to_sql(request: NL2SQLRequest) -> NL2SQLResponse:
    """
    Translate a natural language query into SQL for SmartBI dynamic data.

    Optionally executes the SQL and returns results.

    - **query**: Natural language question (Chinese or English)
    - **upload_id**: The dataset to query against
    - **factory_id**: Factory scope
    - **execute**: If true, run the SQL and return data
    - **limit**: Max rows (1-1000)
    """
    t0 = time.monotonic()

    # Pre-flight checks
    if not is_postgres_enabled():
        return NL2SQLResponse(
            success=False,
            message="PostgreSQL is not enabled or connection failed",
        )

    # Load field definitions
    try:
        field_definitions = _load_field_definitions(request.upload_id)
    except Exception as e:
        logger.error(f"NL2SQL: failed to load field definitions for upload_id={request.upload_id}: {e}")
        return NL2SQLResponse(
            success=False,
            message=f"Failed to load dataset field definitions: {e}",
        )

    if not field_definitions:
        return NL2SQLResponse(
            success=False,
            message=f"No field definitions found for upload_id={request.upload_id}. Please upload and parse data first.",
        )

    # Apr 25 (D2.B2): cache lookup BEFORE invoking the LLM-backed generator.
    # Same (factory, upload, question) → reuse SQLResult. 5–12s → ~5ms hit.
    cache_key = _nl2sql_cache_key(request.factory_id, request.upload_id, request.query)
    sql_result: Optional[SQLResult] = _nl2sql_cache_get(cache_key)
    cache_hit = sql_result is not None

    # Generate SQL (cache miss path)
    if not cache_hit:
        generator = _get_generator()
        try:
            sql_result = await generator.generate_sql(
                query=request.query,
                upload_id=request.upload_id,
                factory_id=request.factory_id,
                field_definitions=field_definitions,
                limit=request.limit,
            )
        except ValueError as e:
            # Safety validation failure
            logger.warning(f"NL2SQL: SQL validation failed: {e}")
            return NL2SQLResponse(
                success=False,
                message=f"Query generation failed: {e}",
            )
        except Exception as e:
            logger.error(f"NL2SQL: SQL generation error: {e}", exc_info=True)
            return NL2SQLResponse(
                success=False,
                message="Failed to generate SQL from your question. Please try rephrasing.",
            )
        # Cache the successful generation. Skip cache when confidence is very
        # low (LLM struggled — better to retry next time than serve a bad SQL).
        if sql_result.confidence >= 0.4:
            _nl2sql_cache_set(cache_key, sql_result)
    else:
        logger.info(
            f"NL2SQL cache HIT for factory={request.factory_id} upload={request.upload_id} "
            f"q={request.query[:60]!r}"
        )

    # Build field info for response
    fields_info = [
        {
            "name": m.matched_name,
            "originalName": m.original_name,
            "type": m.field_type,
            "isMeasure": m.is_measure,
            "isDimension": m.is_dimension,
            "isTime": m.is_time,
            "matchScore": m.score,
        }
        for m in sql_result.matched_fields
    ]

    # Execute SQL if requested
    result_data: Optional[List[Dict[str, Any]]] = None
    row_count: Optional[int] = None

    if request.execute:
        try:
            result_data = _execute_sql(sql_result.sql, sql_result.params)
            row_count = len(result_data)
            logger.info(f"NL2SQL: executed query, returned {row_count} rows")
        except Exception as e:
            logger.error(f"NL2SQL: SQL execution error: {e}", exc_info=True)
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            return NL2SQLResponse(
                success=False,
                sql=sql_result.sql,
                explanation=sql_result.explanation,
                intent=sql_result.intent.value,
                confidence=sql_result.confidence,
                fields=fields_info,
                execution_time_ms=elapsed_ms,
                warnings=sql_result.warnings,
                message=f"SQL generated but execution failed: {e}",
            )

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    return NL2SQLResponse(
        success=True,
        sql=sql_result.sql,
        explanation=sql_result.explanation,
        intent=sql_result.intent.value,
        confidence=sql_result.confidence,
        fields=fields_info,
        result=result_data,
        row_count=row_count,
        execution_time_ms=elapsed_ms,
        warnings=sql_result.warnings if sql_result.warnings else None,
    )


@router.get("/nl-to-sql/cache-stats")
async def nl2sql_cache_stats() -> Dict[str, Any]:
    """Cache statistics for the NL2SQL LRU layer (Apr 25 D2.B2)."""
    with _nl2sql_cache_lock:
        size = len(_nl2sql_cache)
    stats = dict(_nl2sql_cache_stats)
    total = stats["hits"] + stats["misses"]
    stats["hit_rate"] = (stats["hits"] / total) if total else 0.0
    stats["entries"] = size
    stats["max_entries"] = _NL2SQL_CACHE_MAX_ENTRIES
    stats["ttl_seconds"] = _NL2SQL_CACHE_TTL_SEC
    return {"success": True, "data": stats, "message": "ok"}
