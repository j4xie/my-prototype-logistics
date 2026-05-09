"""Unit tests for expense_breakdown section handler (P3.5B F6)."""

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.expense_breakdown import (
    ExpenseBreakdownHandler,
)


def test_expense_breakdown_aggregates_hotpot_tree():
    """Aggregate leaf values to tree parents + rank top N."""
    h = ExpenseBreakdownHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={
            "expense_account_tree_id": "hotpot_default",
            "expense_leaf_values": {
                "工资": 237660,
                "奖金": 0,
                "房租费": 85000,
                "充卡赠送": 51680.61,
                "水费": 3200,
                "电费": 8500,
                "柴油": 2100,
                "广告宣传活动费": 1500,
            },
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK

    agg = resp.data["aggregated"]
    # 人力成本 = 工资 + 奖金 = 237660 + 0 = 237660
    assert agg["人力成本"] == 237660
    # 水电费 = 水费 + 电费 + 柴油 = 3200 + 8500 + 2100 = 13800
    assert agg["水电费"] == 13800
    # 场地费用 includes 房租费 (85000) + others (may be 0)
    assert agg["场地费用"] >= 85000

    # Top accounts ranked desc
    top = resp.data["topAccounts"]
    assert len(top) > 0
    assert top[0]["code"] == "工资"  # largest leaf
    assert top[0]["value"] == 237660


def test_expense_breakdown_default_tree_id_is_hotpot():
    """Missing tree_id param defaults to 'hotpot_default' (most common use)."""
    h = ExpenseBreakdownHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            # No expense_account_tree_id — should default
            "expense_leaf_values": {"工资": 100000},
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    assert resp.data["treeId"] == "hotpot_default"


def test_expense_breakdown_empty_values_returns_zeros():
    h = ExpenseBreakdownHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            "expense_account_tree_id": "default",  # 5-bucket fallback
            "expense_leaf_values": {},
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    # All leaves default to 0
    agg = resp.data["aggregated"]
    assert agg.get("food_cost", 0) == 0
    assert agg.get("labor_cost", 0) == 0


def test_expense_breakdown_unknown_tree_id_skipped():
    h = ExpenseBreakdownHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            "expense_account_tree_id": "nonexistent_tree_zzz",
            "expense_leaf_values": {"工资": 100},
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED


def test_expense_breakdown_router_registration():
    """F7 regression: handler must be in the router's HANDLERS dict."""
    from smartbi.api.restaurant_sections import HANDLERS
    assert "expense_breakdown" in HANDLERS
    assert HANDLERS["expense_breakdown"].section_name == "expense_breakdown"
