"""Third-person tie-breaking for entity_resolution_labels.

Two modes:
  --auto-agreed: bulk promote rows where labeler_a_label == labeler_b_label
                 to gold_label without human intervention.
  (interactive): walk through disagreements and prompt arbitrator for verdict.

Usage:
    python scripts/b_spec/arbitrate.py --factory F001 --auto-agreed --entity-type store
    python scripts/b_spec/arbitrate.py --factory F001 --arbitrator carol --entity-type store --batch 30
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Literal, Optional

from scripts.b_spec._db_helpers import DEFAULT_DSN, acquire_factory_conn

Verdict = Literal["match", "no_match", "unsure"]


def _prompt_verdict() -> Optional[Verdict]:
    raw = input("Final verdict — [m]atch / [n]o_match / [u]nsure / [s]kip / [q]uit: ").strip().lower()
    match raw:
        case "m" | "match":
            return "match"
        case "n" | "no" | "no_match":
            return "no_match"
        case "u" | "unsure":
            return "unsure"
        case "s" | "skip":
            return None
        case "q" | "quit" | "exit":
            raise KeyboardInterrupt
        case _:
            print("  ? unrecognized — try again")
            return _prompt_verdict()


async def _auto_promote_agreed(
    conn,
    factory_id: str,
    entity_type: str,
) -> int:
    result = await conn.execute(
        """
        UPDATE entity_resolution_labels
        SET gold_label = labeler_a_label,
            arbitrated_by = 'auto_agreed',
            arbitrated_at = NOW()
        WHERE factory_id = $1
          AND entity_type = $2
          AND labeler_a_at IS NOT NULL
          AND labeler_b_at IS NOT NULL
          AND labeler_a_label IS NOT NULL
          AND labeler_b_label IS NOT NULL
          AND labeler_a_label = labeler_b_label
          AND gold_label IS NULL
        """,
        factory_id, entity_type,
    )
    parts = result.split()
    return int(parts[-1]) if parts and parts[-1].isdigit() else 0


async def _fetch_disagreements(
    conn,
    factory_id: str,
    entity_type: str,
    limit: int,
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT id, pair_a, pair_b,
               labeler_a, labeler_a_label,
               labeler_b, labeler_b_label
        FROM entity_resolution_labels
        WHERE factory_id = $1
          AND entity_type = $2
          AND labeler_a_at IS NOT NULL
          AND labeler_b_at IS NOT NULL
          AND labeler_a_label != labeler_b_label
          AND arbitrated_at IS NULL
        ORDER BY id
        LIMIT $3
        """,
        factory_id, entity_type, limit,
    )
    return [dict(r) for r in rows]


async def _record_verdict(
    conn,
    row_id: int,
    arbitrator: str,
    verdict: Verdict,
) -> None:
    await conn.execute(
        """
        UPDATE entity_resolution_labels
        SET gold_label = $1, arbitrated_by = $2, arbitrated_at = NOW()
        WHERE id = $3
        """,
        verdict, arbitrator, row_id,
    )


async def main_async(args: argparse.Namespace) -> int:
    if args.entity_type not in ("store", "product", "staff"):
        print(f"ERROR: invalid entity-type {args.entity_type}")
        return 2

    async with acquire_factory_conn(args.dsn, args.factory) as conn:
        if args.auto_agreed:
            promoted = await _auto_promote_agreed(conn, args.factory, args.entity_type)
            print(f"Auto-promoted {promoted} agreed pair(s) for entity_type={args.entity_type}.")
            return 0

        if not args.arbitrator:
            print("ERROR: --arbitrator required for interactive mode")
            return 2

        rows = await _fetch_disagreements(
            conn, args.factory, args.entity_type, args.batch
        )
        if not rows:
            print(f"No disagreements pending for {args.entity_type}.")
            return 0

        print(f"Loaded {len(rows)} disagreement(s). Arbitrator={args.arbitrator}\n")
        decided = 0
        skipped = 0
        for row in rows:
            print(f"--- pair #{row['id']} ---")
            print(f"  A: {row['pair_a']}")
            print(f"  B: {row['pair_b']}")
            print(f"  {row['labeler_a']} → {row['labeler_a_label']}")
            print(f"  {row['labeler_b']} → {row['labeler_b_label']}")
            try:
                verdict = _prompt_verdict()
            except KeyboardInterrupt:
                print("\n[quit]")
                break
            if verdict is None:
                skipped += 1
                print("  → skipped\n")
                continue
            await _record_verdict(conn, row["id"], args.arbitrator, verdict)
            decided += 1
            print(f"  → final = {verdict}\n")

        print(f"\nSession summary: decided={decided}, skipped={skipped}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--factory", required=True)
    p.add_argument(
        "--entity-type", required=True, choices=["store", "product", "staff"]
    )
    p.add_argument("--arbitrator", default=None)
    p.add_argument("--auto-agreed", action="store_true")
    p.add_argument("--batch", type=int, default=30)
    p.add_argument("--dsn", default=DEFAULT_DSN)
    args = p.parse_args()
    try:
        return asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
