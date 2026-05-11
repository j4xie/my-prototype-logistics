"""Rule 4 Phase 2A dict-eq comparison algorithm.

Compares two parsed-JSON dicts using Phase 2A byte-shape parity semantics.
See ``.claude/rules/python-java-port.md`` Rule 4 — official standard is
dict-eq, not strict-byte. T6.1 dryrun 99.945% match rate is the
acceptance bar.

What this module tolerates as MATCH (Pattern A / A2 per Rule 4):

* Integer-valued Decimal int-collapse: Java emits ``100.00`` (float in
  parsed JSON), Python emits ``100`` (int). ``int(100) == float(100.0)``
  → MATCH. Tracked as ``PATTERN_A_INT_COLLAPSE`` for transparency.
* Scale-4 trailing-zero collapse to float: Java emits ``99.9900`` and
  Python emits ``99.99``. After ``json.loads``, both parse to
  ``float(99.99)`` — invisible at this layer (Pattern A2 is detectable
  only by raw-byte comparison). Documented limitation.

What is classified ``REAL_BUG``:

* Type mismatch that isn't numeric (e.g. str vs int, dict vs list).
* Numeric values that aren't equal under exact-Decimal comparison.
* Missing keys on either side.
* List length mismatch.
* Boolean vs numeric (treat ``True != 1`` per JSON semantics).

What is auto-stripped before comparison (matches existing
``replay-and-compare.py`` convention):

* ``generatedAt`` / ``lastUpdated`` / ``cacheExpireAt`` / ``timestamp``
  / ``dataVersion`` — request-time volatile fields that always differ.

Rule 8 (Map.of key order) is intentionally **out of scope** here —
that's a separate strict-byte concern. dict-eq ignores key insertion
order via dict comparison semantics.

Spec: scripts/parity-gate/README.md
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

# ============================================================
# Volatile keys (stripped before compare) — convention mirror of
# scripts/active-e2e/curl-replay/replay-and-compare.py:42.
# ============================================================

VOLATILE_KEYS = frozenset(
    {
        "generatedAt",
        "lastUpdated",
        "cacheExpireAt",
        "timestamp",
        "dataVersion",
    }
)


# ============================================================
# Divergence classifications
# ============================================================

PATTERN_A_INT_COLLAPSE = "PATTERN_A_INT_COLLAPSE"
PATTERN_A2_SCALE_LOSS = "PATTERN_A2_SCALE_LOSS"
REAL_BUG = "REAL_BUG"


def strip_volatile(obj: Any) -> Any:
    """Recursively strip VOLATILE_KEYS from dicts; lists preserve length."""
    if isinstance(obj, dict):
        return {k: strip_volatile(v) for k, v in obj.items() if k not in VOLATILE_KEYS}
    if isinstance(obj, list):
        return [strip_volatile(item) for item in obj]
    return obj


def numeric_eq(a: Any, b: Any) -> bool:
    """Rule 4 numeric equality across int / float / Decimal / numeric string.

    Examples that return True:
        numeric_eq(100, 100.0)            # int vs float, same value
        numeric_eq(100, Decimal("100.00"))
        numeric_eq(99.99, Decimal("99.99"))

    Examples that return False:
        numeric_eq(True, 1)                # bool intentionally NOT equal to 1
        numeric_eq("100", 100)             # str excluded; this layer compares
                                           # already-parsed JSON values
        numeric_eq(None, 0)                # None never equal to a number
    """
    # bool is a subclass of int — guard against True == 1 / False == 0 collapse.
    # Rule 9 expects `"valid": true` and `"value": 1` to be different fields.
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b

    if a is None or b is None:
        return a is None and b is None

    if not isinstance(a, (int, float, Decimal)):
        return False
    if not isinstance(b, (int, float, Decimal)):
        return False

    try:
        da = a if isinstance(a, Decimal) else Decimal(str(a))
        db = b if isinstance(b, Decimal) else Decimal(str(b))
    except Exception:
        return False
    return da == db


def _classify_byte_diff(a: Any, b: Any) -> Optional[str]:
    """If two numeric values match under numeric_eq but differ in Python type,
    classify the byte-shape difference.

    Returns:
        PATTERN_A_INT_COLLAPSE — int vs float of equal numeric value
        None                    — same type, no byte-shape note
    """
    if isinstance(a, bool) or isinstance(b, bool):
        return None
    if not (isinstance(a, (int, float)) and isinstance(b, (int, float))):
        return None
    if type(a) is type(b):
        return None
    if not numeric_eq(a, b):
        return None
    # One is int, the other is float, same numeric value → Pattern A.
    return PATTERN_A_INT_COLLAPSE


def _scalar_repr(x: Any) -> Any:
    """JSON-safe representation for diverge logging (Decimal → str)."""
    if isinstance(x, Decimal):
        return str(x)
    return x


def dict_eq_match(java_response: Any, python_response: Any) -> dict:
    """Compare two parsed-JSON values via Rule 4 dict-eq semantics.

    Args:
        java_response, python_response: Already parsed via ``json.loads``.
            Either dict, list, or scalar at top level.

    Returns:
        {
            "match": bool,                # overall dict-eq match
            "total_leaves": int,          # leaf-level value comparisons performed
            "matched_leaves": int,
            "diverges": [
                {
                    "path": "data.metrics[0].value",
                    "java": <repr>,
                    "python": <repr>,
                    "classification": REAL_BUG,
                },
                ...
            ],
            "tolerated_byte_diffs": [     # Pattern A occurrences (still match)
                {
                    "path": "data.value",
                    "java": 100.0,
                    "python": 100,
                    "classification": PATTERN_A_INT_COLLAPSE,
                },
                ...
            ],
        }
    """
    java_stripped = strip_volatile(java_response)
    python_stripped = strip_volatile(python_response)

    state = {
        "total_leaves": 0,
        "matched_leaves": 0,
        "diverges": [],
        "tolerated_byte_diffs": [],
    }
    _walk_compare(java_stripped, python_stripped, "", state)

    return {
        "match": len(state["diverges"]) == 0,
        "total_leaves": state["total_leaves"],
        "matched_leaves": state["matched_leaves"],
        "diverges": state["diverges"],
        "tolerated_byte_diffs": state["tolerated_byte_diffs"],
    }


def _walk_compare(a: Any, b: Any, path: str, state: dict) -> None:
    """Recursive deep compare — appends to state["diverges"] and counts leaves."""

    # ── Both dicts ──
    if isinstance(a, dict) and isinstance(b, dict):
        a_keys = set(a.keys())
        b_keys = set(b.keys())
        for k in sorted(a_keys - b_keys):
            state["diverges"].append(
                {
                    "path": f"{path}.{k}" if path else k,
                    "java": _scalar_repr(a[k]),
                    "python": "<missing>",
                    "classification": REAL_BUG,
                }
            )
        for k in sorted(b_keys - a_keys):
            state["diverges"].append(
                {
                    "path": f"{path}.{k}" if path else k,
                    "java": "<missing>",
                    "python": _scalar_repr(b[k]),
                    "classification": REAL_BUG,
                }
            )
        for k in sorted(a_keys & b_keys):
            sub_path = f"{path}.{k}" if path else k
            _walk_compare(a[k], b[k], sub_path, state)
        return

    # ── Both lists ──
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            state["diverges"].append(
                {
                    "path": path or "<root>",
                    "java": f"<list len={len(a)}>",
                    "python": f"<list len={len(b)}>",
                    "classification": REAL_BUG,
                }
            )
            return
        for i in range(len(a)):
            _walk_compare(a[i], b[i], f"{path}[{i}]", state)
        return

    # ── Type mismatch (one is dict/list, other isn't) ──
    if isinstance(a, (dict, list)) or isinstance(b, (dict, list)):
        state["total_leaves"] += 1
        state["diverges"].append(
            {
                "path": path or "<root>",
                "java": _scalar_repr(a) if not isinstance(a, (dict, list)) else f"<{type(a).__name__}>",
                "python": _scalar_repr(b) if not isinstance(b, (dict, list)) else f"<{type(b).__name__}>",
                "classification": REAL_BUG,
            }
        )
        return

    # ── Scalar comparison ──
    state["total_leaves"] += 1

    # Numeric (with bool guard)
    is_a_num = isinstance(a, (int, float, Decimal)) and not isinstance(a, bool)
    is_b_num = isinstance(b, (int, float, Decimal)) and not isinstance(b, bool)
    if is_a_num and is_b_num:
        if numeric_eq(a, b):
            state["matched_leaves"] += 1
            byte_diff = _classify_byte_diff(a, b)
            if byte_diff is not None:
                state["tolerated_byte_diffs"].append(
                    {
                        "path": path or "<root>",
                        "java": _scalar_repr(a),
                        "python": _scalar_repr(b),
                        "classification": byte_diff,
                    }
                )
            return
        state["diverges"].append(
            {
                "path": path or "<root>",
                "java": _scalar_repr(a),
                "python": _scalar_repr(b),
                "classification": REAL_BUG,
            }
        )
        return

    # Type mismatch between scalars (numeric vs string, bool vs int, etc.)
    if type(a) is not type(b):
        state["diverges"].append(
            {
                "path": path or "<root>",
                "java": _scalar_repr(a),
                "python": _scalar_repr(b),
                "classification": REAL_BUG,
            }
        )
        return

    # Same type, non-numeric (str, bool, None)
    if a == b:
        state["matched_leaves"] += 1
        return

    state["diverges"].append(
        {
            "path": path or "<root>",
            "java": _scalar_repr(a),
            "python": _scalar_repr(b),
            "classification": REAL_BUG,
        }
    )


def summarize(report: dict) -> str:
    """One-line human-readable summary of a dict_eq_match result."""
    total = report["total_leaves"]
    matched = report["matched_leaves"]
    rate = (matched / total * 100) if total else 100.0
    real_bugs = len(report["diverges"])
    pattern_a = len(report["tolerated_byte_diffs"])
    return (
        f"match={report['match']} "
        f"rate={rate:.3f}% ({matched}/{total}) "
        f"diverges={real_bugs} pattern_a={pattern_a}"
    )
