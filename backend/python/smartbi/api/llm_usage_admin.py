"""
LLM usage admin — read-only dashboards on smart_bi_llm_usage.

GET /api/smartbi/admin/llm-usage/summary?days=7
GET /api/smartbi/admin/llm-usage/by-model?days=7
GET /api/smartbi/admin/llm-usage/by-caller?days=7
GET /api/smartbi/admin/llm-usage/recent?limit=100
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from smartbi.config import get_pg_pool

logger = logging.getLogger(__name__)
router = APIRouter()


async def _fetch(query: str, *args) -> List[Dict[str, Any]]:
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(500, "PG pool unavailable")
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return [dict(r) for r in rows]


@router.get("/summary")
async def summary(days: int = Query(7, ge=1, le=90)) -> Dict[str, Any]:
    """Aggregate calls/tokens/cost for the last N days + today."""
    rows = await _fetch(
        """SELECT
             count(*) AS calls,
             sum(input_tokens) AS input_tok,
             sum(output_tokens) AS output_tok,
             sum(total_tokens) AS total_tok,
             avg(latency_ms)::int AS avg_ms,
             sum(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
           FROM smart_bi_llm_usage
           WHERE ts > NOW() - INTERVAL '1 day' * $1""",
        days,
    )
    today = await _fetch(
        """SELECT
             count(*) AS calls,
             sum(total_tokens) AS total_tok,
             sum(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
           FROM smart_bi_llm_usage
           WHERE ts >= date_trunc('day', NOW())""",
    )
    return {"window_days": days, "window": rows[0] if rows else {}, "today": today[0] if today else {}}


@router.get("/by-model")
async def by_model(days: int = Query(7, ge=1, le=90)) -> List[Dict[str, Any]]:
    return await _fetch(
        """SELECT provider, model,
             count(*) AS calls,
             sum(input_tokens) AS input_tok,
             sum(output_tokens) AS output_tok,
             sum(total_tokens) AS total_tok,
             avg(latency_ms)::int AS avg_ms,
             sum(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
           FROM smart_bi_llm_usage
           WHERE ts > NOW() - INTERVAL '1 day' * $1
           GROUP BY provider, model
           ORDER BY total_tok DESC NULLS LAST""",
        days,
    )


@router.get("/by-caller")
async def by_caller(days: int = Query(7, ge=1, le=90)) -> List[Dict[str, Any]]:
    return await _fetch(
        """SELECT caller, model,
             count(*) AS calls,
             sum(total_tokens) AS total_tok,
             avg(latency_ms)::int AS avg_ms,
             sum(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
           FROM smart_bi_llm_usage
           WHERE ts > NOW() - INTERVAL '1 day' * $1
           GROUP BY caller, model
           ORDER BY total_tok DESC NULLS LAST""",
        days,
    )


@router.get("/recent")
async def recent(limit: int = Query(100, ge=1, le=1000)) -> List[Dict[str, Any]]:
    return await _fetch(
        """SELECT ts, provider, model, caller,
             input_tokens, output_tokens, total_tokens,
             latency_ms, status_code, factory_id,
             LEFT(error_snippet, 200) AS error_snippet
           FROM smart_bi_llm_usage
           ORDER BY ts DESC
           LIMIT $1""",
        limit,
    )


@router.get("/hourly")
async def hourly(hours: int = Query(24, ge=1, le=168)) -> List[Dict[str, Any]]:
    """Usage bucketed by hour — for burn-rate graphing."""
    return await _fetch(
        """SELECT
             date_trunc('hour', ts) AS hour,
             model,
             count(*) AS calls,
             sum(total_tokens) AS total_tok
           FROM smart_bi_llm_usage
           WHERE ts > NOW() - INTERVAL '1 hour' * $1
           GROUP BY date_trunc('hour', ts), model
           ORDER BY hour ASC""",
        hours,
    )


@router.get("/by-factory")
async def by_factory(days: int = Query(7, ge=1, le=90)) -> List[Dict[str, Any]]:
    """Per-factory token consumption summary — for billing / ops visibility."""
    return await _fetch(
        """SELECT
             COALESCE(factory_id, '(unknown)') AS factory_id,
             count(*) AS calls,
             sum(input_tokens) AS input_tok,
             sum(output_tokens) AS output_tok,
             sum(total_tokens) AS total_tok,
             count(DISTINCT model) AS models_used,
             avg(latency_ms)::int AS avg_ms,
             sum(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors,
             max(ts) AS last_call_at
           FROM smart_bi_llm_usage
           WHERE ts > NOW() - INTERVAL '1 day' * $1
           GROUP BY factory_id
           ORDER BY total_tok DESC NULLS LAST""",
        days,
    )


@router.get("/by-factory-model")
async def by_factory_model(
    factory_id: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=90),
) -> List[Dict[str, Any]]:
    """Per-factory per-model breakdown. If factory_id omitted, returns all."""
    if factory_id:
        return await _fetch(
            """SELECT factory_id, provider, model, caller,
                 count(*) AS calls,
                 sum(total_tokens) AS total_tok,
                 avg(latency_ms)::int AS avg_ms
               FROM smart_bi_llm_usage
               WHERE ts > NOW() - INTERVAL '1 day' * $1 AND factory_id = $2
               GROUP BY factory_id, provider, model, caller
               ORDER BY total_tok DESC NULLS LAST""",
            days, factory_id,
        )
    return await _fetch(
        """SELECT factory_id, provider, model,
             count(*) AS calls,
             sum(total_tokens) AS total_tok
           FROM smart_bi_llm_usage
           WHERE ts > NOW() - INTERVAL '1 day' * $1
           GROUP BY factory_id, provider, model
           ORDER BY factory_id, total_tok DESC NULLS LAST""",
        days,
    )


@router.get("/by-provider-account")
async def by_provider_account(days: int = Query(7, ge=1, le=90)) -> List[Dict[str, Any]]:
    """Per-provider summary to see which account pool is being drained fastest."""
    return await _fetch(
        """SELECT provider,
             count(*) AS calls,
             count(DISTINCT model) AS models,
             sum(total_tokens) AS total_tok,
             avg(latency_ms)::int AS avg_ms,
             sum(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
           FROM smart_bi_llm_usage
           WHERE ts > NOW() - INTERVAL '1 day' * $1
           GROUP BY provider
           ORDER BY total_tok DESC NULLS LAST""",
        days,
    )
