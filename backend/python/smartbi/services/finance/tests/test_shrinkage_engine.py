# -*- coding: utf-8 -*-
"""Unit tests for ShrinkageEngine (P3.5C B3)."""
import pytest

from smartbi.services.finance.shrinkage_engine import (
    ShrinkageEngine, ShrinkageRow,
)


def test_empty_input_returns_empty_report():
    engine = ShrinkageEngine()
    report = engine.analyze([])
    assert report.total_variance_amount == 0
    assert report.total_variance_rate == 0
    assert len(report.top_offenders) == 0
    assert len(report.action_items) == 0


def test_single_department_zero_variance():
    """Standard == actual → zero shrinkage, no offenders."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="热菜", standard_cost=50000, actual_cost=50000),
    ])
    assert report.total_variance_amount == 0
    assert report.total_variance_rate == 0
    assert len(report.top_offenders) == 0


def test_single_department_positive_variance_triggers_offender():
    """Actual > standard by >2% → offender with action item."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="热菜", standard_cost=50000, actual_cost=52000),
    ])
    # Variance = 2000, rate = 4%
    assert report.total_variance_amount == 2000
    assert report.total_variance_rate == pytest.approx(0.04, rel=0.01)
    # 4% > 2% threshold → offender
    assert len(report.top_offenders) == 1
    assert report.top_offenders[0].department == "热菜"
    # Action item generated
    assert len(report.action_items) == 1
    assert "热菜" in report.action_items[0].description


def test_small_variance_under_threshold_no_offender():
    """1% variance is under threshold → no offender, no action item."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="冷菜", standard_cost=20000, actual_cost=20100),
    ])
    # 0.5% variance
    assert len(report.top_offenders) == 0
    assert len(report.action_items) == 0
    # Total variance still tracked
    assert report.total_variance_amount == 100


def test_negative_variance_not_offender():
    """Actual < standard (good — came in under budget) is not an offender."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="铁板", standard_cost=15000, actual_cost=14850),
    ])
    assert report.total_variance_amount == -150
    assert len(report.top_offenders) == 0


def test_multi_department_ranking():
    """Offenders ranked by variance rate descending."""
    engine = ShrinkageEngine()
    rows = [
        ShrinkageRow(department="热菜", standard_cost=50000, actual_cost=52000),   # 4%
        ShrinkageRow(department="冷菜", standard_cost=20000, actual_cost=20100),   # 0.5%
        ShrinkageRow(department="刺身", standard_cost=30000, actual_cost=34000),   # 13.3%
        ShrinkageRow(department="铁板", standard_cost=15000, actual_cost=14850),   # -1% (good)
    ]
    report = engine.analyze(rows)

    # Total: 2000 + 100 + 4000 - 150 = 5950
    assert report.total_variance_amount == 5950
    # Offenders: 刺身 (13.3%) + 热菜 (4%) — only those >2%
    assert len(report.top_offenders) == 2
    assert report.top_offenders[0].department == "刺身"  # worst first
    assert report.top_offenders[1].department == "热菜"


def test_action_item_severity_tiers():
    """Suggestion text differs by variance severity."""
    engine = ShrinkageEngine()
    rows = [
        ShrinkageRow(department="light_offender", standard_cost=10000, actual_cost=10300),   # 3% (light)
        ShrinkageRow(department="medium_offender", standard_cost=10000, actual_cost=10700),  # 7% (medium)
        ShrinkageRow(department="heavy_offender", standard_cost=10000, actual_cost=11500),   # 15% (heavy)
    ]
    report = engine.analyze(rows)
    # All 3 are offenders
    assert len(report.action_items) == 3
    # Severity suggestion text varies
    by_dept = {a.responsible_department: a for a in report.action_items}
    assert "严重" in by_dept["heavy_offender"].suggestion_zh or "10%" in by_dept["heavy_offender"].suggestion_zh
    assert by_dept["light_offender"].suggestion_zh != by_dept["heavy_offender"].suggestion_zh


def test_zero_standard_cost_skipped():
    """Rows with standard=0 → rate undefined, skip offender check but still count total."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="热菜", standard_cost=0, actual_cost=1000),
    ])
    # Total variance still works
    assert report.total_variance_amount == 1000
    # No offender because rate is undefined
    assert len(report.top_offenders) == 0


def test_bakery_departments_universal():
    """Engine works for bakery structure too (烘焙间/面包房) — proves universality."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="烘焙间", standard_cost=30000, actual_cost=32000),   # 6.67%
        ShrinkageRow(department="面包房", standard_cost=25000, actual_cost=25500),   # 2%
        ShrinkageRow(department="裱花间", standard_cost=10000, actual_cost=9800),    # -2%
    ])
    # 烘焙间 is > 2% threshold → offender
    offender_depts = {r.department for r in report.top_offenders}
    assert "烘焙间" in offender_depts


def test_to_dict_serialization():
    """Report.to_dict() produces the expected camelCase JSON shape."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="热菜", standard_cost=50000, actual_cost=52000),
    ])
    d = report.to_dict()
    assert "rows" in d
    assert "totalVarianceAmount" in d
    assert "totalVarianceRate" in d
    assert "topOffenders" in d
    assert "actionItems" in d
    assert d["rows"][0]["department"] == "热菜"
    assert d["rows"][0]["standardCost"] == 50000
    assert d["rows"][0]["actualCost"] == 52000
    assert d["rows"][0]["varianceAmount"] == 2000
