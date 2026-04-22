"""API routes for materialized analytics cache.

GET /api/smartbi/analytics/cached/{upload_id}
  → Returns cached template results for the upload (factory-scoped).
  → Status 404 if upload not found.
  → Status 403 if factory_id mismatch (cross-tenant attempt).

POST /api/smartbi/analytics/materialize/{upload_id}
  → Triggers fresh materialization + persist. Idempotent (upserts).
  → Used by upload hook (Task 13) and manual refresh.

POST /api/smartbi/analytics/reclassify/{upload_id}  (γ-2)
  → Re-runs unified field_classifier on existing upload's columns,
    updates smart_bi_pg_field_definitions where classifications changed,
    then triggers re-materialization to regenerate cache with the new roles.
  → Used to fix historical uploads affected by buggy legacy classifiers
    (e.g. qhj upload 4169's 账单号/商品结账总数 misclassifications).
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Set

from fastapi import APIRouter, HTTPException, Query, Request

# Module-level set of pending background tasks. asyncio only keeps weak refs
# to tasks, so a fire-and-forget task spawned inside an HTTP handler can get
# GC'd mid-execution when the handler returns. We anchor tasks here and let
# them self-remove on completion. See CPython issue #88831 / docs note on
# asyncio.create_task.
_PENDING_BG_TASKS: Set[asyncio.Task] = set()


def _spawn_bg(coro) -> asyncio.Task:
    """Schedule a detached coroutine that outlives the current request.

    FastAPI/Starlette can cancel the request context, but the task reference
    lives in _PENDING_BG_TASKS so the event loop keeps it alive.
    """
    task = asyncio.create_task(coro)
    _PENDING_BG_TASKS.add(task)
    task.add_done_callback(_PENDING_BG_TASKS.discard)
    return task

from smartbi.config import get_pg_pool
from smartbi.services.field_classifier import classify_column
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


@router.post("/reclassify/{upload_id}")
async def reclassify_upload(
    upload_id: int,
    request: Request,
    rematerialize: bool = Query(True, description="Re-run materialize after reclassify"),
) -> Dict[str, Any]:
    """γ-2: Re-run unified field_classifier on existing upload columns.

    Fixes historical misclassifications (账单号 as measure, 商品结账总数 as dim, etc.)
    without re-uploading the file. After updating field_definitions, optionally
    triggers materialize_upload to regenerate cached templates (since template
    applies() logic depends on field roles).

    Returns a diff of what changed so user can audit.
    """
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="postgres pool not available")

    user_factory = _extract_factory_id(request)
    upload_factory = await _get_upload_factory(pool, upload_id)
    if upload_factory != user_factory:
        logger.warning(
            f"[reclassify] factory mismatch: user={user_factory}, upload={upload_factory}"
        )
        raise HTTPException(status_code=403, detail="cross-tenant access denied")

    t_start = time.time()

    # Load existing field_definitions
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT original_name, standard_name, field_type, semantic_type,
                      is_measure, is_dimension, is_time, display_order
               FROM smart_bi_pg_field_definitions
               WHERE upload_id = $1
               ORDER BY display_order""",
            upload_id,
        )
    if not rows:
        raise HTTPException(status_code=404, detail=f"no field_definitions for upload {upload_id}")

    # Run new classifier on each column
    changes: List[Dict[str, Any]] = []
    updates: List[Dict[str, Any]] = []
    for row in rows:
        name = row["original_name"]
        field_type = (row["field_type"] or "").upper() or None
        new = classify_column(original_name=name, inferred_dtype=field_type)
        old_roles = {
            "is_measure": row["is_measure"],
            "is_dimension": row["is_dimension"],
            "is_time": row["is_time"],
        }
        new_roles = {
            "is_measure": new["is_measure"],
            "is_dimension": new["is_dimension"],
            "is_time": new["is_time"],
        }
        if old_roles != new_roles or row["semantic_type"] != new["semantic_type"]:
            changes.append({
                "original_name": name,
                "field_type": row["field_type"],
                "old": {**old_roles, "semantic_type": row["semantic_type"]},
                "new": {**new_roles, "semantic_type": new["semantic_type"]},
                "reason": new["reason"],
            })
            updates.append({
                "name": name,
                "is_measure": new["is_measure"],
                "is_dimension": new["is_dimension"],
                "is_time": new["is_time"],
                "semantic_type": new["semantic_type"],
            })

    # Apply updates in a transaction
    if updates:
        async with pool.acquire() as conn:
            async with conn.transaction():
                for u in updates:
                    await conn.execute(
                        """UPDATE smart_bi_pg_field_definitions
                           SET is_measure = $1, is_dimension = $2, is_time = $3,
                               semantic_type = $4
                           WHERE upload_id = $5 AND original_name = $6""",
                        u["is_measure"], u["is_dimension"], u["is_time"],
                        u["semantic_type"], upload_id, u["name"],
                    )
        logger.info(
            f"[reclassify] upload {upload_id}: updated {len(updates)}/{len(rows)} field_defs"
        )

    # Optionally re-materialize (drops and regenerates cache)
    remat_result = None
    if rematerialize:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """DELETE FROM smart_bi_pg_analysis_results
                       WHERE upload_id = $1 AND template_code IS NOT NULL""",
                    upload_id,
                )
        materialize_ctx: Dict[str, Any] = {}
        results = await materialize_upload(pool, upload_id, _out_ctx=materialize_ctx)

        # Derive domain (same pattern as /materialize endpoint)
        async with pool.acquire() as conn:
            ur = await conn.fetchrow(
                "SELECT factory_id, row_count FROM smart_bi_pg_excel_uploads WHERE id = $1",
                upload_id,
            )
            field_rows = await conn.fetch(
                """SELECT original_name, is_measure, is_dimension, is_time
                   FROM smart_bi_pg_field_definitions WHERE upload_id = $1
                   ORDER BY display_order""",
                upload_id,
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
        remat_result = {
            "total_templates": len(results),
            "applied": sum(1 for r in results if r.applies),
            "skipped": sum(1 for r in results if not r.applies and not r.error),
            "errored": sum(1 for r in results if r.error),
            "saved": saved,
            "domain": domain_value,
        }

        # Also pre-warm the L2 aggregate cache (LLM fallback path). If the
        # materialize call exposed its polars DataFrame via out_ctx we use
        # that for a ~1s in-memory compute; otherwise we fall back to the SQL
        # path (~30-70s). Either way detached via _spawn_bg so the task
        # survives request lifecycle teardown (client disconnect, etc).
        from smartbi.services.upload_aggregate_cache import (
            compute_aggregates_from_polars as _compute_aggs_polars,
            compute_upload_aggregates as _compute_aggs,
            save_bundle_to_db as _save_bundle_db,
            get_cache as _get_agg_cache,
        )

        _polars_backend = materialize_ctx.get("backend")
        _polars_field_meta = materialize_ctx.get("field_meta")

        async def _warm_l2_aggregate_cache() -> None:
            try:
                if _polars_backend is not None and _polars_field_meta:
                    # Fast path: piggyback on materialize's in-memory polars DF.
                    bundle = _compute_aggs_polars(
                        _polars_backend, _polars_field_meta, sample_size=0
                    )
                    _get_agg_cache().set(upload_id, bundle)
                    await _save_bundle_db(pool, upload_id, bundle, factory_id=user_factory)
                    logger.info(
                        f"[reclassify→agg-warm] upload={upload_id} pre-warmed L2 "
                        f"via polars in {bundle.get('compute_time_s', 0):.2f}s"
                    )
                    # Drop polars DF + trim heap — see hooks.py for rationale.
                    try:
                        _polars_backend._df = None  # noqa: SLF001
                        materialize_ctx.clear()
                    except Exception:
                        pass
                    try:
                        from smartbi.services.memory_cleanup import release_and_trim
                        release_and_trim(label=f"reclassify_{upload_id}")
                    except Exception:
                        pass
                    return
                # Fallback: re-load field_meta and run the SQL path.
                async with pool.acquire() as warm_conn:
                    warm_rows = await warm_conn.fetch(
                        """SELECT original_name, standard_name, is_measure, is_dimension, is_time
                           FROM smart_bi_pg_field_definitions
                           WHERE upload_id = $1 ORDER BY display_order""",
                        upload_id,
                    )
                    warm_field_meta = [dict(r) for r in warm_rows]
                    if not warm_field_meta:
                        logger.warning(
                            f"[reclassify→agg-warm] upload={upload_id} has no "
                            "field_defs, skipping L2 warm"
                        )
                        return
                    bundle = await _compute_aggs(
                        warm_conn, pool, upload_id, warm_field_meta, sample_size=0
                    )
                _get_agg_cache().set(upload_id, bundle)
                await _save_bundle_db(pool, upload_id, bundle, factory_id=user_factory)
                logger.info(
                    f"[reclassify→agg-warm] upload={upload_id} pre-warmed L2 via "
                    f"SQL in {bundle.get('compute_time_s', 0):.1f}s (polars fallback)"
                )
            except Exception as warm_err:
                logger.warning(
                    f"[reclassify→agg-warm] upload={upload_id} failed: {warm_err}"
                )

        _spawn_bg(_warm_l2_aggregate_cache())
        remat_result["agg_cache_warm_scheduled"] = True

    return {
        "success": True,
        "upload_id": upload_id,
        "factory_id": user_factory,
        "total_fields": len(rows),
        "changes_count": len(changes),
        "changes": changes,
        "rematerialize": remat_result,
        "wall_ms": int((time.time() - t_start) * 1000),
    }
