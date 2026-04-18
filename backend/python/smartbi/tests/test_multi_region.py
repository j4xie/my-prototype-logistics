"""
Bug #25b (2026-04-18): multi-stacked table region detection tests.

Covers:
- single table sheet → 1 region
- double stacked (sales + inventory with 3 blank rows) → 2 regions
- triple stacked → 3 regions
- empty sheet → 0 regions
- header-only region (no data rows) → 1 region with sample_rows=0
- fully-numeric block (continuation data) is rejected
- CSV-style rows fed directly to _split_regions_from_rows
"""
import os
import sys
from io import BytesIO
from typing import List, Any

import openpyxl
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.structure_detector import StructureDetector, TableRegion


def _make_xlsx(rows: List[List[Any]]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    wb.close()
    return buf.getvalue()


def test_single_table_one_region():
    rows = [
        ["日期", "产品", "销售额"],
        ["2026-01-01", "带鱼", 1000],
        ["2026-01-02", "黄鱼", 2000],
        ["2026-01-03", "石斑鱼", 1500],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))

    assert len(regions) == 1
    r = regions[0]
    assert r.start_row == 0
    assert r.end_row == 3
    assert r.header_row == 0
    assert r.preview_cols == ["日期", "产品", "销售额"]
    assert r.sample_rows == 3
    assert len(r.preview_data) == 3


def test_double_stacked_two_regions():
    rows = [
        ["销售日期", "产品", "金额"],
        ["2026-01-01", "带鱼", 1000],
        ["2026-01-02", "黄鱼", 2000],
        [None, None, None],
        [None, None, None],
        [None, None, None],
        ["仓库", "SKU", "库存"],
        ["A", "SKU-001", 50],
        ["B", "SKU-002", 80],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))

    assert len(regions) == 2
    assert regions[0].preview_cols == ["销售日期", "产品", "金额"]
    assert regions[0].start_row == 0
    assert regions[0].end_row == 2
    assert regions[1].preview_cols == ["仓库", "SKU", "库存"]
    assert regions[1].start_row == 6
    assert regions[1].end_row == 8


def test_triple_stacked_three_regions():
    rows = [
        ["A1", "A2"],
        [1, 2],
        [None, None],
        [None, None],
        ["B1", "B2"],
        [3, 4],
        [5, 6],
        [None, None],
        [None, None],
        ["C1", "C2"],
        [7, 8],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))

    assert len(regions) == 3
    assert [r.preview_cols for r in regions] == [
        ["A1", "A2"], ["B1", "B2"], ["C1", "C2"],
    ]


def test_empty_sheet_returns_zero_regions():
    wb = openpyxl.Workbook()
    buf = BytesIO()
    wb.save(buf)
    wb.close()
    detector = StructureDetector()
    assert detector.detect_multiple_table_regions(buf.getvalue()) == []


def test_header_only_region_no_data():
    rows = [
        ["列A", "列B", "列C"],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))

    assert len(regions) == 1
    assert regions[0].sample_rows == 0
    assert regions[0].preview_data == []


def test_single_blank_row_does_not_split():
    """A single blank row is not enough to separate regions."""
    rows = [
        ["日期", "金额"],
        ["2026-01-01", 100],
        [None, None],  # only 1 blank row
        ["2026-01-02", 200],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))

    assert len(regions) == 1
    assert regions[0].start_row == 0
    assert regions[0].end_row == 3


def test_fully_numeric_header_is_dropped():
    """A region whose first row is all numeric looks like continuation data."""
    rows = [
        ["日期", "金额"],
        ["2026-01-01", 100],
        [None, None],
        [None, None],
        [1, 2],  # header row is all-numeric → drop this region
        [3, 4],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))

    assert len(regions) == 1
    assert regions[0].preview_cols == ["日期", "金额"]


def test_trailing_blank_rows_trimmed():
    rows = [
        ["日期", "金额"],
        ["2026-01-01", 100],
        [None, None],
        [None, None],
        [None, None],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))

    assert len(regions) == 1
    assert regions[0].end_row == 1


def test_split_regions_from_rows_direct():
    """Shared splitter works on list-of-lists without going through openpyxl."""
    rows = [
        ["a", "b"],
        [1, 2],
        [None, None],
        [None, None],
        ["c", "d"],
        [3, 4],
    ]
    detector = StructureDetector()
    regions = detector._split_regions_from_rows(rows)

    assert len(regions) == 2
    assert regions[0].preview_cols == ["a", "b"]
    assert regions[1].preview_cols == ["c", "d"]


def test_region_index_is_monotonic():
    rows = [
        ["A"],
        [1],
        [None],
        [None],
        ["B"],
        [2],
        [None],
        [None],
        ["C"],
        [3],
    ]
    detector = StructureDetector()
    regions = detector.detect_multiple_table_regions(_make_xlsx(rows))
    assert [r.index for r in regions] == [0, 1, 2]


if __name__ == "__main__":
    # Allow running as `python test_multi_region.py` outside pytest
    pytest.main([__file__, "-v"])
