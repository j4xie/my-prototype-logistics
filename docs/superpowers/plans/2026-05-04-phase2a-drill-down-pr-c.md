# Phase 2A `/drill-down` PR-C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

**Goal:** Add ~40 arithmetic depth tests across 8 test classes appended to `tests/python/smartbi_compat/test_analysis_drilldown_contract.py`. Cover inner formulas, edge cases, branching paths that PR-A contract tests don't fully exercise. **HARD RULE: 0 bytes change to `analysis_drilldown.py`** — tests-only.

**Spec:** `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` §5.2 (PR-B/PR-C arithmetic depth section)

**Sister precedents:**
- `tests/python/smartbi_compat/test_analysis_procurement_contract.py` PR-C-1+PR-C-2 (33 arithmetic tests across 7 classes, lines 386-1048)
- `tests/python/smartbi_compat/test_analysis_inventory_contract.py` PR-C (16 arithmetic classes)
- Mock pattern: `original = module._helper; module._helper = fake; try: ... finally: module._helper = original` (try/finally restoration)

**Tech Stack:** Python 3.8 / pytest / unittest.mock

**Test surface (drill-down impl helpers):**

| Helper | Test class |
|---|---|
| `_compute_drill_path` (T4) | TestDrillDownDispatchArithmetic |
| `_default_date_range_this_month` (T5) | TestDrillDownDispatchArithmetic |
| `_build_drilldown_ranking` + `_determine_target_completion_alert` | TestDrillDownProvinceCityRankingArithmetic |
| `_build_department_detail_response` + `_build_kpi_card` | TestDrillDownDeptDetailArithmetic |
| `_build_product_distribution_chart` | TestDrillDownProductChartArithmetic |
| `_build_salesperson_metrics` | TestDrillDownSalespersonMetricsArithmetic |
| `_drilldown_record_usage` | TestDrillDownRecordUsageWriteArithmetic |
| Error path | TestDrillDownErrorEnvelope |
| Time MONTH regression (final-review C1) | TestDrillDownTimeMonthRegression |
| 5 `_process_*_drilldown` branching | TestDrillDownDispatchArithmetic |

**File structure:**

```
EDIT tests/python/smartbi_compat/test_analysis_drilldown_contract.py  (~600 lines appended)
NO CHANGES to backend/python/smartbi_compat/api/analysis_drilldown.py  (HARD RULE)
```

---

## Task 1: TestDrillDownDispatchArithmetic + TestDrillDownProvinceCityRankingArithmetic

**Files:** Modify `tests/python/smartbi_compat/test_analysis_drilldown_contract.py` (append).

- [ ] **Step 1: Append two test classes**

