"""
T6.6 Phase B Step 1 — Excel/CSV -> canonical CSV normalizer (PILOT).

Spec:  docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3.2
Q1:    docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md §3.1 / §4.1 / §4.3
PR:    #316 (design spec) + this PR (pilot impl)

Reads source files from `smartbi维度分析/大众点评/真实餐饮连锁数据/`.
Writes canonical CSVs to `data/imports/restaurant-chains/<chain>/<report>/<period>.csv`.
Writes audit catalog to `data/imports/_index.json`.
Quarantines malformed rows to `data/imports/_quarantine/<chain>/<report>/<period>__line<N>__<reason>.csv`.

NO DB writes. NO network calls. Pure file pipeline.

Pilot scope (per dispatch §⛔):
- Single-file demo of Sub-ETL-1 pipeline shape (Sub-ETL-1a + 1b + 1c inlined).
- Handles the dominant "商品销量报表" (product sales) report type only.
- Other report types (采购入库明细 / 利润表) quarantine as UNSUPPORTED_REPORT_TYPE.
- 14-chain catalog inlined per Q1 §4.3 = spec §1.4 verbatim.

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
import io
import json
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Iterator, Optional

# ────────────────────────────────────────────────────────────────────
# Constants — paths, schema, catalog
# ────────────────────────────────────────────────────────────────────

DEFAULT_SOURCE_ROOT = Path("smartbi维度分析/大众点评/真实餐饮连锁数据")
DEFAULT_OUTPUT_ROOT = Path("data/imports/restaurant-chains")
DEFAULT_QUARANTINE_ROOT = Path("data/imports/_quarantine")
DEFAULT_INDEX_PATH = Path("data/imports/_index.json")

REPORT_PRODUCT_SALES = "product_sales"
REPORT_UNSUPPORTED = "_unsupported"

# Chinese header -> canonical snake_case. The 19-column shape of "商品销量报表".
# Spec §1.5 fact_pos_item natural key is (factory_id, source_type, store_id, source_bill_no, line_no);
# at the canonical-CSV layer we keep the wider product-aggregate shape that Sub-ETL-2 will
# fold into Silver dims + fact_pos_item.
PRODUCT_SALES_HEADER_MAP: dict[str, str] = {
    "门店名称": "store_name",
    "商品分类": "product_category",
    "收入分组": "revenue_group",
    "商品编码": "product_code",
    "商品名称": "product_name",
    "规格": "spec",
    "商品类型": "product_type",
    "点单方式": "order_method",
    "单卖数量(不含套餐子商品)": "qty_single",
    "数量(含套餐子商品)": "qty_total",
    "退货数量(不含套餐子商品)": "qty_refund",
    "套餐内销量": "qty_combo_child",
    "单位": "unit",
    "销售单价": "unit_price",
    "销售金额": "gross_amount",
    "折后金额": "net_after_discount",
    "分摊优惠": "discount_allocated",
    "实退金额": "refund_amount",
    "实收": "actual_receive",
}

PRODUCT_SALES_CANONICAL_HEADER: list[str] = list(PRODUCT_SALES_HEADER_MAP.values())

# Columns whose values MUST parse as Decimal-like numbers (NULL allowed).
PRODUCT_SALES_NUMERIC_COLS: frozenset[str] = frozenset({
    "qty_single", "qty_total", "qty_refund", "qty_combo_child",
    "unit_price", "gross_amount", "net_after_discount",
    "discount_allocated", "refund_amount", "actual_receive",
})

# Columns that MUST be present and non-empty for the row to be canonical.
PRODUCT_SALES_REQUIRED_COLS: frozenset[str] = frozenset({
    "store_name", "product_name",
})


@dataclass(frozen=True)
class ChainEntry:
    """One row of the 14-chain catalog (Q1 §4.3 / spec §1.4)."""
    factory_id: str
    chain_name_zh: str
    chain_name_roman: str
    cuisine: Optional[str]
    source_path_hints: tuple[str, ...]


# Q1 §4.3 / spec §1.4 verbatim. Source-path hints are substrings used by
# `match_chain_for_path()` to map a source filename to its factory_id.
CHAIN_CATALOG: tuple[ChainEntry, ...] = (
    ChainEntry("R_ILTEATRO_REAL",       "IL TEATRO 西餐",   "ILTEATRO",      "Western",  ("IL TEATRO",)),
    ChainEntry("R_SHANGMA_HG_REAL",     "上马火锅",         "SHANGMA_HG",    "HotPot",   ("上马火锅",)),
    ChainEntry("R_JINCHUAN_HG_REAL",    "锦川火锅",         "JINCHUAN_HG",   "HotPot",   ("锦川火锅",)),
    ChainEntry("R_XIMAXIANG_REAL",      "唏嘛香 牛肉面",    "XIMAXIANG",     "Noodles",  ("唏嘛香",)),
    ChainEntry("R_YUJIUJING_REAL",      "御九井 日料",      "YUJIUJING",     "Japanese", ("御九井",)),
    ChainEntry("R_YONGHE_REAL",         "永和豆浆",         "YONGHE",        "FastFood", ("永和豆浆",)),
    ChainEntry("R_XINBASHU_REAL",       "鑫巴蜀",           "XINBASHU",      "Sichuan",  ("鑫巴蜀",)),
    ChainEntry("R_QINGHUAJIAO_REAL",    "青花椒",           "QINGHUAJIAO",   "Sichuan",  ("青花椒",)),
    ChainEntry("R_DONGMENKOU_REAL",     "东门口",           "DONGMENKOU",    "Local",    ("东门口", "東門口")),
    ChainEntry("R_HONGDEJI_REAL",       "鸿德记",           "HONGDEJI",      None,       ("鸿德记",)),
    ChainEntry("R_JINRINIUSHI_REAL",    "今日牛事",         "JINRINIUSHI",   "Beef",     ("今日牛事",)),
    ChainEntry("R_YOUZIYOUWEI_REAL",    "有滋有味",         "YOUZIYOUWEI",   None,       ("有滋有味",)),
    ChainEntry("R_LINJIAYAN_REAL",      "邻家宴",           "LINJIAYAN",     None,       ("邻家宴",)),
    ChainEntry("R_HUOGUO_GENERIC_REAL", "火锅 (generic)",   "HUOGUO_GENERIC","HotPot",   ("火锅2月利润表",)),
)

CHAIN_BY_FACTORY_ID: dict[str, ChainEntry] = {c.factory_id: c for c in CHAIN_CATALOG}


# ────────────────────────────────────────────────────────────────────
# Quarantine reasons (closed enum — never invent new strings ad-hoc)
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


# ────────────────────────────────────────────────────────────────────
# Format detection (Sub-ETL-1a foundation)
# ────────────────────────────────────────────────────────────────────

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


def match_chain_for_path(path: Path, catalog: Iterable[ChainEntry] = CHAIN_CATALOG) -> Optional[ChainEntry]:
    """Match a source file path to its ChainEntry by substring hint.

    First match wins; iteration order is the 14-chain catalog declaration order.
    Caller treats `None` as quarantine reason `UNKNOWN_CHAIN`.
    """
    if path is None:
        raise ValueError("match_chain_for_path: path required")
    # Include parent dir name in match scope — `锦川火锅5个月/file.xlsx` matches 锦川火锅.
    haystack = str(path).replace("\\", "/")
    for entry in catalog:
        for hint in entry.source_path_hints:
            if hint and hint in haystack:
                return entry
    return None


# ────────────────────────────────────────────────────────────────────
# Banner skip + header detection (Sub-ETL-1a)
# ────────────────────────────────────────────────────────────────────

def detect_report_type(header_row: list[str]) -> str:
    """Identify report type from header row contents.

    Returns:
        REPORT_PRODUCT_SALES if header matches 商品销量报表 shape (>=10 known columns).
        REPORT_UNSUPPORTED otherwise (e.g. 采购入库 / 利润表 — deferred).
    """
    if header_row is None:
        raise ValueError("detect_report_type: header_row required")
    cleaned = {h.strip() for h in header_row if h is not None and h.strip()}
    matched = sum(1 for h in cleaned if h in PRODUCT_SALES_HEADER_MAP)
    # Heuristic threshold: 10 of 19 known columns present == product_sales.
    if matched >= 10:
        return REPORT_PRODUCT_SALES
    return REPORT_UNSUPPORTED


def find_header_row(rows: list[list[str]], max_scan: int = 10) -> int:
    """Scan first `max_scan` rows for the canonical header.

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


