"""
Bug #25b Phase 2 smoke — sanity-check the /detect-regions endpoint in isolation.

This does NOT boot a full FastAPI app; it calls the route function directly
with a mock UploadFile so we confirm the wiring works before integration.
"""
import os
import sys
from io import BytesIO
from typing import List, Any

import openpyxl
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# The endpoint lives in smartbi.api.excel — import function and DTOs.
from smartbi.api.excel import detect_table_regions, DetectRegionsResponse  # noqa: E402


def _make_xlsx(rows: List[List[Any]]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    wb.close()
    return buf.getvalue()


class _MockUpload:
    """Minimal stand-in for FastAPI UploadFile so we can invoke the coroutine."""

    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


@pytest.mark.asyncio
async def test_endpoint_double_stacked():
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
    content = _make_xlsx(rows)
    upload = _MockUpload("stacked.xlsx", content)

    resp = await detect_table_regions(
        file=upload,  # type: ignore[arg-type]
        sheet_index=0,
        sheetIndex=None,
        sheet_name=None,
        min_blank_separator=2,
    )

    assert isinstance(resp, DetectRegionsResponse)
    assert resp.success is True
    assert resp.totalRegions == 2
    assert resp.regions[0].previewCols == ["销售日期", "产品", "金额"]
    assert resp.regions[1].previewCols == ["仓库", "SKU", "库存"]
    assert resp.regions[0].startRow == 0
    assert resp.regions[1].startRow == 6


@pytest.mark.asyncio
async def test_endpoint_single_region():
    rows = [
        ["a", "b"],
        [1, 2],
        [3, 4],
    ]
    content = _make_xlsx(rows)
    upload = _MockUpload("single.xlsx", content)

    resp = await detect_table_regions(
        file=upload,  # type: ignore[arg-type]
        sheet_index=0,
        sheetIndex=None,
        sheet_name=None,
        min_blank_separator=2,
    )
    assert resp.success is True
    assert resp.totalRegions == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
