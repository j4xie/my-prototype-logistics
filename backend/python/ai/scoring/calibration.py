"""Per-stage confidence calibration (β C4).

Cold-start: empty coefs table → passthrough (calibrated == raw). NOT sigmoid by
default — that would break α tests that compare confidence values directly.

When prod data accumulates (1 week+), coefficients can be fitted offline and
INSERT into intent_calibration_coeffs table. Python loads on startup + 5min refresh.
Sigmoid scales raw confidence per (matcher, factory_id) tuple to a normalized 0-1.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, Tuple


@dataclass
class Calibrator:
    """coefs: {(matcher_name, factory_id): (alpha, beta)}.
    Empty → passthrough mode (cold-start safe, R-IM2 fix)."""

    coefs: Dict[Tuple[str, str], Tuple[float, float]]

    def calibrate(self, raw: float, matcher: str, factory_id: str) -> float:
        """Return calibrated confidence in [0, 1]. Cold-start: returns raw."""
        key = (matcher, factory_id)
        if key not in self.coefs:
            return raw  # passthrough
        alpha, beta = self.coefs[key]
        return 1.0 / (1.0 + math.exp(-(alpha * raw + beta)))