```python
class TestDrillDownDispatchArithmetic:
    """T3 case-insensitive + T4 drill_path + T5 default range + 5 dim branching."""

    # ---- T4: _compute_drill_path edge cases ----
    def test_drill_path_both_none(self):
        from smartbi_compat.api.analysis_drilldown import _compute_drill_path
        assert _compute_drill_path(None, None) == "全部"

    def test_drill_path_parent_only(self):
        from smartbi_compat.api.analysis_drilldown import _compute_drill_path
        assert _compute_drill_path("全国", None) == "全国"

    def test_drill_path_filter_only(self):
        from smartbi_compat.api.analysis_drilldown import _compute_drill_path
        assert _compute_drill_path(None, "华东") == "华东"

    def test_drill_path_both_concatenates(self):
        from smartbi_compat.api.analysis_drilldown import _compute_drill_path
        assert _compute_drill_path("全国", "华东") == "全国 > 华东"

    def test_drill_path_empty_string_treated_as_none(self):
        from smartbi_compat.api.analysis_drilldown import _compute_drill_path
        assert _compute_drill_path("", "华东") == "华东"
        assert _compute_drill_path("全国", "") == "全国"

    def test_drill_path_multi_level_nested(self):
        from smartbi_compat.api.analysis_drilldown import _compute_drill_path
        assert _compute_drill_path("全国 > 华东", "上海") == "全国 > 华东 > 上海"

    # ---- T5: _default_date_range_this_month ----
    def test_default_date_range_returns_first_and_last_of_month(self):
        from smartbi_compat.api.analysis_drilldown import _default_date_range_this_month
        from datetime import date
        import calendar
        s, e = _default_date_range_this_month()
        today = date.today()
        assert s == today.replace(day=1)
        assert e == today.replace(day=calendar.monthrange(today.year, today.month)[1])
        # T5 lock: end is LAST day of month, NOT today (unless today is last day)
        assert s.day == 1
        assert e.day == calendar.monthrange(s.year, s.month)[1]

    # ---- T2 dead level>1 parity for time dim ----
    def test_time_period_mapping_level_none_returns_day(self):
        """Java init: period='DAY' before switch; if level=None, switch skipped."""
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_trend(fid, range_, period):
            return {"period": period}

        original = adr._get_sales_trend_chart
        adr._get_sales_trend_chart = fake_trend
        try:
            req = DrillDownRequestModel(dimension="time", level=None,
                                          startDate=date(2025, 1, 1), endDate=date(2025, 1, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
            data, period = asyncio.run(adr._process_time_drilldown("F", req, range_))
            assert period == "DAY"
        finally:
            adr._get_sales_trend_chart = original

    def test_time_period_mapping_level_1_returns_month(self):
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_trend(fid, range_, period):
            return {"period": period}

        original = adr._get_sales_trend_chart
        adr._get_sales_trend_chart = fake_trend
        try:
            req = DrillDownRequestModel(dimension="time", level=1,
                                          startDate=date(2025, 1, 1), endDate=date(2025, 1, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
            data, period = asyncio.run(adr._process_time_drilldown("F", req, range_))
            assert period == "MONTH"
        finally:
            adr._get_sales_trend_chart = original

    def test_time_period_mapping_level_2_returns_week(self):
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_trend(fid, range_, period):
            return {"period": period}

        original = adr._get_sales_trend_chart
        adr._get_sales_trend_chart = fake_trend
        try:
            req = DrillDownRequestModel(dimension="time", level=2,
                                          startDate=date(2025, 1, 1), endDate=date(2025, 1, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
            data, period = asyncio.run(adr._process_time_drilldown("F", req, range_))
            assert period == "WEEK"
        finally:
            adr._get_sales_trend_chart = original

    def test_time_period_mapping_level_3_returns_day_default(self):
        """Java line 2056 default branch: any level >= 3 → DAY."""
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_trend(fid, range_, period):
            return {"period": period}

        original = adr._get_sales_trend_chart
        adr._get_sales_trend_chart = fake_trend
        try:
            req = DrillDownRequestModel(dimension="time", level=99,
                                          startDate=date(2025, 1, 1), endDate=date(2025, 1, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
            data, period = asyncio.run(adr._process_time_drilldown("F", req, range_))
            assert period == "DAY"
        finally:
            adr._get_sales_trend_chart = original

    # ---- Region branching (T1+T2) ----
    def test_region_no_filter_uses_composite_ranking(self):
        """L1 path: filter_value None/empty → _get_region_analysis()['ranking']."""
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_region(fid, range_):
            return {"ranking": [{"name": "华东", "value": 1000}]}

        original = adr._get_region_analysis
        adr._get_region_analysis = fake_region
        try:
            req = DrillDownRequestModel(dimension="region",
                                          startDate=date(2025, 1, 1), endDate=date(2025, 12, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
            data, next_level = asyncio.run(adr._process_region_drilldown("F", req, range_))
            assert next_level == "province"
            assert data == [{"name": "华东", "value": 1000}]
        finally:
            adr._get_region_analysis = original

    def test_region_filter_with_level_1_uses_province_ranking(self):
        """L2 path: filter_value set + level<=1 → H1 _drilldown_get_province_ranking."""
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_province(fid, region, range_):
            return [{"rank": 1, "name": "上海", "value": 600}]

        original = adr._drilldown_get_province_ranking
        adr._drilldown_get_province_ranking = fake_province
        try:
            req = DrillDownRequestModel(dimension="region", value="华东", level=1,
                                          startDate=date(2025, 1, 1), endDate=date(2025, 12, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
            data, next_level = asyncio.run(adr._process_region_drilldown("F", req, range_))
            assert next_level == "city"
            assert data[0]["name"] == "上海"
        finally:
            adr._drilldown_get_province_ranking = original

    def test_region_filter_with_level_2_uses_city_ranking_dead_branch(self):
        """L3 dead path (D6): filter_value set + level>1 → H2 _drilldown_get_city_ranking.
        Unreachable from HTTP traffic per controller-DTO field-set asymmetry, but ported."""
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_city(fid, province, range_):
            return [{"rank": 1, "name": "浦东", "value": 400}]

        original = adr._drilldown_get_city_ranking
        adr._drilldown_get_city_ranking = fake_city
        try:
            req = DrillDownRequestModel(dimension="region", value="上海", level=2,
                                          startDate=date(2025, 1, 1), endDate=date(2025, 12, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
            data, next_level = asyncio.run(adr._process_region_drilldown("F", req, range_))
            assert next_level is None
            assert data[0]["name"] == "浦东"
        finally:
            adr._drilldown_get_city_ranking = original

    # ---- Salesperson branching (no level check) ----
    def test_salesperson_no_filter_uses_ranking(self):
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_ranking(fid, range_):
            return [{"name": "张三", "value": 1500}]

        original = adr._get_salesperson_ranking
        adr._get_salesperson_ranking = fake_ranking
        try:
            req = DrillDownRequestModel(dimension="salesperson",
                                          startDate=date(2025, 1, 1), endDate=date(2025, 12, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
            data = asyncio.run(adr._process_salesperson_drilldown("F", req, range_))
            assert data == [{"name": "张三", "value": 1500}]
        finally:
            adr._get_salesperson_ranking = original

    def test_salesperson_filter_uses_metrics(self):
        import asyncio
        from smartbi_compat.api import analysis_drilldown as adr
        from smartbi_compat.api.analysis_drilldown import DrillDownRequestModel
        from smartbi_compat.date_range import DateRange
        from datetime import date

        async def fake_metrics(fid, sp, range_):
            return [{"metricCode": "X", "value": 100}]

        original = adr._drilldown_get_salesperson_metrics
        adr._drilldown_get_salesperson_metrics = fake_metrics
        try:
            req = DrillDownRequestModel(dimension="salesperson", value="张三",
                                          startDate=date(2025, 1, 1), endDate=date(2025, 12, 31))
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
            data = asyncio.run(adr._process_salesperson_drilldown("F", req, range_))
            assert data == [{"metricCode": "X", "value": 100}]
        finally:
            adr._drilldown_get_salesperson_metrics = original


class TestDrillDownProvinceCityRankingArithmetic:
    """H1+H2 _build_drilldown_ranking + _determine_target_completion_alert arithmetic."""

    def test_empty_rows_returns_empty_list(self):
        from smartbi_compat.api.analysis_drilldown import _build_drilldown_ranking
        assert _build_drilldown_ranking([]) == []

    def test_sort_order_preserved_from_input(self):
        """Builder preserves input row order; SQL `ORDER BY total_amount DESC` already sorted."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_drilldown_ranking
        rows = [
            ("上海", Decimal("80000"), Decimal("100000")),
            ("北京", Decimal("50000"), Decimal("100000")),
            ("广州", Decimal("30000"), Decimal("100000")),
        ]
        result = _build_drilldown_ranking(rows)
        assert [r["rank"] for r in result] == [1, 2, 3]
        assert [r["name"] for r in result] == ["上海", "北京", "广州"]

    def test_ranking_item_6_field_shape(self):
        """RankingItem Lombok @Data declaration order:
        [rank, name, value, target, completionRate, alertLevel]."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_drilldown_ranking
        rows = [("上海", Decimal("80000"), Decimal("100000"))]
        result = _build_drilldown_ranking(rows)
        assert list(result[0].keys()) == [
            "rank", "name", "value", "target", "completionRate", "alertLevel"
        ]

    def test_completion_rate_formula(self):
        """value/target * 100 quantized to 0.01."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_drilldown_ranking
        rows = [("上海", Decimal("80000"), Decimal("100000"))]
        result = _build_drilldown_ranking(rows)
        # 80000/100000*100 = 80.00
        assert result[0]["completionRate"] == 80
        assert result[0]["value"] == 80000
        assert result[0]["target"] == 100000

    def test_zero_target_yields_zero_completion(self):
        """target=0 → completionRate=0 (avoid divide-by-zero)."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_drilldown_ranking
        rows = [("上海", Decimal("80000"), Decimal("0"))]
        result = _build_drilldown_ranking(rows)
        assert result[0]["completionRate"] == 0
        assert result[0]["alertLevel"] == "RED"  # 0 < 60

    def test_null_target_treated_as_zero(self):
        """Rule 1: explicit None handling, 0 fallback."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_drilldown_ranking
        rows = [("上海", Decimal("80000"), None)]
        result = _build_drilldown_ranking(rows)
        assert result[0]["completionRate"] == 0
        assert result[0]["target"] == 0

    def test_alert_level_thresholds(self):
        """60/85 thresholds (sister-pattern target completion alert)."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _determine_target_completion_alert
        # Boundary: <60 → RED, [60, 85) → YELLOW, >=85 → GREEN
        assert _determine_target_completion_alert(Decimal("0")) == "RED"
        assert _determine_target_completion_alert(Decimal("59.99")) == "RED"
        assert _determine_target_completion_alert(Decimal("60")) == "YELLOW"
        assert _determine_target_completion_alert(Decimal("84.99")) == "YELLOW"
        assert _determine_target_completion_alert(Decimal("85")) == "GREEN"
        assert _determine_target_completion_alert(Decimal("100")) == "GREEN"
        assert _determine_target_completion_alert(Decimal("200")) == "GREEN"  # over-achievement
```

