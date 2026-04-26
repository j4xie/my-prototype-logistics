"""Unit tests for BaseWriter ABC + BillFlowWriter dispatch."""
from __future__ import annotations

import dataclasses
import sys
import types
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.silver_writers import (
    BaseWriter,
    BillFlowWriter,
    ResolveResult,
    WriteSummary,
)


def test_base_writer_is_abstract():
    """BaseWriter cannot be instantiated directly — write() is abstract."""
    with pytest.raises(TypeError):
        BaseWriter(pool=MagicMock(), orchestrator=MagicMock())  # type: ignore[abstract]


def test_write_summary_defaults():
    """WriteSummary tentative_count + elapsed_ms default to 0."""
    summary = WriteSummary(
        rows_written=10,
        rows_skipped=2,
        new_entity_count=0,
        admin_queue_count=0,
    )
    assert summary.tentative_count == 0
    assert summary.elapsed_ms == 0
    assert summary.rows_written == 10
    assert summary.rows_skipped == 2


def test_resolve_result_frozen():
    """ResolveResult is frozen — assigning attributes raises FrozenInstanceError."""
    rr = ResolveResult(entity_id=1, is_tentative=False, confidence=0.95)
    with pytest.raises((dataclasses.FrozenInstanceError, AttributeError)):
        rr.entity_id = 2  # type: ignore[misc]


class _DummyWriter(BaseWriter):
    """Concrete subclass for testing BaseWriter helpers."""

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        return WriteSummary(
            rows_written=0, rows_skipped=0, new_entity_count=0, admin_queue_count=0
        )


def _install_fake_orchestrator_module(monkeypatch):
    """Insert a fake smartbi.canonical.entity_resolution.orchestrator module."""
    pkg_name = "smartbi.canonical.entity_resolution"
    mod_name = f"{pkg_name}.orchestrator"

    pkg = types.ModuleType(pkg_name)
    pkg.__path__ = []  # type: ignore[attr-defined]
    mod = types.ModuleType(mod_name)

    class _ResolutionInput:
        def __init__(self, raw_name, entity_type, factory_id, context):
            self.raw_name = raw_name
            self.entity_type = entity_type
            self.factory_id = factory_id
            self.context = context

    class _EntityType:
        STORE = "store"
        PRODUCT = "product"
        STAFF = "staff"

    mod.ResolutionInput = _ResolutionInput  # type: ignore[attr-defined]
    mod.EntityType = _EntityType  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, pkg_name, pkg)
    monkeypatch.setitem(sys.modules, mod_name, mod)
    return mod


async def test_resolve_store_empty_name():
    """Empty string short-circuits — orchestrator.resolve is NOT called."""
    orchestrator = MagicMock()
    orchestrator.resolve = AsyncMock()
    writer = _DummyWriter(pool=MagicMock(), orchestrator=orchestrator)

    result = await writer._resolve_store("", factory_id="F001", context={})

    assert result == ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    orchestrator.resolve.assert_not_called()


async def test_resolve_store_none_name():
    """None name also short-circuits without calling orchestrator."""
    orchestrator = MagicMock()
    orchestrator.resolve = AsyncMock()
    writer = _DummyWriter(pool=MagicMock(), orchestrator=orchestrator)

    result = await writer._resolve_store(None, factory_id="F001", context={})

    assert result == ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    orchestrator.resolve.assert_not_called()


async def test_resolve_store_delegates_to_orchestrator(monkeypatch):
    """Non-empty name → orchestrator.resolve called once with ResolutionInput."""
    _install_fake_orchestrator_module(monkeypatch)

    fake_output = MagicMock()
    fake_output.matched_entity_id = 42
    fake_output.is_tentative = False
    fake_output.confidence = 0.95

    orchestrator = MagicMock()
    orchestrator.resolve = AsyncMock(return_value=fake_output)
    writer = _DummyWriter(pool=MagicMock(), orchestrator=orchestrator)

    result = await writer._resolve_store(
        "门店A", factory_id="F001", context={"row_idx": 5}
    )

    assert result == ResolveResult(entity_id=42, is_tentative=False, confidence=0.95)
    orchestrator.resolve.assert_awaited_once()
    call_arg = orchestrator.resolve.await_args.args[0]
    assert call_arg.raw_name == "门店A"
    assert call_arg.entity_type == "store"
    assert call_arg.factory_id == "F001"
    assert call_arg.context == {"row_idx": 5}


async def test_resolve_product_delegates_to_orchestrator(monkeypatch):
    """Product resolve uses EntityType.PRODUCT."""
    _install_fake_orchestrator_module(monkeypatch)

    fake_output = MagicMock()
    fake_output.matched_entity_id = 7
    fake_output.is_tentative = True
    fake_output.confidence = 0.72

    orchestrator = MagicMock()
    orchestrator.resolve = AsyncMock(return_value=fake_output)
    writer = _DummyWriter(pool=MagicMock(), orchestrator=orchestrator)

    result = await writer._resolve_product("青花椒鱼", factory_id="F001", context={})

    assert result == ResolveResult(entity_id=7, is_tentative=True, confidence=0.72)
    call_arg = orchestrator.resolve.await_args.args[0]
    assert call_arg.entity_type == "product"


async def test_resolve_staff_no_store_id_tentative():
    """S-NEW-3: store_id=None → tentative result, no DB / no import."""
    orchestrator = MagicMock()
    pool = MagicMock()
    pool.acquire = MagicMock()  # would raise if called
    writer = _DummyWriter(pool=pool, orchestrator=orchestrator)

    result = await writer._resolve_staff("张伟", factory_id="F001", store_id=None)

    assert result == ResolveResult(entity_id=None, is_tentative=True, confidence=0.0)
    pool.acquire.assert_not_called()


async def test_resolve_staff_empty_name():
    """Empty staff name → not-tentative None result."""
    writer = _DummyWriter(pool=MagicMock(), orchestrator=MagicMock())

    result = await writer._resolve_staff("", factory_id="F001", store_id=99)

    assert result == ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)


async def test_bill_flow_writer_dispatch(monkeypatch):
    """BillFlowWriter.write delegates to backfill_upload + maps stats → WriteSummary."""
    from scripts import backfill_silver

    fake_stats = backfill_silver.BackfillStats(
        upload_id=1,
        factory_id="F001",
        rows_read=100,
        rows_skipped_missing_required=5,
        rows_queued=95,
    )

    backfill_mock = AsyncMock(return_value=fake_stats)
    monkeypatch.setattr(backfill_silver, "backfill_upload", backfill_mock)

    pool = MagicMock()
    orchestrator = MagicMock()
    writer = BillFlowWriter(pool=pool, orchestrator=orchestrator)

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 95
    assert summary.rows_skipped == 5
    assert summary.new_entity_count == 0
    assert summary.admin_queue_count == 0
    assert summary.tentative_count == 0
    assert summary.elapsed_ms >= 0

    backfill_mock.assert_awaited_once_with(pool, upload_id=1, factory_id="F001")
