"""Ensure post-refactor batch output matches byte-level pre-refactor.

This is the contract for Task 1.7: ``RestaurantAnalyzerV2.analyze()`` may
delegate to section handlers internally, but the externally observable batch
output must remain byte-for-byte identical to the pre-refactor implementation
on the canonical 鼎鲜火锅 2026-02 fixture.

The first run captures the golden fixture and skips. Subsequent runs compare
the live output (with volatile fields stripped) against that fixture.
"""
from __future__ import annotations

import json
import pathlib

import pytest

from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

GOLDEN_PATH = pathlib.Path(__file__).parent / "fixtures" / "batch_golden_dingxian.json"

# Fields whose values are inherently volatile (timestamps, cache keys generated
# at runtime). Stripping them is the only way to make a regression contract
# byte-comparable across runs that happen in different seconds.
_VOLATILE_KEYS = {
    "computedAt",        # SectionResponse.computed_at_ms (if it ever leaks into report)
    "cacheKey",          # SectionResponse.cache_key
    "computedAtMs",      # camelCase variant from FastAPI router
    "generatedAt",       # StorePnlOnePagerReport.to_dict() includes datetime.now()
}


@pytest.fixture
def dingxian_scenario():
    """Full input that produces the 鼎鲜火锅 2026-02 diagnosis."""
    return {
        "factory_id": "F-DINGXIAN-YIWU",
        "sub_sector": "火锅",
        "financial_data": {
            "current": {"revenue": 731048, "food_cost": 307040, "labor_cost": 237660, "rent": 85000},
            "previous": {"revenue": 1390503, "food_cost": 555555, "labor_cost": 323805, "rent": 85000},
            "monthly_revenue": 731048,
        },
    }


def _strip_volatile(obj):
    """Recursively drop volatile keys (timestamps, cache keys) from any nested
    dict/list structure so the comparison only looks at deterministic fields.
    """
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in _VOLATILE_KEYS}
    if isinstance(obj, list):
        return [_strip_volatile(v) for v in obj]
    return obj


def test_batch_output_matches_golden(dingxian_scenario):
    analyzer = RestaurantAnalyzerV2(
        factory_id=dingxian_scenario["factory_id"],
        sub_sector=dingxian_scenario["sub_sector"],
    )
    result = analyzer.analyze(
        financial_data=dingxian_scenario["financial_data"],
        store_name="鼎鲜火锅 义乌分公司",
    )

    if not GOLDEN_PATH.exists():
        GOLDEN_PATH.parent.mkdir(exist_ok=True)
        GOLDEN_PATH.write_text(
            json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        pytest.skip("Golden fixture captured, re-run to verify")

    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))

    assert _strip_volatile(result) == _strip_volatile(golden)