- [ ] **Step 2: Run only the new classes**

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownDispatchArithmetic tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownProvinceCityRankingArithmetic -v --tb=short -W ignore 2>&1 | tail -25
```

Expected: ~21 tests PASS.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: drilldown PR-C dispatch + province/city ranking arithmetic" -- tests/python/smartbi_compat/test_analysis_drilldown_contract.py
```

---

## Task 2: TestDrillDownDeptDetailArithmetic + TestDrillDownProductChartArithmetic

**Files:** Modify `tests/python/smartbi_compat/test_analysis_drilldown_contract.py` (append after Task 1).

- [ ] **Step 1: Append test classes**

```python
class TestDrillDownDeptDetailArithmetic:
    """H3 _build_department_detail_response (16-field DashboardResponse) +
    _build_kpi_card (13-field) arithmetic."""

    def test_empty_row_returns_16_field_shape(self):
        """row=None (no SQL hits) → all aggregates 0, 4 KPI cards with red TARGET_COMPLETION."""
        from smartbi_compat.api.analysis_drilldown import _build_department_detail_response
        result = _build_department_detail_response(None)
        expected_keys = [
            "period", "startDate", "endDate", "kpiCards", "metricCards",
            "rankings", "charts", "chartList", "aiInsights", "alerts",
            "recommendations", "suggestions", "generatedAt", "lastUpdated",
            "fromCache", "cacheExpireAt",
        ]
        assert list(result.keys()) == expected_keys, f"got {list(result.keys())}"
        assert len(result["kpiCards"]) == 4
        assert result["rankings"] == {"salesperson": []}
        assert result["charts"] == {}
        assert result["fromCache"] is False
        assert result["lastUpdated"] is not None  # volatile but emit

    def test_4_kpi_cards_in_fixed_order(self):
        """KpiCard list order: SALES_AMOUNT / TARGET_COMPLETION / SALES_PER_CAPITA / COST_PER_CAPITA."""
        from smartbi_compat.api.analysis_drilldown import _build_department_detail_response
        result = _build_department_detail_response(None)
        codes = [c["key"] for c in result["kpiCards"]]
        assert codes == [
            "SALES_AMOUNT", "TARGET_COMPLETION", "SALES_PER_CAPITA", "COST_PER_CAPITA"
        ]

    def test_kpi_card_13_field_shape(self):
        """KpiCard Lombok @Data declaration order:
        [key, title, value, rawValue, unit, change, changeRate, trend, status,
         compareText, description, targetValue, completionRate]."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_kpi_card
        card = _build_kpi_card("X", "X", Decimal("100"), "元", "green")
        assert list(card.keys()) == [
            "key", "title", "value", "rawValue", "unit", "change", "changeRate",
            "trend", "status", "compareText", "description", "targetValue", "completionRate"
        ]
        assert card["value"] == "100.00"  # f"{float(quantized):.2f}"
        assert card["rawValue"] == 100.0
        assert card["trend"] == "flat"
        assert card["status"] == "green"
        assert card["change"] is None
        assert card["targetValue"] is None

    def test_target_completion_red_status_when_zero(self):
        """Empty data: completionRate=0 → status=red (Rule 9 §9.2 status mapping)."""
        from smartbi_compat.api.analysis_drilldown import _build_department_detail_response
        result = _build_department_detail_response(None)
        # KPI[1] is TARGET_COMPLETION
        assert result["kpiCards"][1]["key"] == "TARGET_COMPLETION"
        assert result["kpiCards"][1]["status"] == "red"
        # Other 3 cards always green
        assert result["kpiCards"][0]["status"] == "green"  # SALES_AMOUNT
        assert result["kpiCards"][2]["status"] == "green"  # SALES_PER_CAPITA
        assert result["kpiCards"][3]["status"] == "green"  # COST_PER_CAPITA

    def test_target_completion_yellow_status_when_60_to_85(self):
        """completionRate in [60, 85) → status=yellow."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_department_detail_response
        # row = (total_amount, total_target, member_count, total_cost)
        row = (Decimal("70000"), Decimal("100000"), 10, Decimal("50000"))
        result = _build_department_detail_response(row)
        # 70000/100000*100 = 70 → yellow
        assert result["kpiCards"][1]["status"] == "yellow"

    def test_target_completion_green_status_when_85_or_above(self):
        """completionRate >= 85 → status=green."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_department_detail_response
        row = (Decimal("90000"), Decimal("100000"), 10, Decimal("50000"))
        result = _build_department_detail_response(row)
        # 90000/100000*100 = 90 → green
        assert result["kpiCards"][1]["status"] == "green"

    def test_per_capita_with_member_count_zero_uses_zero(self):
        """member_count=0 → sales/cost_per_capita = 0 (avoid divide-by-zero)."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_department_detail_response
        row = (Decimal("80000"), Decimal("100000"), 0, Decimal("50000"))
        result = _build_department_detail_response(row)
        assert result["kpiCards"][2]["rawValue"] == 0.0   # SALES_PER_CAPITA
        assert result["kpiCards"][3]["rawValue"] == 0.0   # COST_PER_CAPITA


class TestDrillDownProductChartArithmetic:
    """H4 _build_product_distribution_chart (ChartConfig 7-field) arithmetic."""

    def test_empty_rows_returns_7_field_shape(self):
        """Empty input: full 7-field ChartConfig + lowercase xaxisField."""
        from smartbi_compat.api.analysis_drilldown import _build_product_distribution_chart
        chart = _build_product_distribution_chart([])
        assert list(chart.keys()) == [
            "chartType", "title", "seriesField", "data", "options",
            "xaxisField", "yaxisField",
        ]
        assert chart["chartType"] == "PIE"
        assert chart["title"] == "产品销售占比"
        assert chart["seriesField"] is None
        assert chart["data"] == []
        assert list(chart["options"].keys()) == ["showPercentage", "showLegend"]
        # Rule 9.1: lowercase 'a'
        assert chart["xaxisField"] == "category"
        assert chart["yaxisField"] == "amount"

    def test_data_points_have_category_amount_keys(self):
        """Each data point dict: {category, amount}."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_product_distribution_chart
        rows = [
            ("饮料", Decimal("2000")),
            ("调味品", Decimal("1500")),
        ]
        chart = _build_product_distribution_chart(rows)
        assert len(chart["data"]) == 2
        assert chart["data"][0] == {"category": "饮料", "amount": 2000}
        assert chart["data"][1] == {"category": "调味品", "amount": 1500}

    def test_data_preserves_input_order(self):
        """Builder preserves input row order; SQL ORDER BY total DESC already sorted."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_product_distribution_chart
        rows = [
            ("A", Decimal("100")),
            ("B", Decimal("50")),
            ("C", Decimal("25")),
        ]
        chart = _build_product_distribution_chart(rows)
        names = [d["category"] for d in chart["data"]]
        assert names == ["A", "B", "C"]

    def test_null_amount_treated_as_zero(self):
        """Rule 1: row[1] is None → 0 (not skipped)."""
        from smartbi_compat.api.analysis_drilldown import _build_product_distribution_chart
        rows = [
            ("A", None),
            ("B", 50),
        ]
        chart = _build_product_distribution_chart(rows)
        assert chart["data"][0]["amount"] == 0
        assert chart["data"][1]["amount"] == 50
```

