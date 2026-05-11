"""Skeleton tests for ``/analysis/quality`` shared contracts.

chat-B1 Wave 1 (PR #354) shipped this set. chat-B2 Wave 2 ships the
restaurant branch impl (see ``test_analysis_quality_restaurant.py``),
so the restaurant-raises-NotImplementedError tests are removed here.
The factory branch still raises and that assertion stays.

Surviving contracts (chat-B2 + Phase 2D must preserve):

* Factory dispatcher still raises ``NotImplementedError`` with the
  canonical Phase 2D message so future dispatch can grep for it (every
  Silver-table name remains listed for grep-readiness).
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
    _factory_quality_dispatch,
    _restaurant_quality_dispatch,
    _FACTORY_BRANCH_DEFERRED_MSG,
    _RESTAURANT_DATA_AVAILABILITY_VOCAB,
    router,
)


# ============================================================
# Factory deferred-message content (Phase 2D handoff grep-ables)
# ============================================================


def test_factory_msg_canonical_string():
    """Lock the exact factory-branch deferred message.

    Covers in one assertion: "Phase 2D", "chat-B1 dispatch 2026-05-12
    Option B", Q1 amendment §1 reference, chat-A1 PR #350 precedent.
    Parametrized table-name tests below guarantee every Silver table
    is listed.
    """
    assert _FACTORY_BRANCH_DEFERRED_MSG == (
        "Factory quality analysis is deferred to Phase 2D pending the factory "
        "Silver schema migration (fact_quality_inspection / fact_quality_defect / "
        "fact_rework_record / fact_disposal_record / fact_customer_complaint). "
        "chat-B1 dispatch 2026-05-12 Option B: _JavaRandom mock-mirror fallback "
        "rejected (Q1 amendment §1; mirrors chat-A1 PR #350 production precedent)."
    )


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
# Factory dispatcher NotImplementedError contracts
# ============================================================


@pytest.mark.asyncio
async def test_factory_dispatch_raises_canonical_msg():
    """Factory branch must raise the canonical deferred message verbatim."""
    with pytest.raises(NotImplementedError) as exc_info:
        await _factory_quality_dispatch(
            "F001", date(2026, 5, 1), date(2026, 5, 31), "fpy"
        )
    assert str(exc_info.value) == _FACTORY_BRANCH_DEFERRED_MSG


@pytest.mark.parametrize("analysis_type", ["fpy", "defect", "rework", None])
@pytest.mark.asyncio
async def test_factory_dispatch_raises_for_every_analysis_type(analysis_type):
    """All 4 analysisType branches (fpy/defect/rework/overview=None) defer.

    Per Sub-B spec §1.1 + §3.6 the 4 valid analysisType values are
    fpy / defect / rework / None (None → overview). chat-B1 stub MUST
    raise for every one — Phase 2D fill respects the same signature.
    """
    with pytest.raises(NotImplementedError):
        await _factory_quality_dispatch(
            "F001", date(2026, 5, 1), date(2026, 5, 31), analysis_type
        )


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
