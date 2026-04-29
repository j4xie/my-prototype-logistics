"""Mock-based unit tests for template_status. Run via --noconftest."""
from __future__ import annotations
from typing import ClassVar
import pytest
from unittest.mock import patch, MagicMock

from smartbi.capability.contract import RequiresSpec
from smartbi.capability.template_status import (
    compute_template_status,
    suggest_unlocks,
    _generate_cta,
)


def _mock_template(code: str, requires=None):
    tpl = MagicMock()
    tpl.code = code
    if requires is not None:
        tpl.requires = requires
    else:
        # Simulate template WITHOUT requires attribute at all
        # (Phase 2 not done = attribute may be absent)
        del tpl.requires
    return tpl


def _patch_registry(templates):
    """Monkey-patch get_registry().all() to return our mock list."""
    return patch(
        "smartbi.capability.template_status.get_registry",
        return_value=MagicMock(all=lambda: templates),
    )


def test_template_with_requires_satisfied():
    tpl = _mock_template("t1", RequiresSpec(all=["x"]))
    with _patch_registry([tpl]):
        result = compute_template_status({"x"})
    assert result == {"t1": {"satisfied": True, "missing": []}}


def test_template_with_requires_unsatisfied():
    tpl = _mock_template("t1", RequiresSpec(all=["x", "y"]))
    with _patch_registry([tpl]):
        result = compute_template_status({"x"})
    assert result == {"t1": {"satisfied": False, "missing": ["y"]}}


def test_template_without_requires_attribute_is_deferred():
    """Phase 2 in progress: many templates not yet tagged. They must be deferred."""
    tpl = _mock_template("t_untagged", requires=None)  # no attribute
    with _patch_registry([tpl]):
        result = compute_template_status({"x"})
    assert result == {"t_untagged": {"satisfied": None, "missing": [], "deferred": True}}


def test_template_with_explicit_none_is_deferred():
    """spec §6.1: B-stage templates explicit `requires=None` → deferred."""
    tpl = MagicMock(code="t_b_stage", requires=None)
    with _patch_registry([tpl]):
        result = compute_template_status({"x"})
    assert result == {"t_b_stage": {"satisfied": None, "missing": [], "deferred": True}}


def test_suggest_unlocks_groups_by_missing_field():
    tpls = [
        _mock_template("t_needs_date", RequiresSpec(all=["date"])),
        _mock_template("t_needs_date_too", RequiresSpec(all=["date"])),
        _mock_template("t_needs_combo", RequiresSpec(all=["combo_string"])),
    ]
    with _patch_registry(tpls):
        ts = compute_template_status(set())
        suggestions = suggest_unlocks(set(), ts)
    # Sorted by unlocks_count desc — date first (2), combo second (1)
    assert suggestions[0]["missing_field"] == "date"
    assert suggestions[0]["unlocks_count"] == 2
    assert "t_needs_date" in suggestions[0]["unlocks_examples"]
    assert suggestions[1]["missing_field"] == "combo_string"
    assert suggestions[1]["unlocks_count"] == 1


def test_suggest_unlocks_skips_satisfied():
    tpls = [
        _mock_template("t_ok", RequiresSpec(all=["x"])),  # satisfied
        _mock_template("t_needs_date", RequiresSpec(all=["date"])),  # not satisfied
    ]
    with _patch_registry(tpls):
        ts = compute_template_status({"x"})
        suggestions = suggest_unlocks({"x"}, ts)
    # t_ok is satisfied → not in suggestions
    assert all(s["missing_field"] == "date" for s in suggestions)
    assert len(suggestions) == 1


def test_suggest_unlocks_skips_deferred():
    tpls = [
        _mock_template("t_deferred", requires=None),  # no attribute
        _mock_template("t_needs_date", RequiresSpec(all=["date"])),
    ]
    with _patch_registry(tpls):
        ts = compute_template_status(set())
        suggestions = suggest_unlocks(set(), ts)
    assert len(suggestions) == 1
    assert suggestions[0]["missing_field"] == "date"


def test_suggest_unlocks_top_5_cap():
    tpls = [
        _mock_template(f"t{i}", RequiresSpec(all=[f"field_{i}"]))
        for i in range(10)
    ]
    with _patch_registry(tpls):
        ts = compute_template_status(set())
        suggestions = suggest_unlocks(set(), ts)
    assert len(suggestions) == 5  # capped


def test_generate_cta_known_field():
    cta = _generate_cta("date", 12)
    assert "12 个分析" in cta
    assert "账单流水" in cta or "日报" in cta


def test_generate_cta_unknown_field_fallback():
    """B-stage may introduce new fields not in dict — fall back gracefully."""
    cta = _generate_cta("future_field_xyz", 3)
    assert "future_field_xyz" in cta
    assert "3 个分析" in cta
    assert "待补充" in cta  # signals B-stage TODO
