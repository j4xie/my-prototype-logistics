"""Tests for QHJ revenue report yaml configurations.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 (report_registry.yaml)
                                                            §5.2 (field_aliases 2dfire patch)
"""
from pathlib import Path

import yaml

KNOWLEDGE_DIR = (
    Path(__file__).parent.parent
    / "knowledge"
    / "restaurant"
    / "pos"
)


def test_report_registry_loads_and_has_2dfire():
    data = yaml.safe_load(
        (KNOWLEDGE_DIR / "report_registry.yaml").read_text(encoding="utf-8")
    )
    assert "2dfire" in data
    keywords = [e["keyword"] for e in data["2dfire"]["filename_keywords"]]
    # All 6 二维火 reports must be registered (per spec §5.1).
    assert "营业概况报表" in keywords
    assert "堂食外卖占比表" in keywords
    assert "区域销售报表" in keywords
    assert "详细日报表" in keywords
    assert "订单付款方式汇总" in keywords
    assert "商品销售明细表" in keywords


def test_report_registry_each_entry_has_writer_and_grain():
    data = yaml.safe_load(
        (KNOWLEDGE_DIR / "report_registry.yaml").read_text(encoding="utf-8")
    )
    for entry in data["2dfire"]["filename_keywords"]:
        assert "keyword" in entry
        assert "writer" in entry
        assert entry["writer"].endswith("_writer")
        assert "grain" in entry


def test_field_aliases_2dfire_has_revenue_report_fields():
    """Section 5.2 patch — 6 new field aliases for revenue report needs."""
    data = yaml.safe_load(
        (KNOWLEDGE_DIR / "field_aliases.yaml").read_text(encoding="utf-8")
    )
    mappings = data["2dfire"]["field_mappings"]
    # New aliases added 2026-05-13 for QHJ revenue report.
    assert "order_type" in mappings, "order_type alias missing — needed for 堂食/外卖 split"
    assert "meal_period" in mappings, "meal_period alias missing — needed for 午市/晚市 filter"
    assert "revenue_ratio" in mappings, "revenue_ratio alias missing"
    assert "avg_order_spend" in mappings, "avg_order_spend alias missing"
    assert "avg_diner_spend" in mappings, "avg_diner_spend alias missing"
    assert "store_name" in mappings, "store_name alias missing"


def test_field_aliases_2dfire_existing_fields_preserved():
    """Patch must NOT break existing 16 aliases."""
    data = yaml.safe_load(
        (KNOWLEDGE_DIR / "field_aliases.yaml").read_text(encoding="utf-8")
    )
    mappings = data["2dfire"]["field_mappings"]
    for legacy in (
        "revenue", "sales_amount", "order_count", "quantity_sold",
        "unit_price", "discounted_amount", "refund_amount", "refund_count",
        "payment_method", "table_number", "diner_count", "order_time",
        "serve_time", "member_id", "product", "category",
    ):
        assert legacy in mappings, f"Legacy alias '{legacy}' was removed by patch"
