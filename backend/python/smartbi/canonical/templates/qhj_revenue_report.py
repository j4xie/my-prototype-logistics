"""QHJ 收入管理报表 — compute template (4 data blocks).

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Tasks E1-E5

Blocks:
  1. 可比同比 (YoY, deferred Phase 2 — returns NULL prev/ratio columns)
  2. 环比     (period over the immediately-preceding same-length range)
  3. 堂食外卖占比 (current period dine-in/takeout revenue + bill split)
  4. 客单人数分析  (per-store distribution by customer_count)

Source tables:
  Block 1/2/3: agg_daily_order_type_meal (Phase A Gold, Phase D materializer)
  Block 4:     fact_pos_transaction (Silver) JOIN fact_pos_item (Silver)
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import date
from typing import Optional

from smartbi.canonical.templates.base import TemplateResult


@dataclass
class RevenueReportParams:
    """Inputs for compute_qhj_revenue_report.

    Spec §6.1. include_yoy is hardcoded False first phase (§11.2);
    Phase 2 will populate after 2024 historical data is loaded.
    """
    factory_id: str
    store_ids: list[int]
    date_from: date
    date_to: date
    meal_periods: Optional[list[str]] = None  # None / [] = all shifts
    include_yoy: bool = False


async def compute_qhj_revenue_report(
    pool, params: RevenueReportParams,
) -> TemplateResult:
    """Compute all 4 blocks concurrently; returns single TemplateResult.

    Caller is responsible for setting tenant_ctx.set_factory_id() before
    calling — Block 1/2/3 SQL relies on app.factory_id GUC for RLS, and
    Block 4 sets it on its per-store connection acquisition.
    """
    # Block 4 fires N per-store queries concurrently; semaphore caps pool
    # contention. pool max_size is 5 in prod (per spec §11.x audit S notes),
    # so 3 leaves 2 connections for Blocks 1/2/3.
    block4_sem = asyncio.Semaphore(3)

    block1, block2, block3, block4 = await asyncio.gather(
        _compute_block1_yoy(pool, params),
        _compute_block2_mom(pool, params),
        _compute_block3_meal_split(pool, params),
        _compute_block4_diner_dist(pool, params, block4_sem),
    )

    return TemplateResult(
        code="qhj_revenue_report",
        title="收入管理报表",
        data={
            "block1_yoy": block1,
            "block2_mom": block2,
            "block3_meal_split": block3,
            "block4_diner_dist": block4,
            "meta": {
                "date_from": params.date_from.isoformat(),
                "date_to": params.date_to.isoformat(),
                "yoy_available": params.include_yoy,
                "yoy_note": (
                    None if params.include_yoy else "需要 2024 同期数据"
                ),
            },
        },
        applies=True,
    )


# ─── Block compute functions (E1: stubs; E2-E5 fill the SQL) ──────────────

async def _compute_block1_yoy(pool, params: RevenueReportParams) -> list[dict]:
    """Block 1: 可比同比 (year-over-year). Phase 1: returns NULL prev columns."""
    # Filled in Task E2.
    return []


async def _compute_block2_mom(pool, params: RevenueReportParams) -> list[dict]:
    """Block 2: 环比 (period over previous same-length period)."""
    # Filled in Task E3.
    return []


async def _compute_block3_meal_split(pool, params: RevenueReportParams) -> list[dict]:
    """Block 3: 堂食外卖占比 (current period dine-in/takeout split)."""
    # Filled in Task E4.
    return []


async def _compute_block4_diner_dist(
    pool, params: RevenueReportParams, sem: asyncio.Semaphore,
) -> list[dict]:
    """Block 4: 客单人数分析 (per-store distribution by customer_count)."""
    # Filled in Task E5.
    return []
