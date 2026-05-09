"""Week 2 integration tests — wires Chat F dispatcher + Chat G marker fixture.

Validates the end-to-end chain:

    @pytest.mark.strict_byte                                      ← Chat G marker (PR #192)
        ↓
    comparator_mode fixture → "strict_byte"                       ← Chat G fixture (PR #192)
        ↓
    assert_response_match (mode-bound wrapper)                    ← Week 2 (this PR)
        ↓
    smartbi_compat._strict_byte.assert_response_eq(mode=...)      ← Chat F dispatcher (PR #194)
        ↓
    _strict_compare_response | dict-eq strip-and-equal             ← Chat F comparator (PR #194)

These tests do NOT hit live Java; they use byte literals and dict literals
to exercise the wiring. The pilot test in
``test_strict_byte_alerts_pilot.py`` exercises the full chain against a
recorded ``.json.bytes`` golden + Python production /alerts endpoint.

Phase 2A dict-eq gate is the default — every existing test stays unchanged.
strict-byte is opt-in per ``@pytest.mark.strict_byte`` annotation.
"""
from __future__ import annotations

import pytest


# ─── Marker fixture wiring ─────────────────────────────────────────────────────


def test_comparator_mode_defaults_to_dict_eq(comparator_mode: str) -> None:
    """No marker → fixture returns 'dict_eq' (Phase 2A default per PR #192)."""
    assert comparator_mode == "dict_eq"


@pytest.mark.dict_eq
def test_comparator_mode_explicit_dict_eq_marker(comparator_mode: str) -> None:
    """Explicit @pytest.mark.dict_eq → fixture returns 'dict_eq'."""
    assert comparator_mode == "dict_eq"


@pytest.mark.strict_byte
def test_comparator_mode_strict_byte_marker(comparator_mode: str) -> None:
    """@pytest.mark.strict_byte → fixture returns 'strict_byte' (PR #192)."""
    assert comparator_mode == "strict_byte"


# ─── assert_response_match wrapper — dict_eq path ──────────────────────────────


def test_assert_response_match_dict_eq_passes_on_equal_dicts(assert_response_match) -> None:
    """Default mode passes on dict equality."""
    assert_response_match({"a": 1, "b": [1, 2, 3]}, {"a": 1, "b": [1, 2, 3]})


def test_assert_response_match_dict_eq_fails_on_diverging_dicts(assert_response_match) -> None:
    """Default mode raises AssertionError on divergence."""
    with pytest.raises(AssertionError, match="dict-eq divergence"):
        assert_response_match({"a": 1}, {"a": 2})


def test_assert_response_match_dict_eq_strips_default_volatile_keys(assert_response_match) -> None:
    """Default volatile_keys (timestamp / generatedAt / lastUpdated / cacheExpireAt) are stripped."""
    assert_response_match(
        {"data": [1, 2], "timestamp": "2026-05-09T10:00:00", "generatedAt": "2026-05-09T10:00:00"},
        {"data": [1, 2], "timestamp": "2026-05-09T11:30:00", "generatedAt": "2026-05-09T11:31:00"},
    )


def test_assert_response_match_dict_eq_custom_volatile_keys(assert_response_match) -> None:
    """Caller can extend volatile_keys (e.g. add request_id)."""
    assert_response_match(
        {"data": [1], "request_id": "abc"},
        {"data": [1], "request_id": "xyz"},
        volatile_keys=frozenset({"timestamp", "generatedAt", "lastUpdated", "cacheExpireAt", "request_id"}),
    )


# ─── assert_response_match wrapper — strict_byte path ──────────────────────────


@pytest.mark.strict_byte
def test_assert_response_match_strict_byte_passes_on_identical_bytes(assert_response_match) -> None:
    """strict_byte mode passes on byte-identical input."""
    payload = b'{"success":true,"data":{"value":100.00},"code":200}'
    assert_response_match(payload, payload)


@pytest.mark.strict_byte
def test_assert_response_match_strict_byte_fails_on_diverging_bytes(assert_response_match) -> None:
    """strict_byte raises AssertionError with rich diff report."""
    with pytest.raises(AssertionError, match=r"StrictByteDiff at offset"):
        assert_response_match(
            b'{"value":100.00}',  # Java BigDecimal scale-preserved
            b'{"value":100}',     # Python int-collapse (Pattern A)
        )


@pytest.mark.strict_byte
def test_assert_response_match_strict_byte_volatile_pattern_masks_timestamp(
    assert_response_match,
) -> None:
    """volatile_byte_patterns substitutes timestamps before compare → match."""
    actual = b'{"data":[1,2,3],"timestamp":"2026-05-09T11:30:00.150710"}'
    expected = b'{"data":[1,2,3],"timestamp":"2026-05-09T10:00:00.000001"}'

    # Without masking → diverges
    with pytest.raises(AssertionError):
        assert_response_match(actual, expected)

    # With timestamp pattern masked → matches
    assert_response_match(
        actual, expected,
        volatile_byte_patterns=[rb'"timestamp":"[^"]+"'],
    )


# ─── Pattern A / A2 demonstration — strict-byte catches what dict-eq tolerates ─


def test_pattern_a_int_collapse_dict_eq_tolerates() -> None:
    """Pattern A (Java BigDecimal('100.00') vs Python int(100)) — dict-eq parses to equal Python ints."""
    import json

    java_bytes = b'{"value":100.00}'
    python_bytes = b'{"value":100}'

    # After json.parse, both equal Python int 100 — dict-eq tolerates
    java_parsed = json.loads(java_bytes)
    python_parsed = json.loads(python_bytes)
    assert java_parsed == python_parsed   # == {"value": 100}


@pytest.mark.strict_byte
def test_pattern_a_int_collapse_strict_byte_catches(assert_response_match) -> None:
    """Same Pattern A — strict-byte catches the 3-char divergence Java vs Python."""
    java_bytes = b'{"value":100.00}'
    python_bytes = b'{"value":100}'

    with pytest.raises(AssertionError) as exc_info:
        assert_response_match(python_bytes, java_bytes)

    report = str(exc_info.value)
    # Diff report includes both totals + offset
    assert "Total expected: 16 bytes" in report   # b'{"value":100.00}' = 16
    assert "Total actual:   13 bytes" in report   # b'{"value":100}'    = 13


@pytest.mark.strict_byte
def test_pattern_a2_scale4_trailing_zero_strict_byte_catches(assert_response_match) -> None:
    """Pattern A2 (Java '99.9900' vs Python '99.99' float trailing-zero loss) — strict caught."""
    java_bytes = b'{"executionRate":99.9900}'
    python_bytes = b'{"executionRate":99.99}'

    with pytest.raises(AssertionError):
        assert_response_match(python_bytes, java_bytes)


# ─── Type-guard / unsupported-input behaviour preserved through wrapper ─────────


@pytest.mark.strict_byte
def test_strict_byte_rejects_dict_input(assert_response_match) -> None:
    """strict_byte mode requires bytes — passing dicts raises TypeError."""
    with pytest.raises(TypeError, match="strict_byte mode requires bytes args"):
        assert_response_match({"a": 1}, {"a": 1})


def test_dict_eq_strips_nested_volatile_keys(assert_response_match) -> None:
    """Nested volatile keys at any depth get stripped (recursive)."""
    assert_response_match(
        {"outer": {"timestamp": "T1", "value": 1}, "list": [{"generatedAt": "G1", "v": 2}]},
        {"outer": {"timestamp": "T2", "value": 1}, "list": [{"generatedAt": "G2", "v": 2}]},
    )
