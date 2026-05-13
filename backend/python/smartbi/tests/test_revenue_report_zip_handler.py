"""Tests for ingestion._zip_handler.

Spec: §5.1 step ②
Plan: Task B2
"""
import io
import zipfile

from smartbi.ingestion._zip_handler import extract_inner_files


def _make_zip(entries: dict[str, bytes]) -> bytes:
    """Build an in-memory zip from {filename: bytes} dict."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_extracts_flat_zip():
    zip_bytes = _make_zip({
        "a.csv": b"col1,col2\n1,2",
        "b.csv": b"col3,col4\n3,4",
    })
    files = list(extract_inner_files(zip_bytes))
    assert len(files) == 2
    names = sorted(n for n, _ in files)
    assert names == ["a.csv", "b.csv"]


def test_extracts_nested_zip():
    inner = _make_zip({"inner.csv": b"data"})
    outer = _make_zip({"nested.zip": inner})
    files = list(extract_inner_files(outer))
    assert any(name == "inner.csv" for name, _ in files)


def test_skips_directories_and_non_data_files():
    """Only .csv/.xlsx/.xls are yielded; readme.txt etc. dropped."""
    zip_bytes = _make_zip({
        "readme.txt": b"ignored",
        "data.csv": b"col,val\n1,2",
    })
    files = list(extract_inner_files(zip_bytes))
    names = [n for n, _ in files]
    assert "data.csv" in names
    assert "readme.txt" not in names


def test_yields_correct_bytes():
    """Inner file content must be the original bytes verbatim."""
    payload = "门店名称,营业额\r青花椒南方百联店,1000".encode("utf-8")
    zip_bytes = _make_zip({"营业概况报表.csv": payload})
    files = list(extract_inner_files(zip_bytes))
    assert len(files) == 1
    name, content = files[0]
    assert name == "营业概况报表.csv"
    assert content == payload


def test_handles_xlsx_extension():
    zip_bytes = _make_zip({"report.xlsx": b"\x50\x4b\x03\x04..."})
    files = list(extract_inner_files(zip_bytes))
    assert len(files) == 1
    assert files[0][0] == "report.xlsx"
