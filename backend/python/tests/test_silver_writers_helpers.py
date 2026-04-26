"""Unit tests for shared Silver-writer helpers (_helpers.py)."""
from __future__ import annotations

from datetime import date, datetime

import pytest

from smartbi.canonical.aliases import ALIAS_TO_ATTR
from smartbi.canonical.silver_writers._helpers import (
    canonical_value,
    normalize_text,
    pick,
    to_date,
    to_float,
    unwrap_row,
)


# --- unwrap_row ----------------------------------------------------------


def test_unwrap_row_dict_passthrough():
    """Dict input returned as-is."""
    row = {"a": 1, "b": "x"}
    assert unwrap_row(row) is row


def test_unwrap_row_json_string_parses():
    """Valid JSON object string → dict."""
    assert unwrap_row('{"a": 1, "b": "x"}') == {"a": 1, "b": "x"}


def test_unwrap_row_invalid_json_returns_empty():
    """Invalid JSON → {} (preserves pre-extraction writer behavior, not _raw payload)."""
    assert unwrap_row("not json {{{ ") == {}


def test_unwrap_row_none_returns_empty_dict():
    """None → {}."""
    assert unwrap_row(None) == {}


def test_unwrap_row_non_dict_json_returns_empty():
    """JSON list (not dict) → {}."""
    assert unwrap_row("[1, 2, 3]") == {}


def test_unwrap_row_other_type_returns_empty():
    """int / object → {}."""
    assert unwrap_row(42) == {}
    assert unwrap_row(object()) == {}


# --- canonical_value -----------------------------------------------------


def test_canonical_value_walks_aliases():
    """Look up a real ALIAS_TO_ATTR raw key first, then canonical key."""
    # Find a raw_key whose canonical = 'store_name' (must exist by Day 1 spec).
    raw_key_for_store = next(
        (k for k, v in ALIAS_TO_ATTR.items() if v == "store_name"),
        None,
    )
    assert raw_key_for_store is not None, "ALIAS_TO_ATTR must have a store_name alias"
    row = {raw_key_for_store: "测试门店"}
    assert canonical_value(row, "store_name") == "测试门店"


def test_canonical_value_canonical_key_fallback():
    """If only canonical key present, return it."""
    row = {"store_name": "门店X"}
    assert canonical_value(row, "store_name") == "门店X"


def test_canonical_value_missing_returns_none():
    """No alias and no canonical key → None."""
    row = {"unrelated": "x"}
    assert canonical_value(row, "store_name") is None


def test_canonical_value_empty_string_skipped():
    """Empty string treated as None (per writer convention)."""
    row = {"store_name": ""}
    assert canonical_value(row, "store_name") is None


# --- to_float ------------------------------------------------------------


def test_to_float_with_default_zero():
    """default=0.0 → product_summary / finance contract."""
    assert to_float(None, default=0.0) == 0.0
    assert to_float("", default=0.0) == 0.0
    assert to_float("not a number", default=0.0) == 0.0
    assert to_float("12.5", default=0.0) == 12.5
    assert to_float(7, default=0.0) == 7.0


def test_to_float_with_default_none():
    """default=None → review / inventory contract."""
    assert to_float(None, default=None) is None
    assert to_float("", default=None) is None
    assert to_float("nope", default=None) is None
    assert to_float("3.14", default=None) == 3.14


def test_to_float_default_is_none_when_omitted():
    """Default param defaults to None when caller doesn't pass it."""
    assert to_float(None) is None
    assert to_float("bad") is None


# --- to_date -------------------------------------------------------------


def test_to_date_iso_format():
    """YYYY-MM-DD → date."""
    assert to_date("2026-04-26") == date(2026, 4, 26)


def test_to_date_slash_format():
    """YYYY/MM/DD → date."""
    assert to_date("2026/04/26") == date(2026, 4, 26)


def test_to_date_with_time_suffix():
    """YYYY-MM-DD HH:MM:SS → date (time stripped)."""
    assert to_date("2026-04-26 14:30:00") == date(2026, 4, 26)


def test_to_date_invalid_returns_none():
    """Garbage string → None."""
    assert to_date("not a date") is None


def test_to_date_none_or_empty_returns_none():
    """None / empty → None."""
    assert to_date(None) is None
    assert to_date("") is None


def test_to_date_passthrough_date():
    """date input → same date (datetime is reduced)."""
    d = date(2026, 1, 1)
    assert to_date(d) is d
    dt = datetime(2026, 1, 1, 12, 0, 0)
    assert to_date(dt) == date(2026, 1, 1)


# --- pick ----------------------------------------------------------------


def test_pick_first_non_empty():
    """Returns first non-None / non-empty value."""
    row = {"a": "", "b": None, "c": "found", "d": "later"}
    assert pick(row, ("a", "b", "c", "d")) == "found"


def test_pick_all_missing_returns_none():
    """All keys missing → None."""
    row = {"x": 1}
    assert pick(row, ("a", "b")) is None


def test_pick_empty_keys_returns_none():
    """Empty key tuple → None."""
    assert pick({"a": 1}, ()) is None


# --- normalize_text ------------------------------------------------------


def test_normalize_text_strips_lowercases():
    """Whitespace collapsed + lowercase."""
    assert normalize_text("  Hello World  ") == "helloworld"


def test_normalize_text_handles_chinese():
    """Chinese chars unchanged; ASCII lowercased."""
    assert normalize_text("门店 A") == "门店a"


def test_normalize_text_empty_or_none():
    """Empty string / None → ''."""
    assert normalize_text("") == ""
    assert normalize_text(None) == ""  # type: ignore[arg-type]
