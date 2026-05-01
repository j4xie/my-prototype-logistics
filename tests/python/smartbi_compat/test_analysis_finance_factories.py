"""Unit tests for analysis_finance.py DTO dict factories.

Each factory must:
  - Emit fields in declared order (matching Java declaration order)
  - Default optional Lists/Dicts to [] / {} (per Lombok @Data + sister precedent)
  - Default optional Optional<X> fields to None
  - Pass through provided values

Java DTO source files (read-only reference):
  - DashboardResponse.java (16 fields, 4 deprecated still emit)
  - KPICard.java (13 fields)
  - RankingItem.java (6 fields)
  - ChartConfig.java (7 fields, xAxisField/yAxisField LOWERCASE per Jackson)
  - AIInsight.java (5 fields)
  - DateRange.java (5 declared + 2 derived = 7 total)
  - MetricResult.java (11 fields, ALL emit per Lombok)
"""
from __future__ import annotations

import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend" / "python"))

from smartbi_compat.api.analysis_finance import (
    _new_ai_insight_dict,
    _new_chart_config_dict,
    _new_dashboard_response_dict,
    _new_date_range_dict,
    _new_kpi_card_dict,
    _new_metric_result_dict,
    _new_ranking_item_dict,
)
from smartbi_compat.date_range import DateRange


class TestDashboardResponseFactory:
    def test_default_shape_has_16_fields(self):
        d = _new_dashboard_response_dict()
        assert len(d) == 16

    def test_field_order(self):
        d = _new_dashboard_response_dict()
        assert list(d.keys()) == [
            "period", "startDate", "endDate", "kpiCards", "metricCards",
            "rankings", "charts", "chartList", "aiInsights", "alerts",
            "recommendations", "suggestions", "generatedAt", "lastUpdated",
            "fromCache", "cacheExpireAt",
        ]

    def test_collection_defaults(self):
        d = _new_dashboard_response_dict()
        assert d["kpiCards"] == []
        assert d["rankings"] == {}
        assert d["charts"] == {}
        assert d["aiInsights"] == []
        assert d["metricCards"] is None
        assert d["chartList"] is None
        assert d["suggestions"] is None
        assert d["lastUpdated"] is None


class TestKPICardFactory:
    def test_default_shape_has_13_fields(self):
        d = _new_kpi_card_dict(key="X", title="x")
        assert len(d) == 13

    def test_status_default_green(self):
        d = _new_kpi_card_dict(key="X", title="x")
        assert d["status"] == "green"

    def test_field_order(self):
        d = _new_kpi_card_dict(key="X", title="x")
        assert list(d.keys()) == [
            "key", "title", "value", "rawValue", "unit", "change", "changeRate",
            "trend", "status", "compareText", "description", "targetValue", "completionRate",
        ]


class TestMetricResultFactory:
    """11 declared @Data fields (NEW in finance, not in sister)."""

    def test_default_shape_has_11_fields(self):
        d = _new_metric_result_dict(metric_code="AP_BALANCE", metric_name="应付余额")
        assert len(d) == 11, f"expected 11 fields, got {len(d)}: {list(d.keys())}"

    def test_field_order(self):
        d = _new_metric_result_dict(metric_code="A", metric_name="a")
        assert list(d.keys()) == [
            "metricCode", "metricName", "value", "formattedValue", "unit",
            "changePercent", "changeDirection", "changeValue", "alertLevel",
            "dimensionValue", "description",
        ]

    def test_alert_level_string(self):
        """alertLevel is enum.name() string per Java Jackson."""
        d = _new_metric_result_dict(metric_code="X", metric_name="x", alert_level="GREEN")
        assert d["alertLevel"] == "GREEN"
        assert isinstance(d["alertLevel"], str)


