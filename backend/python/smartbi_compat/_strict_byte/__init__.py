"""Strict-byte parity gate primitives — Phase 1 Week 1 foundation.

Per PR #159 P1 impl plan + PR #154 strict-byte test infra spec.

Phase 2A standardized on dict-eq parity (numeric `0` ≡ `0.0` ≡ `0.00`
tolerated per python-java-port.md Rule 4). Phase 2B Tier 3 Upload
binary-fidelity contracts and Phase 3+ frontend hash-compare scenarios
will require strict-byte byte-level equality. This package provides the
foundation primitives for that opt-in gate.

Default mode for existing tests stays dict-eq — strict-byte is opt-in
via `@pytest.mark.strict_byte` annotation (Week 3 deliverable). Helpers
here live in a new module so Phase 2A test infra is unaffected.
"""

from smartbi_compat._strict_byte.decimal_helpers import _decimal_preserve_scale
from smartbi_compat._strict_byte.dispatcher import assert_response_eq
from smartbi_compat._strict_byte.strict_diff import (
    StrictDiff,
    _strict_compare_response,
)

__all__ = [
    "StrictDiff",
    "_decimal_preserve_scale",
    "_strict_compare_response",
    "assert_response_eq",
]
