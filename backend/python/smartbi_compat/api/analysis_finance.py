"""Phase 2A /analysis/finance endpoint port.

Implements composite Map<String, Object> response (6 keys for empty analysisType),
and per-type response shapes. Foundation scope:
  - Composite path (analysisType empty)  → 4 stub sub-services + 6-key Jackson order
  - Payable per-type path (analysisType=payable, stretch) → 2 real sub-services
  - 501 path for un-ported types (profit/cost/receivable/budget) → wrap_response

Sibling副轨 chats replace stubs / add per-types:
  - phase2a/t-finance-perX: profit/cost/receivable/budget real impls
  - phase2a/t-finance-subroutes: 3 standalone sub-endpoints

Java reference:
  - Controller: SmartBIAnalysisController.getFinanceAnalysis line 222-274
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis line 600-605 + 612-613
  - Sub-services: FinanceAnalysisServiceImpl.{getFinanceOverview, getProfitMetrics,
    getCostStructureChart, getReceivableAgingChart, getPayableMetrics, getPayableAgingChart}

Skipped (per spec §3.3, §0):
  - fireGoldShadowRead async (FinanceAnalysisServiceImpl line 200-215, 0-byte impact)
  - smartBIService==null 3-key fallback (accepted divergence)

Spec: docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md
"""
from __future__ import annotations

import calendar
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================
# Section 1: Shared DTO dict factories (copy from sister analysis_sales.py)
# Field counts/names/order verified A.1; do NOT re-derive.
# ============================================================


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



def _new_cost_series_entry(name: str, stack: str) -> dict:
    """Mirror Java Map.of("name", X, "stack", Y) — Map.of(2) iteration order observed
    in F999 golden = [name, stack] (matches put-order for n=2)."""
    return {"name": name, "stack": stack}



