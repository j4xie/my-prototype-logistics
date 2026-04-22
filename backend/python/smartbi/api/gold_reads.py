"""Gold layer HTTP read endpoints.

Week 4 Phase B v0 of Unified Data Layer v1 spec (§5).

v1.1 pilot: one endpoint (`/finance-summary`) that serves the 财务报表
page's data from `agg_daily`. More queries will be added as other
downstream modules cut over.

Auth / tenant scope
-------------------
Routes require the caller to already have `tenant_ctx.current_factory_id`
set — the auth middleware does this from the JWT. The `factory_id`
query param is a double-check (must match) but RLS is the enforcement
mechanism.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from smartbi.config import get_pg_pool
from smartbi.gold import (
    channel_breakdown,
    daily_trend,
    discount_breakdown,
    finance_summary,
    kpi_summary,
    top_products,
)
from smartbi.tenant_ctx import get_factory_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gold", tags=["Gold Reads"])


def _parse_date(s: str, field: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"{field} must be YYYY-MM-DD, got {s!r}",
        )


def _resolve_tenant(factory_id: Optional[str]) -> str:
    """Factor out the 'use JWT tenant unless caller explicitly matches' guard."""
    tenant = get_factory_id()
    if not tenant:
        raise HTTPException(status_code=401, detail="tenant context not set")
    fid = factory_id or tenant
    if fid != tenant:
        raise HTTPException(
            status_code=403,
            detail=f"factory_id query param {fid!r} doesn't match JWT tenant {tenant!r}",
        )
    return fid


def _parse_range(start_date: str, end_date: str) -> tuple:
    start = _parse_date(start_date, "start_date")
    end = _parse_date(end_date, "end_date")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date > end_date")
    return start, end


@router.get("/finance-summary")
async def get_finance_summary(
    start_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    end_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    factory_id: Optional[str] = Query(None, description="belt-and-suspenders; defaults to JWT tenant"),
    top_n_stores: int = Query(10, ge=1, le=100),
):
    """Finance KPI summary from Gold agg_daily.

    Returns: total_revenue, bill_count, avg_bill_value, store_count,
    day_count, top_stores[{store_id, store_name, revenue, bill_count}]

    No cost / profit data yet (Silver doesn't capture costs — Week 5+).
    """
    fid = _resolve_tenant(factory_id)
    start, end = _parse_range(start_date, end_date)
    pool = await get_pg_pool()
    try:
        return await finance_summary(
            pool, fid, (start, end), top_n_stores=top_n_stores,
        )
    except Exception as e:
        logger.exception("finance-summary failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Gold query failed: {e}")


@router.get("/daily-trend")
async def get_daily_trend(
    start_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    end_date: str = Query(..., description="YYYY-MM-DD inclusive"),
    factory_id: Optional[str] = Query(None),
):
    """Daily revenue + bill-count trend for 分析概览 line chart."""
    fid = _resolve_tenant(factory_id)
    start, end = _parse_range(start_date, end_date)
    pool = await get_pg_pool()
    try:
        return await daily_trend(pool, fid, (start, end))
    except Exception as e:
        logger.exception("daily-trend failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Gold query failed: {e}")


@router.get("/top-products")
async def get_top_products(
    start_date: str = Query(...),
    end_date: str = Query(...),
    factory_id: Optional[str] = Query(None),
    top_n: int = Query(10, ge=1, le=100),
):
    """Top products by revenue. Uses agg_product which is monthly-grained —
    date range is normalized to the month(s) it touches."""
    fid = _resolve_tenant(factory_id)
    start, end = _parse_range(start_date, end_date)
    pool = await get_pg_pool()
    try:
        return await top_products(pool, fid, (start, end), top_n=top_n)
    except Exception as e:
        logger.exception("top-products failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Gold query failed: {e}")


@router.get("/channel-breakdown")
async def get_channel_breakdown(
    start_date: str = Query(...),
    end_date: str = Query(...),
    factory_id: Optional[str] = Query(None),
    top_n: int = Query(10, ge=1, le=100),
):
    """Revenue by payment channel. Returns empty channels list if
    fact_pos_payment has no rows for this tenant (EAV not yet wired)."""
    fid = _resolve_tenant(factory_id)
    start, end = _parse_range(start_date, end_date)
    pool = await get_pg_pool()
    try:
        return await channel_breakdown(pool, fid, (start, end), top_n=top_n)
    except Exception as e:
        logger.exception("channel-breakdown failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Gold query failed: {e}")


@router.get("/discount-breakdown")
async def get_discount_breakdown(
    start_date: str = Query(...),
    end_date: str = Query(...),
    factory_id: Optional[str] = Query(None),
    top_n: int = Query(10, ge=1, le=100),
):
    """Voucher/coupon usage ranked by amount. Direct aggregate over
    fact_pos_discount (no materialized agg_discount table yet)."""
    fid = _resolve_tenant(factory_id)
    start, end = _parse_range(start_date, end_date)
    pool = await get_pg_pool()
    try:
        return await discount_breakdown(pool, fid, (start, end), top_n=top_n)
    except Exception as e:
        logger.exception("discount-breakdown failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Gold query failed: {e}")


@router.get("/kpi-summary")
async def get_kpi_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    factory_id: Optional[str] = Query(None),
):
    """Compact KPI card data — feeds both 分析概览 + KPI看板 headers.
    One trip to agg_daily; top rankings live on separate routes."""
    fid = _resolve_tenant(factory_id)
    start, end = _parse_range(start_date, end_date)
    pool = await get_pg_pool()
    try:
        return await kpi_summary(pool, fid, (start, end))
    except Exception as e:
        logger.exception("kpi-summary failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Gold query failed: {e}")