- [ ] **Step 2: Run new classes**

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownDeptDetailArithmetic tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownProductChartArithmetic -v --tb=short -W ignore 2>&1 | tail -20
```

Expected: ~11 tests PASS.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: drilldown PR-C dept detail + product chart arithmetic" -- tests/python/smartbi_compat/test_analysis_drilldown_contract.py
```

---

## Task 3: TestDrillDownSalespersonMetricsArithmetic + TestDrillDownRecordUsageWriteArithmetic

**Files:** Modify `tests/python/smartbi_compat/test_analysis_drilldown_contract.py` (append).

- [ ] **Step 1: Append test classes**

```python
class TestDrillDownSalespersonMetricsArithmetic:
    """H5 _build_salesperson_metrics (List[MetricResult] 11-field) arithmetic."""

    def test_empty_row_returns_4_metrics_with_zeros(self):
        from smartbi_compat.api.analysis_drilldown import _build_salesperson_metrics
        metrics = _build_salesperson_metrics("张三", None)
        assert len(metrics) == 4
        for m in metrics:
            assert m["value"] == 0
            assert m["dimensionValue"] == "张三"
            assert m["alertLevel"] == "GREEN"

    def test_4_metric_codes_in_fixed_order(self):
        from smartbi_compat.api.analysis_drilldown import _build_salesperson_metrics
        metrics = _build_salesperson_metrics("张三", None)
        codes = [m["metricCode"] for m in metrics]
        assert codes == [
            "SALESPERSON_TOTAL_SALES",
            "SALESPERSON_TOTAL_QUANTITY",
            "SALESPERSON_TOTAL_PROFIT",
            "SALESPERSON_ORDER_COUNT",
        ]

    def test_metric_result_11_field_shape(self):
        """MetricResult Lombok @Data declaration order:
        [metricCode, metricName, value, formattedValue, unit, changePercent,
         changeDirection, changeValue, alertLevel, dimensionValue, description]."""
        from smartbi_compat.api.analysis_drilldown import _build_salesperson_metrics
        metrics = _build_salesperson_metrics("张三", None)
        for m in metrics:
            assert list(m.keys()) == [
                "metricCode", "metricName", "value", "formattedValue", "unit",
                "changePercent", "changeDirection", "changeValue",
                "alertLevel", "dimensionValue", "description",
            ]

    def test_populated_row_aggregates_correctly(self):
        """Row = (total_sales, total_quantity, total_profit, order_count)."""
        from decimal import Decimal
        from smartbi_compat.api.analysis_drilldown import _build_salesperson_metrics
        row = (Decimal("100000"), Decimal("50"), Decimal("30000"), 25)
        metrics = _build_salesperson_metrics("张三", row)
        by_code = {m["metricCode"]: m for m in metrics}
        assert by_code["SALESPERSON_TOTAL_SALES"]["value"] == 100000
        assert by_code["SALESPERSON_TOTAL_QUANTITY"]["value"] == 50
        assert by_code["SALESPERSON_TOTAL_PROFIT"]["value"] == 30000
        assert by_code["SALESPERSON_ORDER_COUNT"]["value"] == 25
        # Units
        assert by_code["SALESPERSON_TOTAL_SALES"]["unit"] == "元"
        assert by_code["SALESPERSON_TOTAL_QUANTITY"]["unit"] == "件"
        assert by_code["SALESPERSON_TOTAL_PROFIT"]["unit"] == "元"
        assert by_code["SALESPERSON_ORDER_COUNT"]["unit"] == "单"


class TestDrillDownRecordUsageWriteArithmetic:
    """T7 _drilldown_record_usage SQL bind shape (sync helper, mock conn)."""

    @staticmethod
    def _capture_call(**kwargs):
        from smartbi_compat.api.analysis_drilldown import _drilldown_record_usage
        captured = {"sql": None, "params": None}

        class MockConn:
            def execute(self, sql, params):
                captured["sql"] = sql
                captured["params"] = params

        _drilldown_record_usage(MockConn(), **kwargs)
        return captured

    def test_default_args_match_java_line_1066(self):
        """Java call: recordUsage(factoryId, null, "DRILLDOWN", 0, false).
        Python defaults: user_id=None, action_type="DRILLDOWN", query_text=None,
        token_count=0, cost_amount=Decimal("0"), cache_hit=False, success=True."""
        from decimal import Decimal
        c = self._capture_call(factory_id="F999")
        p = c["params"]
        assert p["factory_id"] == "F999"
        assert p["user_id"] is None  # D7
        assert p["action_type"] == "DRILLDOWN"
        assert p["query_text"] is None
        assert p["token_count"] == 0
        assert p["cost_amount"] == Decimal("0")  # D8 hardcoded divergence
        assert p["cache_hit"] is False
        assert p["response_time_ms"] is None
        assert p["success"] is True

    def test_custom_user_id_passes_through(self):
        c = self._capture_call(factory_id="F", user_id=42)
        assert c["params"]["user_id"] == 42

    def test_custom_query_text_passes_through(self):
        c = self._capture_call(factory_id="F", query_text="SELECT *")
        assert c["params"]["query_text"] == "SELECT *"

    def test_sql_inserts_into_correct_table(self):
        """T11/T12: explicit factory_id is THE tenant isolation (no PG RLS).
        SQL must be INSERT to smart_bi_usage_records (PLURAL, not singular)."""
        c = self._capture_call(factory_id="F")
        sql_str = str(c["sql"]).upper()
        assert "INSERT INTO" in sql_str
        assert "SMART_BI_USAGE_RECORDS" in sql_str  # plural
        assert "FACTORY_ID" in sql_str  # in the column list
```

