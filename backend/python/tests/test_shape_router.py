"""Unit tests for shape_router.route_upload — registry dispatch + admin queue path."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock


from smartbi.canonical.shape_detector import (
    DetectionResult,
    FileShape,
    ShapeDetector,
)
from smartbi.canonical.shape_router import (
    _LEGACY_HANDLED,
    RouteResult,
    WRITER_REGISTRY,
    route_upload,
)


def _attach_transaction_cm(conn):
    """Attach a no-op async transaction context manager to a mock conn."""
    txn = MagicMock()
    txn.__aenter__ = AsyncMock(return_value=None)
    txn.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=txn)
    return conn


def _make_mock_pool(conn=None):
    if conn is None:
        conn = AsyncMock()
        conn.fetch = AsyncMock(return_value=[])
        conn.execute = AsyncMock(return_value=None)
        _attach_transaction_cm(conn)
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool, conn


def _conn_with_columns(column_names, sample_rows=None):
    """Helper: conn.fetch returns either col rows or sample rows by SQL match."""
    conn = AsyncMock()

    col_rows = [{"original_name": c} for c in column_names]
    sample_rows = sample_rows or []
    sample_data = [{"row_data": r} for r in sample_rows]

    async def fetch_side_effect(sql, *args, **kwargs):
        if "field_definitions" in sql:
            return col_rows
        if "dynamic_data" in sql:
            return sample_data
        return []

    conn.fetch = AsyncMock(side_effect=fetch_side_effect)
    conn.execute = AsyncMock(return_value=None)
    _attach_transaction_cm(conn)
    return conn


# --- Registry sanity ----------------------------------------------------


def test_writer_registry_covers_all_shapes():
    """Every FileShape must have a WRITER_REGISTRY entry (None or name)."""
    for shape in FileShape:
        assert shape in WRITER_REGISTRY


def test_writer_registry_bill_flow_short_circuits_to_legacy():
    """bill_flow is short-circuited to the legacy run_silver_dual_write path
    (excel_async.py owns it), so its WRITER_REGISTRY entry is the special
    _LEGACY_HANDLED sentinel — NOT a B-stage writer name. SCHEDULE / MEMBER /
    UNKNOWN remain None (admin queue path)."""
    assert WRITER_REGISTRY[FileShape.BILL_FLOW] == _LEGACY_HANDLED
    assert WRITER_REGISTRY[FileShape.SCHEDULE] is None
    assert WRITER_REGISTRY[FileShape.MEMBER] is None
    assert WRITER_REGISTRY[FileShape.UNKNOWN] is None


# --- route_upload -------------------------------------------------------


async def test_route_bill_flow_short_circuits_to_legacy(monkeypatch):
    """High-confidence BILL_FLOW → routed_to='legacy', NO writer invoked,
    NO admin queue insert. The legacy path in excel_async.run_silver_dual_write
    is responsible for writing fact_pos_* rows; the B-stage router must not
    duplicate that work."""
    conn = _conn_with_columns(
        ["账单号", "营业日期", "商品信息"],
        sample_rows=[{"账单号": "B001"}],
    )
    pool, _ = _make_mock_pool(conn=conn)

    detector = MagicMock(spec=ShapeDetector)
    detector.detect = AsyncMock(
        return_value=DetectionResult(FileShape.BILL_FLOW, 0.95, "rule"),
    )

    # Spy on get_writer — must NOT be invoked for bill_flow.
    import smartbi.canonical.shape_router as router
    get_writer_calls = []

    def _spy_get_writer(*args, **kwargs):
        get_writer_calls.append((args, kwargs))
        return None

    monkeypatch.setattr(router, "get_writer", _spy_get_writer)

    orchestrator = MagicMock()
    result = await route_upload(
        upload_id=1,
        factory_id="F001",
        pool=pool,
        orchestrator=orchestrator,
        detector=detector,
    )

    assert isinstance(result, RouteResult)
    assert result.routed_to == "legacy"
    assert result.queued_for_admin is False
    assert result.shape == "bill_flow"
    assert result.confidence == 0.95
    assert result.write_summary is None
    assert "run_silver_dual_write" in result.reasoning
    # get_writer must NOT have been called for bill_flow
    assert get_writer_calls == []
    # No admin queue insert
    insert_calls = [
        c for c in conn.execute.await_args_list
        if "admin_queue" in c.args[0]
    ]
    assert insert_calls == []


async def test_route_low_confidence_queues_admin():
    """Detector returns 0.6 confidence → admin queue insert + queued_for_admin=True."""
    conn = _conn_with_columns(["foo", "bar"])
    pool, _ = _make_mock_pool(conn=conn)

    detector = MagicMock(spec=ShapeDetector)
    detector.detect = AsyncMock(
        return_value=DetectionResult(FileShape.BILL_FLOW, 0.60, "low conf"),
    )

    orchestrator = MagicMock()
    result = await route_upload(
        upload_id=2,
        factory_id="F001",
        pool=pool,
        orchestrator=orchestrator,
        detector=detector,
    )

    assert result.queued_for_admin is True
    assert result.routed_to is None
    assert result.shape == "bill_flow"
    assert result.confidence == 0.60
    # Admin queue insert ran
    insert_calls = [
        c for c in conn.execute.await_args_list
        if "admin_queue" in c.args[0]
    ]
    assert len(insert_calls) == 1
    insert_sql = insert_calls[0].args[0]
    assert "entity_resolution_admin_queue" in insert_sql
    assert "source_upload_id" in insert_sql


async def test_route_unknown_shape_queues_admin():
    """UNKNOWN shape → admin queue regardless of confidence."""
    conn = _conn_with_columns(["junk"])
    pool, _ = _make_mock_pool(conn=conn)

    detector = MagicMock(spec=ShapeDetector)
    detector.detect = AsyncMock(
        return_value=DetectionResult(FileShape.UNKNOWN, 0.95, "rule unk"),
    )

    orchestrator = MagicMock()
    result = await route_upload(
        upload_id=3,
        factory_id="F001",
        pool=pool,
        orchestrator=orchestrator,
        detector=detector,
    )

    assert result.queued_for_admin is True
    assert result.routed_to is None
    assert result.shape == "unknown"


async def test_route_unimplemented_writer_queues_admin():
    """SCHEDULE shape → registry maps to None (deferred to C-stage) →
    admin queue. After Day 8-9, product/review/finance/inventory are all wired,
    so SCHEDULE / MEMBER are the only remaining unwired shapes."""
    conn = _conn_with_columns(["排班日期", "员工"])
    pool, _ = _make_mock_pool(conn=conn)

    detector = MagicMock(spec=ShapeDetector)
    detector.detect = AsyncMock(
        return_value=DetectionResult(FileShape.SCHEDULE, 0.90, "rule"),
    )

    orchestrator = MagicMock()
    result = await route_upload(
        upload_id=4,
        factory_id="F001",
        pool=pool,
        orchestrator=orchestrator,
        detector=detector,
    )

    assert result.queued_for_admin is True
    assert result.routed_to is None
    assert result.shape == "schedule"


async def test_route_passes_factory_id_in_admin_insert():
    """Admin queue row carries factory_id + source_upload_id from caller."""
    conn = _conn_with_columns(["junk"])
    pool, _ = _make_mock_pool(conn=conn)

    detector = MagicMock(spec=ShapeDetector)
    detector.detect = AsyncMock(
        return_value=DetectionResult(FileShape.UNKNOWN, 0.10, "no signal"),
    )

    orchestrator = MagicMock()
    await route_upload(
        upload_id=99,
        factory_id="F999",
        pool=pool,
        orchestrator=orchestrator,
        detector=detector,
    )

    insert_call = [
        c for c in conn.execute.await_args_list
        if "admin_queue" in c.args[0]
    ][0]
    args = insert_call.args
    # args[1]=factory_id, args[2]=entity_type, args[3]=raw_name,
    # args[4]=confidence, args[5]=decided_by_agent, args[6]=upload_id
    assert args[1] == "F999"
    # entity_type must satisfy CHECK constraint (V20260427_01 broadens to
    # include 'shape_detection' for upload-level routing failures).
    assert args[2] == "shape_detection"
    assert args[3] == "upload:99"
    assert args[4] == 0.10
    assert args[5].startswith("shape_detector:")
    assert args[6] == 99
