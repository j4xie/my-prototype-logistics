from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.seat_occupancy import SeatOccupancyHandler


def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)


def test_basic_occupancy():
    resp = SeatOccupancyHandler().compute(
        _req({"seat_layout": {"2人位": 5, "4人位": 10, "6人位": 3, "8人位": 2},
              "party_distribution": {"1人": 20, "2人": 150, "3人": 40, "4人": 60, "5人": 15, "6人": 10, "8人": 5}}), {})
    assert resp.status.value == "ok"
    assert len(resp.data["seat_analysis"]) == 4
    assert "recommendations" in resp.data


def test_recommends_more_2_seaters():
    resp = SeatOccupancyHandler().compute(
        _req({"seat_layout": {"2人位": 2, "4人位": 15},
              "party_distribution": {"1人": 50, "2人": 200, "3人": 10, "4人": 20}}), {})
    assert resp.status.value == "ok"
    assert any("2人位" in r for r in resp.data["recommendations"])


def test_skipped_no_layout():
    resp = SeatOccupancyHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
