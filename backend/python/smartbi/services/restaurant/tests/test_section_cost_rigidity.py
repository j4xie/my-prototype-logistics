"""Cost rigidity section handler test."""
from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.cost_rigidity import CostRigidityHandler


def test_cost_rigidity_deng_zong_scenario():
    """鼎鲜火锅 2026-02 真实数据: 营收 -47.43%, 人工 -26.60% -> 刚性 0.561"""
    handler = CostRigidityHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id="u-test",
        sub_sector="火锅",
        params={
            "financial_data": {
                "current": {"revenue": 731048, "labor_cost": 237660},
                "previous": {"revenue": 1390503, "labor_cost": 323805},
            }
        },
    )
    response = handler.compute(req, context={})

    assert response.status == SectionStatus.OK
    assert response.section_name == "cost_rigidity"
    assert abs(response.data["costRigidity"] - 0.561) < 0.01
    assert response.data["revenueChangePct"] < 0
    assert response.data["laborChangePct"] < 0
    assert response.data["severity"] == "critical"


def test_cost_rigidity_skipped_when_no_previous():
    handler = CostRigidityHandler()
    req = SectionRequest(
        factory_id="F001", upload_id="u1", sub_sector="火锅",
        params={"financial_data": {"current": {"revenue": 100, "labor_cost": 30}}},
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("previous" in w.lower() for w in response.warnings)


def test_cost_rigidity_missing_financial_data():
    handler = CostRigidityHandler()
    req = SectionRequest(factory_id="F001", upload_id="u1", sub_sector="火锅", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED


def test_cost_rigidity_skipped_when_growth():
    """Growth scenario: cost_rigidity is meaningless when revenue grew."""
    handler = CostRigidityHandler()
    req = SectionRequest(
        factory_id="F001", upload_id="u1", sub_sector="火锅",
        params={
            "financial_data": {
                "current": {"revenue": 1500000, "labor_cost": 330000},
                "previous": {"revenue": 1390503, "labor_cost": 323805},
            }
        },
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("衰退" in w or "meaningful" in w.lower() for w in response.warnings)


def test_cost_rigidity_skipped_when_flat_revenue():
    """Flat revenue (within ±5%): skipped."""
    handler = CostRigidityHandler()
    req = SectionRequest(
        factory_id="F001", upload_id="u1", sub_sector="火锅",
        params={
            "financial_data": {
                "current": {"revenue": 1400000, "labor_cost": 310000},
                "previous": {"revenue": 1390503, "labor_cost": 323805},
            }
        },
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED


def test_cost_rigidity_skipped_when_labor_prev_zero():
    """previous.labor_cost == 0 → SKIPPED (cannot compute ratio)."""
    handler = CostRigidityHandler()
    req = SectionRequest(
        factory_id="F001", upload_id="u1", sub_sector="火锅",
        params={
            "financial_data": {
                "current": {"revenue": 500000, "labor_cost": 100000},
                "previous": {"revenue": 1000000, "labor_cost": 0},
            }
        },
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("labor_cost" in w for w in response.warnings)


def test_cost_rigidity_data_has_all_camelcase_keys():
    """Reference pattern: lock in the 8 data keys + timing field."""
    handler = CostRigidityHandler()
    req = SectionRequest(
        factory_id="F001", upload_id="u1", sub_sector="火锅",
        params={
            "financial_data": {
                "current": {"revenue": 731048, "labor_cost": 237660},
                "previous": {"revenue": 1390503, "labor_cost": 323805},
            }
        },
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.OK
    expected_keys = {
        "costRigidity", "revenueChangePct", "laborChangePct",
        "healthyThreshold", "severity", "formulaZh",
        "annualizedImpact", "descriptionZh",
    }
    assert set(response.data.keys()) == expected_keys
    assert response.computed_at_ms >= 0
    assert response.cache_key == "cost_rigidity:F001:u1:current"
