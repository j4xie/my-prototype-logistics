"""Char-by-char byte comparator with rich failure report.

``StrictDiff`` dataclass + ``_strict_compare_response`` comparator.
Used by ``assert_response_eq`` when ``mode="strict_byte"``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional


_CHUNK_RADIUS = 50  # bytes around diff offset captured into chunk


@dataclass(frozen=True)
class StrictDiff:
    """Result of a strict-byte comparison.

    Attributes:
        matched: True iff actual bytes equal expected bytes (post-masking).
        first_diff_offset: 0-indexed byte offset of first divergence; None if matched.
        first_diff_line: 1-indexed line number containing first_diff_offset; None if matched.
        expected_chunk: ~100 bytes of expected centered on diff offset.
        actual_chunk: ~100 bytes of actual centered on diff offset.
        expected_total_len: total byte length of expected.
        actual_total_len: total byte length of actual.
    """

    matched: bool
    first_diff_offset: Optional[int]
    first_diff_line: Optional[int]
    expected_chunk: bytes
    actual_chunk: bytes
    expected_total_len: int
    actual_total_len: int

    def format_report(self) -> str:
        """Multi-line failure report with hex dump + UTF-8 decode."""
        if self.matched:
            return f"matched ({self.expected_total_len} bytes)"

        offset = self.first_diff_offset
        line = self.first_diff_line
        delta = self.actual_total_len - self.expected_total_len
        delta_str = f"{delta:+d} bytes" if delta else "same length"

        lines = [
            f"StrictByteDiff at offset {offset} (line {line}):",
            f"  Expected: {_decode_safe(self.expected_chunk)}",
            f"  Actual:   {_decode_safe(self.actual_chunk)}",
            f"  Total expected: {self.expected_total_len} bytes",
            f"  Total actual:   {self.actual_total_len} bytes ({delta_str})",
            "",
            f"Hex dump @ offset {max(0, (offset or 0) - 20)}-{(offset or 0) + 20}:",
            f"  Expected: {_hex_dump(self.expected_chunk)}",
            f"  Actual:   {_hex_dump(self.actual_chunk)}",
        ]
        return "\n".join(lines)


def _decode_safe(b: bytes) -> str:
    """Decode bytes to UTF-8 with replacement for invalid sequences."""
    return b.decode("utf-8", errors="replace")


def _hex_dump(b: bytes) -> str:
    """Format bytes as space-separated hex pairs."""
    return " ".join(f"{x:02x}" for x in b)


def _line_number_at_offset(b: bytes, offset: int) -> int:
    """Return 1-indexed line number containing byte at offset.

    Newline at offset itself counts toward the line containing offset
    (i.e. the LF byte ends line N, so byte at LF position is line N).
    """
    if offset <= 0:
        return 1
    return b[:offset].count(b"\n") + 1


def _slice_chunk(b: bytes, offset: int, radius: int = _CHUNK_RADIUS) -> bytes:
    """Slice bytes around offset, clamped to [0, len(b)]."""
    start = max(0, offset - radius)
    end = min(len(b), offset + radius)
    return b[start:end]


def _strict_compare_response(
    actual: bytes,
    expected: bytes,
    *,
    volatile_byte_patterns: Optional[List[bytes]] = None,
) -> StrictDiff:
    """Char-by-char byte compare; optionally mask volatile patterns first.

    Three cases per PR #154 §3.2:
      1. lengths differ + prefix matches → diff at shorter end
      2. lengths equal + content equal → matched=True
      3. content differs → diff at first byte mismatch (regardless of length)

    ``volatile_byte_patterns`` lets caller substitute volatile timestamps
    or UUIDs with ``<MASKED>`` before compare. Patterns are regex byte strings.
    """
    if volatile_byte_patterns:
        for pattern in volatile_byte_patterns:
            actual = re.sub(pattern, b"<MASKED>", actual)
            expected = re.sub(pattern, b"<MASKED>", expected)

    expected_len = len(expected)
    actual_len = len(actual)

    if actual == expected:
        return StrictDiff(
            matched=True,
            first_diff_offset=None,
            first_diff_line=None,
            expected_chunk=b"",
            actual_chunk=b"",
            expected_total_len=expected_len,
            actual_total_len=actual_len,
        )

    # Find first mismatching byte in the common prefix
    common_len = min(actual_len, expected_len)
    diff_offset = common_len  # default: divergence at shorter end
    for i in range(common_len):
        if actual[i] != expected[i]:
            diff_offset = i
            break

    return StrictDiff(
        matched=False,
        first_diff_offset=diff_offset,
        first_diff_line=_line_number_at_offset(expected, diff_offset),
        expected_chunk=_slice_chunk(expected, diff_offset),
        actual_chunk=_slice_chunk(actual, diff_offset),
        expected_total_len=expected_len,
        actual_total_len=actual_len,
    )
