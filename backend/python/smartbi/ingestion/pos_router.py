"""二维火 POS file router — filename-based Silver writer dispatch.

Pipeline:
  upload bytes → strip POS prefix → match Chinese keyword (report_registry.yaml)
                                   → emit RouteDecision (writer + report_type + grain)

For .zip uploads, _zip_handler.extract_inner_files unrolls recursively then
each inner file goes through the same dispatch.

Unknown report type → UnknownReportTypeError carrying first 3 lines of the
file as preview_headers so the API layer can surface them in 400 response.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task B5
"""
from __future__ import annotations  # py38 compat: builtin generics list/tuple/dict

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

import yaml

from smartbi.ingestion._filename_stripper import strip_pos_prefix
from smartbi.ingestion._zip_handler import extract_inner_files

_REGISTRY_PATH = (
    Path(__file__).parent.parent
    / "knowledge"
    / "restaurant"
    / "pos"
    / "report_registry.yaml"
)
_REGISTRY = yaml.safe_load(
    _REGISTRY_PATH.read_text(encoding="utf-8")
)["2dfire"]["filename_keywords"]


@dataclass(frozen=True)
class RouteDecision:
    report_type: str    # short name, e.g. "daily_summary"
    writer: str         # writer module name, e.g. "daily_summary_writer"
    grain: str          # human-readable grain description


class UnknownReportTypeError(Exception):
    """Raised when neither filename keyword nor (future) header sniff identifies the report."""

    def __init__(self, filename: str, preview_headers: list[str]):
        super().__init__(f"Cannot identify report type for {filename}")
        self.filename = filename
        self.preview_headers = preview_headers


def _route_by_filename(filename: str) -> Optional[RouteDecision]:
    """Match Chinese keyword in (prefix-stripped) filename. None if no match."""
    stripped = strip_pos_prefix(filename)
    for entry in _REGISTRY:
        if entry["keyword"] in stripped:
            writer = entry["writer"]
            type_short = writer[:-len("_writer")] if writer.endswith("_writer") else writer
            return RouteDecision(
                report_type=type_short,
                writer=entry["writer"],
                grain=entry.get("grain", ""),
            )
    return None


def _preview(content: bytes, n_lines: int = 3) -> list[str]:
    """First N decoded lines; used in UnknownReportTypeError to surface to caller."""
    text = content.decode("utf-8", errors="replace")
    # 二维火 uses \r-only line endings; normalize for preview.
    lines = text.replace("\r\n", "\n").replace("\r", "\n").splitlines()
    return lines[:n_lines]


def route_file(filename: str, content: bytes) -> Iterator[tuple[RouteDecision, bytes]]:
    """Route an upload. Yields (decision, inner_bytes) per matched file.

    Single CSV/xlsx/xls → yields exactly one tuple.
    Zip → yields one tuple per data file inside (may be nested).

    Raises UnknownReportTypeError if any single file's report type is unidentifiable.
    """
    if filename.lower().endswith(".zip"):
        for inner_name, inner_body in extract_inner_files(content):
            decision = _route_by_filename(inner_name)
            if decision is None:
                raise UnknownReportTypeError(inner_name, _preview(inner_body))
            yield (decision, inner_body)
        return

    decision = _route_by_filename(filename)
    if decision is None:
        raise UnknownReportTypeError(filename, _preview(content))
    yield (decision, content)
