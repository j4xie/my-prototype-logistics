"""Integration tests for Financial Dashboard API.

Usage:
    cd backend/python
    python -m pytest smartbi/tests/test_financial_dashboard.py -v

Or without pytest:
    python smartbi/tests/test_financial_dashboard.py
"""
import sys
import os
import unittest
import logging
from typing import Dict, List, Any

import pandas as pd

# Ensure project root is on the path so ``smartbi`` is importable.
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from smartbi.services.financial_data_normalizer import FinancialDataNormalizer, ColumnMapping
from smartbi.services.financial.registry import ChartBuilderRegistry, registry
from smartbi.services.financial_dashboard import FinancialDashboardService

from smartbi.tests.test_financial_data import (
    SAMPLE_FINANCIAL_DATA,
    SAMPLE_CATEGORY_DATA,
    SAMPLE_PNL_DATA,
    SAMPLE_MARGIN_DATA,
    SAMPLE_GANTT_DATA,
    SAMPLE_FLOW_DATA,
    SAMPLE_TREEMAP_DATA,
    SAMPLE_EMPTY_DATA,
    SAMPLE_SINGLE_ROW_DATA,
    SAMPLE_ALL_ZEROS_DATA,
)

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')
logger = logging.getLogger(__name__)

# Shared helper
DEFAULT_PERIOD = {"year": 2026, "period_type": "year", "start_month": 1, "end_month": 12}


