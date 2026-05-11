"""Unit tests for scripts/etl/normalize_restaurant_chains.py (Sub-ETL-1 pilot).

Per dispatch §Phase 2:
- Happy path: 14 chains canonical normalize
- Edge: missing column / wrong type / empty file
- >=10 tests

Tests use in-memory CSV fixtures + tmp_path for file-level tests. No DB, no network.
"""
from __future__ import annotations

import csv
import importlib.util
import io
import json
import sys
from pathlib import Path

import pytest

# scripts/etl/ is operational (not a Python package per Q-ETL-5). Load by file path.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_NORMALIZER_PATH = _PROJECT_ROOT / "scripts" / "etl" / "normalize_restaurant_chains.py"
_spec = importlib.util.spec_from_file_location(
    "normalize_restaurant_chains", _NORMALIZER_PATH,
)
assert _spec is not None and _spec.loader is not None, f"cannot load {_NORMALIZER_PATH}"
N = importlib.util.module_from_spec(_spec)
sys.modules["normalize_restaurant_chains"] = N
_spec.loader.exec_module(N)


# ──────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────

CANONICAL_HEADER_ZH = list(N.PRODUCT_SALES_HEADER_MAP.keys())  # 19 cols, order preserved


def make_csv_text(banner_lines: int = 3, data_rows: list[list[str]] | None = None) -> str:
    """Build an in-memory CSV string mimicking real banner + header + data.

    Real CSVs from 大众点评 have ~3-4 banner lines before header. Default builds:
      Line 1: empty banner
      Line 2: "门店名称:xxx"
      Line 3: "查询条件:..."
      Line 4: header row (Chinese)
      Line 5+: data rows
    """
    if data_rows is None:
        data_rows = [
            ["京熹顺南京店", "小料", "", "", "自助小料", "", "餐饮商品", "单品",
             "624.00", "624.00", "0.00", "0.00", "份", "10.00", "6240.00",
             "6240.00", "873.88", "0.00", "5366.12"],
        ]
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    for _ in range(banner_lines):
        w.writerow([""] * 19)
    w.writerow(CANONICAL_HEADER_ZH)
    for r in data_rows:
        w.writerow(r)
    return buf.getvalue()


@pytest.fixture
def il_teatro_chain() -> N.ChainEntry:
    return N.CHAIN_BY_FACTORY_ID["R_ILTEATRO_REAL"]


@pytest.fixture
def dongmenkou_chain() -> N.ChainEntry:
    return N.CHAIN_BY_FACTORY_ID["R_DONGMENKOU_REAL"]


# ──────────────────────────────────────────────────────────────────
# Format detection (Sub-ETL-1a)
# ──────────────────────────────────────────────────────────────────

def test_detect_format_xls() -> None:
    assert N.detect_format(Path("a.xls")) == "xls"


def test_detect_format_xlsx() -> None:
    assert N.detect_format(Path("a.xlsx")) == "xlsx"


def test_detect_format_csv() -> None:
    assert N.detect_format(Path("a.csv")) == "csv"


def test_detect_format_uppercase_extension() -> None:
    assert N.detect_format(Path("REPORT.CSV")) == "csv"


def test_detect_format_unsupported_raises() -> None:
    with pytest.raises(ValueError, match="unsupported extension"):
        N.detect_format(Path("a.pdf"))


def test_detect_format_none_path_raises() -> None:
    with pytest.raises(ValueError):
        N.detect_format(None)  # type: ignore[arg-type]


# ──────────────────────────────────────────────────────────────────
# Chain matching (14-chain catalog completeness)
# ──────────────────────────────────────────────────────────────────

def test_chain_catalog_has_14_entries() -> None:
    """Q1 §4.3 / spec §1.4 says exactly 14 real chains."""
    assert len(N.CHAIN_CATALOG) == 14


def test_chain_catalog_factory_ids_are_unique() -> None:
    ids = [c.factory_id for c in N.CHAIN_CATALOG]
    assert len(set(ids)) == 14, f"duplicate factory_ids: {ids}"


