"""Unit tests for analysis_sales.py dict factories + helpers."""
from __future__ import annotations

import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "backend" / "python"))

from smartbi_compat.api.analysis_sales import _strip_volatile


class TestStripVolatile:
    def test_removes_generated_at(self):
        obj = {"generatedAt": "2026-04-30T06:34:34", "kpiCards": []}
        assert _strip_volatile(obj) == {"kpiCards": []}

    def test_removes_last_updated(self):
        obj = {"lastUpdated": "2026-04-30T06:34:34", "value": 42}
        assert _strip_volatile(obj) == {"value": 42}

    def test_removes_cache_expire_at(self):
        obj = {"cacheExpireAt": None, "fromCache": False}
        assert _strip_volatile(obj) == {"fromCache": False}

    def test_removes_timestamp(self):
        obj = {"timestamp": "x", "data": [1, 2]}
        assert _strip_volatile(obj) == {"data": [1, 2]}

    def test_recursive_dict(self):
        obj = {
            "outer": {"inner": {"generatedAt": "x", "value": 1}},
            "lastUpdated": "y",
        }
        assert _strip_volatile(obj) == {"outer": {"inner": {"value": 1}}}

    def test_recursive_list(self):
        obj = [{"generatedAt": "x", "id": 1}, {"id": 2}]
        assert _strip_volatile(obj) == [{"id": 1}, {"id": 2}]

    def test_preserves_non_volatile(self):
        obj = {"name": "abc", "amount": 12.34, "items": [1, 2, 3]}
        assert _strip_volatile(obj) == obj

    def test_handles_primitives(self):
        assert _strip_volatile(42) == 42
        assert _strip_volatile("hello") == "hello"
        assert _strip_volatile(None) is None


from datetime import date
from smartbi_compat.api.analysis_sales import _new_date_range_dict
from smartbi_compat.date_range import DateRange


class TestDateRangeDict:
    def test_F999_observed_shape(self):
        """Match F999 golden 7-field shape: 5 declared + 2 derived."""
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        result = _new_date_range_dict(r)
        assert set(result.keys()) == {
            "startDate", "endDate", "granularity",
            "originalExpression", "relative", "days", "valid",
        }
        assert result["startDate"] == "2025-01-01"
        assert result["endDate"] == "2025-12-31"
        assert result["days"] == 365
        assert result["valid"] is True

    def test_key_order_matches_F999(self):
        """Foundation §3 R9: dict key order must match Java HashMap iteration order."""
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        keys = list(_new_date_range_dict(r).keys())
        # Order observed in F999 golden
        assert keys == [
            "startDate", "endDate", "granularity",
            "originalExpression", "relative", "days", "valid",
        ]

    def test_one_day_range(self):
        r = DateRange.custom(date(2025, 6, 15), date(2025, 6, 15))
        result = _new_date_range_dict(r)
        assert result["days"] == 1
        assert result["valid"] is True

    def test_invalid_range(self):
        """end before start → valid=False."""
        r = DateRange.custom(date(2025, 12, 31), date(2025, 1, 1))
        result = _new_date_range_dict(r)
        assert result["valid"] is False


from smartbi_compat.api.analysis_sales import _new_dashboard_response_dict


