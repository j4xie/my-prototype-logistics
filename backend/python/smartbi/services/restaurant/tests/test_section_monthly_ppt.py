"""Unit tests for monthly_ppt_export section handler (P3.5D P3)."""
from pathlib import Path

import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.monthly_ppt_export import (
    MonthlyPptExportHandler,
)


def test_monthly_ppt_section_generates_file():
    """Full happy path: generates a valid .pptx, returns path + download URL."""
    h = MonthlyPptExportHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        store_name="鼎鲜火锅·义乌分公司",
        period="2026-02",
        params={
            "financial_metrics": {
                "revenue": 731048,
                "foodCost": 307040,
                "laborCost": 237660,
                "grossMarginFolded": 58.0,
                "netProfit": -49724,
            },
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    assert "pptPath" in resp.data
    assert "downloadUrl" in resp.data
    assert "pptSizeBytes" in resp.data

    ppt_path = Path(resp.data["pptPath"])
    assert ppt_path.exists()
    assert ppt_path.stat().st_size > 20000  # valid .pptx
    # Download URL should include the factory_id + period
    assert "F-DINGXIAN-YIWU" in resp.data["downloadUrl"]
    assert "2026-02" in resp.data["downloadUrl"]


def test_monthly_ppt_section_skipped_without_metrics():
    """Missing financial_metrics → SKIPPED with warning."""
    h = MonthlyPptExportHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
    assert any("financial_metrics" in w for w in resp.warnings)


def test_monthly_ppt_section_with_all_optional_params():
    """Full params: financial + department + shrinkage + expense — all populated."""
    h = MonthlyPptExportHandler()
    req = SectionRequest(
        factory_id="F-FULL",
        upload_id=None,
        sub_sector="火锅",
        store_name="测试店",
        period="2026-03",
        params={
            "financial_metrics": {"revenue": 100000, "foodCost": 40000},
            "department_breakdown": {
                "departments": [
                    {"code": "热菜", "nameZh": "热菜", "laborCost": 20000, "headCount": 5, "laborShare": 0.5, "perHeadCost": 4000},
                ],
                "aggregated": {"后厨": 20000},
                "totalLaborCost": 20000,
            },
            "shrinkage_report": {
                "rows": [{"department": "热菜", "standardCost": 5000, "actualCost": 5200, "varianceAmount": 200, "varianceRate": 0.04}],
                "totalStandardCost": 5000,
                "totalActualCost": 5200,
                "totalVarianceAmount": 200,
                "totalVarianceRate": 0.04,
            },
            "expense_breakdown": {
                "topAccounts": [{"code": "工资", "nameZh": "工资", "value": 20000}],
                "aggregated": {},
                "treeId": "hotpot_default",
            },
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    ppt_path = Path(resp.data["pptPath"])
    assert ppt_path.exists()


def test_monthly_ppt_section_registered_in_router():
    """Regression: handler must be in HANDLERS dict."""
    from smartbi.api.restaurant_sections import HANDLERS
    assert "monthly_ppt_export" in HANDLERS
    assert HANDLERS["monthly_ppt_export"].section_name == "monthly_ppt_export"