class TestRankingItemFactory:
    def test_default_shape_has_6_fields(self):
        d = _new_ranking_item_dict(rank=1, name="A", value=Decimal("100"))
        assert len(d) == 6

    def test_field_order(self):
        d = _new_ranking_item_dict(rank=1, name="A", value=Decimal("100"))
        assert list(d.keys()) == ["rank", "name", "value", "target", "completionRate", "alertLevel"]


class TestChartConfigFactory:
    def test_default_shape_has_7_fields(self):
        d = _new_chart_config_dict(chart_type="PIE", title="t")
        assert len(d) == 7

    def test_field_order_lowercase_axes(self):
        """xaxisField / yaxisField lowercase per Jackson demangling."""
        d = _new_chart_config_dict(chart_type="PIE", title="t")
        assert list(d.keys()) == [
            "chartType", "title", "seriesField", "data", "options", "xaxisField", "yaxisField",
        ]

    def test_data_default_empty_list(self):
        d = _new_chart_config_dict(chart_type="PIE", title="t")
        assert d["data"] == []


class TestAIInsightFactory:
    def test_default_shape_has_5_fields(self):
        d = _new_ai_insight_dict(level="YELLOW", category="cat", message="msg")
        assert len(d) == 5

    def test_field_order(self):
        d = _new_ai_insight_dict(level="YELLOW", category="cat", message="msg")
        assert list(d.keys()) == ["level", "category", "message", "relatedEntity", "actionSuggestion"]


class TestDateRangeFactory:
    def test_year_inference(self):
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        d = _new_date_range_dict(r)
        assert d["granularity"] == "YEAR"

    def test_month_inference(self):
        r = DateRange.custom(date(2025, 3, 1), date(2025, 3, 31))
        d = _new_date_range_dict(r)
        assert d["granularity"] == "MONTH"

    def test_custom_inference(self):
        r = DateRange.custom(date(2025, 1, 5), date(2025, 1, 27))
        d = _new_date_range_dict(r)
        assert d["granularity"] == "CUSTOM"

    def test_derived_days_and_valid(self):
        r = DateRange.custom(date(2025, 1, 1), date(2025, 1, 10))
        d = _new_date_range_dict(r)
        assert d["days"] == 10
        assert d["valid"] is True

    def test_field_order(self):
        r = DateRange.custom(date(2025, 1, 1), date(2025, 1, 10))
        d = _new_date_range_dict(r)
        assert list(d.keys()) == [
            "startDate", "endDate", "granularity", "originalExpression",
            "relative", "days", "valid",
        ]