class TestDashboardResponseDict:
    DECLARED_KEYS = {
        "period", "startDate", "endDate", "kpiCards", "metricCards",
        "rankings", "charts", "chartList", "aiInsights", "alerts",
        "recommendations", "suggestions", "generatedAt", "lastUpdated",
        "fromCache", "cacheExpireAt",
    }

    def test_all_16_keys_present(self):
        result = _new_dashboard_response_dict()
        assert set(result.keys()) == self.DECLARED_KEYS

    def test_F999_empty_state_defaults(self):
        """When no kwargs, factory matches F999 empty-state defaults."""
        result = _new_dashboard_response_dict(
            ai_insights=[
                {"level": "YELLOW", "category": "数据状态",
                 "message": "test", "relatedEntity": None,
                 "actionSuggestion": "test"}
            ],
            suggestions=["test suggestion"],
            last_updated="2026-04-30T00:00:00",
        )
        assert result["period"] is None
        assert result["startDate"] is None
        assert result["endDate"] is None
        assert result["kpiCards"] == []
        assert result["metricCards"] is None
        assert result["rankings"] == {}
        assert result["charts"] == {}
        assert result["chartList"] is None
        assert len(result["aiInsights"]) == 1
        assert result["alerts"] is None
        assert result["recommendations"] is None
        assert result["suggestions"] == ["test suggestion"]
        assert result["generatedAt"] is None
        assert result["lastUpdated"] == "2026-04-30T00:00:00"
        assert result["fromCache"] is False
        assert result["cacheExpireAt"] is None

    def test_key_insertion_order_matches_java(self):
        """Foundation §4: key order = Java DashboardResponse declaration order."""
        keys = list(_new_dashboard_response_dict().keys())
        expected_order = [
            "period", "startDate", "endDate", "kpiCards", "metricCards",
            "rankings", "charts", "chartList", "aiInsights", "alerts",
            "recommendations", "suggestions", "generatedAt", "lastUpdated",
            "fromCache", "cacheExpireAt",
        ]
        assert keys == expected_order

    def test_deprecated_fields_emit_null(self):
        """Lombok @Data emits all 16 fields incl. 5 @Deprecated ones."""
        result = _new_dashboard_response_dict()
        # @Deprecated: metricCards / chartList / suggestions / lastUpdated
        # (fromCache is not deprecated; cacheExpireAt is not deprecated)
        assert "metricCards" in result and result["metricCards"] is None
        assert "chartList" in result and result["chartList"] is None
        assert "suggestions" in result and result["suggestions"] is None
        assert "lastUpdated" in result and result["lastUpdated"] is None


from decimal import Decimal
from smartbi_compat.api.analysis_sales import _new_ranking_item_dict


class TestRankingItemDict:
    def test_6_fields_only(self):
        """RankingItem.java is exactly 6 fields, no derived getters."""
        result = _new_ranking_item_dict(rank=1, name="测试", value=Decimal("100"))
        assert set(result.keys()) == {
            "rank", "name", "value", "target", "completionRate", "alertLevel",
        }

    def test_full_shape_salesperson(self):
        result = _new_ranking_item_dict(
            rank=1, name="张三", value=Decimal("100000"),
            target=Decimal("80000"),
            completion_rate=Decimal("125.00"),
            alert_level="GREEN",
        )
        assert result == {
            "rank": 1, "name": "张三", "value": Decimal("100000"),
            "target": Decimal("80000"), "completionRate": Decimal("125.00"),
            "alertLevel": "GREEN",
        }

    def test_product_ranking_no_target(self):
        """product/customer rankings leave target null; completionRate = pct."""
        result = _new_ranking_item_dict(
            rank=2, name="蔬菜", value=Decimal("50000"),
            completion_rate=Decimal("25.00"),
            alert_level="GREEN",
        )
        assert result["target"] is None
        assert result["completionRate"] == Decimal("25.00")

    def test_key_order(self):
        result = _new_ranking_item_dict(rank=1, name="x", value=Decimal("1"))
        assert list(result.keys()) == [
            "rank", "name", "value", "target", "completionRate", "alertLevel",
        ]


from smartbi_compat.api.analysis_sales import _new_chart_config_dict


