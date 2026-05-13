"""Recursive zip extractor for 二维火 POS uploads.

二维火 portal exports each report as a separate .zip containing one CSV inside.
Customers sometimes re-archive multiple report .zips into a single outer .zip
before uploading. This helper unrolls both levels (and arbitrary deeper
nesting), yielding (filename, bytes) tuples only for data-bearing files
(.csv / .xlsx / .xls). Readme.txt / directories / unrelated artifacts are
silently dropped.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 step ②
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task B2
"""
import io
import zipfile
from typing import Iterator, Tuple

_DATA_SUFFIXES = {".csv", ".xlsx", ".xls"}


def extract_inner_files(zip_bytes: bytes) -> Iterator[Tuple[str, bytes]]:
    """Yield (filename, content) for every data file inside, recursing into nested zips.

    Skips:
      - directory entries
      - files whose suffix is not in {.csv, .xlsx, .xls, .zip}
        (.zip is recursed; data suffixes are yielded)
    """
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            suffix = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
            content = zf.read(info)
            if suffix == ".zip":
                yield from extract_inner_files(content)
            elif suffix in _DATA_SUFFIXES:
                yield (name, content)