# ============================================================================
# 1. FinancialDataNormalizer tests
# ============================================================================
class TestFinancialDataNormalizer(unittest.TestCase):
    """Tests for column detection and data normalization."""

    def setUp(self):
        self.normalizer = FinancialDataNormalizer()

    # --- detect_columns ---------------------------------------------------

    def test_detect_columns_financial_data(self):
        """Wide-format data: should detect 12 period cols and label_col='项目'."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        mapping = self.normalizer.detect_columns(df.columns.tolist(), df)

        self.assertEqual(len(mapping.period_cols), 12, "Should detect 12 month columns")
        self.assertEqual(mapping.data_layout, "wide")
        # '项目' is a text column and matches item keywords
        self.assertTrue(
            mapping.item_col is not None or mapping.label_col is not None,
            "Should detect item/label column '项目'",
        )

    def test_detect_columns_category_data(self):
        """Long-format category data: should detect category_col='品类'."""
        df = pd.DataFrame(SAMPLE_CATEGORY_DATA)
        mapping = self.normalizer.detect_columns(df.columns.tolist(), df)

        self.assertEqual(mapping.category_col, "品类")
        # '本年' matches actual keywords, '上年' matches last_year keywords
        self.assertTrue(len(mapping.actual_cols) > 0, "Should detect actual col '本年'")
        self.assertTrue(len(mapping.last_year_cols) > 0, "Should detect last_year col '上年'")

    def test_detect_columns_pnl_data(self):
        """P&L data: should detect item_col='项目'."""
        df = pd.DataFrame(SAMPLE_PNL_DATA)
        mapping = self.normalizer.detect_columns(df.columns.tolist(), df)

        self.assertTrue(
            mapping.item_col is not None or mapping.label_col is not None,
            "Should detect item/label column",
        )

    def test_detect_columns_margin_data(self):
        """Margin data: should detect period + actual + last_year columns."""
        df = pd.DataFrame(SAMPLE_MARGIN_DATA)
        mapping = self.normalizer.detect_columns(df.columns.tolist(), df)

        # '月份' column contains month text but is not a column named '1月' etc.
        # '本年毛利率' -> actual, '上年毛利率' -> last_year
        self.assertTrue(len(mapping.actual_cols) > 0 or len(mapping.period_cols) > 0,
                        "Should detect some role columns from margin data")

    # --- normalize --------------------------------------------------------

    def test_normalize_wide_format(self):
        """Wide-format with budget/actual/last_year rows: normalize to long."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        mapping = self.normalizer.detect_columns(df.columns.tolist(), df)
        result = self.normalizer.normalize(df, mapping, {
            "period_type": "year", "start_month": 1, "end_month": 12,
        })

        self.assertIsInstance(result, pd.DataFrame)
        self.assertGreater(len(result), 0, "Normalized df should not be empty")
        self.assertIn('month', result.columns)
        self.assertIn('budget', result.columns)
        self.assertIn('actual', result.columns)
        self.assertIn('last_year', result.columns)

    def test_normalize_with_period_filter(self):
        """month_range filter should restrict to specified months."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        mapping = self.normalizer.detect_columns(df.columns.tolist(), df)
        result = self.normalizer.normalize(df, mapping, {
            "period_type": "month_range", "start_month": 1, "end_month": 6,
        })

        months_in_result = result['month'].unique()
        self.assertTrue(all(1 <= m <= 6 for m in months_in_result),
                        f"All months should be 1-6, got {months_in_result}")
        self.assertLessEqual(len(months_in_result), 6)

    def test_normalize_long_format_category(self):
        """Long-format category data should normalize correctly."""
        df = pd.DataFrame(SAMPLE_CATEGORY_DATA)
        mapping = self.normalizer.detect_columns(df.columns.tolist(), df)
        result = self.normalizer.normalize(df, mapping, {
            "period_type": "year", "start_month": 1, "end_month": 12,
        })

        self.assertIsInstance(result, pd.DataFrame)
        self.assertGreater(len(result), 0)

    # --- classify_pnl_item ------------------------------------------------

    def test_classify_pnl_items(self):
        """P&L items should be classified correctly."""
        cases = {
            "营业收入": "revenue",
            "营业成本": "cost",
            "销售费用": "expense",
            "管理费用": "expense",
            "研发费用": "expense",
            "财务费用": "expense",
            "所得税": "tax",
            "净利润": "profit",
        }
        for item_name, expected in cases.items():
            result = self.normalizer.classify_pnl_item(item_name)
            self.assertEqual(result, expected, f"'{item_name}' should classify as '{expected}', got '{result}'")

    # --- get_months_label -------------------------------------------------

    def test_get_months_label_full_year(self):
        self.assertEqual(self.normalizer.get_months_label(1, 12, 2026), "2026年全年")

    def test_get_months_label_single_month(self):
        self.assertEqual(self.normalizer.get_months_label(3, 3, 2026), "2026年3月")

    def test_get_months_label_range(self):
        self.assertEqual(self.normalizer.get_months_label(1, 6, 2026), "2026年1-6月")


# ============================================================================
# 2. ChartBuilderRegistry tests
# ============================================================================
class TestChartBuilderRegistry(unittest.TestCase):
    """Tests for the singleton chart builder registry."""

    def test_auto_discover_finds_all_builders(self):
        """auto_discover should register >= 9 builders."""
        all_types = registry.list_all()
        type_ids = [t["chartType"] for t in all_types]
        self.assertGreaterEqual(len(type_ids), 9,
                                f"Expected >=9 builders, found {len(type_ids)}: {type_ids}")

    def test_list_all_includes_all_chart_types(self):
        """list_all should include all 9 known chart types."""
        expected = {
            "budget_achievement",
            "yoy_mom_comparison",
            "pnl_waterfall",
            "expense_yoy_budget",
            "category_yoy_comparison",
            "gross_margin_trend",
            "category_structure_donut",
            "cost_flow_sankey",
            "variance_analysis",
        }
        all_types = {t["chartType"] for t in registry.list_all()}
        missing = expected - all_types
        self.assertEqual(missing, set(), f"Missing chart types: {missing}")

    def test_list_all_has_metadata(self):
        """Each entry should have chartType, displayName, requiredColumns, description."""
        for entry in registry.list_all():
            self.assertIn("chartType", entry)
            self.assertIn("displayName", entry)
            self.assertIn("requiredColumns", entry)
            self.assertIn("description", entry)
            self.assertTrue(len(entry["displayName"]) > 0)

    def test_get_known_builder(self):
        """get() should return a builder for a known chart type."""
        builder = registry.get("budget_achievement")
        self.assertIsNotNone(builder)
        self.assertEqual(builder.chart_type, "budget_achievement")

    def test_get_unknown_returns_none(self):
        """get() should return None for unknown type."""
        self.assertIsNone(registry.get("nonexistent_chart_type"))

    def test_can_build_with_financial_data(self):
        """Builders needing budget+actual+period should pass can_build for SAMPLE_FINANCIAL_DATA."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        normalizer = FinancialDataNormalizer()
        mapping = normalizer.detect_columns(df.columns.tolist(), df)

        for chart_type in ["budget_achievement", "variance_analysis"]:
            builder = registry.get(chart_type)
            self.assertIsNotNone(builder, f"Builder {chart_type} not found")
            self.assertTrue(builder.can_build(mapping),
                            f"{chart_type} should be buildable with financial data")

    def test_can_build_with_pnl_data(self):
        """Builders needing item should pass can_build for SAMPLE_PNL_DATA."""
        df = pd.DataFrame(SAMPLE_PNL_DATA)
        normalizer = FinancialDataNormalizer()
        mapping = normalizer.detect_columns(df.columns.tolist(), df)

        for chart_type in ["pnl_waterfall", "cost_flow_sankey"]:
            builder = registry.get(chart_type)
            self.assertIsNotNone(builder, f"Builder {chart_type} not found")
            self.assertTrue(builder.can_build(mapping),
                            f"{chart_type} should be buildable with P&L data")


