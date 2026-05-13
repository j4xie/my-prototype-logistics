"""Tests for backfill_silver meal_period population from 班次 column.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.5 (writer-side
.strip(); no semantic mapping), §6.7 (materializer reads fact_pos_transaction.
meal_period).

Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task C4 (revised).

After this patch the chain is:
  CSV 班次 column → row_data dict → field_mappings → _build_canonical_row
                                                  → CanonicalRow.meal_period
                                                  → fact_pos_transaction.meal_period
                                                  → materialize_daily_order_type_meal
                                                  → agg_daily_order_type_meal
"""
from datetime import date

from smartbi.canonical.aliases import ALIAS_TO_ATTR
from smartbi.canonical.normalizer import CanonicalRow
from scripts.backfill_silver import _build_canonical_row


def test_aliases_table_has_meal_period_chinese_keys():
    """班次 / 市段 / 午晚市 must resolve to canonical 'meal_period' attr."""
    assert ALIAS_TO_ATTR.get("班次") == "meal_period"
    assert ALIAS_TO_ATTR.get("meal_period") == "meal_period"
    # 市段 / 午晚市 also map (per field_aliases.yaml 2dfire patch)
    assert ALIAS_TO_ATTR.get("市段") == "meal_period"


def test_canonical_row_has_meal_period_field():
    """CanonicalRow must accept meal_period as a constructor arg."""
    row = CanonicalRow(
        factory_id="R_QINGHUAJIAO_REAL",
        source_type="excel",
        store_name="青花椒南方百联店",
        source_bill_no="B001",
        date=date(2025, 10, 1),
        meal_period="午市",
    )
    assert row.meal_period == "午市"


def test_canonical_row_meal_period_defaults_to_none():
    """Legacy rows without 班次 column → meal_period is None."""
    row = CanonicalRow(
        factory_id="F1",
        source_type="excel",
        store_name="S",
        source_bill_no="B",
        date=date(2025, 1, 1),
    )
    assert row.meal_period is None


def test_build_canonical_row_extracts_meal_period_from_班次():
    """_build_canonical_row must populate meal_period from row_data['班次']."""
    row_data = {
        "门店名称": "青花椒南方百联店",
        "账单号": "B001",
        "开单时间": "2025-10-01",
        "班次": "午市",
        "订单类型": "堂食",
        "营业额": 300.00,
        "实收额": 290.00,
        "客流量": 3,
    }
    field_mappings = {
        "门店名称": "store_name",
        "账单号": "source_bill_no",
        "开单时间": "date",
        "班次": "meal_period",
        "订单类型": "order_type",
        "营业额": "gross_amount",
        "实收额": "actual_receive",
        "客流量": "customer_count",
    }
    unknown: list[str] = []
    row = _build_canonical_row(
        row_data, field_mappings, "R_QINGHUAJIAO_REAL", "excel", 1, unknown
    )
    assert row is not None
    assert row.meal_period == "午市"


def test_build_canonical_row_strips_meal_period_whitespace():
    """Spec §5.5 — writer side .strip() (no semantic mapping)."""
    row_data = {
        "门店名称": "青花椒南方百联店",
        "账单号": "B002",
        "开单时间": "2025-10-01",
        "班次": " 午市 ",  # whitespace
        "订单类型": "堂食",
    }
    field_mappings = {
        "门店名称": "store_name",
        "账单号": "source_bill_no",
        "开单时间": "date",
        "班次": "meal_period",
        "订单类型": "order_type",
    }
    row = _build_canonical_row(
        row_data, field_mappings, "R_QINGHUAJIAO_REAL", "excel", 1, []
    )
    assert row is not None
    assert row.meal_period == "午市"  # stripped


def test_build_canonical_row_meal_period_missing_is_none():
    """Bills without 班次 column → meal_period stays None (not '')."""
    row_data = {
        "门店名称": "青花椒南方百联店",
        "账单号": "B003",
        "开单时间": "2025-10-01",
    }
    field_mappings = {
        "门店名称": "store_name",
        "账单号": "source_bill_no",
        "开单时间": "date",
    }
    row = _build_canonical_row(
        row_data, field_mappings, "R_QINGHUAJIAO_REAL", "excel", 1, []
    )
    assert row is not None
    assert row.meal_period is None
