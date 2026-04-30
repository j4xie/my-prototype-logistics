"""Task A4: Tests for smartbi_compat.alert_thresholds loader.

Mirrors Java RecommendationServiceImpl.loadAlertThresholds expectations:
- Bundled JSON read at smartbi_compat/config/alert_thresholds.json
- Falls back to Java defaults (line 65-79) when file missing/invalid
- Decimal dataclasses preserve scale; aging_days uses int.
"""
from decimal import Decimal

from smartbi_compat.alert_thresholds import (
    ALERT_SEVERITY,
    DepartmentThresholds,
    FinanceThresholds,
    SalesThresholds,
    load_thresholds,
)


def test_load_thresholds_from_bundled_json():
    t = load_thresholds()
    assert t.sales.completion_red == Decimal("60")
    assert t.sales.completion_yellow == Decimal("80")
    assert t.sales.growth_red == Decimal("-20")
    assert t.sales.growth_yellow == Decimal("-10")
    assert t.finance.aging_red == 90
    assert t.finance.aging_yellow == 60
    assert t.finance.cost_variance_red == Decimal("20")
    assert t.finance.cost_variance_yellow == Decimal("10")
    assert t.finance.amount_red == Decimal("1000000")
    assert t.finance.amount_yellow == Decimal("500000")
    assert t.department.per_capita_red == Decimal("50000")
    assert t.department.per_capita_yellow == Decimal("80000")


def test_load_thresholds_falls_back_to_defaults_when_file_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "smartbi_compat.alert_thresholds._JSON_PATH",
        tmp_path / "missing.json",
    )
    t = load_thresholds()
    assert t.sales.completion_red == Decimal("60")
    assert t.sales.growth_red == Decimal("-20")
    assert t.finance.aging_red == 90
    assert t.department.per_capita_red == Decimal("50000")


def test_alert_severity_constants():
    assert ALERT_SEVERITY == {"GREEN": 0, "YELLOW": 1, "RED": 2, "CRITICAL": 3}


def test_threshold_dataclasses_are_frozen():
    """Frozen dataclasses prevent accidental mutation of loaded thresholds."""
    s = SalesThresholds(
        completion_red=Decimal("60"),
        completion_yellow=Decimal("80"),
        growth_red=Decimal("-20"),
        growth_yellow=Decimal("-10"),
    )
    import dataclasses
    try:
        s.completion_red = Decimal("50")
        raised = False
    except dataclasses.FrozenInstanceError:
        raised = True
    assert raised, "SalesThresholds should be frozen"
