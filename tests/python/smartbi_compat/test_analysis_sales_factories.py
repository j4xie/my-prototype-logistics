"""Unit tests for analysis_sales.py dict factories + helpers."""
from __future__ import annotations

import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "backend" / "python"))

from smartbi_compat.api.analysis_sales import _strip_volatile


class TestStripVolatile:
    def test_removes_generated_at(self):
        obj = {"generatedAt": "2026-04-30T06:34:34", "kpiCards": []}
        assert _strip_volatile(obj) == {"kpiCards": []}

    def test_removes_last_updated(self):
        obj = {"lastUpdated": "2026-04-30T06:34:34", "value": 42}
        assert _strip_volatile(obj) == {"value": 42}

    def test_removes_cache_expire_at(self):
        obj = {"cacheExpireAt": None, "fromCache": False}
        assert _strip_volatile(obj) == {"fromCache": False}

    def test_removes_timestamp(self):
        obj = {"timestamp": "x", "data": [1, 2]}
        assert _strip_volatile(obj) == {"data": [1, 2]}

    def test_recursive_dict(self):
        obj = {
            "outer": {"inner": {"generatedAt": "x", "value": 1}},
            "lastUpdated": "y",
        }
        assert _strip_volatile(obj) == {"outer": {"inner": {"value": 1}}}

    def test_recursive_list(self):
        obj = [{"generatedAt": "x", "id": 1}, {"id": 2}]
        assert _strip_volatile(obj) == [{"id": 1}, {"id": 2}]

    def test_preserves_non_volatile(self):
        obj = {"name": "abc", "amount": 12.34, "items": [1, 2, 3]}
        assert _strip_volatile(obj) == obj

    def test_handles_primitives(self):
        assert _strip_volatile(42) == 42
        assert _strip_volatile("hello") == "hello"
        assert _strip_volatile(None) is None


from datetime import date
from smartbi_compat.api.analysis_sales import _new_date_range_dict
from smartbi_compat.date_range import DateRange


class TestDateRangeDict:
    def test_F999_observed_shape(self):
        """Match F999 golden 7-field shape: 5 declared + 2 derived."""
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        result = _new_date_range_dict(r)
        assert set(result.keys()) == {
            "startDate", "endDate", "granularity",
            "originalExpression", "relative", "days", "valid",
        }
        assert result["startDate"] == "2025-01-01"
        assert result["endDate"] == "2025-12-31"
        assert result["days"] == 365
        assert result["valid"] is True

    def test_key_order_matches_F999(self):
        """Foundation §3 R9: dict key order must match Java HashMap iteration order."""
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        keys = list(_new_date_range_dict(r).keys())
        # Order observed in F999 golden
        assert keys == [
            "startDate", "endDate", "granularity",
            "originalExpression", "relative", "days", "valid",
        ]

    def test_one_day_range(self):
        r = DateRange.custom(date(2025, 6, 15), date(2025, 6, 15))
        result = _new_date_range_dict(r)
        assert result["days"] == 1
        assert result["valid"] is True

    def test_invalid_range(self):
        """end before start → valid=False."""
        r = DateRange.custom(date(2025, 12, 31), date(2025, 1, 1))
        result = _new_date_range_dict(r)
        assert result["valid"] is False