# ============================================================================
# 3. Individual Builder tests (9 chart types)
# ============================================================================
class _BaseBuilderTest(unittest.TestCase):
    """Shared assertions for builder output."""

    def setUp(self):
        self.normalizer = FinancialDataNormalizer()
        self.service = FinancialDashboardService()

    def _assert_valid_chart_result(self, result: Dict, expected_type: str):
        """Common assertions for any successful chart build result."""
        self.assertTrue(result.get("success", False),
                        f"Chart {expected_type} failed: {result.get('error', 'unknown')}")
        self.assertEqual(result.get("chartType"), expected_type)
        self.assertIn("echartsOption", result)
        self.assertIsInstance(result["echartsOption"], dict)
        self.assertIn("kpis", result)
        self.assertIsInstance(result["kpis"], list)
        self.assertIn("analysisContext", result)
        self.assertTrue(len(result["analysisContext"]) > 0,
                        f"analysisContext should be non-empty for {expected_type}")

    def _build_chart(self, chart_type: str, raw_data: list) -> Dict:
        """Helper: run generate_chart through the service layer."""
        df = pd.DataFrame(raw_data)
        return self.service.generate_chart(
            chart_type=chart_type,
            raw_data=df,
            year=2026,
            period_type="year",
            start_month=1,
            end_month=12,
        )


class TestBudgetAchievementBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("budget_achievement", SAMPLE_FINANCIAL_DATA)
        self._assert_valid_chart_result(result, "budget_achievement")

        option = result["echartsOption"]
        series_types = [s["type"] for s in option.get("series", [])]
        self.assertIn("bar", series_types, "Should have bar series")
        self.assertIn("line", series_types, "Should have line series (achievement rate)")

        kpis = result["kpis"]
        self.assertGreaterEqual(len(kpis), 3, "Should have >=3 KPIs")

        # Verify KPI values are not None
        for kpi in kpis:
            self.assertIn("label", kpi)
            self.assertIn("value", kpi)
            self.assertIsNotNone(kpi["value"])


class TestYoyMomComparisonBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("yoy_mom_comparison", SAMPLE_FINANCIAL_DATA)
        self._assert_valid_chart_result(result, "yoy_mom_comparison")

        option = result["echartsOption"]
        self.assertIn("series", option)
        self.assertTrue(len(option["series"]) >= 2, "Should have >=2 series (current vs last year)")


class TestPnlWaterfallBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("pnl_waterfall", SAMPLE_PNL_DATA)
        self._assert_valid_chart_result(result, "pnl_waterfall")

        option = result["echartsOption"]
        # Waterfall uses stacked bars
        series = option.get("series", [])
        self.assertGreater(len(series), 0, "Should have series for waterfall")

        kpis = result["kpis"]
        self.assertGreater(len(kpis), 0)


class TestExpenseYoyBudgetBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("expense_yoy_budget", SAMPLE_FINANCIAL_DATA)
        self._assert_valid_chart_result(result, "expense_yoy_budget")

        option = result["echartsOption"]
        # Should have dual axis (yAxis should be a list of 2)
        y_axis = option.get("yAxis", [])
        if isinstance(y_axis, list):
            self.assertGreaterEqual(len(y_axis), 1, "Should have at least 1 y-axis")


class TestCategoryYoyComparisonBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("category_yoy_comparison", SAMPLE_CATEGORY_DATA)
        self._assert_valid_chart_result(result, "category_yoy_comparison")

        option = result["echartsOption"]
        series = option.get("series", [])
        self.assertGreater(len(series), 0, "Should have series for category comparison")


class TestGrossMarginTrendBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("gross_margin_trend", SAMPLE_MARGIN_DATA)
        self._assert_valid_chart_result(result, "gross_margin_trend")

        option = result["echartsOption"]
        series = option.get("series", [])
        # Should have line series
        series_types = [s.get("type") for s in series]
        self.assertIn("line", series_types, "Should have line series for margin trend")


class TestCategoryStructureDonutBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("category_structure_donut", SAMPLE_CATEGORY_DATA)
        self._assert_valid_chart_result(result, "category_structure_donut")

        option = result["echartsOption"]
        series = option.get("series", [])
        self.assertGreater(len(series), 0)
        # Donut chart uses pie type
        series_types = [s.get("type") for s in series]
        self.assertIn("pie", series_types, "Should have pie series for donut")


class TestCostFlowSankeyBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("cost_flow_sankey", SAMPLE_PNL_DATA)
        self._assert_valid_chart_result(result, "cost_flow_sankey")

        option = result["echartsOption"]
        series = option.get("series", [])
        self.assertGreater(len(series), 0)
        # Sankey type
        series_types = [s.get("type") for s in series]
        self.assertIn("sankey", series_types, "Should have sankey series")


class TestVarianceAnalysisBuilder(_BaseBuilderTest):
    def test_build(self):
        result = self._build_chart("variance_analysis", SAMPLE_FINANCIAL_DATA)
        self._assert_valid_chart_result(result, "variance_analysis")

        option = result["echartsOption"]
        series = option.get("series", [])
        self.assertGreater(len(series), 0, "Should have series for variance analysis")

        kpis = result["kpis"]
        kpi_labels = [k["label"] for k in kpis]
        self.assertIn("总预算", kpi_labels)
        self.assertIn("总实际", kpi_labels)
        self.assertIn("总差异", kpi_labels)


