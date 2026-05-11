"""T6.6 Phase B Step 2 — Silver/Gold loader orchestrator (Sub-ETL-2c).

Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3.3
Q1:   docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md §4.2
PR:   #316 (design spec) + #325 (Sub-ETL-3 seed) + #327/#331 (Sub-ETL-1 normalizer) +
      #332 (Sub-ETL-2a Day 0 audit) + #335 (§1.5 spec amend) + this PR (Sub-ETL-2b/2c)

Reads canonical CSVs from `data/imports/restaurant-chains/<chain>/<report>/<period>.csv`
(written by Sub-ETL-1 normalize_restaurant_chains.py).

Idempotently UPSERTs into smartbi_prod_db Silver tables per existing schema:
- dim_store         via UNIQUE (factory_id, name)
- dim_product       via UNIQUE (factory_id, normalized_name)
- fact_pos_transaction via UNIQUE (factory_id, source_type, store_id, source_bill_no)
- fact_pos_item     via DELETE-by-parent-txn-then-INSERT (Steve Option A 2026-05-12,
                    per PR #332 audit: no natural-key UNIQUE on fact_pos_item)
- fact_restaurant_requisition via UNIQUE (factory_id, source_pk) — for purchase_inbound
                              canonical CSVs ONLY (PR #331 added purchase report type)
- dim_ingredient    via UNIQUE (factory_id, source_pk)         — for purchase_inbound

Then refreshes Gold aggregations via INSERT...ON CONFLICT DO UPDATE on
agg_restaurant_daily_totals (per spec §3.3 line 471).

RLS contract: connection SETs `app.factory_id` before any INSERT. Cross-tenant
query returns 0 rows (verified by Sub-ETL-2c gate per spec §6 line 593).

NO mat-view operations — agg_restaurant_* are TABLES (not MVs) per
2026_04_24_gold_restaurant_ops.sql line 30.

Per python-java-port.md Rule 6: explicit None check at function boundaries.
Per Q-ETL-6: fail-loud on any unhandled error (no defensive fallback).
Per Q-ETL-5: scripts/etl/ location (NOT backend/python/smartbi/etl/).

CLI:
    python3 scripts/etl/import_restaurant_chain.py \\
        --factory-id R_ILTEATRO_REAL \\
        --source-dir data/imports/restaurant-chains/R_ILTEATRO_REAL \\
        --db-dsn postgresql://user:pass@host:5432/smartbi_prod_db \\
        [--dry-run]

DO NOT IMPORT: backend.python.smartbi.* — keep ETL operational scripts decoupled
from request-handling FastAPI module. Import only stdlib + asyncpg + _lib helpers.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import logging
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator, Optional


# Self-bootstrap import path for _lib package (mirrors normalize_restaurant_chains.py).
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from _lib.upsert_helpers import (  # noqa: E402
    LoaderStats,
    normalize_product_name,
    refresh_agg_restaurant_daily_totals,
    replace_fact_pos_items,
    set_factory_scope,
    upsert_dim_ingredient,
    upsert_dim_product,
    upsert_dim_store,
    upsert_fact_pos_transaction,
    upsert_fact_restaurant_requisition,
)


log = logging.getLogger("import_restaurant_chain")


# ────────────────────────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────────────────────────

DEFAULT_SOURCE_TYPE = "excel"  # per Q1 §4.2 — source_type for Excel-import facts.
DEFAULT_BATCH_SIZE = 500       # rows per inner txn batch (per MO step 3).
REPORT_PRODUCT_SALES = "product_sales"
REPORT_PURCHASE_INBOUND = "purchase_inbound"
REPORT_PROFIT = "profit"  # NOT loaded into facts — finance shape, no Silver target.


# ────────────────────────────────────────────────────────────────────
# Canonical CSV reader (mirrors normalize_restaurant_chains.write_canonical_csv)
# ────────────────────────────────────────────────────────────────────

def read_canonical_csv(path: Path) -> list[dict[str, str]]:
    """Read canonical CSV produced by Sub-ETL-1. Returns list of row dicts.

    Empty fields are emitted as "" by the normalizer; caller treats "" as None.
    """
    if path is None:
        raise ValueError("read_canonical_csv: path required")
    if not path.exists():
        raise FileNotFoundError(f"canonical CSV missing: {path}")
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader)


def _empty_to_none(value: Optional[str]) -> Optional[str]:
    """Convert "" → None for Optional string columns (canonical CSV convention)."""
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _parse_decimal(value: Optional[str]) -> Optional[float]:
    """Parse canonical numeric string → float, "" → None.

    Per Sub-ETL-1 contract (PRODUCT_SALES_NUMERIC_COLS validated at normalize time):
    inputs here are pre-validated to be valid numerics or empty. Fail loud on drift.
    """
    s = _empty_to_none(value)
    if s is None:
        return None
    try:
        return float(s)
    except ValueError as e:
        raise ValueError(f"_parse_decimal: bad numeric {value!r}: {e}") from e


def _parse_int(value: Optional[str]) -> Optional[int]:
    """Parse canonical int string → int, "" → None."""
    s = _empty_to_none(value)
    if s is None:
        return None
    try:
        return int(float(s))  # canonical CSV stores all numerics as floats
    except ValueError as e:
        raise ValueError(f"_parse_int: bad int {value!r}: {e}") from e


def _parse_date(value: Optional[str]) -> Optional[date]:
    """Parse date string in YYYY-MM-DD or YYYY/MM/DD form, "" → None."""
    s = _empty_to_none(value)
    if s is None:
        return None
    s = s.strip().replace("/", "-")
    # Try ISO first, then datetime variants.
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"_parse_date: cannot parse {value!r}")


def _source_pk(factory_id: str, *parts: str) -> str:
    """Deterministic source_pk from factory_id + identifying parts.

    Format: f'<factory_id>:<sha1-of-parts>'. Used for dim_ingredient and
    fact_restaurant_requisition where source has no first-class PK.
    """
    if not factory_id:
        raise ValueError("_source_pk: factory_id required")
    h = hashlib.sha1()
    for p in parts:
        h.update((p or "").encode("utf-8"))
        h.update(b":")
    return f"{factory_id}:{h.hexdigest()}"


# ────────────────────────────────────────────────────────────────────
# Per-report loader: product_sales (商品销量报表)
# ────────────────────────────────────────────────────────────────────

@dataclass
class _ProductSalesLine:
    """One canonical row from product_sales canonical CSV.

    Per scripts/etl/_lib/column_mapping.py PRODUCT_SALES_CANONICAL_HEADER (19 cols).
    """
    store_name: str
    product_name: str
    product_category: Optional[str]
    revenue_group: Optional[str]
    product_code: Optional[str]
    spec: Optional[str]
    product_type: Optional[str]
    order_method: Optional[str]
    qty_single: Optional[float]
    qty_total: Optional[float]
    qty_refund: Optional[float]
    qty_combo_child: Optional[float]
    unit: Optional[str]
    unit_price: Optional[float]
    gross_amount: Optional[float]
    net_after_discount: Optional[float]
    discount_allocated: Optional[float]
    refund_amount: Optional[float]
    actual_receive: Optional[float]


def _row_to_product_sales_line(row: dict[str, str]) -> _ProductSalesLine:
    """Project canonical CSV row → _ProductSalesLine."""
    store_name = _empty_to_none(row.get("store_name"))
    product_name = _empty_to_none(row.get("product_name"))
    if not store_name:
        raise ValueError(f"_row_to_product_sales_line: store_name required in {row!r}")
    if not product_name:
        raise ValueError(f"_row_to_product_sales_line: product_name required in {row!r}")
    return _ProductSalesLine(
        store_name=store_name,
        product_name=product_name,
        product_category=_empty_to_none(row.get("product_category")),
        revenue_group=_empty_to_none(row.get("revenue_group")),
        product_code=_empty_to_none(row.get("product_code")),
        spec=_empty_to_none(row.get("spec")),
        product_type=_empty_to_none(row.get("product_type")),
        order_method=_empty_to_none(row.get("order_method")),
        qty_single=_parse_decimal(row.get("qty_single")),
        qty_total=_parse_decimal(row.get("qty_total")),
        qty_refund=_parse_decimal(row.get("qty_refund")),
        qty_combo_child=_parse_decimal(row.get("qty_combo_child")),
        unit=_empty_to_none(row.get("unit")),
        unit_price=_parse_decimal(row.get("unit_price")),
        gross_amount=_parse_decimal(row.get("gross_amount")),
        net_after_discount=_parse_decimal(row.get("net_after_discount")),
        discount_allocated=_parse_decimal(row.get("discount_allocated")),
        refund_amount=_parse_decimal(row.get("refund_amount")),
        actual_receive=_parse_decimal(row.get("actual_receive")),
    )


async def load_product_sales_csv(
    conn: Any,
    factory_id: str,
    period: str,
    csv_path: Path,
    stats: LoaderStats,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> None:
    """Load one period's product_sales canonical CSV into Silver.

    Strategy:
    - Each (store_name, product_name, period) maps to a synthetic bill_no
      `<period>:<store>:<product>` (deterministic — re-run UPSERTs same row).
    - fact_pos_transaction row stores per-product aggregate (qty_total, gross_amount,
      net_after_discount, refund_amount, actual_receive).
    - fact_pos_item: one row per parent txn (qty/unit_price/amount + return_qty).
    - product_sales report is product-grain aggregate (not bill-grain), so this
      mapping is lossy compared to "real" POS data — acceptable per Q1 §4.2
      (the only data source for restaurant chains is this aggregate level).
    - L3 qty_total fallback (PR #357 audit, follow-up to PR #361): some source
      Excels (e.g. IL TEATRO 2月) expose 单卖数量 (qty_single) but NOT
      数量(含套餐子商品) (qty_total). When qty_total is missing, the loader uses
      qty_single for both item_count and fact_pos_item.qty so downstream Gold
      aggregates are populated. qty_total is preferred when present (套餐 cases).

    Args:
        conn:       asyncpg connection (RLS scope set).
        factory_id: tenant id.
        period:     period identifier from CSV stem (e.g. '2024-02').
        csv_path:   path to canonical CSV.
        stats:      accumulator.
        batch_size: rows per inner asyncpg.transaction (default 500).

    Errors:
        Per Q-ETL-6 fail-loud — caller's outer txn rolls back on any error.
    """
    if not factory_id or not period or csv_path is None:
        raise ValueError("load_product_sales_csv: factory_id + period + csv_path required")

    rows = read_canonical_csv(csv_path)
    log.info(
        "load_product_sales_csv: factory=%s period=%s rows=%d",
        factory_id, period, len(rows),
    )

    # Phase 1: cache dim_store / dim_product upserts (avoid N+1 round-trips).
    # Since canonical CSV is product-grain, distinct stores/products are typically
    # << total rows; cache them and batch upserts on first sighting.
    store_id_cache: dict[str, int] = {}
    product_id_cache: dict[str, int] = {}

    # Phase 2: per-row UPSERT (transaction-grouped externally by caller).
    for line_idx, raw in enumerate(rows, start=1):
        try:
            line = _row_to_product_sales_line(raw)
        except ValueError as e:
            stats.errors.append(f"{csv_path.name}:{line_idx}: {e}")
            raise  # Q-ETL-6 fail-loud

        # dim_store cache
        if line.store_name not in store_id_cache:
            sid = await upsert_dim_store(conn, factory_id, line.store_name)
            store_id_cache[line.store_name] = sid
            stats.dim_store_upserts += 1
        store_id = store_id_cache[line.store_name]

        # dim_product cache (normalized_name key)
        try:
            norm_name = normalize_product_name(line.product_name)
        except ValueError as e:
            stats.errors.append(f"{csv_path.name}:{line_idx}: bad product_name: {e}")
            raise
        if norm_name not in product_id_cache:
            pid = await upsert_dim_product(
                conn, factory_id, line.product_name,
                normalized_name=norm_name,
                category=line.product_category,
                sub_category=line.revenue_group,
                sku_code=line.product_code,
            )
            product_id_cache[norm_name] = pid
            stats.dim_product_upserts += 1
        product_id = product_id_cache[norm_name]

        # Synthetic bill_no for this product-grain aggregate row.
        bill_no = f"{period}:{line.store_name}:{line.product_name}"

        # fact_pos_transaction at period+store+product grain.
        # period stem like '2024-02' → first-of-month as canonical date.
        bill_date = _period_to_date(period)
        # L3 fallback (PR #357 audit): some source Excels expose 单卖数量 (qty_single)
        # but NOT 数量(含套餐子商品) (qty_total). When qty_total is missing, fall back
        # to qty_single so item_count / qty are populated rather than NULL. Per Rule 1
        # (python-java-port.md) — explicit `is not None` precedence, not Python `or`.
        effective_qty = line.qty_total if line.qty_total is not None else line.qty_single
        txn_id = await upsert_fact_pos_transaction(
            conn,
            factory_id=factory_id,
            source_type=DEFAULT_SOURCE_TYPE,
            source_bill_no=bill_no,
            store_id=store_id,
            date=bill_date,
            gross_amount=line.gross_amount,
            discount_amount=line.discount_allocated,
            net_amount=line.net_after_discount,
            actual_receive=line.actual_receive,
            order_type=line.order_method,
            item_count=int(effective_qty) if effective_qty is not None else None,
        )
        stats.fact_pos_transaction_upserts += 1

        # fact_pos_item: one synthetic line for this product-grain txn.
        # DELETE-by-parent-txn-then-INSERT pattern (Steve Option A).
        # qty falls back to qty_single when source 不含套餐 (see L3 note above).
        items = [{
            "product_id": product_id,
            "qty": effective_qty,
            "unit_price": line.unit_price,
            "amount": line.gross_amount,
            "source_item_raw": (
                f"{line.product_name}|spec={line.spec or ''}|unit={line.unit or ''}"
            ),
            "return_qty": line.qty_refund,  # Q-DEC-6 F1 (PR #331 V20260511_03)
        }]
        await replace_fact_pos_items(conn, factory_id, txn_id, items, stats=stats)


def _period_to_date(period: str) -> date:
    """Map period stem to a canonical first-of-month date.

    Real CSVs use stems like '2024-02', '2024-02-product_sales', or
    '锦川火锅-2024-03'. Extract leading 'YYYY-MM' (or 'YYYY-MM-DD'); fall back
    to 1970-01-01 only as last resort (which won't match any real reporting period).
    """
    if not period:
        return date(1970, 1, 1)

    # Try to find YYYY-MM-DD or YYYY-MM substring.
    import re as _re
    m = _re.search(r"(\d{4})[-/](\d{2})(?:[-/](\d{2}))?", period)
    if m is None:
        return date(1970, 1, 1)
    year, month = int(m.group(1)), int(m.group(2))
    day = int(m.group(3)) if m.group(3) else 1
    try:
        return date(year, month, day)
    except ValueError:
        return date(1970, 1, 1)


# ────────────────────────────────────────────────────────────────────
# Per-report loader: purchase_inbound (采购入库明细)
# ────────────────────────────────────────────────────────────────────

async def load_purchase_inbound_csv(
    conn: Any,
    factory_id: str,
    period: str,
    csv_path: Path,
    stats: LoaderStats,
) -> None:
    """Load one period's purchase_inbound canonical CSV into Silver.

    Maps to:
    - dim_ingredient via UNIQUE (factory_id, source_pk) where
      source_pk = sha1(factory_id + supplier_name + product_code + product_name)
    - fact_restaurant_requisition via UNIQUE (factory_id, source_pk) where
      source_pk = sha1(factory_id + period + doc_no + product_name)

    type='PURCHASE' / status='RECEIVED' — preserves provenance from upstream.
    """
    if not factory_id or not period or csv_path is None:
        raise ValueError("load_purchase_inbound_csv: factory_id + period + csv_path required")

    rows = read_canonical_csv(csv_path)
    log.info(
        "load_purchase_inbound_csv: factory=%s period=%s rows=%d",
        factory_id, period, len(rows),
    )

    ingredient_id_cache: dict[str, int] = {}

    for line_idx, raw in enumerate(rows, start=1):
        product_name = _empty_to_none(raw.get("product_name"))
        if not product_name:
            stats.errors.append(f"{csv_path.name}:{line_idx}: product_name required")
            raise ValueError(f"product_name required at {csv_path.name}:{line_idx}")

        supplier_name = _empty_to_none(raw.get("supplier_name"))
        product_code = _empty_to_none(raw.get("product_code"))
        inbound_qty = _parse_decimal(raw.get("inbound_qty"))
        unit_price = _parse_decimal(raw.get("unit_price"))
        total_amount = _parse_decimal(raw.get("total_amount"))
        inbound_date = _parse_date(raw.get("inbound_date")) or _period_to_date(period)
        unit = _empty_to_none(raw.get("unit"))
        doc_no = _empty_to_none(raw.get("doc_no"))

        ingredient_source_pk = _source_pk(
            factory_id, supplier_name or "", product_code or "", product_name,
        )

        if ingredient_source_pk not in ingredient_id_cache:
            iid = await upsert_dim_ingredient(
                conn,
                factory_id=factory_id,
                source_pk=ingredient_source_pk,
                name=product_name,
                unit=unit,
                unit_price=unit_price,
            )
            ingredient_id_cache[ingredient_source_pk] = iid
            stats.dim_ingredient_upserts += 1
        ingredient_id = ingredient_id_cache[ingredient_source_pk]

        req_source_pk = _source_pk(
            factory_id, period, doc_no or "", product_name, str(line_idx),
        )

        await upsert_fact_restaurant_requisition(
            conn,
            factory_id=factory_id,
            source_pk=req_source_pk,
            date=inbound_date,
            requisition_number=doc_no,
            ingredient_id=ingredient_id,
            type_="PURCHASE",
            status="RECEIVED",
            requested_qty=inbound_qty,
            actual_qty=inbound_qty,
            unit=unit,
            est_cost=total_amount,
            notes=f"supplier={supplier_name or ''}",
        )
        stats.fact_restaurant_requisition_upserts += 1


# ────────────────────────────────────────────────────────────────────
# Chain-level orchestrator
# ────────────────────────────────────────────────────────────────────

def discover_canonical_csvs(source_dir: Path) -> Iterator[tuple[str, str, Path]]:
    """Walk source_dir for canonical CSVs.

    Layout per Sub-ETL-1 normalize_restaurant_chains.py:
      <factory_id>/<report_type>/<period>.csv

    Yields (report_type, period_stem, csv_path). Order is deterministic
    (sorted by report_type, period_stem).

    Skips REPORT_PROFIT (no Silver target — accounting line items).
    """
    if source_dir is None:
        raise ValueError("discover_canonical_csvs: source_dir required")
    if not source_dir.exists():
        return

    entries: list[tuple[str, str, Path]] = []
    for report_dir in sorted(source_dir.iterdir()):
        if not report_dir.is_dir():
            continue
        report_type = report_dir.name
        for csv_path in sorted(report_dir.glob("*.csv")):
            period_stem = csv_path.stem
            entries.append((report_type, period_stem, csv_path))

    for entry in entries:
        yield entry


async def import_chain(
    factory_id: str,
    source_dir: Path,
    db_dsn: str,
    dry_run: bool = False,
) -> LoaderStats:
    """Load all canonical CSVs for one chain into Silver, refresh Gold.

    Transaction strategy:
    - One outer asyncpg.transaction() wraps the entire chain load.
    - dry_run=True: ROLLBACK at end (preview); dry_run=False: COMMIT.
    - Per-row failures abort the whole txn (Q-ETL-6 fail-loud).

    RLS: SET app.factory_id at start of txn so all INSERTs satisfy
         tenant_isolation policy.

    Args:
        factory_id: tenant id (must match restaurant_chain_catalog seed row).
        source_dir: data/imports/restaurant-chains/<chain>/
        db_dsn:     postgresql://... DSN for smartbi_prod_db / smartbi_db.
        dry_run:    if True, ROLLBACK after load (preview only).

    Returns:
        LoaderStats populated with per-table counts.

    Raises:
        Per Q-ETL-6 — any per-row error rolls back outer txn AND re-raises.
    """
    if not factory_id:
        raise ValueError("import_chain: factory_id required")
    if source_dir is None or not source_dir.exists():
        raise ValueError(f"import_chain: source_dir missing ({source_dir!r})")
    if not db_dsn:
        raise ValueError("import_chain: db_dsn required")

    # Import asyncpg lazily so tests without asyncpg can still import this module.
    import asyncpg  # noqa: WPS433

    stats = LoaderStats(factory_id=factory_id)
    conn = None
    txn = None
    try:
        conn = await asyncpg.connect(db_dsn)
        txn = conn.transaction()
        await txn.start()
        await set_factory_scope(conn, factory_id)

        # Track date range for Gold refresh.
        min_date: Optional[date] = None
        max_date: Optional[date] = None

        for report_type, period, csv_path in discover_canonical_csvs(source_dir):
            log.info(
                "import_chain: factory=%s report=%s period=%s path=%s",
                factory_id, report_type, period, csv_path,
            )
            if report_type == REPORT_PRODUCT_SALES:
                await load_product_sales_csv(conn, factory_id, period, csv_path, stats)
            elif report_type == REPORT_PURCHASE_INBOUND:
                await load_purchase_inbound_csv(conn, factory_id, period, csv_path, stats)
            elif report_type == REPORT_PROFIT:
                log.info("import_chain: skipping profit report (no Silver target)")
                continue
            else:
                # Unknown report type — fail loud per Q-ETL-6.
                raise ValueError(
                    f"import_chain: unsupported report_type={report_type!r} at {csv_path}"
                )

            d = _period_to_date(period)
            if min_date is None or d < min_date:
                min_date = d
            if max_date is None or d > max_date:
                max_date = d

        # Refresh Gold for loaded date range (skipped if no facts loaded).
        if min_date is not None and max_date is not None:
            log.info(
                "import_chain: refreshing Gold agg_restaurant_daily_totals "
                "factory=%s range=[%s, %s]",
                factory_id, min_date, max_date,
            )
            await refresh_agg_restaurant_daily_totals(
                conn, factory_id, min_date, max_date, stats=stats,
            )

        if dry_run:
            log.warning("import_chain: --dry-run set, ROLLBACK")
            await txn.rollback()
        else:
            await txn.commit()
            log.info("import_chain: COMMIT factory=%s stats=%s", factory_id, stats.to_dict())

    except Exception:
        if txn is not None:
            try:
                await txn.rollback()
            except Exception:  # noqa: BLE001
                log.exception("import_chain: rollback also failed")
        raise
    finally:
        if conn is not None:
            await conn.close()

    return stats


# ────────────────────────────────────────────────────────────────────
# CLI entry
# ────────────────────────────────────────────────────────────────────

def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--factory-id", required=True, help="e.g. R_ILTEATRO_REAL")
    parser.add_argument(
        "--source-dir", required=True,
        help="data/imports/restaurant-chains/<chain>/ — written by Sub-ETL-1",
    )
    parser.add_argument(
        "--db-dsn", required=True,
        help="postgresql://user:pass@host:5432/smartbi_prod_db (or smartbi_db for test)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="ROLLBACK after load (preview only, no DB writes persist)",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        stats = asyncio.run(
            import_chain(
                factory_id=args.factory_id,
                source_dir=Path(args.source_dir),
                db_dsn=args.db_dsn,
                dry_run=args.dry_run,
            )
        )
    except Exception as e:  # noqa: BLE001
        log.exception("import_chain failed: %s", e)
        return 1

    log.info("import_chain complete: %s", stats.to_dict())
    if stats.errors:
        log.error("import_chain had %d row-level errors", len(stats.errors))
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