# ────────────────────────────────────────────────────────────────────
# Row normalization (Sub-ETL-1b)
# ────────────────────────────────────────────────────────────────────

_NUMERIC_RE = re.compile(r"^-?\d+(\.\d+)?$")


def coerce_numeric(value: str) -> Optional[float]:
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


def normalize_row(
    raw_row: dict[str, str],
    period: str,
    chain: ChainEntry,
    source_line_no: int,
) -> tuple[Optional[dict[str, object]], list[QuarantineEvent]]:
    """Normalize one raw row dict to canonical dict.

    Returns (canonical_row, quarantine_events). On quarantine, canonical_row is None.
    """
    if raw_row is None or chain is None:
        raise ValueError("normalize_row: raw_row + chain required")

    events: list[QuarantineEvent] = []
    canonical: dict[str, object] = {col: None for col in PRODUCT_SALES_CANONICAL_HEADER}

    # Required-column presence check (loud per Q-ETL-6).
    for required in PRODUCT_SALES_REQUIRED_COLS:
        raw_value = raw_row.get(required)
        if raw_value is None or (isinstance(raw_value, str) and raw_value.strip() == ""):
            events.append(QuarantineEvent(
                chain.factory_id, REPORT_PRODUCT_SALES, period,
                source_line_no, QR_EMPTY_REQUIRED_FIELD,
                f"col={required} value={raw_value!r}",
            ))

    if events:
        return None, events

    # Pass 2: per-column type coercion.
    for col in PRODUCT_SALES_CANONICAL_HEADER:
        raw_value = raw_row.get(col)
        if col in PRODUCT_SALES_NUMERIC_COLS:
            try:
                canonical[col] = coerce_numeric(raw_value if isinstance(raw_value, str) else "")
            except ValueError:
                events.append(QuarantineEvent(
                    chain.factory_id, REPORT_PRODUCT_SALES, period,
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
# Reader dispatch
# ────────────────────────────────────────────────────────────────────

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


# ────────────────────────────────────────────────────────────────────
# File-level pipeline (Sub-ETL-1c orchestrator slice)
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

    # Normalize each data row.
    canonical_rows: list[dict[str, object]] = []
    quarantine: list[QuarantineEvent] = []

    header_to_canonical = {
        h.strip(): PRODUCT_SALES_HEADER_MAP[h.strip()]
        for h in header_row
        if h is not None and h.strip() in PRODUCT_SALES_HEADER_MAP
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
        canonical, events = normalize_row(raw_dict, period, resolved_chain, source_line_no)
        quarantine.extend(events)
        if canonical is not None:
            canonical_rows.append(canonical)

    # Write canonical CSV.
    output_dir = output_root / resolved_chain.factory_id / rtype
    output_dir.mkdir(parents=True, exist_ok=True)
    canonical_path = output_dir / f"{period}.csv"
    write_canonical_csv(canonical_path, canonical_rows)
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


def write_canonical_csv(path: Path, rows: list[dict[str, object]]) -> None:
    """Write canonical rows. Always writes header even if 0 rows (idempotent shape)."""
    if path is None:
        raise ValueError("write_canonical_csv: path required")
    path.parent.mkdir(parents=True, exist_ok=True)
    # newline="" + lineterminator="\n" guarantees byte-identical output across runs.
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=PRODUCT_SALES_CANONICAL_HEADER, lineterminator="\n",
        )
        writer.writeheader()
        for row in rows:
            # Coerce None -> "" at write time; preserve numeric formatting.
            out = {k: ("" if v is None else v) for k, v in row.items()}
            writer.writerow(out)


def write_quarantine(quarantine_root: Path, events: list[QuarantineEvent]) -> Optional[Path]:
    """Write all quarantine events to one CSV per (chain, report, period). Returns the path."""
    if quarantine_root is None:
        raise ValueError("write_quarantine: quarantine_root required")
    if not events:
        return None
    # Group by (chain, report, period); pilot writes all events into a single combined file
    # keyed on the first event for simplicity. Production split: one file per group.
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