def test_chain_catalog_naming_convention() -> None:
    """All 14 factory_ids follow R_<name>_REAL pattern per Q1 §4.3 footnote."""
    for c in N.CHAIN_CATALOG:
        assert c.factory_id.startswith("R_"), c.factory_id
        assert c.factory_id.endswith("_REAL"), c.factory_id


def test_match_chain_iltetro() -> None:
    p = Path("smartbi维度分析/大众点评/真实餐饮连锁数据/IL TEATRO（西餐厅）2月_商品销量报表.xls")
    matched = N.match_chain_for_path(p)
    assert matched is not None
    assert matched.factory_id == "R_ILTEATRO_REAL"


def test_match_chain_unknown_returns_none() -> None:
    p = Path("smartbi维度分析/大众点评/真实餐饮连锁数据/20260306_unknown_chain.xlsx")
    assert N.match_chain_for_path(p) is None


def test_match_chain_dongmenkou_traditional_chars() -> None:
    """东门口 and 東門口 (traditional variant) BOTH map to R_DONGMENKOU_REAL."""
    p_simplified = Path("smartbi维度分析/.../东门口2月.csv")
    p_traditional = Path("smartbi维度分析/.../東門口會員店.xlsx")
    assert N.match_chain_for_path(p_simplified).factory_id == "R_DONGMENKOU_REAL"
    assert N.match_chain_for_path(p_traditional).factory_id == "R_DONGMENKOU_REAL"


def test_match_chain_subdir_basename() -> None:
    """5-month subdirs (鸿德记5个月/) match the chain via path-substring."""
    p = Path("smartbi维度分析/大众点评/真实餐饮连锁数据/鸿德记5个月/2025-03.xlsx")
    matched = N.match_chain_for_path(p)
    assert matched is not None
    assert matched.factory_id == "R_HONGDEJI_REAL"


# ──────────────────────────────────────────────────────────────────
# Report type detection + banner skip
# ──────────────────────────────────────────────────────────────────

def test_detect_report_type_product_sales_full_header() -> None:
    assert N.detect_report_type(CANONICAL_HEADER_ZH) == N.REPORT_PRODUCT_SALES


def test_detect_report_type_partial_header_above_threshold() -> None:
    # 10 of 19 columns present (heuristic threshold).
    partial = CANONICAL_HEADER_ZH[:10] + ["junk"] * 5
    assert N.detect_report_type(partial) == N.REPORT_PRODUCT_SALES


def test_detect_report_type_unsupported_profit_report() -> None:
    # Profit report has wholly different columns.
    profit = ["科目", "本期金额", "去年同期", "增减率"]
    assert N.detect_report_type(profit) == N.REPORT_UNSUPPORTED


def test_detect_report_type_empty_header_unsupported() -> None:
    assert N.detect_report_type([]) == N.REPORT_UNSUPPORTED


def test_find_header_row_after_3_banner_rows() -> None:
    rows = [
        [""] * 19,
        ["门店名称:xxx"] + [""] * 18,
        ["查询条件:..."] + [""] * 18,
        CANONICAL_HEADER_ZH,
        ["京熹顺南京店"] + [""] * 18,
    ]
    assert N.find_header_row(rows) == 3


def test_find_header_row_not_found_returns_negative_one() -> None:
    rows = [[""] * 19] * 5
    assert N.find_header_row(rows) == -1


# ──────────────────────────────────────────────────────────────────
# Numeric coercion (Q-ETL-6 fail-loud)
# ──────────────────────────────────────────────────────────────────

def test_coerce_numeric_valid_float() -> None:
    assert N.coerce_numeric("10.50") == 10.5


def test_coerce_numeric_negative() -> None:
    assert N.coerce_numeric("-5.25") == -5.25


def test_coerce_numeric_empty_returns_none() -> None:
    """Empty source value -> NULL (NOT silent default to 0.0 per Rule 1)."""
    assert N.coerce_numeric("") is None
    assert N.coerce_numeric("   ") is None


def test_coerce_numeric_invalid_raises() -> None:
    with pytest.raises(ValueError, match="non-numeric"):
        N.coerce_numeric("abc")