- [ ] **Step 2: Run new classes**

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownSalespersonMetricsArithmetic tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownRecordUsageWriteArithmetic -v --tb=short -W ignore 2>&1 | tail -15
```

Expected: ~8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: drilldown PR-C salesperson metrics + record_usage SQL arithmetic" -- tests/python/smartbi_compat/test_analysis_drilldown_contract.py
```

---

## Task 4: TestDrillDownErrorEnvelope + TestDrillDownTimeMonthRegression

**Files:** Modify `tests/python/smartbi_compat/test_analysis_drilldown_contract.py` (append).

- [ ] **Step 1: Append test classes**

```python
class TestDrillDownErrorEnvelope:
    """T10 BusinessException → 5-field ApiResponse error envelope (after _strip_envelope_extras).
    Java emits 8-field; sister-pattern strips 3 optional UX fields defensively."""

    def test_unknown_dim_message_contains_dimension(self, client, patched_helpers):
        """Message format: '不支持的下钻维度: <dim>' wrapped in 'Drill-down failed: <msg>'."""
        resp = _post(client, {
            "dimension": "frobnicate",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        body = resp.json()
        assert "frobnicate" in body["message"]
        assert "不支持" in body["message"]

    def test_unknown_dim_code_is_400(self, client, patched_helpers):
        resp = _post(client, {
            "dimension": "frobnicate",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        body = resp.json()
        assert body["code"] == 400
        assert body["success"] is False
        assert body["data"] is None

    def test_envelope_5_field_after_strip(self, client, patched_helpers):
        """After _strip_envelope_extras: code/message/data/success (timestamp stripped too)."""
        resp = _post(client, {
            "dimension": "frobnicate",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        stripped = _strip_envelope_extras(_strip_volatile(resp.json()))
        assert set(stripped.keys()) == {"code", "message", "data", "success"}


class TestDrillDownTimeMonthRegression:
    """C1 regression: time dim production path (level=1 → period=MONTH) must NOT
    raise NotImplementedError → HTTP 500. Sister _get_sales_trend_chart is DAY-only.

    Final-review caught this before merge in PR #72; this class extends coverage
    for WEEK + DAY paths and verifies the 501 envelope detail."""

    @staticmethod
    def _patched_unsupported(monkeypatch):
        from smartbi_compat.api import analysis_drilldown as adr

        async def _unsupported(factory_id, range_, period):
            raise NotImplementedError(
                f"trend chart period='{period}' not supported"
            )

        async def _noop_record(**kw):
            pass

        monkeypatch.setattr(adr, "_get_sales_trend_chart", _unsupported)
        monkeypatch.setattr(adr, "_drilldown_record_usage_async", _noop_record)

    def test_time_month_returns_501_not_500(self, client, monkeypatch):
        """level=1 → period=MONTH → BusinessException(501) → HTTP 200 + success=false."""
        self._patched_unsupported(monkeypatch)
        resp = _post(client, {
            "dimension": "time", "level": 1,
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200, f"got {resp.status_code} (Java parity is HTTP 200)"
        body = resp.json()
        assert body["success"] is False
        assert body["code"] == 501
        assert "时间维度" in body["message"]

    def test_record_usage_NOT_called_on_time_month_failure(self, client, monkeypatch):
        """T8 atomicity: BusinessException raised before write tx → no audit row written."""
        from smartbi_compat.api import analysis_drilldown as adr
        called = []

        async def _spy(**kw):
            called.append(kw)

        async def _unsupported(factory_id, range_, period):
            raise NotImplementedError(f"period='{period}' not supported")

        monkeypatch.setattr(adr, "_get_sales_trend_chart", _unsupported)
        monkeypatch.setattr(adr, "_drilldown_record_usage_async", _spy)

        resp = _post(client, {
            "dimension": "time", "level": 1,
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        # T8 atomicity: NO audit row when dispatch raises
        assert called == [], f"expected 0 record_usage calls; got {len(called)}"

    def test_time_period_message_contains_period_value(self, client, monkeypatch):
        """501 message format: '时间维度下钻暂未支持周期 'MONTH': ...' (preserves period name)."""
        self._patched_unsupported(monkeypatch)
        resp = _post(client, {
            "dimension": "time", "level": 1,
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        body = resp.json()
        assert "MONTH" in body["message"]
```

