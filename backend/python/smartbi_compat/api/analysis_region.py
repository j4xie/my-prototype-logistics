"""Phase 2A /analysis/region per-type real impl (composite path).

Java reference:
  - Controller: SmartBIAnalysisController.getRegionAnalysis line 181-218
  - Composite dispatcher: SmartBIServiceImpl.getComprehensiveAnalysis line 593-598 ("region" case)
  - Sub-services: RegionAnalysisServiceImpl.java
      * getRegionRanking (line 54-94)
      * getRegionTargetCompletion (line 269-314)
      * getGeographicHeatmapData (line 318-381)
      * getRegionOpportunityScores (line 385-464)

Per-type fallback path (smartBIService==null branch, line 197-211 Java) is
dead code (Spring DI never null) and OUT OF SCOPE per spec §1.3.

13 R-T traps locked per spec §8.1 — see inline pinpoints below.
Map.of(N) / HashMap key orders mirror recorded F999/F001 goldens (Rule 8).

Recorded golden key orders (post-Task-3 decode, F999 empty-data goldens):
  - Outer envelope (8): code, message, data, timestamp, success, actionHint, severity, hintTarget
  - .data HashMap (6): heatmap, targetCompletion, dateRange, opportunityScores, generatedAt, ranking
  - .data.heatmap empty (7): chartType, title, seriesField, data, options, xaxisField, yaxisField
    NOTE: xaxisField/yaxisField are LOWERCASE 'a' (Jackson decapitalize on consecutive caps "XA")
  - .data.dateRange (7): startDate, endDate, granularity, originalExpression, relative, days, valid

Lombok @Data orders (Java field declaration order, deterministic):
  - RankingItem (6): rank, name, value, target, completionRate, alertLevel
  - MetricResult (11): metricCode, metricName, value, formattedValue, unit, changePercent,
                       changeDirection, changeValue, alertLevel, dimensionValue, description
  - RegionOpportunityScore (13): region, totalScore, growthScore, baseScore, marginScore,
                                  penetrationScore, recommendation, opportunityLevel, currentSales,
                                  previousSales, growthRate, grossMargin, customerCount

LinkedHashMap insertion (RegionAnalysisServiceImpl.java:353-359):
  - heatmap.data[0] (6): province, value, heatValue, orderCount, customerCount, colorLevel

Map.of(N) orders captured from PR-B populated F999/F001 goldens (2026 date range):
  - heatmap.options Map.of(4): roam, visualMap, mapType, showLabel
  - heatmap.options.visualMap Map.of(3): min, calculable, max
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, Query

# Helpers from sister Phase 2A modules — DO NOT redefine locally
from smartbi_compat.api.analysis_finance import (
    _decimal_to_number,
    _to_decimal,
    _new_date_range_dict,
    _utc_now_iso,
)
# _calculate_mom_growth, _to_thread (Python 3.8 shim), _get_sync_engine
# imported from analysis_sales. _calculate_completion_rate INTENTIONALLY NOT
# imported — region defines locally per R-T13 (different arithmetic order).
from smartbi_compat.api.analysis_sales import (
    _calculate_mom_growth,
    _to_thread,
    _get_sync_engine,
)

from sqlalchemy import text

from smartbi_compat._rbac_role import require_analytics_read
from smartbi_compat._rbac_strip import strip_price_for_role
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Constants — alert thresholds inline per Java line 459-461 (NOT alert_thresholds.py)
# ============================================================
_REGION_TARGET_COMPLETION_RED = Decimal("60")
_REGION_TARGET_COMPLETION_YELLOW = Decimal("85")

# Heatmap color level thresholds — non-integer, MUST use Decimal compare (Rule 7, R-T9)
_HEATMAP_HIGH = Decimal("0.7")
_HEATMAP_MEDIUM = Decimal("0.3")


# ============================================================
# RegionAggregation — mirror Java private static class (impl line 1175-1208)
# R-T6: customer_count synced incrementally via len(customers)
# R-T11: gross_margin stays Decimal("0") on amount=0, NOT None
# ============================================================
@dataclass
class RegionAggregation:
    total_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    total_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    total_target: Decimal = field(default_factory=lambda: Decimal("0"))
    gross_margin: Decimal = field(default_factory=lambda: Decimal("0"))
    order_count: int = 0
    customer_count: int = 0
    customers: set = field(default_factory=set)

    def add_sale(self, row: dict) -> None:
        # Rule 1: explicit `is not None` — Decimal("0") is Python falsy
        if row.get("amount") is not None:
            self.total_amount += _to_decimal(row["amount"])
        if row.get("cost") is not None:
            self.total_cost += _to_decimal(row["cost"])
        if row.get("monthly_target") is not None:
            self.total_target += _to_decimal(row["monthly_target"])
        self.order_count += 1
        cn = row.get("customer_name")
        # Java line 1195: `!= null && !cn.isEmpty()`
        if cn is not None and cn != "":
            self.customers.add(cn)
        # R-T6: customer_count synced every call (Java line 1198)
        self.customer_count = len(self.customers)

    def calculate_gross_margin(self) -> None:
        # R-T11: total_amount==0 → gross_margin stays Decimal("0"), NOT None
        if self.total_amount > Decimal("0"):
            gross_profit = self.total_amount - self.total_cost
            self.gross_margin = (
                (gross_profit / self.total_amount).quantize(
                    Decimal("0.0001"), ROUND_HALF_UP
                )
                * Decimal("100")
            )


# ============================================================
# SQL helper — Rule 5 SELECT *, Rule 6 None-check precondition
# ============================================================
_REGION_FULL_SQL = text("""
    SELECT *
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
      AND deleted_at IS NULL
    ORDER BY id ASC
