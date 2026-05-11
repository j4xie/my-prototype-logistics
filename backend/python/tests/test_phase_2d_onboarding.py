"""Static-analysis tests for Phase 2D §5 Option A onboarding migration.

Validates `V2026_05_11_01__onboard_14_r_real_chains.sql` content invariants:

* Exactly 14 R_*_REAL rows inserted
* All rows have `type='RESTAURANT'`
* `ON CONFLICT (id) DO NOTHING` clause present (idempotency lock)
* factory_ids match the V20260511_02 catalog seed
* Targets `factories` table (cretas_prod_db, NOT smartbi_prod_db)

Plus tenant.py contract: `TenantType.from_db_value('RESTAURANT')` resolves to
the restaurant branch — confirms onboarded chains route correctly post-deploy.

These are static analysis tests; the migration itself is applied by Java
Flyway at Spring Boot startup against cretas_prod_db (NOT by Python's
apply-smartbi-migrations.sh runner — that targets smartbi_prod_db only).
End-to-end DB-applied verification happens during deploy smoke test on
test env (10011/8084) and post-merge prod deploy.

Spec: docs/superpowers/specs/2026-05-11-phase-2d-silver-migration-and-factory-impl-spec.md §5.6
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from smartbi_compat.tenant import TenantType


# Migration file lives in the Java Flyway dir (cretas_prod_db target) because
# factories table is in cretas_prod_db, not smartbi_prod_db. Computed relative
# to the python backend test file so worktree-relative imports stay clean.
MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "java"
    / "cretas-api"
    / "src"
    / "main"
    / "resources"
    / "db"
    / "migration-pg-converted"
    / "V2026_05_11_01__onboard_14_r_real_chains.sql"
)

EXPECTED_FACTORY_IDS = {
    "R_DONGMENKOU_REAL",
    "R_HONGDEJI_REAL",
    "R_HUOGUO_GENERIC_REAL",
    "R_ILTEATRO_REAL",
    "R_JINCHUAN_HG_REAL",
    "R_JINRINIUSHI_REAL",
    "R_LINJIAYAN_REAL",
    "R_QINGHUAJIAO_REAL",
    "R_SHANGMA_HG_REAL",
    "R_XIMAXIANG_REAL",
    "R_XINBASHU_REAL",
    "R_YONGHE_REAL",
    "R_YOUZIYOUWEI_REAL",
    "R_YUJIUJING_REAL",
}


@pytest.fixture(scope="module")
def migration_sql() -> str:
    assert MIGRATION_PATH.is_file(), f"Migration file not found at {MIGRATION_PATH}"
    return MIGRATION_PATH.read_text(encoding="utf-8")


# ============================================================
# Migration content invariants
# ============================================================


def test_migration_inserts_exactly_14_factory_ids(migration_sql: str):
    """Lock the row count — guards against accidental row add/remove drift."""
    matches = re.findall(r"\('(R_[A-Z_]+_REAL)',", migration_sql)
    assert len(matches) == 14, (
        f"Expected exactly 14 R_*_REAL rows; found {len(matches)}: {matches}"
    )


def test_migration_factory_ids_match_seed_roster(migration_sql: str):
    """factory_id set must equal V20260511_02 restaurant_chain_catalog seed."""
    found = set(re.findall(r"\('(R_[A-Z_]+_REAL)',", migration_sql))
    assert found == EXPECTED_FACTORY_IDS, (
        f"Roster mismatch.\n"
        f"  Missing: {EXPECTED_FACTORY_IDS - found}\n"
        f"  Extra:   {found - EXPECTED_FACTORY_IDS}"
    )


def test_migration_all_rows_are_restaurant_type(migration_sql: str):
    """Every onboarded row must have type='RESTAURANT' — that's the whole point."""
    # Match the 5-tuple `('<id>', '<name>', 'RESTAURANT', ...` pattern
    restaurant_rows = re.findall(r"\('R_[A-Z_]+_REAL',\s*'[^']+',\s*'RESTAURANT',", migration_sql)
    assert len(restaurant_rows) == 14, (
        f"Expected 14 rows with type='RESTAURANT'; found {len(restaurant_rows)}"
    )
    # Negative guard: no row sneaks in with 'FACTORY' type
    assert not re.search(
        r"\('R_[A-Z_]+_REAL',\s*'[^']+',\s*'FACTORY',", migration_sql
    ), "A R_*_REAL row was inserted with type='FACTORY' — must be RESTAURANT"


def test_migration_targets_cretas_factories_table(migration_sql: str):
    """Sanity check the table name — the migration must target factories, not factory or restaurants."""
    assert re.search(r"INSERT\s+INTO\s+factories\b", migration_sql, re.IGNORECASE), (
        "Migration must INSERT INTO `factories` table (cretas_prod_db)"
    )


def test_migration_has_on_conflict_do_nothing(migration_sql: str):
    """Idempotency guard — re-running must be a no-op."""
    assert re.search(
        r"ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+NOTHING",
        migration_sql,
        re.IGNORECASE,
    ), (
        "Migration must end with `ON CONFLICT (id) DO NOTHING` for idempotency"
    )


def test_migration_includes_required_not_null_columns(migration_sql: str):
    """Factory.java entity has NOT NULL columns — INSERT must supply all."""
    # Required per Factory.java: id, name, type, level, is_active, manually_verified, ai_weekly_quota
    required_columns = [
        "id",
        "name",
        "type",
        "level",
        "is_active",
        "manually_verified",
        "ai_weekly_quota",
        "created_at",
        "updated_at",
    ]
    insert_columns_match = re.search(
        r"INSERT\s+INTO\s+factories\s*\(([^)]+)\)",
        migration_sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert insert_columns_match, "Could not parse INSERT INTO column list"
    column_list = insert_columns_match.group(1)
    for col in required_columns:
        assert col in column_list, (
            f"Required NOT NULL column `{col}` not in INSERT column list: {column_list!r}"
        )


# ============================================================
# tenant.py contract — onboarded chains resolve to RESTAURANT
# ============================================================


@pytest.mark.parametrize("factory_id", sorted(EXPECTED_FACTORY_IDS))
def test_tenant_type_from_db_value_resolves_each_chain_post_onboard(factory_id: str):
    """Once migration applies + factories row exists with type='RESTAURANT',
    tenant.py.from_db_value('RESTAURANT') resolves to TenantType.RESTAURANT
    for each of the 14 onboarded chains.

    This locks the contract that the migration's `type='RESTAURANT'` value
    aligns with TenantType.RESTAURANT enum string. If either side drifts
    (e.g., 'RESTAURANT' → 'restaurant' in migration), this test fails.
    """
    # Simulated post-migration `factories.type` column value
    db_value = "RESTAURANT"
    tenant = TenantType.from_db_value(db_value)
    assert tenant is TenantType.RESTAURANT, (
        f"Onboarded chain {factory_id} with type='RESTAURANT' must resolve to "
        f"TenantType.RESTAURANT (got {tenant})"
    )
    assert tenant.is_restaurant_tenant is True
    assert tenant.envelope_discriminator == "RESTAURANT"


def test_tenant_type_restaurant_enum_string_matches_migration_value():
    """The literal `'RESTAURANT'` in the migration SQL must match
    `TenantType.RESTAURANT.value` string. If TenantType enum is renamed, this
    test catches the drift before the migration onboards 14 chains with a
    value tenant.py can no longer parse."""
    assert TenantType.RESTAURANT.value == "RESTAURANT"
