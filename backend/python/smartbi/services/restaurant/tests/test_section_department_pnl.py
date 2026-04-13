"""Unit tests for department_pnl section handler (P3.5D P1)."""
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.department_pnl import DepartmentPnlHandler


def test_department_pnl_aggregates_hotpot_tree():
    """Hotpot scenario: 6 departments across 后厨/前厅/后勤."""
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={
            "department_tree_id": "hotpot_default",
            "labor_by_department": {
                "热菜": 80000,
                "冷菜": 40000,
                "明档": 60000,
                "前厅服务员": 50000,
                "收银酒水": 15000,
                "店总": 12000,
            },
            "head_count_by_department": {
                "热菜": 8,
                "冷菜": 4,
                "明档": 4,
                "前厅服务员": 15,
                "收银酒水": 3,
                "店总": 1,
            },
            "revenue": 731048,
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK

    # Per-leaf breakdown
    breakdown = resp.data["departments"]
    assert len(breakdown) == 6

    # Aggregation: 后厨 = 热菜 + 冷菜 + 明档 = 180000
    agg = resp.data["aggregated"]
    assert agg["后厨"] == 180000

    # Per-head productivity for 热菜
    hot_dept = next(d for d in breakdown if d["code"] == "热菜")
    assert hot_dept["headCount"] == 8
    assert hot_dept["laborCost"] == 80000
    assert hot_dept["perHeadCost"] == pytest.approx(10000, rel=0.01)
    assert hot_dept["laborShare"] == pytest.approx(80000 / 257000, rel=0.01)
    assert hot_dept["revenueShare"] == pytest.approx(80000 / 731048, rel=0.01)

    # Total labor + labor/revenue ratio
    assert resp.data["totalLaborCost"] == 257000
    assert resp.data["laborRevenueRatio"] == pytest.approx(257000 / 731048, rel=0.01)


def test_department_pnl_bakery_tree_proves_universality():
    """Bakery — proves universal cuisine support."""
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-BAKERY-TEST",
        upload_id=None,
        sub_sector="面包房",
        params={
            "department_tree_id": "bakery_default",
            "labor_by_department": {
                "烘焙间": 30000,
                "面包房": 25000,
                "门店销售": 40000,
            },
            "revenue": 200000,
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    agg = resp.data["aggregated"]
    # 生产 = 烘焙间 + 面包房 = 55000
    assert agg["生产"] == 55000
    # 销售 includes 门店销售 (40000) + others
    assert agg["销售"] >= 40000


def test_department_pnl_default_tree_id_is_hotpot():
    """Missing tree_id → default hotpot_default."""
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={"labor_by_department": {"热菜": 10000}},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    assert resp.data["treeId"] == "hotpot_default"


def test_department_pnl_unknown_tree_id_skipped():
    """Unknown tree_id → SKIPPED with warning."""
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            "department_tree_id": "nonexistent_tree_xyz",
            "labor_by_department": {"热菜": 10000},
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED


def test_department_pnl_skipped_without_labor_data():
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED


def test_department_pnl_zero_head_count_omits_per_head_cost():
    """When headCount is 0 or missing, perHeadCost is None (no divide-by-zero)."""
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            "department_tree_id": "hotpot_default",
            "labor_by_department": {"厨部临时工": 15000},
            "head_count_by_department": {},  # no head count
            "revenue": 100000,
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    dept = next(d for d in resp.data["departments"] if d["code"] == "厨部临时工")
    assert dept["perHeadCost"] is None


def test_department_pnl_section_registered_in_router():
    """Regression: handler must be in HANDLERS dict."""
    from smartbi.api.restaurant_sections import HANDLERS
    assert "department_pnl" in HANDLERS
    assert HANDLERS["department_pnl"].section_name == "department_pnl"
