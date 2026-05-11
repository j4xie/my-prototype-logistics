"""Skeleton tests for ``/analysis/production`` shared contracts.

chat-A1 Wave 1 (PR #350) shipped this set. chat-A2 Wave 2 ships the
restaurant branch impl (see ``test_analysis_production_restaurant.py``).
Phase 2D Subagent B rewires the factory branch from a raising stub into
an empty-envelope placeholder marked ``FACTORY_SILVER_PHASE_2D_PENDING``;
the assertion below now locks the new envelope contract instead of a
``NotImplementedError`` raise.

Surviving contracts (chat-A2 + Phase 2D must preserve):

* ``TenantType`` enum mirrors Java ``FactoryType`` exactly (5 values).
* ``is_restaurant_tenant`` matches Java
  ``SmartBIServiceImpl.isRestaurantTenant`` predicate (RESTAURANT,
  BRANCH only).
* ``envelope_discriminator`` collapses to the binary ``"FACTORY"`` /
  ``"RESTAURANT"`` per Q-DEC-8 Option A envelope discriminator.
* ``get_tenant_type`` defaults to FACTORY on missing rows (preserves
  Java repository-failure fallback).
* Factory dispatcher returns the Phase 2D empty envelope tagged with the
  canonical ``FACTORY_SILVER_PHASE_2D_PENDING`` marker — future Silver-
  layer impl (PR-A/B/C/D) must keep the same marker so frontend chip
  rendering doesn't churn.
* ``_FACTORY_BRANCH_DEFERRED_MSG`` documentation constant still contains
  the ``"Phase 2D"`` + Silver-table substrings for grep-readiness.
* Router declares the polymorphic endpoint path.

Spec: docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md
"""
from __future__ import annotations

import pytest

from smartbi_compat.tenant import TenantType, get_tenant_type
from smartbi_compat.api import analysis_production
from smartbi_compat.api.analysis_production import (
    FACTORY_PHASE_2D_PENDING_MARKER,
    _factory_production_dispatch,
    _FACTORY_BRANCH_DEFERRED_MSG,
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
# Dispatcher Phase 2D empty-envelope contracts (chat-A2 + Phase 2D handoff)
# ============================================================


@pytest.mark.asyncio
async def test_factory_dispatch_returns_phase_2d_envelope():
    """Phase 2D placeholder: factory dispatch returns empty envelope marker.

    Subagent B rewired the factory branch from a raising stub into an
    empty-envelope response carrying the top-level marker
    ``FACTORY_SILVER_PHASE_2D_PENDING``. Future Silver-layer impl
    (PR-A/B/C/D) must keep the same marker key so frontend chip rendering
    doesn't churn.
    """
    from datetime import date

    result = await _factory_production_dispatch(
        "F001", date(2026, 5, 1), date(2026, 5, 31), "oee"
    )
    assert isinstance(result, dict)
    assert result["dataAvailability"] == FACTORY_PHASE_2D_PENDING_MARKER
    assert result["dataAvailability"] == "FACTORY_SILVER_PHASE_2D_PENDING"


def test_factory_deferred_msg_keeps_phase_2d_grep_substrings():
    """``_FACTORY_BRANCH_DEFERRED_MSG`` still grep-able for Phase 2D dispatch.

    Body was rewritten ("raises" → "empty envelope marked …") but every
    grep target documented in the chat-A1 PR #350 contract is preserved
    so log searches + grep audits keep working. The Phase-2D reference
    is carried by the canonical marker token ``PHASE_2D`` (within
    ``FACTORY_SILVER_PHASE_2D_PENDING``); the Silver-table grep targets
    (e.g. ``fact_production_batch``) remain individually listed.
    """
    assert "PHASE_2D" in _FACTORY_BRANCH_DEFERRED_MSG
    assert "FACTORY_SILVER_PHASE_2D_PENDING" in _FACTORY_BRANCH_DEFERRED_MSG
    assert "fact_production_batch" in _FACTORY_BRANCH_DEFERRED_MSG
    assert "fact_equipment_event" in _FACTORY_BRANCH_DEFERRED_MSG
    assert "fact_quality_inspection" in _FACTORY_BRANCH_DEFERRED_MSG


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
