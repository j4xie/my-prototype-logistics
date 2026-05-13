"""Tests for ingestion._filename_stripper.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 step ①
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task B1
"""
from smartbi.ingestion._filename_stripper import strip_pos_prefix


def test_strips_17digit_hash_prefix():
    # Real 二维火 export: 17-digit timestamp + underscore + hex hash + underscore + Chinese name
    assert strip_pos_prefix(
        "20260422101444628_8e07f831c81_营业概况报表.csv"
    ) == "营业概况报表.csv"


def test_keeps_filename_without_prefix():
    """Bare filename (no 17-digit prefix) must pass through unchanged."""
    assert strip_pos_prefix("营业概况报表.csv") == "营业概况报表.csv"


def test_strips_only_one_prefix():
    """Avoid double-strip if user re-exports a previously-prefixed file."""
    assert strip_pos_prefix(
        "20260422101444628_abc_20250101120000000_def_x.csv"
    ) == "20250101120000000_def_x.csv"


def test_handles_zip_extension():
    """Prefix strip is extension-agnostic — also works on .zip / .xlsx / .xls."""
    assert strip_pos_prefix(
        "20260422101444628_abc_详细日报表.zip"
    ) == "详细日报表.zip"


def test_real_2dfire_filenames_from_qhj_dataset():
    """Spot-check against real customer dataset filenames."""
    cases = [
        ("20260422101444628_8e07f831c81_营业概况报表（兼容月报表）.csv",
         "营业概况报表（兼容月报表）.csv"),
        ("20260422102057548_8ebf92a0d41_堂食外卖占比表.csv",
         "堂食外卖占比表.csv"),
        ("20260422102505360_2d8c777d3a1_详细日报表.csv",
         "详细日报表.csv"),
        ("20260422102412536_76d657c5d61_区域销售报表.csv",
         "区域销售报表.csv"),
    ]
    for raw, expected in cases:
        assert strip_pos_prefix(raw) == expected, f"failed on {raw}"
