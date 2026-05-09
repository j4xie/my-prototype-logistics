"""Shared fixtures for smartbi_compat tests."""
import sys
import pathlib

import pytest

# parents[3] = project root (conftest.py -> smartbi_compat -> python -> tests -> project root)
_PY_ROOT = pathlib.Path(__file__).resolve().parents[3] / "backend" / "python"
if str(_PY_ROOT) not in sys.path:
    sys.path.insert(0, str(_PY_ROOT))


def pytest_configure(config):
    """Register byte-shape parity markers.

    Phase 2A standardized on dict-eq parity (numeric ``0`` ≡ ``0.0`` ≡ ``0.00``
    tolerated per python-java-port.md Rule 4). Tests targeting strict-byte
    parity (Phase 2B Tier 3 Upload envelopes / Tier 2 SSE chunks / Phase 3+
    frontend hash-compare) opt in via ``@pytest.mark.strict_byte``.

    See docs/superpowers/specs/2026-05-15-strict-byte-gate-test-infrastructure-spec.md
    """
    config.addinivalue_line(
        "markers",
        "strict_byte: test compares raw response bytes (strict gate). "
        "Requires .json.bytes golden file recorded via "
        "scripts/record-java-golden.sh --strict-byte.",
    )
    config.addinivalue_line(
        "markers",
        "dict_eq: test compares parsed dict equality (default Phase 2A gate). "
        "Tolerates Pattern A/A2 numeric collapse per python-java-port.md Rule 4.",
    )


@pytest.fixture
def comparator_mode(request):
    """Resolve the byte-shape comparator gate from the test's markers.

    Returns ``"strict_byte"`` if ``@pytest.mark.strict_byte`` is set on the
    test, else ``"dict_eq"`` (the Phase 2A default — applies even without an
    explicit ``@pytest.mark.dict_eq``).
    """
    if request.node.get_closest_marker("strict_byte"):
        return "strict_byte"
    return "dict_eq"
