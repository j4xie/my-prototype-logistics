"""Deterministic 60/20/20 train/dev/holdout split for labeled rows.

Assignment is SHA256(id || seed) → bucket; same seed always maps a row to the
same split, so re-running is idempotent. Only rows where gold_label IS NOT NULL
AND dataset_split = 'unassigned' are touched.

Usage:
    python scripts/b_spec/assign_split.py --factory F001 --entity-type store --seed 42
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
from typing import Literal

from scripts.b_spec._db_helpers import DEFAULT_DSN, acquire_factory_conn

Split = Literal["train", "dev", "holdout"]


def assign_split_for(row_id: int, seed: int) -> Split:
    """Return train/dev/holdout for a given row id + seed."""
    h = hashlib.sha256(f"{row_id}:{seed}".encode("utf-8")).digest()
    bucket = int.from_bytes(h[:8], "big") % 100
    if bucket < 60:
        return "train"
    if bucket < 80:
        return "dev"
    return "holdout"


async def _fetch_unassigned(
    conn,
    factory_id: str,
    entity_type: str,
) -> list[int]:
    rows = await conn.fetch(
        """
        SELECT id FROM entity_resolution_labels
        WHERE factory_id = $1 AND entity_type = $2
          AND gold_label IS NOT NULL
          AND dataset_split = 'unassigned'
        ORDER BY id
        """,
        factory_id, entity_type,
    )
    return [r["id"] for r in rows]


async def _apply_split(conn, row_id: int, split: Split) -> None:
    await conn.execute(
        "UPDATE entity_resolution_labels SET dataset_split = $1 WHERE id = $2",
        split, row_id,
    )


async def main_async(args: argparse.Namespace) -> int:
    if args.entity_type not in ("store", "product", "staff"):
        print(f"ERROR: invalid entity-type {args.entity_type}")
        return 2

    counts = {"train": 0, "dev": 0, "holdout": 0}
    async with acquire_factory_conn(args.dsn, args.factory) as conn:
        ids = await _fetch_unassigned(conn, args.factory, args.entity_type)
        if not ids:
            print(f"No unassigned gold-labeled rows for {args.entity_type}.")
            return 0
        for row_id in ids:
            split = assign_split_for(row_id, args.seed)
            await _apply_split(conn, row_id, split)
            counts[split] += 1

    total = sum(counts.values())
    print(f"Assigned {total} row(s) for entity_type={args.entity_type} (seed={args.seed}):")
    print(f"  train:   {counts['train']:>5}  ({counts['train'] * 100 / total:.1f}%)")
    print(f"  dev:     {counts['dev']:>5}  ({counts['dev'] * 100 / total:.1f}%)")
    print(f"  holdout: {counts['holdout']:>5}  ({counts['holdout'] * 100 / total:.1f}%)")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--factory", required=True)
    p.add_argument(
        "--entity-type", required=True, choices=["store", "product", "staff"]
    )
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--dsn", default=DEFAULT_DSN)
    args = p.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
