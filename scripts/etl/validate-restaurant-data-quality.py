#!/usr/bin/env python3
"""Validate restaurant N1-N4 data prerequisites against smartbi (prod or test).

Audits 14 real-data restaurant chains seeded in V20260511_02 to determine
whether each chain has the source-table data required for the new
/analysis/quality restaurant 4-metric envelope (PR #358 LIVE prod 8083):

* N1 FOOD_SAFETY_INCIDENT_RATE — always-null per Q-DEC-4 D1 (no schema dep)
* N2 COMPLAINT_RATE          — needs ``restaurant_reviews`` rating rows
* N3 DISH_RETURN_RATE        — needs ``fact_pos_item.return_qty`` > 0 rows
                                (column from V20260511_03 LIVE prod)
* N4 WASTAGE_RATE            — needs ``fact_restaurant_wastage``
                                + ``fact_restaurant_requisition`` rows

Per-chain status is one of:

* ``READY``         — rows present, endpoint returns non-empty value
* ``EMPTY``         — table exists but no rows for this factory
* ``MISSING_TABLE`` — table or column missing (e.g. V20260511_03 not applied)

The script also queries factory-tenant Silver schema state to populate the
Phase 2D dispatch prereq audit (which Silver tables exist + per-factory
row counts for FACTORY-prefixed tenants).

RLS contract: every fact_* / restaurant_reviews table uses
``USING (factory_id = current_setting('app.factory_id', true))`` per
2026_04_24_silver_restaurant_ops.sql + 2026_04_29_silver_facts.sql.
``FORCE ROW LEVEL SECURITY`` is set, so even the table owner is subject
to the policy — the script ``SET LOCAL app.factory_id = '<id>'`` per
factory before each query.

Usage::

    # Local test DB (smartbi_db)
    python scripts/etl/validate-restaurant-data-quality.py \\
        --env test \\
        --output reports/restaurant-data-quality-test.json

    # Production (smartbi_prod_db) — SSH to server 47 first
    SMARTBI_PG_PASSWORD=$(cat /www/wwwroot/cretas/.env.prod | grep SMARTBI_DB_PASSWORD | cut -d= -f2) \\
        python scripts/etl/validate-restaurant-data-quality.py \\
        --env prod \\
        --output reports/restaurant-data-quality-prod-$(date +%F).json \\
        --markdown reports/restaurant-data-quality-prod-$(date +%F).md

    # Custom DSN
    python scripts/etl/validate-restaurant-data-quality.py \\
        --dsn postgres://user:pass@host:5432/dbname \\
        --output /tmp/audit.json

Per python-java-port.md Rule 1: explicit ``is not None`` checks throughout
(no Python falsy hazards on Decimal/int aggregates).
Per python-java-port.md Rule 6: precondition raises on missing arguments.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

# Top-level import guarded so the unit tests can monkeypatch asyncpg
# without a hard dependency. ``asyncpg`` is in
# ``backend/python/requirements.txt`` so the server-side runtime always
# has it; CI / dev shells may not, hence the lazy import in main().

logger = logging.getLogger("validate-restaurant-data-quality")


# ============================================================
# 14 real-data restaurant chain factory_ids (V20260511_02 seed)
# ============================================================
# Authoritative source: backend/python/smartbi/database/migrations/
# V20260511_02__t6_6_etl_seed_14_real_chains.sql. Order matches the seed
# INSERT statement so the JSON output is deterministic across runs.

REAL_RESTAURANT_FACTORIES: list[str] = [
    "R_ILTEATRO_REAL",
    "R_SHANGMA_HG_REAL",
    "R_JINCHUAN_HG_REAL",
    "R_XIMAXIANG_REAL",
    "R_YUJIUJING_REAL",
    "R_YONGHE_REAL",
    "R_XINBASHU_REAL",
    "R_QINGHUAJIAO_REAL",
    "R_DONGMENKOU_REAL",
    "R_HONGDEJI_REAL",
    "R_JINRINIUSHI_REAL",
    "R_YOUZIYOUWEI_REAL",
    "R_LINJIAYAN_REAL",
    "R_HUOGUO_GENERIC_REAL",
]


# ============================================================
# Status enum (string literals to keep JSON output stable)
# ============================================================

STATUS_READY = "READY"
STATUS_EMPTY = "EMPTY"
STATUS_MISSING_TABLE = "MISSING_TABLE"
STATUS_ALWAYS_NULL_OK = "always_null_ok"


# ============================================================
# Dataclasses
# ============================================================


@dataclass
class FactoryResult:
    """Per-factory N1-N4 readiness assessment + overall verdict."""

    factory_id: str
    n1_food_safety: str = STATUS_ALWAYS_NULL_OK
    n2_complaints: dict = field(default_factory=dict)
    n3_returns: dict = field(default_factory=dict)
    n4_wastage: dict = field(default_factory=dict)
    overall: str = "UNKNOWN"
    error: Optional[str] = None


# ============================================================
# Environment / DSN
# ============================================================


def resolve_dsn(env: str, override: Optional[str]) -> str:
    """Build a postgres DSN from ``--env`` or explicit ``--dsn``.

    Per HARD rule .claude/rules/CREDENTIAL-MANAGEMENT.md: passwords come
    from environment variables, never hardcoded. The script reads
    ``SMARTBI_PG_PASSWORD`` (or ``--dsn`` for overrides).
    """
    if override is not None:
        return override

    if env not in {"prod", "test", "local"}:
        raise ValueError(f"--env must be one of prod/test/local (got {env!r})")

    host = os.environ.get("SMARTBI_PG_HOST", "localhost")
    port = os.environ.get("SMARTBI_PG_PORT", "5432")
    user = os.environ.get("SMARTBI_PG_USER", "smartbi_user")
    password = os.environ.get("SMARTBI_PG_PASSWORD", "")

    if env == "prod":
        db = os.environ.get("SMARTBI_PG_DB", "smartbi_prod_db")
    elif env == "test":
        db = os.environ.get("SMARTBI_PG_DB", "smartbi_db")
    else:  # local
        db = os.environ.get("SMARTBI_PG_DB", "smartbi_db")

    return f"postgres://{user}:{password}@{host}:{port}/{db}"


# ============================================================
# Schema-presence helpers (used to differentiate EMPTY vs MISSING_TABLE)
# ============================================================


async def _table_exists(conn, table_name: str) -> bool:
    """Return True iff ``public.<table_name>`` exists in the connected DB."""
    row = await conn.fetchrow(
        """
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = $1
         LIMIT 1
        """,
        table_name,
    )
    return row is not None


async def _column_exists(conn, table_name: str, column_name: str) -> bool:
    """Return True iff ``public.<table_name>.<column_name>`` exists."""
    row = await conn.fetchrow(
        """
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
         LIMIT 1
        """,
        table_name,
        column_name,
    )
    return row is not None


# ============================================================
# Per-metric audit queries (one factory at a time, RLS-scoped)
# ============================================================


async def _set_factory_context(conn, factory_id: str) -> None:
    """Set ``app.factory_id`` so RLS policies admit rows for this tenant.

    Uses plain ``SET`` (session-scoped) rather than ``SET LOCAL`` because
    asyncpg connections from a non-pool ``connect()`` don't run inside a
    transaction by default. ``set_config('app.factory_id', $1, false)``
    is the parameterized form — quoting the value defensively against
    SQL injection (factory_id originates from the V20260511_02 seed but
    treat all DB-bound strings as untrusted by default).
    """
    if factory_id is None:
        raise ValueError("_set_factory_context: factory_id required")
    await conn.execute("SELECT set_config('app.factory_id', $1, false)", factory_id)


async def audit_n2_complaint_data(conn, factory_id: str) -> dict:
    """N2 readiness — rating rows in ``restaurant_reviews``.

    Returns ``{"status": ..., "row_count": int, "avg_rating": float|None,
    "complaint_count": int}``. ``complaint_count`` counts rows with
    ``rating < 3.0`` (the analysis_quality.py threshold).
    """
    if not await _table_exists(conn, "restaurant_reviews"):
        return {"status": STATUS_MISSING_TABLE}

    await _set_factory_context(conn, factory_id)
    row = await conn.fetchrow(
        """
        SELECT
            COUNT(*)                                           AS row_count,
            AVG(rating)::numeric(10,4)                         AS avg_rating,
            SUM(CASE WHEN rating < 3.0 THEN 1 ELSE 0 END)::int AS complaint_count
          FROM restaurant_reviews
         WHERE factory_id = $1
        """,
        factory_id,
    )

    row_count = int(row["row_count"]) if row["row_count"] is not None else 0
    avg_rating = float(row["avg_rating"]) if row["avg_rating"] is not None else None
    complaint_count = (
        int(row["complaint_count"]) if row["complaint_count"] is not None else 0
    )

    status = STATUS_READY if row_count > 0 else STATUS_EMPTY
    return {
        "status": status,
        "row_count": row_count,
        "avg_rating": avg_rating,
        "complaint_count": complaint_count,
    }


async def audit_n3_return_data(conn, factory_id: str) -> dict:
    """N3 readiness — ``fact_pos_item.return_qty`` rows.

    ``return_qty`` was added by V20260511_03 (LIVE prod per PR #331). A
    missing column indicates migration drift. Returns the count of
    fact_pos_item rows for this factory AND the count with ``return_qty
    IS NOT NULL AND return_qty > 0`` (true return events).
    """
    if not await _table_exists(conn, "fact_pos_item"):
        return {"status": STATUS_MISSING_TABLE, "missing": "fact_pos_item"}

    if not await _column_exists(conn, "fact_pos_item", "return_qty"):
        return {
            "status": STATUS_MISSING_TABLE,
            "missing": "fact_pos_item.return_qty",
            "remedy": "Apply V20260511_03__fact_pos_item_add_return_qty.sql",
        }

    await _set_factory_context(conn, factory_id)
    row = await conn.fetchrow(
        """
        SELECT
            COUNT(*)                                                      AS fact_pos_item_count,
            COUNT(*) FILTER (
                WHERE return_qty IS NOT NULL AND return_qty > 0
            )                                                             AS return_qty_nonzero_rows,
            COALESCE(SUM(qty), 0)::numeric                                AS total_sales_qty,
            COALESCE(SUM(return_qty), 0)::numeric                         AS total_return_qty
          FROM fact_pos_item
         WHERE factory_id = $1
        """,
        factory_id,
    )

    fact_count = int(row["fact_pos_item_count"]) if row["fact_pos_item_count"] is not None else 0
    nonzero = (
        int(row["return_qty_nonzero_rows"])
        if row["return_qty_nonzero_rows"] is not None
        else 0
    )
    total_sales = (
        float(row["total_sales_qty"]) if row["total_sales_qty"] is not None else 0.0
    )
    total_returns = (
        float(row["total_return_qty"]) if row["total_return_qty"] is not None else 0.0
    )

    # READY = at least some POS data exists AND there is at least one return event.
    # EMPTY = no POS rows OR returns column populated but zero events.
    if fact_count > 0 and nonzero > 0:
        status = STATUS_READY
    else:
        status = STATUS_EMPTY

    return {
        "status": status,
        "fact_pos_item_count": fact_count,
        "return_qty_nonzero_rows": nonzero,
        "total_sales_qty": total_sales,
        "total_return_qty": total_returns,
    }


async def audit_n4_wastage_data(conn, factory_id: str) -> dict:
    """N4 readiness — wastage + requisition rows.

    Both tables must exist AND have at least one row for the factory.
    READY requires BOTH (denominator + numerator). EMPTY when either is zero.
    """
    if not await _table_exists(conn, "fact_restaurant_wastage"):
        return {"status": STATUS_MISSING_TABLE, "missing": "fact_restaurant_wastage"}
    if not await _table_exists(conn, "fact_restaurant_requisition"):
        return {
            "status": STATUS_MISSING_TABLE,
            "missing": "fact_restaurant_requisition",
        }

    await _set_factory_context(conn, factory_id)
    row = await conn.fetchrow(
        """
        SELECT
            (SELECT COUNT(*) FROM fact_restaurant_wastage
              WHERE factory_id = $1)                       AS wastage_rows,
            (SELECT COUNT(*) FROM fact_restaurant_requisition
              WHERE factory_id = $1)                       AS requisition_rows,
            (SELECT COALESCE(SUM(estimated_cost), 0)::numeric
               FROM fact_restaurant_wastage
              WHERE factory_id = $1)                       AS total_wastage_cost,
            (SELECT COALESCE(SUM(est_cost), 0)::numeric
               FROM fact_restaurant_requisition
              WHERE factory_id = $1)                       AS total_requisition_cost
        """,
        factory_id,
    )

    wastage_rows = int(row["wastage_rows"]) if row["wastage_rows"] is not None else 0
    requisition_rows = (
        int(row["requisition_rows"]) if row["requisition_rows"] is not None else 0
    )

    # READY needs both tables populated. Wastage rows ≥1 + requisition rows ≥1
    # — the analysis_quality.py path emits null+WASTAGE_NOT_TRACKED unless
    # wastage_row_count > 0 AND total_requisition_cost > 0.
    if wastage_rows > 0 and requisition_rows > 0:
        status = STATUS_READY
    else:
        status = STATUS_EMPTY

    return {
        "status": status,
        "wastage_rows": wastage_rows,
        "requisition_rows": requisition_rows,
        "total_wastage_cost": float(row["total_wastage_cost"])
        if row["total_wastage_cost"] is not None
        else 0.0,
        "total_requisition_cost": float(row["total_requisition_cost"])
        if row["total_requisition_cost"] is not None
        else 0.0,
    }


# ============================================================
# Overall aggregation
# ============================================================


def derive_overall_status(result: FactoryResult) -> str:
    """Aggregate per-metric statuses into one of READY/PARTIAL/EMPTY/SCHEMA_GAP.

    * SCHEMA_GAP — at least one MISSING_TABLE (most severe; blocks the endpoint
      from emitting expected envelope shape)
    * READY     — all rate-bearing metrics (N2, N3, N4) are READY
    * PARTIAL   — at least one rate-bearing metric READY but not all
    * EMPTY     — no rate-bearing metric READY (all EMPTY or all null markers)

    N1 is always null per Q-DEC-4 D1, so it doesn't participate in the
    overall verdict.
    """
    statuses = [
        result.n2_complaints.get("status"),
        result.n3_returns.get("status"),
        result.n4_wastage.get("status"),
    ]
    if STATUS_MISSING_TABLE in statuses:
        return "SCHEMA_GAP"
    ready_count = sum(1 for s in statuses if s == STATUS_READY)
    if ready_count == len(statuses):
        return "READY"
    if ready_count > 0:
        return "PARTIAL"
    return "EMPTY"


# ============================================================
# Top-level orchestrator
# ============================================================


async def audit_one_factory(conn, factory_id: str) -> FactoryResult:
    """Run N2/N3/N4 audits for one factory; N1 is static."""
    result = FactoryResult(factory_id=factory_id)
    try:
        result.n2_complaints = await audit_n2_complaint_data(conn, factory_id)
        result.n3_returns = await audit_n3_return_data(conn, factory_id)
        result.n4_wastage = await audit_n4_wastage_data(conn, factory_id)
        result.overall = derive_overall_status(result)
    except Exception as e:
        logger.warning("audit failed factory=%s: %s", factory_id, e)
        result.error = str(e)
        result.overall = "ERROR"
    return result


async def audit_all_factories(conn, factory_ids: list[str]) -> list[FactoryResult]:
    """Sequentially audit every factory (no concurrent connections needed)."""
    results = []
    for fid in factory_ids:
        results.append(await audit_one_factory(conn, fid))
    return results


# ============================================================
# Output formatters
# ============================================================


def summarize(results: list[FactoryResult]) -> dict:
    """Aggregate counts for the summary section of the JSON output."""
    by_overall: dict[str, int] = {}
    for r in results:
        by_overall[r.overall] = by_overall.get(r.overall, 0) + 1
    return {
        "total_factories": len(results),
        "by_overall_status": by_overall,
        "n3_ready_count": sum(
            1 for r in results if r.n3_returns.get("status") == STATUS_READY
        ),
        "n2_ready_count": sum(
            1 for r in results if r.n2_complaints.get("status") == STATUS_READY
        ),
        "n4_ready_count": sum(
            1 for r in results if r.n4_wastage.get("status") == STATUS_READY
        ),
    }


def render_json(
    results: list[FactoryResult], env: str, db: str
) -> dict:
    """Build the top-level JSON output (used by both --output and stdout)."""
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "env": env,
        "database": db,
        "factory_count": len(results),
        "factories": [
            {
                "factory_id": r.factory_id,
                "n1_food_safety": r.n1_food_safety,
                "n2_complaints": r.n2_complaints,
                "n3_returns": r.n3_returns,
                "n4_wastage": r.n4_wastage,
                "overall": r.overall,
                **({"error": r.error} if r.error else {}),
            }
            for r in results
        ],
        "summary": summarize(results),
    }


def render_markdown(payload: dict) -> str:
    """Render a human-readable Markdown report from the JSON payload.

    Sections:
    1. Header (run metadata)
    2. Per-factory readiness matrix
    3. Detail breakdown per metric
    4. Summary counts
    """
    lines: list[str] = []
    lines.append("# Restaurant N1-N4 Data Readiness Audit")
    lines.append("")
    lines.append(f"- **Generated**: {payload['generated_at']}")
    lines.append(f"- **Environment**: {payload['env']}")
    lines.append(f"- **Database**: {payload['database']}")
    lines.append(f"- **Factories audited**: {payload['factory_count']}")
    lines.append("")
    lines.append("## Per-factory readiness matrix")
    lines.append("")
    lines.append("| factory_id | N1 | N2 | N3 | N4 | Overall |")
    lines.append("|---|---|---|---|---|---|")
    for f in payload["factories"]:
        n2 = f["n2_complaints"].get("status", "?")
        n3 = f["n3_returns"].get("status", "?")
        n4 = f["n4_wastage"].get("status", "?")
        lines.append(
            f"| `{f['factory_id']}` | {f['n1_food_safety']} | {n2} | {n3} | {n4} | "
            f"**{f['overall']}** |"
        )
    lines.append("")
    lines.append("## Detail per metric")
    lines.append("")
    for f in payload["factories"]:
        lines.append(f"### `{f['factory_id']}`")
        lines.append("")
        lines.append(f"- N2 complaints: `{json.dumps(f['n2_complaints'], ensure_ascii=False)}`")
        lines.append(f"- N3 returns: `{json.dumps(f['n3_returns'], ensure_ascii=False)}`")
        lines.append(f"- N4 wastage: `{json.dumps(f['n4_wastage'], ensure_ascii=False)}`")
        lines.append("")
    lines.append("## Summary")
    lines.append("")
    summary = payload["summary"]
    lines.append(f"- Total: **{summary['total_factories']}**")
    lines.append(f"- N2 READY: {summary['n2_ready_count']}")
    lines.append(f"- N3 READY: {summary['n3_ready_count']}")
    lines.append(f"- N4 READY: {summary['n4_ready_count']}")
    lines.append("- By overall status:")
    for status, count in sorted(summary["by_overall_status"].items()):
        lines.append(f"  - `{status}`: {count}")
    lines.append("")
    return "\n".join(lines)


# ============================================================
# CLI entry
# ============================================================


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Audit smartbi DB for restaurant N1-N4 endpoint readiness."
    )
    parser.add_argument(
        "--env",
        choices=["prod", "test", "local"],
        default="local",
        help="Target environment (drives DSN defaults). Override with --dsn.",
    )
    parser.add_argument(
        "--dsn",
        default=None,
        help="Full postgres DSN (overrides --env). Useful for one-off queries.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Write JSON report to this path (otherwise stdout).",
    )
    parser.add_argument(
        "--markdown",
        default=None,
        help="Also write a Markdown report to this path (optional).",
    )
    parser.add_argument(
        "--factories",
        default=None,
        help="Comma-separated factory_ids to override the 14-chain default list.",
    )
    return parser


async def main_async(args) -> int:
    """Acquire a single asyncpg connection and run all audits."""
    try:
        import asyncpg
    except ImportError:
        logger.error(
            "asyncpg not installed. Activate the backend/python venv or "
            "install via `pip install asyncpg`."
        )
        return 2

    dsn = resolve_dsn(args.env, args.dsn)
    db_for_report = dsn.rsplit("/", 1)[-1]
    factory_list = (
        [s.strip() for s in args.factories.split(",") if s.strip()]
        if args.factories
        else list(REAL_RESTAURANT_FACTORIES)
    )

    logger.info(
        "Connecting (env=%s db=%s factories=%d)",
        args.env,
        db_for_report,
        len(factory_list),
    )
    try:
        conn = await asyncpg.connect(dsn=dsn)
    except Exception as e:
        logger.error("connect failed: %s", e)
        return 3

    try:
        results = await audit_all_factories(conn, factory_list)
    finally:
        await conn.close()

    payload = render_json(results, env=args.env, db=db_for_report)
    rendered_json = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(rendered_json + "\n")
        logger.info("Wrote JSON: %s", args.output)
    else:
        print(rendered_json)

    if args.markdown:
        with open(args.markdown, "w", encoding="utf-8") as f:
            f.write(render_markdown(payload))
        logger.info("Wrote Markdown: %s", args.markdown)

    summary = payload["summary"]
    logger.info(
        "Done. READY/PARTIAL/EMPTY/SCHEMA_GAP/ERROR=%s",
        summary["by_overall_status"],
    )
    return 0


def main() -> int:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    args = build_arg_parser().parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
