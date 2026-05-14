"""Phase 2A /analysis/sales endpoint port.

Implements the composite Map<String, Object> response with 7 keys:
  overview / customerRanking / productRanking / dateRange /
  salespersonRanking / generatedAt / trendChart

Foundation defines:
  - Route registration + composite assembly
  - 5 async sub-service stubs returning F999 empty-state shape
  - 5 DTO dict factories (DashboardResponse / RankingItem / ChartConfig /
    AIInsight / KPICard)
  - DateRange dict factory

Sibling specs replace stub bodies:
  - overview spec → _get_sales_overview legacy fallback path
  - gold spec → _get_sales_overview Gold-first dispatch + helpers
  - rankings spec → _get_X_ranking real impls
  - trend spec → _get_sales_trend_chart real impl

Java reference:
  - Controller: SmartBIAnalysisController.getSalesAnalysis line 98-138
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis line 568-616
  - Sub-services: SalesAnalysisServiceImpl.{getSalesOverview, getXRanking,
    getSalesTrendChart}

Spec: docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-foundation-design.md
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from smartbi_compat.api.analysis import _query_sales_data, wrap_response
from smartbi_compat._rbac_role import require_analytics_read
from smartbi_compat._rbac_strip import strip_price_for_role
from smartbi_compat.schema_compat import _java_isoformat
from smartbi_compat.auth import AuthContext
from smartbi_compat.date_range import DateRange
from smartbi_compat.tenant import TenantType, get_tenant_type

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Python 3.8 compat shim for asyncio.to_thread (added 3.9+)
# ============================================================
async def _to_thread(fn, *args, **kwargs):
    """Run a sync function in a thread executor.

    Python 3.8-compatible replacement for asyncio.to_thread (3.9+).
    Server venv38 runs Python 3.8.17; using asyncio.to_thread fails at
    runtime with AttributeError. This shim works on Python 3.6+ via
    asyncio.get_event_loop().run_in_executor.

    For kwargs support, wraps the call in functools.partial — same effective
    behavior as asyncio.to_thread which uses functools.partial under the hood.
    """
    import functools
    try:
        # Python 3.10+
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # Python 3.7-3.9 fallback
        loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(fn, *args, **kwargs))


# ============================================================
# Section 0: Legacy-path constants (mirror Java SalesAnalysisServiceImpl.java line 64-74)
# ============================================================
# Precision (Java line 64-66)
SCALE = 4              # intermediate division precision
DISPLAY_SCALE = 2      # final value precision

# Alert thresholds (Java line 69-74)
TARGET_RED_THRESHOLD = Decimal("60")
TARGET_YELLOW_THRESHOLD = Decimal("85")
MARGIN_RED_THRESHOLD = Decimal("15")
MARGIN_YELLOW_THRESHOLD = Decimal("25")
GROWTH_RED_THRESHOLD = Decimal("-20")
GROWTH_YELLOW_THRESHOLD = Decimal("-5")


def _alert_level_to_status(alert_level: Optional[str]) -> str:
    """Mirror Java SalesAnalysisServiceImpl.convertToKPICards line 678-689."""
    if alert_level == "RED":
        return "red"
    if alert_level == "YELLOW":
        return "yellow"
    return "green"


def _change_direction_to_trend(change_direction: Optional[str]) -> str:
    """Mirror Java SalesAnalysisServiceImpl.convertToKPICards line 691-703."""
    if change_direction == "UP":
        return "up"
    if change_direction == "DOWN":
        return "down"
    return "flat"


def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java SalesAnalysisServiceImpl.formatCurrency line 1255-1260."""
    if value is None:
        return "-"
    quantized = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{quantized:,.2f}"


def _format_completion_pct(value: Decimal) -> str:
    """Mirror Java `String.format("%.1f%%", value.doubleValue())` line 236."""
    quantized = value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return f"{float(quantized):.1f}%"


def _format_growth_pct(value: Decimal) -> str:
    """Mirror Java `String.format("%+.1f%%", value.doubleValue())` line 255.

    Java's `%+` flag prepends '+' only when the formatted number begins with a digit
    (not when it begins with '-' from negative zero). We replicate by inspecting
    the post-format string for a leading minus sign.
    """
    quantized = value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    formatted = f"{float(quantized):.1f}"
    if formatted.startswith("-"):
        return f"{formatted}%"
    return f"+{formatted}%"


def _calculate_completion_rate(actual: Decimal, target: Optional[Decimal]) -> Decimal:
    """Mirror Java SalesAnalysisServiceImpl.calculateCompletionRate line 1166-1171.

    target null OR 0 → returns Decimal("0") (NOT scaled — matches Java BigDecimal.ZERO).
    Otherwise: actual.divide(target, SCALE=4, HALF_UP).multiply(100) — Rule 10
    (round fraction first, then multiply) to match Java BigDecimal semantic.
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    return (actual / target).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP,
    ) * Decimal("100")


def _calculate_mom_growth(current: Optional[Decimal], previous: Optional[Decimal]) -> Decimal:
    """Mirror Java MetricCalculatorServiceImpl.calculateMomGrowth line 425-438.

    Edge cases:
      - previous null OR 0: return Decimal(100) if current > 0 else Decimal(0)
      - current null:       return Decimal(-100)
      - normal:             (current - previous).divide(abs(previous), SCALE=4, HALF_UP)
                            .multiply(100).setScale(DISPLAY_SCALE=2, HALF_UP)
                            (Rule 10 — round fraction first then multiply)
    """
    if previous is None or previous == Decimal("0"):
        if current is not None and current > Decimal("0"):
            return Decimal("100")
        return Decimal("0")
    if current is None:
        return Decimal("-100")
    return (
        ((current - previous) / abs(previous)).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP,
        ) * Decimal("100")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _new_metric_result_dict(
    metric_code: Optional[str] = None,
    metric_name: Optional[str] = None,
    value: Optional[Decimal] = None,
    formatted_value: Optional[str] = None,
    unit: Optional[str] = None,
    change_percent: Optional[Decimal] = None,
    change_direction: Optional[str] = None,
    change_value: Optional[Decimal] = None,
    alert_level: str = "GREEN",
    dimension_value: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Mirror MetricResult.java @Data getters (11 fields per spec §4).

    Used as intermediate representation; converted to KPICard via
    _convert_metric_results_to_kpi_cards before insertion into DashboardResponse.kpiCards.
    """
    return {
        "metricCode": metric_code,
        "metricName": metric_name,
        "value": value,
        "formattedValue": formatted_value,
        "unit": unit,
        "changePercent": change_percent,
        "changeDirection": change_direction,
        "changeValue": change_value,
        "alertLevel": alert_level,
        "dimensionValue": dimension_value,
        "description": description,
    }


# ============================================================
# Section 0.5: Legacy SQL aggregate helpers (Java repo mirror)
# ============================================================
# Mirror SmartBiSalesDataRepository methods for the legacy fallback path
# (when Gold path is unavailable / disabled). Each helper is monkey-patchable
# at module level via _get_sync_engine for unit testing without standing up
# a Postgres instance.


def _get_sync_engine():
    """Module-level seam wrapping the SQLAlchemy engine acquisition.

    Indirection lets tests monkey-patch at this module's namespace.

    Production: returns ``cretas_engine`` from ``smartbi.database.connection``
    bound to ``FOOD_KB_POSTGRES_DB`` (cretas_prod_db in prod, cretas_db in
    test). The default ``engine`` is bound to ``smartbi_prod_db`` via
    ``POSTGRES_DB``, but ``smart_bi_sales_data`` lives in cretas_prod_db
    (per spec docs/superpowers/specs/2026-05-05-phase2a-db-pool-wiring-fix.md
    §1.3 empirical canonical-DB mapping — 345 rows in cretas_prod_db, NOT
    present in smartbi_prod_db). Routing through ``cretas_engine`` is what
    keeps this endpoint from throwing ``UndefinedTableError`` in prod.

    Cascade: this helper is also imported by ``analysis_region.py`` (1 site)
    and ``analysis_drilldown.py`` (5 dispatch sites) — same fix applies
    transitively without touching those files.
    """
    from smartbi.database.connection import cretas_engine
    if cretas_engine is None:
        raise RuntimeError(
            "cretas_engine not configured — FOOD_KB_POSTGRES_PASSWORD env "
            "missing or connection setup failed at module import time."
        )
    return cretas_engine


_KPI_SUMMARY_SQL = text("""
    SELECT
      COALESCE(SUM(amount), 0)         AS total_sales,
      COALESCE(SUM(quantity), 0)       AS total_quantity,
      COALESCE(SUM(profit), 0)         AS total_profit,
      COALESCE(SUM(cost), 0)           AS total_cost,
      COALESCE(SUM(monthly_target), 0) AS total_target,
      COUNT(DISTINCT product_id)       AS order_count
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
""")


