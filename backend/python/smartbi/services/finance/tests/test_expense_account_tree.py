"""Unit tests for ExpenseAccountTree (P3.5A QW4)."""
from pathlib import Path

import pytest

from smartbi.services.finance.expense_account_tree import (
    ExpenseAccountNode,
    ExpenseAccountTree,
    load_tree_from_yaml,
)


def test_tree_aggregates_single_level():
    """人力成本 → [工资, 奖金, 福利费], sum = parent value."""
    tree = ExpenseAccountTree()
    tree.add(ExpenseAccountNode(code="人力成本", name_zh="人力成本", parent_code=None))
    tree.add(ExpenseAccountNode(code="工资", name_zh="工资", parent_code="人力成本"))
    tree.add(ExpenseAccountNode(code="奖金", name_zh="奖金", parent_code="人力成本"))
    tree.add(ExpenseAccountNode(code="福利费", name_zh="福利费", parent_code="人力成本"))

    values = {"工资": 237660, "奖金": 15000, "福利费": 5000}
    agg = tree.aggregate(values)

    assert agg["工资"] == 237660     # leaf preserved
    assert agg["奖金"] == 15000
    assert agg["福利费"] == 5000
    assert agg["人力成本"] == 237660 + 15000 + 5000


def test_tree_aggregates_multi_level():
    """3-level: 总费用 → [营业费用 → [工资, 奖金], 财务费用 → 手续费]."""
    tree = ExpenseAccountTree()
    for node in [
        ExpenseAccountNode(code="总费用", name_zh="总费用", parent_code=None),
        ExpenseAccountNode(code="营业费用", name_zh="营业费用", parent_code="总费用"),
        ExpenseAccountNode(code="工资", name_zh="工资", parent_code="营业费用"),
        ExpenseAccountNode(code="奖金", name_zh="奖金", parent_code="营业费用"),
        ExpenseAccountNode(code="财务费用", name_zh="财务费用", parent_code="总费用"),
        ExpenseAccountNode(code="手续费", name_zh="手续费", parent_code="财务费用"),
    ]:
        tree.add(node)

    values = {"工资": 100, "奖金": 20, "手续费": 30}
    agg = tree.aggregate(values)

    assert agg["营业费用"] == 120
    assert agg["财务费用"] == 30
    assert agg["总费用"] == 150


def test_tree_is_leaf_check():
    """is_leaf returns True for nodes with no children."""
    tree = ExpenseAccountTree()
    tree.add(ExpenseAccountNode(code="人力成本", name_zh="人力成本", parent_code=None))
    tree.add(ExpenseAccountNode(code="工资", name_zh="工资", parent_code="人力成本"))

    assert tree.is_leaf("工资") is True
    assert tree.is_leaf("人力成本") is False


def test_duplicate_node_raises():
    tree = ExpenseAccountTree()
    tree.add(ExpenseAccountNode(code="工资", name_zh="工资", parent_code="人力成本"))
    with pytest.raises(ValueError, match="Duplicate"):
        tree.add(ExpenseAccountNode(code="工资", name_zh="different", parent_code="other"))


def test_load_hotpot_yaml_has_45_plus_leaves():
    """The shipped hotpot_default.yaml matches 鼎鲜 P&L structure with 45+ leaf subaccounts."""
    default_path = (
        Path(__file__).parents[3]
        / "knowledge"
        / "restaurant"
        / "expense_account_tree"
        / "hotpot_default.yaml"
    )
    assert default_path.exists(), f"Missing: {default_path}"

    tree = load_tree_from_yaml(default_path)
    leaves = [c for c in tree.nodes if tree.is_leaf(c)]
    assert len(leaves) >= 45, f"Expected ≥45 leaves, got {len(leaves)}"

    # Sanity: critical 鼎鲜 leaf accounts must be present
    codes = set(tree.nodes.keys())
    for expected in ["工资", "房租费", "充卡赠送", "水费", "电费", "柴油", "维修费", "广告宣传活动费"]:
        assert expected in codes, f"Missing expected account: {expected}"


def test_load_default_yaml_has_5_buckets():
    """The shipped default.yaml is the legacy 5-bucket fallback."""
    default_path = (
        Path(__file__).parents[3]
        / "knowledge"
        / "restaurant"
        / "expense_account_tree"
        / "default.yaml"
    )
    assert default_path.exists(), f"Missing: {default_path}"

    tree = load_tree_from_yaml(default_path)
    codes = set(tree.nodes.keys())
    # 5-bucket legacy schema
    for expected in ["food_cost", "labor_cost", "rent", "other_cost", "net_profit"]:
        assert expected in codes, f"Missing legacy bucket: {expected}"


def test_load_yaml_invalid_structure_raises(tmp_path):
    bad_yaml = tmp_path / "bad.yaml"
    bad_yaml.write_text("just_a_string_not_dict")
    with pytest.raises(ValueError, match="Invalid YAML"):
        load_tree_from_yaml(bad_yaml)
