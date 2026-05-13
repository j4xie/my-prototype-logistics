"""Tests for ingestion.pos_router — filename-based POS report dispatch.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task B5
"""
import io
import zipfile

import pytest

from smartbi.ingestion.pos_router import (
    RouteDecision,
    UnknownReportTypeError,
    route_file,
)


def _make_zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_route_by_filename_with_prefix():
    results = list(
        route_file("20260422101444628_abc_营业概况报表.csv", b"col1,col2\n1,2")
    )
    assert len(results) == 1
    decision, content = results[0]
    assert isinstance(decision, RouteDecision)
    assert decision.writer == "daily_summary_writer"
    assert decision.report_type == "daily_summary"
    assert content == b"col1,col2\n1,2"


def test_route_meal_split():
    results = list(route_file("堂食外卖占比表.csv", b"col1,col2\n1,2"))
    assert len(results) == 1
    assert results[0][0].writer == "meal_split_writer"


def test_route_detailed_daily_to_bill_flow():
    results = list(route_file("详细日报表.csv", b"x,y\n1,2"))
    assert results[0][0].writer == "bill_flow_writer"


def test_route_payment_summary_also_to_bill_flow():
    """订单付款方式汇总 shares grain with 详细日报表, both go to bill_flow_writer."""
    results = list(route_file("订单付款方式汇总.csv", b"a,b\n1,2"))
    assert results[0][0].writer == "bill_flow_writer"


def test_route_product_summary():
    results = list(route_file("商品销售明细表.csv", b"a,b\n1,2"))
    assert results[0][0].writer == "product_summary_writer"


def test_route_region_summary():
    results = list(route_file("区域销售报表.csv", b"a,b\n1,2"))
    assert results[0][0].writer == "region_summary_writer"


def test_route_via_zip_extracts_inner_and_dispatches():
    inner_csv = b"col1,col2\n1,2"
    zip_bytes = _make_zip({"营业概况报表.csv": inner_csv})
    results = list(
        route_file("20260422101444628_abc_营业概况报表.zip", zip_bytes)
    )
    assert len(results) == 1
    decision, content = results[0]
    assert decision.writer == "daily_summary_writer"
    assert content == inner_csv


def test_route_via_zip_multiple_inner():
    zip_bytes = _make_zip({
        "营业概况报表.csv": b"a\n1",
        "堂食外卖占比表.csv": b"b\n2",
    })
    results = list(route_file("outer.zip", zip_bytes))
    writers = sorted(d.writer for d, _ in results)
    assert writers == ["daily_summary_writer", "meal_split_writer"]


def test_route_unknown_raises_with_preview():
    with pytest.raises(UnknownReportTypeError) as exc:
        list(route_file("mystery_report.csv", b"abc,def\n1,2"))
    assert exc.value.filename == "mystery_report.csv"
    # preview_headers should include the first few lines (decoded best-effort)
    assert any("abc" in line for line in exc.value.preview_headers)


def test_route_unknown_inside_zip_also_raises():
    zip_bytes = _make_zip({"mystery.csv": b"abc,def\n1,2"})
    with pytest.raises(UnknownReportTypeError):
        list(route_file("outer.zip", zip_bytes))
