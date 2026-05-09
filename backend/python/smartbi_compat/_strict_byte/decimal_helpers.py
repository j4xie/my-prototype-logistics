"""Decimal helpers preserving Java BigDecimal scale.

Mirrors Java BigDecimal.toPlainString() — preserves trailing zeros, never
emits scientific notation. For strict-byte gate only; Phase 2A dict-eq
endpoints continue to use ``_decimal_to_number`` (analysis_finance.py).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional


def _decimal_preserve_scale(v: Optional[Decimal]) -> str:
    """Convert Decimal to JSON-safe string preserving Java BigDecimal scale.

    Java emits scale-preserved numerics via Jackson + BigDecimal:
        BigDecimal("100.00")  → JSON  100.00   (scale 2 preserved)
        BigDecimal("0.00")    → JSON  0.00     (scale 2 preserved)
        BigDecimal("99.9900") → JSON  99.9900  (scale 4 preserved)
        BigDecimal("1E+10")   → JSON  10000000000  (no scientific notation)

    Phase 2A ``_decimal_to_number`` collapses to int/float (Pattern A /
    Pattern A2 dict-eq tolerance). This helper is the strict-byte sibling.

    None → "null" (caller emits as JSON literal null).

    Note: returns str — not Decimal. Strict-byte response assembly happens
    at the bytes layer (custom emitter, not standard json.dumps), so
    callers concatenate this string directly into the response body.
    """
    if v is None:
        return "null"
    # Decimal.to_eng_string() preserves scale and avoids scientific notation
    # for the magnitudes Phase 2A handles. For Decimal("1E+10") the output
    # is "1E+10" via to_eng_string; we normalize that to plain digits below.
    plain = format(v, "f")
    return plain
