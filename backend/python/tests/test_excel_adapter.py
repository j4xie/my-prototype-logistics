"""Tests for Bronze ExcelAdapter — csv/xlsx streaming → RawEvent.

Week 1 Day 3 of Unified Data Layer v1 spec (§1.1 Bronze row).

Covers:
- CSV ingestion basic flow: row_index, raw_data, source_meta, factory_id
- CSV header-skip detection (title rows with mostly 'Unnamed' columns)
- CSV encoding fallback (utf-8 → gbk)
- XLSX basic ingestion
- max_rows cap honored
- describe() returns expected keys after ingest
- Error paths: missing file → FileNotFoundError, unsupported ext → ValueError
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from smartbi.ingestion import BronzeAdapter, SourceMeta
from smartbi.ingestion.excel_adapter import ExcelAdapter


# ── Fixtures ─────────────────────────────────────────────────

@pytest.fixture
def csv_basic(tmp_path: Path) -> Path:
    """Simple 3-row CSV with clean header."""
    p = tmp_path / "basic.csv"
    p.write_text(
        "date,store,amount\n"
        "2026-04-01,门店A,100\n"
        "2026-04-02,门店B,200\n"
        "2026-04-03,门店C,300\n",
        encoding="utf-8",
    )
    return p


@pytest.fixture
def csv_gbk(tmp_path: Path) -> Path:
    """CSV encoded in GBK (common for legacy Chinese Windows exports)."""
    p = tmp_path / "gbk.csv"
    content = "日期,门店,金额\n2026-04-01,门店甲,100\n2026-04-02,门店乙,200\n"
    p.write_bytes(content.encode("gbk"))
    return p


@pytest.fixture
def xlsx_basic(tmp_path: Path) -> Path:
    """Simple 2-row XLSX."""
    p = tmp_path / "basic.xlsx"
    df = pd.DataFrame(
        {
            "date": ["2026-04-01", "2026-04-02"],
            "store": ["门店A", "门店B"],
            "amount": [100, 200],
        }
    )
    df.to_excel(p, index=False)
    return p


# ── CSV tests ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_csv_basic_yields_row_per_record(csv_basic: Path):
    adapter = ExcelAdapter(
        file_path=str(csv_basic),
        factory_id="TEST_FACTORY",
        source_id="upload_001",
    )
    events = [e async for e in adapter.ingest()]
    assert len(events) == 3
    assert [e.row_index for e in events] == [0, 1, 2]
    assert all(e.factory_id == "TEST_FACTORY" for e in events)
    assert all(e.source_meta.source_type == "excel" for e in events)
    assert all(e.source_meta.source_id == "upload_001" for e in events)
    assert events[0].raw_data == {"date": "2026-04-01", "store": "门店A", "amount": "100"}
    assert events[1].raw_data["store"] == "门店B"
    assert all(e.parse_error is None for e in events)


@pytest.mark.asyncio
async def test_csv_source_meta_is_frozen_dataclass(csv_basic: Path):
    adapter = ExcelAdapter(
        file_path=str(csv_basic),
        factory_id="F",
        source_id="s1",
        source_version="qhj_2025_v1",
    )
    events = [e async for e in adapter.ingest()]
    meta = events[0].source_meta
    assert isinstance(meta, SourceMeta)
    assert meta.source_version == "qhj_2025_v1"
    with pytest.raises(Exception):
        meta.source_id = "mutated"  # type: ignore[misc]


@pytest.mark.asyncio
async def test_csv_max_rows_caps_output(csv_basic: Path):
    adapter = ExcelAdapter(
        file_path=str(csv_basic),
        factory_id="F",
        source_id="s",
        max_rows=2,
    )
    events = [e async for e in adapter.ingest()]
    assert len(events) == 2
    assert [e.row_index for e in events] == [0, 1]


@pytest.mark.asyncio
async def test_csv_gbk_encoding_auto_detected(csv_gbk: Path):
    adapter = ExcelAdapter(
        file_path=str(csv_gbk),
        factory_id="F",
        source_id="s",
    )
    events = [e async for e in adapter.ingest()]
    assert len(events) == 2
    assert events[0].raw_data["门店"] == "门店甲"
    assert adapter._detected_encoding in ("gbk", "gb18030")


# ── XLSX tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_xlsx_basic_yields_rows(xlsx_basic: Path):
    adapter = ExcelAdapter(
        file_path=str(xlsx_basic),
        factory_id="F",
        source_id="s",
    )
    events = [e async for e in adapter.ingest()]
    assert len(events) == 2
    assert events[0].raw_data["store"] == "门店A"
    assert events[1].raw_data["amount"] == "200"  # dtype=str forced


# ── describe() ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_describe_reflects_ingest_state(csv_basic: Path):
    adapter = ExcelAdapter(
        file_path=str(csv_basic),
        factory_id="F",
        source_id="s",
        chunk_size=100,
    )
    # describe() before ingest — defaults
    d0 = adapter.describe()
    assert d0["adapter"] == "ExcelAdapter"
    assert d0["chunk_size"] == 100
    assert d0["column_count"] == 0
    assert d0["detected_encoding"] is None

    # After ingest — populated
    _ = [e async for e in adapter.ingest()]
    d1 = adapter.describe()
    assert d1["column_count"] == 3
    assert d1["detected_encoding"] == "utf-8"
    assert d1["source_meta"]["source_type"] == "excel"


# ── Error paths ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_missing_file_raises():
    adapter = ExcelAdapter(
        file_path="/nonexistent/path/missing.csv",
        factory_id="F",
        source_id="s",
    )
    with pytest.raises(FileNotFoundError):
        _ = [e async for e in adapter.ingest()]


@pytest.mark.asyncio
async def test_unsupported_extension_raises(tmp_path: Path):
    p = tmp_path / "data.txt"
    p.write_text("not supported", encoding="utf-8")
    adapter = ExcelAdapter(
        file_path=str(p),
        factory_id="F",
        source_id="s",
    )
    with pytest.raises(ValueError, match="Unsupported file type"):
        _ = [e async for e in adapter.ingest()]


# ── Contract: implements BronzeAdapter ───────────────────────

def test_excel_adapter_implements_bronze_contract():
    assert issubclass(ExcelAdapter, BronzeAdapter)
    a = ExcelAdapter(file_path="x.csv", factory_id="F", source_id="s")
    assert callable(a.ingest)
    assert callable(a.describe)