""")


async def _query_region_full(
    factory_id: str,
    start_date: date,
    end_date: date,
) -> list:
    """Mirror SmartBiSalesDataRepository.findByFactoryIdAndOrderDateBetween.

    Rule 5: SELECT * for sister-chat extensibility.
    Rule 6: Reject None inputs explicitly — asyncpg/SQLAlchemy silently coerce
    None → NULL, BETWEEN NULL AND NULL returns 0 rows.
    R-T10: ORDER BY id ASC matches Java JPA default fetch order on PG (verified
    by F001 golden; if golden reveals a different order, update SQL accordingly).

    Python 3.8 compat: uses _to_thread shim (NOT bare asyncio.to_thread).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_region_full: start_date/end_date required "
            f"(got {start_date}, {end_date})"
        )

    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(_REGION_FULL_SQL, {
                "factory_id": factory_id,
                "start_date": start_date,
                "end_date": end_date,
            }).fetchall()
            return [dict(row._mapping) for row in rows]

    return await _to_thread(_exec)


# ============================================================
# Period window helper — R-T5 LOCK
# ============================================================
def _previous_period_window(start: date, end: date) -> tuple:
    """Mirror impl line 398-400: adjacent mirrored period (NOT YoY).

    days_between = (end - start).days
    prev_start = start - timedelta(days=days_between + 1)
    prev_end = start - timedelta(days=1)

    Edge: start == end (single-day) → prev_start == prev_end == start - 1 day.
    Java ChronoUnit.DAYS.between(start, end) ≡ Python (end - start).days for date.
    """
    days_between = (end - start).days
    prev_start = start - timedelta(days=days_between + 1)
    prev_end = start - timedelta(days=1)
    return prev_start, prev_end


# ============================================================
# Aggregation helpers — R-T8 LOCK '未分类' bucket for null/empty
# ============================================================
def _aggregate_by_region(rows: list) -> dict:
    """Mirror RegionAnalysisServiceImpl.aggregateByRegion (impl line 655-674).

    Python dict (3.7+) preserves insertion order ≡ Java LinkedHashMap.
    R-T8: null/empty region → '未分类' bucket.
    """
    aggregations: dict = {}
    for row in rows:
        region = row.get("region")
        if region is None or region == "":
            region = "未分类"
        agg = aggregations.setdefault(region, RegionAggregation())
        agg.add_sale(row)
    for agg in aggregations.values():
        agg.calculate_gross_margin()
    return aggregations


