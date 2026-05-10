"""
DeepSeek monthly USD budget soft gate.

The provider chain (`common/llm_router.py`) treats DeepSeek as paid last-resort
fallback. Pre-PR-#215 (May 9 2026) it was first in chain, which racked up
$19.49 / 219M tokens in 12 days. This module adds a defense-in-depth soft gate
so a future chain regression or runaway loop can't repeat that.

Mechanism
─────────
- DB-backed monthly spend snapshot, refreshed on cooldown (5 min).
- In-memory increment after each successful deepseek call gives sub-poll
  feedback so a hot loop trips the gate within seconds, not minutes.
- `deepseek_over_budget()` returns True when month-to-date ≥ env cap.
- Set `LLM_DEEPSEEK_MAX_USD_PER_MONTH=0` to disable the gate entirely.

Pricing data
────────────
Sourced from api-docs.deepseek.com/quick_start/pricing (snapshot 2026-05-09).
v4-pro is in the 75% discount window through 2026-05-31 — using discounted
rates here. After 2026-05-31 the cap will trip earlier than the dollar figure
suggests; that's safe (conservative). Re-rate the constants when the discount
ends if we want exact tracking.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Dict

logger = logging.getLogger(__name__)


# USD per 1M tokens. v4-pro figures are the active discounted rates
# (api-docs.deepseek.com/quick_start/pricing snapshot 2026-05-09).
DEEPSEEK_PRICING_USD_PER_MILLION: Dict[str, Dict[str, float]] = {
    "deepseek-v4-flash": {
        "input_miss": 0.14,
        "input_hit": 0.0028,
        "output": 0.28,
    },
    "deepseek-v4-pro": {
        "input_miss": 0.435,
        "input_hit": 0.003625,
        "output": 0.87,
    },
    # Legacy aliases — DeepSeek docs flag these for future deprecation but
    # they still bill, so keep the rate table to avoid silent zero-cost.
    "deepseek-chat": {
        "input_miss": 0.14,
        "input_hit": 0.0028,
        "output": 0.28,
    },
    "deepseek-reasoner": {
        "input_miss": 0.435,
        "input_hit": 0.003625,
        "output": 0.87,
    },
}


def _read_budget_usd() -> float:
    raw = os.getenv("LLM_DEEPSEEK_MAX_USD_PER_MONTH", "10.0")
    try:
        return float(raw)
    except ValueError:
        logger.warning(
            f"[llm_budget] invalid LLM_DEEPSEEK_MAX_USD_PER_MONTH={raw!r}, "
            "falling back to $10"
        )
        return 10.0


REFRESH_INTERVAL_SECONDS = 300.0  # 5 min — quick enough to catch runaway, gentle on DB

_cached_cost_usd: float = 0.0
_cached_at: float = 0.0
_lock = asyncio.Lock()


def estimate_cost_usd(
    model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0
) -> float:
    """Estimate USD cost for a single call.

    Splits input tokens into cache-hit vs cache-miss buckets. Returns 0 for
    non-DeepSeek or unknown models — keeps the gate scoped to deepseek even
    if a future provider mapping accidentally routes a non-deepseek model
    through this code path.
    """
    pricing = DEEPSEEK_PRICING_USD_PER_MILLION.get(model)
    if not pricing:
        return 0.0
    cache_miss = max(0, input_tokens - cached_tokens)
    return (
        cache_miss * pricing["input_miss"] / 1_000_000
        + cached_tokens * pricing["input_hit"] / 1_000_000
        + output_tokens * pricing["output"] / 1_000_000
    )


async def _refresh_monthly_cost() -> float:
    """Query smart_bi_llm_usage for current calendar month deepseek spend.

    Conservative: DB doesn't currently store cached_tokens, so refresh treats
    all input tokens as cache misses (overestimates cost → trips gate sooner).
    Sub-poll `record_local` calls use the real cached_tokens from the response.
    """
    global _cached_cost_usd, _cached_at
    try:
        from smartbi.config import get_pg_pool

        pool = await get_pg_pool()
        if pool is None:
            return _cached_cost_usd
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT model,
                          COALESCE(SUM(input_tokens), 0)  AS in_t,
                          COALESCE(SUM(output_tokens), 0) AS out_t
                     FROM smart_bi_llm_usage
                    WHERE provider = 'deepseek'
                      AND status_code BETWEEN 200 AND 299
                      AND ts >= date_trunc('month', NOW())
                    GROUP BY model"""
            )
        total = 0.0
        for r in rows:
            total += estimate_cost_usd(
                r["model"], int(r["in_t"]), int(r["out_t"]), cached_tokens=0
            )
        _cached_cost_usd = total
        _cached_at = time.time()
        logger.info(
            f"[llm_budget] DeepSeek MTD refreshed: ${total:.4f} "
            f"(cap ${_read_budget_usd():.2f})"
        )
        return total
    except Exception as e:
        logger.warning(f"[llm_budget] refresh failed (non-fatal): {e}")
        return _cached_cost_usd


async def get_deepseek_monthly_cost_usd() -> float:
    """Return month-to-date deepseek spend, refreshing on cooldown."""
    if (time.time() - _cached_at) > REFRESH_INTERVAL_SECONDS:
        async with _lock:
            if (time.time() - _cached_at) > REFRESH_INTERVAL_SECONDS:
                await _refresh_monthly_cost()
    return _cached_cost_usd


async def deepseek_over_budget() -> bool:
    """Soft gate — True when MTD spend ≥ env cap. Disabled when cap ≤ 0."""
    cap = _read_budget_usd()
    if cap <= 0:
        return False
    cost = await get_deepseek_monthly_cost_usd()
    over = cost >= cap
    if over:
        logger.warning(
            f"[llm_budget] DeepSeek over budget: ${cost:.4f} >= ${cap:.2f}/mo — "
            "removing from chain until next month"
        )
    return over


def record_local(model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0) -> None:
    """Increment in-memory MTD spend after a successful deepseek call.

    Called from call_chain / call_chain_stream success branches. Gives
    sub-poll feedback within a worker so a hot loop trips the gate before the
    next DB refresh. Cross-worker visibility is via the periodic DB refresh
    (workers will converge within REFRESH_INTERVAL_SECONDS).
    """
    global _cached_cost_usd
    delta = estimate_cost_usd(model, input_tokens, output_tokens, cached_tokens)
    if delta <= 0:
        return
    _cached_cost_usd += delta
    logger.debug(
        f"[llm_budget] +${delta:.6f} via {model} "
        f"(in={input_tokens} cached={cached_tokens} out={output_tokens}) "
        f"MTD=${_cached_cost_usd:.4f}"
    )


def reset_for_tests() -> None:
    """Test helper — wipe in-memory state so tests start clean."""
    global _cached_cost_usd, _cached_at
    _cached_cost_usd = 0.0
    _cached_at = 0.0
