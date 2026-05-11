"""Focused regression-guard tests for ``smartbi_compat.tenant``.

Created 2026-05-11 alongside the P0 column-name fix
(``factory_id`` → ``id`` in the SELECT statement). Lives in its own file
so the SQL contract is grep-able and reviewable in isolation; the broader
tenant behavior (enum semantics, async query happy paths, dispatcher
contracts) stays covered by ``test_analysis_production_skeleton.py``.

P0 root cause: ``cretas_prod_db.factories`` PK column is ``id`` (varchar
255), not ``factory_id``. The original PR #350 SQL used ``WHERE
factory_id = $1`` which raised ``column "factory_id" does not exist`` and
turned every restaurant-tenant ``/analysis/*`` request into a 500 in
prod. chat3 PR #365 audit caught it via direct psql reproduction; chat2
PR #365 verdict 复审 confirmed.
"""
from __future__ import annotations

import re

import pytest

from smartbi_compat.tenant import TenantType, get_tenant_type


class _FakeConn:
    """asyncpg.Connection stub that records SQL + args."""

    def __init__(self, row):
        self._row = row
        self.last_sql = None
        self.last_args = None

    async def fetchrow(self, sql, *args):
        self.last_sql = sql
        self.last_args = args
        return self._row


@pytest.mark.asyncio
async def test_get_tenant_type_sql_targets_id_column_not_factory_id():
    """Regression guard for the 2026-05-11 P0 fix.

    The ``factories`` table PK is ``id``. The original PR #350 used
    ``WHERE factory_id = $1`` which raised
    ``column "factory_id" does not exist`` in prod. This test locks the
    SQL to the correct column so any future "looks more readable as
    factory_id" refactor immediately fails CI.
    """
    conn = _FakeConn({"type": "RESTAURANT"})
    await get_tenant_type("R_ILTEATRO_REAL", conn)
    sql = conn.last_sql or ""
    # Normalize whitespace for assertion clarity.
    sql_normalized = re.sub(r"\s+", " ", sql).strip()
    assert "FROM factories WHERE id = $1" in sql_normalized, (
        f"Tenant SQL must filter on the `id` column (PK), not `factory_id`. "
        f"Observed: {sql_normalized!r}"
    )
    assert "factory_id" not in sql_normalized, (
        f"Tenant SQL must NOT reference `factory_id` (column does not exist in "
        f"cretas_prod_db.factories). Observed: {sql_normalized!r}"
    )
    assert conn.last_args == ("R_ILTEATRO_REAL",)


@pytest.mark.asyncio
async def test_get_tenant_type_passes_factory_id_through_as_first_param():
    """The Python parameter name `factory_id` stays a parameter name even
    though the DB column is `id` — caller API doesn't change."""
    conn = _FakeConn({"type": "FACTORY"})
    tenant = await get_tenant_type("F001", conn)
    assert tenant is TenantType.FACTORY
    assert conn.last_args == ("F001",)


@pytest.mark.asyncio
async def test_get_tenant_type_missing_row_defaults_to_factory():
    """Mirror Java SmartBIServiceImpl.isRestaurantTenant orElse(false) — a
    missing factories row collapses to FACTORY rather than raising."""
    conn = _FakeConn(None)
    tenant = await get_tenant_type("R_DOES_NOT_EXIST", conn)
    assert tenant is TenantType.FACTORY


@pytest.mark.asyncio
async def test_get_tenant_type_handles_null_type_column():
    """``factories.type`` IS NULL → FACTORY (defensive default)."""
    conn = _FakeConn({"type": None})
    tenant = await get_tenant_type("F_LEGACY_NO_TYPE", conn)
    assert tenant is TenantType.FACTORY
