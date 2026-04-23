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


async def _query_analysis_results_batch(
    pool,
    factory_id: str,
    template_codes: list,
    upload_id: Optional[int],
) -> dict:
    """Core batch resolver used by the /analysis-results endpoint.

    Split out as a module-level helper so unit tests can exercise the
    query shape directly (FastAPI request/response handling is separate).

    Returns dict with:
      - items: list of template rows (one per code that resolved)
      - missing_codes: codes not found in the pinned upload_id (only
        populated when upload_id is given)
      - never_materialized_codes: codes with zero rows in the entire
        smart_bi_pg_analysis_results for this factory
    """
    if not template_codes:
        return {"items": [], "missing_codes": [], "never_materialized_codes": []}

    async with pool.acquire() as conn:
        if upload_id is not None:
            # Strict: only this upload. Codes not in upload → missing_codes.
            rows = await conn.fetch(
                """
                SELECT r.upload_id, r.template_code, r.domain, r.analysis_type,
                       r.analysis_result, r.chart_configs, r.kpi_values,
                       r.insights, r.created_at,
                       u.file_name  AS upload_label,
                       u.created_at AS upload_created_at
                  FROM smart_bi_pg_analysis_results r
                  JOIN smart_bi_pg_excel_uploads u ON u.id = r.upload_id
                 WHERE r.factory_id    = $1
                   AND r.upload_id     = $2
                   AND r.template_code = ANY($3)
                """,
                factory_id, upload_id, template_codes,
            )
            items = [_row_to_result(r) for r in rows]
            found = {i["template_code"] for i in items}
            # Among requested codes: found-in-upload vs not-found-in-upload vs never-seen.
            ever_seen_rows = await conn.fetch(
                """
                SELECT DISTINCT template_code
                  FROM smart_bi_pg_analysis_results
                 WHERE factory_id    = $1
                   AND template_code = ANY($2)
                """,
                factory_id, template_codes,
            )
            ever_seen = {r["template_code"] for r in ever_seen_rows}
            missing = sorted(ever_seen - found)
            never = sorted(set(template_codes) - ever_seen)
            return {
                "items": items,
                "missing_codes": missing,
                "never_materialized_codes": never,
            }

        # resolve_latest: DISTINCT ON per code, ordered by created_at DESC.
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (r.template_code)
                   r.upload_id, r.template_code, r.domain, r.analysis_type,
                   r.analysis_result, r.chart_configs, r.kpi_values,
                   r.insights, r.created_at,
                   u.file_name  AS upload_label,
                   u.created_at AS upload_created_at
              FROM smart_bi_pg_analysis_results r
              JOIN smart_bi_pg_excel_uploads u ON u.id = r.upload_id
             WHERE r.factory_id    = $1
               AND r.template_code = ANY($2)
             ORDER BY r.template_code, r.created_at DESC
            """,
            factory_id, template_codes,
        )
        items = [_row_to_result(r) for r in rows]
        found = {i["template_code"] for i in items}
        never = sorted(set(template_codes) - found)
        return {
            "items": items,
            "missing_codes": [],
            "never_materialized_codes": never,
        }


@router.get("/analysis-results")
async def get_analysis_results(
    upload_id: Optional[int] = Query(None, description="Pin to one upload; omit to resolve latest per code"),
    template_code: Optional[str] = Query(None, description="Single template; alias for template_codes=<code>"),
    template_codes: Optional[str] = Query(None, description="CSV of template codes (1..20)"),
    factory_id: Optional[str] = Query(None, description="belt-and-suspenders; defaults to JWT tenant"),
):
    """Read materialized template results from smart_bi_pg_analysis_results.

    Query modes:
    - template_codes=<csv> : batch. Resolves per-code "latest upload where
      this code exists" unless upload_id is also given.
    - template_code=<single> : legacy single-result variant. Alias for
      template_codes=<single>.
    - upload_id=<id> without codes : list all templates for that upload
      (legacy; still supported).

    Response shape (batch):
      { items: [...], missing_codes: [...], never_materialized_codes: [...] }
    Response shape (legacy single-template, found):
      { upload_id, template_code, domain, ..., upload_label }
    Response shape (legacy single-template, not found):
      404
    """
    fid = _resolve_tenant(factory_id)
    pool = await get_pg_pool()

    # Normalize: template_code → template_codes
    codes_list: list = []
    if template_codes:
        codes_list = [c.strip() for c in template_codes.split(",") if c.strip()]
    elif template_code:
        codes_list = [template_code.strip()]

    if codes_list:
        if len(codes_list) > 20:
            raise HTTPException(
                status_code=400,
                detail=f"template_codes max 20 per call, got {len(codes_list)}",
            )
        try:
            return await _query_analysis_results_batch(
                pool, fid, codes_list, upload_id,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("analysis-results batch failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Analysis read failed: {e}")

    # Legacy: upload_id without codes → list all templates for the upload.
    if upload_id is None:
        raise HTTPException(
            status_code=400,
            detail="Provide template_codes= or upload_id=",
        )
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT ON (r.template_code)
                       r.upload_id, r.template_code, r.domain, r.analysis_type,
                       r.analysis_result, r.chart_configs, r.kpi_values,
                       r.insights, r.created_at,
                       u.file_name AS upload_label, u.created_at AS upload_created_at
                  FROM smart_bi_pg_analysis_results r
                  JOIN smart_bi_pg_excel_uploads u ON u.id = r.upload_id
                 WHERE r.factory_id = $1
                   AND r.upload_id  = $2
                   AND r.template_code IS NOT NULL
                 ORDER BY r.template_code, r.created_at DESC
                """,
                fid, upload_id,
            )
            return {"items": [_row_to_result(r) for r in rows]}
    except Exception as e:
        logger.exception("analysis-results by-upload failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Analysis read failed: {e}")


def _row_to_result(row) -> dict:
    """Parse JSONB fields (asyncpg returns them as strings) + date isoformat."""
    import json as _json
    def _j(v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return _json.loads(v)
            except ValueError:
                return v
        return v

    def _iso(dt):
        return dt.isoformat() if dt is not None else None

    return {
        "upload_id": int(row["upload_id"]),
        "template_code": row["template_code"],
        "domain": row["domain"],
        "analysis_type": row["analysis_type"],
        "analysis_result": _j(row["analysis_result"]),
        "chart_configs": _j(row["chart_configs"]),
        "kpi_values": _j(row["kpi_values"]),
        "insights": _j(row["insights"]),
        "created_at": _iso(row["created_at"]),
        # upload_label + upload_created_at may not exist for the old
        # single-template caller path. Use row.get()-style access via try.
        "upload_label": row["upload_label"] if "upload_label" in row.keys() else None,
        "upload_created_at": _iso(row["upload_created_at"]) if "upload_created_at" in row.keys() else None,
    }


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
