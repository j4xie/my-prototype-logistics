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