class TestChartConfigDict:
    def test_F999_trend_shape(self):
        """F999 trendChart shape: 7 keys, LINE chart with empty data."""
        result = _new_chart_config_dict(
            chart_type="LINE",
            title="销售趋势",
            xaxis_field="date",
            yaxis_field="amount",
            data=[],
            options={"showDataLabels": False, "smooth": True},
        )
        assert set(result.keys()) == {
            "chartType", "title", "seriesField", "data", "options",
            "xaxisField", "yaxisField",
        }
        assert result["chartType"] == "LINE"
        assert result["title"] == "销售趋势"
        assert result["seriesField"] is None
        assert result["data"] == []
        assert result["options"] == {"showDataLabels": False, "smooth": True}
        assert result["xaxisField"] == "date"
        assert result["yaxisField"] == "amount"

    def test_lowercase_xaxis(self):
        """Jackson serializes xAxisField → xaxisField (lowercase a)."""
        result = _new_chart_config_dict(chart_type="LINE", title="t")
        assert "xaxisField" in result
        assert "xAxisField" not in result

    def test_options_can_be_null(self):
        """Gold-path ChartConfig has options=null (Java doesn't set it)."""
        result = _new_chart_config_dict(
            chart_type="PIE", title="占比",
            xaxis_field="category", yaxis_field="amount",
            data=[{"category": "x", "amount": Decimal("10")}],
        )
        assert result["options"] is None

    def test_key_order(self):
        result = _new_chart_config_dict(chart_type="LINE", title="t")
        # Order matches F999 golden observation
        assert list(result.keys()) == [
            "chartType", "title", "seriesField", "data", "options",
            "xaxisField", "yaxisField",
        ]


from smartbi_compat.api.analysis_sales import _new_ai_insight_dict


class TestAiInsightDict:
    def test_F999_yellow_shape(self):
        result = _new_ai_insight_dict(
            level="YELLOW",
            category="数据状态",
            message="当前时间范围内暂无销售数据",
            action_suggestion="请上传销售数据或调整时间范围",
        )
        assert set(result.keys()) == {
            "level", "category", "message", "relatedEntity", "actionSuggestion",
        }
        assert result["level"] == "YELLOW"
        assert result["category"] == "数据状态"
        assert result["message"] == "当前时间范围内暂无销售数据"
        assert result["relatedEntity"] is None
        assert result["actionSuggestion"] == "请上传销售数据或调整时间范围"

    def test_key_order(self):
        result = _new_ai_insight_dict(level="INFO", category="x", message="y")
        assert list(result.keys()) == [
            "level", "category", "message", "relatedEntity", "actionSuggestion",
        ]


from smartbi_compat.api.analysis_sales import _new_kpi_card_dict


class TestKpiCardDict:
    def test_13_fields_present(self):
        """KPICard 13 fields per overview spec finding (javap-confirmed by Task A.3)."""
        result = _new_kpi_card_dict(key="total_revenue", title="总营收")
        assert set(result.keys()) == {
            "key", "title", "value", "rawValue", "unit", "change",
            "changeRate", "trend", "status", "compareText",
            "description", "targetValue", "completionRate",
        }

    def test_status_default_green(self):
        """Lombok @Builder.Default sets status=green when not provided."""
        result = _new_kpi_card_dict(key="x", title="x")
        assert result["status"] == "green"

    def test_F001_gold_kpi_shape(self):
        """F001 Gold-path KPI card example (4 cards × this shape)."""
        result = _new_kpi_card_dict(
            key="total_revenue", title="总营收",
            value="20639884.52", raw_value=Decimal("20639884.52"),
            unit="元", status="green",
        )
        assert result["key"] == "total_revenue"
        assert result["value"] == "20639884.52"
        assert result["rawValue"] == Decimal("20639884.52")
        assert result["unit"] == "元"
        assert result["change"] is None
        assert result["changeRate"] is None
        assert result["trend"] is None
        assert result["status"] == "green"

    def test_key_order(self):
        result = _new_kpi_card_dict(key="x", title="x")
        assert list(result.keys()) == [
            "key", "title", "value", "rawValue", "unit", "change",
            "changeRate", "trend", "status", "compareText",
            "description", "targetValue", "completionRate",
        ]
