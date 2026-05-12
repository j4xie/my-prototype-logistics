"""Integration test for ``smart_bi_alert_thresholds`` against a real Postgres.

Closes the schema gap that PR #425's mock-pool unit tests missed: the
``config_thresholds.py`` endpoints SELECT/INSERT/UPDATE/DELETE against
columns that must actually exist in ``smartbi_db``. Mocks won't catch
missing tables or column drift — this file does.

Skip behavior (mirrors ``tests/golden/f001_qhj/test_regression.py``):

* No ``POSTGRES_URL`` env / settings → fixture skips → CI passes cleanly.
* Postgres reachable but table missing → first assertion fails loudly
  with the canonical ``UndefinedTableError`` message — exactly the bug
  this migration fixes.
* Postgres reachable + table present → full schema audit + the verbatim
  SELECT statement from ``config_thresholds.py:266-276`` is exercised.

Source-of-truth schema: ``SmartBiAlertThreshold.java`` (line 34-114).
Migration: ``backend/python/smartbi/database/migrations/V20260513_02__create_smart_bi_alert_thresholds.sql``.
"""
from __future__ import annotations

import pytest
import pytest_asyncio


# The columns SELECTed by ``config_thresholds._SELECT_COLUMNS`` (line 229-233)
# — must exist in the live smartbi_db schema for the endpoint to return 200.
_REQUIRED_COLUMNS: dict[str, str] = {
    "id": "character varying",
    "threshold_type": "character varying",
    "metric_code": "character varying",
    "warning_value": "numeric",
    "critical_value": "numeric",
    "comparison_operator": "character varying",
    "unit": "character varying",
    "description": "character varying",
    "factory_id": "character varying",
    "is_active": "boolean",
    "created_at": "timestamp without time zone",
    "updated_at": "timestamp without time zone",
    "deleted_at": "timestamp without time zone",
}


@pytest_asyncio.fixture
async def pool():
    """asyncpg pool to smartbi_db. Skip cleanly if no reachable Postgres.

    Covers three skip cases:
      * No URL configured at all (CI without DB env) — most common.
      * URL configured but unreachable (laptop without local PG, wrong host) —
        skip rather than ERROR so the suite stays green on dev machines.
      * URL reachable but DB user lacks rights — skip with a clear message
        so it's still distinguishable from a real schema-gap regression.
    """
    import asyncpg
    from smartbi.config import get_settings
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured (POSTGRES_URL env unset)")
    try:
        p = await asyncpg.create_pool(
            settings.postgres_url,
            min_size=1, max_size=2,
            timeout=5,
        )
    except (asyncpg.PostgresError, OSError, ConnectionError, TimeoutError) as e:
        pytest.skip(f"Postgres unreachable at configured URL ({type(e).__name__}): {e}")
    try:
        yield p
    finally:
        await p.close()


@pytest.mark.asyncio
async def test_smart_bi_alert_thresholds_table_exists(pool):
    """The fix: table must exist in smartbi_db (where ``get_pg_pool`` points).

    Before V20260513_02 this assertion failed with
    ``relation "smart_bi_alert_thresholds" does not exist`` — exactly the
    HTTP 500 root cause reproduced 2026-05-13 after the 三件套 re-deploy.
    """
    async with pool.acquire() as conn:
        oid = await conn.fetchval("SELECT to_regclass('smart_bi_alert_thresholds')")
    assert oid is not None, (
        "smart_bi_alert_thresholds missing in smartbi_db. "
        "Apply V20260513_02__create_smart_bi_alert_thresholds.sql via "
        "apply-smartbi-migrations.sh."
    )


@pytest.mark.asyncio
async def test_smart_bi_alert_thresholds_schema_matches_entity(pool):
    """Every column SELECTed by config_thresholds.py:266-276 must exist
    with the entity-declared type (SmartBiAlertThreshold.java line 54-114)."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'smart_bi_alert_thresholds'"
        )
    actual: dict[str, str] = {r["column_name"]: r["data_type"] for r in rows}

    missing = sorted(c for c in _REQUIRED_COLUMNS if c not in actual)
    assert not missing, (
        f"Migration V20260513_02 must declare these columns "
        f"(SELECTed by config_thresholds._SELECT_COLUMNS): {missing}"
    )

    type_mismatches = []
    for col, expected_type in _REQUIRED_COLUMNS.items():
        if actual.get(col) != expected_type:
            type_mismatches.append(
                f"{col}: expected {expected_type!r}, got {actual.get(col)!r}"
            )
    assert not type_mismatches, (
        "Column type drift vs SmartBiAlertThreshold.java entity:\n  "
        + "\n  ".join(type_mismatches)
    )


@pytest.mark.asyncio
async def test_list_thresholds_select_executes_against_real_schema(pool):
    """Exercise the *verbatim* SQL from config_thresholds.py:266-276 to
    catch any column drift that would surface as 500 in prod even when
    the unit-test mock pool returns clean fake rows.
    """
    # Reuse the constant so any future column add to _SELECT_COLUMNS is
    # automatically covered by this assertion.
    from smartbi_compat.api.config_thresholds import _SELECT_COLUMNS

    async with pool.acquire() as conn:
        # Both branches of the list endpoint — unfiltered + type-filtered.
        rows_all = await conn.fetch(
            f"SELECT {_SELECT_COLUMNS} FROM smart_bi_alert_thresholds "
            "WHERE deleted_at IS NULL AND is_active = true "
            "ORDER BY created_at DESC"
        )
        rows_filtered = await conn.fetch(
            f"SELECT {_SELECT_COLUMNS} FROM smart_bi_alert_thresholds "
            "WHERE deleted_at IS NULL AND threshold_type = $1 AND is_active = true "
            "ORDER BY created_at DESC",
            "SALES",
        )

    # Migration seeds 28 default global thresholds — 7 SALES + 6 FINANCE +
    # 4 DEPARTMENT + 6 PRODUCTION + 5 QUALITY. The SALES branch must return
    # exactly the SALES-typed rows.
    assert len(rows_all) >= 28, (
        f"Expected ≥28 active default thresholds from migration seed, "
        f"got {len(rows_all)}. Was the migration's INSERT block applied?"
    )
    assert len(rows_filtered) >= 7, (
        f"Expected ≥7 SALES thresholds (per migration seed), "
        f"got {len(rows_filtered)}."
    )
    for r in rows_filtered:
        assert r["threshold_type"] == "SALES"


@pytest.mark.asyncio
async def test_unique_constraint_dedupes_global_thresholds(pool):
    """The migration's partial unique index ``uk_global_type_metric``
    must reject duplicate ``(threshold_type, metric_code)`` pairs when
    ``factory_id IS NULL`` — without it, re-running the seed would create
    duplicate global default rows (PG ``UNIQUE`` ignores NULL columns).
    """
    import asyncpg
    async with pool.acquire() as conn:
        # The seed already covers SALES/SALES_AMOUNT_DAILY with factory_id=NULL.
        # Attempting a second INSERT with the same key must raise.
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute(
                "INSERT INTO smart_bi_alert_thresholds "
                "(id, threshold_type, metric_code, comparison_operator, is_active) "
                "VALUES ($1, 'SALES', 'SALES_AMOUNT_DAILY', 'LT', true)",
                "test-dup-rejection-fixture",
            )
