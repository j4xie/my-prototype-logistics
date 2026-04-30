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


import pytest
import asyncio
from datetime import date as _date
from smartbi_compat.api.analysis_sales import (
    _get_sales_overview,
    _get_salesperson_ranking,
    _get_product_ranking,
    _get_customer_ranking,
    _get_sales_trend_chart,
)
from smartbi_compat.date_range import DateRange


@pytest.fixture
def range_2025():
    return DateRange.custom(_date(2025, 1, 1), _date(2025, 12, 31))


class TestSubServiceStubs:
    def test_overview_stub_returns_F999_shape(self, range_2025):
        result = asyncio.run(_get_sales_overview("F999", range_2025))
        assert isinstance(result, dict)
        assert len(result["aiInsights"]) == 1
        assert result["aiInsights"][0]["level"] == "YELLOW"
        assert result["aiInsights"][0]["message"] == "当前时间范围内暂无销售数据"
        assert result["suggestions"] == ["请先上传销售数据以开始分析"]
        assert result["kpiCards"] == []
        assert result["fromCache"] is False

    def test_salesperson_ranking_stub_returns_empty_list(self, range_2025):
        result = asyncio.run(_get_salesperson_ranking("F999", range_2025))
        assert result == []

    def test_product_ranking_stub_returns_empty_list(self, range_2025):
        result = asyncio.run(_get_product_ranking("F999", range_2025))
        assert result == []

    def test_customer_ranking_stub_returns_empty_list(self, range_2025):
        result = asyncio.run(_get_customer_ranking("F999", range_2025))
        assert result == []

    def test_trend_chart_stub_returns_F999_shape(self, range_2025):
        result = asyncio.run(_get_sales_trend_chart("F999", range_2025))
        assert result["chartType"] == "LINE"
        assert result["title"] == "销售趋势"
        assert result["xaxisField"] == "date"
        assert result["yaxisField"] == "amount"
        assert result["data"] == []
        assert result["options"] == {"showDataLabels": False, "smooth": True}

    def test_all_stubs_are_async(self):
        """All 5 sub-services must be coroutine functions per foundation §5."""
        assert asyncio.iscoroutinefunction(_get_sales_overview)
        assert asyncio.iscoroutinefunction(_get_salesperson_ranking)
        assert asyncio.iscoroutinefunction(_get_product_ranking)
        assert asyncio.iscoroutinefunction(_get_customer_ranking)
        assert asyncio.iscoroutinefunction(_get_sales_trend_chart)


from smartbi_compat.api.analysis_sales import _get_comprehensive_sales_analysis


class TestComposite:
    def test_returns_7_keys_in_F999_order(self, range_2025):
        result = asyncio.run(_get_comprehensive_sales_analysis("F999", range_2025))
        # Order observed in F999 golden (Jackson HashMap iteration order)
        assert list(result.keys()) == [
            "overview", "customerRanking", "productRanking", "dateRange",
            "salespersonRanking", "generatedAt", "trendChart",
        ]

    def test_F999_empty_state(self, range_2025):
        result = asyncio.run(_get_comprehensive_sales_analysis("F999", range_2025))
        assert result["overview"]["kpiCards"] == []
        assert result["customerRanking"] == []
        assert result["productRanking"] == []
        assert result["salespersonRanking"] == []
        assert result["trendChart"]["data"] == []
        assert result["dateRange"]["startDate"] == "2025-01-01"
        assert result["dateRange"]["endDate"] == "2025-12-31"
        assert result["dateRange"]["days"] == 365
        # generatedAt is ISO string (volatile, stripped before compare)
        assert isinstance(result["generatedAt"], str)

    def test_is_async(self):
        assert asyncio.iscoroutinefunction(_get_comprehensive_sales_analysis)


import asyncio as _asyncio_c1
from smartbi_compat.api.analysis_sales import _build_from_gold_finance_summary


