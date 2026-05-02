"""Phase 2A: /analysis/procurement per-type real impl (PR-A: supplier + cost + trend).

Mirrors Java SmartBIAnalysisController.getProcurementAnalysis (line 452-486)
+ ProcurementAnalysisServiceImpl 7 sub-services. PR-A scope: 3 per-type modes
(supplier / cost / trend). PR-B (Chat 5) adds default mode = overview DashboardResponse.

See spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query

logger = logging.getLogger(__name__)

from smartbi_compat.api.analysis_finance import (
    _decimal_to_number,
    _fetch_all,
    _get_period_key,
    _strip_volatile,
    _to_decimal,
    _utc_now_iso,
    VOLATILE_KEYS,
)
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

# T1: 3 inline threshold pairs (alert_thresholds.json has NO procurement section, verified)
_PROCUREMENT_ON_TIME_RED          = Decimal("70")
_PROCUREMENT_ON_TIME_YELLOW       = Decimal("85")
_PROCUREMENT_QUALITY_RED          = Decimal("90")
_PROCUREMENT_QUALITY_YELLOW       = Decimal("95")
# T1 INVERSE direction: high concentration = high risk
_PROCUREMENT_CONCENTRATION_RED    = Decimal("60")
_PROCUREMENT_CONCENTRATION_YELLOW = Decimal("40")

# Java SCALE constants (mirror ProcurementAnalysisServiceImpl line 52-54)
_SCALE             = Decimal("0.0001")
_DISPLAY_SCALE     = Decimal("0.01")
_QUANTIZE_HALF_UP  = ROUND_HALF_UP


router = APIRouter()


async def _query_material_batches_in_range(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getBatchesInDateRange (line 451-456) but as explicit SQL.

    T3 fix: Java JPA derived `findByFactoryIdAndStatus(factoryId, AVAILABLE).stream()
    .filter(receiptDate in [start, end])` has NO ORDER BY → row order non-deterministic.
    Python adds explicit `ORDER BY id` for byte-shape determinism.
    Soft-delete: WHERE deleted_at IS NULL (mirror @Where annotation on entity).
    Rule 5: SELECT * future-proof. Rule 6: input boundary None-check.
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_material_batches_in_range: start_date / end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND status = 'AVAILABLE'
          AND deleted_at IS NULL
          AND receipt_date BETWEEN $2 AND $3
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, start_date, end_date)


async def _query_active_suppliers(factory_id: str) -> list[dict]:
    """Mirror Java SupplierRepository.findByFactoryIdAndIsActive(factoryId, true).
    JPA derived query has NO ORDER BY → Python adds explicit ORDER BY id.
    @Where(deleted_at IS NULL) on Supplier.java:33 — mirror.
    """
    sql = """
        SELECT *
        FROM suppliers
        WHERE factory_id = $1
          AND is_active = true
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id)


async def _query_supplier_by_id(supplier_id: str, factory_id: str) -> Optional[dict]:
    """Mirror Java SupplierRepository.findById(supplierId), but with explicit
    factory_id filter (T11 — safer than Java which has cross-factory leak risk).
    Returns None if not found (mirror Optional.empty()).
    """
    if supplier_id is None:
        return None
    sql = """
        SELECT *
        FROM suppliers
        WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL
        LIMIT 1
    """
    rows = await _fetch_all(sql, supplier_id, factory_id)
    return rows[0] if rows else None


def _calculate_total_value(batches: list[dict]) -> Decimal:
    """Mirror Java calculateTotalValue (line 540-545) + getTotalValue() @Transient
    (line 216-219): unitPrice × receiptQuantity, ZERO when either null.
    """
    total = Decimal("0")
    for b in batches:
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        if up is not None and rq is not None:
            total += _to_decimal(up) * _to_decimal(rq)
    return total