def test_coerce_numeric_none_input() -> None:
    assert N.coerce_numeric(None) is None  # type: ignore[arg-type]


# ──────────────────────────────────────────────────────────────────
# Row normalization
# ──────────────────────────────────────────────────────────────────

def _valid_raw_row() -> dict[str, str]:
    return {
        "store_name": "京熹顺南京店",
        "product_category": "小料",
        "revenue_group": "",
        "product_code": "",
        "product_name": "自助小料",
        "spec": "",
        "product_type": "餐饮商品",
        "order_method": "单品",
        "qty_single": "624.00",
        "qty_total": "624.00",
        "qty_refund": "0.00",
        "qty_combo_child": "0.00",
        "unit": "份",
        "unit_price": "10.00",
        "gross_amount": "6240.00",
        "net_after_discount": "6240.00",
        "discount_allocated": "873.88",
        "refund_amount": "0.00",
        "actual_receive": "5366.12",
    }


def test_normalize_row_happy_path(il_teatro_chain: N.ChainEntry) -> None:
    raw = _valid_raw_row()
    canonical, events = N.normalize_row(raw, "2月报表", il_teatro_chain, 5)
    assert events == []
    assert canonical is not None
    assert canonical["store_name"] == "京熹顺南京店"
    assert canonical["qty_total"] == 624.0
    assert canonical["actual_receive"] == 5366.12
    assert canonical["revenue_group"] is None  # blank source -> NULL (not "")
    assert canonical["product_code"] is None


def test_normalize_row_missing_required_field_quarantines(il_teatro_chain: N.ChainEntry) -> None:
    raw = _valid_raw_row()
    raw["store_name"] = ""  # required
    canonical, events = N.normalize_row(raw, "2月报表", il_teatro_chain, 5)
    assert canonical is None
    assert len(events) == 1
    assert events[0].reason == N.QR_EMPTY_REQUIRED_FIELD
    assert events[0].line_no == 5
    assert events[0].chain_factory_id == "R_ILTEATRO_REAL"


def test_normalize_row_non_numeric_in_numeric_col_quarantines(il_teatro_chain: N.ChainEntry) -> None:
    raw = _valid_raw_row()
    raw["qty_total"] = "abc"  # numeric col, junk value
    canonical, events = N.normalize_row(raw, "2月报表", il_teatro_chain, 5)
    assert canonical is None
    assert any(ev.reason == N.QR_NON_NUMERIC_NUMERIC_FIELD for ev in events)


def test_normalize_row_blank_numeric_preserved_as_none(il_teatro_chain: N.ChainEntry) -> None:
    raw = _valid_raw_row()
    raw["discount_allocated"] = ""  # numeric col, blank -> NULL not 0.0 (Rule 1)
    canonical, events = N.normalize_row(raw, "2月报表", il_teatro_chain, 5)
    assert events == []
    assert canonical is not None
    assert canonical["discount_allocated"] is None


# ──────────────────────────────────────────────────────────────────
# File-level pipeline + idempotence
# ──────────────────────────────────────────────────────────────────

def test_normalize_file_csv_happy(tmp_path: Path) -> None:
    src = tmp_path / "IL TEATRO（西餐厅）2月.csv"
    src.write_text(make_csv_text(), encoding="utf-8")
    out_root = tmp_path / "out"
    result = N.normalize_file(src, out_root)
    assert result.chain_factory_id == "R_ILTEATRO_REAL"
    assert result.report_type == N.REPORT_PRODUCT_SALES
    assert result.canonical_rows == 1
    assert result.quarantine_events == []
    assert result.canonical_path is not None
    assert result.canonical_path.exists()
    # Verify canonical content.
    with result.canonical_path.open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 1
    assert rows[0]["store_name"] == "京熹顺南京店"
    assert rows[0]["actual_receive"] == "5366.12"


def test_normalize_file_idempotent_sha256(tmp_path: Path) -> None:
    """Re-running on same source produces byte-identical canonical CSV."""
    src = tmp_path / "IL TEATRO_2月.csv"
    src.write_text(make_csv_text(), encoding="utf-8")
    out_root = tmp_path / "out"
    r1 = N.normalize_file(src, out_root)
    sha1 = r1.sha256
    r2 = N.normalize_file(src, out_root)
    sha2 = r2.sha256
    assert sha1 == sha2 != ""
    # And canonical_rows match exactly.
    assert r1.canonical_rows == r2.canonical_rows


