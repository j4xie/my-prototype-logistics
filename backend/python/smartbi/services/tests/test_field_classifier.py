"""test_field_classifier.py — unit tests for unified field_classifier."""
from __future__ import annotations

from smartbi.services.field_classifier import (
    classify_column,
    dedupe_column_names,
    find_time_column,
    find_category_column,
)


# ─── Explicit overrides ──────────────────────────────────────────────────────


def test_商品结账总数_forced_measure_not_dimension():
    """Java originally set this as dimension; override says measure."""
    r = classify_column("商品结账总数", inferred_dtype="NUMERIC")
    assert r["is_measure"] is True
    assert r["is_dimension"] is False
    assert r["reason"].startswith("explicit_override:measure")


def test_账单号_forced_dimension_not_measure():
    """Java wrongly marked 账单号 as measure. Fix: dimension (ID)."""
    r = classify_column("账单号", inferred_dtype="TEXT")
    assert r["is_dimension"] is True
    assert r["is_measure"] is False
    assert r["semantic_type"] == "id"


def test_商品信息_dimension():
    """商品信息 is text blob parsed later — it's a dimension from the classifier POV."""
    r = classify_column("商品信息", inferred_dtype="TEXT")
    assert r["is_dimension"] is True


# ─── Time keyword priority ────────────────────────────────────────────────────


def test_time_by_keyword():
    r = classify_column("营业日期", inferred_dtype="TEXT")
    assert r["is_time"] is True


def test_time_by_dtype():
    r = classify_column("some_column", inferred_dtype="DATE")
    assert r["is_time"] is True


def test_开单时间_time():
    r = classify_column("开单时间", inferred_dtype="TEXT")
    assert r["is_time"] is True


# ─── ID-like guard (numeric but NOT measure) ──────────────────────────────────


def test_发票号_is_dimension_not_measure():
    """Numeric-looking IDs should not be summed."""
    r = classify_column("发票号", inferred_dtype="NUMERIC")
    assert r["is_dimension"] is True
    assert r["is_measure"] is False


def test_员工编号_dimension():
    r = classify_column("员工编号", inferred_dtype="NUMERIC")
    assert r["is_dimension"] is True


# ─── Measure keyword ──────────────────────────────────────────────────────────


def test_营业额_measure():
    r = classify_column("营业额", inferred_dtype="NUMERIC")
    assert r["is_measure"] is True
    assert r["semantic_type"] == "revenue"


def test_销售额_measure():
    r = classify_column("本月销售额", inferred_dtype="NUMERIC")
    assert r["is_measure"] is True


def test_客流量_measure():
    r = classify_column("客流量", inferred_dtype="NUMERIC")
    assert r["is_measure"] is True
    assert r["semantic_type"] == "customer"


def test_折扣率_measure_rate():
    r = classify_column("折扣率", inferred_dtype="NUMERIC")
    assert r["is_measure"] is True


# ─── Dimension keyword ────────────────────────────────────────────────────────


def test_门店名称_dimension():
    r = classify_column("门店名称", inferred_dtype="TEXT")
    assert r["is_dimension"] is True
    assert r["semantic_type"] == "store"


def test_服务员_dimension():
    r = classify_column("服务员", inferred_dtype="TEXT")
    assert r["is_dimension"] is True
    assert r["semantic_type"] == "staff"


def test_订单状态_dimension():
    r = classify_column("订单状态", inferred_dtype="TEXT")
    assert r["is_dimension"] is True


# ─── Category hint (from semantic_mapper) ─────────────────────────────────────


def test_category_hint_amount_measure():
    r = classify_column("某个生僻金额列", inferred_dtype="NUMERIC", category_hint="amount")
    assert r["is_measure"] is True


def test_category_hint_category_dimension():
    r = classify_column("random_dim", inferred_dtype="TEXT", category_hint="category")
    assert r["is_dimension"] is True


# ─── Dtype fallback ───────────────────────────────────────────────────────────


def test_numeric_fallback_measure():
    r = classify_column("unknown_numeric", inferred_dtype="NUMERIC")
    assert r["is_measure"] is True
    assert r["reason"] == "dtype_fallback_numeric"


def test_text_fallback_dimension():
    r = classify_column("unknown_text", inferred_dtype="TEXT")
    assert r["is_dimension"] is True


def test_empty_input_defaults_dimension():
    r = classify_column("", inferred_dtype=None)
    assert r["is_dimension"] is True


# ─── Dedup ────────────────────────────────────────────────────────────────────


def test_dedupe_basic():
    assert dedupe_column_names(["金额", "数量", "金额"]) == ["金额", "数量", "金额_2"]


def test_dedupe_triple():
    assert dedupe_column_names(["金额", "金额", "金额"]) == ["金额", "金额_2", "金额_3"]


def test_dedupe_no_duplicates_unchanged():
    cols = ["门店", "日期", "销售额"]
    assert dedupe_column_names(cols) == cols


def test_dedupe_empty_list():
    assert dedupe_column_names([]) == []


def test_dedupe_preserves_order():
    cols = ["A", "B", "A", "C", "B", "A"]
    assert dedupe_column_names(cols) == ["A", "B", "A_2", "C", "B_2", "A_3"]


# ─── Finders ──────────────────────────────────────────────────────────────────


def test_find_time_column():
    cls = [
        classify_column("门店", "TEXT"),
        classify_column("营业日期", "TEXT"),
        classify_column("销售额", "NUMERIC"),
    ]
    assert find_time_column(cls) == "营业日期"


def test_find_category_column_skips_time():
    cls = [
        classify_column("营业日期", "TEXT"),  # time
        classify_column("门店", "TEXT"),       # first dimension
        classify_column("销售额", "NUMERIC"),
    ]
    assert find_category_column(cls) == "门店"


def test_find_time_column_none_when_no_time():
    cls = [classify_column("门店", "TEXT"), classify_column("额", "NUMERIC")]
    assert find_time_column(cls) is None