def _create_pie_data_item(category: str, value: Decimal, total: Decimal) -> dict:
    """Java FinanceAnalysisServiceImpl.createPieDataItem line 1566-1573 1:1 mirror.

    LinkedHashMap key 顺序: [category, value, percentage]
    percentage = (value/total * 100).setScale(DISPLAY_SCALE=2, HALF_UP) if total > 0 else BigDecimal.ZERO
    Java 2-stage divide: divide(total, SCALE=4, HALF_UP).multiply(100).setScale(2, HALF_UP)
    """
    if total > Decimal("0"):
        # Java line 1571: divide(total, SCALE=4, HALF_UP) → multiply(100) → setScale(2, HALF_UP)
        percentage = (
            (value / total).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            * Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        percentage = Decimal("0")

    return {
        "category":   category,
        "value":      _decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "percentage": _decimal_to_number(percentage),
    }



def _aggregate_cost_by_period(
    cost_records: list[dict], period: str
) -> dict[str, list[Decimal]]:
    """Java FinanceAnalysisServiceImpl.aggregateCostByPeriod line 1452-1467 1:1 mirror.

    TreeMap → Python dict (caller does sorted() for ordering). 每 period 4 个 BigDecimal:
    [material, labor, overhead, total]，全部 .abs() defensive (Java P0-1 Bug B).
    Rule 1: is not None 三元，禁 truthy fallback (skip None entirely; preserve Decimal("0")).
    """
    result: dict[str, list[Decimal]] = {}
    for c in cost_records:
        key = _get_period_key(c["record_date"], period)
        slot = result.setdefault(key, [Decimal("0")] * 4)
        if c.get("material_cost") is not None:
            slot[0] += abs(_to_decimal(c["material_cost"]))
        if c.get("labor_cost") is not None:
            slot[1] += abs(_to_decimal(c["labor_cost"]))
        if c.get("overhead_cost") is not None:
            slot[2] += abs(_to_decimal(c["overhead_cost"]))
        if c.get("total_cost") is not None:
            slot[3] += abs(_to_decimal(c["total_cost"]))
    return result



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


def _new_yaxis_entry(name: str, position: str) -> dict:
    """Mirror Java `Map.of("name", X, "position", Y)`.

    Map.of(2) Jackson-serializes in put-order: ["name", "position"].
    Used in profit trendChart options.yAxis (left/right axes).
    """
    return {"name": name, "position": position}


def _new_series_entry(type_: str, yaxis_index: int, name: str) -> dict:
    """Mirror Java `Map.of("name", X, "type", Y, "yAxisIndex", Z)`.

    Map.of(3) Jackson hash-orders to ["type", "yAxisIndex", "name"] — NOT put-order.
    Verified empirically against live Java responses (see spec §3.3).
    Used in profit trendChart options.series (5 series: 3 bar + 2 line).
    """
    return {"type": type_, "yAxisIndex": yaxis_index, "name": name}


# ============================================================
# Section 2: Helpers (copy from sister analysis_sales.py)
# ============================================================


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


def _format_currency(v: Optional[Decimal]) -> str:
    """Mirror Java FinanceAnalysisServiceImpl.formatCurrency (line 1608-1614).

    Uses DecimalFormat("#,##0.00") — thousands separator + 2 decimals, HALF_UP.
    None → "-" (matches Java behavior on null input).

    Differs from `_format_kpi_value`: this is for finance MetricResult.formattedValue
    (always 元 with thousands separator); `_format_kpi_value` is for KPICard.value
    (no thousands separator, unit-conditional decimals).
    """
    if v is None:
        return "-"
    quantized = v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    # Python format with thousands separator: f"{x:,.2f}"
    return f"{quantized:,.2f}"


def _get_budget_amount_by_metric(record: dict, metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetAmountByMetric (line 1716-1749).

    Java fall-through: switch case has inner `if category contains keyword: return; break;`
    but `break` exits switch and falls through to outer `return data.getBudgetAmount()` at
    line 1748. So function ALWAYS returns budget_amount regardless of category match —
    keyword filter is dead code in Java. Mirror this literally.

    `metric` parameter accepted but unused (Java parity, future-proof).
    """
    if record.get("budget_amount") is None:
        return Decimal("0")
    return _to_decimal(record["budget_amount"])


def _get_actual_amount_by_metric(record: dict, metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getActualAmountByMetric (line 1754-1786).

    Same Java fall-through behavior as _get_budget_amount_by_metric — always returns
    actual_amount regardless of category match.
    """
    if record.get("actual_amount") is None:
        return Decimal("0")
    return _to_decimal(record["actual_amount"])


def _determine_budget_achievement_alert(achievement_rate: Decimal) -> str:
    """Mirror Java FinanceAnalysisServiceImpl.determineBudgetAchievementAlertLevel
    (line 1794-1799).

      v > 120  → RED   (超支严重)
      v > 100  → YELLOW (略有超支)
      v <= 100 → GREEN  (正常)

    Boundary: exactly 100 → GREEN; exactly 120 → YELLOW.
    """
    v = float(achievement_rate)
    if v > 120:
        return "RED"
    if v > 100:
        return "YELLOW"
    return "GREEN"


def _get_metric_display_name(metric: Optional[str]) -> str:
    """Mirror Java FinanceAnalysisServiceImpl.getMetricDisplayName (line 1804-1820)."""
    if metric is None:
        return "综合"
    return {
        "revenue": "收入",
        "cost": "成本",
        "expense": "费用",
        "profit": "利润",
        "gross_margin": "毛利率",
    }.get(metric.lower(), "综合")


def _safe_growth_rate(current: Decimal, base: Decimal) -> Decimal:
    """Mirror Java growth rate formula at FinanceAnalysisServiceImpl.calculateMonthYoYMoM
    line 1839-1850 etc. Returns scale=4 Decimal.

    (current - base) / base * 100 with ROUND_HALF_UP, or Decimal("0") when base <= 0.
    """
    if base > Decimal("0"):
        return ((current - base) / base * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    return Decimal("0")


def _calculate_metric_from_sales(sales_rows: list[dict], metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.calculateMetricFromSales (line 2040-2065).

    Pre-aggregates total_revenue + total_cost from sales_rows, then dispatches:
      revenue       → total_revenue
      profit        → total_revenue - total_cost
      gross_margin  → (rev - cost) / rev * 100, scale=4 (or 0 if rev=0)
      default       → total_revenue
    """
    metric_lower = (metric or "").lower()

    total_revenue = sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )
    # Java line 2046-2049: NO .abs() (unlike profit metrics path)
    total_cost = sum(
        (
            _to_decimal(r["cost"])
            for r in sales_rows
            if r.get("cost") is not None
        ),
        Decimal("0"),
    )

    if metric_lower == "revenue":
        return total_revenue
    if metric_lower == "profit":
        return total_revenue - total_cost
    if metric_lower == "gross_margin":
        if total_revenue > Decimal("0"):
            return (
                (total_revenue - total_cost) / total_revenue * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return Decimal("0")
    # default
    return total_revenue


async def _get_metric_value_for_period(
    factory_id: str, year_month: tuple, metric: str
) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getMetricValueForPeriod (line 1970-2000).

    3 distinct branches by data source (audit C-1 fix):
      revenue / profit / gross_margin → smart_bi_sales_data via _query_finance_sales_fallback
      cost / expense                  → smart_bi_finance_data RecordType.COST, sum total_cost
      default                         → smart_bi_sales_data, sum amount
    """
    year, month = year_month
    last_day = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    metric_lower = (metric or "").lower()

    if metric_lower in ("revenue", "profit", "gross_margin"):
        sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
        return _calculate_metric_from_sales(sales_rows, metric_lower)

    if metric_lower in ("cost", "expense"):
        cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)
        # Java line 1987-1990: sum total_cost (NOT actual_amount)
        return sum(
            (
                _to_decimal(r["total_cost"])
                for r in cost_records
                if r.get("total_cost") is not None
            ),
            Decimal("0"),
        )

    # Default: sum amount from sales (Java line 1991-1998)
    sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
    return sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )


async def _get_metric_value_for_quarter(
    factory_id: str, year: int, quarter: int, metric: str
) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getMetricValueForQuarter (line 2005-2035).

    Same 3-branch structure as _get_metric_value_for_period, with quarter date math.
    """
    start_month = (quarter - 1) * 3 + 1
    end_month = quarter * 3
    last_day = calendar.monthrange(year, end_month)[1]
    start_date = date(year, start_month, 1)
    end_date = date(year, end_month, last_day)

    metric_lower = (metric or "").lower()

    if metric_lower in ("revenue", "profit", "gross_margin"):
        sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
        return _calculate_metric_from_sales(sales_rows, metric_lower)

    if metric_lower in ("cost", "expense"):
        cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)
        return sum(
            (
                _to_decimal(r["total_cost"])
                for r in cost_records
                if r.get("total_cost") is not None
            ),
            Decimal("0"),
        )

    sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
    return sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )


async def _calculate_month_yoy_mom(
    factory_id: str, period: str, metric: str
) -> list:
    """Mirror Java calculateMonthYoYMoM (line 1825-1864).

    period format: 'YYYY-MM'. Returns single chart point.
    """
    year, month = map(int, period.split("-"))
    current_ym = (year, month)
    last_year_ym = (year - 1, month)
    last_month_y, last_month_m = (year, month - 1) if month > 1 else (year - 1, 12)
    last_period_ym = (last_month_y, last_month_m)

    current_value = await _get_metric_value_for_period(factory_id, current_ym, metric)
    last_year_value = await _get_metric_value_for_period(factory_id, last_year_ym, metric)
    last_period_value = await _get_metric_value_for_period(factory_id, last_period_ym, metric)

    yoy_growth_rate = _safe_growth_rate(current_value, last_year_value)
    mom_growth_rate = _safe_growth_rate(current_value, last_period_value)

    return [{
        "period": period,
        "currentValue": _decimal_to_number(current_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastYearValue": _decimal_to_number(last_year_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastPeriodValue": _decimal_to_number(last_period_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyGrowthRate": _decimal_to_number(yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momGrowthRate": _decimal_to_number(mom_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyChange": _decimal_to_number((current_value - last_year_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momChange": _decimal_to_number((current_value - last_period_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
    }]


async def _calculate_quarter_yoy_mom(
    factory_id: str, period: str, metric: str
) -> list:
    """Mirror Java calculateQuarterYoYMoM (line 1869-1913).

    period format: 'YYYY-Qn' (e.g. '2026-Q1'). Returns single chart point.
    Note: yoy field name is `momGrowthRate` even though it's QoQ — Java reuses field name.
    """
    parts = period.split("-Q")
    year = int(parts[0])
    quarter = int(parts[1])

    last_year_q = quarter
    last_year_y = year - 1
    last_quarter_q = 4 if quarter == 1 else quarter - 1
    last_quarter_y = year - 1 if quarter == 1 else year

    current_value = await _get_metric_value_for_quarter(factory_id, year, quarter, metric)
    last_year_value = await _get_metric_value_for_quarter(factory_id, last_year_y, last_year_q, metric)
    last_quarter_value = await _get_metric_value_for_quarter(factory_id, last_quarter_y, last_quarter_q, metric)

    yoy_growth_rate = _safe_growth_rate(current_value, last_year_value)
    qoq_growth_rate = _safe_growth_rate(current_value, last_quarter_value)

    return [{
        "period": period,
        "currentValue": _decimal_to_number(current_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastYearValue": _decimal_to_number(last_year_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastPeriodValue": _decimal_to_number(last_quarter_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyGrowthRate": _decimal_to_number(yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momGrowthRate": _decimal_to_number(qoq_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyChange": _decimal_to_number((current_value - last_year_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momChange": _decimal_to_number((current_value - last_quarter_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
    }]


async def _calculate_month_range_yoy_mom(
    factory_id: str, start_period: str, end_period: str, metric: str
) -> list:
    """Mirror Java calculateMonthRangeYoYMoM (line 1918-1932).

    Iterates from start_period to end_period (inclusive), calling _calculate_month_yoy_mom
    per month. Each iteration emits 1 chart point.
    """
    start_year, start_month = map(int, start_period.split("-"))
    end_year, end_month = map(int, end_period.split("-"))

    result = []
    current_year, current_month = start_year, start_month
    while (current_year, current_month) <= (end_year, end_month):
        period = f"{current_year}-{current_month:02d}"
        month_data = await _calculate_month_yoy_mom(factory_id, period, metric)
        result.extend(month_data)
        if current_month == 12:
            current_year += 1
            current_month = 1
        else:
            current_month += 1
    return result


async def _calculate_quarter_range_yoy_mom(
    factory_id: str, start_period: str, end_period: str, metric: str
) -> list:
    """Mirror Java calculateQuarterRangeYoYMoM (line 1937-1965).

    Iterates from start_period (YYYY-Qn) to end_period inclusive, calling
    _calculate_quarter_yoy_mom per quarter.
    """
    start_year_str, start_q_str = start_period.split("-Q")
    end_year_str, end_q_str = end_period.split("-Q")
    start_year, start_q = int(start_year_str), int(start_q_str)
    end_year, end_q = int(end_year_str), int(end_q_str)

    result = []
    current_year, current_quarter = start_year, start_q
    # Java line 1951: while (currentYear < endYear || (currentYear == endYear && currentQuarter <= endQuarter))
    while current_year < end_year or (current_year == end_year and current_quarter <= end_q):
        period = f"{current_year}-Q{current_quarter}"
        quarter_data = await _calculate_quarter_yoy_mom(factory_id, period, metric)
        result.extend(quarter_data)
        current_quarter += 1
        if current_quarter > 4:
            current_quarter = 1
            current_year += 1
    return result


async def _get_budget_achievement_chart(
    factory_id: str, year: int, metric: str = "revenue"
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetAchievementChart (line 1121-1195).

    Always emits 12 month entries (Java line 1132-1135 pre-fills with zeros).
    """
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    budget_data = await _query_finance_data(
        factory_id, "BUDGET", start_date, end_date
    )

    # Java line 1131-1135: TreeMap of 12 months pre-filled [budget=0, actual=0]
    monthly_data: dict[int, list[Decimal]] = {
        m: [Decimal("0"), Decimal("0")] for m in range(1, 13)
    }

    for record in budget_data:
        if record.get("record_date") is None:
            continue
        month = record["record_date"].month
        monthly_data[month][0] += _get_budget_amount_by_metric(record, metric)
        monthly_data[month][1] += _get_actual_amount_by_metric(record, metric)

    chart_data: list[dict] = []
    for month in range(1, 13):
        budget = monthly_data[month][0]
        actual = monthly_data[month][1]
        if budget > Decimal("0"):
            achievement_rate = (
                actual / budget * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            achievement_rate = Decimal("0")
        # Note: alert uses scale=4 value (precision matters at boundary)
        alert_level = _determine_budget_achievement_alert(achievement_rate)

        chart_data.append({
            "month": f"{month}月",
            "budget": _decimal_to_number(budget.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "actual": _decimal_to_number(actual.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "achievementRate": _decimal_to_number(achievement_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "variance": _decimal_to_number((actual - budget).quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "alertLevel": alert_level,
        })

    metric_name = _get_metric_display_name(metric)

    # Map.of(4) Jackson hash order — recorded from live Java (Phase B.2 golden):
    # yAxis[0]: ['position', 'name'] (Java Map.of(2) hash-order differs from profit's ['name','position'])
    # yAxis[1]: ['position', 'min', 'name', 'max'] (Map.of(4) non-deterministic, captured empirically)
    # series[i]: ['yAxisIndex', 'type', 'name', 'color'] (Map.of(4), differs from profit series Map.of(3))
    # referenceLine: ['label', 'value'] (Map.of(2), captured empirically)
    options = {
        "yAxis": [
            {"position": "left", "name": "金额"},
            {"position": "right", "min": 0, "name": "达成率(%)", "max": 150},
        ],
        "series": [
            {"yAxisIndex": 0, "type": "bar", "name": "预算", "color": "#5470c6"},
            {"yAxisIndex": 0, "type": "bar", "name": "实际", "color": "#91cc75"},
            {"yAxisIndex": 1, "type": "line", "name": "达成率", "color": "#ee6666"},
        ],
        "referenceLine": {"label": "目标线", "value": 100},
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title=f"{year}年{metric_name}预算达成分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="month",
        yaxis_field="budget",
    )


def _determine_gross_margin_alert(gross_margin: Decimal) -> str:
    """Java `FinanceAnalysisServiceImpl.determineGrossMarginAlertLevel` line 1619-1624.

    v < 15  → RED
    v < 25  → YELLOW
    v >= 25 → GREEN
    """
    v = float(gross_margin)
    if v < 15:
        return "RED"
    if v < 25:
        return "YELLOW"
    return "GREEN"


def _determine_roi_alert(roi: Decimal) -> str:
    """Java `FinanceAnalysisServiceImpl.determineRoiAlertLevel` line 1629-1634.

    v < 0   → RED
    v < 20  → YELLOW
    v >= 20 → GREEN
    """
    v = float(roi)
    if v < 0:
        return "RED"
    if v < 20:
        return "YELLOW"
    return "GREEN"


def _get_period_key(d: date, period: str) -> str:
    """Mirror Java `FinanceAnalysisServiceImpl.getPeriodKey` line 1472-1487.

    Period key formats:
      DAY     → yyyy-MM-dd
      WEEK    → yyyy-Www  (ISO week, 2-digit zero-padded)
      MONTH   → yyyy-MM   (default for unknown period)
      QUARTER → yyyy-Qn

    Java ISO week semantics: weeks start Monday, week-1 contains the year's
    first Thursday. Python `isocalendar()` matches.
    """
    if period == "DAY":
        return d.strftime("%Y-%m-%d")
    if period == "WEEK":
        _iso_year, iso_week, _iso_day = d.isocalendar()
        return f"{d.year}-W{iso_week:02d}"
    if period == "QUARTER":
        return f"{d.year}-Q{(d.month - 1) // 3 + 1}"
    # MONTH or default
    return d.strftime("%Y-%m")


# Cost category constants (Java FinanceAnalysisServiceImpl COST_CATEGORY_* literal values)
COST_CATEGORY_MATERIAL = "原材料"
COST_CATEGORY_LABOR    = "人工"
COST_CATEGORY_OVERHEAD = "制造费用"


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


def _utc_now_iso() -> str:
    """Generate ISO timestamp for generatedAt / lastUpdated fields.

    Stripped by `_strip_volatile` before byte compare.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


# ============================================================
# Section 2b: MetricResult factory (finance-specific; NOT in sister)
# Per A.1: 11 declared @Data fields, all emit per Lombok.
# AlertLevel enum (inline in MetricResult.java line 97-122): GREEN / YELLOW / RED
# ============================================================


def _new_metric_result_dict(
    metric_code: str,
    metric_name: str,
    value: Optional[Any] = None,           # Decimal or pre-converted number
    formatted_value: Optional[str] = None,
    unit: Optional[str] = None,
    change_percent: Optional[Any] = None,  # Decimal or number
    change_direction: Optional[str] = None,
    change_value: Optional[Any] = None,
    alert_level: Optional[str] = None,     # GREEN / YELLOW / RED
    dimension_value: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Mirror MetricResult.java @Data getters (11 fields, all emit per Lombok).

    Field order matches Java declaration order verified A.1.

    `value`, `changePercent`, `changeValue` callers should pass `_decimal_to_number(d)`
    or a pre-converted number (NOT a bare Decimal — FastAPI serializes Decimal as
    string and breaks byte parity with Java Jackson).

    `alertLevel` is enum.name() string ("GREEN" / "YELLOW" / "RED") matching Java
    Jackson serialization of inline AlertLevel enum.
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
# Section 2c: SQL helpers (payable real impl, Phase E)
# ============================================================


async def _query_finance_payable_data(factory_id: str, end_date: date) -> list[dict]:
    """Query AP rows from smart_bi_finance_data for factory + 1y lookback ending at end_date.

    Java reference: FinanceAnalysisServiceImpl.getPayableMetrics (line 870-918) +
    getPayableAgingChart (line 832-867). Both call:
        financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
            factoryId, RecordType.AP, date.minusYears(1), date)
    then wrap with filterToLatestUpload().

    Returns list of dicts with keys: payable_amount, payment_amount, aging_days,
    record_date, upload_id, supplier_name. Empty when no data — caller handles.
    """
    pool = None
    try:
        # smart_bi_finance_data lives in cretas_db (per V20260502_04 RLS sweep);
        # smartbi_user lacks SELECT GRANT on smartbi_db replica. Use cretas_pool
        # (cretas_user has GRANT). RLS policy has IS NULL escape — no GUC needed
        # since SQL WHERE factory_id=$1 already scopes the query.
        from smartbi.config import get_cretas_pool  # type: ignore
        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning("[payable] pool acquisition failed factory=%s: %s", factory_id, e)
        return []

    if pool is None:
        logger.warning("[payable] pool is None factory=%s; returning empty rows", factory_id)
        return []

    # Java's date.minusYears(1) handles leap-year Feb 29 by clamping to Feb 28 of prior year.
    try:
        start_date = end_date.replace(year=end_date.year - 1)
    except ValueError:
        # Feb 29 → use Feb 28 of prior year (matches Java LocalDate.minusYears clamp)
        start_date = end_date.replace(year=end_date.year - 1, day=28)

    sql = """
        SELECT payable_amount, payment_amount, aging_days, record_date, upload_id, supplier_name
        FROM smart_bi_finance_data
        WHERE factory_id = $1
          AND record_type = 'AP'
          AND record_date BETWEEN $2 AND $3
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)

    raw_rows = [dict(r) for r in rows]
    return _filter_to_latest_upload(raw_rows)


def _filter_to_latest_upload(rows: list[dict]) -> list[dict]:
    """Mirror Java FinanceAnalysisServiceImpl.filterToLatestUpload (line 89-101).

    If any row has non-null upload_id, keep only rows with upload_id == max(upload_id).
    If all upload_ids are null, return rows unchanged.
    Empty input → empty output.
    """
    if not rows:
        return rows
    upload_ids = [r["upload_id"] for r in rows if r.get("upload_id") is not None]
    if not upload_ids:
        return rows
    target_id = max(upload_ids)
    return [r for r in rows if r.get("upload_id") == target_id]


async def _query_finance_data(
    factory_id: str, record_type: str, start_date: date, end_date: date
) -> list[dict]:
    """Single parametrized query against smart_bi_finance_data — reusable across
    all RecordType branches (REVENUE / COST / AR / AP / BUDGET).

    Java reference: financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
        factoryId, RecordType.<X>, start, end). Then wraps via filterToLatestUpload
    (Java line 89-101).

    SELECT * over all known columns; callers extract by key. Sister chats use
    same function with different record_type.
    """
    pool = None
    try:
        # smart_bi_finance_data lives in cretas_db (per V20260502_04 RLS sweep);
        # smartbi_user lacks SELECT GRANT on smartbi_db replica. Use cretas_pool
        # (cretas_user has GRANT). RLS policy has IS NULL escape — no GUC needed
        # since SQL WHERE factory_id=$1 already scopes the query.
        from smartbi.config import get_cretas_pool  # type: ignore
        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning(
            "[finance_data] pool acquisition failed factory=%s record_type=%s: %s",
            factory_id, record_type, e,
        )
        return []

    if pool is None:
        logger.warning(
            "[finance_data] pool is None factory=%s record_type=%s; returning empty rows",
            factory_id, record_type,
        )
        return []

    sql = """
        SELECT id, factory_id, upload_id, record_date, record_type,
               department, category, customer_name, supplier_name,
               material_cost, labor_cost, overhead_cost, total_cost,
               receivable_amount, collection_amount, aging_days,
               payable_amount, payment_amount,
               budget_amount, actual_amount, variance_amount,
               due_date, created_at, updated_at
        FROM smart_bi_finance_data
        WHERE factory_id = $1
          AND record_type = $2
          AND record_date BETWEEN $3 AND $4
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, record_type, start_date, end_date)

    raw_rows = [dict(r) for r in rows]
    return _filter_to_latest_upload(raw_rows)


async def _query_finance_sales_fallback(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Query smart_bi_sales_data for sales-fallback path (Java line 392-393).

    Used by profit metrics + trendChart when finance_data is empty (餐饮 tenants
    that uploaded sales Excel but not finance Excel).

    Returns list of dicts with keys: amount, cost, order_date (and other columns
    present in smart_bi_sales_data — callers extract by key with .get()).

    NOTE: Unlike _query_finance_data, this does NOT call _filter_to_latest_upload.
    Java's salesDataRepository.findByFactoryIdAndOrderDateBetween returns raw
    rows without latest-upload filtering — this matches Java behavior for the
    fallback path.
    """
    pool = None
    try:
        # smart_bi_sales_data lives in cretas_db (sister table to smart_bi_finance_data);
        # smartbi_user lacks SELECT GRANT on smartbi_db. Use cretas_pool (cretas_user
        # has GRANT). Same RLS NULL-escape applies — no GUC manipulation needed.
        from smartbi.config import get_cretas_pool  # type: ignore
        pool = await get_cretas_pool()
    except Exception as e:
        logger.warning(
            "[sales_fallback] pool acquisition failed factory=%s: %s",
            factory_id, e,
        )
        return []

    if pool is None:
        logger.warning(
            "[sales_fallback] pool is None factory=%s; returning empty rows",
            factory_id,
        )
        return []

    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_finance_sales_fallback: start_date/end_date required "
            f"(got {start_date}, {end_date})"
        )

    sql = """
        SELECT *
        FROM smart_bi_sales_data
        WHERE factory_id = $1
          AND order_date BETWEEN $2 AND $3
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, start_date, end_date)

    return [dict(r) for r in rows]


# ============================================================
# Section 3: Sub-service stubs (composite path)
# Phase C.1 fills these with A.2-verified empty-state shapes.
# ============================================================


async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    """F999 empty-state — Java FinanceAnalysisServiceImpl.getFinanceOverview Gold-primary
    path returns CLEAN empty DashboardResponse when buildFromFinanceSummary returns null
    (no revenue + no bills). A.5 golden verified shape.

    Differs from sister sales which emitted YELLOW insight + 1 suggestion. Finance does NOT.
    Golden shows: kpiCards=[], metricCards=null, rankings={}, charts={}, chartList=null,
    aiInsights=[], alerts=null, recommendations=null, suggestions=[], generatedAt=null,
    lastUpdated=volatile, fromCache=false, cacheExpireAt=null.
    """
    return _new_dashboard_response_dict(
        last_updated=_utc_now_iso(),
        suggestions=[],
    )


async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list:
    """Real impl mirroring Java `FinanceAnalysisServiceImpl.getProfitMetrics`
    (line 352-495). PR-A: Path A only (finance_data REVENUE/COST records).
    PR-B will add salesData fallback; for now no-finance-data → 5 zero-metrics
    (matches stub behavior for F999 empty state).

    Always returns 5 MetricResults regardless of data presence:
      GROSS_PROFIT / GROSS_MARGIN / NET_PROFIT / NET_MARGIN / ROI

    Anomaly clamps:
      gross_margin > 100% or < -100% → null (per Java line 414-416)
      net_margin   > 100% or < -100% → null (per Java line 449-453)
    """
    revenue_records = await _query_finance_data(
        factory_id, "REVENUE", range_.start_date, range_.end_date
    )
    cost_records = await _query_finance_data(
        factory_id, "COST", range_.start_date, range_.end_date
    )
    has_finance_data = bool(revenue_records or cost_records)

    if has_finance_data:
        # Java line 367-388
        total_revenue = sum(
            (
                _to_decimal(r["actual_amount"])
                for r in revenue_records
                if r.get("category") and "收入" in r["category"]
                and r.get("actual_amount") is not None
            ),
            Decimal("0"),
        )
        total_cost = sum(
            (
                abs(_to_decimal(
                    r.get("total_cost") if r.get("total_cost") is not None
                    else r.get("actual_amount")
                ))
                for r in cost_records
                if (r.get("total_cost") is not None) or (r.get("actual_amount") is not None)
            ),
            Decimal("0"),
        )
        net_profit = sum(
            (
                _to_decimal(r["actual_amount"])
                for r in revenue_records
                if r.get("category") and "净利" in r["category"]
                and r.get("actual_amount") is not None
            ),
            Decimal("0"),
        )
    else:
        # PR-B sales fallback: when finance_data is empty, fall back to
        # smart_bi_sales_data (Java line 391-405). 餐饮 tenants typically only
        # upload sales Excel, not finance Excel.
        sales_rows = await _query_finance_sales_fallback(
            factory_id, range_.start_date, range_.end_date
        )
        # Java line 394-403: revenue + cost from sales rows
        total_revenue = sum(
            (
                _to_decimal(r["amount"])
                for r in sales_rows
                if r.get("amount") is not None
            ),
            Decimal("0"),
        )
        # Java line 399-403 — defensive .abs() per Bug B fix (cost may be negative
        # in historical sales data).
        total_cost = sum(
            (
                abs(_to_decimal(r["cost"]))
                for r in sales_rows
                if r.get("cost") is not None
            ),
            Decimal("0"),
        )
        # Java line 404: netProfit explicitly null in fallback metrics path.
        # (trendChart fallback uses gross*0.70, but metrics path does not.)
        net_profit = None

    # Java line 409-416 — gross profit + margin clamp
    gross_profit = total_revenue - total_cost
    if total_revenue > Decimal("0"):
        gross_margin_raw = (
            gross_profit / total_revenue * Decimal("100")
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        gross_margin_raw = Decimal("0")
    gross_margin = (
        None
        if (gross_margin_raw > Decimal("100") or gross_margin_raw < Decimal("-100"))
        else gross_margin_raw
    )

    # Java line 446-453 — net margin (only when net_profit available + revenue > 0)
    if net_profit is not None and total_revenue > Decimal("0"):
        net_margin_raw = (
            net_profit / total_revenue * Decimal("100")
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        net_margin_raw = None
    net_margin = (
        None
        if (
            net_margin_raw is not None
            and (net_margin_raw > Decimal("100") or net_margin_raw < Decimal("-100"))
        )
        else net_margin_raw
    )

    # Java line 481-483 — ROI = grossProfit / totalCost * 100
    if total_cost > Decimal("0"):
        roi = (
            gross_profit / total_cost * Decimal("100")
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        roi = Decimal("0")

    # Alert levels
    gross_margin_alert = (
        _determine_gross_margin_alert(gross_margin) if gross_margin is not None else "RED"
    )
    # Java line 461-466: GREEN if net_profit is null OR >= 0, RED if < 0
    if net_profit is None:
        net_profit_alert = "GREEN"
    else:
        net_profit_alert = "GREEN" if net_profit >= Decimal("0") else "RED"
    roi_alert = _determine_roi_alert(roi)

    return [
        _new_metric_result_dict(
            metric_code="GROSS_PROFIT",
            metric_name="毛利额",
            value=_decimal_to_number(gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            formatted_value=_format_currency(gross_profit),
            unit="元",
            alert_level="GREEN",
            description="销售收入减去销售成本",
        ),
        _new_metric_result_dict(
            metric_code="GROSS_MARGIN",
            metric_name="毛利率",
            value=(
                _decimal_to_number(gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if gross_margin is not None else None
            ),
            formatted_value=(
                f"{gross_margin.quantize(Decimal('0.01'), ROUND_HALF_UP)}%"
                if gross_margin is not None else "N/A"
            ),
            unit="%",
            alert_level=gross_margin_alert,
            description="毛利额占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="NET_PROFIT",
            metric_name="净利润",
            value=(
                _decimal_to_number(net_profit.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if net_profit is not None else None
            ),
            formatted_value=(
                _format_currency(net_profit) if net_profit is not None else "N/A"
            ),
            unit="元",
            alert_level=net_profit_alert,
            description="毛利减去各项费用后的利润",
        ),
        _new_metric_result_dict(
            metric_code="NET_MARGIN",
            metric_name="净利率",
            value=(
                _decimal_to_number(net_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if net_margin is not None else None
            ),
            formatted_value=(
                f"{net_margin.quantize(Decimal('0.01'), ROUND_HALF_UP)}%"
                if net_margin is not None else "N/A"
            ),
            unit="%",
            alert_level="GREEN",
            description="净利润占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="ROI",
            metric_name="投入产出比",
            value=_decimal_to_number(roi.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            formatted_value=f"{roi.quantize(Decimal('0.01'), ROUND_HALF_UP)}%",
            unit="%",
            alert_level=roi_alert,
            description="毛利额与成本的比率",
        ),
    ]


def _build_profit_chart_from_finance_data(
    revenue_rows: list[dict], cost_rows: list[dict], period: str
) -> list[dict]:
    """Mirror Java `FinanceAnalysisServiceImpl.buildProfitChartFromFinanceData`
    line 279-349.

    Aggregates revenue/cost/net-profit per period, emits 6-key chart points.
    Java uses TreeMap (sorted keys) → Python `sorted(set(...))`.

    Each point (insertion order = serialization order):
      [period, revenue, cost, grossProfit, netProfit, grossMargin]

    Notes:
      - `revenue_rows` filter: category contains "收入" (营业收入).
      - `net_profit_by_period` filter: category contains "净利" (净利润 etc).
      - `cost_rows` defensive `.abs()` (Java Bug B fix line 304).
      - `gross_margin > 100% or < -100%` → null (Java line 332-335).
      - When no "净利" record for a period, `netProfit` defaults to `gross_profit`
        (Java line 336).
    """
    revenue_by_period: dict[str, Decimal] = {}
    net_profit_by_period: dict[str, Decimal] = {}
    cost_by_period: dict[str, Decimal] = {}

    for r in revenue_rows:
        if r.get("actual_amount") is None:
            continue
        key = _get_period_key(r["record_date"], period)
        cat = r.get("category") or ""
        if "收入" in cat:
            revenue_by_period[key] = (
                revenue_by_period.get(key, Decimal("0")) + _to_decimal(r["actual_amount"])
            )
        if "净利" in cat:
            net_profit_by_period[key] = (
                net_profit_by_period.get(key, Decimal("0")) + _to_decimal(r["actual_amount"])
            )

    for c in cost_rows:
        if c.get("total_cost") is None and c.get("actual_amount") is None:
            continue
        key = _get_period_key(c["record_date"], period)
        raw = c.get("total_cost") if c.get("total_cost") is not None else c.get("actual_amount")
        cost_by_period[key] = (
            cost_by_period.get(key, Decimal("0")) + abs(_to_decimal(raw))
        )

    all_periods = sorted(set(revenue_by_period.keys()) | set(cost_by_period.keys()))
    chart_data: list[dict] = []
    for pk in all_periods:
        revenue = revenue_by_period.get(pk, Decimal("0"))
        cost = cost_by_period.get(pk, Decimal("0"))
        gross_profit = revenue - cost
        if revenue > Decimal("0"):
            gross_margin_raw = (
                gross_profit / revenue * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            gross_margin_raw = Decimal("0")
        gross_margin = (
            None
            if (gross_margin_raw > Decimal("100") or gross_margin_raw < Decimal("-100"))
            else gross_margin_raw
        )
        net_profit = net_profit_by_period.get(pk, gross_profit)

        chart_data.append({
            "period": pk,
            "revenue": _decimal_to_number(revenue.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "cost": _decimal_to_number(cost.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "grossProfit": _decimal_to_number(gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "netProfit": _decimal_to_number(net_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "grossMargin": (
                _decimal_to_number(gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if gross_margin is not None else None
            ),
        })
    return chart_data


def _aggregate_profit_by_period_sales(
    sales_rows: list[dict], period: str
) -> list[dict]:
    """Mirror Java `FinanceAnalysisServiceImpl.aggregateProfitByPeriod` line 1423-1447.

    Sales-fallback chart aggregator. Used when finance_data is empty but
    smart_bi_sales_data has rows (餐饮 tenants).

    Differs from `_build_profit_chart_from_finance_data`:
      - emits **4 keys per point**: [period, grossProfit, netProfit, grossMargin]
        (NOT 6 keys — no `revenue` / `cost`)
      - `netProfit = grossProfit * 0.70` (Java line 1440 hardcoded — known quirk;
        assumes 30% expense ratio. PR-B preserves this for byte parity.)
      - `grossMargin` does NOT clamp >100/<-100 → null (Java line 1441-1443
        emits raw value or 0). For sales rows revenue is never huge negative,
        so this rarely matters in practice; we mirror Java behavior literally.

    Period aggregation via TreeMap → Python `sorted(by_period.keys())`.
    """
    by_period: dict[str, dict[str, Decimal]] = {}
    for r in sales_rows:
        if r.get("order_date") is None:
            continue
        key = _get_period_key(r["order_date"], period)
        slot = by_period.setdefault(
            key, {"profit": Decimal("0"), "revenue": Decimal("0")}
        )
        revenue = _to_decimal(r.get("amount") or 0)
        cost = _to_decimal(r.get("cost") or 0)
        slot["profit"] += revenue - cost
        slot["revenue"] += revenue

    out: list[dict] = []
    for key in sorted(by_period.keys()):
        slot = by_period[key]
        gross = slot["profit"]
        net = (gross * Decimal("0.70")).quantize(Decimal("0.01"), ROUND_HALF_UP)
        if slot["revenue"] > Decimal("0"):
            gm = (
                gross / slot["revenue"] * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            gm = Decimal("0")
        out.append({
            "period": key,
            "grossProfit": _decimal_to_number(gross.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "netProfit": _decimal_to_number(net),
            "grossMargin": _decimal_to_number(gm.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        })
    return out


async def _get_profit_trend_chart(
    factory_id: str,
    start_date: date,
    end_date: date,
    period: str = "MONTH",
) -> dict:
    """Mirror Java `FinanceAnalysisServiceImpl.getProfitTrendChart` line 220-274.

    Builds LINE_BAR chart with 5 series (3 bar: 营业收入/营业成本/毛利额,
    2 line: 净利润/毛利率) on dual yAxis (left=金额, right=毛利率%).

    PR-A: when both revenue + cost queries empty → data=[] (chart options
    still emitted in full). PR-B will add sales fallback in this same branch.

    Period defaults to MONTH (matches controller line 246 hardcoded "MONTH").
    """
    revenue_data = await _query_finance_data(
        factory_id, "REVENUE", start_date, end_date
    )
    cost_data = await _query_finance_data(
        factory_id, "COST", start_date, end_date
    )

    if revenue_data or cost_data:
        chart_data = _build_profit_chart_from_finance_data(revenue_data, cost_data, period)
    else:
        # PR-B sales fallback: when finance_data empty, aggregate by period from
        # smart_bi_sales_data (Java line 237-249). Returns 4-key points (period,
        # grossProfit, netProfit=gross*0.70, grossMargin) — differs from main
        # path's 6-key points.
        sales_rows = await _query_finance_sales_fallback(
            factory_id, start_date, end_date
        )
        chart_data = _aggregate_profit_by_period_sales(sales_rows, period)

    options = {
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            _new_yaxis_entry(name="毛利率(%)", position="right"),
        ],
        "series": [
            _new_series_entry(type_="bar", yaxis_index=0, name="营业收入"),
            _new_series_entry(type_="bar", yaxis_index=0, name="营业成本"),
            _new_series_entry(type_="bar", yaxis_index=0, name="毛利额"),
            _new_series_entry(type_="line", yaxis_index=0, name="净利润"),
            _new_series_entry(type_="line", yaxis_index=1, name="毛利率"),
        ],
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title="利润趋势分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="grossProfit",
    )


async def _get_cost_structure_chart(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java FinanceAnalysisServiceImpl.getCostStructureChart line 499-540 1:1 mirror.

    Composite + per-type 共享。Signature changed from (factory_id, range_: DateRange)
    to (factory_id, start_date, end_date) per Rule 3 (Java getCostStructureChart 签名)。
    Composite caller (_get_comprehensive_finance_analysis) updated in Phase E.

    F999 empty case: cost_records=[] → totalCost=0 → empty data list with full options。
    """
    cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)

    # Java line 507-516: aggregate three cost categories with .abs() defensive (Rule 1)
    material_cost = sum(
        (abs(_to_decimal(r["material_cost"])) for r in cost_records
         if r.get("material_cost") is not None),
        Decimal("0"),
    )
    labor_cost = sum(
        (abs(_to_decimal(r["labor_cost"])) for r in cost_records
         if r.get("labor_cost") is not None),
        Decimal("0"),
    )
    overhead_cost = sum(
        (abs(_to_decimal(r["overhead_cost"])) for r in cost_records
         if r.get("overhead_cost") is not None),
        Decimal("0"),
    )

    total_cost = material_cost + labor_cost + overhead_cost

    # Java line 521-526: data items only if total > 0; empty list otherwise
    chart_data: list[dict] = []
    if total_cost > Decimal("0"):
        chart_data.append(_create_pie_data_item(COST_CATEGORY_MATERIAL, material_cost, total_cost))
        chart_data.append(_create_pie_data_item(COST_CATEGORY_LABOR,    labor_cost,    total_cost))
        chart_data.append(_create_pie_data_item(COST_CATEGORY_OVERHEAD, overhead_cost, total_cost))

    # Java line 528-530 LinkedHashMap → Python insertion order
    options = {
        "showPercentage": True,
        "colors": ["#5470c6", "#91cc75", "#fac858"],
    }

    return _new_chart_config_dict(
        chart_type="PIE",
        title="成本结构分析",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="value",
    )


async def _get_cost_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """Java FinanceAnalysisServiceImpl.getCostTrendChart line 542-581 1:1 mirror.

    Per-type 唯一调用方（composite 路径不调）。空数据 → empty chart_data，
    options 完整保留。Period default "MONTH" matches Java line 246 controller call。
    """
    cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)

    aggregated = _aggregate_cost_by_period(cost_records, period)

    # Java line 553-562 LinkedHashMap chart point: [period, materialCost, laborCost, overheadCost, totalCost]
    chart_data = []
    for period_key in sorted(aggregated.keys()):  # TreeMap → sorted Python
        values = aggregated[period_key]  # [material, labor, overhead, total]
        # I-1 fix (final review): Java line 553-562 emits raw BigDecimal without setScale —
        # cost trendChart differs from profit's getProfitTrendChart (which DOES setScale).
        # DB columns are precision=15 scale=2, so accumulated sums preserve scale 2 naturally.
        # No quantize() here = exact 1:1 mirror of Java behavior. Sister chats note this.
        chart_data.append({
            "period":       period_key,
            "materialCost": _decimal_to_number(values[0]),
            "laborCost":    _decimal_to_number(values[1]),
            "overheadCost": _decimal_to_number(values[2]),
            "totalCost":    _decimal_to_number(values[3]),
        })

    # Java line 564-570: LinkedHashMap[stack, series] outer; series items Map.of(2) {name, stack}
    options = {
        "stack": True,
        "series": [
            _new_cost_series_entry(name=COST_CATEGORY_MATERIAL, stack="cost"),
            _new_cost_series_entry(name=COST_CATEGORY_LABOR,    stack="cost"),
            _new_cost_series_entry(name=COST_CATEGORY_OVERHEAD, stack="cost"),
        ],
    }

    return _new_chart_config_dict(
        chart_type="BAR",
        title="成本趋势分析",
        series_field="costType",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="totalCost",
    )


async def _get_receivable_aging_chart(factory_id: str, end_date: date) -> dict:
    """F999 empty-state — Java getReceivableAgingChart ALWAYS emits 4 aging buckets
    even when AR=0 (per A.2). chartType=BAR (NOT PIE). A.5 golden verified shape.

    4 buckets (in order): 0-30天 (GREEN), 31-60天 (YELLOW), 61-90天 (YELLOW), 90天以上 (RED).
    Each bucket: {agingBucket, amount=0, percentage=0, alertLevel}.
    options={colors: ["#91cc75", "#fac858", "#ee6666", "#c23531"], showAlert: true}.
    """
    return _new_chart_config_dict(
        chart_type="BAR",
        title="应收账款账龄分布",
        series_field=None,
        data=[
            {"agingBucket": "0-30天",  "amount": 0, "percentage": 0, "alertLevel": "GREEN"},
            {"agingBucket": "31-60天", "amount": 0, "percentage": 0, "alertLevel": "YELLOW"},
            {"agingBucket": "61-90天", "amount": 0, "percentage": 0, "alertLevel": "YELLOW"},
            {"agingBucket": "90天以上","amount": 0, "percentage": 0, "alertLevel": "RED"},
        ],
        options={
            "colors": ["#91cc75", "#fac858", "#ee6666", "#c23531"],
            "showAlert": True,
        },
        xaxis_field="agingBucket",
        yaxis_field="amount",
    )


# ============================================================
# Section 3b: Payable sub-services real impls (Phase E)
# Mirror Java FinanceAnalysisServiceImpl getPayableMetrics + getPayableAgingChart.
# Differs from receivable: NO alertLevel per bucket, NO showAlert option.
# ============================================================


async def _get_payable_metrics(factory_id: str, end_date: date) -> list:
    """Real impl mirroring Java FinanceAnalysisServiceImpl.getPayableMetrics (line 870-918).

    Returns 2 MetricResults ALWAYS (even when 0 rows):
      - AP_BALANCE: 应付余额 = sum(payableAmount) - sum(paymentAmount)
      - AP_TURNOVER_DAYS: (apBalance/2) / (totalPayment/365)

    Empty case: both metrics emit value=0.0 / formattedValue per Java behavior.
    """
    rows = await _query_finance_payable_data(factory_id, end_date)

    total_payable = sum(
        (_to_decimal(r.get("payable_amount")) for r in rows),
        Decimal("0"),
    )
    total_payment = sum(
        (_to_decimal(r.get("payment_amount")) for r in rows),
        Decimal("0"),
    )

    ap_balance = total_payable - total_payment

    # AP_TURNOVER_DAYS calc per Java line 902-906:
    #   avgPayable = apBalance / 2 (scale=4, HALF_UP)
    #   dailyPayment = totalPayment / 365 (scale=4, HALF_UP)
    #   turnoverDays = dailyPayment > 0 ? avgPayable / dailyPayment (scale=4, HALF_UP) : 0
    avg_payable = (ap_balance / Decimal("2")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    daily_payment = (total_payment / Decimal("365")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if daily_payment > Decimal("0"):
        turnover_days = (avg_payable / daily_payment).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        turnover_days = Decimal("0")

    return [
        _new_metric_result_dict(
            metric_code="AP_BALANCE",
            metric_name="应付余额",
            value=_decimal_to_number(ap_balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            formatted_value=_format_currency(ap_balance),
            unit="元",
            alert_level="GREEN",
            description="尚未支付的应付账款总额",
        ),
        _new_metric_result_dict(
            metric_code="AP_TURNOVER_DAYS",
            metric_name="应付周转天数",
            value=_decimal_to_number(turnover_days.quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
            formatted_value=str(turnover_days.quantize(Decimal("1"), rounding=ROUND_HALF_UP)) + "天",
            unit="天",
            alert_level="GREEN",
            description="平均付款周期",
        ),
    ]


async def _get_payable_aging_chart(factory_id: str, end_date: date) -> dict:
    """Real impl mirroring Java FinanceAnalysisServiceImpl.getPayableAgingChart (line 832-867).

    Always emits 4 buckets in fixed order. data items have 3 keys:
    {agingBucket, amount, percentage} — NO alertLevel (differs from receivable).
    options has 1 key: {colors: [...]} — NO showAlert (differs from receivable).

    Bucket assignment (per calculatePayableAgingBuckets line 1529-1561):
      outstanding = payableAmount - paymentAmount; skip if outstanding <= 0
      bucket by aging_days: <=30 / <=60 / <=90 / else
    """
    rows = await _query_finance_payable_data(factory_id, end_date)

    buckets: dict[str, Decimal] = {
        "0-30天":   Decimal("0"),
        "31-60天":  Decimal("0"),
        "61-90天":  Decimal("0"),
        "90天以上": Decimal("0"),
    }

    for r in rows:
        payable = _to_decimal(r.get("payable_amount"))
        payment = _to_decimal(r.get("payment_amount"))
        outstanding = payable - payment
        if outstanding <= Decimal("0"):
            continue
        aging = r.get("aging_days") or 0
        if aging <= 30:
            buckets["0-30天"] += outstanding
        elif aging <= 60:
            buckets["31-60天"] += outstanding
        elif aging <= 90:
            buckets["61-90天"] += outstanding
        else:
            buckets["90天以上"] += outstanding

    total_ap = sum(buckets.values(), Decimal("0"))

    chart_data = []
    for bucket_name in ("0-30天", "31-60天", "61-90天", "90天以上"):
        amount = buckets[bucket_name]
        if total_ap > Decimal("0"):
            pct = (amount / total_ap).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) * Decimal("100")
        else:
            pct = Decimal("0")
        chart_data.append({
            "agingBucket": bucket_name,
            "amount": _decimal_to_number(amount),
            "percentage": _decimal_to_number(pct),
        })

    return _new_chart_config_dict(
        chart_type="BAR",
        title="应付账款账龄分布",
        series_field=None,
        data=chart_data,
        options={"colors": ["#73c0de", "#5470c6", "#9a60b4", "#ea7ccc"]},
        xaxis_field="agingBucket",
        yaxis_field="amount",
    )


# ============================================================
# Section 4: Composite + per-type assembly (Phase C.2 + Phase E.4)
# ============================================================


async def _get_comprehensive_finance_analysis(factory_id: str, range_: DateRange) -> dict:
    """Java reference: SmartBIServiceImpl.getComprehensiveAnalysis line 600-605 + 612-613.

    A.5 recorded F999 Jackson key order (NOT Java put-order):
      [overview, costStructure, dateRange, generatedAt, profitMetrics, receivableAging]
    """
    overview         = await _get_finance_overview(factory_id, range_)
    profit_metrics   = await _get_profit_metrics(factory_id, range_)
    cost_structure   = await _get_cost_structure_chart(factory_id, range_.start_date, range_.end_date)
    receivable_aging = await _get_receivable_aging_chart(factory_id, range_.end_date)

    return {
        "overview":         overview,
        "costStructure":    cost_structure,
        "dateRange":        _new_date_range_dict(range_),
        "generatedAt":      _utc_now_iso(),
        "profitMetrics":    profit_metrics,
        "receivableAging":  receivable_aging,
    }


async def _get_cost_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java SmartBIAnalysisController.getFinanceAnalysis cost branch line 247-249.

    Java HashMap put order: startDate / endDate / structureChart / trendChart
    Recorded F999 Jackson order (HashMap hash, NOT put-order):
      [endDate, trendChart, startDate, structureChart]
    Source: tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json
    """
    structure_chart = await _get_cost_structure_chart(factory_id, start_date, end_date)
    trend_chart     = await _get_cost_trend_chart(factory_id, start_date, end_date, "MONTH")

    return {
        "endDate":        end_date.isoformat(),
        "trendChart":     trend_chart,
        "startDate":      start_date.isoformat(),
        "structureChart": structure_chart,
    }


async def _get_profit_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 240-246.

    Java HashMap put-order: startDate / endDate / metrics / trendChart.
    Recorded F999 Jackson order in golden (A.3 verified):
      [endDate, metrics, trendChart, startDate]

    Period hardcoded to "MONTH" (Java controller line 246).
    """
    range_ = DateRange.custom(start_date, end_date)
    metrics = await _get_profit_metrics(factory_id, range_)
    trend_chart = await _get_profit_trend_chart(
        factory_id, start_date, end_date, "MONTH"
    )

    return {
        "endDate": end_date.isoformat(),
        "metrics": metrics,
        "trendChart": trend_chart,
        "startDate": start_date.isoformat(),
    }


async def _get_payable_analysis(factory_id: str, start_date: date, end_date: date) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 240-258.

    Java put order in HashMap (line 240-241 + 255-258):
      startDate / endDate / metrics / agingChart

    F.1 recorded F999 Jackson key order (NOT Java put-order, since HashMap is unordered):
      [endDate, metrics, agingChart, startDate]
    """
    metrics = await _get_payable_metrics(factory_id, end_date)
    aging_chart = await _get_payable_aging_chart(factory_id, end_date)

    return {
        "endDate":    end_date.isoformat(),
        "metrics":    metrics,
        "agingChart": aging_chart,
        "startDate":  start_date.isoformat(),
    }


# ============================================================
# Section 5: Route handler
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance")
async def get_finance_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    analysisType: Optional[str] = Query(None, alias="analysisType"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 222-274.

    Branches:
      analysisType empty       → composite (6-key Map via getComprehensiveAnalysis)
      analysisType=payable     → payable per-type (4-key shape, real impl Phase E)
      analysisType=other       → 501 envelope (un-ported, see spec §6 / §12)
    """
    range_ = DateRange.custom(startDate, endDate)

    if not analysisType:
        result = await _get_comprehensive_finance_analysis(auth.factory_id, range_)
        return wrap_response(result)

    if analysisType == "payable":
        result = await _get_payable_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    if analysisType == "profit":
        result = await _get_profit_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    if analysisType == "cost":
        result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python，请暂用 Java endpoint 或等待 phase2a/t-finance-perX 副轨完成",
    )


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement")
async def get_budget_achievement(
    factory_id: str,
    year: int = Query(...),
    metric: str = Query("revenue"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getBudgetAchievementChart line 276-292."""
    result = await _get_budget_achievement_chart(auth.factory_id, year, metric)
    return wrap_response(result)
