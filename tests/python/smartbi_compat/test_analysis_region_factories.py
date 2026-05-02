"""Arithmetic depth tests for /analysis/region sub-services (PR-B).

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-region-design.md §5.2
Sister precedent: tests/python/smartbi_compat/test_analysis_department_factories.py

Covers ~40 tests across 4 sub-service test classes:
  - TestRegionRanking          (8 tests): completion rate, alert R/Y/G, sort, unclassified,
                                          rank monotonic
  - TestRegionTargetCompletion (8 tests): metric code/name format, direction UP/DOWN/STABLE,
                                          sort, format_amount, dimensionValue
  - TestGeographicHeatmap     (13 tests): province normalize 6 cases, color level 3 thresholds,
                                          unclassified, max=0, Map.of(4) options key order,
                                          Map.of(3) visualMap key order
  - TestRegionOpportunityScores(~24 tests): 4-dim scoring boundaries (R-T1/T2/T3/T4),
                                           level thresholds, period window, mom_growth,
                                           recommendation, sort, customer dedupe

PR-A (PR #56) already covers HTTP/JWT/byte-shape contract via test_analysis_region_contract.py.
This file targets internal helpers directly — pure arithmetic + per-sub-service shape.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

import smartbi_compat.api.analysis_region as analysis_region
from smartbi_compat.api.analysis_region import (
    RegionAggregation,
    _aggregate_by_province,
    _aggregate_by_region,
    _build_geographic_heatmap,
    _build_opportunity_scores,
    _build_region_ranking,
    _build_region_target_completion,
    _calculate_base_score,
    _calculate_completion_rate,
    _calculate_growth_score,
    _calculate_margin_score,
    _calculate_penetration_score,
    _calculate_total_score,
    _determine_color_level,
    _determine_direction,
    _determine_opportunity_level,
    _determine_target_completion_alert,
    _format_amount,
    _generate_opportunity_recommendation,
    _normalize_province_name,
    _previous_period_window,
)
from smartbi_compat.api.analysis_sales import _calculate_mom_growth


# ============================================================
# Mock builders + patch helpers
# ============================================================


def _make_sales_row(
    *,
    region: str | None = "华东",
    province: str | None = "上海市",
    city: str | None = "上海",
    amount: str | None = "100000",
    cost: str | None = "70000",
    monthly_target: str | None = "150000",
    customer_name: str | None = "Customer-A",
    order_date: date = date(2024, 6, 1),
    row_id: int = 1,
    factory_id: str = "F001",
) -> dict:
    """Build a synthetic smart_bi_sales_data row for testing."""
    return {
        "id": row_id,
        "factory_id": factory_id,
        "region": region,
        "province": province,
        "city": city,
        "amount": Decimal(amount) if amount is not None else None,
        "cost": Decimal(cost) if cost is not None else None,
        "monthly_target": Decimal(monthly_target) if monthly_target is not None else None,
        "customer_name": customer_name,
        "order_date": order_date,
    }


def _patch_query(monkeypatch, rows: list[dict]) -> None:
    """Monkeypatch _query_region_full to return synthetic rows."""
    async def _fake(factory_id, start_date, end_date):
        return rows

    monkeypatch.setattr(analysis_region, "_query_region_full", _fake)


# ============================================================
# 1. TestRegionRanking (8 tests) — Sub-service 1
# ============================================================


class TestRegionRanking:
    """Sub-service 1: ranking sort + completion + alert (R-T13 LOCAL completion rate)."""

    def test_completion_rate_formula_actual_div_target_pct(self):
        """rate = actual/target * 100, scale 4 quantize then multiply (R-T13 order).

        100/80 → (100/80).quantize(0.0001) = 1.2500 → * 100 = 125.0000
        """
        rate = _calculate_completion_rate(Decimal("100"), Decimal("80"))
        assert rate == Decimal("125.0000")

    def test_alert_level_red_below_60(self):
        """rate=59.99 → RED (strictly less than 60)."""
        assert _determine_target_completion_alert(Decimal("59.99")) == "RED"

    def test_alert_level_yellow_60_to_85(self):
        """rate=60 → YELLOW (boundary inclusive); rate=84.99 → YELLOW."""
        assert _determine_target_completion_alert(Decimal("60")) == "YELLOW"
        assert _determine_target_completion_alert(Decimal("84.99")) == "YELLOW"

    def test_alert_level_green_at_or_above_85(self):
        """rate=85 → GREEN (boundary inclusive); rate=100 → GREEN."""
        assert _determine_target_completion_alert(Decimal("85")) == "GREEN"
        assert _determine_target_completion_alert(Decimal("100")) == "GREEN"

    def test_target_zero_returns_zero_completion(self):
        """target=0 → completionRate=0 (Java line 757-759 div-by-zero short-circuit)."""
        assert _calculate_completion_rate(Decimal("100"), Decimal("0")) == Decimal("0")

    def test_sort_by_total_amount_desc(self):
        """First entry has highest total_amount, last has lowest."""
        rows = [
            _make_sales_row(region="华东", amount="100000"),
            _make_sales_row(region="华南", amount="300000", row_id=2),
            _make_sales_row(region="华北", amount="200000", row_id=3),
        ]
        result = _build_region_ranking(rows)
        names = [r["name"] for r in result]
        assert names == ["华南", "华北", "华东"]

    def test_unclassified_bucket_for_null_region(self):
        """Rows with region=None or region='' → '未分类' bucket aggregated together (R-T8)."""
        rows = [
            _make_sales_row(region=None, amount="100"),
            _make_sales_row(region="", amount="200", row_id=2),
        ]
        result = _build_region_ranking(rows)
        assert len(result) == 1
        assert result[0]["name"] == "未分类"
        # 100+200=300 → _decimal_to_number(300.00) = 300 (int)
        assert result[0]["value"] == 300

    def test_rank_starts_at_1_and_monotonic(self):
        """rank values: 1, 2, 3, ... (no skips, no zero)."""
        rows = [
            _make_sales_row(region=f"R{i}", amount="100", row_id=i)
            for i in range(1, 4)
        ]
        result = _build_region_ranking(rows)
        ranks = [r["rank"] for r in result]
        assert ranks == [1, 2, 3]


# ============================================================
# 2. TestRegionTargetCompletion (8 tests) — Sub-service 2
# ============================================================


class TestRegionTargetCompletion:
    """Sub-service 2: MetricResult shape + sort by changePercent desc."""

    def test_metric_code_format_REGION_TARGET_prefix(self):
        """metricCode = 'REGION_TARGET_华东'."""
        rows = [_make_sales_row(region="华东")]
        result = _build_region_target_completion(rows)
        assert result[0]["metricCode"] == "REGION_TARGET_华东"

    def test_metric_name_format_region_suffix(self):
        """metricName = '华东 目标完成'."""
        rows = [_make_sales_row(region="华东")]
        result = _build_region_target_completion(rows)
        assert result[0]["metricName"] == "华东 目标完成"

    def test_change_direction_up_when_completion_above_100(self):
        """rate=120 → UP (actual>target by 20%)."""
        rows = [_make_sales_row(amount="120", monthly_target="100")]
        result = _build_region_target_completion(rows)
        assert result[0]["changeDirection"] == "UP"

    def test_change_direction_down_when_completion_below_100(self):
        """rate=80 → DOWN (actual<target)."""
        rows = [_make_sales_row(amount="80", monthly_target="100")]
        result = _build_region_target_completion(rows)
        assert result[0]["changeDirection"] == "DOWN"

    def test_change_direction_stable_at_exactly_100(self):
        """rate=100 → STABLE (actual==target)."""
        rows = [_make_sales_row(amount="100", monthly_target="100")]
        result = _build_region_target_completion(rows)
        assert result[0]["changeDirection"] == "STABLE"

    def test_format_amount_thousand_separator(self):
        """1234567.89 → '1,234,567.89'; None → '0.00'."""
        assert _format_amount(Decimal("1234567.89")) == "1,234,567.89"
        assert _format_amount(None) == "0.00"

    def test_sort_by_change_percent_desc(self):
        """First entry has highest changePercent (completion rate), last has lowest."""
        rows = [
            _make_sales_row(region="A", amount="80", monthly_target="100"),
            _make_sales_row(region="B", amount="120", monthly_target="100", row_id=2),
            _make_sales_row(region="C", amount="100", monthly_target="100", row_id=3),
        ]
        result = _build_region_target_completion(rows)
        rates = [r["changePercent"] for r in result]
        assert rates[0] >= rates[1] >= rates[2]
        # B has 120%, C has 100%, A has 80%
        assert result[0]["dimensionValue"] == "B"

    def test_dimension_value_equals_region_name(self):
        """dimensionValue field == region key."""
        rows = [_make_sales_row(region="华东")]
        result = _build_region_target_completion(rows)
        assert result[0]["dimensionValue"] == "华东"


# ============================================================
# 3. TestGeographicHeatmap (13 tests) — Sub-service 3
# ============================================================


class TestGeographicHeatmap:
    """Sub-service 3: province aggregation + normalize regex + colorLevel + Map.of key order."""

    def test_normalize_province_guangxi_zhuang_autonomous(self):
        """'广西壮族自治区' → 自治区 first → '广西壮族' → 壮族 → '广西' (R-T7)."""
        assert _normalize_province_name("广西壮族自治区") == "广西"

    def test_normalize_province_xinjiang_uyghur_autonomous(self):
        """'新疆维吾尔自治区' → 自治区 first → '新疆维吾尔' → 维吾尔 → '新疆'."""
        assert _normalize_province_name("新疆维吾尔自治区") == "新疆"

    def test_normalize_province_ningxia_hui_autonomous(self):
        """'宁夏回族自治区' → 自治区 first → '宁夏回族' → 回族 → '宁夏'."""
        assert _normalize_province_name("宁夏回族自治区") == "宁夏"

    def test_normalize_province_beijing_city_suffix(self):
        """'北京市' → '北京' (市$ strip)."""
        assert _normalize_province_name("北京市") == "北京"

    def test_normalize_province_hongkong_special(self):
        """'香港特别行政区' → '香港' (特别行政区$ strip)."""
        assert _normalize_province_name("香港特别行政区") == "香港"

    def test_normalize_province_none_returns_unknown(self):
        """None → '未知'."""
        assert _normalize_province_name(None) == "未知"

    def test_color_level_high_at_or_above_0_7(self):
        """heatValue=0.7 → HIGH (boundary inclusive); 0.71 → HIGH."""
        assert _determine_color_level(Decimal("0.7")) == "HIGH"
        assert _determine_color_level(Decimal("0.71")) == "HIGH"

    def test_color_level_medium_0_3_to_0_7(self):
        """heatValue=0.3 → MEDIUM (boundary inclusive); 0.69 → MEDIUM."""
        assert _determine_color_level(Decimal("0.3")) == "MEDIUM"
        assert _determine_color_level(Decimal("0.69")) == "MEDIUM"

    def test_color_level_low_below_0_3(self):
        """heatValue=0.29 → LOW; 0 → LOW; None → LOW."""
        assert _determine_color_level(Decimal("0.29")) == "LOW"
        assert _determine_color_level(Decimal("0")) == "LOW"
        assert _determine_color_level(None) == "LOW"

    def test_aggregate_by_province_unclassified_bucket(self):
        """Null/empty province → '未分类' single bucket."""
        rows = [
            _make_sales_row(province=None),
            _make_sales_row(province="", row_id=2),
        ]
        result = _aggregate_by_province(rows)
        assert "未分类" in result
        assert len(result) == 1

    def test_max_zero_heat_value_is_zero(self):
        """All amounts=0 → heat_value = amount/max_amount = 0/0 → heatValue = 0."""
        rows = [_make_sales_row(amount="0", province="P1")]
        heatmap = _build_geographic_heatmap(rows)
        assert heatmap["data"][0]["heatValue"] == 0

    def test_heatmap_options_map_of_4_keys_order(self):
        """options key order from F999/F001 golden (Rule 8): roam, visualMap, mapType, showLabel."""
        rows = [_make_sales_row(province="上海")]
        heatmap = _build_geographic_heatmap(rows)
        assert list(heatmap["options"].keys()) == ["roam", "visualMap", "mapType", "showLabel"]

    def test_heatmap_visual_map_map_of_3_keys_order(self):
        """visualMap key order from F999/F001 golden (Rule 8): min, calculable, max."""
        rows = [_make_sales_row(province="上海")]
        heatmap = _build_geographic_heatmap(rows)
        assert list(heatmap["options"]["visualMap"].keys()) == ["min", "calculable", "max"]


# ============================================================
# 4. TestRegionOpportunityScores (~24 tests) — Sub-service 4
# ============================================================


class TestRegionOpportunityScores:
    """Sub-service 4: 4-dim scoring + total + level + period window + mom_growth
    + recommendation + sort + customer dedupe."""

    # --- growth_score (R-T4) ---

    def test_growth_score_clamp_to_zero_when_minus_50(self):
        """mom_growth(50, 100) = -50 → score = -50+50 = 0 → clamp 0."""
        assert _calculate_growth_score(Decimal("50"), Decimal("100")) == Decimal("0")

    def test_growth_score_50_when_growth_zero(self):
        """mom_growth(100, 100) = 0 → score = 0+50 = 50."""
        assert _calculate_growth_score(Decimal("100"), Decimal("100")) == Decimal("50")

    def test_growth_score_clamp_to_100_when_plus_50(self):
        """mom_growth(150, 100) = +50 → score = 50+50 = 100."""
        assert _calculate_growth_score(Decimal("150"), Decimal("100")) == Decimal("100")

    def test_growth_score_prev_zero_curr_positive_returns_100(self):
        """prev=0, curr>0 → mom_growth=100 → score=100+50=150 → clamp 100."""
        assert _calculate_growth_score(Decimal("100"), Decimal("0")) == Decimal("100")

    # --- base_score (R-T3) ---

    def test_base_score_3x_multiplier(self):
        """region=10, total=100 → ratio=0.1000*100=10.00 → score=10*3=30."""
        result = _calculate_base_score(Decimal("10"), Decimal("100"))
        assert result == Decimal("30")

    def test_base_score_clamp_to_100_at_33_34_pct(self):
        """region=33.34, total=100 → ratio=33.34 → score=100.02 → clamp 100."""
        assert _calculate_base_score(Decimal("33.34"), Decimal("100")) == Decimal("100")

    def test_base_score_below_clamp_at_33_33_pct(self):
        """region=33.33, total=100 → ratio=33.33 → score=99.99 (NOT 100)."""
        result = _calculate_base_score(Decimal("33.33"), Decimal("100"))
        assert result == Decimal("99.99")

    def test_base_score_total_zero_returns_zero(self):
        """total_sales=0 → base_score=0 (div-by-zero guard)."""
        assert _calculate_base_score(Decimal("100"), Decimal("0")) == Decimal("0")

    # --- margin_score (R-T2) ---

    def test_margin_score_3_33_decimal_exact(self):
        """grossMargin=30 → score=30*Decimal('3.33')=99.90 (NOT 100)."""
        assert _calculate_margin_score(Decimal("30")) == Decimal("99.90")

    def test_margin_score_clamp_to_100_at_30_04_pct(self):
        """grossMargin=30.04 → score=30.04*3.33=100.0332 → clamp 100."""
        assert _calculate_margin_score(Decimal("30.04")) == Decimal("100")

    def test_margin_score_none_returns_zero(self):
        """grossMargin=None → score=0."""
        assert _calculate_margin_score(None) == Decimal("0")

    # --- penetration_score (R-T1: integer floor division) ---

    def test_penetration_score_int_division(self):
        """customers=5, orders=99 → score=5*10 + 99//10 = 50+9 = 59 (NOT 59.9)."""
        assert _calculate_penetration_score(5, 99) == Decimal("59")

    def test_penetration_score_str_input_coerced_via_int(self):
        """customers='5', orders='99' → int() coerced → 59."""
        assert _calculate_penetration_score("5", "99") == Decimal("59")

    def test_penetration_score_clamp_to_100(self):
        """customers=20, orders=0 → score=200 → clamp 100."""
        assert _calculate_penetration_score(20, 0) == Decimal("100")

    # --- total_score (weights) ---

    def test_total_score_weights_sum_to_one(self):
        """g=100, b=100, m=100, p=100 → total = 30+25+25+20 = 100."""
        result = _calculate_total_score(
            Decimal("100"), Decimal("100"), Decimal("100"), Decimal("100")
        )
        assert result == Decimal("100.00")

    def test_total_score_zero_when_all_dims_zero(self):
        """All dims=0 → total=0."""
        result = _calculate_total_score(
            Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0")
        )
        assert result == Decimal("0.00")

    # --- level boundaries ---

    def test_opportunity_level_high_at_70(self):
        """totalScore=70 → HIGH (boundary inclusive); 69.99 → MEDIUM."""
        assert _determine_opportunity_level(Decimal("70")) == "HIGH"
        assert _determine_opportunity_level(Decimal("69.99")) == "MEDIUM"

    def test_opportunity_level_medium_40_to_70(self):
        """totalScore=40 → MEDIUM (boundary inclusive); 39.99 → LOW."""
        assert _determine_opportunity_level(Decimal("40")) == "MEDIUM"
        assert _determine_opportunity_level(Decimal("39.99")) == "LOW"

    def test_opportunity_level_low_below_40(self):
        """totalScore=39.99 → LOW; None → LOW."""
        assert _determine_opportunity_level(Decimal("39.99")) == "LOW"
        assert _determine_opportunity_level(None) == "LOW"

    # --- period window (R-T5) ---

    def test_previous_period_window_5_day_span(self):
        """start=2024-01-15, end=2024-01-20 → days=5 → prev=(2024-01-09, 2024-01-14)."""
        ps, pe = _previous_period_window(date(2024, 1, 15), date(2024, 1, 20))
        assert ps == date(2024, 1, 9)
        assert pe == date(2024, 1, 14)

    def test_previous_period_window_single_day(self):
        """start=end=2024-01-15 → days=0 → prev=(2024-01-14, 2024-01-14)."""
        ps, pe = _previous_period_window(date(2024, 1, 15), date(2024, 1, 15))
        assert ps == date(2024, 1, 14)
        assert pe == date(2024, 1, 14)

    def test_previous_period_window_year_boundary(self):
        """start=2024-01-05, end=2024-01-10 → days=5 → prev=(2023-12-30, 2024-01-04)."""
        ps, pe = _previous_period_window(date(2024, 1, 5), date(2024, 1, 10))
        assert ps == date(2023, 12, 30)
        assert pe == date(2024, 1, 4)

    # --- mom_growth (imported from analysis_sales) ---

    def test_calculate_mom_growth_prev_zero_curr_positive_returns_100(self):
        """prev=0, curr=100 → 100 (sales convention)."""
        assert _calculate_mom_growth(Decimal("100"), Decimal("0")) == Decimal("100")

    def test_calculate_mom_growth_prev_zero_curr_zero_returns_zero(self):
        """prev=0, curr=0 → 0."""
        assert _calculate_mom_growth(Decimal("0"), Decimal("0")) == Decimal("0")

    def test_calculate_mom_growth_prev_nonzero_curr_null_returns_minus_100(self):
        """prev=100, curr=None → -100."""
        assert _calculate_mom_growth(None, Decimal("100")) == Decimal("-100")

    # --- recommendation template ---

    def test_recommendation_high_level_template(self):
        """level=HIGH → starts with '{region}是高潜力区域，'."""
        recommendation = _generate_opportunity_recommendation(
            "华东",
            Decimal("80"),   # total (≥70 → HIGH)
            Decimal("90"),   # growth_score (strongest)
            Decimal("70"),   # base_score
            Decimal("60"),   # margin_score
            Decimal("40"),   # penetration_score (weakest)
        )
        assert recommendation.startswith("华东是高潜力区域，")

    def test_recommendation_strongest_weakest_dim_selection(self):
        """Picks max dim as 优势 and min dim as 建议重点提升 from 4 dims."""
        # growth=90 (max), penetration=40 (min)
        recommendation = _generate_opportunity_recommendation(
            "华东",
            Decimal("80"),   # total
            Decimal("90"),   # growth_score → strongest
            Decimal("70"),   # base_score
            Decimal("60"),   # margin_score
            Decimal("40"),   # penetration_score → weakest
        )
        assert "优势在于增长率" in recommendation
        assert "建议重点提升市场渗透" in recommendation

    # --- sort + dedupe ---

    def test_sort_by_total_score_desc(self):
        """Result list sorted by totalScore descending."""
        rows = [
            _make_sales_row(region="A", amount="100", row_id=1),
            _make_sales_row(region="B", amount="500", row_id=2),
            _make_sales_row(region="C", amount="300", row_id=3),
        ]
        result = _build_opportunity_scores(rows, [])
        scores = [r["totalScore"] for r in result]
        assert scores == sorted(scores, reverse=True)

    def test_customer_count_set_dedupes(self):
        """Same customer name added twice → customer_count=1 (set semantics)."""
        agg = RegionAggregation()
        agg.add_sale({"customer_name": "C1", "amount": Decimal("10")})
        agg.add_sale({"customer_name": "C1", "amount": Decimal("20")})
        assert agg.customer_count == 1
