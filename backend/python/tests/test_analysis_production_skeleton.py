"""chat-A1 Wave 1 skeleton tests for ``/analysis/production`` port.

Per chat-A1 dispatch 2026-05-12 Option B, both factory and restaurant
branches are deferred. These tests lock down the contracts that chat-A2
(restaurant) and Phase 2D (factory) must preserve:

* ``TenantType`` enum mirrors Java ``FactoryType`` exactly (5 values).
* ``is_restaurant_tenant`` matches Java
  ``SmartBIServiceImpl.isRestaurantTenant`` predicate (RESTAURANT,
  BRANCH only).
* ``envelope_discriminator`` collapses to the binary ``"FACTORY"`` /
  ``"RESTAURANT"`` per Q-DEC-8 Option A envelope discriminator.
* ``get_tenant_type`` defaults to FACTORY on missing rows (preserves
  Java repository-failure fallback).
* Dispatcher shells raise ``NotImplementedError`` with the canonical
  messages so chat-A2 / Phase 2D can grep for them.
* Router declares the polymorphic endpoint path.

Spec: docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md
"""
from __future__ import annotations

import pytest

from smartbi_compat.tenant import TenantType, get_tenant_type
from smartbi_compat.api import analysis_production
from smartbi_compat.api.analysis_production import (
    _factory_production_dispatch,
    _restaurant_production_dispatch,
    _FACTORY_BRANCH_DEFERRED_MSG,
    _RESTAURANT_BRANCH_DEFERRED_MSG,
    router,
)


# ============================================================
# Enum + predicate parity with Java FactoryType
# ============================================================


def test_tenant_type_has_five_java_enum_values():
    """Mirror Java ``FactoryType`` exactly: 5 members, names match."""
    assert {t.name for t in TenantType} == {
        "FACTORY",
        "RESTAURANT",
        "HEADQUARTERS",
        "BRANCH",
        "CENTRAL_KITCHEN",
    }
    # String values match Java enum identifiers for direct
    # cretas_db.factories.type parse.
    for t in TenantType:
        assert t.value == t.name


@pytest.mark.parametrize("tenant", [TenantType.RESTAURANT, TenantType.BRANCH])
def test_is_restaurant_tenant_true_for_restaurant_and_branch(tenant):
    """Java SmartBIServiceImpl.isRestaurantTenant lines 432-435 predicate."""
    assert tenant.is_restaurant_tenant is True
    assert tenant.is_factory_tenant is False
    assert tenant.envelope_discriminator == "RESTAURANT"


@pytest.mark.parametrize(
    "tenant",
    [TenantType.FACTORY, TenantType.HEADQUARTERS, TenantType.CENTRAL_KITCHEN],
)
def test_is_restaurant_tenant_false_for_factory_family(tenant):
    """HEADQUARTERS + CENTRAL_KITCHEN collapse to factory per Java precedent."""
    assert tenant.is_restaurant_tenant is False
    assert tenant.is_factory_tenant is True
    assert tenant.envelope_discriminator == "FACTORY"


# ============================================================
# from_db_value defensive parsing
# ============================================================


@pytest.mark.parametrize(
    "value,expected",
    [
        ("FACTORY", TenantType.FACTORY),
        ("factory", TenantType.FACTORY),  # case-insensitive
        ("RESTAURANT", TenantType.RESTAURANT),
        ("BRANCH", TenantType.BRANCH),
        ("HEADQUARTERS", TenantType.HEADQUARTERS),
        ("CENTRAL_KITCHEN", TenantType.CENTRAL_KITCHEN),
    ],
)
def test_from_db_value_parses_canonical_strings(value, expected):
    assert TenantType.from_db_value(value) is expected


@pytest.mark.parametrize("value", [None, "", "UNKNOWN", "garbage"])
def test_from_db_value_defaults_to_factory_on_missing_or_unknown(value):
    """Defensive: missing/unknown → FACTORY (mirrors Java repo-failure path)."""
    assert TenantType.from_db_value(value) is TenantType.FACTORY


# ============================================================
# get_tenant_type — async query against fake asyncpg connection
# ============================================================


