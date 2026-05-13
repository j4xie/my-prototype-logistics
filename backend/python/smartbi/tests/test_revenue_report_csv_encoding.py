"""Regression tests for 二维火 POS CSV format compatibility.

二维火 portal exports CSVs with:
  - UTF-8 byte-order-mark (BOM) prefix `\\xef\\xbb\\xbf`
  - `\\r`-only line endings (NOT `\\r\\n`, NOT `\\n`)

Default pandas `pd.read_csv()` may fail on either:
  - `encoding="utf-8"` (the default fallback) leaves BOM in column names
  - `engine="c"` (default) may not consistently handle `\\r`-only endings

This test pins the working pattern (`encoding="utf-8-sig"` + `engine="python"`)
and is the contract the excel_async.py patch must satisfy.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5 (B3)
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task B3
"""
import io

import pandas as pd


def test_utf8_bom_plus_cr_only_line_endings():
    """Mirrors real 二维火 export bytes."""
    bom = b"\xef\xbb\xbf"
    body = (
        "门店名称,营业额\r"
        "青花椒南方百联店,123.45\r"
        "青花椒徐汇店,67.89"
    ).encode("utf-8")
    raw = bom + body

    df = pd.read_csv(io.BytesIO(raw), encoding="utf-8-sig", engine="python")

    assert list(df.columns) == ["门店名称", "营业额"]
    assert len(df) == 2
    assert df.iloc[0]["门店名称"] == "青花椒南方百联店"
    assert float(df.iloc[0]["营业额"]) == 123.45


def test_utf8_no_bom_still_works():
    """Pattern must remain backward-compatible with non-BOM utf-8 CSVs."""
    body = b"col1,col2\nval1,val2\n"
    df = pd.read_csv(io.BytesIO(body), encoding="utf-8-sig", engine="python")
    assert list(df.columns) == ["col1", "col2"]
    assert df.iloc[0]["col1"] == "val1"


def test_gbk_fallback_still_useful():
    """For legacy non-UTF8 sources, gbk fallback is preserved by callers."""
    body = "店名,营收\r店A,100".encode("gbk")
    df = pd.read_csv(io.BytesIO(body), encoding="gbk", engine="python")
    assert list(df.columns) == ["店名", "营收"]