async def _query_sales_aggregates(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[tuple]:
    """Mirror SmartBiSalesDataRepository.findKpiSummary line 85-92.

    Returns 6-tuple (total_sales, total_quantity, total_profit, total_cost,
    total_target, order_count) — Decimal for first 5, int for last.
    Returns None if engine acquisition fails or no row.
    Wrapped in asyncio.to_thread for sync SQLAlchemy compat.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            row = conn.execute(_KPI_SUMMARY_SQL, {
                "factory_id": factory_id,
                "start_date": start_date,
                "end_date": end_date,
            }).fetchone()
            if row is None:
                return None
            return (row[0], row[1], row[2], row[3], row[4], row[5])
    try:
        return await _to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_sales_aggregates failed factory=%s: %s",
            factory_id, e,
        )
        return None


async def _query_sales_aggregates_previous_period(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[tuple]:
    """Same query as _query_sales_aggregates with date range shifted -1 month.

    Mirrors Java line 242-243: findKpiSummary(factoryId, startDate.minusMonths(1),
    endDate.minusMonths(1)). Used only for MoM growth KPI.

    Uses dateutil.relativedelta(months=-1) to match LocalDate.minusMonths semantic.
    """
    from dateutil.relativedelta import relativedelta
    prev_start = start_date - relativedelta(months=1)
    prev_end = end_date - relativedelta(months=1)
    return await _query_sales_aggregates(factory_id, prev_start, prev_end)


_TOP_SALESPERSONS_SQL = text("""
    SELECT salesperson_name,
           COALESCE(SUM(amount), 0)   AS total_amount,
           COALESCE(SUM(quantity), 0) AS total_quantity
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
      AND salesperson_name IS NOT NULL
    GROUP BY salesperson_name
    ORDER BY SUM(amount) DESC
""")


async def _query_top_salespersons_aggregate(
    factory_id: str, start_date: date, end_date: date,
) -> list[tuple]:
    """Mirror SmartBiSalesDataRepository.findSalesBySalesperson line 45-50.

    Returns list of (salesperson_name, total_amount, total_quantity) ordered
    DESC. Filters null name at SQL level. Caller is responsible for top-10
    truncation (Java buildRankingsFromAggregates line 321).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            return [
                (r[0], r[1], r[2])
                for r in conn.execute(_TOP_SALESPERSONS_SQL, {
                    "factory_id": factory_id,
                    "start_date": start_date,
                    "end_date": end_date,
                })
            ]
    try:
        return await _to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_top_salespersons_aggregate failed factory=%s: %s",
            factory_id, e,
        )
        return []


_DAILY_SALES_TREND_SQL = text("""
    SELECT order_date,
           COALESCE(SUM(amount), 0)   AS total_amount,
           COALESCE(SUM(quantity), 0) AS total_quantity
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
    GROUP BY order_date
    ORDER BY order_date
""")


async def _query_daily_sales_trend_aggregate(
    factory_id: str, start_date: date, end_date: date,
) -> list[tuple]:
    """Mirror SmartBiSalesDataRepository.findDailySalesTrend line 97-102.

    Returns list of (order_date, total_amount, total_quantity) ordered ASC.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            return [
                (r[0], r[1], r[2])
                for r in conn.execute(_DAILY_SALES_TREND_SQL, {
                    "factory_id": factory_id,
                    "start_date": start_date,
                    "end_date": end_date,
                })
            ]
    try:
        return await _to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_daily_sales_trend_aggregate failed factory=%s: %s",
            factory_id, e,
        )
        return []


_CATEGORY_DISTRIBUTION_SQL = text("""
    SELECT product_category,
           COALESCE(SUM(amount), 0) AS total_amount
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
    GROUP BY product_category
    ORDER BY SUM(amount) DESC
""")


async def _query_category_distribution_aggregate(
    factory_id: str, start_date: date, end_date: date,
) -> list[tuple]:
    """Mirror SmartBiSalesDataRepository.findSalesByProductCategory line 117-122.

    Returns list of (product_category, total_amount) ordered DESC.
    NULL category preserved — Java buildPieChartFromAggregates line 294
    substitutes "未分类" at chart-build time (handled by Phase D.3 _build_legacy_category_chart).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            return [
                (r[0], r[1])
                for r in conn.execute(_CATEGORY_DISTRIBUTION_SQL, {
                    "factory_id": factory_id,
                    "start_date": start_date,
                    "end_date": end_date,
                })
            ]
    try:
        return await _to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_category_distribution_aggregate failed factory=%s: %s",
            factory_id, e,
        )
        return []


# ============================================================
# Section 1: DTO dict factories (FROZEN by foundation spec §4)
# ============================================================
# Populated by Tasks C.3 - C.7


def _infer_granularity(start: date, end: date) -> str:
    """Mirror Java DateRange.inferGranularity(LocalDate, LocalDate).

    Day-count based (matches dashboard.py + analysis_finance.py impl).
    See analysis_finance.py:_infer_granularity for full doc + audit history.
    """
    days = (end - start).days + 1
    if days <= 1:
        return "DAY"
    if days <= 7:
        return "WEEK"
    if days <= 31:
        return "MONTH"
    if days <= 93:
        return "QUARTER"
    return "YEAR"


def _new_date_range_dict(range_: DateRange) -> dict:
    """Mirror DateRange.java @Data getters incl. derived `days` and `valid`.

    F999 observed 7-field shape:
      startDate / endDate (LocalDate, ISO string)
      granularity (String — YEAR/MONTH/WEEK/DAY/CUSTOM)
      originalExpression (String — e.g. "2025-01-01 至 2025-12-31")
      relative (boolean)
      days (derived = (endDate - startDate).days + 1)
      valid (derived = startDate <= endDate)

    granularity and originalExpression are inferred from start/end dates
    since DateRange.custom() does not carry these fields.
    """
    days_count = (range_.end_date - range_.start_date).days + 1
    # Prefer explicit attrs if present (e.g. future DateRange subclasses),
    # otherwise infer from dates
    granularity = getattr(range_, "granularity", None) or _infer_granularity(
        range_.start_date, range_.end_date
    )
    original_expression = getattr(range_, "original_expression", None) or (
        f"{range_.start_date.isoformat()} 至 {range_.end_date.isoformat()}"
    )
    return {
        "startDate": range_.start_date.isoformat(),
        "endDate": range_.end_date.isoformat(),
        "granularity": granularity,
        "originalExpression": original_expression,
        "relative": getattr(range_, "relative", False),
        "days": days_count,
        "valid": range_.start_date <= range_.end_date,
    }


def _new_dashboard_response_dict(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    kpi_cards: Optional[list] = None,
    metric_cards: Optional[list] = None,
    rankings: Optional[dict] = None,
    charts: Optional[dict] = None,
    chart_list: Optional[list] = None,
    ai_insights: Optional[list] = None,
    alerts: Optional[list] = None,
    recommendations: Optional[list] = None,
    suggestions: Optional[list] = None,
    generated_at: Optional[str] = None,
    last_updated: Optional[str] = None,
    from_cache: bool = False,
    cache_expire_at: Optional[str] = None,
) -> dict:
    """Mirror DashboardResponse.java @Data getters (16 fields).

    All 16 fields emit including 4 @Deprecated ones (metricCards / chartList
    / suggestions / lastUpdated) — Lombok @Data sees them via getters even
    when @Deprecated. Key order matches Java field declaration order.

    F999 empty-state defaults:
      kpi_cards=[], rankings={}, charts={} when not provided
      all other Optional fields default to None
    """
    return {
        "period": period,
        "startDate": start_date.isoformat() if start_date else None,
        "endDate": end_date.isoformat() if end_date else None,
        "kpiCards": kpi_cards if kpi_cards is not None else [],
        "metricCards": metric_cards,
        "rankings": rankings if rankings is not None else {},
        "charts": charts if charts is not None else {},
        "chartList": chart_list,
        "aiInsights": ai_insights if ai_insights is not None else [],
        "alerts": alerts,
        "recommendations": recommendations,
        "suggestions": suggestions,
        "generatedAt": generated_at,
        "lastUpdated": last_updated,
        "fromCache": from_cache,
        "cacheExpireAt": cache_expire_at,
    }


def _new_ranking_item_dict(
    rank: int,
    name: str,
    value: Decimal,
    target: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
    alert_level: Optional[str] = None,
) -> dict:
    """Mirror RankingItem.java @Data getters (6 fields exactly).

    Per rankings spec direct file read (53 LOC source): no derived getters.

    Note: `completionRate` is OVERLOADED by Java callers:
      - salesperson rankings: target completion percent (vs `target`)
      - product/customer rankings: share-of-total percentage (target stays null)
    """
    return {
        "rank": rank,
        "name": name,
        "value": value,
        "target": target,
        "completionRate": completion_rate,
        "alertLevel": alert_level,
    }


def _new_chart_config_dict(
    chart_type: str,
    title: str,
    series_field: Optional[str] = None,
    data: Optional[list] = None,
    options: Optional[dict] = None,
    xaxis_field: Optional[str] = None,
    yaxis_field: Optional[str] = None,
) -> dict:
    """Mirror ChartConfig.java @Data getters (7 fields observed in F999).

    Note: `xaxisField` / `yaxisField` are LOWERCASE (Jackson demangles
    Lombok-generated getXAxisField → "xaxisField"). Verified in F999 golden.

    `options` defaults to None (matches Gold path); legacy stub may pass
    {"showDataLabels": False, "smooth": True} per F999 observed.
    """
    return {
        "chartType": chart_type,
        "title": title,
        "seriesField": series_field,
        "data": data if data is not None else [],
        "options": options,
        "xaxisField": xaxis_field,
        "yaxisField": yaxis_field,
    }


def _new_ai_insight_dict(
    level: str,
    category: str,
    message: str,
    related_entity: Optional[str] = None,
    action_suggestion: Optional[str] = None,
) -> dict:
    """Mirror AIInsight.java @Data getters (5 fields observed in F999).

    level: RED / YELLOW / GREEN / INFO
    """
    return {
        "level": level,
        "category": category,
        "message": message,
        "relatedEntity": related_entity,
        "actionSuggestion": action_suggestion,
    }


