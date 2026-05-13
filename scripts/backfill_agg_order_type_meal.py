#!/usr/bin/env python3
"""Backfill agg_daily_order_type_meal from fact_pos_transaction.

Used once after Phase A migrations land to compute Gold rows for historical
fact data. After this, the dual_write hook (Task D2) keeps it fresh on every
new upload.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.7
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task D2

Usage:
    python scripts/backfill_agg_order_type_meal.py \\
      --factory R_QINGHUAJIAO_REAL \\
      --date-from 2025-01-01 --date-to 2025-12-31 \\
      --env prod
"""
import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

import asyncpg

# Add backend/python to sys.path so smartbi.* imports work.
_HERE = Path(__file__).resolve()
_BACKEND_PY = _HERE.parent.parent / "backend" / "python"
if str(_BACKEND_PY) not in sys.path:
    sys.path.insert(0, str(_BACKEND_PY))

from smartbi.config import get_settings  # noqa: E402
from smartbi.services.materialized_analytics.daily_order_type_meal import (  # noqa: E402
    materialize_daily_order_type_meal,
)


async def _main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill agg_daily_order_type_meal for a factory + date range.",
    )
    parser.add_argument(
        "--factory", required=True,
        help="factory_id, e.g. R_QINGHUAJIAO_REAL",
    )
    parser.add_argument(
        "--date-from", required=True,
        help="Inclusive start date YYYY-MM-DD",
    )
    parser.add_argument(
        "--date-to", required=True,
        help="Inclusive end date YYYY-MM-DD",
    )
    parser.add_argument(
        "--env", choices=("test", "prod"), default="test",
        help="Which DB env; reads SMARTBI postgres_url from settings.",
    )
    args = parser.parse_args()

    date_from = datetime.strptime(args.date_from, "%Y-%m-%d").date()
    date_to = datetime.strptime(args.date_to, "%Y-%m-%d").date()
    if date_from > date_to:
        print(f"ERROR: date-from > date-to ({date_from} > {date_to})", file=sys.stderr)
        return 2

    settings = get_settings()
    pg_url = settings.postgres_url
    if not pg_url:
        print("ERROR: postgres_url not configured in settings.", file=sys.stderr)
        return 2

    print(
        f"[backfill] env={args.env} factory={args.factory} "
        f"range=[{date_from}..{date_to}]"
    )

    conn = await asyncpg.connect(pg_url)
    try:
        # set_config session-scoped so RLS allows the UPSERT.
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", args.factory
        )
        # Build a transient single-conn "pool" interface for the aggregator.
        # Simpler than asyncpg.create_pool for a one-shot CLI; the aggregator
        # only needs pool.acquire() and we provide that contract.
        class _SingleConnPool:
            def __init__(self, c):
                self._c = c

            def acquire(self):
                conn_holder = self._c

                class _Ctx:
                    async def __aenter__(_self):
                        return conn_holder

                    async def __aexit__(_self, *exc):
                        return False

                return _Ctx()

        pool = _SingleConnPool(conn)
        affected = await materialize_daily_order_type_meal(
            pool, args.factory, date_from, date_to,
        )
        print(
            f"[backfill] Done. agg_daily_order_type_meal upserts: {affected} "
            f"(factory={args.factory}, range=[{date_from}..{date_to}], env={args.env})"
        )
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
