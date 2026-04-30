"""Task A5: Tests for smartbi_compat.date_range.DateRange.

Mirrors Java DateRangeUtils.rangeByPeriod ("month" branch).
Other branches raise NotImplementedError (YAGNI; defer until needed).
"""
from datetime import date
from unittest.mock import patch

import pytest

from smartbi_compat.date_range import DateRange


def test_by_period_month_mid_month():
    """Mid-month: range = 1st to last day of month."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2026, 4, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2026, 4, 1)
    assert r.end_date == date(2026, 4, 30)


def test_by_period_month_january():
    """January: month boundary at start of year."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2026, 1, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2026, 1, 1)
    assert r.end_date == date(2026, 1, 31)


def test_by_period_month_december():
    """December: handles year wrap correctly (Jan of next year - 1 day)."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2026, 12, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2026, 12, 1)
    assert r.end_date == date(2026, 12, 31)


def test_by_period_february_leap_year():
    """February in a leap year: 29 days."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2028, 2, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2028, 2, 1)
    assert r.end_date == date(2028, 2, 29)


def test_by_period_february_non_leap_year():
    """February in a non-leap year: 28 days."""
    with patch("smartbi_compat.date_range.date") as mock_date:
        mock_date.today.return_value = date(2026, 2, 15)
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        r = DateRange.by_period("month")
    assert r.start_date == date(2026, 2, 1)
    assert r.end_date == date(2026, 2, 28)


def test_by_period_unsupported_raises():
    """Other branches deferred per YAGNI; raise NotImplementedError."""
    with pytest.raises(NotImplementedError):
        DateRange.by_period("week")


def test_dataclass_is_frozen():
    """Frozen invariant: DateRange instances are immutable."""
    import dataclasses
    r = DateRange(date(2026, 4, 1), date(2026, 4, 30))
    with pytest.raises(dataclasses.FrozenInstanceError):
        r.start_date = date(2026, 5, 1)
