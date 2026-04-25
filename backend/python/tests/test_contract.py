from __future__ import annotations

import pytest
from dataclasses import FrozenInstanceError

from smartbi.capability.contract import RequiresSpec


def test_empty_spec_satisfied_by_anything():
    spec = RequiresSpec()
    assert spec.is_satisfied_by(set()) is True
    assert spec.is_satisfied_by({"a", "b"}) is True


def test_all_missing_not_satisfied():
    spec = RequiresSpec(all=["x"])
    assert spec.is_satisfied_by(set()) is False
    assert spec.is_satisfied_by({"y"}) is False


def test_all_present_satisfied():
    spec = RequiresSpec(all=["x"])
    assert spec.is_satisfied_by({"x"}) is True
    assert spec.is_satisfied_by({"x", "y"}) is True


def test_any_at_least_one_present_satisfied():
    spec = RequiresSpec(any=["x", "y"])
    assert spec.is_satisfied_by({"x"}) is True
    assert spec.is_satisfied_by({"y"}) is True
    assert spec.is_satisfied_by({"x", "y"}) is True


def test_any_all_missing_not_satisfied():
    spec = RequiresSpec(any=["x", "y"])
    assert spec.is_satisfied_by(set()) is False
    assert spec.is_satisfied_by({"z"}) is False


def test_combined_all_and_any():
    spec = RequiresSpec(all=["x"], any=["y", "z"])
    # both all (x) and at-least-one-any (y or z) required
    assert spec.is_satisfied_by({"x", "y"}) is True
    assert spec.is_satisfied_by({"x", "z"}) is True
    # missing x => fails
    assert spec.is_satisfied_by({"y", "z"}) is False
    # missing both y and z => fails
    assert spec.is_satisfied_by({"x"}) is False
    # missing everything => fails
    assert spec.is_satisfied_by(set()) is False


def test_missing_fields_only_checks_all():
    spec = RequiresSpec(all=["x", "y"], any=["z", "w"])
    # missing both x and y from `all`; `any` fields not reported
    assert spec.missing_fields(set()) == ["x", "y"]
    assert spec.missing_fields({"x"}) == ["y"]
    assert spec.missing_fields({"x", "y"}) == []
    # missing `any` fields are NOT included in the result
    assert spec.missing_fields({"x", "y"}) == []


def test_missing_fields_empty_when_all_present():
    spec = RequiresSpec(all=["x"])
    assert spec.missing_fields({"x", "y"}) == []


def test_frozen_dataclass_cannot_mutate():
    spec = RequiresSpec(all=["x"])
    with pytest.raises(FrozenInstanceError):
        spec.all = ["y"]  # type: ignore[misc]
    with pytest.raises(FrozenInstanceError):
        spec.description = "changed"  # type: ignore[misc]