def _to_decimal(v: Any) -> Decimal:
    """Tolerant Number -> Decimal conversion. Mirrors Java GoldDashboardBuilder.toBigDecimal.

    Returns Decimal("0") on None, parse errors, or unsupported types
    (matches Java's BigDecimal.ZERO fallback).

    Decimal passthrough preserves identity (no re-wrap).
    Float input goes via str() to preserve representation (12.5 -> "12.5" -> Decimal("12.5")).
    """
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, bool):  # bool is int subclass - guard before int branch
        return Decimal("0")
    if isinstance(v, int):
        return Decimal(v)
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, str):
        try:
            return Decimal(v)
        except Exception:
            return Decimal("0")
    return Decimal("0")


def _decimal_to_number(v: Decimal) -> Any:
    """Convert Decimal to Python int or float for JSON-safe serialization.

    FastAPI's default JSON encoder serializes Decimal as string (not number),
    breaking byte parity with Java's Jackson which emits numeric JSON values.
    This helper converts to int when the value has no fractional part,
    or float otherwise — mirroring what Jackson/BigDecimal serialize as JSON.

    Used wherever Decimal appears in response dicts that must match golden
    numeric JSON (rawValue, ranking value, chart amount).
    """
    if v == v.to_integral_value():
        return int(v)
    return float(v)


def _format_kpi_value(v: Decimal, unit: str) -> str:
    """Format Decimal for KPICard.value. Mirrors Java GoldDashboardBuilder.formatKpiValue.

    Yuan unit ("元") -> 2-decimal string preserving trailing zeros (Java setScale(2, HALF_UP).toPlainString).
    Other units -> integer string (rounded HALF_UP).

    Critical (G3): use str() of quantize result, NOT normalize() - normalize() strips
    trailing zeros (12.50 -> 12.5) and breaks Java byte parity.
    """
    if unit == "元":
        return str(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return str(v.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _new_kpi_card_dict(
    key: str,
    title: str,
    value: Optional[Any] = None,           # str (formatted) or Decimal
    raw_value: Optional[Decimal] = None,
    unit: Optional[str] = None,
    change: Optional[Decimal] = None,
    change_rate: Optional[Decimal] = None,
    trend: Optional[str] = None,            # up / down / flat
    status: str = "green",                   # @Builder.Default per Java line 81-82
    compare_text: Optional[str] = None,
    description: Optional[str] = None,
    target_value: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
) -> dict:
    """Mirror KPICard.java @Data getters (13 fields per overview agent finding).

    Lombok @Builder.Default sets status="green" — Python factory mirrors this.

    Used by:
      - gold spec: 4 KPIs (total_revenue / bill_count / avg_bill_value / store_count)
      - overview spec: 5 KPIs from legacy from-aggregates path

    For "元" unit values, `value` is formatted string (2 decimals); for
    integer units, `value` is integer-string. `rawValue` always BigDecimal.
    """
    return {
        "key": key,
        "title": title,
        "value": value,
        "rawValue": raw_value,
        "unit": unit,
        "change": change,
        "changeRate": change_rate,
        "trend": trend,
        "status": status,
        "compareText": compare_text,
        "description": description,
        "targetValue": target_value,
        "completionRate": completion_rate,
    }


# ============================================================
# Section 1.5: Legacy KPI cards builder + converter (Java mirror)
# ============================================================

# Java MetricCalculatorService constants (line 30-36)
_METRIC_SALES_AMOUNT = "SALES_AMOUNT"
_METRIC_ORDER_COUNT = "ORDER_COUNT"
_METRIC_AVG_ORDER_VALUE = "AVG_ORDER_VALUE"
_METRIC_TARGET_COMPLETION = "TARGET_COMPLETION"
_METRIC_MOM_GROWTH = "MOM_GROWTH"


def _determine_completion_alert_level(completion_rate: Decimal) -> str:
    """Java line 1176-1184."""
    if completion_rate < TARGET_RED_THRESHOLD:
        return "RED"
    if completion_rate < TARGET_YELLOW_THRESHOLD:
        return "YELLOW"
    return "GREEN"


def _determine_growth_alert_level(growth: Decimal) -> str:
    """Java line 1215-1223."""
    if growth < GROWTH_RED_THRESHOLD:
        return "RED"
    if growth < GROWTH_YELLOW_THRESHOLD:
        return "YELLOW"
    return "GREEN"


def _determine_change_direction(change_percent: Optional[Decimal]) -> str:
    """Java line 1228-1239: null/0 → STABLE, >0 → UP, <0 → DOWN."""
    if change_percent is None or change_percent == Decimal("0"):
        return "STABLE"
    return "UP" if change_percent > Decimal("0") else "DOWN"


async def _build_kpi_cards_from_aggregates(
    factory_id: str,
    start_date: date,
    end_date: date,
    total_sales: Decimal,
    total_quantity: Decimal,
    total_profit: Decimal,
    total_cost: Decimal,
    total_target: Decimal,
    order_count: int,
) -> list[dict]:
    """Mirror Java SalesAnalysisServiceImpl.buildKpiFromAggregates line 193-264.

    Returns 4 or 5 MetricResult dicts (MoM 5th only when previous_period_sales > 0).
    """
    cards: list[dict] = []

    # KPI 1: SALES_AMOUNT
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_SALES_AMOUNT,
        metric_name="总销售额",
        value=_decimal_to_number(total_sales.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        formatted_value=_format_currency(total_sales),
        unit="元",
        alert_level="GREEN",
    ))

    # KPI 2: ORDER_COUNT
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_ORDER_COUNT,
        metric_name="订单数",
        value=_decimal_to_number(Decimal(order_count)),
        formatted_value=f"{order_count:,d}",
        unit="单",
        alert_level="GREEN",
    ))

    # KPI 3: AVG_ORDER_VALUE
    if order_count > 0:
        avg_order = (total_sales / Decimal(order_count)).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP,
        )
    else:
        avg_order = Decimal("0")
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_AVG_ORDER_VALUE,
        metric_name="客单价",
        value=_decimal_to_number(avg_order.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        formatted_value=_format_currency(avg_order),
        unit="元",
        alert_level="GREEN",
    ))

    # KPI 4: TARGET_COMPLETION
    completion_rate = _calculate_completion_rate(total_sales, total_target)
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_TARGET_COMPLETION,
        metric_name="目标完成率",
        value=_decimal_to_number(completion_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        formatted_value=_format_completion_pct(completion_rate),
        unit="%",
        alert_level=_determine_completion_alert_level(completion_rate),
    ))

    # KPI 5: MOM_GROWTH (conditional — Java line 249)
    prev = await _query_sales_aggregates_previous_period(factory_id, start_date, end_date)
    previous_sales = prev[0] if prev is not None else Decimal("0")
    if previous_sales > Decimal("0"):
        mom_growth = _calculate_mom_growth(total_sales, previous_sales)
        cards.append(_new_metric_result_dict(
            metric_code=_METRIC_MOM_GROWTH,
            metric_name="环比增长",
            value=_decimal_to_number(mom_growth.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            formatted_value=_format_growth_pct(mom_growth),
            unit="%",
            change_percent=_decimal_to_number(mom_growth),
            change_direction=_determine_change_direction(mom_growth),
            alert_level=_determine_growth_alert_level(mom_growth),
        ))

    return cards


def _convert_metric_results_to_kpi_cards(metrics: list[dict]) -> list[dict]:
    """Mirror Java SalesAnalysisServiceImpl.convertToKPICards line 674-720."""
    cards = []
    for m in metrics:
        formatted = m.get("formattedValue")
        raw_decimal = m.get("value")
        if formatted is not None:
            display_value = formatted
        elif raw_decimal is not None:
            display_value = str(raw_decimal)
        else:
            display_value = "-"

        cards.append(_new_kpi_card_dict(
            key=m.get("metricCode"),
            title=m.get("metricName"),
            value=display_value,
            raw_value=raw_decimal,
            unit=m.get("unit"),
            change=m.get("changeValue"),
            change_rate=m.get("changePercent"),
            trend=_change_direction_to_trend(m.get("changeDirection")),
            status=_alert_level_to_status(m.get("alertLevel")),
            description=m.get("description"),
        ))
    return cards


def _generate_ai_insights_from_metrics(
    metrics: list[dict],
    total_sales: Decimal,
    total_profit: Decimal,
    order_count: int,
) -> list[dict]:
    """Mirror Java SalesAnalysisServiceImpl.generateAiInsightsFromMetrics line 329-351.

    Emits 1-2 INFO insights from aggregates path:
      1. ALWAYS: 销售概况 ("期间总销售额 X，共 Y 笔订单，总利润 Z")
      2. IF totalSales > 0: 利润率分析 ("综合利润率 N.N%")

    NOTE: `metrics` param unused in from-aggregates path (Java keeps it for symmetry).
    Q-2 grep RESOLVED 2026-04-30: SalesAnalysisServiceImpl.generateAiInsights
    line 998-1083 (4-branch full version) is dead code; not ported.
    """
    insights: list[dict] = []
    insights.append(_new_ai_insight_dict(
        level="INFO",
        category="销售概况",
        message=(
            f"期间总销售额 {_format_currency(total_sales)}，"
            f"共 {order_count:,d} 笔订单，"
            f"总利润 {_format_currency(total_profit)}"
        ),
    ))
    if total_sales > Decimal("0"):
        # Java line 342-343: SCALE=4 division then *100, format with %.1f.
        # Rule 10: round the fraction first, then multiply (mirror BigDecimal).
        profit_rate = (total_profit / total_sales).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP,
        ) * Decimal("100")
        insights.append(_new_ai_insight_dict(
            level="INFO",
            category="利润率分析",
            message=f"综合利润率 {_format_completion_pct(profit_rate)}",
        ))
    return insights


