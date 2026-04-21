"""API routes for materialized analytics cache.

GET /api/smartbi/analytics/cached/{upload_id}
  → Returns cached template results for the upload (factory-scoped).
  → Status 404 if upload not found.
  → Status 403 if factory_id mismatch (cross-tenant attempt).

POST /api/smartbi/analytics/materialize/{upload_id}
  → Triggers fresh materialization + persist. Idempotent (upserts).
  → Used by upload hook (Task 13) and manual refresh.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request

from smartbi.config import get_pg_pool
from smartbi.services.materialized_analytics.materializer import build_schema, materialize_upload
from smartbi.services.materialized_analytics.persistence import (
    load_materialization_results,
    save_materialization_results,
)
from smartbi.services.materialized_analytics.schema import Domain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["materialized-analytics"])


async def _get_upload_factory(pool, upload_id: int) -> str:
    """Fetch factory_id for upload. Raises HTTPException 404 if missing."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT factory_id FROM smart_bi_pg_excel_uploads WHERE id = $1",
            upload_id
        )
    if row is None:
        raise HTTPException(status_code=404, detail=f"upload {upload_id} not found")
    return row['factory_id']


def _extract_factory_id(request: Request) -> str:
    """Get factory_id from auth middleware. 401 if missing."""
    factory_id = getattr(request.state, 'factory_id', None)
    if not factory_id:
        raise HTTPException(status_code=401, detail="factory_id not in auth context")
    return factory_id


@router.get("/cached/{upload_id}")
async def get_cached_analytics(upload_id: int, request: Request) -> Dict[str, Any]:
    """Load pre-computed template results for an upload.

    Returns {results: [...], upload_id, factory_id, count, cached: bool}.
    If nothing cached yet, cached=False, results=[]; caller should POST
    /analytics/materialize/{upload_id} to trigger a fresh run.
    """
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="postgres pool not available")

    user_factory = _extract_factory_id(request)
    upload_factory = await _get_upload_factory(pool, upload_id)
    if upload_factory != user_factory:
        logger.warning(
            f"[analytics] factory mismatch: user={user_factory}, upload={upload_factory}"
        )
        raise HTTPException(status_code=403, detail="cross-tenant access denied")

    results = await load_materialization_results(pool, upload_id, factory_id=user_factory)
    return {
        "success": True,
        "cached": len(results) > 0,
        "upload_id": upload_id,
        "factory_id": user_factory,
        "count": len(results),
        "results": results,
    }


@router.post("/materialize/{upload_id}")
async def trigger_materialization(upload_id: int, request: Request) -> Dict[str, Any]:
    """Trigger fresh materialization + persist. Idempotent (ON CONFLICT updates)."""
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="postgres pool not available")

    user_factory = _extract_factory_id(request)
    upload_factory = await _get_upload_factory(pool, upload_id)
    if upload_factory != user_factory:
        raise HTTPException(status_code=403, detail="cross-tenant access denied")

    t_start = time.time()
    results = await materialize_upload(pool, upload_id)
    # Derive domain from schema (all templates share it). If no results, empty domain.
    # We use the first applicable result's stored domain via re-reading schema, but
    # materialize_upload doesn't return the schema directly. Cheapest: re-peek domain
    # from any stored location; fallback to UNKNOWN.
    # For W1 simplicity: always pass "unknown" if results empty, else read domain from
    # the upload's factory context (we only have restaurant templates anyway in W1).
    # Better: extend materialize_upload to return (schema, results). W1 TODO.
    # For now, inspect the first applicable result's kpis/data doesn't reveal domain.
    # Simplest: run build_schema ourselves to get domain.
    async with pool.acquire() as conn:
        ur = await conn.fetchrow(
            "SELECT factory_id, row_count FROM smart_bi_pg_excel_uploads WHERE id = $1",
            upload_id
        )
        field_rows = await conn.fetch(
            """SELECT original_name, is_measure, is_dimension, is_time
               FROM smart_bi_pg_field_definitions WHERE upload_id = $1
               ORDER BY display_order""",
            upload_id
        )
    field_meta = [dict(r) for r in field_rows]
    if field_meta:
        schema = build_schema(upload_id, ur['factory_id'], field_meta, ur['row_count'] or 0)
        domain_value = schema.domain.value
    else:
        domain_value = Domain.UNKNOWN.value

    saved = await save_materialization_results(
        pool, upload_id, user_factory, domain_value, results
    )

    applied = sum(1 for r in results if r.applies)
    skipped = sum(1 for r in results if not r.applies and not r.error)
    errored = sum(1 for r in results if r.error)

    return {
        "success": True,
        "upload_id": upload_id,
        "factory_id": user_factory,
        "domain": domain_value,
        "total_templates": len(results),
        "applied": applied,
        "skipped": skipped,
        "errored": errored,
        "saved": saved,
        "wall_ms": int((time.time() - t_start) * 1000),
    }
