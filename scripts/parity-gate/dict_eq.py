"""Rule 4 Phase 2A dict-eq comparison algorithm.

Compares two parsed-JSON dicts using Phase 2A byte-shape parity semantics.
See ``.claude/rules/python-java-port.md`` Rule 4 — official standard is
dict-eq, not strict-byte. T6.1 dryrun 99.945% match rate is the
acceptance bar.

What this module tolerates as MATCH (Pattern A / A2 per Rule 4):

* **Pattern A** — integer-valued Decimal int-collapse: Java emits
  ``100.00`` (float in parsed JSON), Python emits ``100`` (int).
  ``int(100) == float(100.0)`` → MATCH. Tracked as
  ``PATTERN_A_INT_COLLAPSE`` for transparency.
* **Pattern A2** — scale-4 trailing-zero collapse to float: Java emits
  ``99.9900`` and Python emits ``99.99``. After ``json.loads``, both
  parse to ``float(99.99)`` — **invisible at this layer** (Pattern A2
  is only detectable by raw-byte comparison; constant kept for future).

What this module CLASSIFIES (but does not auto-tolerate without opt-in):

* **Pattern B** — Java legacy fallback structural divergence. The Java
  side emits a different envelope shape (factory mock) while Python
  emits a new tenant-typed envelope (e.g. restaurant 3-metric). Detected
  via ``_detect_pattern_b_context`` heuristics (``tenantType`` mismatch
  / restaurant-signal keys missing on one side). All diverges within a
  Pattern B context are classified ``PATTERN_B_STRUCTURAL`` so callers
  can opt in to tolerate them via ``--tolerate-divergence-patterns B``
  in ``compare.py``.
* **Pattern C** — value-level placeholder vs real (e.g. Java mock
  emits ``0``, Python emits real ``47.33``). Constant kept for future
  manual classification; not currently auto-detected (too easy to
  misclassify a real bug as Pattern C).

What is classified ``REAL_BUG``:

* Type mismatch that isn't numeric (e.g. str vs int, dict vs list)
  when NOT inside a Pattern B context.
* Numeric values that aren't equal under exact-Decimal comparison.
* Missing keys on either side outside the Pattern B vocabulary.
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
Predecessor: ``.claude/rules/python-java-port.md`` Rule 4 — Pattern B
explicitly listed as "NOT dict-eq scope" in the acceptance table; this
module surfaces the classification so callers can decide.
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
PATTERN_A2_TRAILING_ZERO = "PATTERN_A2_TRAILING_ZERO"  # invisible post-parse; constant kept for raw-byte mode
PATTERN_A2_SCALE_LOSS = PATTERN_A2_TRAILING_ZERO  # legacy alias retained for backwards compat
PATTERN_B_STRUCTURAL = "PATTERN_B_STRUCTURAL"
PATTERN_C_VALUE_PLACEHOLDER = "PATTERN_C_VALUE_PLACEHOLDER"  # not currently auto-detected
REAL_BUG = "REAL_BUG"

# HTTP-layer routing classifications (Phase C cutover awareness, not body-level).
# Surfaced via compare.classify_routing() before dict_eq runs; see report.py for
# how these affect verdict/REAL_BUG accounting.
PATTERN_X_JAVA_DELETED = "PATTERN_X_JAVA_DELETED"
PATTERN_Y_BOTH_GONE = "PATTERN_Y_BOTH_GONE"
PATTERN_Z_PYTHON_NOT_IN_SCOPE = "PATTERN_Z_PYTHON_NOT_IN_SCOPE"

# All known pattern letters (CLI accepts these via --tolerate-divergence-patterns).
# Patterns X/Y/Z are HTTP-layer (see classify_routing) — listed here so
# `--tolerate-divergence-patterns` can be used as an alternative spelling, but the
# canonical flags are `--tolerate-java-deleted` / `--tolerate-python-not-in-scope`.
KNOWN_PATTERNS = {
    "A": PATTERN_A_INT_COLLAPSE,
    "A2": PATTERN_A2_TRAILING_ZERO,
    "B": PATTERN_B_STRUCTURAL,
    "C": PATTERN_C_VALUE_PLACEHOLDER,
    "X": PATTERN_X_JAVA_DELETED,
    "Y": PATTERN_Y_BOTH_GONE,
    "Z": PATTERN_Z_PYTHON_NOT_IN_SCOPE,
}


# Keys that strongly indicate the restaurant tenant envelope shape (per
# T6.6 Sub-A spec §1.4 + Sub-B chat4 PR #358). When one side has these
# and the other doesn't, Pattern B applies — Java factory mock vs
# Python tenant-typed dispatch.
_RESTAURANT_SIGNAL_KEYS = frozenset(
    {
        "tenantType",
        "metrics",
        "dataAvailability",
        "proxyMetric",
        "trendChart",
        "downtimeChart",
    }
)


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


def _unwrap_envelope(obj: Any) -> Any:
    """Drill past the standard ApiResponse envelope ``{code, message, data, ...}``
    to the actual payload. Returns ``obj`` unchanged if not enveloped.
    """
    if isinstance(obj, dict) and "data" in obj and isinstance(obj["data"], (dict, list)):
        return obj["data"]
    return obj


def _detect_pattern_b_context(java_response: Any, python_response: Any) -> bool:
    """Heuristic: are the two responses representing fundamentally different
    envelope shapes (Java factory mock vs Python tenant-typed dispatch)?

    Returns True when any of:
      1. ``tenantType`` differs (one is ``"RESTAURANT"`` / ``"BRANCH"``,
         the other absent or ``"FACTORY"``).
      2. One side has restaurant-signal keys (``metrics``,
         ``dataAvailability``, ``proxyMetric``, ``trendChart``,
         ``downtimeChart``) that the other lacks.
      3. The top-level key sets symmetrically differ by ≥2 restaurant
         signal keys (one side has them, other doesn't).

    Returns False otherwise — same-shape responses fall through to per-leaf
    classification.
    """
    java_data = _unwrap_envelope(java_response)
    python_data = _unwrap_envelope(python_response)

    if not isinstance(java_data, dict) or not isinstance(python_data, dict):
        return False

    # Strong signal: tenantType mismatch.
    j_tenant = java_data.get("tenantType")
    p_tenant = python_data.get("tenantType")
    if j_tenant != p_tenant:
        # Genuine mismatch — one side surfaced tenant type, other didn't,
        # or values differ.
        return True

    # Top-level restaurant-signal key asymmetry.
    j_keys = set(java_data.keys()) if isinstance(java_data, dict) else set()
    p_keys = set(python_data.keys()) if isinstance(python_data, dict) else set()
    signal_diff = (j_keys ^ p_keys) & _RESTAURANT_SIGNAL_KEYS
    if signal_diff:
        return True

    return False


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
            "pattern_b_context": bool,    # True if top-level structural shape mismatch detected
            "diverges": [
                {
                    "path": "data.metrics[0].value",
                    "java": <repr>,
                    "python": <repr>,
                    "classification": REAL_BUG | PATTERN_B_STRUCTURAL,
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

    Note on ``match`` semantics: when ``pattern_b_context`` is True the
    raw ``diverges`` list will be heavily populated with
    ``PATTERN_B_STRUCTURAL`` entries; ``match`` stays ``False`` here
    (it's still a dict-eq mismatch). Use ``compare.py
    --tolerate-divergence-patterns B`` to re-bucket those into
    ``tolerated_byte_diffs`` and recompute the gate. This module stays
    pure / no opinions; tolerance is the caller's policy.
    """
    java_stripped = strip_volatile(java_response)
    python_stripped = strip_volatile(python_response)

    b_context = _detect_pattern_b_context(java_stripped, python_stripped)

    state = {
        "total_leaves": 0,
        "matched_leaves": 0,
        "diverges": [],
        "tolerated_byte_diffs": [],
        "_b_context": b_context,
    }
    _walk_compare(java_stripped, python_stripped, "", state)

    return {
        "match": len(state["diverges"]) == 0,
        "total_leaves": state["total_leaves"],
        "matched_leaves": state["matched_leaves"],
        "pattern_b_context": b_context,
        "diverges": state["diverges"],
        "tolerated_byte_diffs": state["tolerated_byte_diffs"],
    }


def _diverge_class(state: dict) -> str:
    """Resolve diverge classification using the carried Pattern B context."""
    return PATTERN_B_STRUCTURAL if state.get("_b_context") else REAL_BUG


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
                    "classification": _diverge_class(state),
                }
            )
        for k in sorted(b_keys - a_keys):
            state["diverges"].append(
                {
                    "path": f"{path}.{k}" if path else k,
                    "java": "<missing>",
                    "python": _scalar_repr(b[k]),
                    "classification": _diverge_class(state),
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
                    "classification": _diverge_class(state),
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
                "classification": _diverge_class(state),
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
                "classification": _diverge_class(state),
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
                "classification": _diverge_class(state),
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
            "classification": _diverge_class(state),
        }
    )