def _calculate_average_unit_price(batches: list[dict]) -> Decimal:
    """Mirror Java calculateAverageUnitPrice (line 550-563): filter unit_price > 0,
    then sum / count, SCALE=4 HALF_UP.
    """
    prices = []
    for b in batches:
        up = b.get("unit_price")
        if up is not None:
            up_dec = _to_decimal(up)
            if up_dec > Decimal("0"):
                prices.append(up_dec)
    if not prices:
        return Decimal("0")
    total = sum(prices, Decimal("0"))
    return (total / Decimal(len(prices))).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)


def _calculate_supplier_concentration(batches: list[dict]) -> Decimal:
    """Mirror Java calculateSupplierConcentration: groupBy supplier_id, max/total*100.
    Returns max supplier % (0-100). T1 inverse: > 60 = RED risk.
    """
    supplier_values: dict[str, Decimal] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv
    if not supplier_values:
        return Decimal("0")
    total = sum(supplier_values.values(), Decimal("0"))
    if total <= Decimal("0"):
        return Decimal("0")
    max_value = max(supplier_values.values())
    return ((max_value / total).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
            * Decimal("100"))


def _calculate_mom_growth(current: Optional[Decimal], previous: Optional[Decimal]) -> Decimal:
    """Mirror Java MetricCalculatorServiceImpl.calculateMomGrowth (line 425-438).

    T9 — 3 edge cases + .abs(previous) denom:
    - previous None or == 0 → if current > 0: 100; else 0
    - current None (with non-zero previous) → -100
    - else: (current - previous) / abs(previous) * 100, SCALE=4 then DISPLAY_SCALE=2 HALF_UP

    Critical: abs() on denom prevents sign-flip when previous is negative.
    e.g. previous=-50, current=10 → 60/50 = 1.20 → 120 (positive growth shown).
    """
    if previous is None or previous == Decimal("0"):
        if current is not None and current > Decimal("0"):
            return Decimal("100")
        return Decimal("0")
    if current is None:
        return Decimal("-100")
    diff = current - previous
    return ((diff / abs(previous)).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
            * Decimal("100")).quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)