def _aggregate_by_province(rows: list) -> dict:
    """Mirror impl line 679-697. Same as _aggregate_by_region but key=province."""
    aggregations: dict = {}
    for row in rows:
        province = row.get("province")
        if province is None or province == "":
            province = "未分类"
        agg = aggregations.setdefault(province, RegionAggregation())
        agg.add_sale(row)
    for agg in aggregations.values():
        agg.calculate_gross_margin()
    return aggregations


# ============================================================
# Score helpers — R-T1, R-T2, R-T3, R-T4 LOCK
# ============================================================
def _calculate_growth_score(current: Decimal, previous: Decimal) -> Decimal:
    """Mirror impl line 1025-1030. R-T4 LOCK.

    growthRate = calculateMomGrowth(curr, prev), then score = growthRate + 50,
    clamp [0, 100]. Boundary: growth = +50 → 100, growth = -50 → 0.
    """
    growth_rate = _calculate_mom_growth(current, previous)
    score = growth_rate + Decimal("50")
    return max(Decimal("0"), min(Decimal("100"), score))


def _calculate_base_score(region_sales: Decimal, total_sales: Decimal) -> Decimal:
    """Mirror impl line 1035-1042. R-T3 LOCK.

    ratio = (region/total).quantize(4) * 100, score = ratio * 3, .min(100).
    33.33% → 99.99 (NOT 100); 33.34%+ caps at 100.
    """
    if total_sales == Decimal("0"):
        return Decimal("0")
    ratio = (region_sales / total_sales).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    ) * Decimal("100")
    return min(Decimal("100"), ratio * Decimal("3"))


def _calculate_margin_score(gross_margin) -> Decimal:
    """Mirror impl line 1047-1053. R-T2 LOCK.

    grossMargin already × 100 (percentage units, see RegionAggregation).
    score = grossMargin * Decimal("3.33") EXACT (NOT float 3.33), clamp [0, 100].
    30% margin → score = 99.9 (NOT 100).
    """
    if gross_margin is None:
        return Decimal("0")
    score = gross_margin * Decimal("3.33")
    return max(Decimal("0"), min(Decimal("100"), score))


def _calculate_penetration_score(customer_count: int, order_count: int) -> Decimal:
    """Mirror impl line 1058-1062. R-T1 LOCK — INTEGER DIVISION.

    Java: customerCount * 10 + orderCount / 10 (Java int / int = floor div).
    Python naive port with `/` would do float division.
    Use Python `//` (floor div). int() coerce defensively against str/Decimal
    DB driver outputs.
    """
    score_int = int(customer_count) * 10 + int(order_count) // 10
    return min(Decimal("100"), Decimal(score_int))


def _calculate_total_score(g, b, m, p) -> Decimal:
    """Mirror RegionOpportunityScore.calculateTotalScore (DTO line 134-145).

    Weights: g*0.30 + b*0.25 + m*0.25 + p*0.20. Sum=1.00.
    Rule 1: explicit `is not None` for None-guard.
    """
    g = g if g is not None else Decimal("0")
    b = b if b is not None else Decimal("0")
    m = m if m is not None else Decimal("0")
    p = p if p is not None else Decimal("0")
    return (
        g * Decimal("0.30")
        + b * Decimal("0.25")
        + m * Decimal("0.25")
        + p * Decimal("0.20")
    )


def _determine_opportunity_level(total_score) -> str:
    """Mirror RegionOpportunityScore.determineOpportunityLevel (DTO line 99-111).

    score >= 70 → HIGH, 40 <= score < 70 → MEDIUM, score < 40 → LOW. None → LOW.
    """
    if total_score is None:
        return "LOW"
    if total_score >= Decimal("70"):
        return "HIGH"
    if total_score >= Decimal("40"):
        return "MEDIUM"
    return "LOW"


# ============================================================
# Heatmap helpers — R-T7 LOCK regex order, R-T9 LOCK Decimal compare
# ============================================================
# R-T7 LOCK: ORDER MATTERS — 自治区/特别行政区 BEFORE 壮族/回族/维吾尔
# Java line 1144-1150 sequential .replaceAll on regex anchored at end ($).
_PROVINCE_NORMALIZE_PATTERNS = [
    (re.compile(r"省$"), ""),
    (re.compile(r"市$"), ""),
    (re.compile(r"自治区$"), ""),
    (re.compile(r"特别行政区$"), ""),
    (re.compile(r"壮族$"), ""),
    (re.compile(r"回族$"), ""),
    (re.compile(r"维吾尔$"), ""),
]