class TestBuildFromGoldFinanceSummary:
    F001_GOLD = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "total_revenue": 20639884.52,
        "bill_count": 140541,
        "avg_bill_value": 146.86,
        "store_count": 8,
        "top_stores": [
            {"store_id": "S1", "store_name": "葱花传奇日月光店", "revenue": 7431228.74, "bill_count": 50000},
            {"store_id": "S2", "store_name": "葱花传奇浦东店", "revenue": 5200000.00, "bill_count": 35000},
        ],
    }

    EMPTY_GOLD = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "total_revenue": 0,
        "bill_count": 0,
        "avg_bill_value": None,
        "store_count": 0,
        "top_stores": [],
    }

    def _patch_seam(self, monkeypatch, gold_response):
        from smartbi_compat.api import analysis_sales as mod
        async def fake(pool, fid, dr, *, top_n_stores=10):
            return gold_response
        monkeypatch.setattr(mod, "_call_finance_summary", fake)

    def test_returns_dashboard_response_dict_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result is not None
        assert set(result.keys()) == {
            "period", "startDate", "endDate", "kpiCards", "metricCards",
            "rankings", "charts", "chartList", "aiInsights", "alerts",
            "recommendations", "suggestions", "generatedAt", "lastUpdated",
            "fromCache", "cacheExpireAt",
        }

    def test_returns_4_kpi_cards_with_correct_keys(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert len(result["kpiCards"]) == 4
        keys = [c["key"] for c in result["kpiCards"]]
        assert keys == ["total_revenue", "bill_count", "avg_bill_value", "store_count"]

    def test_kpi_card_total_revenue_full_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        card = result["kpiCards"][0]
        assert card["key"] == "total_revenue"
        assert card["title"] == "总营收"
        assert card["value"] == "20639884.52"
        assert card["rawValue"] == 20639884.52
        assert card["unit"] == "元"
        assert card["status"] == "green"
        assert card["change"] is None
        assert card["changeRate"] is None
        assert card["trend"] is None
        assert card["compareText"] is None
        assert card["description"] is None
        assert card["targetValue"] is None
        assert card["completionRate"] is None

    def test_kpi_card_bill_count_integer_format(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        card = result["kpiCards"][1]
        assert card["key"] == "bill_count"
        assert card["title"] == "账单数"
        assert card["value"] == "140541"
        assert card["unit"] == "单"

    def test_top_stores_ranking_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert "top_stores" in result["rankings"]
        ts = result["rankings"]["top_stores"]
        assert len(ts) == 2
        assert ts[0]["rank"] == 1
        assert ts[0]["name"] == "葱花传奇日月光店"
        assert ts[0]["value"] == 7431228.74
        assert ts[0]["target"] is None
        assert ts[0]["completionRate"] is None
        assert ts[0]["alertLevel"] is None
        assert ts[1]["rank"] == 2

    def test_ai_insights_and_suggestions_empty(self, monkeypatch, range_2025):
        """Java line 113-114: empty list, NOT None."""
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result["aiInsights"] == []
        assert result["suggestions"] == []

    def test_charts_empty_dict_initially(self, monkeypatch, range_2025):
        """Charts populated by _build_from_gold_with_charts wrapper, not here."""
        self._patch_seam(monkeypatch, self.F001_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result["charts"] == {}

    def test_empty_short_circuit_returns_none(self, monkeypatch, range_2025):
        """revenue=0 AND bill_count=0 -> return None (legacy fallback)."""
        self._patch_seam(monkeypatch, self.EMPTY_GOLD)
        result = _asyncio_c1.run(_build_from_gold_finance_summary("F001", range_2025, pool=None))
        assert result is None

    def test_is_async(self):
        assert _asyncio_c1.iscoroutinefunction(_build_from_gold_finance_summary)


from smartbi_compat.api.analysis_sales import _fetch_gold_trend_chart


class TestFetchGoldTrendChart:
    F001_TREND = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "points": [
            {"date": "2025-01-01", "revenue": 91972.04, "bill_count": 600, "avg_bill_value": 153.29},
            {"date": "2025-01-02", "revenue": 43165.0,  "bill_count": 280, "avg_bill_value": 154.16},
        ],
    }

    EMPTY_TREND = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "points": [],
    }

    def _patch_seam(self, monkeypatch, response):
        from smartbi_compat.api import analysis_sales as mod
        async def fake(pool, fid, dr):
            return response
        monkeypatch.setattr(mod, "_call_daily_trend", fake)

    def test_returns_chart_config_shape(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_TREND)
        result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert result is not None
        assert result["chartType"] == "LINE"
        assert result["title"] == "销售趋势"
        assert result["xaxisField"] == "date"
        assert result["yaxisField"] == "amount"
        assert result["seriesField"] is None
        assert result["options"] is None

    def test_data_maps_revenue_to_amount(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_TREND)
        result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert len(result["data"]) == 2
        assert result["data"][0] == {"date": "2025-01-01", "amount": 91972.04}
        assert result["data"][1] == {"date": "2025-01-02", "amount": 43165}

    def test_empty_points_returns_none(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.EMPTY_TREND)
        result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert result is None

    def test_query_failure_returns_none_logs_warning(self, monkeypatch, range_2025, caplog):
        from smartbi_compat.api import analysis_sales as mod
        async def fail(pool, fid, dr):
            raise RuntimeError("simulated daily_trend failure")
        monkeypatch.setattr(mod, "_call_daily_trend", fail)
        with caplog.at_level("WARNING"):
            result = asyncio.run(_fetch_gold_trend_chart("F001", range_2025, pool=None))
        assert result is None
        assert any("trend fetch failed" in r.message for r in caplog.records)

    def test_is_async(self):
        assert asyncio.iscoroutinefunction(_fetch_gold_trend_chart)


from smartbi_compat.api.analysis_sales import _fetch_gold_category_chart


class TestFetchGoldCategoryChart:
    F001_PRODUCTS = {
        "factory_id": "F001",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "top_products": [
            {"product_id": "P1", "name": "猪肉葱花调味(无人份)", "qty": 1000, "revenue": 1354832.6, "bill_count": 5000},
            {"product_id": "P2", "name": "猪肉葱花调味单价大型套餐", "qty": 800, "revenue": 989416.8, "bill_count": 3500},
        ],
    }

    EMPTY_PRODUCTS = {
        "factory_id": "F001", "start_date": "2025-01-01", "end_date": "2025-12-31",
        "top_products": [],
    }

    def _patch_seam(self, monkeypatch, response):
        from smartbi_compat.api import analysis_sales as mod
        async def fake(pool, fid, dr, *, top_n=8):
            return response
        monkeypatch.setattr(mod, "_call_top_products", fake)

    def test_returns_pie_chart_config(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_PRODUCTS)
        result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert result is not None
        assert result["chartType"] == "PIE"
        assert result["title"] == "产品类别占比"
        assert result["xaxisField"] == "category"
        assert result["yaxisField"] == "amount"
        assert result["seriesField"] is None
        assert result["options"] is None

    def test_data_maps_name_to_category_revenue_to_amount(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.F001_PRODUCTS)
        result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert len(result["data"]) == 2
        assert result["data"][0] == {"category": "猪肉葱花调味(无人份)", "amount": 1354832.6}
        assert result["data"][1] == {"category": "猪肉葱花调味单价大型套餐", "amount": 989416.8}

    def test_empty_returns_none(self, monkeypatch, range_2025):
        self._patch_seam(monkeypatch, self.EMPTY_PRODUCTS)
        result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert result is None

    def test_query_failure_returns_none_logs_warning(self, monkeypatch, range_2025, caplog):
        from smartbi_compat.api import analysis_sales as mod
        async def fail(pool, fid, dr, *, top_n=8):
            raise RuntimeError("simulated top_products failure")
        monkeypatch.setattr(mod, "_call_top_products", fail)
        with caplog.at_level("WARNING"):
            result = asyncio.run(_fetch_gold_category_chart("F001", range_2025, pool=None))
        assert result is None
        assert any("category fetch failed" in r.message for r in caplog.records)


from smartbi_compat.api.analysis_sales import _build_from_gold_with_charts


class TestBuildFromGoldWithCharts:
    def _patch_all_seams(self, monkeypatch, finance, trend, products):
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return finance
        async def fake_trend(pool, fid, dr):
            return trend
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return products
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fake_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)

    def test_returns_dashboard_with_both_charts(self, monkeypatch, range_2025):
        self._patch_all_seams(
            monkeypatch,
            finance=TestBuildFromGoldFinanceSummary.F001_GOLD,
            trend=TestFetchGoldTrendChart.F001_TREND,
            products=TestFetchGoldCategoryChart.F001_PRODUCTS,
        )
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is not None
        assert "sales_trend" in result["charts"]
        assert "category_distribution" in result["charts"]
        assert result["charts"]["sales_trend"]["chartType"] == "LINE"
        assert result["charts"]["category_distribution"]["chartType"] == "PIE"

    def test_returns_none_when_finance_summary_empty(self, monkeypatch, range_2025):
        self._patch_all_seams(
            monkeypatch,
            finance=TestBuildFromGoldFinanceSummary.EMPTY_GOLD,
            trend=TestFetchGoldTrendChart.F001_TREND,
            products=TestFetchGoldCategoryChart.F001_PRODUCTS,
        )
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is None

    def test_tolerates_trend_chart_failure(self, monkeypatch, range_2025):
        """Java lines 186-190: chart fetch failure logged but does not break the wrapper."""
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return TestBuildFromGoldFinanceSummary.F001_GOLD
        async def failing_trend(pool, fid, dr):
            raise RuntimeError("simulated trend failure")
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return TestFetchGoldCategoryChart.F001_PRODUCTS
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", failing_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is not None
        assert "sales_trend" not in result["charts"]
        assert "category_distribution" in result["charts"]
        assert len(result["kpiCards"]) == 4

    def test_charts_dict_empty_when_both_charts_fail(self, monkeypatch, range_2025):
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return TestBuildFromGoldFinanceSummary.F001_GOLD
        async def fail_t(pool, fid, dr):
            raise RuntimeError("t fail")
        async def fail_p(pool, fid, dr, *, top_n=8):
            raise RuntimeError("p fail")
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fail_t)
        monkeypatch.setattr(mod, "_call_top_products", fail_p)
        result = asyncio.run(_build_from_gold_with_charts("F001", range_2025, pool=None))
        assert result is not None
        assert result["charts"] == {}

    def test_is_async(self):
        assert asyncio.iscoroutinefunction(_build_from_gold_with_charts)