- [ ] **Step 2: Run new classes**

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownErrorEnvelope tests/python/smartbi_compat/test_analysis_drilldown_contract.py::TestDrillDownTimeMonthRegression -v --tb=short -W ignore 2>&1 | tail -15
```

Expected: ~6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: drilldown PR-C error envelope + time MONTH regression" -- tests/python/smartbi_compat/test_analysis_drilldown_contract.py
```

---

## Task 5: Full pytest + verify HARD RULE + push

- [ ] **Step 1: Verify HARD RULE — 0 changes to analysis_drilldown.py**

```bash
git diff origin/main..HEAD --stat backend/python/smartbi_compat/api/analysis_drilldown.py
# Expected: empty output (no changes)
```

If any diff appears, fail and revert — PR-C is tests-only.

- [ ] **Step 2: Run all drill-down tests**

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/test_analysis_drilldown_contract.py -v --tb=short -W ignore 2>&1 | tail -30
```

Expected: 17 PR-A tests + ~46 new arithmetic tests = ~63 PASS.

- [ ] **Step 3: Run full smartbi_compat baseline**

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/ -q --tb=no -W ignore 2>&1 | tail -10
```

Expected: previous baseline + ~46 new = no regressions.

- [ ] **Step 4: Squash WIP commits + push**