def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java formatCurrency (line 1138-1143):
        if (value == null) return "-";
        return String.format("%,.2f", value.setScale(2, HALF_UP).doubleValue());
    """
    if value is None:
        return "-"
    quantized = value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return f"{float(quantized):,.2f}"


def _minus_months(d: date, n: int) -> date:
    """Mirror Java LocalDate.minusMonths(n) — calendar-month arithmetic respecting EoM.
    Uses python-dateutil relativedelta for end-of-month behavior matching Java.
    """
    return d - relativedelta(months=n)


def _determine_on_time_alert_level(delivery_rate: Decimal) -> str:
    """Mirror Java determineOnTimeAlertLevel (line 1080-1091): RED < 70, YELLOW < 85, GREEN."""
    if delivery_rate < _PROCUREMENT_ON_TIME_RED:
        return "RED"
    if delivery_rate < _PROCUREMENT_ON_TIME_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_quality_alert_level(quality_rate: Decimal) -> str:
    """Mirror Java determineQualityAlertLevel (line 1096-1103): RED < 90, YELLOW < 95, GREEN."""
    if quality_rate < _PROCUREMENT_QUALITY_RED:
        return "RED"
    if quality_rate < _PROCUREMENT_QUALITY_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_concentration_alert_level(concentration: Decimal) -> str:
    """Mirror Java determineConcentrationAlertLevel (line 1109-1116) — T1 INVERSE direction:
        if (> 60) RED; if (> 40) YELLOW; else GREEN.
    Note strict `>` not `>=`: 40.0 → GREEN, 60.0 → YELLOW, 60.01 → RED.
    """
    if concentration > _PROCUREMENT_CONCENTRATION_RED:
        return "RED"
    if concentration > _PROCUREMENT_CONCENTRATION_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_change_direction(change_percent: Optional[Decimal]) -> str:
    """Mirror Java determineChangeDirection (line 1122-1133): null/0=STABLE, >0=UP, <0=DOWN."""
    if change_percent is None:
        return "STABLE"
    if change_percent > Decimal("0"):
        return "UP"
    if change_percent < Decimal("0"):
        return "DOWN"
    return "STABLE"


def _calculate_price_score(supplier: dict, supplier_batches: list) -> Decimal:
    """Mirror Java calculatePriceScore (line 596-601): rating × 20, default 70 if rating null."""
    rating = supplier.get("rating")
    if rating is None:
        return Decimal("70")
    return Decimal(str(rating)) * Decimal("20")


def _calculate_quality_score(supplier_batches: list) -> Decimal:
    """Mirror Java calculateQualityScore (line 606-618):
        availableCount / totalBatches × 100. Empty batches → ZERO.
    """
    if not supplier_batches:
        return Decimal("0")
    available_count = sum(1 for b in supplier_batches if b.get("status") == "AVAILABLE")
    return ((Decimal(available_count) / Decimal(len(supplier_batches)))
            .quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
            * Decimal("100"))


def _calculate_delivery_score(supplier: dict, supplier_batches: list) -> Decimal:
    """Mirror Java calculateDeliveryScore (line 623-632): hardcoded 85 always.
    Java line 631 falls through to `return new BigDecimal("85")` regardless of branch.
    """
    return Decimal("85")


def _calculate_service_score(supplier: dict) -> Decimal:
    """Mirror Java calculateServiceScore (line 637-643): rating × 20, default 70."""
    rating = supplier.get("rating")
    if rating is None:
        return Decimal("70")
    return Decimal(str(rating)) * Decimal("20")


def _calculate_stability_score(supplier_batches: list) -> Decimal:
    """Mirror Java calculateStabilityScore (line 648-679): variance-CV based.
    Default 80 when batches.size() < 2 OR no quantities OR avg=0.
    score = 100 - cv*100, clamped [0, 100].
    """
    if len(supplier_batches) < 2:
        return Decimal("80")
    quantities = []
    for b in supplier_batches:
        q = b.get("receipt_quantity")
        if q is not None:
            quantities.append(_to_decimal(q))
    if not quantities:
        return Decimal("80")
    avg = (sum(quantities, Decimal("0")) / Decimal(len(quantities))).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP)
    if avg == Decimal("0"):
        return Decimal("80")
    variance = (sum(((q - avg) ** 2 for q in quantities), Decimal("0"))
                / Decimal(len(quantities))).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
    # Java line 675: variance.sqrt(MathContext(10)).divide(avg, SCALE=4, HALF_UP)
    # Decimal.sqrt requires Python 3.8+ via context; use float() bridge for sqrt
    cv = (Decimal(str(float(variance) ** 0.5)) / avg).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP)
    score = Decimal("100") - cv * Decimal("100")
    return max(Decimal("0"), min(score, Decimal("100")))


async def _get_supplier_evaluation(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getSupplierEvaluation (line 126-187). RADAR ChartConfig with 5 dimensions.

    T5: dimensions/dimensionNames are Arrays.asList(5) — declaration order preserved.
    Rule 9 §9.1: ChartConfig field is 'xaxisField' (lowercase 'a').
    Rule 9 §9.2: ChartConfig has 7 emit-all fields, key order from golden:
        [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    suppliers = await _query_active_suppliers(factory_id)

    chart_data = []
    for supplier in suppliers:
        supplier_batches = [b for b in batches if b.get("supplier_id") == supplier["id"]]
        if not supplier_batches:
            continue
        # Java line 145-167: LinkedHashMap put-order
        chart_data.append({
            "supplierName":         supplier["name"],
            "priceCompetitiveness": _decimal_to_number(_calculate_price_score(supplier, supplier_batches)),
            "qualityPassRate":      _decimal_to_number(_calculate_quality_score(supplier_batches)),
            "onTimeDelivery":       _decimal_to_number(_calculate_delivery_score(supplier, supplier_batches)),
            "serviceResponse":      _decimal_to_number(_calculate_service_score(supplier)),
            "supplyStability":      _decimal_to_number(_calculate_stability_score(supplier_batches)),
        })

    # Java line 172-178: LinkedHashMap put-order [showLegend, maxValue, dimensions, dimensionNames]
    options = {
        "showLegend": True,
        "maxValue":   100,
        "dimensions": [
            "priceCompetitiveness", "qualityPassRate", "onTimeDelivery",
            "serviceResponse",      "supplyStability",
        ],
        "dimensionNames": [
            "价格竞争力", "质量合格率", "准时交付", "服务响应", "供货稳定",
        ],
    }

    # Rule 9 §9.2: ChartConfig 7-field shape, golden-verified key order:
    # [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    return {
        "chartType":   "RADAR",
        "title":       "供应商综合评估",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "supplierName",
        "yaxisField":  None,
    }


async def _get_supplier_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getSupplierRanking (line 333-340) — delegates to _calculate_supplier_ranking_from_data."""
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    return await _calculate_supplier_ranking_from_data(factory_id, batches)


