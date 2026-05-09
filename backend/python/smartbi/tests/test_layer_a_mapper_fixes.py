"""
Layer A (Apr 20 2026) unit tests for semantic_mapper + chart_recommender fixes.

Covers:
- A1 dedupe (standard_name collision suffix)
- A2 收入分组 → dimension regex
- A3 data_type inference from sample
- A4 cardinality gate in chart recommender
- A5 cross-sheet dim label inference

Run: python -m pytest smartbi/tests/test_layer_a_mapper_fixes.py -v
"""
import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest  # noqa: E402

from smartbi.services.semantic_mapper import FieldMapping, SemanticMapper  # noqa: E402
from smartbi.services.chart_recommender import (  # noqa: E402
    DataSummary,
    ChartRecommender,
)
from smartbi.services.cross_sheet_aggregator import CrossSheetAggregator  # noqa: E402


# -------------------- A1 dedupe --------------------


class TestA1Dedupe:
    def test_unique_names_untouched(self):
        svc = SemanticMapper.__new__(SemanticMapper)
        mappings = [
            FieldMapping(original="金额A", standard="金额", confidence=0.9, method="rule"),
            FieldMapping(original="数量B", standard="数量", confidence=0.9, method="rule"),
        ]
        svc._dedupe_standard_names(mappings)
        assert [m.standard for m in mappings] == ["金额", "数量"]

    def test_collisions_get_suffix(self):
        svc = SemanticMapper.__new__(SemanticMapper)
        mappings = [
            FieldMapping(original="销售金额", standard="数量金额", confidence=0.9, method="rule"),
            FieldMapping(original="销售单价", standard="数量金额", confidence=0.9, method="rule"),
            FieldMapping(original="折后金额", standard="数量金额", confidence=0.9, method="rule"),
        ]
        svc._dedupe_standard_names(mappings)
        assert [m.standard for m in mappings] == ["数量金额", "数量金额_2", "数量金额_3"]

    def test_none_standard_skipped(self):
        svc = SemanticMapper.__new__(SemanticMapper)
        mappings = [
            FieldMapping(original="X", standard=None, confidence=0.0, method="rule"),
            FieldMapping(original="Y", standard=None, confidence=0.0, method="rule"),
        ]
        svc._dedupe_standard_names(mappings)
        # None standards never collide
        assert all(m.standard is None for m in mappings)


# -------------------- A2 收入分组 → dimension --------------------


class TestA2RevenueGroup:
    def setup_method(self):
        self.svc = SemanticMapper.__new__(SemanticMapper)

    def test_收入分组_goes_to_category(self):
        result = self.svc._classify_by_priority_regex("收入分组")
        assert result is not None
        category, std, conf = result
        assert category == "category"
        assert std == "revenue_group"

    def test_销售类型_goes_to_category(self):
        result = self.svc._classify_by_priority_regex("销售类型")
        assert result is not None
        assert result[0] == "category"

    def test_营业组别_goes_to_category(self):
        result = self.svc._classify_by_priority_regex("营业组别")
        assert result is not None
        assert result[0] == "category"

    def test_plain_revenue_still_measure(self):
        # "收入" alone must still be amount (measure)
        result = self.svc._classify_by_priority_regex("收入")
        assert result is not None
        assert result[0] == "amount"

    def test_营业收入_still_measure(self):
        # "营业收入" should still be measure — 分组/类型 只有带后缀才转
        result = self.svc._classify_by_priority_regex("营业收入")
        assert result is not None
        assert result[0] == "amount"


# -------------------- A3 data_type inference --------------------


class TestA3InferDataType:
    def test_numeric(self):
        assert SemanticMapper._infer_data_type([1, 2, 3]) == "NUMERIC"
        assert SemanticMapper._infer_data_type(["1.5", "2", "3.14"]) == "NUMERIC"
        assert SemanticMapper._infer_data_type(["1,234.56", "2,000", "¥3,000"]) == "NUMERIC"
        assert SemanticMapper._infer_data_type(["12%", "34%", "56%"]) == "NUMERIC"

    def test_date(self):
        assert SemanticMapper._infer_data_type(
            ["2025-01-01", "2025-02-01", "2025-03-01"]
        ) == "DATE"
        assert SemanticMapper._infer_data_type(
            ["2025年01月01日", "2025年02月01日"]
        ) == "DATE"
        # Pure 4-digit year without month/day is ambiguous — inference prefers
        # NUMERIC (safer for sums/avgs). True year-only columns should carry
        # explicit 年 suffix or be classified by column name, not sample.
        assert SemanticMapper._infer_data_type(["2025年", "2024年", "2023年"]) == "DATE"

    def test_text(self):
        assert SemanticMapper._infer_data_type(["永和豆浆", "青花椒"]) == "TEXT"
        assert SemanticMapper._infer_data_type(["门店A", "门店B", "门店C"]) == "TEXT"

    def test_empty_values_returns_text(self):
        assert SemanticMapper._infer_data_type([]) == "TEXT"
        assert SemanticMapper._infer_data_type([None, None]) == "TEXT"
        assert SemanticMapper._infer_data_type(["", "nan", "None"]) == "TEXT"

    def test_enrich_sets_on_mapping(self):
        svc = SemanticMapper.__new__(SemanticMapper)
        mappings = [
            FieldMapping(original="日期", standard="date", confidence=0.9, method="rule"),
            FieldMapping(original="金额", standard="amount", confidence=0.9, method="rule"),
            FieldMapping(original="门店", standard="store", confidence=0.9, method="rule"),
        ]
        columns = ["日期", "金额", "门店"]
        sample_data = [
            ["2025-01-01", 100.5, "A店"],
            ["2025-01-02", 200.0, "B店"],
            ["2025-01-03", 300.75, "C店"],
        ]
        svc._enrich_data_types(mappings, columns, sample_data)
        assert mappings[0].data_type == "DATE"
        assert mappings[1].data_type == "NUMERIC"
        assert mappings[2].data_type == "TEXT"


