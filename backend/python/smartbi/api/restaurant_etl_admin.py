"""Admin ETL trigger + status query endpoints (餐饮 Phase A Task 1.4).

Per spec v2 §2.1 (restaurant-phase-a-plan-2026-04-28.md):

  POST /trigger       — admin-scoped manual ETL trigger
  GET  /status        — per-factory ETL status (row counts + recent failures)
  GET  /all-status    — platform_admin only, all RESTAURANT factories summary

Auth
----
All three endpoints require admin-tier access via ``require_admin`` from
``smartbi.canonical.provenance._admin_auth``. ``/all-status`` additionally
requires ``platform_admin`` role.

In-memory job tracking
-----------------------
``_running_jobs`` is a module-level dict (Phase A simplification).  In
production this would be backed by Redis so all workers see the same state.
Keys are UUID job IDs; values are dicts with keys:
  {factory_id, status, started_at, finished_at, error}

Pool acquisition
-----------------
``_run_job`` acquires pools lazily inside the background task to avoid
importing ``main`` at module load time (which would be a circular import).
It uses ``smartbi.config.get_pg_pool`` for the SmartBI pool and creates a
fresh transient asyncpg pool for the Cretas DB connection.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from smartbi.canonical.provenance._admin_auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory job registry (Phase A; replace with Redis for multi-worker prod)
# ---------------------------------------------------------------------------
_running_jobs: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class TriggerRequest(BaseModel):
    factoryId: str


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _enqueue_job(job_id: str, factory_id: str) -> None:
    """Spawn the ETL background task.

    The job entry in _running_jobs is pre-created by trigger_etl before this
    is called, so patching this as a no-op in tests still leaves the job
    visible in _running_jobs with status='queued'.

    Stores the Task in _running_jobs[job_id]["_task"] to keep a strong ref —
    asyncio.create_task() returns a Task that the GC may collect mid-run if
    no reference is held, producing "Task was destroyed but it is pending!"
    warnings under load.
    """
    task = asyncio.create_task(_run_job(job_id, factory_id))
    if job_id in _running_jobs:
        _running_jobs[job_id]["_task"] = task


async def _run_job(job_id: str, factory_id: str) -> None:
    """Execute run_full_etl_with_retry in the background.

    Pool acquisition is deferred to inside this coroutine to avoid importing
    main.py at module load time (circular import).  Both pools are app-lifetime
    singletons from smartbi.config (get_pg_pool / get_cretas_pool).
    """
    _running_jobs[job_id]["status"] = "running"
    _running_jobs[job_id]["started_at"] = datetime.now(timezone.utc).isoformat()

    try:
        from smartbi.config import get_pg_pool, get_cretas_pool
        from smartbi.gold.restaurant_ops_etl import run_full_etl_with_retry

        smartbi_pool = await get_pg_pool()
        if smartbi_pool is None:
            raise RuntimeError("SmartBI pool unavailable — check POSTGRES_URL setting")

        cretas_pool = await get_cretas_pool()
        if cretas_pool is None:
            raise RuntimeError("Cretas pool unavailable — check FOOD_KB_DB_URL / food_kb_postgres_* settings")

        await run_full_etl_with_retry(cretas_pool, smartbi_pool, factory_id)

        _running_jobs[job_id]["status"] = "success"
        logger.info(f"[etl-admin] job {job_id} factory={factory_id} completed")
    except Exception as exc:
        _running_jobs[job_id]["status"] = "error"
        _running_jobs[job_id]["error"] = str(exc)
        logger.warning(f"[etl-admin] job {job_id} factory={factory_id} failed: {exc}")
    finally:
        _running_jobs[job_id]["finished_at"] = datetime.now(timezone.utc).isoformat()


async def _row_count(pool, table: str, factory_id: str) -> int:
    """Return COUNT(*) for *table* WHERE factory_id = factory_id.

    Returns -1 on any error (missing table, RLS block, etc.) so the
    caller's status response is never fully aborted by a single table issue.
    """
    try:
        async with pool.acquire() as conn:
            return await conn.fetchval(
                f"SELECT COUNT(*) FROM {table} WHERE factory_id = $1",
                factory_id,
            )
    except Exception as exc:
        logger.debug(f"[etl-admin] row_count({table}, {factory_id}) failed: {exc}")
        return -1


async def _last_success_run(pool, factory_id: str) -> Optional[str]:
    """Return ISO-8601 string of MAX(computed_at) from agg_restaurant_daily_ops.

    Uses ``computed_at`` (not ``updated_at``) — Task 1.3 naming.
    Returns None when no rows exist or RLS filters them all out.
    """
    try:
        async with pool.acquire() as conn:
            val = await conn.fetchval(
                "SELECT MAX(computed_at) FROM agg_restaurant_daily_ops"
                " WHERE factory_id = $1",
                factory_id,
            )
        if val is None:
            return None
        # asyncpg returns datetime objects for TIMESTAMPTZ columns
        if hasattr(val, "isoformat"):
            return val.isoformat()
        return str(val)
    except Exception as exc:
        logger.debug(f"[etl-admin] last_success_run({factory_id}) failed: {exc}")
        return None


async def _recent_failures(pool, factory_id: str) -> list:
    """Return up to 10 failure records from restaurant_etl_failures (last 7 days).

    Returns [] on any error (table not yet created in test environments, etc.).
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT factory_id, error_message, failed_at, attempt_number
                FROM restaurant_etl_failures
                WHERE factory_id = $1
                  AND failed_at >= NOW() - INTERVAL '7 days'
                ORDER BY failed_at DESC
                LIMIT 10
                """,
                factory_id,
            )
        return [
            {
                "factoryId": r["factory_id"],
                "errorMessage": r["error_message"],
                "failedAt": r["failed_at"].isoformat() if hasattr(r["failed_at"], "isoformat") else str(r["failed_at"]),
                "attemptNumber": r["attempt_number"],
            }
            for r in rows
        ]
    except Exception as exc:
        logger.debug(f"[etl-admin] recent_failures({factory_id}) failed: {exc}")
        return []


def _derive_last_status(factory_id: str, last_success: Optional[str]) -> str:
    """Derive a human-readable lastStatus string.

    Priority: if there is an active job in _running_jobs for this factory,
    return its current status.  Otherwise fall back on whether we have a
    recorded success run.
    """
    # Search in-progress jobs for this factory (most recent wins)
    active = [
        v for v in _running_jobs.values()
        if v["factory_id"] == factory_id and v["status"] in ("running", "queued")
    ]
    if active:
        return active[-1]["status"]
    if last_success:
        return "success"
    return "never_ran"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/trigger")
async def trigger_etl(request: Request, body: TriggerRequest):
    """Manually trigger the restaurant ETL pipeline for one factory.

    Requires admin-tier role (factory_super_admin / platform_admin /
    permission_admin).  Returns a jobId and initial status so the caller can
    poll /status.
    """
    require_admin(request, action_name="餐饮 ETL 触发")

    factory_id = body.factoryId.strip()
    if not factory_id:
        raise HTTPException(status_code=400, detail="factoryId 不能为空")

    job_id = str(uuid.uuid4())

    # Register the job before spawning so /status can see it immediately
    # and so the test patch of _enqueue_job (no-op) still leaves the job visible.
    _running_jobs[job_id] = {
        "factory_id": factory_id,
        "status": "queued",
        "started_at": None,
        "finished_at": None,
        "error": None,
    }

    await _enqueue_job(job_id, factory_id)

    # Estimate ETA: full ETL typically takes 30-120 s depending on row count
    eta_seconds = 60

    return {
        "jobId": job_id,
        "status": _running_jobs[job_id]["status"],
        "factoryId": factory_id,
        "etaSeconds": eta_seconds,
    }


@router.get("/status")
async def status_etl(
    request: Request,
    factoryId: str = Query(..., description="工厂 ID"),
):
    """Query ETL status for a single factory.

    Returns row counts in fact_pos_item / agg_restaurant_daily_ops /
    dim_ingredient and the 10 most-recent failure records.

    Row counts fall back to -1 if a table is inaccessible (missing in test
    environment, or RLS-blocked without tenant GUC set).
    lastSuccessRun may be None if RLS is not satisfied (GUC unset) — the
    FE renders "—" in that case.
    """
    require_admin(request, action_name="餐饮 ETL 状态查询")

    factory_id = factoryId.strip()
    if not factory_id:
        raise HTTPException(status_code=400, detail="factoryId 不能为空")

    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()

    if pool is None:
        raise HTTPException(status_code=503, detail="数据库连接不可用")

    # Parallel queries — each wrapped in its own try/except inside the helper
    last_success, fact_count, agg_count, dim_count, failures = await asyncio.gather(
        _last_success_run(pool, factory_id),
        _row_count(pool, "fact_pos_item", factory_id),
        _row_count(pool, "agg_restaurant_daily_ops", factory_id),
        _row_count(pool, "dim_ingredient", factory_id),
        _recent_failures(pool, factory_id),
        return_exceptions=False,
    )

    return {
        "factoryId": factory_id,
        "lastSuccessRun": last_success,
        "lastStatus": _derive_last_status(factory_id, last_success),
        "rowCounts": {
            "factPosItem": fact_count,
            "aggRestaurantDailyOps": agg_count,
            "dimIngredient": dim_count,
        },
        "recentFailures": failures,
    }


@router.get("/all-status")
async def all_status_etl(request: Request):
    """Platform-admin view: last computed_at for every RESTAURANT factory.

    Requires platform_admin role (not just generic admin-tier).  Returns a
    list of {factoryId, lastSuccessRun} derived from agg_restaurant_daily_ops.

    Phase A simplification: factory name not yet joined (factoryName = null
    until A-2 adds the dim_factory lookup).
    """
    # First gate via generic admin check, then tighten to platform_admin
    require_admin(request, action_name="餐饮 ETL 全工厂状态")

    role = getattr(request.state, "role", None)
    if role != "platform_admin":
        raise HTTPException(
            status_code=403,
            detail="all-status 需要 platform_admin 权限",
        )

    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()

    if pool is None:
        raise HTTPException(status_code=503, detail="数据库连接不可用")

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT factory_id, MAX(computed_at) AS last_computed
                FROM agg_restaurant_daily_ops
                GROUP BY factory_id
                ORDER BY factory_id
                """
            )
        factories = [
            {
                "factoryId": r["factory_id"],
                "factoryName": None,  # Phase A: populated in A-2
                "lastSuccessRun": (
                    r["last_computed"].isoformat()
                    if r["last_computed"] and hasattr(r["last_computed"], "isoformat")
                    else (str(r["last_computed"]) if r["last_computed"] else None)
                ),
            }
            for r in rows
        ]
    except Exception as exc:
        logger.warning(f"[etl-admin] all-status query failed: {exc}")
        factories = []

    return {"factories": factories}
