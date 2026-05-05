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
    # NOTE: Java entity field is `receiptDate` but DB column is `inbound_date`
    # (per @Column(name = "inbound_date") in MaterialBatch.java). Spec called
    # this column `receipt_date` based on Java field name; DB doesn't have
    # that column. Surfaced by SMOKE_REAL_DB=1 smoke gate (PR-E) post-fix
    # for db wiring, returning UndefinedColumnError on `receipt_date`.
    # Read via SELECT * keeps row dict accessible by either alias name.
    sql = """
        SELECT *, inbound_date AS receipt_date
        FROM material_batches
        WHERE factory_id = $1
          AND status = 'AVAILABLE'
          AND deleted_at IS NULL
          AND inbound_date BETWEEN $2 AND $3
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
# PR-B: default mode (overview DashboardResponse)
#
# Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md §3.11-3.13
# Rule 9 §9.2 catch: spec §3.11 listed 6-key DashboardResponse shape, but F999 golden
# (analysis-procurement-F999.json) shows 16 keys (Lombok @Data + no @JsonInclude
# emits all). Inventory PR-B (#54) already shipped this 16-key pattern; mirror it.
#
# AIInsight 5-key order (golden-verified): [level, category, message, relatedEntity, actionSuggestion]
# Top-level data key order (default mode, Jackson HashMap hash-iter): [overview, endDate, startDate]
# ---------------------------------------------------------------------------


def _build_empty_dashboard() -> dict:
    """Mirror Java buildEmptyDashboard (line 1011-1025).

    Returns the full 16-key DashboardResponse envelope (Lombok @Data emits all fields
    regardless of population). Mirrors inventory PR-B (#54) `_build_empty_dashboard`
    with procurement-specific strings per spec §3.11 Round 4 audit C2 fix.

    F999 golden (`tests/fixtures/java-smartbi-golden/analysis-procurement-F999.json`)
    confirms: kpiCards=[], charts={}, rankings={}, fromCache=False (boolean primitive),
    aiInsights=[1 entry YELLOW数据状态], suggestions=["请先录入采购数据以开始分析"].
    """
    return {
        "period":            None,
        "startDate":         None,
        "endDate":           None,
        "kpiCards":          [],
        "metricCards":       None,
        "rankings":          {},
        "charts":            {},
        "chartList":         None,
        "aiInsights":        [{
            "level":            "YELLOW",
            "category":         "数据状态",
            "message":          "当前时间范围内暂无采购数据",
            "relatedEntity":    None,
            "actionSuggestion": "请调整时间范围或录入采购数据",
        }],
        "alerts":            None,
        "recommendations":   None,
        "suggestions":       ["请先录入采购数据以开始分析"],
        "generatedAt":       None,
        "lastUpdated":       _utc_now_iso(),
        "fromCache":         False,
        "cacheExpireAt":     None,
    }


def _build_supplier_pie_chart(batches: list[dict]) -> dict:
    """Mirror Java buildSupplierPieChart. PIE chart of supplier total purchase values.

    Empty batches → empty data array (still 7-field ChartConfig per Rule 9 §9.2).
    """
    supplier_totals: dict[str, Decimal] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        supplier_totals[sid] = supplier_totals.get(sid, Decimal("0")) + tv

    sorted_entries = sorted(supplier_totals.items(), key=lambda kv: kv[1], reverse=True)
    chart_data = [
        {
            "name":  sid,
            "value": _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        }
        for sid, value in sorted_entries
    ]

    return {
        "chartType":   "PIE",
        "title":       "供应商占比",
        "seriesField": None,
        "data":        chart_data,
        "options":     {"showPercentage": True, "showLegend": True},
        "xaxisField":  "name",
        "yaxisField":  "value",
    }


def _build_material_category_chart(batches: list[dict]) -> dict:
    """Mirror Java buildMaterialCategoryChart. BAR chart of material category totals.

    Empty batches → empty data array. material_type_id is the grouping key
    (Java enum / Python string identifier; real category names looked up at
    presentation layer or via separate query — out of scope for byte parity).
    """
    category_totals: dict[str, Decimal] = {}
    for b in batches:
        mtype = b.get("material_type_id")
        if mtype is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        category_totals[mtype] = category_totals.get(mtype, Decimal("0")) + tv

    sorted_entries = sorted(category_totals.items(), key=lambda kv: kv[1], reverse=True)
    chart_data = [
        {
            "category": mtype,
            "value":    _decimal_to_number(value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        }
        for mtype, value in sorted_entries
    ]

    return {
        "chartType":   "BAR",
        "title":       "物料类别采购分布",
        "seriesField": None,
        "data":        chart_data,
        "options":     {"showDataLabels": True},
        "xaxisField":  "category",
        "yaxisField":  "value",
    }


async def _build_overview_kpi_cards(
    batches: list[dict],
    factory_id: str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Build 5 KPI cards for overview mode per spec §3.11.

    KPIs (Java getProcurementOverview line 89-91 + buildKPICards helpers):
      1. PURCHASE_TOTAL — total amount (alertLevel=GREEN)
      2. BATCH_COUNT — batch count (alertLevel=GREEN)
      3. AVG_UNIT_PRICE — average unit price (alertLevel=GREEN)
      4. SUPPLIER_CONCENTRATION — concentration with T1 alert (RED >60, YELLOW >40)
      5. MOM_GROWTH — month-over-month growth (conditional on previous-period non-empty)

    Empty batches → empty list ([]) per F999 golden.

    KPICard 13-field shape per Rule 9 §9.3 (Lombok @Data + no @JsonInclude). Sister
    Phase 2A endpoints emit MetricResult-shape (11 fields) for KPIs; here we emit the
    KPICard wrapper shape per inventory PR-B template (#54).
    """
    if not batches:
        return []

    kpi_cards: list[dict] = []

    # KPI 1: Total amount
    total_amount = _calculate_total_value(batches)
    kpi_cards.append({
        "metricCode":     "PURCHASE_TOTAL",
        "metricName":     "采购总额",
        "value":          _decimal_to_number(total_amount.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        "formattedValue": _format_currency(total_amount),
        "unit":           "元",
        "changePercent":  None,
        "changeDirection": None,
        "alertLevel":     "GREEN",
        "dimensionValue": None,
    })

    # KPI 2: Batch count
    kpi_cards.append({
        "metricCode":     "BATCH_COUNT",
        "metricName":     "采购批次",
        "value":          len(batches),
        "formattedValue": str(len(batches)),
        "unit":           "批",
        "changePercent":  None,
        "changeDirection": None,
        "alertLevel":     "GREEN",
        "dimensionValue": None,
    })

    # KPI 3: Average unit price
    avg_price = _calculate_average_unit_price(batches)
    kpi_cards.append({
        "metricCode":     "AVG_UNIT_PRICE",
        "metricName":     "平均单价",
        "value":          _decimal_to_number(avg_price.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        "formattedValue": _format_currency(avg_price),
        "unit":           "元",
        "changePercent":  None,
        "changeDirection": None,
        "alertLevel":     "GREEN",
        "dimensionValue": None,
    })

    # KPI 4: Supplier concentration with T1 alert
    concentration = _calculate_supplier_concentration(batches)
    kpi_cards.append({
        "metricCode":     "SUPPLIER_CONCENTRATION",
        "metricName":     "供应商集中度",
        "value":          _decimal_to_number(concentration.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
        "formattedValue": f"{float(concentration):.1f}%",
        "unit":           "%",
        "changePercent":  None,
        "changeDirection": None,
        "alertLevel":     _determine_concentration_alert_level(concentration),
        "dimensionValue": None,
    })

    # KPI 5: MoM growth (conditional on previous period non-empty, Java line 317-326 pattern)
    previous_start = _minus_months(start_date, 1)
    previous_end = _minus_months(end_date, 1)
    previous_batches = await _query_material_batches_in_range(factory_id, previous_start, previous_end)
    if previous_batches:
        previous_amount = _calculate_total_value(previous_batches)
        mom_growth = _calculate_mom_growth(total_amount, previous_amount)
        kpi_cards.append({
            "metricCode":     "MOM_GROWTH",
            "metricName":     "采购环比增长",
            "value":          _decimal_to_number(mom_growth.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)),
            "formattedValue": f"{float(mom_growth):.2f}%",
            "unit":           "%",
            "changePercent":  _decimal_to_number(mom_growth),
            "changeDirection": _determine_change_direction(mom_growth),
            "alertLevel":     "GREEN",
            "dimensionValue": None,
        })

    return kpi_cards


async def _generate_ai_insights(
    factory_id: str, batches: list[dict], kpi_cards: list[dict]
) -> list[dict]:
    """Mirror Java generateAiInsights (line 914-975). Rule-based, NO LLM.

    Spec §3.12 Round 4 audit I4 fix: signature is `(factory_id, batches, kpi_cards)`
    (not `(batches, kpi_cards)`) so we can resolve top supplier name via real query
    (`_query_supplier_by_id`), matching Java `supplierRepository.findById(...).map(::getName).orElse(supplierId)`.

    Two checks:
      1. SUPPLIER_CONCENTRATION → RED (>60) / YELLOW (>40) supplier risk insight
      2. Top supplier highlight (INFO level, names the largest supplier)

    AIInsight 5-key order (golden-verified): [level, category, message, relatedEntity, actionSuggestion]
    """
    insights: list[dict] = []

    # Check 1: supplier concentration alert
    concentration_metric = next(
        (m for m in kpi_cards if m.get("metricCode") == "SUPPLIER_CONCENTRATION"),
        None,
    )
    if concentration_metric is not None and concentration_metric.get("value") is not None:
        concentration = _to_decimal(concentration_metric["value"])
        if concentration > _PROCUREMENT_CONCENTRATION_RED:
            insights.append({
                "level":            "RED",
                "category":         "供应商风险",
                "message":          f"供应商集中度高达 {float(concentration):.1f}%，存在供应链风险",
                "relatedEntity":    None,
                "actionSuggestion": "建议开发备选供应商，分散采购风险",
            })
        elif concentration > _PROCUREMENT_CONCENTRATION_YELLOW:
            insights.append({
                "level":            "YELLOW",
                "category":         "供应商风险",
                "message":          f"供应商集中度为 {float(concentration):.1f}%，需要关注",
                "relatedEntity":    None,
                "actionSuggestion": "建议评估备选供应商，降低依赖度",
            })

    # Check 2: top supplier highlight (T11 enforced supplier_by_id lookup)
    supplier_values: dict[str, Decimal] = {}
    for b in batches:
        sid = b.get("supplier_id")
        if sid is None:
            continue
        up = b.get("unit_price")
        rq = b.get("receipt_quantity")
        tv = (_to_decimal(up) * _to_decimal(rq)) if (up is not None and rq is not None) else Decimal("0")
        supplier_values[sid] = supplier_values.get(sid, Decimal("0")) + tv

    if supplier_values:
        top_sid = max(supplier_values.keys(), key=lambda k: supplier_values[k])
        top_value = supplier_values[top_sid]
        supplier = await _query_supplier_by_id(top_sid, factory_id)
        # Java line 720-721: .orElse(supplierId)
        supplier_name = supplier["name"] if supplier else top_sid
        insights.append({
            "level":            "INFO",
            "category":         "采购分布",
            "message":          f"最大供应商 {supplier_name} 采购金额 {_format_currency(top_value)} 元",
            "relatedEntity":    supplier_name,
            "actionSuggestion": "建议与该供应商协商更优惠的采购条款",
        })

    return insights


def _generate_suggestions(batches: list[dict], kpi_cards: list[dict]) -> list[str]:
    """Mirror Java generateSuggestions (line 977-1005). Rule-based short text list.

    Empty batches → empty list (overview path uses empty dashboard fallback in that case).
    Non-empty batches → 1-3 contextual suggestions based on concentration + recent trend.
    """
    suggestions: list[str] = []

    if not batches:
        return suggestions

    # Suggestion 1: concentration-driven
    concentration_metric = next(
        (m for m in kpi_cards if m.get("metricCode") == "SUPPLIER_CONCENTRATION"),
        None,
    )
    if concentration_metric is not None and concentration_metric.get("value") is not None:
        concentration = _to_decimal(concentration_metric["value"])
        if concentration > _PROCUREMENT_CONCENTRATION_RED:
            suggestions.append("供应商集中度过高，建议引入 2-3 家备选供应商以分散供应链风险")
        elif concentration > _PROCUREMENT_CONCENTRATION_YELLOW:
            suggestions.append("供应商集中度偏高，可考虑评估备选供应商以提升供应链韧性")

    # Suggestion 2: MoM growth direction
    mom_metric = next(
        (m for m in kpi_cards if m.get("metricCode") == "MOM_GROWTH"),
        None,
    )
    if mom_metric is not None:
        direction = mom_metric.get("changeDirection")
        if direction == "UP":
            suggestions.append("采购环比增长，建议复盘需求驱动是否真实，避免库存积压")
        elif direction == "DOWN":
            suggestions.append("采购环比下降，关注是否存在供货中断或需求萎缩风险")

    # Default suggestion if nothing flagged
    if not suggestions:
        suggestions.append("采购数据健康，建议持续监控供应商表现与价格波动")

    return suggestions


async def _get_procurement_overview(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getProcurementOverview (line 76-122) — DashboardResponse 16-key.

    Empty batches → _build_empty_dashboard (16-key empty envelope).

    Non-empty path:
      - kpiCards from _build_overview_kpi_cards (5 KPIs incl conditional MoM)
      - charts LinkedHashMap by chart.title.replace(" ", "_") (Java line 93-101)
      - rankings LinkedHashMap with key "supplier"
      - aiInsights from _generate_ai_insights (rule-based)
      - suggestions from _generate_suggestions (rule-based)
      - lastUpdated volatile (stripped by _strip_volatile in tests)
      - other 9 fields: period/startDate/endDate/metricCards/chartList/alerts/
        recommendations/generatedAt/fromCache/cacheExpireAt — match golden defaults

    16-field key order locked from F999 golden (analysis-procurement-F999.json),
    matching inventory PR-B (#54) DashboardResponse @Builder field declaration order.
    """
    batches = await _query_material_batches_in_range(factory_id, start_date, end_date)

    if not batches:
        return _build_empty_dashboard()

    # KPI cards
    kpi_cards = await _build_overview_kpi_cards(batches, factory_id, start_date, end_date)

    # Charts (3 builders): trend DAY (reuse PR-A helper), supplier pie, material category
    trend_chart = await _get_procurement_trend_chart(factory_id, start_date, end_date, "DAY")
    supplier_pie_chart = _build_supplier_pie_chart(batches)
    material_category_chart = _build_material_category_chart(batches)
    chart_list = [trend_chart, supplier_pie_chart, material_category_chart]
    charts: dict[str, dict] = {}
    for i, chart in enumerate(chart_list):
        title = chart.get("title")
        key = title.replace(" ", "_") if title else f"chart_{i}"
        charts[key] = chart

    # Rankings
    supplier_rankings = await _calculate_supplier_ranking_from_data(factory_id, batches)
    rankings = {"supplier": supplier_rankings}

    # Rule-based generators
    ai_insights = await _generate_ai_insights(factory_id, batches, kpi_cards)
    suggestions = _generate_suggestions(batches, kpi_cards)

    # 16-key DashboardResponse (matching inventory PR-B + F999 golden order)
    return {
        "period":            None,
        "startDate":         start_date.isoformat(),
        "endDate":           end_date.isoformat(),
        "kpiCards":          kpi_cards,
        "metricCards":       None,
        "rankings":          rankings,
        "charts":            charts,
        "chartList":         None,
        "aiInsights":        ai_insights,
        "alerts":            None,
        "recommendations":   None,
        "suggestions":       suggestions,
        "generatedAt":       None,
        "lastUpdated":       _utc_now_iso(),
        "fromCache":         False,
        "cacheExpireAt":     None,
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

    # default mode (overview DashboardResponse) — PR-B scope
    # Top-level data key order from F999 golden (analysis-procurement-F999.json):
    # [overview, endDate, startDate]
    overview = await _get_procurement_overview(factory_id, start_date, end_date)
    return {
        "overview":  overview,
        "endDate":   end_iso,
        "startDate": start_iso,
    }


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