def _generate_suggestions_from_metrics(
    metrics: list[dict],
    total_sales: Decimal,
    total_target: Decimal,
) -> list[str]:
    """Mirror Java SalesAnalysisServiceImpl.generateSuggestionsFromMetrics line 356-365.

    Emits 1 suggestion when completionRate < 80 AND target > 0.
    Threshold "80" is hardcoded literal in Java line 361 (NOT TARGET_YELLOW=85).
    """
    suggestions: list[str] = []
    if total_target <= Decimal("0"):
        return suggestions
    completion_rate = _calculate_completion_rate(total_sales, total_target)
    if completion_rate < Decimal("80"):
        suggestions.append("目标完成率不足80%，建议加强销售推进")
    return suggestions


async def _build_legacy_rankings_dict(
    factory_id: str, start_date: date, end_date: date,
) -> dict:
    """Y-a (Q-1 RESOLVED 2026-04-30): legacy fills overview.rankings.salesperson.

    Mirror Java getSalesOverview line 158-161 + buildRankingsFromAggregates line 310-324:
      - English key "salesperson" (Java line 161)
      - top-10 truncation (Java line 321)
      - rank/name/value populated; target/completionRate/alertLevel left null

    Returns {"salesperson": [...]} even when list empty — matches Java map emit.
    """
    rows = await _query_top_salespersons_aggregate(factory_id, start_date, end_date)
    items: list[dict] = []
    for i, (name, amount, _quantity) in enumerate(rows[:10], start=1):
        if name is None:
            continue
        items.append(_new_ranking_item_dict(
            rank=i,
            name=str(name),
            value=_decimal_to_number(_to_decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        ))
    return {"salesperson": items}


async def _build_legacy_trend_chart(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[dict]:
    """Y-a: legacy fills overview.charts['销售趋势'].

    Mirror Java buildTrendChartFromAggregates line 269-285:
      - chartType="LINE", title="销售趋势" (Chinese)
      - xaxisField="date", yaxisField="amount"
      - data points: {date, amount, quantity} (3 keys; Gold has only 2)
      - options/seriesField = None
      - Returns None when query empty
    """
    rows = await _query_daily_sales_trend_aggregate(factory_id, start_date, end_date)
    if not rows:
        return None
    data = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "amount": _decimal_to_number(_to_decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "quantity": _decimal_to_number(_to_decimal(quantity).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        }
        for d, amount, quantity in rows
    ]
    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=data,
        options=None,
    )


async def _build_legacy_category_chart(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[dict]:
    """Y-a: legacy fills overview.charts['产品分布'].

    Mirror Java buildPieChartFromAggregates line 290-305:
      - chartType="PIE", title="产品分布"
      - null category → "未分类" (Java line 294)
      - Returns None when query empty
    """
    rows = await _query_category_distribution_aggregate(factory_id, start_date, end_date)
    if not rows:
        return None
    data = [
        {
            "category": str(category) if category is not None else "未分类",
            "amount": _decimal_to_number(_to_decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        }
        for category, amount in rows
    ]
    return _new_chart_config_dict(
        chart_type="PIE",
        title="产品分布",
        xaxis_field="category",
        yaxis_field="amount",
        data=data,
        options=None,
    )


# ============================================================
# Section 1.7: Generic ranking builder + 3 caller wrappers (rankings spec)
# ============================================================
# Mirrors Java SalesAnalysisServiceImpl: getSalespersonRanking (371-400) /
# getProductRanking (491-533) / getCustomerRanking (550-593).
#
# Reuses existing helpers from Section 0 (overview impl):
#   - _calculate_completion_rate (Java calculateCompletionRate line 1166-1171)
#   - _determine_completion_alert_level (Java line 1176-1184)
#   - TARGET_RED_THRESHOLD / TARGET_YELLOW_THRESHOLD / SCALE / DISPLAY_SCALE
#   - _new_ranking_item_dict (foundation factory, 6 fields)


def _build_ranking(
    name_to_value: dict,
    *,
    top_n: Optional[int] = None,
    with_percentage: bool = False,
    target_map: Optional[dict] = None,
) -> list[dict]:
    """Generic ranking builder — covers salesperson / product / customer.

    Mirrors Java's three rankings methods (sort + scale + dict construction).

    Args:
        name_to_value: aggregated {name: total_amount} dict
        top_n: if set, slice to top N after sort (customer ranking uses 10)
        with_percentage: if True, completionRate = (value / total) * 100
                         (product + customer rankings)
        target_map: if provided, completionRate = (value / target) * 100
                    AND alertLevel computed from rate (salesperson ranking)

    Returns:
        list of RankingItem-shaped dicts per foundation _new_ranking_item_dict factory.

    Sort stability:
        Composite sort key (-value, name) — value DESC, name ASC for ties.
        Spec §7: Python-side fix only. Java's HashMap grouping has nondeterministic
        tie order; we stabilize on Python side.
    """
    # 1. Sort by value DESC, name ASC (tie stability)
    sorted_items = sorted(
        name_to_value.items(),
        key=lambda kv: (-kv[1], kv[0]),
    )

    # 2. Apply top_n cap if set
    if top_n is not None:
        sorted_items = sorted_items[:top_n]

    # 3. Compute total (only if needed for percentage)
    total = sum(name_to_value.values(), Decimal("0")) if with_percentage else None

    # 4. Build dicts
    rankings: list[dict] = []
    for rank, (name, value) in enumerate(sorted_items, start=1):
        target: Optional[Decimal] = None
        completion_rate: Decimal
        alert_level: str

        if target_map is not None:
            # salesperson: per-person target → completion rate + alert level
            target = target_map.get(name, Decimal("0"))
            completion_rate = _calculate_completion_rate(value, target)
            alert_level = _determine_completion_alert_level(completion_rate)
        elif with_percentage:
            # product/customer: percentage of total, alertLevel hard-coded GREEN.
            # Rule 10: divide first (scale=4 HALF_UP), then multiply by 100 to
            # mirror Java BigDecimal.divide(scale, rounding).multiply(100).
            if total is None or total == Decimal("0"):
                completion_rate = Decimal("0")
            else:
                completion_rate = (value / total).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP,
                ) * Decimal("100")
            alert_level = "GREEN"  # Java line 528 / 588 hard-codes GREEN
        else:
            completion_rate = Decimal("0")
            alert_level = "GREEN"

        rankings.append(_new_ranking_item_dict(
            rank=rank,
            name=name,
            value=_decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            target=(_decimal_to_number(target.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
                    if target is not None else None),
            completion_rate=_decimal_to_number(completion_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            alert_level=alert_level,
        ))

    return rankings


# ============================================================
# Section 2: Strip-volatile shared helper
# ============================================================

VOLATILE_KEYS = frozenset({
    "generatedAt", "lastUpdated", "cacheExpireAt", "timestamp",
})


def _strip_volatile(obj: Any) -> Any:
    """Recursively strip timing/cache-dependent keys for byte-shape compare.

    Removes from any dict in the tree:
      - generatedAt          (LocalDateTime.now() per request)
      - lastUpdated          (DashboardResponse @Deprecated, also volatile)
      - cacheExpireAt        (cache TTL)
      - timestamp            (envelope-level)

    Preserves all other keys + list/primitive values.
    """
    if isinstance(obj, dict):
        return {
            k: _strip_volatile(v)
            for k, v in obj.items()
            if k not in VOLATILE_KEYS
        }
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj

# ============================================================
# Section 3: Sub-service stubs (5 of them)
# ============================================================
# Sibling specs replace bodies; foundation provides F999 empty-state shape
# so F999 contract test passes after foundation merge.


def _utc_now_iso() -> str:
    """Generate ISO timestamp for generatedAt / lastUpdated fields.

    Stripped by `_strip_volatile` before byte compare. Uses `_java_isoformat`
    to match Java Jackson `LocalDateTime` shape (Rule 11) — keeps the
    serializer consistent with the rest of the alias surface.
    """
    return _java_isoformat(datetime.now(timezone.utc).replace(tzinfo=None))


# ============================================================
# Section 3a: Gold-path module-level seams (monkeypatch boundary)
# ============================================================


async def _call_finance_summary(pool, factory_id: str, date_range, *, top_n_stores: int = 10):
    """Module-level seam wrapping smartbi.gold.queries.finance_summary.

    Indirection exists so contract tests can monkey-patch at this module's
    namespace without monkey-patching the queries module globally.
    """
    from smartbi.gold.queries import finance_summary
    return await finance_summary(pool, factory_id, date_range, top_n_stores=top_n_stores)


async def _call_daily_trend(pool, factory_id: str, date_range):
    """Module-level seam wrapping smartbi.gold.queries.daily_trend."""
    from smartbi.gold.queries import daily_trend
    return await daily_trend(pool, factory_id, date_range)


async def _call_top_products(pool, factory_id: str, date_range, *, top_n: int = 8):
    """Module-level seam wrapping smartbi.gold.queries.top_products.

    Note: spec said limit=8 but Python kwarg is `top_n` (verified A.1 step 2).
    Default top_n=8 here matches Java GoldDashboardBuilder.fetchCategoryChart.
    """
    from smartbi.gold.queries import top_products
    return await top_products(pool, factory_id, date_range, top_n=top_n)


# ============================================================
# Section 3b: Gold-path adapter functions (mirror Java GoldDashboardBuilder)
# ============================================================


async def _build_from_gold_finance_summary(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.buildFromFinanceSummary (lines 58-117).

    Builds the base DashboardResponse shape from Gold's finance_summary:
      - 4 KPI cards (total_revenue / bill_count / avg_bill_value / store_count)
      - top_stores ranking (rank+name+value only)
      - charts={} (populated by _build_from_gold_with_charts wrapper)
      - aiInsights=[] / suggestions=[] (Java line 113-114)

    Returns None when both revenue and bill_count are 0 (legacy fallback signal).
    """
    gold = await _call_finance_summary(
        pool, factory_id, (range_.start_date, range_.end_date), top_n_stores=10,
    )
    revenue = _to_decimal(gold.get("total_revenue"))
    bills = _to_decimal(gold.get("bill_count"))
    avg_bill = _to_decimal(gold.get("avg_bill_value"))
    stores = _to_decimal(gold.get("store_count"))

    if revenue == Decimal("0") and bills == Decimal("0"):
        logger.info(
            "[gold-builder] factory=%s range=%s..%s empty Gold -> None (legacy fallback)",
            factory_id, range_.start_date, range_.end_date,
        )
        return None

    kpi_cards = [
        _new_kpi_card_dict(
            key="total_revenue", title="总营收",
            value=_format_kpi_value(revenue, "元"), raw_value=_decimal_to_number(revenue),
            unit="元", status="green",
        ),
        _new_kpi_card_dict(
            key="bill_count", title="账单数",
            value=_format_kpi_value(bills, "单"), raw_value=_decimal_to_number(bills),
            unit="单", status="green",
        ),
        _new_kpi_card_dict(
            key="avg_bill_value", title="客单价",
            value=_format_kpi_value(avg_bill, "元"), raw_value=_decimal_to_number(avg_bill),
            unit="元", status="green",
        ),
        _new_kpi_card_dict(
            key="store_count", title="门店数",
            value=_format_kpi_value(stores, "家"), raw_value=_decimal_to_number(stores),
            unit="家", status="green",
        ),
    ]

    top_stores = []
    for i, store in enumerate(gold.get("top_stores", []), start=1):
        top_stores.append(_new_ranking_item_dict(
            rank=i,
            name=str(store.get("store_name", "")),
            value=_decimal_to_number(_to_decimal(store.get("revenue"))),
            target=None,
            completion_rate=None,
            alert_level=None,
        ))

    return _new_dashboard_response_dict(
        kpi_cards=kpi_cards,
        rankings={"top_stores": top_stores},
        charts={},
        ai_insights=[],
        suggestions=[],
        last_updated=_utc_now_iso(),
    )


async def _fetch_gold_trend_chart(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.fetchTrendChart (lines 160-191).

    Builds LINE ChartConfig from daily_trend response.
    Returns None on empty points OR query failure (logs warning).
    options=None on Gold path (Java doesn't set it; foundation stub default differs).
    """
    try:
        gold = await _call_daily_trend(pool, factory_id, (range_.start_date, range_.end_date))
    except Exception as e:
        logger.warning(
            "[gold-builder] trend fetch failed factory=%s range=%s..%s: %s",
            factory_id, range_.start_date, range_.end_date, e,
        )
        return None

    points = gold.get("points") or []
    if not points:
        return None

    data = [
        {"date": p["date"], "amount": _decimal_to_number(_to_decimal(p.get("revenue")))}
        for p in points
    ]

    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=data,
        options=None,
    )


async def _fetch_gold_category_chart(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.fetchCategoryChart (lines 193-227).

    Builds PIE ChartConfig from top_products response (top_n=8 by default).
    Maps {name -> category, revenue -> amount}.
    Returns None on empty top_products OR query failure (logs warning).
    """
    try:
        gold = await _call_top_products(
            pool, factory_id, (range_.start_date, range_.end_date), top_n=8,
        )
    except Exception as e:
        logger.warning(
            "[gold-builder] category fetch failed factory=%s range=%s..%s: %s",
            factory_id, range_.start_date, range_.end_date, e,
        )
        return None

    products = gold.get("top_products") or []
    if not products:
        return None

    data = [
        {"category": str(p.get("name", "")), "amount": _decimal_to_number(_to_decimal(p.get("revenue")))}
        for p in products
    ]

    return _new_chart_config_dict(
        chart_type="PIE",
        title="产品类别占比",
        xaxis_field="category",
        yaxis_field="amount",
        data=data,
        options=None,
    )


async def _build_from_gold_with_charts(
    factory_id: str, range_: DateRange, pool=None,
) -> Optional[dict]:
    """Mirror Java GoldDashboardBuilder.buildFromGoldWithCharts (lines 135-158).

    Wraps _build_from_gold_finance_summary with chart enrichment.
    Returns None when base is None (empty Gold -> legacy fallback).
    Tolerates individual chart fetch failures (each chart is independent).
    """
    base = await _build_from_gold_finance_summary(factory_id, range_, pool=pool)
    if base is None:
        return None

    trend_chart = await _fetch_gold_trend_chart(factory_id, range_, pool=pool)
    category_chart = await _fetch_gold_category_chart(factory_id, range_, pool=pool)

    charts = {}
    if trend_chart is not None:
        charts["sales_trend"] = trend_chart
    if category_chart is not None:
        charts["category_distribution"] = category_chart

    base["charts"] = charts
    return base


def _build_empty_dashboard() -> dict:
    """Mirror Java SalesAnalysisServiceImpl.buildEmptyDashboard line 1145-1159.

    Used by:
      - F999 path (legacy SQL returns 0 rows or all-zero aggregate)
      - Gold-empty fallback (gold spec already returns this shape via _get_sales_overview)
      - any branch where total_sales=0 AND order_count=0 (Java line 131)
    """
    return _new_dashboard_response_dict(
        ai_insights=[
            _new_ai_insight_dict(
                level="YELLOW",
                category="数据状态",
                message="当前时间范围内暂无销售数据",
                action_suggestion="请上传销售数据或调整时间范围",
            ),
        ],
        suggestions=["请先上传销售数据以开始分析"],
        last_updated=_utc_now_iso(),
    )


async def _build_legacy_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Real legacy impl — mirrors Java SalesAnalysisServiceImpl.getSalesOverview
    line 114-175.

    Triggered by _get_sales_overview only when Gold path raises an exception
    (mirrors Java line 108-111). When Gold returns None (Silver empty),
    _get_sales_overview emits _build_empty_dashboard directly without calling
    this legacy path — same as Java line 105-107.
    Order of operations:
      1. Aggregate query (_query_sales_aggregates) — 6-tuple
      2. Empty checks → _build_empty_dashboard (Java line 120-122 + 131-134)
      3. _build_kpi_cards_from_aggregates (4-5 KPIs + previous-period query for MoM)
      4. _convert_metric_results_to_kpi_cards (alertLevel→status mapping)
      5. Y-a (Q-1 RESOLVED 2026-04-30): nested rankings + charts via SQL aggregates
         (mirror Java line 142-156 — front-end web-admin SalesAnalysis.vue:720
         reads `overview?.rankings || data.rankings` so nested fill is required
         for legacy non-empty UI to display)
      6. _generate_ai_insights_from_metrics (B: 2-INFO only; full 4-branch is
         dead code per Q-2 grep RESOLVED 2026-04-30)
      7. _generate_suggestions_from_metrics (1 conditional suggestion)
    """
    # Q-2 grep 2026-04-30: SalesAnalysisServiceImpl.generateAiInsights line 998-1083
    # is dead code (0 callers + parameter signature mismatch with aggregates path);
    # not ported. If Java wires it up later, port then.

    aggregates = await _query_sales_aggregates(factory_id, range_.start_date, range_.end_date)
    if aggregates is None or len(aggregates) < 6:
        logger.warning(
            "[legacy] aggregates empty factory=%s range=%s..%s",
            factory_id, range_.start_date, range_.end_date,
        )
        return _build_empty_dashboard()

    total_sales, total_quantity, total_profit, total_cost, total_target, order_count = aggregates
    total_sales = _to_decimal(total_sales)
    total_quantity = _to_decimal(total_quantity)
    total_profit = _to_decimal(total_profit)
    total_cost = _to_decimal(total_cost)
    total_target = _to_decimal(total_target)
    order_count = int(order_count) if order_count is not None else 0

    if total_sales == Decimal("0") and order_count == 0:
        logger.warning(
            "[legacy] zero sales+orders factory=%s range=%s..%s",
            factory_id, range_.start_date, range_.end_date,
        )
        return _build_empty_dashboard()

    metric_results = await _build_kpi_cards_from_aggregates(
        factory_id=factory_id,
        start_date=range_.start_date, end_date=range_.end_date,
        total_sales=total_sales, total_quantity=total_quantity,
        total_profit=total_profit, total_cost=total_cost,
        total_target=total_target, order_count=order_count,
    )
    kpi_cards = _convert_metric_results_to_kpi_cards(metric_results)

    # Y-a (Q-1 RESOLVED 2026-04-30): fill nested rankings + charts
    rankings_dict = await _build_legacy_rankings_dict(
        factory_id, range_.start_date, range_.end_date,
    )
    charts_dict: dict = {}
    trend_chart = await _build_legacy_trend_chart(
        factory_id, range_.start_date, range_.end_date,
    )
    if trend_chart is not None:
        charts_dict["销售趋势"] = trend_chart
    category_chart = await _build_legacy_category_chart(
        factory_id, range_.start_date, range_.end_date,
    )
    if category_chart is not None:
        charts_dict["产品分布"] = category_chart

    ai_insights = _generate_ai_insights_from_metrics(
        metrics=metric_results,
        total_sales=total_sales, total_profit=total_profit,
        order_count=order_count,
    )
    suggestions = _generate_suggestions_from_metrics(
        metrics=metric_results,
        total_sales=total_sales, total_target=total_target,
    )

    return _new_dashboard_response_dict(
        kpi_cards=kpi_cards,
        charts=charts_dict,
        rankings=rankings_dict,
        ai_insights=ai_insights,
        suggestions=suggestions,
        last_updated=_utc_now_iso(),
    )


async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Flag-gated 3-state dispatch mirroring Java SalesAnalysisServiceImpl.getSalesOverview.

    Java reference: SalesAnalysisServiceImpl line 80-112 (called by
    SmartBIServiceImpl.getComprehensiveAnalysis line 568-616). Mirrors the
    same 3-state branching baked into _get_finance_overview by PR #131/#135:

      - Flag false (default) → STRAIGHT to legacy (Java line 87 `if` skipped).
      - Flag true + Gold non-null → return Gold response (Java line 96-99).
      - Flag true + Gold null (revenue=0 AND bills=0 in Silver) →
        _build_empty_dashboard, SKIP legacy. Mirrors Java line 105-107.
        Authoritative under Gold-primary flag — avoids slow ~50s legacy scan
        on empty ranges (Bug #417, Phase B4 cutover 2026-04-22).
      - Flag true + Gold raises (incl. pool acquisition failure) → fall
        through to legacy. Mirrors Java line 108-111 catch (Exception e).

    Why the flag matters: when Java prod has flag=false (the current default),
    Java emits ~5-7 KB legacy populated DashboardResponse. If Python ignored
    the flag and always tried Gold, byte-shape parity would diverge for
    factories with populated Gold POS data (e.g. F001 — see memory
    project_2026_05_07_t6_1_dryrun_in_flight.md). Flag gating restores parity.

    Audit reference: PR #146 K-1 finding (Pattern B sister-endpoint scan).
    """
    flag_raw = os.environ.get("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")
    gold_primary_enabled = flag_raw.strip().lower() == "true"

    if gold_primary_enabled:
        try:
            from smartbi.config import get_pg_pool  # type: ignore
            pool = await get_pg_pool()
            gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
            if gold_dashboard is not None:
                logger.info(
                    "[gold-primary] sales factory=%s served from Gold",
                    factory_id,
                )
                return gold_dashboard
            # Gold returned None → Silver empty for this factory/range.
            # Mirror Java line 105-107: skip legacy and return empty.
            logger.info(
                "[gold-primary] sales factory=%s Gold empty — skipping legacy",
                factory_id,
            )
            return _build_empty_dashboard()
        except Exception as e:
            logger.warning(
                "[gold-primary] sales factory=%s failed, falling back to legacy: %s",
                factory_id, e,
            )

    return await _build_legacy_sales_overview(factory_id, range_)


async def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getSalespersonRanking line 371-400.

    Aggregates SUM(amount) + SUM(monthly_target) per salesperson_name from raw rows,
    then dispatches to _build_ranking with target_map for completion/alert.
    Filters null salesperson_name (Java line 379: `if (name == null) continue;`).

    No top_n cap (Java doesn't limit).

    async per foundation §5: sync SQLAlchemy `_query_sales_data` wrapped via
    `await asyncio.to_thread(...)` per foundation Phase B.6 strategy.
    """
    rows = await _to_thread(_query_sales_data, factory_id, range_)
    sales: dict = {}
    targets: dict = {}
    for row in rows:
        name = row.salesperson_name
        if name is None:
            continue
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        target = _to_decimal(row.monthly_target) if row.monthly_target is not None else Decimal("0")
        sales[name] = sales.get(name, Decimal("0")) + amount
        targets[name] = targets.get(name, Decimal("0")) + target
    return _build_ranking(sales, target_map=targets)


async def _get_product_ranking(factory_id: str, range_: DateRange) -> list:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getProductRanking line 491-533.

    Aggregates SUM(amount) per product_category. completionRate = % of total.
    alertLevel hard-coded GREEN (Java line 528).
    Filters null product_category (Java line 499: `getProductCategory() != null`).
    No top_n cap.
    """
    rows = await _to_thread(_query_sales_data, factory_id, range_)
    sales: dict = {}
    for row in rows:
        category = row.product_category
        if category is None:
            continue
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        sales[category] = sales.get(category, Decimal("0")) + amount
    return _build_ranking(sales, with_percentage=True)


async def _get_customer_ranking(factory_id: str, range_: DateRange) -> list:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getCustomerRanking line 550-593.

    Aggregates SUM(amount) per customer_name. completionRate = % of total.
    alertLevel hard-coded GREEN (Java line 588).
    Filters null customer_name. Top 10 cap (Java line 574 `.limit(10)`).
    """
    rows = await _to_thread(_query_sales_data, factory_id, range_)
    sales: dict = {}
    for row in rows:
        name = row.customer_name
        if name is None:
            continue
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        sales[name] = sales.get(name, Decimal("0")) + amount
    return _build_ranking(sales, with_percentage=True, top_n=10)


# ============================================================
# Section 3c: Trend bucketing helpers (trend sub-spec)
# ============================================================
# Mirror Java SalesAnalysisServiceImpl.aggregateByDay line 911-921.
# DAY-only port per trend spec §5; WEEK/MONTH/YEAR raise NotImplementedError.


def _format_bucket_key(d, period: str) -> str:
    """Format a date into a bucket key string.

    Mirror Java aggregateByDay line 915: `d.getOrderDate().toString()` produces
    ISO YYYY-MM-DD. Java aggregateByWeek line 932-933 / aggregateByMonth line
    949-950 not ported per spec §5.

    Args:
        d: datetime.date OR date-like string (SQLAlchemy may return either)
        period: "DAY" only; case-insensitive

    Returns:
        ISO date string (e.g. "2025-03-15")

    Raises:
        NotImplementedError: for any period other than DAY
    """
    if period.upper() != "DAY":
        raise NotImplementedError(
            f"trend chart period='{period}' not supported; only DAY is "
            f"used by /analysis/sales composite. See spec §5."
        )
    # Defensive: SQLAlchemy Row.order_date may be datetime.date or string
    if hasattr(d, "isoformat"):
        return d.isoformat()
    return str(d)


def _bucket_sales_by_period(rows, period: str) -> dict:
    """Aggregate sales rows into buckets by period.

    Mirror Java SalesAnalysisServiceImpl.aggregateByDay line 911-921:
    - Filter rows where `order_date IS NULL` (Java line 913)
    - Group by formatted bucket key (e.g. ISO date string for DAY)
    - Sum amounts per bucket
    - Return TreeMap-equivalent: dict sorted ASC by key

    Args:
        rows: iterable of Row-like objects with `order_date` and `amount` attrs
        period: "DAY" only (delegates raise to _format_bucket_key)

    Returns:
        dict[bucket_key, Decimal] sorted ASC by key. Empty dict for empty input
        or all-null input.
    """
    unsorted: dict = {}
    for row in rows:
        if row.order_date is None:
            continue  # Java line 913 filter
        key = _format_bucket_key(row.order_date, period)
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        unsorted[key] = unsorted.get(key, Decimal("0")) + amount
    # Sort ASC by key (Python ≥3.7 preserves dict insertion order)
    return dict(sorted(unsorted.items()))


async def _get_sales_trend_chart(
    factory_id: str, range_: DateRange, period: str = "DAY",
) -> dict:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getSalesTrendChart line 597-607
    + buildSalesTrendChartFromData line 868-906.

    DAY-only port per trend spec §5; raise BEFORE query for unsupported periods
    (fail fast — no wasted DB call).

    async per foundation §5: sync `_query_sales_data` wrapped via `await asyncio.to_thread(...)`.
    """
    # Fail fast: raise before query for unsupported periods
    if period.upper() != "DAY":
        raise NotImplementedError(
            f"trend chart period='{period}' not supported; only DAY is "
            f"used by /analysis/sales composite. See spec §5."
        )

    rows = await _to_thread(_query_sales_data, factory_id, range_)
    period_sales = _bucket_sales_by_period(rows, period)

    data_points = [
        {
            "date": key,
            "amount": _decimal_to_number(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        }
        for key, amount in period_sales.items()
    ]

    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=data_points,
        options={"showDataLabels": False, "smooth": True},
    )


# ============================================================
# Section 4: Composite assembly + route
# ============================================================


async def _get_comprehensive_sales_analysis(
    factory_id: str, range_: DateRange,
) -> dict:
    """Java reference: SmartBIServiceImpl.getComprehensiveAnalysis sales
    branch (line 568-616).

    Returns 7-key composite Map. Key order matches F999/F001 golden
    (Jackson serialization of Java HashMap), NOT Java result.put() order.

    Java puts in this order (lines 578-584 + 612-613):
      overview / salespersonRanking / productRanking / customerRanking /
      trendChart / dateRange / generatedAt

    Jackson observed (F999 golden):
      overview / customerRanking / productRanking / dateRange /
      salespersonRanking / generatedAt / trendChart

    The Jackson order is what we mirror.
    """
    return {
        "overview": await _get_sales_overview(factory_id, range_),
        "customerRanking": await _get_customer_ranking(factory_id, range_),
        "productRanking": await _get_product_ranking(factory_id, range_),
        "dateRange":          _new_date_range_dict(range_),
        "salespersonRanking": await _get_salesperson_ranking(factory_id, range_),
        "generatedAt":        _utc_now_iso(),
        "trendChart": await _get_sales_trend_chart(factory_id, range_, "DAY"),
    }


# ============================================================
# Section 4: Phase IIa Restaurant Branch (2026-05-14)
# ============================================================
#
# Polymorphic tenant dispatch mirroring analysis_production.py:480-506.
# Triggered when cretas_db.factories.type ∈ {RESTAURANT, BRANCH}.
# Spec: docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md §4.2
#
# RLS: relies on auth_middleware.py:220 set_factory_id() → pool setup hook
# writes app.factory_id. WHERE factory_id = $1 is belt-and-suspenders.
# smartbi_user role does NOT have BYPASSRLS (verified 2026-05-14 against
# smartbi_prod_db). Without auth_middleware's tenant_ctx propagation queries
# would return zero rows for restaurant factory_ids.

INVALID_DATE_RANGE_MESSAGE = "开始日期不能晚于结束日期"


def _validate_restaurant_date_range(start_date: date, end_date: date) -> None:
    """Spec §4.5 edge case 4: start > end → HTTP 400 INVALID_DATE_RANGE.

    Rule 6 precondition: refuse to query on missing/inverted dates rather than
    swallow as zero-row response. asyncpg silently turns ``None → NULL`` and
    ``BETWEEN NULL AND NULL`` returns 0 rows — callers would see "no data"
    when the real bug is a null parameter.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_validate_restaurant_date_range: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_DATE_RANGE",
                "message": INVALID_DATE_RANGE_MESSAGE,
            },
        )


async def _get_restaurant_overview(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Spec §4.2 overview: totalRevenue, billCount, avgPerCapita, storeCount.

    Source: ``agg_daily`` SUM(actual_receive / bill_count / customer_count)
    plus DISTINCT store_id count.

    Edge cases:
    * 1 (zero bills): totalRevenue 0, billCount 0, storeCount 0 — natural
    * 2 (bills > 0 but customers == 0): avgPerCapita is ``None`` (NOT 0.0)
      per Rule 1 — null is honest about missing data, 0.0 reads as "free meal".
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_restaurant_overview: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    row = await conn.fetchrow(
        """
        SELECT
            COALESCE(SUM(actual_receive), 0)::numeric(18,2) AS total_revenue,
            COALESCE(SUM(bill_count), 0)                    AS bill_count,
            COALESCE(SUM(customer_count), 0)                AS customer_count,
            COUNT(DISTINCT store_id)                        AS store_count
        FROM agg_daily
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
        """,
        factory_id, start_date, end_date,
    )
    total_revenue = Decimal(row["total_revenue"])
    bill_count = int(row["bill_count"])
    customer_count = int(row["customer_count"])
    if customer_count > 0:
        avg = (total_revenue / Decimal(customer_count)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        avg_per_capita = _decimal_to_number(avg)
    else:
        avg_per_capita = None
    return {
        "totalRevenue": _decimal_to_number(
            total_revenue.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        ),
        "billCount": bill_count,
        "avgPerCapita": avg_per_capita,
        "storeCount": int(row["store_count"]),
        "dataSource": "agg_daily",
    }


async def _get_restaurant_revenue_trend(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Spec §4.2 revenueTrend: BAR chart 堂食/外卖 stacked from ``agg_daily_order_type_meal``.

    xAxis = sorted dates that appear in the range; dates with only one
    order_type get 0.0 for the missing one (stacked-bar consumers expect
    aligned arrays). Series prefer 堂食 → 外卖 order then alphabetical others.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_restaurant_revenue_trend: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    rows = await conn.fetch(
        """
        SELECT date,
               order_type,
               COALESCE(SUM(actual_receive), 0)::numeric(18,2) AS amount
        FROM agg_daily_order_type_meal
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
        GROUP BY date, order_type
        ORDER BY date
        """,
        factory_id, start_date, end_date,
    )
    by_date: dict = {}
    order_types_seen: set = set()
    for r in rows:
        d = r["date"]
        ot = r["order_type"] or "未分类"
        by_date.setdefault(d, {})[ot] = Decimal(r["amount"])
        order_types_seen.add(ot)
    x_axis = sorted(by_date.keys())
    order_type_order = []
    if "堂食" in order_types_seen:
        order_type_order.append("堂食")
    if "外卖" in order_types_seen:
        order_type_order.append("外卖")
    for ot in sorted(order_types_seen):
        if ot not in order_type_order:
            order_type_order.append(ot)
    series = []
    for ot in order_type_order:
        data = []
        for d in x_axis:
            v = by_date.get(d, {}).get(ot, Decimal("0"))
            data.append(_decimal_to_number(
                v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            ))
        series.append({"name": ot, "data": data})
    return {
        "chartType": "BAR",
        "title": "日营收趋势",
        "xAxis": [d.isoformat() for d in x_axis],
        "series": series,
    }


async def _get_restaurant_order_type_split(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Spec §4.2 orderTypeSplit: PIE 堂食/外卖 percentage share.

    Rule 10: divide(SCALE 4) → multiply(100) → final scale 2 — mirrors
    Java ``BigDecimal.divide(divisor, 4, HALF_UP).multiply(100).setScale(2, HALF_UP)``.
    Edge case 1: total amount 0 → empty series (frontend renders empty state).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_restaurant_order_type_split: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    rows = await conn.fetch(
        """
        SELECT order_type,
               COALESCE(SUM(actual_receive), 0)::numeric(18,2) AS amount
        FROM agg_daily_order_type_meal
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
        GROUP BY order_type
        """,
        factory_id, start_date, end_date,
    )
    amounts = {
        (r["order_type"] or "未分类"): Decimal(r["amount"]) for r in rows
    }
    total = sum(amounts.values(), Decimal("0"))
    series = []
    if total > 0:
        ordered_keys = []
        if "堂食" in amounts:
            ordered_keys.append("堂食")
        if "外卖" in amounts:
            ordered_keys.append("外卖")
        for k in sorted(amounts.keys()):
            if k not in ordered_keys:
                ordered_keys.append(k)
        for k in ordered_keys:
            share_q4 = (amounts[k] / total).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            share_pct = (share_q4 * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            series.append({"name": k, "value": _decimal_to_number(share_pct)})
    return {
        "chartType": "PIE",
        "title": "堂食/外卖占比",
        "series": series,
    }


async def _get_restaurant_meal_period_breakdown(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Spec §4.2 mealPeriodBreakdown: BAR 早/午/晚/夜市 absolute revenue.

    Order: 早市 → 午市 → 晚市 → 夜市 then any other label alphabetically.
    Edge case 1: empty rows → empty series.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_restaurant_meal_period_breakdown: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    rows = await conn.fetch(
        """
        SELECT meal_period,
               COALESCE(SUM(actual_receive), 0)::numeric(18,2) AS amount
        FROM agg_daily_order_type_meal
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
        GROUP BY meal_period
        """,
        factory_id, start_date, end_date,
    )
    period_amounts = {
        (r["meal_period"] or "未分类"): Decimal(r["amount"]) for r in rows
    }
    preferred_order = ["早市", "午市", "晚市", "夜市"]
    ordered_keys = [p for p in preferred_order if p in period_amounts]
    for k in sorted(period_amounts.keys()):
        if k not in ordered_keys:
            ordered_keys.append(k)
    series = [
        {
            "name": k,
            "value": _decimal_to_number(
                period_amounts[k].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            ),
        }
        for k in ordered_keys
    ]
    return {
        "chartType": "BAR",
        "title": "时段营收分布",
        "series": series,
    }


async def _get_restaurant_product_ranking(
    factory_id: str, start_date: date, end_date: date, conn
) -> list:
    """Spec §4.2 productRanking: top 20 dishes by revenue from ``agg_product``.

    ``agg_product.month`` is first-of-month; we bucket months whose first-of-
    month falls in ``[start.replace(day=1), end.replace(day=1)]`` inclusive
    (mirrors ``smartbi/gold/queries.py::top_products`` 2026-04 convention).

    Edge case 3: deleted dish — LEFT JOIN ``dim_product`` and COALESCE name
    to ``'(已下架菜品 #<id>)'`` so the row survives with revenue/qty intact.
    Index: ``idx_agg_product_factory_month_revenue (factory_id, month, revenue DESC)``
    backs the ``ORDER BY SUM(revenue) DESC LIMIT 20`` cheaply.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_restaurant_product_ranking: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    start_m = start_date.replace(day=1)
    end_m = end_date.replace(day=1)
    rows = await conn.fetch(
        """
        SELECT
            a.product_id,
            COALESCE(p.name, '(已下架菜品 #' || a.product_id || ')') AS name,
            SUM(a.revenue)::numeric(18,2)  AS revenue,
            SUM(a.qty_sold)::numeric(18,3) AS qty_sold
        FROM agg_product a
        LEFT JOIN dim_product p
               ON p.product_id = a.product_id
              AND p.factory_id = a.factory_id
        WHERE a.factory_id = $1
          AND a.month BETWEEN $2 AND $3
        GROUP BY a.product_id, p.name
        ORDER BY SUM(a.revenue) DESC NULLS LAST
        LIMIT 20
        """,
        factory_id, start_m, end_m,
    )
    result = []
    for idx, r in enumerate(rows):
        revenue = Decimal(r["revenue"] if r["revenue"] is not None else 0)
        qty = Decimal(r["qty_sold"] if r["qty_sold"] is not None else 0)
        result.append({
            "rank": idx + 1,
            "name": r["name"],
            "revenue": _decimal_to_number(
                revenue.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            ),
            "qtySold": _decimal_to_number(
                qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
            ),
        })
    return result


async def _get_restaurant_channel_breakdown(
    factory_id: str, start_date: date, end_date: date, conn
) -> list:
    """Spec §4.2 channelBreakdown: payment channels from ``agg_channel`` joined
    to ``dim_payment_channel.name``.

    Edge case 1: zero rows → ``[]`` (NOT null; frontend v-for iterates).
    Rule 10: share computed via divide(SCALE 4) → multiply(100) → scale 2.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_restaurant_channel_breakdown: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    rows = await conn.fetch(
        """
        SELECT
            COALESCE(c.name, '(未知渠道 #' || a.channel_id || ')') AS name,
            SUM(a.amount)::numeric(18,2) AS amount,
            SUM(a.bill_count)            AS bill_count
        FROM agg_channel a
        LEFT JOIN dim_payment_channel c
               ON c.channel_id = a.channel_id
              AND c.factory_id = a.factory_id
        WHERE a.factory_id = $1
          AND a.date BETWEEN $2 AND $3
        GROUP BY a.channel_id, c.name
        ORDER BY SUM(a.amount) DESC NULLS LAST
        """,
        factory_id, start_date, end_date,
    )
    total = sum(
        (Decimal(r["amount"] if r["amount"] is not None else 0) for r in rows),
        Decimal("0"),
    )
    result = []
    for r in rows:
        amount = Decimal(r["amount"] if r["amount"] is not None else 0)
        if total > 0:
            share_q4 = (amount / total).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            share_pct = (share_q4 * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            share_val = _decimal_to_number(share_pct)
        else:
            share_val = _decimal_to_number(Decimal("0"))
        result.append({
            "channelName": r["name"],
            "amount": _decimal_to_number(
                amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            ),
            "billCount": int(r["bill_count"]) if r["bill_count"] is not None else 0,
            "share": share_val,
        })
    return result


async def _get_restaurant_avg_per_capita_trend(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Spec §4.2 avgPerCapitaTrend: LINE chart of daily 客单价.

    Daily value = SUM(actual_receive) / SUM(customer_count) when customer_count > 0
    else ``None`` (Rule 1 / spec §4.5 edge case 2 semantics applied per day).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            "_get_restaurant_avg_per_capita_trend: start_date/end_date required "
            f"(got start_date={start_date}, end_date={end_date})"
        )
    rows = await conn.fetch(
        """
        SELECT date,
               COALESCE(SUM(actual_receive), 0)::numeric(18,2) AS revenue,
               COALESCE(SUM(customer_count), 0)                AS customer_count
        FROM agg_daily
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
        GROUP BY date
        ORDER BY date
        """,
        factory_id, start_date, end_date,
    )
    x_axis = []
    data = []
    for r in rows:
        x_axis.append(r["date"].isoformat())
        cust = int(r["customer_count"])
        if cust > 0:
            avg = (Decimal(r["revenue"]) / Decimal(cust)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            data.append(_decimal_to_number(avg))
        else:
            data.append(None)
    return {
        "chartType": "LINE",
        "title": "客单价趋势",
        "xAxis": x_axis,
        "series": [{"name": "客单价", "data": data}],
    }


async def _get_restaurant_coverage_warning(
    factory_id: str, start_date: date, conn
) -> Optional[str]:
    """Spec §4.5 edge case 6: requested start_date before agg_daily coverage
    start → emit ``"数据起始 YYYY-MM-DD"`` warning string.

    Returns ``None`` when start_date is at-or-after tenant's earliest Gold row.
    """
    if start_date is None:
        raise ValueError(
            "_get_restaurant_coverage_warning: start_date required "
            f"(got start_date={start_date})"
        )
    row = await conn.fetchrow(
        "SELECT MIN(date) AS min_date FROM agg_daily WHERE factory_id = $1",
        factory_id,
    )
    if row is None or row["min_date"] is None:
        return None
    min_date = row["min_date"]
    if start_date < min_date:
        return f"数据起始 {min_date.isoformat()}"
    return None


def _empty_restaurant_sales_envelope(start_date: date, end_date: date) -> dict:
    """Defensive empty envelope returned when the SmartBI pool is unavailable.

    All scalars 0, all collections empty — frontend renders the same empty
    state as a real zero-bill response (spec §4.5 edge case 1). The wrap
    happens at the caller (``_restaurant_sales_dispatch``).
    """
    return {
        "tenantType": "RESTAURANT",
        "dateRange": {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "days": (end_date - start_date).days + 1,
        },
        "overview": {
            "totalRevenue": 0,
            "billCount": 0,
            "avgPerCapita": None,
            "storeCount": 0,
            "dataSource": "agg_daily",
        },
        "revenueTrend": {
            "chartType": "BAR", "title": "日营收趋势",
            "xAxis": [], "series": [],
        },
        "orderTypeSplit": {
            "chartType": "PIE", "title": "堂食/外卖占比", "series": [],
        },
        "mealPeriodBreakdown": {
            "chartType": "BAR", "title": "时段营收分布", "series": [],
        },
        "productRanking": [],
        "channelBreakdown": [],
        "avgPerCapitaTrend": {
            "chartType": "LINE", "title": "客单价趋势",
            "xAxis": [], "series": [{"name": "客单价", "data": []}],
        },
        "generatedAt": _java_isoformat(datetime.now()),
    }


async def _restaurant_sales_dispatch(
    factory_id: str,
    start_date: date,
    end_date: date,
    analysis_type: Optional[str],
) -> dict:
    """Phase IIa restaurant ``/analysis/sales`` dispatcher (spec §4.2).

    Returns ``wrap_response()``-wrapped envelope. ``analysis_type`` accepted
    for signature symmetry with the factory branch but ignored — restaurants
    have a single sales view (Phase IIb may add ``costops``).

    Edge cases handled:
    * 1 (zero bills): each helper returns empty arrays / 0 scalars
    * 2 (customer_count == 0 but bill_count > 0): overview.avgPerCapita is None
    * 3 (deleted dish): productRanking COALESCE fallback name
    * 4 (start > end): ``_validate_restaurant_date_range`` → HTTP 400
    * 5 (single day): natural, xAxis has 1 element
    * 6 (range > coverage): ``dateRange.coverageWarning`` emitted
    """
    _validate_restaurant_date_range(start_date, end_date)
    days = (end_date - start_date).days + 1

    pool = None
    try:
        from smartbi.config import get_pg_pool  # type: ignore
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning(
            "[analysis_sales restaurant] smartbi pool acquisition failed factory=%s: %s",
            factory_id, e,
        )

    if pool is None:
        return wrap_response(_empty_restaurant_sales_envelope(start_date, end_date))

    async with pool.acquire() as conn:
        overview = await _get_restaurant_overview(
            factory_id, start_date, end_date, conn
        )
        revenue_trend = await _get_restaurant_revenue_trend(
            factory_id, start_date, end_date, conn
        )
        order_type_split = await _get_restaurant_order_type_split(
            factory_id, start_date, end_date, conn
        )
        meal_period_breakdown = await _get_restaurant_meal_period_breakdown(
            factory_id, start_date, end_date, conn
        )
        product_ranking = await _get_restaurant_product_ranking(
            factory_id, start_date, end_date, conn
        )
        channel_breakdown = await _get_restaurant_channel_breakdown(
            factory_id, start_date, end_date, conn
        )
        avg_trend = await _get_restaurant_avg_per_capita_trend(
            factory_id, start_date, end_date, conn
        )
        coverage_warning = await _get_restaurant_coverage_warning(
            factory_id, start_date, conn
        )

    date_range: dict = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "days": days,
    }
    if coverage_warning is not None:
        date_range["coverageWarning"] = coverage_warning

    return wrap_response({
        "tenantType": "RESTAURANT",
        "dateRange": date_range,
        "overview": overview,
        "revenueTrend": revenue_trend,
        "orderTypeSplit": order_type_split,
        "mealPeriodBreakdown": meal_period_breakdown,
        "productRanking": product_ranking,
        "channelBreakdown": channel_breakdown,
        "avgPerCapitaTrend": avg_trend,
        "generatedAt": _java_isoformat(datetime.now()),
    })


# ============================================================
# Section 5: Route handler (Task D.3 + Phase IIa tenant dispatch)
# ============================================================

@router.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
async def get_sales_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    department: Optional[str] = None,
    dimension: Optional[str] = None,
    auth: AuthContext = Depends(require_analytics_read),
) -> dict:
    """Java reference: SmartBIAnalysisController.getSalesAnalysis line 98-138.

    Phase IIa (2026-05-14): polymorphic restaurant branch added (spec §4.2).
    Restaurant tenants (cretas_db.factories.type ∈ {RESTAURANT, BRANCH}) get
    a restaurant-shaped envelope via ``_restaurant_sales_dispatch``. Factory
    tenants continue with the 7-key composite shape unchanged.

    department/dimension query params accepted but IGNORED for factory branch
    — Java line 110 short-circuits to getComprehensiveAnalysis when
    smartBIService is non-null. F999 goldens confirm: dimension=salesperson
    golden is byte-identical to no-dimension golden except _meta. Restaurant
    branch also ignores both params (single sales view, no factory-style
    department/dimension filters).
    """
    # Tenant detection — mirrors analysis_production.py:468-488.
    cretas_pool = None
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        cretas_pool = await get_cretas_pool()
    except Exception as e:
        logger.warning(
            "[analysis_sales] cretas_db pool acquisition failed factory=%s: %s",
            auth.factory_id, e,
        )

    if cretas_pool is None:
        # Defensive — pool missing → factory branch (matches Java
        # isRestaurantTenant returning false on repository failure).
        tenant = TenantType.FACTORY
    else:
        async with cretas_pool.acquire() as conn:
            tenant = await get_tenant_type(auth.factory_id, conn)

    if tenant.is_restaurant_tenant:
        envelope = await _restaurant_sales_dispatch(
            auth.factory_id, startDate, endDate, dimension
        )
        if isinstance(envelope, dict):
            strip_price_for_role(envelope.get("data"), auth.role)
        return envelope

    # Factory branch — unchanged Phase 2A behavior.
    range_ = DateRange.custom(startDate, endDate)
    result = await _get_comprehensive_sales_analysis(auth.factory_id, range_)
    return wrap_response(strip_price_for_role(result, auth.role))
