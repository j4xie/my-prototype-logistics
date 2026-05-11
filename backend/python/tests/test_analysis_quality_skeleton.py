"""Skeleton tests for ``/analysis/quality`` shared contracts.

chat-B1 Wave 1 (PR #354) shipped this set. chat-B2 Wave 2 ships the
restaurant branch impl (see ``test_analysis_quality_restaurant.py``).
Phase 2D Subagent B rewires the factory branch from a raising stub into
an empty-envelope placeholder marked ``FACTORY_SILVER_PHASE_2D_PENDING``;
the assertions below now lock the new envelope contract instead of a
``NotImplementedError`` raise.

Surviving contracts (chat-B2 + Phase 2D must preserve):

* Factory dispatcher returns the Phase 2D empty envelope tagged with
  the canonical ``FACTORY_SILVER_PHASE_2D_PENDING`` marker on every
  analysisType branch (future Silver-layer impl must keep the marker).
* ``_FACTORY_BRANCH_DEFERRED_MSG`` documentation constant still keeps
  every Silver-table name + ``"Phase 2D"`` substring for grep-readiness.
* Dispatcher signatures ``(factory_id, start_date, end_date,
  analysis_type)`` stable for chat-B2 + Phase 2D follow-ups.
* Router declares the polymorphic endpoint path
  ``/api/mobile/{factory_id}/smart-bi/analysis/quality`` (GET only).
* Module re-uses chat-A1's shared ``smartbi_compat.tenant`` (no
  duplicate enum).
* ``_RESTAURANT_DATA_AVAILABILITY_VOCAB`` controlled vocabulary
  exported with exactly 5 markers (Sub-B spec §4.2) — frontend
  chip-badge rendering depends on these exact strings.

Spec: docs/superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md
Sibling: backend/python/tests/test_analysis_production_skeleton.py
"""
from __future__ import annotations

import inspect
from datetime import date

import pytest

from smartbi_compat import tenant as tenant_module
from smartbi_compat.api import analysis_quality
from smartbi_compat.api.analysis_quality import (
    FACTORY_PHASE_2D_PENDING_MARKER,
    _factory_quality_dispatch,
    _restaurant_quality_dispatch,
    _FACTORY_BRANCH_DEFERRED_MSG,
    _RESTAURANT_DATA_AVAILABILITY_VOCAB,
    router,
)


# ============================================================
# Factory deferred-message content (Phase 2D handoff grep-ables)
# ============================================================


def test_factory_msg_contains_phase_2d_grep_substring():
    """``_FACTORY_BRANCH_DEFERRED_MSG`` still references Phase 2D.

    Subagent B rewrote the message body ("raises" → "empty envelope
    marked …") but kept the canonical Phase-2D marker token
    ``PHASE_2D`` (carried by ``FACTORY_SILVER_PHASE_2D_PENDING``) +
    every Silver table name (asserted by the parametrized sibling test)
    so grep audits and log searches keep working.
    """
    assert "PHASE_2D" in _FACTORY_BRANCH_DEFERRED_MSG
    assert "FACTORY_SILVER_PHASE_2D_PENDING" in _FACTORY_BRANCH_DEFERRED_MSG


@pytest.mark.parametrize(
    "table",
    [
        "fact_quality_inspection",
        "fact_quality_defect",
        "fact_rework_record",
        "fact_disposal_record",
        "fact_customer_complaint",
    ],
)
def test_factory_msg_lists_silver_table(table):
    """All 5 missing Silver tables (spec §2.3) grep-able for Phase 2D dispatch."""
    assert table in _FACTORY_BRANCH_DEFERRED_MSG


# ============================================================
# Factory dispatcher Phase 2D empty-envelope contracts
# ============================================================


@pytest.mark.asyncio
async def test_factory_dispatch_returns_phase_2d_envelope():
    """Factory branch must return the Phase 2D empty-envelope marker.

    Subagent B rewired the factory dispatcher from a raising stub into an
    empty-envelope response. The top-level
    ``dataAvailability = FACTORY_SILVER_PHASE_2D_PENDING`` is the
    canonical marker frontends key off to render a "data pending" chip
    instead of a 500 error.
    """
    result = await _factory_quality_dispatch(
        "F001", date(2026, 5, 1), date(2026, 5, 31), "fpy"
    )
    assert isinstance(result, dict)
    assert result["dataAvailability"] == FACTORY_PHASE_2D_PENDING_MARKER
    assert result["dataAvailability"] == "FACTORY_SILVER_PHASE_2D_PENDING"


