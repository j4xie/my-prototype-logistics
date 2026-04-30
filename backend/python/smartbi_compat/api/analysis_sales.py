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
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from smartbi_compat.api.analysis import _query_sales_data, wrap_response
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange

logger = logging.getLogger(__name__)
router = APIRouter()

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
    Otherwise: (actual / target * 100).quantize(SCALE=4, HALF_UP).
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    return (actual / target * Decimal("100")).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP,
    )


def _calculate_mom_growth(current: Optional[Decimal], previous: Optional[Decimal]) -> Decimal:
    """Mirror Java MetricCalculatorServiceImpl.calculateMomGrowth line 425-438.

    Edge cases:
      - previous null OR 0: return Decimal(100) if current > 0 else Decimal(0)
      - current null:       return Decimal(-100)
      - normal:             (current - previous) / abs(previous) * 100,
                            quantized to DISPLAY_SCALE=2, HALF_UP
    """
    if previous is None or previous == Decimal("0"):
        if current is not None and current > Decimal("0"):
            return Decimal("100")
        return Decimal("0")
    if current is None:
        return Decimal("-100")
    return ((current - previous) / abs(previous) * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP,
    )


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
    Production: returns the module-level `engine` from
    smartbi.database.connection — the same SQLAlchemy engine the existing
    _query_sales_data helper in smartbi_compat.api.analysis transitively
    uses (via get_db_context). Per Phase A.3 verification (2026-04-30),
    smart_bi_sales_data lives in `cretas_db`; the `engine`'s target DB is
    determined by the `postgres_db` setting (env-driven, defaults to
    `smartbi_db` in dev but is set to `cretas_db` in deployments where
    smart_bi_sales_data resides).
    """
    from smartbi.database.connection import engine
    if engine is None:
        raise RuntimeError(
            "PostgreSQL engine not available — postgres_enabled is False "
            "or connection setup failed at module import time."
        )
    return engine


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
        return await asyncio.to_thread(_exec)
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


# ============================================================
# Section 1: DTO dict factories (FROZEN by foundation spec §4)
# ============================================================
# Populated by Tasks C.3 - C.7


def _infer_granularity(start: date, end: date) -> str:
    """Infer Java DateRangeUtils granularity from start/end dates.

    Mirrors Java DateRange.granularity field semantics observed in F999 golden:
      YEAR   — full calendar year (Jan 1 → Dec 31, same year)
      MONTH  — first day of month → last day of same month
      CUSTOM — anything else
    """
    if (start.month == 1 and start.day == 1
            and end.month == 12 and end.day == 31
            and start.year == end.year):
        return "YEAR"
    # First day of a month to last day of the same month
    import calendar
    last_day = calendar.monthrange(start.year, start.month)[1]
    if (start.day == 1
            and end.year == start.year
            and end.month == start.month
            and end.day == last_day):
        return "MONTH"
    return "CUSTOM"


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

    Stripped by `_strip_volatile` before byte compare.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


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


async def _build_legacy_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Legacy fallback placeholder — overview spec replaces with real impl.

    Returns F999 empty-state DashboardResponse matching `buildEmptyDashboard`
    Java line 1145-1159: 1 YELLOW insight + 1 suggestion + 16-field shape.

    This is the legacy SalesAnalysisServiceImpl.getSalesOverview path; will be
    populated by overview spec with real KPI computation from sales data.
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


async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Gold-first dispatch (gold spec). Falls back to legacy if Gold returns None.

    Java reference: SmartBIServiceImpl.getComprehensiveAnalysis line 568-616
    delegates overview to SalesAnalysisServiceImpl.getSalesOverview which itself
    calls GoldDashboardBuilder.buildFromGoldWithCharts FIRST, then legacy SQL.

    Pool acquisition: lazy import of get_pg_pool to avoid circular import at
    module-load time. Pool failure -> warning + legacy fallback.
    """
    pool = None
    try:
        from smartbi.config import get_pg_pool  # type: ignore
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning(
            "[gold-builder] pool acquisition failed factory=%s: %s; using legacy",
            factory_id, e,
        )
        return await _build_legacy_sales_overview(factory_id, range_)

    try:
        gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool=pool)
        if gold_dashboard is not None:
            return gold_dashboard
    except Exception as e:
        logger.warning(
            "[gold-builder] Gold fetch failed factory=%s: %s; falling back to legacy",
            factory_id, e,
        )
    return await _build_legacy_sales_overview(factory_id, range_)


async def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces.

    F999 empty: legacy SQL returns [] (no rows in 2025 window).
    """
    return []


async def _get_product_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces."""
    return []


async def _get_customer_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces."""
    return []


async def _get_sales_trend_chart(
    factory_id: str, range_: DateRange, period: str = "DAY",
) -> dict:
    """STUB — trend spec replaces.

    F999 empty-state ChartConfig: empty data + hardcoded title/axes/options.
    """
    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=[],
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
        "overview":           await _get_sales_overview(factory_id, range_),
        "customerRanking":    await _get_customer_ranking(factory_id, range_),
        "productRanking":     await _get_product_ranking(factory_id, range_),
        "dateRange":          _new_date_range_dict(range_),
        "salespersonRanking": await _get_salesperson_ranking(factory_id, range_),
        "generatedAt":        _utc_now_iso(),
        "trendChart":         await _get_sales_trend_chart(factory_id, range_, "DAY"),
    }


# ============================================================
# Section 4: Route handler (Task D.3)
# ============================================================

@router.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
async def get_sales_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    department: Optional[str] = None,
    dimension: Optional[str] = None,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getSalesAnalysis line 98-138.

    department/dimension query params accepted but IGNORED — Java line 110
    short-circuits to getComprehensiveAnalysis when smartBIService is non-null.
    F999 goldens confirm: dimension=salesperson golden is byte-identical to
    no-dimension golden except _meta.

    Returns 7-key composite Map wrapped in standard envelope.
    """
    range_ = DateRange.custom(startDate, endDate)
    result = await _get_comprehensive_sales_analysis(auth.factory_id, range_)
    return wrap_response(result)