class TestAgingBucketAlertLevel:
    """Mirror Java FinanceAnalysisServiceImpl.getAgingBucketAlertLevel (line 1590-1603)."""

    def test_0_30_returns_green(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("0-30天") == "GREEN"

    def test_31_60_returns_yellow(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("31-60天") == "YELLOW"

    def test_61_90_returns_yellow(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("61-90天") == "YELLOW"

    def test_over_90_returns_red(self):
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("90天以上") == "RED"

    def test_unknown_bucket_returns_green_default(self):
        """Java map.getOrDefault(..., GREEN) — unknown key returns GREEN."""
        from smartbi_compat.api.analysis_finance import _get_aging_bucket_alert_level
        assert _get_aging_bucket_alert_level("invalid-bucket") == "GREEN"


class TestCalculateAgingBuckets:
    """Mirror Java FinanceAnalysisServiceImpl.calculateAgingBuckets (line 1492-1524).

    Outstanding = receivable - collection. Skip rows where outstanding <= 0.
    Null aging_days fallback to 0 → 0-30天 bucket.
    """

    def test_empty_input_returns_4_zero_buckets(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        result = _calculate_aging_buckets([])
        assert result == {
            "0-30天": Decimal("0"),
            "31-60天": Decimal("0"),
            "61-90天": Decimal("0"),
            "90天以上": Decimal("0"),
        }

    def test_single_row_aging_15_goes_to_0_30(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "1000", "collection_amount": "200", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert result["0-30天"] == Decimal("800")
        assert result["31-60天"] == Decimal("0")

    def test_aging_45_goes_to_31_60(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "500", "collection_amount": "0", "aging_days": 45}]
        result = _calculate_aging_buckets(rows)
        assert result["31-60天"] == Decimal("500")

    def test_aging_75_goes_to_61_90(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "300", "collection_amount": "0", "aging_days": 75}]
        result = _calculate_aging_buckets(rows)
        assert result["61-90天"] == Decimal("300")

    def test_aging_120_goes_to_over_90(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "200", "collection_amount": "0", "aging_days": 120}]
        result = _calculate_aging_buckets(rows)
        assert result["90天以上"] == Decimal("200")

    def test_outstanding_zero_skipped(self):
        """Java line 1505 — skip if outstanding <= 0."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "100", "collection_amount": "100", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())

    def test_outstanding_negative_skipped(self):
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "50", "collection_amount": "150", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())

    def test_null_aging_days_treated_as_0_30(self):
        """Java line 1500 — null fallback to 0 → 0-30天 bucket."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "1000", "collection_amount": "0", "aging_days": None}]
        result = _calculate_aging_buckets(rows)
        assert result["0-30天"] == Decimal("1000")

    def test_null_receivable_treated_as_zero(self):
        """Rule 1 — null receivable → Decimal('0'). Combined with non-null collection
        produces negative outstanding → skipped."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": None, "collection_amount": "100", "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())

    def test_decimal_zero_receivable_not_skipped_when_collection_negative(self):
        """Rule 1 edge — Decimal('0') is falsy in Python `or` but Java treats != null.
        With receivable=Decimal('0') and collection=null → outstanding=0, SKIPPED (Java line 1505 <=).
        This test pins behavior to mirror Java strictly."""
        from smartbi_compat.api.analysis_finance import _calculate_aging_buckets
        rows = [{"receivable_amount": "0", "collection_amount": None, "aging_days": 15}]
        result = _calculate_aging_buckets(rows)
        assert all(v == Decimal("0") for v in result.values())


class TestReceivableAlertHelpers:
    """4 threshold helpers — boundary smoke only (PR-A). Full 24-case table is PR-B.

    Java uses > strict; boundary value falls into LOWER alertLevel.
    """

    def test_collection_rate_below_60_red(self):
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        assert _determine_collection_rate_alert(Decimal("59.99")) == "RED"
        assert _determine_collection_rate_alert(Decimal("0")) == "RED"

    def test_collection_rate_60_to_80_yellow(self):
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        # Java line 1639-1644: if v<60 RED; if v<80 YELLOW; else GREEN
        # Boundary 60.0: NOT < 60 → falls to YELLOW
        assert _determine_collection_rate_alert(Decimal("60.00")) == "YELLOW"
        assert _determine_collection_rate_alert(Decimal("79.99")) == "YELLOW"

    def test_collection_rate_above_80_green(self):
        from smartbi_compat.api.analysis_finance import _determine_collection_rate_alert
        assert _determine_collection_rate_alert(Decimal("80.00")) == "GREEN"
        assert _determine_collection_rate_alert(Decimal("100.00")) == "GREEN"

    def test_aging_30_alert_thresholds(self):
        """Java MetricCalculatorServiceImpl line 491-494: >50 RED, >25 YELLOW, else GREEN."""
        from smartbi_compat.api.analysis_finance import _aging_30_alert
        assert _aging_30_alert(Decimal("0")) == "GREEN"
        assert _aging_30_alert(Decimal("25")) == "GREEN"      # NOT > 25
        assert _aging_30_alert(Decimal("25.01")) == "YELLOW"  # > 25
        assert _aging_30_alert(Decimal("50")) == "YELLOW"     # NOT > 50
        assert _aging_30_alert(Decimal("50.01")) == "RED"     # > 50

    def test_aging_60_alert_thresholds(self):
        """Java MetricCalculatorServiceImpl line 485-488: >30 RED, >15 YELLOW, else GREEN."""
        from smartbi_compat.api.analysis_finance import _aging_60_alert
        assert _aging_60_alert(Decimal("0")) == "GREEN"
        assert _aging_60_alert(Decimal("15")) == "GREEN"
        assert _aging_60_alert(Decimal("15.01")) == "YELLOW"
        assert _aging_60_alert(Decimal("30")) == "YELLOW"
        assert _aging_60_alert(Decimal("30.01")) == "RED"

    def test_aging_90_alert_thresholds(self):
        """Java FinanceAnalysisServiceImpl line 715-719: >20.0 RED, >10.0 YELLOW, else GREEN."""
        from smartbi_compat.api.analysis_finance import _aging_90_alert
        assert _aging_90_alert(Decimal("0")) == "GREEN"
        assert _aging_90_alert(Decimal("10")) == "GREEN"
        assert _aging_90_alert(Decimal("10.01")) == "YELLOW"
        assert _aging_90_alert(Decimal("20")) == "YELLOW"
        assert _aging_90_alert(Decimal("20.01")) == "RED"


class TestReceivableAgingChartRealImpl:
    """Replace stub at line 2000 with real impl mirroring Java line 586-624.
    Empty data path must still emit 4 buckets in fixed order (Java line 600)."""

    @pytest.mark.asyncio
    async def test_empty_data_emits_4_buckets(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        result = await analysis_finance._get_receivable_aging_chart("F999", date(2025, 12, 31))

        assert result["chartType"] == "BAR"
        assert result["title"] == "应收账款账龄分布"
        assert result["seriesField"] is None
        assert result["xaxisField"] == "agingBucket"
        assert result["yaxisField"] == "amount"
        assert result["options"] == {
            "colors": ["#91cc75", "#fac858", "#ee6666", "#c23531"],
            "showAlert": True,
        }
        # 4 buckets in fixed order, all amount=0/percentage=0
        data = result["data"]
        assert len(data) == 4
        assert [d["agingBucket"] for d in data] == ["0-30天", "31-60天", "61-90天", "90天以上"]
        assert all(d["amount"] == 0 and d["percentage"] == 0 for d in data)
        # alertLevel hardcoded map (regardless of amount)
        assert [d["alertLevel"] for d in data] == ["GREEN", "YELLOW", "YELLOW", "RED"]

    @pytest.mark.asyncio
    async def test_real_data_computes_amounts_and_percentages(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            assert record_type == "AR"
            # 1y window check — start ≈ end - 1y
            assert (end - start).days >= 364
            return [
                {"receivable_amount": "1000", "collection_amount": "200", "aging_days": 15},
                {"receivable_amount": "500", "collection_amount": "0", "aging_days": 75},
                {"receivable_amount": "300", "collection_amount": "0", "aging_days": 120},
            ]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        result = await analysis_finance._get_receivable_aging_chart("F001", date(2025, 12, 31))

        # Total = 800 + 500 + 300 = 1600
        data = result["data"]
        assert data[0]["agingBucket"] == "0-30天"
        assert data[0]["amount"] == 800   # 1000 - 200
        assert data[0]["percentage"] == 50.0  # 800/1600 * 100
        assert data[2]["agingBucket"] == "61-90天"
        assert data[2]["amount"] == 500
        assert data[3]["agingBucket"] == "90天以上"
        assert data[3]["amount"] == 300

    @pytest.mark.asyncio
    async def test_uses_relativedelta_not_timedelta_365(self, monkeypatch):
        """Leap-year boundary: end_date = 2024-02-29 should yield start_date = 2023-02-28
        (relativedelta clamps), NOT 2023-03-01 (timedelta(days=365) wraps wrong)."""
        from smartbi_compat.api import analysis_finance

        captured = {}
        async def fake_query(factory_id, record_type, start, end):
            captured["start"] = start
            captured["end"] = end
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        await analysis_finance._get_receivable_aging_chart("F999", date(2024, 2, 29))

        assert captured["start"] == date(2023, 2, 28)  # relativedelta clamps to Feb 28
        assert captured["end"] == date(2024, 2, 29)


class TestReceivableMetricsImpl:
    """Mirror Java FinanceAnalysisServiceImpl.getReceivableMetrics (line 627-732).
    Empty-data path produces 5 metrics with value=0; F999 golden lock."""

    @pytest.mark.asyncio
    async def test_empty_data_emits_5_metrics_f999_shape(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))

        assert len(metrics) == 5
        codes = [m["metricCode"] for m in metrics]
        assert codes == ["AR_BALANCE", "COLLECTION_RATE", "AGING_30_RATIO", "AGING_60_RATIO", "AGING_90_RATIO"]
        names = [m["metricName"] for m in metrics]
        assert names == ["应收余额", "回款率", "30天以上账龄占比", "60天以上账龄占比", "90天以上账龄占比"]
        # All values 0
        assert all(m["value"] == 0 for m in metrics)
        # AR_BALANCE alertLevel hardcoded GREEN
        assert metrics[0]["alertLevel"] == "GREEN"
        # COLLECTION_RATE: 0 < 60 → RED
        assert metrics[1]["alertLevel"] == "RED"
        # 30/60/90 ratio: 0 not > threshold → GREEN
        assert metrics[2]["alertLevel"] == "GREEN"
        assert metrics[3]["alertLevel"] == "GREEN"
        assert metrics[4]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_normal_data_arithmetic_shape(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            # 1000 receivable, 600 collected, 1 row aged 15
            return [{"receivable_amount": "1000", "collection_amount": "600", "aging_days": 15}]
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F001", date(2025, 12, 31))

        # AR_BALANCE = 1000 - 600 = 400
        assert metrics[0]["value"] == 400
        assert metrics[0]["formattedValue"] == "400.00"
        assert metrics[0]["unit"] == "元"
        # COLLECTION_RATE = 600/1000*100 = 60.00 → boundary 60 NOT < 60 → YELLOW
        assert metrics[1]["value"] == 60
        assert metrics[1]["formattedValue"] == "60.00%"
        assert metrics[1]["unit"] == "%"
        assert metrics[1]["alertLevel"] == "YELLOW"
        # All outstanding (400) is in 0-30天 bucket → over30/60/90 ratios all = 0
        assert metrics[2]["value"] == 0  # AGING_30_RATIO
        assert metrics[3]["value"] == 0
        assert metrics[4]["value"] == 0

    @pytest.mark.asyncio
    async def test_zero_receivable_collection_rate_zero(self, monkeypatch):
        """Zero-guard line 659: total_receivable=0 → collection_rate=0 (not div-by-zero)."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))
        assert metrics[1]["metricCode"] == "COLLECTION_RATE"
        assert metrics[1]["value"] == 0
        assert metrics[1]["alertLevel"] == "RED"  # 0 < 60

    @pytest.mark.asyncio
    async def test_metric_envelope_has_11_fields(self, monkeypatch):
        """F999 golden lock — _new_metric_result_dict emits all 11 Java MetricResult fields."""
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))
        expected_keys = {
            "metricCode", "metricName", "value", "formattedValue", "unit",
            "changePercent", "changeDirection", "changeValue",
            "alertLevel", "dimensionValue", "description",
        }
        for m in metrics:
            assert set(m.keys()) == expected_keys

    @pytest.mark.asyncio
    async def test_descriptions_match_f999_golden(self, monkeypatch):
        from smartbi_compat.api import analysis_finance

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(analysis_finance, "_query_finance_data", fake_query)

        metrics = await analysis_finance._get_receivable_metrics("F999", date(2025, 12, 31))
        descs = [m["description"] for m in metrics]
        assert descs == [
            "尚未收回的应收账款总额",
            "已回款金额占应收总额的比例",
            "账龄超过30天的应收款占比",
            "账龄超过60天的应收款占比",
            "账龄超过90天的高风险应收款占比",
        ]
