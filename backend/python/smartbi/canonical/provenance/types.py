"""Provenance value types — what the writer accepts and the reader returns."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date as _date
from typing import Any, Optional


@dataclass(frozen=True)
class ProvenanceValue:
    """Single provenance record materialised as a Python value."""

    field_value: Any
    confidence: float
    source_upload_id: int  # 0 → sentinel ("non-upload": manual / inferred)
    source_type: str       # 'pos_excel' / 'manual' / 'inferred' / ...
    mapper_method: str     # 'manual' / 'rule' / 'embedding' / 'llm'
    valid_from: Optional[_date] = None  # None ≡ '-infinity' (always valid)
    valid_to: Optional[_date] = None
    notes: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> "ProvenanceValue":
        """Build a ProvenanceValue from an asyncpg row dict.

        v1.3 NC-2: asyncpg may surface '-infinity'/'infinity' DATE columns as
        non-``date`` sentinel objects depending on driver/version, so we coerce
        anything that is not a real ``date`` instance back to ``None`` rather
        than relying on ``date.min``/``date.max`` equality.
        """
        vf = row.get("valid_from")
        if vf is not None and not isinstance(vf, _date):
            vf = None
        vt = row.get("valid_to")
        if vt is not None and not isinstance(vt, _date):
            vt = None
        return cls(
            field_value=row["field_value"],
            confidence=float(row["confidence"]),
            source_upload_id=int(row.get("source_upload_id") or 0),
            source_type=row["source_type"],
            mapper_method=row["mapper_method"],
            valid_from=vf,
            valid_to=vt,
            notes=row.get("notes"),
        )
