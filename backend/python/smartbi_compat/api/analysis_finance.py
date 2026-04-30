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

import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

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
        from smartbi.config import get_pg_pool  # type: ignore
        pool = await get_pg_pool()
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
    """F999 empty-state — Java getProfitMetrics ALWAYS returns 5 metrics regardless
    of data presence (per A.2). Values match A.5 golden when revenue/cost = 0.

    GROSS_PROFIT: value=0.0, formattedValue="0.00", unit="元", alertLevel="GREEN"
    GROSS_MARGIN: value=0.0, formattedValue="0.00%", unit="%", alertLevel="RED"
    NET_PROFIT:   value=null, formattedValue="N/A",  unit="元", alertLevel="GREEN"
    NET_MARGIN:   value=null, formattedValue="N/A",  unit="%",  alertLevel="GREEN"
    ROI:          value=0.0,  formattedValue="0.00%",unit="%",  alertLevel="YELLOW"
    """
    return [
        _new_metric_result_dict(
            metric_code="GROSS_PROFIT",
            metric_name="毛利额",
            value=0.0,
            formatted_value="0.00",
            unit="元",
            change_percent=None,
            change_direction=None,
            change_value=None,
            alert_level="GREEN",
            dimension_value=None,
            description="销售收入减去销售成本",
        ),
        _new_metric_result_dict(
            metric_code="GROSS_MARGIN",
            metric_name="毛利率",
            value=0.0,
            formatted_value="0.00%",
            unit="%",
            change_percent=None,
            change_direction=None,
            change_value=None,
            alert_level="RED",
            dimension_value=None,
            description="毛利额占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="NET_PROFIT",
            metric_name="净利润",
            value=None,
            formatted_value="N/A",
            unit="元",
            change_percent=None,
            change_direction=None,
            change_value=None,
            alert_level="GREEN",
            dimension_value=None,
            description="毛利减去各项费用后的利润",
        ),
        _new_metric_result_dict(
            metric_code="NET_MARGIN",
            metric_name="净利率",
            value=None,
            formatted_value="N/A",
            unit="%",
            change_percent=None,
            change_direction=None,
            change_value=None,
            alert_level="GREEN",
            dimension_value=None,
            description="净利润占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="ROI",
            metric_name="投入产出比",
            value=0.0,
            formatted_value="0.00%",
            unit="%",
            change_percent=None,
            change_direction=None,
            change_value=None,
            alert_level="YELLOW",
            dimension_value=None,
            description="毛利额与成本的比率",
        ),
    ]


async def _get_cost_structure_chart(factory_id: str, range_: DateRange) -> dict:
    """F999 empty-state — Java getCostStructureChart returns ChartConfig with empty data.
    A.5 golden verified shape: chartType=PIE, title='成本结构分析',
    xaxisField='category', yaxisField='value', seriesField=null, data=[],
    options={showPercentage: true, colors: ["#5470c6", "#91cc75", "#fac858"]}.
    """
    return _new_chart_config_dict(
        chart_type="PIE",
        title="成本结构分析",
        series_field=None,
        data=[],
        options={
            "showPercentage": True,
            "colors": ["#5470c6", "#91cc75", "#fac858"],
        },
        xaxis_field="category",
        yaxis_field="value",
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
    cost_structure   = await _get_cost_structure_chart(factory_id, range_)
    receivable_aging = await _get_receivable_aging_chart(factory_id, range_.end_date)

    return {
        "overview":         overview,
        "costStructure":    cost_structure,
        "dateRange":        _new_date_range_dict(range_),
        "generatedAt":      _utc_now_iso(),
        "profitMetrics":    profit_metrics,
        "receivableAging":  receivable_aging,
    }


async def _get_payable_analysis(factory_id: str, start_date: date, end_date: date) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 240-258.

    Java put order in HashMap (line 240-241 + 255-258):
      startDate / endDate / metrics / agingChart

    Note: Java uses `new HashMap<>()` so put-order ≠ Jackson serialization order.
    Phase F.1 will record F999 golden and verify the actual Jackson key order.
    If golden differs from this dict order, F.1 step 3 will reorder.
    """
    metrics = await _get_payable_metrics(factory_id, end_date)
    aging_chart = await _get_payable_aging_chart(factory_id, end_date)

    return {
        "startDate":  start_date.isoformat(),
        "endDate":    end_date.isoformat(),
        "metrics":    metrics,
        "agingChart": aging_chart,
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

    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python，请暂用 Java endpoint 或等待 phase2a/t-finance-perX 副轨完成",
    )
