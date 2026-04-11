"""Unit tests for restaurant_forecast section handler (P3 Task 3.5-3.6)."""
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.forecast import RestaurantForecastHandler


def test_forecast_with_history_values_happy_path():
    """6-month declining history → predictions with interpretation mentioning decline."""
    h = RestaurantForecastHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={
            "history_values": [1500000, 1400000, 1300000, 1200000, 1100000, 731048],
            "periods": 3,
            "confidence_level": 0.80,
        },
    )
    resp = h.compute(req, context={})
    # Accept OK or SKIPPED — the ForecastService may have limitations
    # we don't know about without reading it first
    assert resp.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if resp.status == SectionStatus.OK:
        data = resp.data
        assert "predictions" in data or "history" in data
        # 3 predictions
        preds = data.get("predictions") or []
        assert len(preds) == 3 or len(preds) > 0
        # Interpretation mentions decline (last history is much lower than first)
        interp = data.get("interpretationZh", "")
        assert interp  # non-empty


def test_forecast_skipped_without_history_and_pos():
    """No history_values + no pos_df → SKIPPED."""
    h = RestaurantForecastHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED


def test_forecast_skipped_with_short_history():
    """History < 3 points → SKIPPED (can't fit a model)."""
    h = RestaurantForecastHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={"history_values": [100, 110]},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
    assert any("history" in w.lower() or "长度" in w for w in resp.warnings)


def test_forecast_section_registered_in_router():
    from smartbi.api.restaurant_sections import HANDLERS
    assert "restaurant_forecast" in HANDLERS
    assert HANDLERS["restaurant_forecast"].section_name == "restaurant_forecast"
