"""DateRange dataclass mirroring DateRangeUtils.DateRange (Java side).

Only the ``"month"`` branch of rangeByPeriod is implemented because /alerts
is the only Phase 2A endpoint using it. Other branches (today/week/quarter/
year/default-30d) raise NotImplementedError until a downstream endpoint
demands them (YAGNI).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class DateRange:
    start_date: date
    end_date: date

    @classmethod
    def custom(cls, start: date, end: date) -> "DateRange":
        """Create a DateRange with explicit start and end dates."""
        return cls(start, end)

    @classmethod
    def by_period(cls, period: str) -> "DateRange":
        """Mirror DateRangeUtils.rangeByPeriod (Java).

        Java semantics (per DateRangeUtils.java):
          - "month": [1st of current month, last day of current month] inclusive
        """
        today = date.today()
        if period == "month":
            start = today.replace(day=1)
            if today.month == 12:
                next_month_first = date(today.year + 1, 1, 1)
            else:
                next_month_first = date(today.year, today.month + 1, 1)
            end = next_month_first - timedelta(days=1)
            return cls(start, end)
        raise NotImplementedError(
            f"DateRange.by_period({period!r}) not yet ported. "
            "Add the branch when a Phase 2A endpoint requires it."
        )

    @property
    def days(self) -> int:
        """Inclusive day count between start_date and end_date."""
        return (self.end_date - self.start_date).days + 1

    @property
    def valid(self) -> bool:
        """True iff start_date <= end_date."""
        return self.start_date <= self.end_date
