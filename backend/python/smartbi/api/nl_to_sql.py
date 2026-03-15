"""
NL2SQL API Endpoint

Provides a POST /nl-to-sql endpoint that translates natural language queries
into SQL, optionally executes them, and returns structured results.

Part of SmartBI — mounted at /api/smartbi/nl-to-sql in main.py.
"""
from __future__ import annotations

import logging
import time
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
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

    # Generate SQL
    generator = _get_generator()
    try:
        sql_result: SQLResult = await generator.generate_sql(
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