def _normalize_province_name(province) -> str:
    """Mirror impl line 1138-1151. R-T7 LOCK — sequential regex application.

    Examples:
      "广西壮族自治区" → 自治区 first → "广西壮族" → 壮族 next → "广西"
      "新疆维吾尔自治区" → "新疆"
      "宁夏回族自治区" → "宁夏"
      "北京市" → "北京"
      "香港特别行政区" → "香港"
      None → "未知"
    """
    if province is None:
        return "未知"
    p = province
    for pattern, replacement in _PROVINCE_NORMALIZE_PATTERNS:
        p = pattern.sub(replacement, p)
    return p


def _determine_color_level(heat_value) -> str:
    """Mirror impl line 1156-1168. R-T9 LOCK — Decimal compare (Rule 7).

    heat_value >= 0.7 → HIGH, >= 0.3 → MEDIUM, else LOW. None → LOW.
    """
    if heat_value is None:
        return "LOW"
    if heat_value >= _HEATMAP_HIGH:
        return "HIGH"
    if heat_value >= _HEATMAP_MEDIUM:
        return "MEDIUM"
    return "LOW"


# ============================================================
# Alerting + formatting helpers — R-T13 LOCK on _calculate_completion_rate
# ============================================================
def _calculate_completion_rate(
    actual: Decimal, target: Optional[Decimal]
) -> Decimal:
    """Mirror RegionAnalysisServiceImpl.java:756-761 EXACTLY.

    Java: actual.divide(target, SCALE=4, HALF_UP).multiply(BigDecimal("100"))
    Order: divide-then-quantize-then-multiply (NOT department's divide-multiply-quantize).

    R-T13 LOCK: DO NOT import analysis_sales._calculate_completion_rate — that
    helper uses sales-Java order `(actual/target*100).quantize(4)` which produces
    different bytes on non-round inputs:
      actual=33.333, target=9.7:
        Region (this fn):  (33.333/9.7).quantize(4) * 100 = 3.4364 * 100 = 343.6400
        Sales/department:  (33.333 * 100 / 9.7).quantize(4) = 343.6392

    target None or 0 → returns Decimal("0") (Java line 757-759 short-circuit).
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    return (actual / target).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    ) * Decimal("100")


def _determine_target_completion_alert(rate) -> str:
    """Mirror MetricCalculatorServiceImpl line 449-461 TARGET_COMPLETION case.

    Java impl:
      value == null  → YELLOW
      v < 60         → RED
      60 <= v < 85   → YELLOW
      v >= 85        → GREEN

    Inline 60/85 NOT alert_thresholds.py 80 — Java line 459-461 uses 60/85.
    """
    if rate is None:
        return "YELLOW"
    if rate < _REGION_TARGET_COMPLETION_RED:
        return "RED"
    if rate < _REGION_TARGET_COMPLETION_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_direction(value, baseline) -> str:
    """Mirror impl line 1121-1133. None or any-arg-None → STABLE.

    value > baseline → UP, < → DOWN, == → STABLE.
    """
    if value is None or baseline is None:
        return "STABLE"
    if value > baseline:
        return "UP"
    if value < baseline:
        return "DOWN"
    return "STABLE"


def _format_amount(amount) -> str:
    """Mirror impl line 1111-1116.

    Java: String.format("%,.2f", amount.doubleValue()) — JVM Locale-dependent.
    Production Linux JVM = en_US → comma thousand separator → matches Python f-string.
    None → "0.00".
    """
    if amount is None:
        return "0.00"
    return f"{amount:,.2f}"


def _generate_opportunity_recommendation(
    region: str,
    total_score: Decimal,
    growth_score: Decimal,
    base_score: Decimal,
    margin_score: Decimal,
    penetration_score: Decimal,
) -> str:
    """Mirror generateOpportunityRecommendation (impl line 1067-1106).

    Templated Chinese based on level + max/min dim. LinkedHashMap insertion order
    决定 max/min tie-break (first-seen-wins).
    """
    level = _determine_opportunity_level(total_score)
    parts = []
    if level == "HIGH":
        parts.append(f"{region}是高潜力区域，")
    elif level == "MEDIUM":
        parts.append(f"{region}具有一定发展潜力，")
    else:
        parts.append(f"{region}目前发展潜力有限，")
    # LinkedHashMap insertion order: 增长率, 销售基数, 毛利率, 市场渗透
    dims = {
        "增长率": growth_score,
        "销售基数": base_score,
        "毛利率": margin_score,
        "市场渗透": penetration_score,
    }
    strongest = max(dims, key=dims.get)
    weakest = min(dims, key=dims.get)
    parts.append(f"优势在于{strongest}，")
    parts.append(f"建议重点提升{weakest}。")
    return "".join(parts)


# ============================================================
# Sub-service 1: ranking — Java line 54-94
# RankingItem Lombok @Data: rank, name, value, target, completionRate, alertLevel
# ============================================================
def _build_region_ranking(rows: list) -> list:
    """Mirror getRegionRanking. Empty rows → []. Sort by total_amount desc.

    Key order from RankingItem Lombok @Data (Task 3 source-derived):
    rank, name, value, target, completionRate, alertLevel.
    """
    if not rows:
        return []
    aggregations = _aggregate_by_region(rows)
    sorted_entries = sorted(
        aggregations.items(),
        key=lambda kv: kv[1].total_amount,
        reverse=True,
    )
    rankings: list = []
    for rank, (region, agg) in enumerate(sorted_entries, start=1):
        completion_rate = _calculate_completion_rate(agg.total_amount, agg.total_target)
        alert_level = _determine_target_completion_alert(completion_rate)
        rankings.append({
            "rank": rank,
            "name": region,
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "target": _decimal_to_number(
                agg.total_target.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "completionRate": _decimal_to_number(
                completion_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "alertLevel": alert_level,
        })
    return rankings


# ============================================================
# Sub-service 2: targetCompletion — Java line 269-314
# F7: MetricResult Lombok @Data has 11 fields (NOT 10) — changeValue at position 8
# ============================================================
def _build_region_target_completion(rows: list) -> list:
    """Mirror getRegionTargetCompletion. Returns MetricResult, NOT RankingItem.

    metric_code = "REGION_TARGET_" + region (literal prefix).
    Sort by changePercent desc.

    Key order (Task 3 source-derived, 11 fields including changeValue=null per F7):
    metricCode, metricName, value, formattedValue, unit, changePercent,
    changeDirection, changeValue, alertLevel, dimensionValue, description.

    Tie-break (task #25 fix 2026-05-07): Java aggregateByRegion (impl line 656)
    uses `new LinkedHashMap<>()` explicitly — NOT HashMap, NOT Collectors.groupingBy.
    Insertion order = order each region first appears in salesData iteration =
    SQL row order. Java line 307-311 sorts results by changePercent desc using
    List.sort which is stable (Java 8+ Timsort), so tied changePercent rows
    retain LinkedHashMap insertion order.

    Python parity: SQL has `ORDER BY id ASC` (matches JPA default fetch order),
    Python dict 3.7+ preserves insertion order ≡ Java LinkedHashMap, and
    Python `sorted(..., reverse=True)` is stable (Timsort) → tied rows retain
    insertion order. No explicit tie-break helper needed.

    Prior fix attempt (`_java_hashmap_bucket` pre-sort) was wrong direction —
    based on incorrect "HashMap" assumption from retrospective doc. Verified
    against Java source 2026-05-07 (line 656 `new LinkedHashMap<>()`).
    """
    if not rows:
        return []
    aggregations = _aggregate_by_region(rows)
    results: list = []
    for region, agg in aggregations.items():
        completion_rate = _calculate_completion_rate(agg.total_amount, agg.total_target)
        alert_level = _determine_target_completion_alert(completion_rate)
        change_direction = _determine_direction(completion_rate, Decimal("100"))
        results.append({
            "metricCode": f"REGION_TARGET_{region}",
            "metricName": f"{region} 目标完成",
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "formattedValue": _format_amount(agg.total_amount),
            "unit": "元",
            "changePercent": _decimal_to_number(
                completion_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "changeDirection": change_direction,
            "changeValue": None,  # F7: Java service doesn't set, Jackson outputs null
            "alertLevel": alert_level,
            "dimensionValue": region,
            "description": f"目标: {_format_amount(agg.total_target)}",
        })
    # Stable sort by changePercent desc — tied rows retain dict insertion order
    # (= Java LinkedHashMap iteration = SQL row appearance order).
    return sorted(results, key=lambda r: r["changePercent"], reverse=True)


# ============================================================
# Sub-service 3: heatmap — Java line 318-381
# F2: ChartConfig has NO @JsonInclude(NON_NULL) — empty case = 7 fields with nulls
# F1: xaxisField/yaxisField LOWERCASE 'a' (Jackson decapitalize)
# ChartConfig key order (F999 empirical): chartType, title, seriesField, data, options, xaxisField, yaxisField
# Map.of(4) options + Map.of(3) visualMap: DEFERRED (use plan-source order as PR-A best-guess)
# ============================================================
def _build_geographic_heatmap(rows: list) -> dict:
    """Mirror getGeographicHeatmapData.

    Empty rows → 7-field ChartConfig with nulls (F2: no @JsonInclude).
    Non-empty: full ChartConfig with options (Map.of(4)) + nested visualMap (Map.of(3)).
    """
    if not rows:
        # F2: empty case = 7 fields all present with nulls (NOT 3-field plan-source)
        # Order from F999 golden: chartType, title, seriesField, data, options, xaxisField, yaxisField
        return {
            "chartType": "MAP",
            "title": "销售地理分布",
            "seriesField": None,
            "data": [],
            "options": None,
            "xaxisField": None,
            "yaxisField": None,
        }
    province_aggs = _aggregate_by_province(rows)
    max_amount = max(
        (agg.total_amount for agg in province_aggs.values()),
        default=Decimal("1"),
    )
    map_data: list = []
    for province, agg in province_aggs.items():
        if max_amount > Decimal("0"):
            heat_value = (agg.total_amount / max_amount).quantize(
                Decimal("0.0001"), ROUND_HALF_UP
            )
        else:
            heat_value = Decimal("0")
        # heatmap.data[0] LinkedHashMap order from Java line 353-360:
        # province, value, heatValue, orderCount, customerCount, colorLevel
        map_data.append({
            "province": _normalize_province_name(province),
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "heatValue": _decimal_to_number(
                heat_value.quantize(Decimal("0.0001"), ROUND_HALF_UP)
            ),
            "orderCount": agg.order_count,
            "customerCount": agg.customer_count,
            "colorLevel": _determine_color_level(heat_value),
        })

    # Map.of(4) options — Rule 8 hash order from F999/F001-populated goldens (PR-B):
    # actual order: roam, visualMap, mapType, showLabel
    options = {
        "roam": True,
        "visualMap": {
            # Map.of(3) visualMap — Rule 8 hash order from goldens (PR-B):
            # actual order: min, calculable, max
            "min": 0,
            "calculable": True,
            "max": _decimal_to_number(
                max_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
        },
        "mapType": "china",
        "showLabel": True,
    }

    # Populated case: same 7-field order as empty (F2 + F1 bake-ins).
    return {
        "chartType": "MAP",
        "title": "销售地理分布",
        "seriesField": None,    # Java service doesn't set in region endpoint
        "data": map_data,
        "options": options,
        "xaxisField": "province",   # F1: lowercase a
        "yaxisField": "value",      # F1: lowercase a
    }


# ============================================================
# Sub-service 4: opportunityScores — Java line 385-464
# R-T12 LOCK: 13-field RegionOpportunityScore Lombok @Data declaration order
# ============================================================
def _build_opportunity_scores(rows: list, prev_rows: list) -> list:
    """Mirror getRegionOpportunityScores. Empty current rows → [].

    R-T12: dict literal key order matches RegionOpportunityScore.java declaration:
    region, totalScore, growthScore, baseScore, marginScore, penetrationScore,
    recommendation, opportunityLevel, currentSales, previousSales, growthRate,
    grossMargin, customerCount.
    """
    if not rows:
        return []
    current_aggs = _aggregate_by_region(rows)
    previous_aggs = _aggregate_by_region(prev_rows) if prev_rows else {}
    total_current_sales = sum(
        (agg.total_amount for agg in current_aggs.values()),
        Decimal("0"),
    )
    scores: list = []
    for region, current_agg in current_aggs.items():
        previous_agg = previous_aggs.get(region)
        previous_sales = (
            previous_agg.total_amount if previous_agg is not None else Decimal("0")
        )
        growth_score = _calculate_growth_score(current_agg.total_amount, previous_sales)
        base_score = _calculate_base_score(current_agg.total_amount, total_current_sales)
        margin_score = _calculate_margin_score(current_agg.gross_margin)
        penetration_score = _calculate_penetration_score(
            current_agg.customer_count, current_agg.order_count
        )
        total_score = _calculate_total_score(
            growth_score, base_score, margin_score, penetration_score
        )
        growth_rate = _calculate_mom_growth(current_agg.total_amount, previous_sales)
        recommendation = _generate_opportunity_recommendation(
            region, total_score, growth_score, base_score,
            margin_score, penetration_score
        )
        scores.append({
            "region": region,
            "totalScore": _decimal_to_number(
                total_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "growthScore": _decimal_to_number(
                growth_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "baseScore": _decimal_to_number(
                base_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "marginScore": _decimal_to_number(
                margin_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "penetrationScore": _decimal_to_number(
                penetration_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "recommendation": recommendation,
            "opportunityLevel": _determine_opportunity_level(total_score),
            "currentSales": _decimal_to_number(
                current_agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "previousSales": _decimal_to_number(
                previous_sales.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "growthRate": _decimal_to_number(
                growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "grossMargin": _decimal_to_number(
                current_agg.gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "customerCount": current_agg.customer_count,
        })
    scores.sort(key=lambda s: s["totalScore"], reverse=True)
    return scores


# ============================================================
# Dispatcher — Java line 593-598 ("region" case in getComprehensiveAnalysis)
# Top-level .data HashMap key order from F999 golden (Rule 8 + Task 11 verify):
#   heatmap → targetCompletion → dateRange → opportunityScores → generatedAt → ranking
# ============================================================
async def _get_region_analysis(factory_id: str, range_: DateRange) -> dict:
    """Mirror SmartBIServiceImpl.getComprehensiveAnalysis 'region' case.

    DB optimization: 2 queries (current period reused across all 4 sub-services,
    previous period for opportunity scores). Java repeats the query 4×.
    Output byte-shape unaffected.

    Top-level dict order matches recorded F999 golden (HashMap hash-bucket
    order, NOT source insertion order).
    """
    rows = await _query_region_full(factory_id, range_.start_date, range_.end_date)
    ranking = _build_region_ranking(rows)
    target_completion = _build_region_target_completion(rows)
    heatmap = _build_geographic_heatmap(rows)

    prev_start, prev_end = _previous_period_window(range_.start_date, range_.end_date)
    prev_rows = await _query_region_full(factory_id, prev_start, prev_end)
    opportunity_scores = _build_opportunity_scores(rows, prev_rows)

    # Golden-confirmed key order (Rule 8 + Task 11):
    return {
        "heatmap": heatmap,
        "targetCompletion": target_completion,
        "dateRange": _new_date_range_dict(range_),
        "opportunityScores": opportunity_scores,
        "generatedAt": _utc_now_iso(),
        "ranking": ranking,
    }


# ============================================================
# Route handler — Java SmartBIAnalysisController.getRegionAnalysis line 181-218
# ============================================================
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/region")
async def get_region_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    region: Optional[str] = None,
    auth: AuthContext = Depends(require_analytics_read),
) -> dict:
    """Java reference: SmartBIAnalysisController.getRegionAnalysis line 181-218.

    `region` query param accepted but IGNORED — Java line 192-194 short-circuits
    to getComprehensiveAnalysis when smartBIService non-null (always true in
    prod via Spring DI).

    Returns 6-key composite Map wrapped in standard envelope.
    """
    range_ = DateRange.custom(startDate, endDate)
    result = await _get_region_analysis(auth.factory_id, range_)
    return wrap_response(strip_price_for_role(result, auth.role))