def apply_tolerance(report: dict, tolerate_all: bool = False,
                    tolerate_patterns: Optional[set] = None) -> dict:
    """Re-bucket ``diverges`` per tolerance config; recompute ``match``.

    Args:
        report: a ``dict_eq_match`` output dict (mutated and returned).
        tolerate_all: if True, every diverge with a non-REAL_BUG
            classification moves to ``tolerated_byte_diffs``. REAL_BUG
            entries stay in ``diverges``.
        tolerate_patterns: explicit set of pattern letters (e.g.
            ``{"A", "B"}``). Overrides ``tolerate_all`` when supplied.

    Returns:
        The same report dict with adjusted lists and ``match`` flag.
    """
    if not tolerate_all and not tolerate_patterns:
        return report

    if tolerate_patterns is not None:
        accepted_classes = {KNOWN_PATTERNS[p] for p in tolerate_patterns if p in KNOWN_PATTERNS}
    else:
        # tolerate_all: every named pattern except REAL_BUG
        accepted_classes = set(KNOWN_PATTERNS.values())

    kept = []
    moved = list(report.get("tolerated_byte_diffs", []))
    for d in report.get("diverges", []):
        if d["classification"] in accepted_classes:
            moved.append(d)
        else:
            kept.append(d)

    report["diverges"] = kept
    report["tolerated_byte_diffs"] = moved
    report["match"] = len(kept) == 0
    return report