async def _calculate_supplier_ranking_from_data(
    factory_id: str, batches: list[dict]
) -> list[dict]:
    """Mirror Java calculateSupplierRankingFromData (line 684-738).
    T11: Python uses _query_supplier_by_id with factory_id filter (safer than Java).
    RankingItem field order (Lombok @Builder): [rank, name, value, target, completionRate, alertLevel].
    """
    supplier_values: dict[str, Decimal] = {}
    supplier_batch_counts: dict[str, int] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv
        supplier_batch_counts[sid] = supplier_batch_counts.get(sid, 0) + 1

    if not supplier_values:
        return []

    total_value = sum(supplier_values.values(), Decimal("0"))
    sorted_entries = sorted(supplier_values.items(), key=lambda kv: kv[1], reverse=True)

    rankings = []
    for rank, (sid, value) in enumerate(sorted_entries, start=1):
        batch_count = supplier_batch_counts.get(sid, 0)
        if total_value > Decimal("0"):
            percentage = ((value / total_value).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
                          * Decimal("100"))
        else:
            percentage = Decimal("0")
        supplier = await _query_supplier_by_id(sid, factory_id)
        supplier_name = supplier["name"] if supplier else sid

        supplier_batches = [b for b in batches if b.get("supplier_id") == sid]
        quality_rate = _calculate_quality_score(supplier_batches)
        alert_level = _determine_quality_alert_level(quality_rate)

        rankings.append({
            "rank":           rank,
            "name":           supplier_name,
            "value":          _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "target":         _decimal_to_number(Decimal(batch_count)),
            "completionRate": _decimal_to_number(percentage.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "alertLevel":     alert_level,
        })
    return rankings


async def _get_cost_metrics(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getCostMetrics (line 282-329). 4-or-5 metrics (5 when previous period non-empty).

    Rule 9 §9.3 MetricResult 11-field shape, golden-verified key order:
      [metricCode, metricName, value, formattedValue, unit,
       changePercent, changeDirection, changeValue, alertLevel, dimensionValue, description]

    Java line 471-475 always emits PROCUREMENT_AMOUNT/BATCH_COUNT/AVG_UNIT_PRICE with alertLevel=GREEN.
    MAX_UNIT_PRICE conditional on any non-null unit_price (Java line 305 isPresent).
    PROCUREMENT_MOM_GROWTH conditional on previous period non-empty (Java line 321).
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)
    metrics: list[dict] = []

    total_amount = _calculate_total_value(batches)
    metrics.append(_metric_result_of("PROCUREMENT_AMOUNT", "采购总额", total_amount, "元"))
    metrics.append(_metric_result_of("BATCH_COUNT", "采购批次", Decimal(len(batches)), "批"))
    metrics.append(_metric_result_of("AVG_UNIT_PRICE", "平均单价",
                                     _calculate_average_unit_price(batches), "元"))

    # Java line 302-314: MAX_UNIT_PRICE conditional on any non-null unit_price
    valid_priced = [b for b in batches if b.get("unit_price") is not None]
    if valid_priced:
        max_batch = max(valid_priced, key=lambda b: _to_decimal(b["unit_price"]))
        metrics.append({
            "metricCode":      "MAX_UNIT_PRICE",
            "metricName":      "最高单价",
            "value":           _decimal_to_number(_to_decimal(max_batch["unit_price"])),
            "formattedValue":  None,
            "unit":            "元",
            "changePercent":   None,
            "changeDirection": None,
            "changeValue":     None,
            "alertLevel":      "GREEN",
            "dimensionValue":  max_batch.get("material_type_id"),
            "description":     None,
        })

    # Java line 317-326: MoM growth conditional on previous period non-empty
    previous_start = _minus_months(start_date, 1)
    previous_end = _minus_months(end_date, 1)
    previous_batches = await _query_material_batches_in_range(factory_id, previous_start, previous_end)
    if previous_batches:
        previous_amount = _calculate_total_value(previous_batches)
        mom_growth = _calculate_mom_growth(total_amount, previous_amount)
        direction = _determine_change_direction(mom_growth)
        metrics.append({
            "metricCode":      "PROCUREMENT_MOM_GROWTH",
            "metricName":      "采购环比增长",
            "value":           _decimal_to_number(mom_growth.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "formattedValue":  None,
            "unit":            "%",
            "changePercent":   _decimal_to_number(mom_growth),
            "changeDirection": direction,
            "changeValue":     None,    # Java MetricResult.ofWithTrend Lombok @Builder default (null)
            "alertLevel":      "GREEN", # Java MetricResult.ofWithTrend line 162 always sets GREEN
            "dimensionValue":  None,
            "description":     None,
        })

    return metrics


def _metric_result_of(metric_code: str, metric_name: str, value: Decimal, unit: str) -> dict:
    """Mirror Java MetricResult.of(code, name, value, unit) — basic factory.
    Always sets alertLevel='GREEN' (per Java line 471-475 explicit GREEN for KPI cards).
    Rule 9 §9.3 11-field shape, golden-verified key order.
    """
    return {
        "metricCode":      metric_code,
        "metricName":      metric_name,
        "value":           _decimal_to_number(value if isinstance(value, Decimal) else Decimal(value)),
        "formattedValue":  None,
        "unit":            unit,
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      "GREEN",
        "dimensionValue":  None,
        "description":     None,
    }


async def _get_purchase_cost_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getPurchaseCostAnalysis (line 241-280). PIE chart by material category.
    T4: groupBy + sort-by-value-desc deterministic.
    Rule 9 ChartConfig 7-field shape, golden-verified key order:
      [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        category_values[mtid] = category_values.get(mtid, Decimal("0")) + tv

    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)
    chart_data = [
        {
            "category": mtid,
            "value":    _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        }
        for mtid, value in sorted_entries
    ]

    options = {"showPercentage": True, "showLegend": True}

    return {
        "chartType":   "PIE",
        "title":       "采购成本分布",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "category",
        "yaxisField":  "value",
    }


async def _get_material_category_ranking(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java getMaterialCategoryRanking (line 342-383). RankingItem with NO target,
    alertLevel always GREEN per Java line 378.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        category_values[mtid] = category_values.get(mtid, Decimal("0")) + tv

    if not category_values:
        return []

    total_value = sum(category_values.values(), Decimal("0"))
    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)

    rankings = []
    for rank, (mtid, value) in enumerate(sorted_entries, start=1):
        if total_value > Decimal("0"):
            percentage = ((value / total_value).quantize(_SCALE, rounding=_QUANTIZE_HALF_UP)
                          * Decimal("100"))
        else:
            percentage = Decimal("0")
        rankings.append({
            "rank":           rank,
            "name":           mtid,
            "value":          _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "target":         None,
            "completionRate": _decimal_to_number(percentage.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "alertLevel":     "GREEN",
        })
    return rankings


async def _get_procurement_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """Mirror Java getProcurementTrendChart + buildProcurementTrendChartFromData (line 744-782).

    Period dispatch (Java line 747-758):
      DAY   → b.getReceiptDate().toString()  (ISO yyyy-MM-dd)
      WEEK  → date.with(previousOrSame(MONDAY)).toString()  (ISO yyyy-MM-dd of Monday)
      MONTH → year + "-" + month%02d         (default for procurement trend mode)

    Note: Java WEEK uses Monday-of-week ISO date, NOT Rule 2 ISO-week format.
    PR-A trend mode hardcodes MONTH so Rule 2 finance fix doesn't apply here.

    TreeMap → sorted dict keys for byte determinism. ChartConfig 7-field shape.
    Rule 9 §9.2: ChartConfig has 7 emit-all fields, key order from golden:
        [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    period_upper = period.upper()
    period_values: dict[str, Decimal] = {}
    for b in batches:
        rd = b.get("receipt_date")
        if rd is None:
            continue
        if period_upper == "WEEK":
            from datetime import timedelta
            week_start = rd - timedelta(days=rd.weekday())
            period_key = week_start.isoformat()
        elif period_upper == "MONTH":
            period_key = f"{rd.year}-{rd.month:02d}"
        else:    # DAY default
            period_key = rd.isoformat()
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        period_values[period_key] = period_values.get(period_key, Decimal("0")) + tv

    sorted_keys = sorted(period_values.keys())
    chart_data = [
        {
            "date":   k,
            "amount": _decimal_to_number(
                period_values[k].quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for k in sorted_keys
    ]

    options = {"showDataLabels": False, "smooth": True}

    return {
        "chartType":   "LINE",
        "title":       "采购趋势",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "date",
        "yaxisField":  "amount",
    }


# ---------------------------------------------------------------------------
# Task 12: Mode dispatcher + GET endpoint
# ---------------------------------------------------------------------------

async def _get_procurement_analysis(
    factory_id: str, start_date: date, end_date: date, analysis_type: Optional[str]
) -> dict:
    """Mirror Java SmartBIAnalysisController.getProcurementAnalysis 4-mode dispatch.
    PR-A: supplier / cost / trend modes only. PR-B (Chat 5) adds default = overview.

    Top-level dict key orders verified from F999 goldens (Java HashMap hash-iter):
      supplier: [evaluation, endDate, ranking, startDate]
      cost:     [endDate, categoryRanking, metrics, startDate, costAnalysis]
      trend:    [endDate, trendChart, startDate]
    """
    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()

    if analysis_type == "supplier":
        ranking    = await _get_supplier_ranking(factory_id, start_date, end_date)
        evaluation = await _get_supplier_evaluation(factory_id, start_date, end_date)
        return {
            "evaluation": evaluation,
            "endDate":    end_iso,
            "ranking":    ranking,
            "startDate":  start_iso,
        }

    if analysis_type == "cost":
        metrics          = await _get_cost_metrics(factory_id, start_date, end_date)
        cost_analysis    = await _get_purchase_cost_analysis(factory_id, start_date, end_date)
        category_ranking = await _get_material_category_ranking(factory_id, start_date, end_date)
        return {
            "endDate":         end_iso,
            "categoryRanking": category_ranking,
            "metrics":         metrics,
            "startDate":       start_iso,
            "costAnalysis":    cost_analysis,
        }

    if analysis_type == "trend":
        trend_chart = await _get_procurement_trend_chart(factory_id, start_date, end_date, "MONTH")
        return {
            "endDate":    end_iso,
            "trendChart": trend_chart,
            "startDate":  start_iso,
        }

    # default mode (overview DashboardResponse) — out of PR-A scope, Chat 5 ships PR-B
    raise NotImplementedError(
        "procurement default (overview) mode is PR-B scope (Chat 5); "
        "PR-A only handles analysisType=supplier/cost/trend"
    )


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/procurement")
async def get_procurement_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    analysisType: Optional[str] = Query(None),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.getProcurementAnalysis (line 452-486)."""
    result = await _get_procurement_analysis(factory_id, startDate, endDate, analysisType)
    return wrap_response(result)
