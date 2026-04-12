"""Shift analysis: evaluate staffing efficiency and full-time/part-time mix."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.shift_analysis import ShiftAnalysisHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_basic_analysis():
    resp = ShiftAnalysisHandler().compute(
        _req({
            "month_summary": {
                "full_time": {"count": 8, "total_hours": 1400, "total_cost": 48000},
                "part_time": {"count": 4, "total_hours": 320, "total_cost": 12800},
            },
            "revenue": 400000,
            "min_guaranteed_hours": 168,
        }), {})
    assert resp.status.value == "ok"
    d = resp.data
    assert d["total_headcount"] == 12
    assert d["full_time_ratio"] == 66.7  # 8/12
    assert d["part_time_hourly_cost"] == 40.0  # 12800/320
    assert d["labor_cost_pct"] > 0

def test_recommends_more_parttimers():
    resp = ShiftAnalysisHandler().compute(
        _req({
            "month_summary": {
                "full_time": {"count": 12, "total_hours": 2016, "total_cost": 72000},
                "part_time": {"count": 0, "total_hours": 0, "total_cost": 0},
            },
            "revenue": 360000,
        }), {})
    recs = resp.data["recommendations"]
    assert any("兼职" in r for r in recs)

def test_skipped_no_summary():
    resp = ShiftAnalysisHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
