"""Load candidate CSVs into entity_resolution_labels.

Reads data/labeling/candidates_{store,product,staff}.csv and inserts rows.
Idempotent strategy: SELECT-then-INSERT per (factory_id, entity_type, pair_a, pair_b).
The table has no unique constraint on those columns — re-running with the same
CSV will SKIP rows already present rather than inserting duplicates. Rows whose
pair_a/pair_b have been edited externally will not be detected as duplicates;
controller should drop existing rows for the (factory_id, entity_type) tuple
before re-importing edited data.

Transaction semantics: the entire import runs inside one transaction. If any
single row violates a constraint, ALL prior inserts in that run roll back.
Re-run after fixing the offending row.

Usage:
    python scripts/b_spec/import_labels.py --factory F001 --csv-dir ./data/labeling --dry-run
    python scripts/b_spec/import_labels.py --factory F001 --csv-dir ./data/labeling
"""
from __future__ import annotations

import argparse
import asyncio
import csv
from pathlib import Path

from scripts.b_spec._db_helpers import DEFAULT_DSN, acquire_factory_conn

ENTITY_FILES = {
    "store": "candidates_store.csv",
    "product": "candidates_product.csv",
    "staff": "candidates_staff.csv",
}


def parse_csv(path: Path) -> list[tuple[str, str, str]]:
    """Return list of (pair_a, pair_b, source) triples."""
    rows: list[tuple[str, str, str]] = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            a = (r.get("pair_a") or "").strip()
            b = (r.get("pair_b") or "").strip()
            src = (r.get("source") or "real_sample").strip()
            if a and b:
                rows.append((a, b, src))
    return rows


async def import_entity(
    conn,
    factory_id: str,
    entity_type: str,
    rows: list[tuple[str, str, str]],
) -> tuple[int, int]:
    """Insert rows; skip those already present. Return (inserted, skipped)."""
    inserted = 0
    skipped = 0
    for a, b, src in rows:
        existing = await conn.fetchval(
            """
            SELECT id FROM entity_resolution_labels
            WHERE factory_id = $1 AND entity_type = $2
              AND pair_a = $3 AND pair_b = $4
            """,
            factory_id, entity_type, a, b,
        )
        if existing is not None:
            skipped += 1
            continue
        await conn.execute(
            """
            INSERT INTO entity_resolution_labels
              (factory_id, entity_type, pair_a, pair_b, source, dataset_split)
            VALUES ($1, $2, $3, $4, $5, 'unassigned')
            """,
            factory_id, entity_type, a, b, src,
        )
        inserted += 1
    return inserted, skipped


async def main_async(args: argparse.Namespace) -> int:
    csv_dir = Path(args.csv_dir)
    if not csv_dir.is_dir():
        print(f"ERROR: csv-dir {csv_dir} does not exist")
        return 2

    parsed: dict[str, list[tuple[str, str, str]]] = {}
    for entity_type, filename in ENTITY_FILES.items():
        path = csv_dir / filename
        if not path.exists():
            print(f"WARN: {path} not found, skipping {entity_type}")
            parsed[entity_type] = []
            continue
        parsed[entity_type] = parse_csv(path)
        print(f"  {entity_type}: parsed {len(parsed[entity_type])} pairs from {filename}")

    if args.dry_run:
        total = sum(len(v) for v in parsed.values())
        print(f"\nDry-run: would attempt to insert {total} rows for factory={args.factory}")
        return 0

    async with acquire_factory_conn(args.dsn, args.factory) as conn:
        for entity_type, rows in parsed.items():
            if not rows:
                continue
            inserted, skipped = await import_entity(conn, args.factory, entity_type, rows)
            print(f"  {entity_type}: inserted={inserted}, skipped={skipped}")

    print(f"\nDone — factory={args.factory}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--factory", required=True)
    p.add_argument("--csv-dir", default="./data/labeling")
    p.add_argument("--dsn", default=DEFAULT_DSN)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