# -------------------- A4 cardinality gate --------------------


class TestA4CardinalityGate:
    def _svc(self):
        return ChartRecommender.__new__(ChartRecommender)

    def test_from_feature_results_reads_unique_count(self):
        features = [
            {"columnName": "门店", "dataType": "CATEGORICAL", "uniqueCount": 5},
            {"columnName": "金额", "dataType": "NUMERIC", "uniqueCount": 1000},
            {"columnName": "日期", "dataType": "DATE", "unique_count": 30},
        ]
        ds = DataSummary.from_feature_results(features, row_count=100)
        assert ds.cardinality == {"门店": 5, "金额": 1000, "日期": 30}
        assert "门店" in ds.category_columns
        assert "金额" in ds.measures
        assert "日期" in ds.time_columns

    def test_single_value_category_blocks_bar_chart(self):
        # Single store upload — "门店" cardinality=1 should refuse bar/pie charts
        features = [
            {"columnName": "门店", "dataType": "CATEGORICAL", "uniqueCount": 1},
            {"columnName": "金额", "dataType": "NUMERIC", "uniqueCount": 50},
        ]
        ds = DataSummary.from_feature_results(features, row_count=50)
        svc = self._svc()
        recs = svc._minimal_fallback(ds, scenario="general")
        chart_types = [r.chart_type for r in recs]
        # Bar / pie should NOT appear
        assert "bar" not in chart_types
        assert "pie" not in chart_types
        # Scatter (pure-measure) may still appear — that's fine
        # Radar (needs cat_has_variety) should also be blocked

    def test_multi_value_category_allows_bar_chart(self):
        features = [
            {"columnName": "门店", "dataType": "CATEGORICAL", "uniqueCount": 5},
            {"columnName": "金额", "dataType": "NUMERIC", "uniqueCount": 50},
        ]
        ds = DataSummary.from_feature_results(features, row_count=50)
        svc = self._svc()
        recs = svc._minimal_fallback(ds, scenario="general")
        chart_types = [r.chart_type for r in recs]
        assert "bar" in chart_types

    def test_missing_cardinality_defaults_to_permissive(self):
        # No uniqueCount provided → fallback to current permissive behavior
        features = [
            {"columnName": "门店", "dataType": "CATEGORICAL"},
            {"columnName": "金额", "dataType": "NUMERIC"},
        ]
        ds = DataSummary.from_feature_results(features, row_count=50)
        assert ds.cardinality == {}
        svc = self._svc()
        recs = svc._minimal_fallback(ds, scenario="general")
        chart_types = [r.chart_type for r in recs]
        assert "bar" in chart_types  # unknown cardinality → trust existing behavior


# -------------------- A5 cross-sheet dim label --------------------


class TestA5CrossSheetDimLabel:
    def test_store_names(self):
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names(
            ["永和豆浆南桥店", "永和豆浆新梅店"]
        ) == "门店"
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names(
            ["A分店", "B分店"]
        ) == "门店"

    def test_brand_names(self):
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names(
            ["青花椒品牌", "老乡鸡品牌"]
        ) == "品牌"

    def test_channel_names(self):
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names(
            ["美团渠道", "抖音渠道"]
        ) == "渠道"
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names(
            ["外卖平台", "堂食平台"]
        ) == "渠道"

    def test_generic_sheet_names_returns_none(self):
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names(
            ["表E", "表F", "Sheet1"]
        ) is None
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names([]) is None

    def test_region_names(self):
        assert CrossSheetAggregator._infer_dim_label_from_sheet_names(
            ["华东区域", "华南区域"]
        ) == "区域"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
