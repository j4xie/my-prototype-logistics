"""Tests for smartbi.gold.shadow_compare.

Week 4 Phase B v0 of Unified Data Layer v1 spec.

Pure-function tests only — no DB required.
"""
from __future__ import annotations

from smartbi.gold.shadow_compare import diff_results


# ── Match cases ──────────────────────────────────────────────

def test_identical_dicts_match():
    a = {"revenue": 100, "bills": 5, "stores": ["S1", "S2"]}
    b = {"revenue": 100, "bills": 5, "stores": ["S1", "S2"]}
    r = diff_results(a, b, reason="test")
    assert r.match is True
    assert r.diffs == []


def test_numeric_close_enough_matches():
    """Relative tolerance 0.1% is the default — 100.05 vs 100.0 is within."""
    a = {"revenue": 100.0}
    b = {"revenue": 100.05}
    r = diff_results(a, b, reason="test")
    assert r.match is True


def test_both_empty_dicts_match():
    r = diff_results({}, {}, reason="test")
    assert r.match is True


# ── Divergence cases ─────────────────────────────────────────

def test_value_diverges_outside_tolerance():
    a = {"revenue": 100.0}
    b = {"revenue": 103.0}  # 3% off — outside 0.1% default
    r = diff_results(a, b, reason="finance")
    assert r.match is False
    assert len(r.diffs) == 1
    d = r.diffs[0]
    assert d.path == "revenue"
    assert d.legacy_value == 100.0
    assert d.gold_value == 103.0
    assert d.reason == "value_differs"


def test_missing_key_in_gold_reported():
    a = {"revenue": 100, "cost": 50}
    b = {"revenue": 100}
    r = diff_results(a, b, reason="test")
    assert r.match is False
    d = r.diffs[0]
    assert d.path == "cost"
    assert d.reason == "missing_in_gold"


def test_missing_key_in_legacy_reported():
    a = {"revenue": 100}
    b = {"revenue": 100, "new_metric": 42}
    r = diff_results(a, b, reason="test")
    assert r.match is False
    assert r.diffs[0].path == "new_metric"
    assert r.diffs[0].reason == "missing_in_legacy"


def test_list_length_mismatch_reported():
    a = {"top_stores": [{"name": "X"}, {"name": "Y"}]}
    b = {"top_stores": [{"name": "X"}]}
    r = diff_results(a, b, reason="test")
    assert r.match is False
    assert any(d.reason == "list_length_differs" for d in r.diffs)


def test_nested_dict_diff_gets_dotted_path():
    a = {"section": {"sub": {"val": 1}}}
    b = {"section": {"sub": {"val": 99}}}
    r = diff_results(a, b, reason="test")
    assert r.match is False
    assert r.diffs[0].path == "section.sub.val"


def test_list_element_diff_gets_bracket_path():
    a = {"top_stores": [{"revenue": 100}, {"revenue": 50}]}
    b = {"top_stores": [{"revenue": 100}, {"revenue": 999}]}
    r = diff_results(a, b, reason="test")
    assert r.match is False
    assert r.diffs[0].path == "top_stores[1].revenue"


# ── Type edge cases ──────────────────────────────────────────

def test_int_vs_float_considered_equal_if_numerically_close():
    """JSON round-trip often changes int → float. Don't fail on that."""
    a = {"count": 5}
    b = {"count": 5.0}
    r = diff_results(a, b, reason="test")
    assert r.match is True


def test_none_vs_none_match():
    a = {"val": None}
    b = {"val": None}
    assert diff_results(a, b, reason="test").match is True


def test_none_vs_number_diverges():
    a = {"val": None}
    b = {"val": 0}
    r = diff_results(a, b, reason="test")
    assert r.match is False


def test_type_mismatch_reported():
    a = {"val": "5"}
    b = {"val": 5}
    r = diff_results(a, b, reason="test")
    assert r.match is False
    assert r.diffs[0].reason == "type_mismatch"


# ── ignore_keys ─────────────────────────────────────────────

def test_ignore_keys_skips_top_level_field():
    a = {"revenue": 100, "computed_at": "2026-04-21T10:00:00"}
    b = {"revenue": 100, "computed_at": "2026-04-21T10:00:01"}
    r = diff_results(a, b, reason="test", ignore_keys=["computed_at"])
    assert r.match is True


def test_ignore_keys_preserves_original_results_on_report():
    """ignore_keys shouldn't mutate the caller's dict — they should see
    the full legacy/gold results on the report object."""
    a = {"revenue": 100, "computed_at": "X"}
    b = {"revenue": 100, "computed_at": "Y"}
    r = diff_results(a, b, reason="test", ignore_keys=["computed_at"])
    assert r.legacy_result == {"revenue": 100, "computed_at": "X"}
    assert r.gold_result == {"revenue": 100, "computed_at": "Y"}


# ── Custom tolerance ────────────────────────────────────────

def test_stricter_tolerance_catches_finer_drift():
    a = {"x": 100.0}
    b = {"x": 100.001}  # 0.001% diff
    # Default 0.1% → match. Stricter 0.0001% → diverges.
    assert diff_results(a, b, reason="t").match is True
    r = diff_results(a, b, reason="t", rel_tol=1e-6)
    assert r.match is False


# ── log_if_divergent ─────────────────────────────────────────

def test_log_if_divergent_noop_when_match(caplog):
    import logging
    a = {"x": 1}
    r = diff_results(a, a, reason="test_mod")
    with caplog.at_level(logging.WARNING):
        r.log_if_divergent()
    assert not any("shadow-compare" in rec.message for rec in caplog.records)


def test_log_if_divergent_warns_when_diverged(caplog):
    import logging
    a = {"x": 1}
    b = {"x": 2}
    r = diff_results(a, b, reason="test_mod")
    with caplog.at_level(logging.WARNING):
        r.log_if_divergent()
    assert any(
        "test_mod" in rec.message and "diverged" in rec.message
        for rec in caplog.records
    )
