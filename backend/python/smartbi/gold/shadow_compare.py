"""shadow_compare — diff two result dicts from legacy vs gold paths.

Week 4 Phase B v0 of Unified Data Layer v1 spec (§2.4).

Purpose
-------
When a downstream module turns on shadow-read, it runs BOTH the legacy
query path and the new Gold-backed path, then logs divergence between
the two results. This module is the diff engine those modules call.

Contract for callers
--------------------
1. Build `legacy_result: dict` from the legacy query (e.g. JSON response
   from Java FinanceAnalysisService).
2. Build `gold_result: dict` from a Gold query (e.g. queries.finance_summary).
3. Call `diff_results(legacy, gold, reason='finance_summary', ...)`.
4. On non-empty diff, the module logs a structured WARN so SRE can
   alert on it. User-visible behavior stays on legacy until divergence
   is 0 for 3 consecutive days per spec §2.4 Phase B.

Diff semantics
--------------
- Numeric fields: compare with relative tolerance (default 0.1% per spec).
- String/int equality: exact match required.
- Dict fields: recurse.
- List fields: compare element-wise by position; divergence if lengths differ.
- Missing keys on either side: reported as divergence.

No exceptions
-------------
`diff_results` never raises on differences — it returns a DiffReport
and lets the caller decide what to do. Raising would mean a single
divergence blocks the user's page load, which would be worse than
seeing a number that's 0.05% off.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# Per spec §2.4 Phase B: "Div=0 连续 3 天才可 flip" — 0 is the goal but
# floating-point + rounding in different codebases produces near-zero
# residuals. Relative tolerance 0.001 (0.1%) is the spec's cutoff.
_DEFAULT_REL_TOL = 0.001


@dataclass
class FieldDiff:
    path: str              # dotted path e.g. "top_stores[0].revenue"
    legacy_value: Any
    gold_value: Any
    reason: str            # e.g. "missing_in_gold" | "value_differs" | "type_mismatch"


@dataclass
class DiffReport:
    match: bool
    reason: str            # caller's label (which module/query triggered this)
    legacy_result: Dict[str, Any]
    gold_result: Dict[str, Any]
    diffs: List[FieldDiff] = field(default_factory=list)

    def log_if_divergent(self, logger_: Optional[logging.Logger] = None) -> None:
        """Structured WARN log for SRE dashboards. Caller can pass a
        module-specific logger or fall back to this module's."""
        if self.match:
            return
        lg = logger_ or logger
        lg.warning(
            "[shadow-compare] reason=%s diverged diff_count=%d first=%s",
            self.reason, len(self.diffs),
            self.diffs[0] if self.diffs else None,
        )


def _approx_equal(a: Any, b: Any, rel_tol: float) -> bool:
    """Float-tolerant equality for numeric types. Non-numerics must match
    exactly (strings, bools, dates, etc.)."""
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    # Only apply tolerance to numeric types.
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if a == 0 and b == 0:
            return True
        denom = max(abs(a), abs(b))
        return abs(a - b) / denom <= rel_tol
    # Non-numeric → strict equality.
    return a == b


def _recurse_diff(
    path: str,
    legacy: Any,
    gold: Any,
    rel_tol: float,
    out: List[FieldDiff],
) -> None:
    """Walk two objects side-by-side, append FieldDiff per mismatch."""
    if type(legacy) is not type(gold):
        # Allow int↔float convertibility — a JSON round-trip may turn
        # int 42 into float 42.0.
        num_types = (int, float)
        if not (isinstance(legacy, num_types) and isinstance(gold, num_types)):
            out.append(FieldDiff(path, legacy, gold, "type_mismatch"))
            return

    if isinstance(legacy, dict):
        all_keys = set(legacy.keys()) | set(gold.keys())
        for k in sorted(all_keys):
            sub_path = f"{path}.{k}" if path else k
            if k not in legacy:
                out.append(FieldDiff(sub_path, None, gold[k], "missing_in_legacy"))
                continue
            if k not in gold:
                out.append(FieldDiff(sub_path, legacy[k], None, "missing_in_gold"))
                continue
            _recurse_diff(sub_path, legacy[k], gold[k], rel_tol, out)
        return

    if isinstance(legacy, list):
        if len(legacy) != len(gold):
            out.append(FieldDiff(
                path, f"len={len(legacy)}", f"len={len(gold)}", "list_length_differs",
            ))
            return
        for i, (l, g) in enumerate(zip(legacy, gold)):
            _recurse_diff(f"{path}[{i}]", l, g, rel_tol, out)
        return

    # Scalar comparison.
    if not _approx_equal(legacy, gold, rel_tol):
        out.append(FieldDiff(path, legacy, gold, "value_differs"))


def diff_results(
    legacy_result: Dict[str, Any],
    gold_result: Dict[str, Any],
    *,
    reason: str,
    rel_tol: float = _DEFAULT_REL_TOL,
    ignore_keys: Optional[List[str]] = None,
) -> DiffReport:
    """Compute DiffReport between two result dicts.

    `ignore_keys` is a list of top-level keys to skip (e.g. timestamps
    like `computed_at` that always differ by wall-clock).
    """
    # Shallow-copy to avoid mutating caller's data when we drop ignore_keys.
    legacy = dict(legacy_result or {})
    gold = dict(gold_result or {})
    for k in (ignore_keys or []):
        legacy.pop(k, None)
        gold.pop(k, None)

    diffs: List[FieldDiff] = []
    _recurse_diff("", legacy, gold, rel_tol, diffs)

    return DiffReport(
        match=not diffs,
        reason=reason,
        legacy_result=legacy_result,
        gold_result=gold_result,
        diffs=diffs,
    )
