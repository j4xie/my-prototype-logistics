"""Marker-aware response comparator dispatcher.

``assert_response_eq`` dispatches to dict-eq (default Phase 2A gate) or
strict-byte comparator based on ``mode`` arg. Pytest marker auto-detection
(``@pytest.mark.strict_byte`` / ``@pytest.mark.dict_eq``) is a Week 2/3
deliverable — Week 1 provides the dispatcher with explicit mode arg only.
"""

from __future__ import annotations

from typing import Any, FrozenSet, List, Optional

from smartbi_compat._strict_byte.strict_diff import _strict_compare_response


_DEFAULT_VOLATILE_KEYS: FrozenSet[str] = frozenset(
    {"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"}
)


def _strip_volatile(obj: Any, volatile_keys: FrozenSet[str]) -> Any:
    """Recursively strip volatile keys from dicts/lists.

    Mirrors the Phase 2A pattern in 22 existing dict-eq tests but accepts
    a configurable key set so callers can extend (e.g. add request UUIDs).
    """
    if isinstance(obj, dict):
        return {
            k: _strip_volatile(v, volatile_keys)
            for k, v in obj.items()
            if k not in volatile_keys
        }
    if isinstance(obj, list):
        return [_strip_volatile(item, volatile_keys) for item in obj]
    return obj


def assert_response_eq(
    actual: Any,
    expected: Any,
    *,
    mode: str = "dict_eq",
    volatile_keys: FrozenSet[str] = _DEFAULT_VOLATILE_KEYS,
    volatile_byte_patterns: Optional[List[bytes]] = None,
) -> None:
    """Marker-aware response comparator dispatcher.

    ``mode``:
      - ``"dict_eq"`` (default): actual + expected MUST be dict/list. Strip
        volatile keys recursively, compare via Python equality. Raises
        AssertionError on divergence with stripped-key context.
      - ``"strict_byte"``: actual + expected MUST be bytes. Optionally mask
        volatile byte patterns, char-by-char compare, raise AssertionError
        with rich ``StrictDiff.format_report()`` on divergence.

    Week 1 scope: explicit ``mode`` arg only. Pytest marker auto-detection
    lands in Week 2/3 (PR #159 §3-§4).
    """
    if mode == "strict_byte":
        if not isinstance(actual, bytes) or not isinstance(expected, bytes):
            raise TypeError(
                f"strict_byte mode requires bytes args, got "
                f"actual={type(actual).__name__}, expected={type(expected).__name__}"
            )
        diff = _strict_compare_response(
            actual, expected, volatile_byte_patterns=volatile_byte_patterns
        )
        if not diff.matched:
            raise AssertionError(diff.format_report())
        return

    if mode == "dict_eq":
        actual_stripped = _strip_volatile(actual, volatile_keys)
        expected_stripped = _strip_volatile(expected, volatile_keys)
        if actual_stripped != expected_stripped:
            raise AssertionError(
                f"dict-eq divergence (volatile keys stripped: "
                f"{sorted(volatile_keys)})"
            )
        return

    raise ValueError(
        f"unknown mode={mode!r}; expected 'dict_eq' or 'strict_byte'"
    )
