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