def test_normalize_file_unknown_chain_quarantines(tmp_path: Path) -> None:
    src = tmp_path / "20260306094202727_unknown_chain.csv"
    src.write_text(make_csv_text(), encoding="utf-8")
    out_root = tmp_path / "out"
    result = N.normalize_file(src, out_root)
    assert result.chain_factory_id == "UNKNOWN"
    assert result.canonical_path is None
    assert len(result.quarantine_events) == 1
    assert result.quarantine_events[0].reason == N.QR_UNKNOWN_CHAIN


def test_normalize_file_profit_report_quarantines(tmp_path: Path) -> None:
    """Profit report (火锅2月利润表) — wholly different shape, header scanner finds nothing
    recognizable in the 10-row window, so quarantines as MISSING_HEADER.

    Pilot only knows the product_sales header map; future Sub-ETL-1 expansion would add
    profit_report / purchase_inbound maps and route their detection through
    detect_report_type() returning REPORT_UNSUPPORTED. For now, MISSING_HEADER is the
    correct quarantine label for these.
    """
    src = tmp_path / "火锅2月利润表.csv"
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["科目", "本期金额", "去年同期", "增减率"])
    w.writerow(["营业收入", "100000", "80000", "25%"])
    src.write_text(buf.getvalue(), encoding="utf-8")
    out_root = tmp_path / "out"
    result = N.normalize_file(src, out_root)
    assert result.chain_factory_id == "R_HUOGUO_GENERIC_REAL"
    assert result.canonical_path is None
    # Quarantine event present; reason is MISSING_HEADER (no recognized header in window).
    assert any(ev.reason == N.QR_MISSING_HEADER for ev in result.quarantine_events)


def test_normalize_file_empty_csv_no_header(tmp_path: Path) -> None:
    src = tmp_path / "IL TEATRO_empty.csv"
    src.write_text("", encoding="utf-8")
    out_root = tmp_path / "out"
    result = N.normalize_file(src, out_root)
    assert result.canonical_path is None
    assert any(ev.reason == N.QR_MISSING_HEADER for ev in result.quarantine_events)


def test_normalize_file_skips_blank_data_rows(tmp_path: Path) -> None:
    src = tmp_path / "IL TEATRO_2月.csv"
    src.write_text(make_csv_text(data_rows=[
        ["京熹顺南京店", "小料", "", "", "自助小料", "", "餐饮商品", "单品",
         "624.00", "624.00", "0.00", "0.00", "份", "10.00", "6240.00",
         "6240.00", "873.88", "0.00", "5366.12"],
        [""] * 19,  # trailing blank — should be skipped, not quarantined
        ["京熹顺南京店", "其他", "", "", "餐巾纸", "", "餐饮商品", "单品",
         "236.00", "236.00", "0.00", "0.00", "盒", "2.00", "472.00",
         "472.00", "72.55", "0.00", "399.45"],
    ]), encoding="utf-8")
    out_root = tmp_path / "out"
    result = N.normalize_file(src, out_root)
    assert result.canonical_rows == 2
    assert result.quarantine_events == []


# ──────────────────────────────────────────────────────────────────
# Index emission + quarantine writer
# ──────────────────────────────────────────────────────────────────

