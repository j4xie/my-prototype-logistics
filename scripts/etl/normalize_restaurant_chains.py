"""
T6.6 Phase B Step 1 — Excel/CSV -> canonical CSV normalizer (Sub-ETL-1).

Spec:  docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3.2
Q1:    docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md §3.1 / §4.1 / §4.3
PR:    #316 (design spec) + #327 (pilot impl) + this PR (modular split + profit/purchase types + Q-DEC-6 F1)

Reads source files from `smartbi维度分析/大众点评/真实餐饮连锁数据/`.
Writes canonical CSVs to `data/imports/restaurant-chains/<chain>/<report>/<period>.csv`.
Writes audit catalog to `data/imports/_index.json`.
Quarantines malformed rows to `data/imports/_quarantine/<chain>/<report>/<period>__line<N>__<reason>.csv`.

NO DB writes. NO network calls. Pure file pipeline.

Module layout (this PR — Sub-ETL-1a/1b modular split from PR #327's monolithic 655 LOC):
- `_lib/format_detect.py` — format dispatch + per-format readers (Sub-ETL-1a foundation)
- `_lib/column_mapping.py` — Chinese→English maps + 14-chain catalog + detect_report_type
- `_lib/quarantine.py` — QR_* enums + QuarantineEvent + write_quarantine writer
- `normalize_restaurant_chains.py` (this file) — row-level normalize + file orchestrator + CLI

Report types supported (this PR — was product_sales only in PR #327):
- 商品销量报表 (product_sales) — 19 cols
- 利润表 (profit) — 5 cols (P&L statement shape)
- 采购入库明细 (purchase_inbound) — 11 cols (supplier × batch × SKU receipts)

Q-DEC-6 = F1 (PR #326 §9 ratified 2026-05-12, PR #330):
- `fact_pos_item` extended with `return_qty` col via V20260511_03 migration.
- canonical CSV `qty_refund` is the upstream surface; Sub-ETL-2 loader will land it at fact_pos_item.return_qty.
- See audit doc 2026-05-12-sub-etl-1-follow-up-modular-return-qty.md §3 for drift notes vs PR #326 §6 line 522 spec text.

Q-ETL defaults applied (spec §5):
- Q-ETL-5: scripts/etl/ location (operational, mirrors scripts/migrations/).
- Q-ETL-6: fail-loud quarantine (return code 1 on any quarantine event).
- Q-ETL-9: prefer xlsx_converted/ over raw .xls (xlrd not in default requirements).

Per Rule 6 (python-java-port.md): explicit None checks at function boundaries.
Per Rule 1 (python-java-port.md): never use Python `or` for null fallback (use `is not None`).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Optional

# ────────────────────────────────────────────────────────────────────
# Self-bootstrap import path for _lib package.
# scripts/etl/ is operational (not a Python package per Q-ETL-5). When invoked
# directly as `python scripts/etl/normalize_restaurant_chains.py ...`, Python adds
# the script's dir to sys.path[0] automatically. When loaded via
# importlib.util.spec_from_file_location (test path), it does NOT — so we prepend
# explicitly here so `from _lib.X import Y` resolves either way.
# ────────────────────────────────────────────────────────────────────

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from _lib.format_detect import (  # noqa: E402
    detect_format,
    read_csv_rows,
    read_source,
    read_xls_rows,
    read_xlsx_rows,
)
from _lib.column_mapping import (  # noqa: E402
    CHAIN_BY_FACTORY_ID,
    CHAIN_CATALOG,
    ChainEntry,
    PRODUCT_SALES_CANONICAL_HEADER,
    PRODUCT_SALES_HEADER_MAP,
    PRODUCT_SALES_NUMERIC_COLS,
    PRODUCT_SALES_REQUIRED_COLS,
    PROFIT_CANONICAL_HEADER,
    PROFIT_HEADER_MAP,
    PROFIT_NUMERIC_COLS,
    PROFIT_REQUIRED_COLS,
    PURCHASE_INBOUND_CANONICAL_HEADER,
    PURCHASE_INBOUND_HEADER_MAP,
    PURCHASE_INBOUND_NUMERIC_COLS,
    PURCHASE_INBOUND_REQUIRED_COLS,
    REPORT_PRODUCT_SALES,
    REPORT_PROFIT,
    REPORT_PURCHASE_INBOUND,
    REPORT_SPECS,
    REPORT_UNSUPPORTED,
    ReportTypeSpec,
    detect_report_type,
    match_chain_for_path,
)
from _lib.quarantine import (  # noqa: E402
    QR_EMPTY_REQUIRED_FIELD,
    QR_MISSING_HEADER,
    QR_MISSING_REQUIRED_COLUMN,
    QR_NON_NUMERIC_NUMERIC_FIELD,
    QR_UNKNOWN_CHAIN,
    QR_UNREADABLE_FILE,
    QR_UNSUPPORTED_REPORT_TYPE,
    QuarantineEvent,
    write_quarantine,
)


# ────────────────────────────────────────────────────────────────────
# Constants — paths (kept here; _lib is reusable for other ETL scripts)
# ────────────────────────────────────────────────────────────────────

DEFAULT_SOURCE_ROOT = Path("smartbi维度分析/大众点评/真实餐饮连锁数据")
DEFAULT_OUTPUT_ROOT = Path("data/imports/restaurant-chains")
DEFAULT_QUARANTINE_ROOT = Path("data/imports/_quarantine")
DEFAULT_INDEX_PATH = Path("data/imports/_index.json")


# ────────────────────────────────────────────────────────────────────
# Row normalization (Sub-ETL-1b — orchestrator-level, depends on report-type spec)
# ────────────────────────────────────────────────────────────────────

_NUMERIC_RE = re.compile(r"^-?\d+(\.\d+)?$")


def coerce_numeric(value: Optional[str]) -> Optional[float]:
    """Return float for a numeric string, or None for empty. Raise ValueError otherwise.

    Per Rule 1 (python-java-port.md): caller checks `is None` explicitly; we never
    silently coerce 'abc' -> 0.0.
    """
    if value is None:
        return None
    s = value.strip()
    if s == "":
        return None
    if not _NUMERIC_RE.match(s):
        raise ValueError(f"non-numeric: {value!r}")
    return float(s)


def find_header_row(rows: list[list[str]], max_scan: int = 10) -> int:
    """Scan first `max_scan` rows for any recognized canonical header.

    Returns:
        0-based index of the header row, or -1 if not found within window.
    """
    if rows is None:
        raise ValueError("find_header_row: rows required")
    for i, row in enumerate(rows[:max_scan]):
        rtype = detect_report_type(row)
        if rtype != REPORT_UNSUPPORTED:
            return i
    return -1


def normalize_row(
    raw_row: dict[str, str],
    period: str,
    chain: ChainEntry,
    source_line_no: int,
    report_spec: ReportTypeSpec = REPORT_SPECS[REPORT_PRODUCT_SALES],
) -> tuple[Optional[dict[str, object]], list[QuarantineEvent]]:
    """Normalize one raw row dict to canonical dict.

    Returns (canonical_row, quarantine_events). On quarantine, canonical_row is None.

    `report_spec` defaults to product_sales for backward compat with PR #327 tests.
    Phase 2 callers pass REPORT_SPECS[REPORT_PROFIT] or REPORT_SPECS[REPORT_PURCHASE_INBOUND].
    """
    if raw_row is None or chain is None:
        raise ValueError("normalize_row: raw_row + chain required")

    events: list[QuarantineEvent] = []
    canonical: dict[str, object] = {col: None for col in report_spec.canonical_header}

    # Required-column presence check (loud per Q-ETL-6).
    for required in report_spec.required_cols:
        raw_value = raw_row.get(required)
        if raw_value is None or (isinstance(raw_value, str) and raw_value.strip() == ""):
            events.append(QuarantineEvent(
                chain.factory_id, report_spec.report_type, period,
                source_line_no, QR_EMPTY_REQUIRED_FIELD,
                f"col={required} value={raw_value!r}",
            ))

    if events:
        return None, events

    # Pass 2: per-column type coercion.
    for col in report_spec.canonical_header:
        raw_value = raw_row.get(col)
        if col in report_spec.numeric_cols:
            try:
                canonical[col] = coerce_numeric(raw_value if isinstance(raw_value, str) else "")
            except ValueError:
                events.append(QuarantineEvent(
                    chain.factory_id, report_spec.report_type, period,
                    source_line_no, QR_NON_NUMERIC_NUMERIC_FIELD,
                    f"col={col} value={raw_value!r}",
                ))
                return None, events
        else:
            # String columns: NULL preserved as None per Rule 1 (NOT silent default to "").
            if raw_value is None or (isinstance(raw_value, str) and raw_value.strip() == ""):
                canonical[col] = None
            else:
                canonical[col] = raw_value.strip() if isinstance(raw_value, str) else raw_value

    return canonical, events


# ────────────────────────────────────────────────────────────────────
# File-level pipeline (Sub-ETL-1c orchestrator)
# ────────────────────────────────────────────────────────────────────

@dataclass
class FileResult:
    source_path: Path
    chain_factory_id: str
    report_type: str
    period: str
    canonical_path: Optional[Path]
    canonical_rows: int = 0
    quarantine_events: list[QuarantineEvent] = field(default_factory=list)
    sha256: Optional[str] = None  # of canonical CSV (idempotence verify)


def _derive_period(source_path: Path) -> str:
    """Use the source file stem as period identifier (idempotence-stable)."""
    return source_path.stem


def normalize_file(
    source_path: Path,
    output_root: Path,
    chain: Optional[ChainEntry] = None,
) -> FileResult:
    """Normalize one source file end-to-end. Idempotent: re-running on same input
    produces byte-identical canonical CSV (deterministic row order = source order)."""

    if source_path is None or output_root is None:
        raise ValueError("normalize_file: source_path + output_root required")

    period = _derive_period(source_path)
    resolved_chain = chain if chain is not None else match_chain_for_path(source_path)

    if resolved_chain is None:
        return FileResult(
            source_path=source_path,
            chain_factory_id="UNKNOWN",
            report_type="UNKNOWN",
            period=period,
            canonical_path=None,
            quarantine_events=[QuarantineEvent(
                "UNKNOWN", "UNKNOWN", period, 0, QR_UNKNOWN_CHAIN,
                f"path={source_path.name}",
            )],
        )

    # Read.
    try:
        rows = read_source(source_path)
    except (ValueError, ImportError, OSError) as e:
        return FileResult(
            source_path=source_path,
            chain_factory_id=resolved_chain.factory_id,
            report_type="UNKNOWN",
            period=period,
            canonical_path=None,
            quarantine_events=[QuarantineEvent(
                resolved_chain.factory_id, "UNKNOWN", period, 0, QR_UNREADABLE_FILE, str(e),
            )],
        )

    # Find header.
    header_idx = find_header_row(rows)
    if header_idx < 0:
        return FileResult(
            source_path=source_path,
            chain_factory_id=resolved_chain.factory_id,
            report_type="UNKNOWN",
            period=period,
            canonical_path=None,
            quarantine_events=[QuarantineEvent(
                resolved_chain.factory_id, "UNKNOWN", period, 0, QR_MISSING_HEADER,
                f"scanned {min(10, len(rows))} rows; no recognized header",
            )],
        )

    header_row = rows[header_idx]
    rtype = detect_report_type(header_row)
    if rtype == REPORT_UNSUPPORTED:
        return FileResult(
            source_path=source_path,
            chain_factory_id=resolved_chain.factory_id,
            report_type=REPORT_UNSUPPORTED,
            period=period,
            canonical_path=None,
            quarantine_events=[QuarantineEvent(
                resolved_chain.factory_id, REPORT_UNSUPPORTED, period, header_idx + 1,
                QR_UNSUPPORTED_REPORT_TYPE,
                f"header={header_row[:5]}...",
            )],
        )

    report_spec = REPORT_SPECS[rtype]

    # Normalize each data row.
    canonical_rows: list[dict[str, object]] = []
    quarantine: list[QuarantineEvent] = []

    header_to_canonical = {
        h.strip(): report_spec.header_map[h.strip()]
        for h in header_row
        if h is not None and h.strip() in report_spec.header_map
    }

    for source_line_no, raw in enumerate(rows[header_idx + 1:], start=header_idx + 2):
        # Skip fully-empty rows (trailing blanks in Excel are common).
        if not any(c.strip() for c in raw if isinstance(c, str)):
            continue
        # Build dict by header position.
        raw_dict: dict[str, str] = {}
        for col_idx, raw_value in enumerate(raw):
            if col_idx >= len(header_row):
                break
            zh_header = (header_row[col_idx] or "").strip()
            canonical_col = header_to_canonical.get(zh_header)
            if canonical_col is not None:
                raw_dict[canonical_col] = raw_value if isinstance(raw_value, str) else str(raw_value)
        canonical, events = normalize_row(raw_dict, period, resolved_chain, source_line_no, report_spec)
        quarantine.extend(events)
        if canonical is not None:
            canonical_rows.append(canonical)

    # Write canonical CSV.
    output_dir = output_root / resolved_chain.factory_id / rtype
    output_dir.mkdir(parents=True, exist_ok=True)
    canonical_path = output_dir / f"{period}.csv"
    write_canonical_csv(canonical_path, canonical_rows, report_spec)
    sha = file_sha256(canonical_path)

    return FileResult(
        source_path=source_path,
        chain_factory_id=resolved_chain.factory_id,
        report_type=rtype,
        period=period,
        canonical_path=canonical_path,
        canonical_rows=len(canonical_rows),
        quarantine_events=quarantine,
        sha256=sha,
    )


def write_canonical_csv(
    path: Path,
    rows: list[dict[str, object]],
    report_spec: ReportTypeSpec = REPORT_SPECS[REPORT_PRODUCT_SALES],
) -> None:
    """Write canonical rows. Always writes header even if 0 rows (idempotent shape).

    `report_spec` defaults to product_sales for backward compat with PR #327 tests.
    """
    if path is None:
        raise ValueError("write_canonical_csv: path required")
    path.parent.mkdir(parents=True, exist_ok=True)
    # newline="" + lineterminator="\n" guarantees byte-identical output across runs.
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=report_spec.canonical_header, lineterminator="\n",
        )
        writer.writeheader()
        for row in rows:
            # Coerce None -> "" at write time; preserve numeric formatting.
            out = {k: ("" if v is None else v) for k, v in row.items()}
            writer.writerow(out)


def file_sha256(path: Path) -> str:
    """SHA-256 of file bytes — used by `_index.json` to verify idempotence."""
    if path is None or not path.exists():
        return ""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def write_index(index_path: Path, results: list[FileResult]) -> None:
    """Emit `_index.json` audit catalog. Deterministic key order for idempotence."""
    if index_path is None:
        raise ValueError("write_index: index_path required")
    index_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "spec": "docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md",
        "files": sorted(
            (
                {
                    "source": str(r.source_path).replace("\\", "/"),
                    "chain_factory_id": r.chain_factory_id,
                    "report_type": r.report_type,
                    "period": r.period,
                    "canonical_path": (
                        str(r.canonical_path).replace("\\", "/")
                        if r.canonical_path is not None else None
                    ),
                    "canonical_rows": r.canonical_rows,
                    "quarantine_events": len(r.quarantine_events),
                    "sha256": r.sha256,
                }
                for r in results
            ),
            key=lambda d: (d["chain_factory_id"], d["report_type"], d["period"]),
        ),
    }
    with index_path.open("w", encoding="utf-8", newline="") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


# ────────────────────────────────────────────────────────────────────
# CLI entry
# ────────────────────────────────────────────────────────────────────

def iter_source_files(root: Path) -> Iterator[Path]:
    """Yield source files under `root` (recursive). Skips xlsx_converted/ to avoid double-process."""
    if root is None:
        raise ValueError("iter_source_files: root required")
    if not root.exists():
        return
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        if "xlsx_converted" in p.parts:
            continue
        if "xlsx" in p.parts and p.parts.index("xlsx") < len(p.parts) - 1:
            # Subdirectory named "xlsx" (pre-conversion stash) — skip.
            continue
        if p.suffix.lower() in (".xls", ".xlsx", ".csv"):
            yield p


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--source-root", default=str(DEFAULT_SOURCE_ROOT))
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--quarantine-root", default=str(DEFAULT_QUARANTINE_ROOT))
    parser.add_argument("--index-path", default=str(DEFAULT_INDEX_PATH))
    parser.add_argument(
        "--no-fail-loud",
        action="store_true",
        help="Override Q-ETL-6 default (fail-loud). Return 0 even on quarantine.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    log = logging.getLogger("normalize_restaurant_chains")

    source_root = Path(args.source_root)
    output_root = Path(args.output_root)
    quarantine_root = Path(args.quarantine_root)
    index_path = Path(args.index_path)

    results: list[FileResult] = []
    all_quarantine: list[QuarantineEvent] = []
    for src in iter_source_files(source_root):
        log.info("processing %s", src)
        r = normalize_file(src, output_root)
        results.append(r)
        all_quarantine.extend(r.quarantine_events)

    if all_quarantine:
        qpath = write_quarantine(quarantine_root, all_quarantine)
        log.warning("wrote %d quarantine events -> %s", len(all_quarantine), qpath)

    write_index(index_path, results)
    log.info("wrote index -> %s (files=%d)", index_path, len(results))

    if all_quarantine and not args.no_fail_loud:
        log.error("quarantine events present (fail-loud per Q-ETL-6); exit 1")
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
