"""Sub-ETL-1b — quarantine event model + writer.

Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3.1 + §6 (row 4).

Closed-enum reasons (never invent new strings ad-hoc — keeps `_quarantine/` directory
auditable and groupable downstream by Sub-ETL-2c).
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# ────────────────────────────────────────────────────────────────────
# Quarantine reasons (closed enum)
# ────────────────────────────────────────────────────────────────────

QR_UNKNOWN_CHAIN = "UNKNOWN_CHAIN"
QR_UNSUPPORTED_REPORT_TYPE = "UNSUPPORTED_REPORT_TYPE"
QR_MISSING_HEADER = "MISSING_HEADER"
QR_MISSING_REQUIRED_COLUMN = "MISSING_REQUIRED_COLUMN"
QR_NON_NUMERIC_NUMERIC_FIELD = "NON_NUMERIC_NUMERIC_FIELD"
QR_EMPTY_REQUIRED_FIELD = "EMPTY_REQUIRED_FIELD"
QR_UNREADABLE_FILE = "UNREADABLE_FILE"


@dataclass
class QuarantineEvent:
    """One quarantine event. line_no=0 = whole-file event (before row scan)."""
    chain_factory_id: str          # may be "UNKNOWN" before chain detection
    report_type: str               # may be "UNKNOWN" before header detection
    period: str                    # source filename stem
    line_no: int                   # 1-based source line; 0 = whole-file event
    reason: str                    # from QR_* enum
    raw_value: str                 # the offending raw value or row preview

    def to_csv_row(self) -> list[str]:
        return [
            self.chain_factory_id, self.report_type, self.period,
            str(self.line_no), self.reason, self.raw_value,
        ]


def write_quarantine(quarantine_root: Path, events: list[QuarantineEvent]) -> Optional[Path]:
    """Write all quarantine events to one CSV per (chain, report, period). Returns the path.

    Pilot writes all events into a single combined file keyed on the first event for
    simplicity. Production split: one file per (chain, report, period) group.
    """
    if quarantine_root is None:
        raise ValueError("write_quarantine: quarantine_root required")
    if not events:
        return None
    first = events[0]
    target_dir = quarantine_root / first.chain_factory_id / first.report_type
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{first.period}__quarantine.csv"
    with target_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["chain_factory_id", "report_type", "period", "line_no", "reason", "raw_value"])
        for ev in events:
            writer.writerow(ev.to_csv_row())
    return target_path
