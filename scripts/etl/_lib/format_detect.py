"""Sub-ETL-1a — format detection + reader dispatch.

Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3.1 + §6 (row 3).

Pure I/O dispatch:
- Extension-based format selection (.xls / .xlsx / .csv).
- Per-format reader returning list[list[str]].
- Optional deps (openpyxl, xlrd) raise ImportError; caller writes UNREADABLE_FILE quarantine.

NO DB, NO network. Caller catches (ValueError, ImportError, OSError) and converts to quarantine event.
Per Rule 6 (python-java-port.md): explicit `is None` boundary checks on all path inputs.
"""

from __future__ import annotations

import csv
from pathlib import Path


def detect_format(path: Path) -> str:
    """Return 'xls' | 'xlsx' | 'csv' from extension. Unknown raises ValueError."""
    if path is None:
        raise ValueError("detect_format: path required")
    suffix = path.suffix.lower()
    if suffix == ".xls":
        return "xls"
    if suffix == ".xlsx":
        return "xlsx"
    if suffix == ".csv":
        return "csv"
    raise ValueError(f"detect_format: unsupported extension {suffix!r} on {path.name}")


def read_csv_rows(path: Path) -> list[list[str]]:
    """Read a CSV file with utf-8 + BOM tolerance. Returns all rows as list[list[str]]."""
    if path is None:
        raise ValueError("read_csv_rows: path required")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return [row for row in csv.reader(f)]


def read_xlsx_rows(path: Path) -> list[list[str]]:
    """Read a single-sheet .xlsx via openpyxl. Returns all rows as list[list[str]].

    Openpyxl is optional at runtime; absence raises ImportError. Caller catches
    and writes a whole-file UNREADABLE_FILE quarantine event.
    """
    if path is None:
        raise ValueError("read_xlsx_rows: path required")
    try:
        import openpyxl  # type: ignore
    except ImportError as e:  # pragma: no cover — env-dependent
        raise ImportError("openpyxl required for .xlsx — `pip install openpyxl`") from e
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    out: list[list[str]] = []
    for row in ws.iter_rows(values_only=True):
        out.append(["" if v is None else str(v) for v in row])
    return out


def read_xls_rows(path: Path) -> list[list[str]]:
    """Read a legacy .xls via xlrd 1.2.0. Returns all rows as list[list[str]].

    Per Q-ETL-9 default: prefer pre-converted xlsx in xlsx_converted/. Pilot tries
    raw xlrd only if xlsx_converted sibling is absent; absence of xlrd raises ImportError.
    """
    if path is None:
        raise ValueError("read_xls_rows: path required")
    try:
        import xlrd  # type: ignore
    except ImportError as e:  # pragma: no cover — env-dependent
        raise ImportError("xlrd required for .xls — see Q-ETL-9 default (pre-convert to .xlsx)") from e
    book = xlrd.open_workbook(path)
    sheet = book.sheet_by_index(0)
    out: list[list[str]] = []
    for i in range(sheet.nrows):
        out.append([str(sheet.cell_value(i, j)) for j in range(sheet.ncols)])
    return out


def read_source(path: Path) -> list[list[str]]:
    """Dispatch reader by extension."""
    fmt = detect_format(path)
    if fmt == "csv":
        return read_csv_rows(path)
    if fmt == "xlsx":
        return read_xlsx_rows(path)
    if fmt == "xls":
        return read_xls_rows(path)
    raise ValueError(f"read_source: unknown format {fmt!r}")