def parse_patterns_arg(arg: Optional[str]) -> Optional[set]:
    """Parse ``--tolerate-divergence-patterns`` CLI value into a set of
    pattern letters. Returns None on empty / falsy. Raises ValueError on
    unknown letters so the CLI fails loudly.
    """
    if not arg:
        return None
    out = set()
    for part in arg.split(","):
        letter = part.strip().upper()
        if not letter:
            continue
        if letter not in KNOWN_PATTERNS:
            valid = ", ".join(sorted(KNOWN_PATTERNS.keys()))
            raise ValueError(
                f"Unknown tolerate-divergence pattern '{letter}'. "
                f"Valid: {valid}"
            )
        out.add(letter)
    return out or None


def summarize(report: dict) -> str:
    """One-line human-readable summary of a dict_eq_match result."""
    total = report["total_leaves"]
    matched = report["matched_leaves"]
    rate = (matched / total * 100) if total else 100.0
    real_bugs = len(report["diverges"])
    pattern_a = len(report["tolerated_byte_diffs"])
    b_ctx = report.get("pattern_b_context", False)
    b_note = " b_context=true" if b_ctx else ""
    return (
        f"match={report['match']} "
        f"rate={rate:.3f}% ({matched}/{total}) "
        f"diverges={real_bugs} pattern_a={pattern_a}{b_note}"
    )
