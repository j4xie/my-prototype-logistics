"""Unit tests for shrinkage_analysis section handler (P3.5C B4)."""
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.shrinkage_analysis import (
    ShrinkageAnalysisHandler,
)


def test_shrinkage_section_processes_rows_with_offender():
    """Real hotpot data: 3 departments with one clear offender."""
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={
            "shrinkage_rows": [
                {"department": "热菜", "standardCost": 50000, "actualCost": 52000},
                {"department": "冷菜", "standardCost": 20000, "actualCost": 20100},
                {"department": "刺身", "standardCost": 30000, "actualCost": 34000},
            ],
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    # Total variance: 2000 + 100 + 4000 = 6100
    assert resp.data["totalVarianceAmount"] == 6100
    # Offenders: 刺身 (13.3%) + 热菜 (4%) — both > 2%
    offenders = resp.data["topOffenders"]
    assert len(offenders) >= 2
    assert offenders[0]["department"] == "刺身"  # highest rate first
    # Action items generated
    assert len(resp.data["actionItems"]) >= 2


def test_shrinkage_section_accepts_snake_case_keys():
    """Backward compat: snake_case keys work as fallback."""
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            "shrinkage_rows": [
                {"department": "热菜", "standard_cost": 50000, "actual_cost": 52000},
            ],
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    assert resp.data["totalVarianceAmount"] == 2000


def test_shrinkage_section_skipped_without_rows():
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
    # Warning message should mention shrinkage_rows
    assert any("shrinkage_rows" in w for w in resp.warnings)


def test_shrinkage_section_handles_empty_rows():
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={"shrinkage_rows": []},
    )
    resp = h.compute(req, context={})
    # Empty list → skipped (no rows to analyze)
    assert resp.status == SectionStatus.SKIPPED


def test_shrinkage_section_invalid_row_format_skipped():
    """Malformed row dict → skipped with error warning."""
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={
            "shrinkage_rows": [
                {"department": "热菜"},  # missing cost fields
            ],
        },
    )
    resp = h.compute(req, context={})
    # Missing cost fields default to 0 — 0 vs 0 = no offender but shouldn't crash
    # Accept either OK (with zero variance) or SKIPPED (with error warning)
    assert resp.status in (SectionStatus.OK, SectionStatus.SKIPPED)


def test_shrinkage_section_bakery_departments():
    """Universal: bakery departments work too."""
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-BAKERY",
        upload_id=None,
        sub_sector="面包房",
        params={
            "shrinkage_rows": [
                {"department": "烘焙间", "standardCost": 30000, "actualCost": 32000},
                {"department": "面包房", "standardCost": 25000, "actualCost": 25500},
            ],
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    offender_depts = {o["department"] for o in resp.data["topOffenders"]}
    assert "烘焙间" in offender_depts  # 6.67% > 2%


def test_shrinkage_section_router_registration():
    """Regression: handler must be in the router HANDLERS dict."""
    from smartbi.api.restaurant_sections import HANDLERS
    assert "shrinkage_analysis" in HANDLERS
    assert HANDLERS["shrinkage_analysis"].section_name == "shrinkage_analysis"
