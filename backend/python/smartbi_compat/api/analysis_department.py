"""Phase 2A: /analysis/department composite real impl.

Mirrors Java SmartBIServiceImpl.getComprehensiveAnalysis "department" case
(line 586-591) + envelope (line 612-613) + 4 DepartmentAnalysisServiceImpl
sub-services. Composite path always taken in prod; ?department=filter is
dead code, ignored.

See spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _get_period_key,         # post-PR #30 calendar-year fix (Rule 2 compliant)
    _strip_volatile,         # already covers "generatedAt" key
    VOLATILE_KEYS,
    _decimal_to_number,      # FastAPI Decimal serialization parity (Rule 4)
    _to_decimal,             # safe Decimal coercion
    _utc_now_iso,            # ISO timestamp for generatedAt (volatile, stripped)
)
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

# T1 lock — inline const, NOT alert_thresholds.py 80 (different concept for /alerts)
_DEPARTMENT_TARGET_COMPLETION_RED    = Decimal("60")
_DEPARTMENT_TARGET_COMPLETION_YELLOW = Decimal("85")

# SCALE constants matching Java DepartmentAnalysisServiceImpl line 52-54
_SCALE             = Decimal("0.0001")    # SCALE=4 中间精度
_DISPLAY_SCALE     = Decimal("0.01")      # DISPLAY_SCALE=2 输出
_QUANTIZE_HALF_UP  = ROUND_HALF_UP


router = APIRouter()


async def _query_department_full(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java SmartBiDepartmentDataRepository.findByFactoryIdAndRecordDateBetween.

    ⚠️ C2 fix: Java JPA derived query has NO ORDER BY (repo line 33-35) → PG row
    order unstable. Python adds explicit ORDER BY id for byte-shape determinism.

    Rule 5: SELECT * for shared SQL helpers (future-proof for schema additions).
    Caller (`_aggregate_department_data`) MUST IGNORE per_capita_sales /
    per_capita_cost columns (I3 fix: recompute from aggregated values).

    Rule 6: input boundary None-check.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_department_full: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )

    from smartbi.config import get_cretas_pool  # type: ignore
    pool = await get_cretas_pool()

    sql = """
        SELECT *
        FROM smart_bi_department_data
        WHERE factory_id = $1
          AND deleted_at IS NULL
          AND record_date BETWEEN $2 AND $3
        ORDER BY id
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)
    return [dict(r) for r in rows]


async def _query_department_daily_trend(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java SmartBiSalesDataRepository.findDepartmentDailyTrend (line 107-112).

    ⚠️ I4 fix: ORDER BY order_date ONLY (NOT order_date, department) — verbatim
    Java semantics. Same-date department iteration order is intentionally
    unspecified per Java behavior. Python NOT 主动加 ORDER BY department
    否则 byte-shape 跟 Java 不一致.

    Rule 6: input boundary None-check.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_department_daily_trend: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )

    from smartbi.config import get_cretas_pool  # type: ignore
    pool = await get_cretas_pool()

    sql = """
        SELECT order_date, department, SUM(amount) AS total_amount
        FROM smart_bi_sales_data
        WHERE factory_id = $1
          AND deleted_at IS NULL
          AND order_date BETWEEN $2 AND $3
        GROUP BY order_date, department
        ORDER BY order_date
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)
    return [dict(r) for r in rows]
