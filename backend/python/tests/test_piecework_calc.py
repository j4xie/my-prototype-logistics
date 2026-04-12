"""Piecework calc: compute commission for hostess (individual) and teams."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.piecework_calc import PieceworkCalcHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_hostess_individual():
    resp = PieceworkCalcHandler().compute(
        _req({"roles": [
            {"role": "迎宾", "calc_mode": "INDIVIDUAL", "base_threshold": 2000,
             "base_salary": 5000, "per_unit_bonus": 3.0, "actual_units": 2500}
        ]}), {})
    assert resp.status.value == "ok"
    h = resp.data["role_results"][0]
    assert h["role"] == "迎宾"
    assert h["base_earned"] == 5000
    assert h["bonus"] == 1500  # (2500-2000)*3
    assert h["total"] == 6500

def test_team_split():
    resp = PieceworkCalcHandler().compute(
        _req({"roles": [
            {"role": "服务组", "calc_mode": "TEAM", "base_threshold": 3000,
             "base_salary": 15000, "per_unit_bonus": 2.0, "actual_units": 4000,
             "team_size": 3}
        ]}), {})
    team = resp.data["role_results"][0]
    assert team["total_pool"] == 17000  # 15000 + (4000-3000)*2
    assert team["per_person"] == 5667  # 17000/3 rounded

def test_below_threshold():
    resp = PieceworkCalcHandler().compute(
        _req({"roles": [
            {"role": "迎宾", "calc_mode": "INDIVIDUAL", "base_threshold": 2000,
             "base_salary": 5000, "per_unit_bonus": 3.0, "actual_units": 1500}
        ]}), {})
    h = resp.data["role_results"][0]
    assert h["bonus"] == 0
    assert h["total"] == 5000  # still gets base

def test_skipped_no_roles():
    resp = PieceworkCalcHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
