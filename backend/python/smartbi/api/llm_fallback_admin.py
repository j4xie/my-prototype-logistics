"""LLM fallback log admin endpoints.

GET  /api/smartbi/admin/fallback-log/stats?days=30
GET  /api/smartbi/admin/fallback-log/recent?limit=100
GET  /api/smartbi/admin/fallback-log/by-similarity?query=xxx&limit=10
POST /api/smartbi/admin/fallback-log/{log_id}/feedback  (value, comment)

Read-only endpoints for the admin dashboard. Feedback POST is called by
AIQuery.vue's 👍/👎 buttons and is the one non-admin write endpoint
(authenticated via user JWT, not internal secret).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from smartbi.config import get_pg_pool
from smartbi.services.llm_fallback_logger import update_feedback, get_embedding

logger = logging.getLogger(__name__)
router = APIRouter()


class FeedbackRequest(BaseModel):
    value: int = Field(..., description="1 = 👍, -1 = 👎, 0 = neutral")
    comment: Optional[str] = Field(None, description="Optional free-form text")


@router.get("/stats")
async def stats(days: int = Query(30, ge=1, le=90)) -> Dict[str, Any]:
    """Time-bucketed counts + feedback rate for the admin dashboard."""
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(500, "PG pool unavailable")
    async with pool.acquire() as conn:
        summary = await conn.fetchrow(
            """SELECT
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE user_feedback = 1) AS thumbs_up,
                 COUNT(*) FILTER (WHERE user_feedback = -1) AS thumbs_down,
                 COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) AS feedback_total,
                 AVG(total_wall_ms)::int AS avg_total_ms,
                 COUNT(DISTINCT factory_id) AS distinct_factories
               FROM smart_bi_llm_fallback_log
               WHERE created_at >= NOW() - make_interval(days => $1)""",
            days,
        )
        daily = await conn.fetch(
            """SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS n
               FROM smart_bi_llm_fallback_log
               WHERE created_at >= NOW() - make_interval(days => $1)
               GROUP BY day ORDER BY day ASC""",
            days,
        )
    return {
        "days": days,
        "summary": dict(summary) if summary else {},
        "daily_counts": [
            {"day": r["day"].isoformat(), "n": r["n"]} for r in daily
        ],
    }


@router.get("/recent")
async def recent(limit: int = Query(100, ge=1, le=500)) -> Dict[str, Any]:
    """Most recent fallback entries — for spot-checking answer quality."""
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(500, "PG pool unavailable")
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, query, factory_id, upload_id,
                      LEFT(answer, 300) AS answer_preview,
                      user_feedback, total_wall_ms, created_at
               FROM smart_bi_llm_fallback_log
               ORDER BY created_at DESC LIMIT $1""",
            limit,
        )
    return {"count": len(rows), "rows": [dict(r) for r in rows]}


@router.get("/by-similarity")
async def by_similarity(
    query: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
) -> Dict[str, Any]:
    """Given a new query, find historical fallback entries with similar
    embeddings. Preview of what Phase 3 RAG retrieval will do."""
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(500, "PG pool unavailable")
    emb = await get_embedding(query)
    if not emb:
        raise HTTPException(503, "embedding service unavailable")
    emb_literal = f"[{','.join(str(x) for x in emb)}]"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, query, factory_id,
                      LEFT(answer, 300) AS answer_preview,
                      user_feedback, total_wall_ms, created_at,
                      1 - (query_embedding <=> $1::vector) AS similarity
               FROM smart_bi_llm_fallback_log
               WHERE query_embedding IS NOT NULL
               ORDER BY query_embedding <=> $1::vector ASC
               LIMIT $2""",
            emb_literal, limit,
        )
    return {"query": query, "count": len(rows), "rows": [dict(r) for r in rows]}


@router.post("/{log_id}/feedback")
async def feedback(log_id: int, req: FeedbackRequest) -> Dict[str, Any]:
    """FE calls this when user clicks 👍/👎."""
    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(500, "PG pool unavailable")
    ok = await update_feedback(pool, log_id, req.value, req.comment)
    if not ok:
        raise HTTPException(404, f"log id {log_id} not found or update failed")
    return {"ok": True, "log_id": log_id, "value": req.value}