@pytest.mark.parametrize("analysis_type", ["fpy", "defect", "rework", None])
@pytest.mark.asyncio
async def test_factory_dispatch_returns_envelope_for_every_analysis_type(
    analysis_type,
):
    """All 4 analysisType branches (fpy/defect/rework/overview=None) emit marker.

    Per Sub-B spec §1.1 + §3.6 the 4 valid analysisType values are
    fpy / defect / rework / None (None → overview). Phase 2D Subagent B
    rewired each branch to return an empty envelope with the canonical
    ``FACTORY_SILVER_PHASE_2D_PENDING`` marker. The Silver-layer impl
    must preserve the marker key.
    """
    result = await _factory_quality_dispatch(
        "F001", date(2026, 5, 1), date(2026, 5, 31), analysis_type
    )
    assert isinstance(result, dict)
    assert result["dataAvailability"] == FACTORY_PHASE_2D_PENDING_MARKER


# ============================================================
# Dispatcher signature stability for chat-B2 + Phase 2D
# ============================================================


def test_factory_dispatch_signature_stable():
    """4-arg async signature — Phase 2D MUST preserve."""
    sig = inspect.signature(_factory_quality_dispatch)
    assert list(sig.parameters.keys()) == [
        "factory_id",
        "start_date",
        "end_date",
        "analysis_type",
    ]
    assert inspect.iscoroutinefunction(_factory_quality_dispatch)


def test_restaurant_dispatch_signature_stable():
    """4-arg async signature — chat-B3 + Phase 2D MUST preserve.

    chat-B2 (this PR) implements the restaurant body but the dispatcher
    signature was the chat-B1 contract — locking it here so chat-B3
    envelope wiring + future restaurant additions (e.g. trend chart)
    don't introduce kwargs that break the router contract.
    """
    sig = inspect.signature(_restaurant_quality_dispatch)
    assert list(sig.parameters.keys()) == [
        "factory_id",
        "start_date",
        "end_date",
        "analysis_type",
    ]
    assert inspect.iscoroutinefunction(_restaurant_quality_dispatch)


# ============================================================
# Router contract — endpoint path registered + GET-only
# ============================================================


def test_router_declares_quality_analysis_endpoint():
    """Path must match Sub-B spec §1.1 verbatim."""
    paths = [route.path for route in router.routes]
    assert "/api/mobile/{factory_id}/smart-bi/analysis/quality" in paths


def test_router_endpoint_methods_are_get_only():
    target = "/api/mobile/{factory_id}/smart-bi/analysis/quality"
    matching = [r for r in router.routes if r.path == target]
    assert len(matching) == 1
    assert set(matching[0].methods) == {"GET"}


# ============================================================
# Module-level advertisement (stable boundaries for chat-B3)
# ============================================================


def test_module_advertises_dispatch_helpers():
    """Stable function names for chat-B3 wiring + Phase 2D (factory)."""
    assert hasattr(analysis_quality, "_factory_quality_dispatch")
    assert hasattr(analysis_quality, "_restaurant_quality_dispatch")
    assert hasattr(analysis_quality, "get_quality_analysis")


def test_module_advertises_router_and_factory_deferred_constant():
    """Router + factory-deferred constant for chat-B3 envelope wiring."""
    assert hasattr(analysis_quality, "router")
    assert analysis_quality.router is router
    assert hasattr(analysis_quality, "_FACTORY_BRANCH_DEFERRED_MSG")


# ============================================================
# Tenant import contract — chat-B1 MUST re-use chat-A1's shared module
# ============================================================


def test_module_reuses_shared_tenant_type():
    """No duplicate enum — chat-B1 imports chat-A1's TenantType."""
    assert analysis_quality.TenantType is tenant_module.TenantType


def test_module_reuses_shared_get_tenant_type():
    """No duplicate query — chat-B1 imports chat-A1's get_tenant_type."""
    assert analysis_quality.get_tenant_type is tenant_module.get_tenant_type


# ============================================================
# Controlled dataAvailability vocabulary (chat-B2 handoff)
# ============================================================


def test_data_availability_vocab_is_immutable_tuple():
    """Tuple, not list — prevent accidental mutation in chat-B2/B3."""
    assert isinstance(_RESTAURANT_DATA_AVAILABILITY_VOCAB, tuple)


def test_data_availability_vocab_has_exactly_five_markers():
    """Sub-B spec §4 defines exactly 5 quality-side markers."""
    assert len(_RESTAURANT_DATA_AVAILABILITY_VOCAB) == 5


@pytest.mark.parametrize(
    "marker",
    [
        "MISSING_FOOD_SAFETY_INCIDENT_LOG",  # N1 Q-DEC-4
        "NO_REVIEW_DATA_FOR_CHAIN",           # N2 Q-DEC-5
        "RETURN_QTY_NOT_INGESTED",            # N3 Q-DEC-6 F3 fallback
        "NO_POS_DATA_FOR_PERIOD",             # N3 zero-row
        "WASTAGE_NOT_TRACKED",                # N4 Q-DEC-7
    ],
)
def test_data_availability_vocab_contains_marker(marker):
    """All 5 controlled-vocab markers (spec §4) exposed for chat-B2 import."""
    assert marker in _RESTAURANT_DATA_AVAILABILITY_VOCAB
