"""Unit tests for DepartmentTree (P3.5A QW5)."""
from pathlib import Path

import pytest

from smartbi.services.reporting.department_tree import (
    DepartmentNode,
    DepartmentTree,
    load_dept_tree_from_yaml,
)


def test_dept_tree_basic_hierarchy():
    tree = DepartmentTree()
    tree.add(DepartmentNode(code="酒店", name_zh="酒店总部", parent_code=None, head_count_target=None))
    tree.add(DepartmentNode(code="后厨", name_zh="后厨", parent_code="酒店", head_count_target=30))
    tree.add(DepartmentNode(code="热菜", name_zh="热菜档", parent_code="后厨", head_count_target=8))
    tree.add(DepartmentNode(code="冷菜", name_zh="冷菜档", parent_code="后厨", head_count_target=4))

    children = tree.get_children("后厨")
    child_codes = {c.code for c in children}
    assert child_codes == {"热菜", "冷菜"}

    # Leaf detection
    assert tree.is_leaf("热菜") is True
    assert tree.is_leaf("后厨") is False
    assert tree.is_leaf("酒店") is False


def test_dept_tree_aggregates_labor_cost():
    """Given per-leaf labor cost, parent aggregates up the tree."""
    tree = DepartmentTree()
    for node in [
        DepartmentNode(code="酒店", name_zh="酒店", parent_code=None),
        DepartmentNode(code="后厨", name_zh="后厨", parent_code="酒店"),
        DepartmentNode(code="热菜", name_zh="热菜", parent_code="后厨"),
        DepartmentNode(code="冷菜", name_zh="冷菜", parent_code="后厨"),
    ]:
        tree.add(node)

    values = {"热菜": 80000, "冷菜": 40000}
    agg = tree.aggregate(values)
    assert agg["热菜"] == 80000  # leaf unchanged
    assert agg["冷菜"] == 40000
    assert agg["后厨"] == 120000  # sum of children
    assert agg["酒店"] == 120000  # root sums everything


def test_dept_tree_multi_level():
    """3-level tree: 酒店 → 后厨 → 热菜/冷菜 + 前厅 → 服务员/收银"""
    tree = DepartmentTree()
    for node in [
        DepartmentNode(code="酒店", name_zh="酒店", parent_code=None),
        DepartmentNode(code="后厨", name_zh="后厨", parent_code="酒店"),
        DepartmentNode(code="热菜", name_zh="热菜", parent_code="后厨"),
        DepartmentNode(code="冷菜", name_zh="冷菜", parent_code="后厨"),
        DepartmentNode(code="前厅", name_zh="前厅", parent_code="酒店"),
        DepartmentNode(code="服务员", name_zh="服务员", parent_code="前厅"),
        DepartmentNode(code="收银", name_zh="收银", parent_code="前厅"),
    ]:
        tree.add(node)

    values = {"热菜": 80, "冷菜": 40, "服务员": 50, "收银": 15}
    agg = tree.aggregate(values)
    assert agg["后厨"] == 120
    assert agg["前厅"] == 65
    assert agg["酒店"] == 185


def test_dept_tree_duplicate_code_raises():
    tree = DepartmentTree()
    tree.add(DepartmentNode(code="热菜", name_zh="热菜", parent_code="后厨"))
    with pytest.raises(ValueError, match="Duplicate"):
        tree.add(DepartmentNode(code="热菜", name_zh="another", parent_code="other"))


def test_load_hotpot_default():
    """Hotpot default YAML covers typical 火锅 department layout."""
    path = (
        Path(__file__).parents[3]
        / "knowledge"
        / "restaurant"
        / "department_tree"
        / "hotpot_default.yaml"
    )
    tree = load_dept_tree_from_yaml(path)
    codes = set(tree.nodes.keys())
    # Core departments
    for expected in ["前厅", "后厨", "热菜", "冷菜", "明档", "财务", "店总"]:
        assert expected in codes, f"Missing hotpot dept: {expected}"


def test_load_bakery_default_different_structure():
    """Bakery tree has different structure than hotpot — proves universality."""
    path = (
        Path(__file__).parents[3]
        / "knowledge"
        / "restaurant"
        / "department_tree"
        / "bakery_default.yaml"
    )
    tree = load_dept_tree_from_yaml(path)
    codes = set(tree.nodes.keys())
    # Bakery-specific departments (烘焙间 is bakery-only)
    assert "烘焙间" in codes
    assert "门店销售" in codes
