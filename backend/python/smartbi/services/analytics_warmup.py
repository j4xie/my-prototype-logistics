"""Background warmup: pre-populate Agent Insights cache after new upload.

Customer uploads xlsx → materialize_upload succeeds → this kicks off as async
task → concurrently calls LLM for standard "Dashboard AI 洞察" questions so
that when customer opens Dashboard 30-60s later, results are cache-hit
(6ms) instead of cold LLM (10-30s each).

Design:
- Fire-and-forget. Failures logged, don't break materialize.
- Concurrency limited (4 parallel LLM calls) to avoid DashScope rate limits.
- Only warms Dashboard-critical analyses. Deep-dive pages warm on-demand.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


# Standard Dashboard-level questions that ALL restaurant tenants show by default.
# These are what Week 5 Agent Insights triggers on page load. Pre-warming them
# here means first Dashboard hit after upload serves from cache.
WARMUP_QUESTIONS = [
    "本期经营亮点与隐忧是什么？",
    "哪些菜品贡献最大营收？",
    "销售趋势有何变化？",
    "哪家门店表现突出？需要重点关注哪家？",
    "近期有什么数据异常值得管理层关注？",
]


async def warmup_factory_insights(
    pool: asyncpg.Pool,
    factory_id: str,
    upload_id: int,
    concurrency: int = 4,
) -> dict:
    """Kick off background LLM calls for factory Dashboard insights.

    Returns quickly with task tracking info — actual LLM calls run in background.
    Customer materialize endpoint already returned to client before this completes.
    """
    logger.info(
        f"[warmup] factory={factory_id} upload={upload_id} "
        f"starting {len(WARMUP_QUESTIONS)} questions at concurrency={concurrency}"
    )

    try:
        from smartbi.agent.orchestrator import AgentOrchestrator
        from smartbi.agent.narrative_cache import NarrativeCache
        from smartbi.agent.budget_tracker import AgentBudgetTracker
    except ImportError as e:
        logger.warning(f"[warmup] agent layer not available: {e}")
        return {"started": 0, "error": str(e)}

    cache = NarrativeCache(pool)
    budget = AgentBudgetTracker(pool)
    orchestrator = AgentOrchestrator(pool, cache, budget)

    # Default date range: last 90 days (matches Dashboard default "近 90 天")
    from datetime import date, timedelta
    date_end = date.today()
    date_start = date_end - timedelta(days=90)

    semaphore = asyncio.Semaphore(concurrency)

    async def _warmup_one(question: str):
        async with semaphore:
            try:
                import time
                t0 = time.time()
                await orchestrator.answer_insight(
                    factory_id=factory_id,
                    question=question,
                    date_range=(date_start, date_end),
                )
                logger.info(
                    f"[warmup] factory={factory_id} question='{question[:20]}...' "
                    f"warmed in {time.time() - t0:.1f}s"
                )
            except Exception as e:
                logger.warning(
                    f"[warmup] factory={factory_id} question='{question[:20]}...' failed: {e}"
                )

    # Fire all warmup calls concurrently
    await asyncio.gather(
        *[_warmup_one(q) for q in WARMUP_QUESTIONS],
        return_exceptions=False,
    )

    logger.info(f"[warmup] factory={factory_id} upload={upload_id} all warmups complete")
    return {"started": len(WARMUP_QUESTIONS), "concurrency": concurrency}
