"""Unit tests for MonthlyPptExporter (P3.5D P2)."""
from pathlib import Path

import pytest

from smartbi.services.reporting.monthly_ppt_exporter import MonthlyPptExporter


def test_exporter_creates_valid_pptx_file(tmp_path):
    """Basic export: store_name + period + financial_metrics → valid .pptx file."""
    exporter = MonthlyPptExporter()
    output = exporter.export(
        store_name="鼎鲜火锅·义乌分公司",
        period="2026-02",
        financial_metrics={
            "revenue": 731048,
            "foodCost": 307040,
            "laborCost": 237660,
            "grossMarginFolded": 58.0,
            "netProfit": -49724,
        },
        diagnostics=[],
        output_path=tmp_path / "monthly_test.pptx",
    )
    assert output.exists()
    assert output.stat().st_size > 20000  # valid pptx > 20 KB


def test_exporter_has_19_slides(tmp_path):
    """Export preserves 19-slide template structure."""
    from pptx import Presentation

    exporter = MonthlyPptExporter()
    output = exporter.export(
        store_name="Test Store",
        period="2026-02",
        financial_metrics={"revenue": 100000},
        diagnostics=[],
        output_path=tmp_path / "test.pptx",
    )
    prs = Presentation(str(output))
    assert len(prs.slides) == 19


def test_exporter_handles_all_optional_sections(tmp_path):
    """All optional sections populated → no crashes, valid output."""
    exporter = MonthlyPptExporter()
    output = exporter.export(
        store_name="Test Store",
        period="2026-02",
        financial_metrics={
            "revenue": 731048,
            "foodCost": 307040,
            "laborCost": 237660,
            "grossMarginFolded": 58.0,
            "netProfit": -49724,
        },
        diagnostics=[],
        department_breakdown={
            "departments": [
                {"code": "热菜", "nameZh": "热菜档", "laborCost": 80000, "headCount": 8, "laborShare": 0.31, "perHeadCost": 10000},  # noqa: E501
                {"code": "前厅服务员", "nameZh": "前厅服务员", "laborCost": 50000, "headCount": 15, "laborShare": 0.19, "perHeadCost": 3333},  # noqa: E501
            ],
            "aggregated": {"后厨": 180000, "前厅": 65000},
            "totalLaborCost": 245000,
            "laborRevenueRatio": 0.335,
        },
        shrinkage_report={
            "rows": [
                {"department": "刺身", "standardCost": 30000, "actualCost": 34000, "varianceAmount": 4000, "varianceRate": 0.1333},  # noqa: E501
            ],
            "totalStandardCost": 30000,
            "totalActualCost": 34000,
            "totalVarianceAmount": 4000,
            "totalVarianceRate": 0.1333,
            "actionItems": [],
            "topOffenders": [],
        },
        expense_breakdown={
            "topAccounts": [
                {"code": "工资", "nameZh": "工资", "value": 237660},
                {"code": "房租费", "nameZh": "房租费", "value": 85000},
                {"code": "充卡赠送", "nameZh": "充卡赠送", "value": 51680},
            ],
            "aggregated": {},
            "treeId": "hotpot_default",
        },
        output_path=tmp_path / "full.pptx",
    )
    assert output.exists()
    assert output.stat().st_size > 20000


def test_exporter_raises_on_missing_template():
    """Missing template file → FileNotFoundError at construction."""
    bad_path = Path("/nonexistent/template.pptx")
    with pytest.raises(FileNotFoundError):
        MonthlyPptExporter(template_path=bad_path)


def test_exporter_handles_empty_optional_sections(tmp_path):
    """All optional params default to None — no crashes."""
    exporter = MonthlyPptExporter()
    output = exporter.export(
        store_name="Test",
        period="2026-02",
        financial_metrics={"revenue": 100000},
        diagnostics=[],
        department_breakdown=None,
        shrinkage_report=None,
        expense_breakdown=None,
        output_path=tmp_path / "empty.pptx",
    )
    assert output.exists()