from smartbi_compat.api.analysis_sales import _to_decimal


class TestToDecimal:
    def test_int_input(self):
        assert _to_decimal(42) == Decimal("42")

    def test_float_input(self):
        # float 12.5 -> str round-trip -> Decimal("12.5")
        assert _to_decimal(12.5) == Decimal("12.5")

    def test_decimal_input_passthrough(self):
        d = Decimal("100.00")
        assert _to_decimal(d) is d

    def test_string_input(self):
        assert _to_decimal("99.99") == Decimal("99.99")

    def test_none_returns_zero(self):
        """Mirror Java toBigDecimal returning ZERO on null."""
        assert _to_decimal(None) == Decimal("0")

    def test_invalid_input_returns_zero(self):
        """Mirror Java catching parse errors and returning ZERO."""
        assert _to_decimal("not_a_number") == Decimal("0")
        assert _to_decimal(object()) == Decimal("0")


from smartbi_compat.api.analysis_sales import _format_kpi_value


class TestFormatKpiValue:
    def test_yuan_unit_2_decimals(self):
        """Yuan unit -> 2-decimal string (matches Java setScale(2, HALF_UP).toPlainString)."""
        assert _format_kpi_value(Decimal("20639884.52"), "元") == "20639884.52"

    def test_yuan_preserves_trailing_zero(self):
        """G3 risk: 100.50 must stay '100.50', NOT normalize to '100.5'."""
        assert _format_kpi_value(Decimal("100.50"), "元") == "100.50"

    def test_yuan_round_half_up(self):
        """Java HALF_UP: 1.005 rounds to 1.01."""
        assert _format_kpi_value(Decimal("1.005"), "元") == "1.01"

    def test_yuan_one_decimal_inputs_pad_to_two(self):
        assert _format_kpi_value(Decimal("12.5"), "元") == "12.50"

    def test_integer_unit_no_decimals(self):
        """Integer-style unit -> integer string."""
        assert _format_kpi_value(Decimal("140541"), "单") == "140541"
        assert _format_kpi_value(Decimal("8"), "家") == "8"

    def test_integer_unit_rounds_decimals(self):
        """Decimal input with fraction + integer unit -> round to int."""
        assert _format_kpi_value(Decimal("8.6"), "家") == "9"

    def test_zero_value_yuan(self):
        assert _format_kpi_value(Decimal("0"), "元") == "0.00"

    def test_zero_value_integer_unit(self):
        assert _format_kpi_value(Decimal("0"), "单") == "0"
