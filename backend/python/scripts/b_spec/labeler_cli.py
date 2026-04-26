"""Single-labeler interactive labeling for entity_resolution_labels.

Double-blind: labeler_a and labeler_b must be different humans. If the current
labeler is already labeler_a on a pair, that pair is skipped for them — they
can only fill the OTHER slot.

Usage:
    python scripts/b_spec/labeler_cli.py --factory F001 --labeler alice --entity-type store --batch 50
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Literal, Optional

from scripts.b_spec._db_helpers import DEFAULT_DSN, acquire_factory_conn

Slot = Literal["a", "b"]
Label = Literal["match", "no_match", "unsure"]
ValidEntity = Literal["store", "product", "staff"]


def _decide_slot(
    labeler: str,
    labeler_a: Optional[str],
    labeler_a_at,
    labeler_b: Optional[str],
    labeler_b_at,
) -> Optional[Slot]:
    """Return which slot this labeler should fill, or None if not applicable."""
    a_filled = labeler_a is not None and labeler_a_at is not None
    b_filled = labeler_b is not None and labeler_b_at is not None
    if a_filled and b_filled:
        return None
    if labeler_a == labeler or labeler_b == labeler:
        return None
    if not a_filled:
        return "a"
    return "b"


def _prompt_choice() -> Optional[Label]:
    """Read a single keystroke choice from stdin. Returns None on quit/skip."""
    raw = input("[m]atch / [n]o_match / [u]nsure / [s]kip / [q]uit: ").strip().lower()
    if raw in ("m", "match"):
        return "match"
    elif raw in ("n", "no", "no_match"):
        return "no_match"
    elif raw in ("u", "unsure"):
        return "unsure"
    elif raw in ("s", "skip"):
        return None
    elif raw in ("q", "quit", "exit"):
        raise KeyboardInterrupt
    else:
        print("  ? unrecognized — try again")
        return _prompt_choice()


async def _fetch_pending(
    conn,
    factory_id: str,
    entity_type: str,
    labeler: str,
    limit: int,
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT id, pair_a, pair_b,
               labeler_a, labeler_a_at,
               labeler_b, labeler_b_at
        FROM entity_resolution_labels
        WHERE factory_id = $1 AND entity_type = $2
          AND (labeler_a IS NULL OR labeler_b IS NULL OR
               labeler_a_at IS NULL OR labeler_b_at IS NULL)
          AND ($3 NOT IN (COALESCE(labeler_a, ''), COALESCE(labeler_b, '')))
        ORDER BY id
        LIMIT $4
        """,
        factory_id, entity_type, labeler, limit * 3,
    )
    return [dict(r) for r in rows]


async def _record(
    conn,
    row_id: int,
    slot: Slot,
    labeler: str,
    label: Label,
) -> None:
    if slot == "a":
        sql = (
            "UPDATE entity_resolution_labels "
            "SET labeler_a = $1, labeler_a_label = $2, labeler_a_at = NOW() "
            "WHERE id = $3"
        )
    else:
        sql = (
            "UPDATE entity_resolution_labels "
            "SET labeler_b = $1, labeler_b_label = $2, labeler_b_at = NOW() "
            "WHERE id = $3"
        )
    await conn.execute(sql, labeler, label, row_id)


async def main_async(args: argparse.Namespace) -> int:
    if args.entity_type not in ("store", "product", "staff"):
        print(f"ERROR: invalid entity-type {args.entity_type}")
        return 2

    labeled = 0
    skipped = 0
    async with acquire_factory_conn(args.dsn, args.factory) as conn:
        candidates = await _fetch_pending(
            conn, args.factory, args.entity_type, args.labeler, args.batch
        )

        if not candidates:
            print(f"No pending pairs for {args.entity_type} (labeler={args.labeler}).")
            return 0

        print(f"Loaded {len(candidates)} candidates. Target batch = {args.batch}\n")

        for row in candidates:
            if labeled >= args.batch:
                break
            slot = _decide_slot(
                args.labeler,
                row["labeler_a"],
                row["labeler_a_at"],
                row["labeler_b"],
                row["labeler_b_at"],
            )
            if slot is None:
                skipped += 1
                continue

            print(f"--- pair #{row['id']} (slot={slot}) ---")
            print(f"  A: {row['pair_a']}")
            print(f"  B: {row['pair_b']}")
            try:
                choice = _prompt_choice()
            except KeyboardInterrupt:
                print("\n[quit]")
                break

            if choice is None:
                skipped += 1
                print("  → skipped\n")
                continue

            await _record(conn, row["id"], slot, args.labeler, choice)
            labeled += 1
            print(f"  → recorded as '{choice}' in slot {slot}\n")

    print(f"\nSession summary: labeled={labeled}, skipped={skipped}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--factory", required=True)
    p.add_argument("--labeler", required=True)
    p.add_argument(
        "--entity-type", required=True, choices=["store", "product", "staff"]
    )
    p.add_argument("--batch", type=int, default=50)
    p.add_argument("--dsn", default=DEFAULT_DSN)
    args = p.parse_args()
    try:
        return asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