def test_write_index_deterministic(tmp_path: Path) -> None:
    """Two runs over same FileResult list produce byte-identical _index.json."""
    results = [
        N.FileResult(
            source_path=Path("smartbi维度分析/.../上马火锅.csv"),
            chain_factory_id="R_SHANGMA_HG_REAL",
            report_type=N.REPORT_PRODUCT_SALES,
            period="2月",
            canonical_path=Path("data/imports/R_SHANGMA_HG_REAL/product_sales/2月.csv"),
            canonical_rows=42,
            sha256="abc123",
        ),
        N.FileResult(
            source_path=Path("smartbi维度分析/.../IL TEATRO.csv"),
            chain_factory_id="R_ILTEATRO_REAL",
            report_type=N.REPORT_PRODUCT_SALES,
            period="2月",
            canonical_path=Path("data/imports/R_ILTEATRO_REAL/product_sales/2月.csv"),
            canonical_rows=15,
            sha256="def456",
        ),
    ]
    idx1 = tmp_path / "_index1.json"
    idx2 = tmp_path / "_index2.json"
    N.write_index(idx1, results)
    N.write_index(idx2, results)
    assert idx1.read_bytes() == idx2.read_bytes()
    # And output is sorted by (chain, report, period) regardless of input order.
    payload = json.loads(idx1.read_text(encoding="utf-8"))
    chains = [f["chain_factory_id"] for f in payload["files"]]
    assert chains == sorted(chains)


def test_write_quarantine_groups_events(tmp_path: Path) -> None:
    events = [
        N.QuarantineEvent("R_ILTEATRO_REAL", N.REPORT_PRODUCT_SALES, "2月", 5,
                          N.QR_NON_NUMERIC_NUMERIC_FIELD, "col=qty_total value='abc'"),
        N.QuarantineEvent("R_ILTEATRO_REAL", N.REPORT_PRODUCT_SALES, "2月", 7,
                          N.QR_EMPTY_REQUIRED_FIELD, "col=store_name value=''"),
    ]
    path = N.write_quarantine(tmp_path, events)
    assert path is not None
    assert path.exists()
    with path.open("r", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    assert rows[0] == ["chain_factory_id", "report_type", "period", "line_no", "reason", "raw_value"]
    assert len(rows) == 3  # header + 2 events


def test_write_quarantine_no_events_returns_none(tmp_path: Path) -> None:
    assert N.write_quarantine(tmp_path, []) is None


# ──────────────────────────────────────────────────────────────────
# CLI exit code (Q-ETL-6 fail-loud)
# ──────────────────────────────────────────────────────────────────

def test_main_fail_loud_returns_one_on_quarantine(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Quarantine event in --no-fail-loud absent -> exit 1 per Q-ETL-6 default."""
    src_root = tmp_path / "src"
    src_root.mkdir()
    # Unknown chain -> guaranteed quarantine.
    (src_root / "unknown_chain.csv").write_text(make_csv_text(), encoding="utf-8")
    exit_code = N.main([
        "--source-root", str(src_root),
        "--output-root", str(tmp_path / "out"),
        "--quarantine-root", str(tmp_path / "quarantine"),
        "--index-path", str(tmp_path / "_index.json"),
    ])
    assert exit_code == 1


def test_main_no_fail_loud_flag_returns_zero(tmp_path: Path) -> None:
    src_root = tmp_path / "src"
    src_root.mkdir()
    (src_root / "unknown_chain.csv").write_text(make_csv_text(), encoding="utf-8")
    exit_code = N.main([
        "--source-root", str(src_root),
        "--output-root", str(tmp_path / "out"),
        "--quarantine-root", str(tmp_path / "quarantine"),
        "--index-path", str(tmp_path / "_index.json"),
        "--no-fail-loud",
    ])
    assert exit_code == 0


def test_main_clean_run_returns_zero(tmp_path: Path) -> None:
    """Happy-path source (1 chain, 1 valid row) -> exit 0."""
    src_root = tmp_path / "src"
    src_root.mkdir()
    (src_root / "IL TEATRO_2月.csv").write_text(make_csv_text(), encoding="utf-8")
    exit_code = N.main([
        "--source-root", str(src_root),
        "--output-root", str(tmp_path / "out"),
        "--quarantine-root", str(tmp_path / "quarantine"),
        "--index-path", str(tmp_path / "_index.json"),
    ])
    assert exit_code == 0
    # _index.json should exist with 1 file entry.
    idx = json.loads((tmp_path / "_index.json").read_text(encoding="utf-8"))
    assert len(idx["files"]) == 1
    assert idx["files"][0]["chain_factory_id"] == "R_ILTEATRO_REAL"
    assert idx["files"][0]["canonical_rows"] == 1
