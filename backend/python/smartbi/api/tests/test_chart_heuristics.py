"""test_chart_heuristics.py — unit tests for chart auto-detection guards."""
from __future__ import annotations

import pandas as pd

from smartbi.api.chart_heuristics import (
    filter_id_like_columns,
    is_high_cardinality_column,
    is_id_like_column_name,
    pick_categorical_xfield,
)


# ─── ID-suffix guard ──────────────────────────────────────────────────────────


def test_id_like_chinese_billing():
    assert is_id_like_column_name("账单号") is True


def test_id_like_chinese_employee():
    assert is_id_like_column_name("员工号") is True


def test_id_like_chinese_invoice():
    assert is_id_like_column_name("发票号") is True


def test_id_like_chinese_serial():
    assert is_id_like_column_name("流水号") is True


def test_id_like_english_id_suffix():
    assert is_id_like_column_name("订单ID") is True


def test_id_like_english_uuid():
    assert is_id_like_column_name("uuid") is True


def test_id_like_english_code():
    assert is_id_like_column_name("product_code") is True


def test_id_like_revenue_not_id():
    assert is_id_like_column_name("营业额") is False


def test_id_like_store_dim_not_id():
    assert is_id_like_column_name("门店") is False


def test_id_like_empty_string():
    assert is_id_like_column_name("") is False


def test_id_like_case_insensitive():
    assert is_id_like_column_name("CUSTOMER_ID") is True
    assert is_id_like_column_name("UUID") is True


# ─── Cardinality guard ────────────────────────────────────────────────────────


def test_cardinality_low_5_unique_in_100():
    s = pd.Series(["A", "B", "C", "D", "E"] * 20)  # 100 rows, 5 distinct
    assert is_high_cardinality_column(s) is False


def test_cardinality_high_70_unique_in_100():
    s = pd.Series([f"v{i}" for i in range(70)] + ["x"] * 30)  # 71 distinct / 100
    assert is_high_cardinality_column(s) is True


def test_cardinality_threshold_boundary():
    # Exactly 50% — not high-cardinality (uses strict >)
    s = pd.Series([f"v{i}" for i in range(50)] * 2)  # 50 distinct in 100 rows
    assert is_high_cardinality_column(s) is False


def test_cardinality_above_threshold():
    s = pd.Series([f"v{i}" for i in range(51)] + ["x"] * 49)  # 52 distinct in 100
    assert is_high_cardinality_column(s) is True


def test_cardinality_empty_series():
    s = pd.Series([], dtype="object")
    assert is_high_cardinality_column(s) is False


def test_cardinality_with_nan_doesnt_count():
    # NaN ignored by dropna
    s = pd.Series(["A", "B", "A", None, None] * 20)  # 100 rows, 2 distinct after drop
    assert is_high_cardinality_column(s) is False


def test_cardinality_custom_threshold():
    s = pd.Series([f"v{i}" for i in range(40)] + ["x"] * 60)  # 41 distinct / 100
    assert is_high_cardinality_column(s, threshold=0.3) is True
    assert is_high_cardinality_column(s, threshold=0.5) is False


# ─── filter_id_like_columns ───────────────────────────────────────────────────


def test_filter_id_strips_id_columns():
    cols = ["营业额", "账单号", "门店", "订单编号", "实收"]
    assert filter_id_like_columns(cols) == ["营业额", "门店", "实收"]


def test_filter_id_empty_list():
    assert filter_id_like_columns([]) == []


def test_filter_id_no_id_columns():
    cols = ["营业额", "门店", "客流"]
    assert filter_id_like_columns(cols) == cols


def test_filter_id_all_id_columns():
    cols = ["账单号", "订单ID", "uuid"]
    assert filter_id_like_columns(cols) == []


# ─── pick_categorical_xfield ──────────────────────────────────────────────────


def test_pick_xfield_prefers_low_cardinality():
    df = pd.DataFrame({
        "客户名": [f"customer{i}" for i in range(100)],  # 100 distinct (high)
        "门店": ["A", "B", "C", "D"] * 25,  # 4 distinct (low)
    })
    assert pick_categorical_xfield(df, ["客户名", "门店"]) == "门店"


def test_pick_xfield_falls_back_when_all_high():
    df = pd.DataFrame({
        "客户名": [f"c{i}" for i in range(100)],
        "订单号": [f"o{i}" for i in range(100)],
    })
    # All high-cardinality → falls back to first
    assert pick_categorical_xfield(df, ["客户名", "订单号"]) == "客户名"


def test_pick_xfield_empty_list():
    df = pd.DataFrame({"A": [1, 2, 3]})
    assert pick_categorical_xfield(df, []) is None


def test_pick_xfield_skips_high_returns_first_low():
    df = pd.DataFrame({
        "高基数": [f"v{i}" for i in range(100)],
        "低基数": ["X", "Y"] * 50,
        "其他低": ["A", "B", "C"] * 33 + ["D"],
    })
    # First low-cardinality is 低基数
    assert pick_categorical_xfield(df, ["高基数", "低基数", "其他低"]) == "低基数"
