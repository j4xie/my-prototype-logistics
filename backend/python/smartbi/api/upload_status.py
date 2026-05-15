"""Upload Status Dashboard — read-only listing of recent uploads per factory.

Solves ops pain: "我的店上传成功了吗 / 哪个文件卡了" without SQL.

Route:
  GET /api/smartbi/{factory_id}/uploads/list?limit=50&days=7

Source table: smart_bi_pg_excel_uploads (RLS-isolated per factory).
Filename → report_type detection via pos_router (二维火 keyword match);
falls back to detected_table_type column or "unknown".

Auth: JWT Bearer (factory_id claim must match URL) or X-Internal-Secret.
Same _enforce_factory_match contract as revenue_report.py.

Phase: Phase IIa ops visibility, 2026-05-14.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request

from smartbi.api._revenue_report_helpers import _enforce_factory_match
from smartbi_compat.schema_compat import _java_isoformat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/smartbi/{factory_id}/uploads")

# ─── Constants ──────────────────────────────────────────────────────────

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
DEFAULT_DAYS = 7
MAX_DAYS = 90


# ─── Helpers ────────────────────────────────────────────────────────────

async def _get_pool():
    """Lazily resolved asyncpg pool. Patched in tests."""
    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="DB pool unavailable")
    return pool


def _detect_report_type(filename: Optional[str], fallback: Optional[str]) -> str:
    """Filename → short report_type.

    Tries pos_router keyword match first (二维火 POS reports), then falls
    back to the upload row's detected_table_type column, then "unknown".

    Per Rule 1, explicit ``is not None`` checks for the fallback chain so a
    blank string in detected_table_type doesn't get treated as missing.
    """
    if filename is not None and filename.strip():
        try:
            from smartbi.ingestion.pos_router import _route_by_filename
            decision = _route_by_filename(filename)
            if decision is not None:
                return decision.report_type
        except Exception as e:
            # pos_router registry load issue — non-fatal, fall through.
            logger.debug("[upload-status] pos_router lookup failed: %s", e)

    if fallback is not None and fallback.strip():
        return fallback

    return "unknown"


def _normalize_status(raw_status: Optional[str]) -> str:
    """Collapse the 7-value DB enum (UploadStatus.java) to 3 user-facing buckets.

    PENDING / PROCESSING / PARSING / MAPPED / RETRYING → "PENDING"
    COMPLETED                                           → "COMPLETED"
    FAILED / ARCHIVED                                   → "ERROR"

    None defensively maps to "PENDING" (row exists but status not yet set).
    """
    if raw_status is None:
        return "PENDING"
    s = raw_status.upper().strip()
    if s == "COMPLETED":
        return "COMPLETED"
    if s in ("FAILED", "ARCHIVED"):
        return "ERROR"
    return "PENDING"


def _serialize_upload_row(row: Any) -> dict:
    """asyncpg Record → JSON-safe upload dict.

    Rule 1: ``is not None`` for every nullable field check.
    Rule 11: ``_java_isoformat`` for every datetime field.
    Rule 4: row counts are already int from PG, but ``int()`` cast is
            defensive against asyncpg returning numerics.
    """
    raw_status = row["upload_status"] if row["upload_status"] is not None else None
    status = _normalize_status(raw_status)

    file_name = row["file_name"] if row["file_name"] is not None else None
    detected_table_type = (
        row["detected_table_type"] if row["detected_table_type"] is not None else None
    )
    report_type = _detect_report_type(file_name, detected_table_type)

    uploaded_at = row["created_at"] if row["created_at"] is not None else None
    # Source table has no completed_at column. For COMPLETED rows, updated_at
    # is the terminal-state timestamp (onUpdate hook fires at every state
    # transition incl. PENDING → COMPLETED). Surface it only when COMPLETED;
    # otherwise leave null so callers don't misread an intermediate state's
    # updated_at as a completion timestamp.
    completed_at: Optional[datetime] = None
    if status == "COMPLETED" and row["updated_at"] is not None:
        completed_at = row["updated_at"]

    # Source table tracks row_count = Bronze rows ingested into dynamic_data;
    # Silver row counts are NOT persisted on this table (they live downstream
    # in fact_pos_transaction etc, queryable via upload_id but not aggregated
    # back). Leave silver_rows null per "don't make up data" rule.
    bronze_rows = (
        int(row["row_count"]) if row["row_count"] is not None else None
    )
    silver_rows: Optional[int] = None

    error_message = row["error_message"] if row["error_message"] is not None else None
    # last_error is persisted across transaction rollback; prefer it when
    # error_message is null but row is in ERROR state.
    if error_message is None and status == "ERROR":
        last_error = row["last_error"] if row["last_error"] is not None else None
        error_message = last_error

    return {
        "upload_id": int(row["id"]),
        "filename": file_name,
        "report_type": report_type,
        "status": status,
        "file_size_bytes": None,  # not tracked on smart_bi_pg_excel_uploads
        "uploaded_at": _java_isoformat(uploaded_at),
        "completed_at": _java_isoformat(completed_at),
        "error_message": error_message,
        "bronze_rows": bronze_rows,
        "silver_rows": silver_rows,
    }


# ─── Endpoints ──────────────────────────────────────────────────────────


@router.get("/list")
async def list_uploads(
    factory_id: str,
    request: Request,
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    days: int = Query(DEFAULT_DAYS, ge=1, le=MAX_DAYS),
):
    """Paginated list of recent uploads for the caller's factory.

    Returns the most recent ``limit`` uploads within the last ``days`` days,
    sorted by created_at DESC. RLS enforces factory isolation at the DB
    layer (app.factory_id GUC set per-request).

    Response shape (camelCase via web-admin transformKeys, snake_case here):
      {
        "factory_id": str,
        "total": int,        # count within window, before limit
        "uploads": [{...}],  # up to ``limit`` rows
      }
    """
    caller_factory = _enforce_factory_match(factory_id, request)
    pool = await _get_pool()

    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", caller_factory
        )

        # Window total (for "总上传数" KPI card; not affected by ``limit``).
        total = await conn.fetchval(
            """
            SELECT COUNT(*)
            FROM smart_bi_pg_excel_uploads
            WHERE factory_id = $1
              AND created_at >= NOW() - ($2 || ' days')::INTERVAL
            """,
            caller_factory, str(days),
        )

        rows = await conn.fetch(
            """
            SELECT id, file_name, sheet_name, detected_table_type,
                   row_count, column_count, upload_status,
                   error_message, last_error,
                   created_at, updated_at
            FROM smart_bi_pg_excel_uploads
            WHERE factory_id = $1
              AND created_at >= NOW() - ($2 || ' days')::INTERVAL
            ORDER BY created_at DESC, id DESC
            LIMIT $3
            """,
            caller_factory, str(days), limit,
        )

    uploads = [_serialize_upload_row(r) for r in rows]

    return {
        "factory_id": caller_factory,
        "total": int(total) if total is not None else 0,
        "uploads": uploads,
    }
