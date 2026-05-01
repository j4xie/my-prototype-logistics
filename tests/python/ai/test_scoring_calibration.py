"""Confidence calibration with cold-start passthrough (β C4, R-IM2 fix)."""
from __future__ import annotations
import pytest


def test_calibration_passthrough_when_coefs_empty():
    """No coefficients → returns raw confidence unchanged."""
    from ai.scoring.calibration import Calibrator
    cal = Calibrator(coefs={})
    assert cal.calibrate(raw=0.85, matcher="SEMANTIC", factory_id="F001") == 0.85
    assert cal.calibrate(raw=0.5, matcher="LLM", factory_id="F001") == 0.5
    assert cal.calibrate(raw=0.0, matcher="X", factory_id="F") == 0.0
    assert cal.calibrate(raw=1.0, matcher="X", factory_id="F") == 1.0


def test_calibration_applies_sigmoid_when_coefs_present():
    """Coefficients present → sigmoid(α·raw + β)."""
    import math
    from ai.scoring.calibration import Calibrator
    coefs = {("SEMANTIC", "F001"): (2.0, -1.0)}
    cal = Calibrator(coefs=coefs)
    expected = 1 / (1 + math.exp(-(2.0 * 0.85 + (-1.0))))
    actual = cal.calibrate(raw=0.85, matcher="SEMANTIC", factory_id="F001")
    assert abs(actual - expected) < 0.001


def test_calibration_falls_back_to_passthrough_for_unknown_matcher():
    """Coef key not found → passthrough."""
    from ai.scoring.calibration import Calibrator
    coefs = {("SEMANTIC", "F001"): (2.0, -1.0)}
    cal = Calibrator(coefs=coefs)
    assert cal.calibrate(raw=0.5, matcher="LLM", factory_id="F001") == 0.5
    assert cal.calibrate(raw=0.5, matcher="SEMANTIC", factory_id="F002") == 0.5
