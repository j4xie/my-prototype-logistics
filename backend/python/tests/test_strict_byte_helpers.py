"""Unit tests for _strict_byte foundation primitives (Phase 1 Week 1).

Per PR #159 §2 sign-off criteria:
  - all tests pass
  - 22 existing dict-eq test files unchanged + still pass
  - LOC actual within ±20% of estimate (~100 LOC tests)
  - no imports from production endpoint code
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from smartbi_compat._strict_byte import (
    StrictDiff,
    _decimal_preserve_scale,
    _strict_compare_response,
    assert_response_eq,
)


# ── _decimal_preserve_scale ─────────────────────────────────────


class TestDecimalPreserveScale:
    """Mirror Java BigDecimal.toPlainString() — preserves scale + no scientific."""

    @pytest.mark.parametrize(
        "value, expected",
        [
            (Decimal("100"), "100"),
            (Decimal("100.00"), "100.00"),
            (Decimal("99.9900"), "99.9900"),
            (Decimal("0.00"), "0.00"),
            (Decimal("0"), "0"),
            (Decimal("-100.50"), "-100.50"),
            (Decimal("0.000001"), "0.000001"),
        ],
    )
    def test_basic_scale_preservation(self, value: Decimal, expected: str) -> None:
        assert _decimal_preserve_scale(value) == expected

    def test_large_value_no_scientific_notation(self) -> None:
        # Java BigDecimal("1E+10") → "10000000000" via toPlainString
        assert _decimal_preserve_scale(Decimal("1E+10")) == "10000000000"

    def test_none_returns_null_literal(self) -> None:
        assert _decimal_preserve_scale(None) == "null"


# ── StrictDiff ─────────────────────────────────────────────────


class TestStrictDiff:
    """Dataclass + format_report() output."""

    def test_matched_state(self) -> None:
        diff = StrictDiff(
            matched=True,
            first_diff_offset=None,
            first_diff_line=None,
            expected_chunk=b"",
            actual_chunk=b"",
            expected_total_len=100,
            actual_total_len=100,
        )
        assert diff.matched is True
        assert diff.format_report() == "matched (100 bytes)"

    def test_format_report_contains_offset_and_line(self) -> None:
        diff = StrictDiff(
            matched=False,
            first_diff_offset=1247,
            first_diff_line=47,
            expected_chunk=b'"actual": 100.00',
            actual_chunk=b'"actual": 100',
            expected_total_len=4583,
            actual_total_len=4576,
        )
        report = diff.format_report()
        assert "offset 1247" in report
        assert "line 47" in report
        assert "4583" in report
        assert "4576" in report
        assert "-7 bytes" in report

    def test_format_report_includes_hex_dump(self) -> None:
        diff = StrictDiff(
            matched=False,
            first_diff_offset=0,
            first_diff_line=1,
            expected_chunk=b"abc",
            actual_chunk=b"abd",
            expected_total_len=3,
            actual_total_len=3,
        )
        report = diff.format_report()
        assert "61 62 63" in report  # hex of "abc"
        assert "61 62 64" in report  # hex of "abd"


# ── _strict_compare_response ───────────────────────────────────


class TestStrictCompareResponse:

    def test_identical_bytes_match(self) -> None:
        diff = _strict_compare_response(b"hello world", b"hello world")
        assert diff.matched is True
        assert diff.first_diff_offset is None

    def test_single_byte_diff_locates_offset(self) -> None:
        actual = b"abcdefghij"
        expected = b"abcdefghiX"
        diff = _strict_compare_response(actual, expected)
        assert diff.matched is False
        assert diff.first_diff_offset == 9
        assert b"j" in diff.actual_chunk
        assert b"X" in diff.expected_chunk

    def test_length_mismatch_diverges_at_shorter_end(self) -> None:
        actual = b"abc"
        expected = b"abcdef"
        diff = _strict_compare_response(actual, expected)
        assert diff.matched is False
        assert diff.first_diff_offset == 3
        assert diff.actual_total_len == 3
        assert diff.expected_total_len == 6

    def test_length_mismatch_diff_in_common_prefix(self) -> None:
        # Lengths differ but first divergence is INSIDE the common prefix.
        actual = b"abcXef"
        expected = b"abcdefghij"
        diff = _strict_compare_response(actual, expected)
        assert diff.matched is False
        assert diff.first_diff_offset == 3

    def test_volatile_pattern_masking(self) -> None:
        actual = b'{"lastUpdated":"2026-05-08T10:00:00Z","value":100}'
        expected = b'{"lastUpdated":"2026-05-09T11:00:00Z","value":100}'
        # Without masking → diverges at the timestamp char
        diff_unmasked = _strict_compare_response(actual, expected)
        assert diff_unmasked.matched is False
        # With masking → identical post-mask
        timestamp_pattern = rb"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"
        diff_masked = _strict_compare_response(
            actual, expected, volatile_byte_patterns=[timestamp_pattern]
        )
        assert diff_masked.matched is True

    def test_line_number_counts_newlines(self) -> None:
        # 3 newlines before the diff position → diff is on line 4.
        actual = b"line1\nline2\nline3\nXXXX"
        expected = b"line1\nline2\nline3\nYYYY"
        diff = _strict_compare_response(actual, expected)
        assert diff.matched is False
        assert diff.first_diff_offset == 18  # position of X / Y
        assert diff.first_diff_line == 4


# ── assert_response_eq dispatcher ──────────────────────────────


class TestAssertResponseEq:

    def test_dict_eq_passes_on_equal_dicts(self) -> None:
        # Should not raise
        assert_response_eq(
            {"a": 1, "b": [1, 2, 3]},
            {"a": 1, "b": [1, 2, 3]},
            mode="dict_eq",
        )

    def test_dict_eq_strips_volatile_keys(self) -> None:
        # generatedAt is volatile → divergence on that key is tolerated
        actual = {"generatedAt": "now", "value": 100}
        expected = {"generatedAt": "later", "value": 100}
        assert_response_eq(actual, expected, mode="dict_eq")

    def test_dict_eq_fails_on_real_divergence(self) -> None:
        with pytest.raises(AssertionError) as exc_info:
            assert_response_eq(
                {"value": 100},
                {"value": 200},
                mode="dict_eq",
            )
        assert "dict-eq divergence" in str(exc_info.value)

    def test_strict_byte_passes_on_equal_bytes(self) -> None:
        assert_response_eq(b"hello", b"hello", mode="strict_byte")

    def test_strict_byte_fails_with_rich_report(self) -> None:
        with pytest.raises(AssertionError) as exc_info:
            assert_response_eq(b"hello", b"world", mode="strict_byte")
        assert "StrictByteDiff" in str(exc_info.value)
        assert "offset 0" in str(exc_info.value)

    def test_strict_byte_rejects_non_bytes_args(self) -> None:
        with pytest.raises(TypeError) as exc_info:
            assert_response_eq({"a": 1}, {"a": 1}, mode="strict_byte")
        assert "bytes" in str(exc_info.value)

    def test_unknown_mode_raises(self) -> None:
        with pytest.raises(ValueError) as exc_info:
            assert_response_eq({}, {}, mode="bogus")
        assert "unknown mode" in str(exc_info.value)

    def test_default_mode_is_dict_eq(self) -> None:
        # No mode kwarg → defaults to dict_eq
        assert_response_eq({"a": 1}, {"a": 1})
