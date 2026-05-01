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


def _aggregate_department_data(
    rows: list[dict],
) -> dict[str, dict]:
    """Mirror Java DepartmentAnalysisServiceImpl.aggregateDepartmentData (line 546-567).

    ⚠️ C1 lock — headcount aggregation = MAX across all records in window per
    department, NOT SUM, NOT latest-by-date. Java code comment line 560
    (`人员数取最新记录` "use latest record") is MISLEADING — actual impl
    (line 561-562) is `if (data.getHeadcount() > agg.headcount) agg.headcount = ...`.

    ⚠️ I3 lock — SELECT * pulls precomputed `per_capita_sales` + `per_capita_cost`
    columns. This function MUST IGNORE them. Per-capita is recomputed in
    efficiencyMatrix from aggregated salesAmount / costAmount / headcount.

    ⚠️ Rule 1 lock — All null fields default to `Decimal("0")` via `is None`
    ternary, NOT `or`. Java line 553-558 treats null as ZERO via
    `data.getX() != null ? data.getX() : BigDecimal.ZERO`.
    """
    result: dict[str, dict] = {}    # LinkedHashMap → Python 3.7+ dict insertion-order

    for row in rows:
        dept = row["department"]
        agg = result.setdefault(dept, {
            "salesAmount":  Decimal("0"),
            "salesTarget":  Decimal("0"),
            "costAmount":   Decimal("0"),
            "headcount":    0,
        })

        # Rule 1: explicit is-None ternary
        agg["salesAmount"] += (
            _to_decimal(row["sales_amount"])
            if row.get("sales_amount") is not None
            else Decimal("0")
        )
        agg["salesTarget"] += (
            _to_decimal(row["sales_target"])
            if row.get("sales_target") is not None
            else Decimal("0")
        )
        agg["costAmount"] += (
            _to_decimal(row["cost_amount"])
            if row.get("cost_amount") is not None
            else Decimal("0")
        )

        # C1 — running MAX headcount (NOT sum, NOT latest-by-date)
        hc = row.get("headcount")
        if hc is not None and int(hc) > agg["headcount"]:
            agg["headcount"] = int(hc)

        # I3 — per_capita_sales / per_capita_cost columns IGNORED (recompute later)

    return result


def _calculate_completion_rate(
    actual: Decimal, target: Optional[Decimal]
) -> Decimal:
    """Mirror Java DepartmentAnalysisServiceImpl.calculateCompletionRate (line 610-616).

    Java:
      if (target == null || target.compareTo(BigDecimal.ZERO) == 0) {
          return BigDecimal.ZERO;
      }
      return actual.multiply(BigDecimal.valueOf(100))
                   .divide(target, SCALE, ROUNDING_MODE);

    ⚠️ C4 lock — Python MUST use `target is None or target == Decimal("0")`,
    NOT `if not target:` (Rule 1).

    ⚠️ Arithmetic order — Java `.divide(target, SCALE=4, HALF_UP)` 把**除法结果**
    量化到 4 位 HALF_UP, NOT 把乘法结果先量化。Python MUST mirror:
       ((actual * 100) / target).quantize(SCALE, HALF_UP)
    NOT
       (actual * 100).quantize(SCALE, HALF_UP) / target    ← BUG 顺序反了
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    # ✅ Mirror Java: 除法结果量化, NOT 乘法结果
    return ((actual * Decimal("100")) / target).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP
    )


def _determine_target_completion_alert(value: Decimal) -> str:
    """Mirror Java MetricCalculatorServiceImpl.determineAlertLevel(TARGET_COMPLETION)
    (line 458-461):

      double v = value.doubleValue();
      if (v < 60) return RED;
      if (v < 85) return YELLOW;
      return GREEN;

    ⚠️ T1 lock — 60/85 Java HARDCODED, NOT from alert_thresholds.json (which has
    `department.target_completion.yellow=80` — 不同概念, 给 /alerts endpoint 用的).
    Inline const 防 sister bug.

    ⚠️ Rule 7 lock — 阈值 60 / 85 是 INTEGER → `float(value)` 比较跟 Java
    `value.doubleValue()` 一致 (Rule 7 explicitly notes integer thresholds OK).
    """
    v = float(value)
    if v < float(_DEPARTMENT_TARGET_COMPLETION_RED):
        return "RED"
    if v < float(_DEPARTMENT_TARGET_COMPLETION_YELLOW):
        return "YELLOW"
    return "GREEN"