```bash
git fetch origin
git log origin/main..HEAD --oneline
# Soft reset to base, single commit
git reset --soft $(git rev-parse HEAD~$(git log origin/main..HEAD --oneline | wc -l))
# Wait — better to use the actual base SHA
git reset --soft origin/main
git status --short
git commit -m "Phase 2A: /drill-down arithmetic depth tests (PR-C, ~46 tests, 8 classes)"
git rebase origin/main  # may need re-rebase if sister chats moved main
git push -u origin phase2a/drill-down-pr-c
```

If main.py / analysis_drilldown.py end up staged from any sister chat reset, restore:
```bash
git restore --staged --source=origin/main backend/python/main.py backend/python/smartbi_compat/api/analysis_drilldown.py
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --base main --head phase2a/drill-down-pr-c \
  --title "Phase 2A: /drill-down arithmetic depth tests (PR-C, ~46 tests)" \
  --body "$(cat <<'EOF'
## Summary

Phase 2A drill-down PR-C — arithmetic depth tests for the drill-down endpoint port (PR-A landed as #72).

**HARD RULE: tests-only.** Zero changes to `analysis_drilldown.py` impl.

## Test classes (8 classes, ~46 tests)

1. `TestDrillDownDispatchArithmetic` — T3 case-insensitive + T4 `_compute_drill_path` 6 edge cases + T5 default range + T2 dead level>1 (region L3, time period mapping) + region/salesperson branching (~17 tests)
2. `TestDrillDownProvinceCityRankingArithmetic` — H1+H2 `_build_drilldown_ranking` + alert thresholds 60/85 (~7 tests)
3. `TestDrillDownDeptDetailArithmetic` — H3 16-field DashboardResponse + KpiCard 13-field + status mapping (red/yellow/green) + divide-by-zero member_count (~7 tests)
4. `TestDrillDownProductChartArithmetic` — H4 ChartConfig 7-field empty/populated + lowercase xaxisField (Rule 9.1) (~4 tests)
5. `TestDrillDownSalespersonMetricsArithmetic` — H5 List[MetricResult] 11-field × 4 metrics + dimensionValue (~4 tests)
6. `TestDrillDownRecordUsageWriteArithmetic` — T7 SQL bind shape (sync mock conn) + Java line 1066 default args + table name (plural) (~4 tests)
7. `TestDrillDownErrorEnvelope` — T10 5-field stripped envelope + message format + 400 code (~3 tests)
8. `TestDrillDownTimeMonthRegression` — C1 final-review CRITICAL bug regression: time MONTH/WEEK/DAY → 501 + atomicity preserved (~3 tests)

## Test plan

- [x] All 8 new classes PASS
- [x] PR-A 17 tests still PASS
- [x] smartbi_compat baseline no regressions
- [x] HARD RULE verified: `git diff` shows 0 bytes change to `analysis_drilldown.py`

## Out of scope

- PR-B (additional contract / cross-tenant tests) — separate chat
- WEEK/MONTH bucketing extension to sister `_get_sales_trend_chart` — separate PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Verify mergeable + ping user**

```bash
gh pr view --json url,state,mergeable -q '.url, .state, .mergeable'
```

Then ping user with PR URL.

---

## Self-review checklist

- [x] All 8 test classes target distinct helpers/behaviors (no duplicate coverage with PR-A)
- [x] HARD RULE protected: tests-only, all edits to test file only
- [x] Mock pattern uses try/finally restoration (sister precedent)
- [x] Final-review C1 regression covered by TestDrillDownTimeMonthRegression
- [x] Rule 9.1 (lowercase xaxisField), Rule 9.2 (16-field empty case), Rule 9.3 (11-field MetricResult) all verified by separate tests
- [x] Squash before push (Task 5 step 4)

## Parallel work

### Subagent: ✅ each task is independent
Tasks 1-4 are independent test class additions. Could dispatch in parallel via subagents but file is single → must serialize commits to avoid file collisions. Sequential dispatch with append-only edits is safest.

### Multi-Chat: ✅ no collision
Only edits the test file (PR-A complete file in main). No risk to sister chats.
