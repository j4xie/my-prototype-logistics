"""6 endpoints for the QHJ revenue management report feature.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §8 + §10.7
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task G2

Routes (all under /api/smartbi/{factory_id}/revenue-report/):
  POST /upload         multi-file POS upload (zip/xlsx/xls/csv mixed)
  POST /prepare        LLM Tool path — returns metadata + download_url
  POST /generate       Web UI path — streams xlsx
  GET  /download/{cache_key}  bytes from Redis-equivalent cache
  GET  /stores         dim_store list (exclude_closed filter)
  GET  /audit-log      smart_bi_report_audit_log recent rows

All endpoints enforce factory_id match via _enforce_factory_match.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import uuid
from datetime import date
from io import BytesIO
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from smartbi.api._revenue_report_helpers import (
    REVENUE_REPORT_CACHE,
    _enforce_factory_match,
    _generate_with_cache,
    compute_cache_key,
)
from smartbi.canonical.templates.qhj_revenue_report import RevenueReportParams

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/smartbi/{factory_id}/revenue-report")


# ─── DI helper ──────────────────────────────────────────────────────────

async def _get_pool():
    """Lazily resolved asyncpg pool. Patched in tests."""
    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="DB pool unavailable")
    return pool


# ─── Request models ─────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    store_names: List[str] = []
    date_from: date
    date_to: date
    meal_periods: List[str] = []


# ─── Resolver ───────────────────────────────────────────────────────────

async def _resolve_store_ids(
    pool, factory_id: str, store_names: List[str],
) -> List[int]:
    """Fuzzy-match store_names against dim_store; empty list → all stores.

    Spec §8.3 / §5.6 — N matches return 400 with candidates.
    """
    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", factory_id
        )
        if not store_names:
            rows = await conn.fetch(
                """
                SELECT store_id FROM dim_store
                WHERE factory_id = $1
                  AND name NOT LIKE '（闭店）%'
                  AND name NOT LIKE '(闭店)%'
                  AND name NOT LIKE '（停用）%'
                """,
                factory_id,
            )
            return [r["store_id"] for r in rows]

        resolved: List[int] = []
        for name in store_names:
            rows = await conn.fetch(
                "SELECT store_id, name FROM dim_store "
                "WHERE factory_id = $1 AND name ILIKE '%' || $2 || '%'",
                factory_id, name,
            )
            if len(rows) == 0:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": f"未找到门店: {name}",
                        "data": {"ambiguous_name": name, "candidates": []},
                    },
                )
            elif len(rows) == 1:
                resolved.append(rows[0]["store_id"])
            else:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": (
                            f"门店名 '{name}' 匹配多个，请使用完整名"
                        ),
                        "data": {
                            "ambiguous_name": name,
                            "candidates": [
                                {"store_id": r["store_id"], "name": r["name"]}
                                for r in rows
                            ],
                        },
                    },
                )
    return resolved


def _user_id_from_request(request: Request) -> str:
    """Best-effort user id from JWT claim / internal header; falls back to 'anonymous'."""
    if hasattr(request, "state"):
        uid = getattr(request.state, "user_id", None)
        if uid:
            return uid
    return request.headers.get("x-user-id") or "anonymous"


# ─── Endpoints ──────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_pos_files(
    factory_id: str,
    request: Request,
    files: List[UploadFile] = File(...),
):
    """Multi-file 二维火 POS upload. Per-file dispatch via pos_router."""
    caller_factory = _enforce_factory_match(factory_id, request)
    pool = await _get_pool()
    batch_id = uuid.uuid4()
    results = []

    from smartbi.ingestion.pos_router import route_file, UnknownReportTypeError

    for upload_file in files:
        content = await upload_file.read()
        content_hash = hashlib.sha256(content).hexdigest()

        async with pool.acquire() as conn:
            await conn.execute(
                "SELECT set_config('app.factory_id', $1, false)",
                caller_factory,
            )
            existing = await conn.fetchval(
                "SELECT id FROM smart_bi_pg_excel_uploads "
                "WHERE factory_id = $1 AND content_hash = $2",
                caller_factory, content_hash,
            )
        if existing:
            results.append({
                "filename": upload_file.filename,
                "status": "duplicate",
                "existing_upload_id": existing,
            })
            continue

        try:
            parsed_routes = list(route_file(upload_file.filename, content))
        except UnknownReportTypeError as e:
            results.append({
                "filename": upload_file.filename,
                "status": "unknown",
                "preview_headers": e.preview_headers,
            })
            continue

        results.append({
            "filename": upload_file.filename,
            "status": "ok",
            "report_types": [d.report_type for d, _ in parsed_routes],
        })

    return {
        "success": True,
        "data": {"batch_id": str(batch_id), "files": results},
        "message": "上传完成",
    }


@router.post("/prepare")
async def prepare_revenue_report(
    factory_id: str, body: GenerateRequest, request: Request,
):
    """LLM Tool path. Returns metadata + download_url (no streaming xlsx)."""
    caller_factory = _enforce_factory_match(factory_id, request)
    pool = await _get_pool()

    store_ids = await _resolve_store_ids(pool, caller_factory, body.store_names)
    params = RevenueReportParams(
        factory_id=caller_factory, store_ids=store_ids,
        date_from=body.date_from, date_to=body.date_to,
        meal_periods=body.meal_periods or None,
    )
    user_id = _user_id_from_request(request)
    cache_key, summary, _ = await _generate_with_cache(pool, params, user_id)

    return {
        "success": True,
        "data": {
            "cache_key": cache_key,
            "download_url": (
                f"/api/smartbi/{caller_factory}/revenue-report/"
                f"download/{cache_key}"
            ),
            "summary": summary,
        },
        "message": "已生成",
    }


@router.post("/generate")
async def generate_revenue_report(
    factory_id: str, body: GenerateRequest, request: Request,
):
    """Web UI path. Streams xlsx + carries X-Cache-Hit/X-Gold-Materialized-At headers."""
    caller_factory = _enforce_factory_match(factory_id, request)
    pool = await _get_pool()

    store_ids = await _resolve_store_ids(pool, caller_factory, body.store_names)
    params = RevenueReportParams(
        factory_id=caller_factory, store_ids=store_ids,
        date_from=body.date_from, date_to=body.date_to,
        meal_periods=body.meal_periods or None,
    )
    user_id = _user_id_from_request(request)
    cache_key, summary, buf = await _generate_with_cache(pool, params, user_id)

    filename = f"收入管理报表_{body.date_from}_{body.date_to}.xlsx"
    safe_filename = re.sub(r"[\r\n\x00/\\]", "_", filename)
    encoded = quote(safe_filename)
    return StreamingResponse(
        buf,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded}",
            "X-Cache-Hit": "true" if summary["cache_hit"] else "false",
            "X-Gold-Materialized-At": summary["gold_materialized_at"],
            "X-Store-Count": str(summary["store_count"]),
            "X-Is-Stale": "true" if summary.get("is_stale") else "false",
        },
    )


@router.get("/download/{cache_key:path}")
async def download_cached(factory_id: str, cache_key: str, request: Request):
    """Stream cached xlsx bytes; cache miss → 410 (re-generate explicitly via /generate)."""
    caller_factory = _enforce_factory_match(factory_id, request)
    if not cache_key.startswith(f"revenue_report:{caller_factory}:"):
        raise HTTPException(status_code=403, detail="cache_key 不属于本 factory")

    cached_bytes = REVENUE_REPORT_CACHE.get(cache_key)
    if cached_bytes is None:
        raise HTTPException(
            status_code=410,
            detail="缓存已过期，请通过 /prepare 重新生成获取 download_url",
        )

    return StreamingResponse(
        BytesIO(cached_bytes),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"X-Cache-Hit": "true"},
    )


@router.get("/stores")
async def list_stores(
    factory_id: str, request: Request, exclude_closed: bool = True,
):
    """dim_store list. Frontend uses for multi-select dropdown."""
    caller_factory = _enforce_factory_match(factory_id, request)
    pool = await _get_pool()

    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", caller_factory
        )
        sql = "SELECT store_id, name FROM dim_store WHERE factory_id = $1"
        if exclude_closed:
            sql += (
                " AND name NOT LIKE '（闭店）%'"
                " AND name NOT LIKE '(闭店)%'"
                " AND name NOT LIKE '（停用）%'"
            )
        sql += " ORDER BY name"
        rows = await conn.fetch(sql, caller_factory)

    return {
        "success": True,
        "data": [{"store_id": r["store_id"], "name": r["name"]} for r in rows],
    }


@router.get("/audit-log")
async def list_audit_log(
    factory_id: str, request: Request, limit: int = 20,
):
    """Recent N generation events. Spec §10.7 + §11.6."""
    caller_factory = _enforce_factory_match(factory_id, request)
    if not (1 <= limit <= 100):
        raise HTTPException(status_code=400, detail="limit must be in [1, 100]")

    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", caller_factory
        )
        rows = await conn.fetch(
            """
            SELECT id, generated_by, generated_at, params_snapshot,
                   file_size_bytes, status, cache_hit, duration_ms,
                   gold_materialized_at
            FROM smart_bi_report_audit_log
            WHERE factory_id = $1 AND report_type = 'qhj_revenue_v1'
            ORDER BY generated_at DESC
            LIMIT $2
            """,
            caller_factory, limit,
        )

    return {
        "success": True,
        "data": [
            {
                "id": r["id"],
                "generated_by": r["generated_by"],
                "generated_at": (
                    r["generated_at"].isoformat() if r["generated_at"] else None
                ),
                "params_snapshot": r["params_snapshot"],
                "file_size_bytes": r["file_size_bytes"],
                "status": r["status"],
                "cache_hit": r["cache_hit"],
                "duration_ms": r["duration_ms"],
                "gold_materialized_at": (
                    r["gold_materialized_at"].isoformat()
                    if r["gold_materialized_at"] else None
                ),
            }
            for r in rows
        ],
    }
