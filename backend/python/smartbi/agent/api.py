"""FastAPI router for Week 5 Agent layer — /api/smartbi/insights/custom.

Gated by env flag SMARTBI_AGENT_LAYER_ENABLED. main.py conditionally
includes this router so the endpoint is invisible when the flag is off.

Contract
--------
GET /api/smartbi/insights/custom
  ?start_date=YYYY-MM-DD  (required)
  &end_date=YYYY-MM-DD    (required)
  &question=<text>        (optional; default: "给我这段时间的经营分析建议")

Tenant scope: pulled from request.state.factory_id (set by
auth_middleware via JWT or X-Factory-Id header on internal calls).

Response: AgentOrchestrator.InsightResponse as JSON.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from smartbi.agent.orchestrator import AgentOrchestrator
from smartbi.config import get_pg_pool, get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["Agent Insights"])

DEFAULT_QUESTION = "给我这段时间的经营分析建议，重点关注营业额、门店表现和折扣结构。"


def _parse_date(s: str, field: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"{field} must be YYYY-MM-DD, got {s!r}",
        )


@router.get("/custom")
async def get_insights_custom(
    request: Request,
    start_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    end_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    question: Optional[str] = Query(None, description="User question; defaults to general insight prompt"),
):
    factory_id = getattr(request.state, "factory_id", None)
    if not factory_id:
        raise HTTPException(status_code=401, detail="tenant context not set")

    start = _parse_date(start_date, "start_date")
    end = _parse_date(end_date, "end_date")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date > end_date")

    q = (question or DEFAULT_QUESTION).strip()
    if len(q) > 500:
        raise HTTPException(status_code=400, detail="question too long (max 500 chars)")

    settings = get_settings()
    if not settings.llm_api_key:
        raise HTTPException(status_code=503, detail="LLM not configured")

    pool = await get_pg_pool()
    orch = AgentOrchestrator(
        pool=pool,
        llm_base_url=settings.llm_base_url,
        llm_api_key=settings.llm_api_key,
        llm_model=settings.llm_insight_model,
    )
    result = await orch.answer_insight(factory_id, q, (start, end))
    return result.to_dict()


@router.get("/custom/stream")
async def get_insights_custom_stream(
    request: Request,
    start_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    end_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    question: Optional[str] = Query(None, description="User question; defaults to general insight prompt"),
):
    """SSE streaming variant of /custom. Same tenant/budget/cache rules but
    yields LLM tokens progressively so the frontend can render insights
    character-by-character. First byte typically lands in 2-3s (vs 5-10s
    full-response cold start)."""
    factory_id = getattr(request.state, "factory_id", None)
    if not factory_id:
        raise HTTPException(status_code=401, detail="tenant context not set")

    start = _parse_date(start_date, "start_date")
    end = _parse_date(end_date, "end_date")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date > end_date")

    q = (question or DEFAULT_QUESTION).strip()
    if len(q) > 500:
        raise HTTPException(status_code=400, detail="question too long (max 500 chars)")

    settings = get_settings()
    if not settings.llm_api_key:
        raise HTTPException(status_code=503, detail="LLM not configured")

    pool = await get_pg_pool()
    orch = AgentOrchestrator(
        pool=pool,
        llm_base_url=settings.llm_base_url,
        llm_api_key=settings.llm_api_key,
        llm_model=settings.llm_insight_model,
    )

    async def event_generator():
        try:
            async for event in orch.stream_insight(factory_id, q, (start, end)):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.exception("stream_insight failed: %s", e)
            err = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(err, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering for true streaming
        },
    )
