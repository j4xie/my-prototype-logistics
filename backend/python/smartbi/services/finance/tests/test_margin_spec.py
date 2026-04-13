"""Unit tests for MarginSpec (P3.5A QW3).

MarginSpec encodes 4 ambiguous P&L boundary decisions as config flags
with sensible defaults. This tests the data model — downstream consumer
integration is in Phase 3.5B F1-F3.
"""
import pytest

from smartbi.services.finance.margin_spec import (
    MarginCalcMode,
    MarginSpec,
    StoredValueTreatment,
)


def test_default_margin_spec_is_sensible():
    """Defaults match common餐饮 practice — no customer input required."""
    spec = MarginSpec()
    assert spec.include_staff_meal_in_cogs is True
    assert spec.include_gas_in_cogs is True
    assert spec.stored_value_treatment == StoredValueTreatment.PREPAID
    assert spec.include_investment_in_opex is False
    assert spec.margin_calc_mode == MarginCalcMode.BOTH
    assert spec.primary_margin_display == "UNFOLDED"


def test_margin_spec_from_dict_roundtrip():
    """Factory config JSON ↔ MarginSpec model roundtrip."""
    original = {
        "includeStaffMealInCogs": False,
        "includeGasInCogs": True,
        "storedValueTreatment": "REVENUE",
        "includeInvestmentInOpex": False,
        "marginCalcMode": "FOLDED",
        "primaryMarginDisplay": "FOLDED",
    }
    spec = MarginSpec.from_dict(original)
    assert spec.include_staff_meal_in_cogs is False
    assert spec.stored_value_treatment == StoredValueTreatment.REVENUE
    assert spec.margin_calc_mode == MarginCalcMode.FOLDED
    # Roundtrip preserves all fields
    assert spec.to_dict() == original


def test_margin_spec_missing_keys_uses_defaults():
    """Backward compat: empty factory config still works."""
    spec = MarginSpec.from_dict({})
    assert spec.include_staff_meal_in_cogs is True  # default


def test_margin_spec_invalid_treatment_raises():
    """Unknown storedValueTreatment surfaces an explicit error."""
    with pytest.raises(ValueError, match="Unknown stored value treatment"):
        MarginSpec.from_dict({"storedValueTreatment": "NOT_A_REAL_VALUE"})


def test_margin_spec_invalid_calc_mode_raises():
    """Unknown marginCalcMode surfaces an explicit error."""
    with pytest.raises(ValueError, match="Unknown margin calc mode"):
        MarginSpec.from_dict({"marginCalcMode": "WEIRD_MODE"})


def test_three_stored_value_treatment_modes_all_exist():
    """All 3 modes must be implemented as enum values (G2 commitment)."""
    assert StoredValueTreatment.PREPAID.value == "PREPAID"
    assert StoredValueTreatment.REVENUE.value == "REVENUE"
    assert StoredValueTreatment.EXCLUDED.value == "EXCLUDED"


def test_three_margin_calc_modes_all_exist():
    """FOLDED / UNFOLDED / BOTH must all be reachable."""
    assert MarginCalcMode.FOLDED.value == "FOLDED"
    assert MarginCalcMode.UNFOLDED.value == "UNFOLDED"
    assert MarginCalcMode.BOTH.value == "BOTH"