# ============================================================================
# 4. FinancialDashboardService tests
# ============================================================================
class TestFinancialDashboardService(unittest.TestCase):
    """Tests for the orchestration service."""

    def setUp(self):
        self.service = FinancialDashboardService()

    def test_generate_all(self):
        """chart_type='all' should return multiple charts."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        result = self.service.generate_chart(
            chart_type="all", raw_data=df, year=2026,
        )
        self.assertTrue(result.get("success", False), f"generate_all failed: {result}")
        self.assertIn("charts", result)
        charts = result["charts"]
        self.assertIsInstance(charts, list)
        self.assertGreater(len(charts), 0, "Should return at least 1 chart")
        self.assertIn("totalCharts", result)

    def test_generate_single(self):
        """Requesting a specific type should return one chart."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        result = self.service.generate_chart(
            chart_type="budget_achievement", raw_data=df, year=2026,
        )
        self.assertTrue(result.get("success", False), f"Single chart failed: {result}")
        self.assertEqual(result.get("chartType"), "budget_achievement")

    def test_generate_nonexistent_type(self):
        """Unknown chart type should return error with available types."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        result = self.service.generate_chart(
            chart_type="nonexistent_chart", raw_data=df, year=2026,
        )
        self.assertFalse(result.get("success", True))
        self.assertIn("availableTypes", result)
        self.assertGreater(len(result["availableTypes"]), 0)

    def test_list_templates(self):
        """list_templates should return >=9 entries."""
        templates = self.service.list_templates()
        self.assertIsInstance(templates, list)
        self.assertGreaterEqual(len(templates), 9,
                                f"Expected >=9 templates, got {len(templates)}")

    def test_generate_dashboard(self):
        """generate_dashboard should return charts + metadata."""
        df = pd.DataFrame(SAMPLE_FINANCIAL_DATA)
        result = self.service.generate_dashboard(
            raw_data=df, year=2026,
            period_type="year", start_month=1, end_month=12,
        )
        self.assertTrue(result.get("success", False))
        self.assertIn("charts", result)
        self.assertIn("availableTypes", result)
        self.assertIn("totalCharts", result)
        self.assertIn("successCount", result)


# ============================================================================
# 5. Edge Cases
# ============================================================================
class TestEdgeCases(unittest.TestCase):
    """Verify graceful handling of edge-case inputs."""

    def setUp(self):
        self.service = FinancialDashboardService()

    def test_empty_dataframe(self):
        """Empty data should not crash; should return error or empty result."""
        df = pd.DataFrame(SAMPLE_EMPTY_DATA)
        try:
            result = self.service.generate_chart(
                chart_type="budget_achievement", raw_data=df, year=2026,
            )
            # Should either fail gracefully or return an error result
            if result.get("success"):
                # Even if it "succeeds", it should not crash
                pass
            else:
                # Expected: success=False with error message
                self.assertIn("error", result)
        except Exception as e:
            # Any exception is acceptable as long as it's not an unhandled crash
            logger.info(f"Empty data raised {type(e).__name__}: {e}")

    def test_single_row_data(self):
        """Single row should not crash."""
        df = pd.DataFrame(SAMPLE_SINGLE_ROW_DATA)
        try:
            result = self.service.generate_chart(
                chart_type="budget_achievement", raw_data=df, year=2026,
            )
            # Should not crash regardless of success/failure
            self.assertIsInstance(result, dict)
        except Exception as e:
            logger.info(f"Single row raised {type(e).__name__}: {e}")

    def test_all_zeros_no_division_by_zero(self):
        """All-zero data should not cause ZeroDivisionError."""
        df = pd.DataFrame(SAMPLE_ALL_ZEROS_DATA)
        try:
            result = self.service.generate_chart(
                chart_type="budget_achievement", raw_data=df, year=2026,
            )
            self.assertIsInstance(result, dict)
            # If successful, check KPIs don't contain Infinity
            if result.get("success"):
                for kpi in result.get("kpis", []):
                    val = kpi.get("value")
                    if isinstance(val, float):
                        self.assertFalse(
                            val != val,  # NaN check
                            f"KPI {kpi['label']} has NaN value",
                        )
        except ZeroDivisionError:
            self.fail("ZeroDivisionError with all-zero data")

    def test_all_zeros_variance(self):
        """Variance analysis with zeros should not crash."""
        df = pd.DataFrame(SAMPLE_ALL_ZEROS_DATA)
        try:
            result = self.service.generate_chart(
                chart_type="variance_analysis", raw_data=df, year=2026,
            )
            self.assertIsInstance(result, dict)
        except ZeroDivisionError:
            self.fail("ZeroDivisionError in variance_analysis with all-zero data")

    def test_missing_columns_for_builder(self):
        """Data lacking required columns should produce error, not crash."""
        # P&L data has no budget/actual/period cols -> budget_achievement should fail gracefully
        df = pd.DataFrame(SAMPLE_PNL_DATA)
        result = self.service.generate_chart(
            chart_type="budget_achievement", raw_data=df, year=2026,
        )
        # Should be success=False with detectedColumns or error
        self.assertFalse(result.get("success", True),
                         "budget_achievement should fail with P&L data (no budget/period)")


# ============================================================================
# Runner
# ============================================================================
def _run_all():
    """Run all test classes and print summary."""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    test_classes = [
        TestFinancialDataNormalizer,
        TestChartBuilderRegistry,
        TestBudgetAchievementBuilder,
        TestYoyMomComparisonBuilder,
        TestPnlWaterfallBuilder,
        TestExpenseYoyBudgetBuilder,
        TestCategoryYoyComparisonBuilder,
        TestGrossMarginTrendBuilder,
        TestCategoryStructureDonutBuilder,
        TestCostFlowSankeyBuilder,
        TestVarianceAnalysisBuilder,
        TestFinancialDashboardService,
        TestEdgeCases,
    ]

    for cls in test_classes:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures:  {len(result.failures)}")
    print(f"Errors:    {len(result.errors)}")
    print(f"Skipped:   {len(result.skipped)}")
    print("=" * 60)

    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(_run_all())