class _FakeConn:
    """Minimal asyncpg.Connection stub for tenant query test."""

    def __init__(self, row):
        self._row = row
        self.last_sql = None
        self.last_args = None

    async def fetchrow(self, sql, *args):
        self.last_sql = sql
        self.last_args = args
        return self._row


@pytest.mark.asyncio
async def test_get_tenant_type_happy_path_restaurant():
    conn = _FakeConn({"type": "RESTAURANT"})
    tenant = await get_tenant_type("R_ILTEATRO_REAL", conn)
    assert tenant is TenantType.RESTAURANT
    assert tenant.is_restaurant_tenant
    assert conn.last_args == ("R_ILTEATRO_REAL",)


@pytest.mark.asyncio
async def test_get_tenant_type_happy_path_branch():
    conn = _FakeConn({"type": "BRANCH"})
    tenant = await get_tenant_type("R_ILTEATRO_001", conn)
    assert tenant is TenantType.BRANCH
    assert tenant.is_restaurant_tenant


@pytest.mark.asyncio
async def test_get_tenant_type_happy_path_factory():
    conn = _FakeConn({"type": "FACTORY"})
    tenant = await get_tenant_type("F001", conn)
    assert tenant is TenantType.FACTORY
    assert tenant.is_factory_tenant


@pytest.mark.asyncio
async def test_get_tenant_type_missing_row_defaults_to_factory():
    """Missing factory_id row → FACTORY (preserves legacy manufacturing path)."""
    conn = _FakeConn(None)
    tenant = await get_tenant_type("F_DOES_NOT_EXIST", conn)
    assert tenant is TenantType.FACTORY


@pytest.mark.asyncio
async def test_get_tenant_type_null_type_column_defaults_to_factory():
    """``factories.type`` IS NULL → FACTORY (Java Factory.java default behavior)."""
    conn = _FakeConn({"type": None})
    tenant = await get_tenant_type("F_LEGACY", conn)
    assert tenant is TenantType.FACTORY


# ============================================================
# Dispatcher NotImplementedError contracts (chat-A2 + Phase 2D handoff)
# ============================================================


@pytest.mark.asyncio
async def test_factory_dispatch_raises_with_phase_2d_message():
    """Phase 2D blocker is grep-able for follow-up dispatch."""
    from datetime import date

    with pytest.raises(NotImplementedError) as exc_info:
        await _factory_production_dispatch("F001", date(2026, 5, 1), date(2026, 5, 31), "oee")
    msg = str(exc_info.value)
    assert "Phase 2D" in msg
    assert "fact_production_batch" in msg
    assert msg == _FACTORY_BRANCH_DEFERRED_MSG


@pytest.mark.asyncio
async def test_restaurant_dispatch_raises_with_chat_a2_message():
    """chat-A2 Wave 2 handoff is grep-able for follow-up dispatch."""
    from datetime import date

    with pytest.raises(NotImplementedError) as exc_info:
        await _restaurant_production_dispatch(
            "R_ILTEATRO_REAL", date(2026, 5, 1), date(2026, 5, 31), None
        )
    msg = str(exc_info.value)
    assert "chat-A2" in msg
    assert msg == _RESTAURANT_BRANCH_DEFERRED_MSG


# ============================================================
# Router contract — endpoint path is registered for chat-A3 wiring
# ============================================================


def test_router_declares_production_analysis_endpoint():
    """Path must match Q4 spec §1.1 verbatim — single URL serves both tenants."""
    paths = [route.path for route in router.routes]
    assert "/api/mobile/{factory_id}/smart-bi/analysis/production" in paths


def test_router_endpoint_methods_are_get_only():
    target = "/api/mobile/{factory_id}/smart-bi/analysis/production"
    matching = [r for r in router.routes if r.path == target]
    assert len(matching) == 1
    assert set(matching[0].methods) == {"GET"}


def test_module_advertises_dispatch_helpers():
    """Stable function names for chat-A2 (restaurant) + Phase 2D (factory)."""
    assert hasattr(analysis_production, "_factory_production_dispatch")
    assert hasattr(analysis_production, "_restaurant_production_dispatch")
    assert hasattr(analysis_production, "get_production_analysis")
