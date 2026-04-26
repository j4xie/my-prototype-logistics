"""Route uploads to the right Silver writer based on detected shape."""
from __future__ import annotations

import functools
import json as _json
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

from smartbi.canonical.concurrency import with_factory_serialization
from smartbi.canonical.shape_detector import DetectionResult, FileShape, ShapeDetector

if TYPE_CHECKING:
    import asyncpg

    from smartbi.canonical.entity_resolution.orchestrator import (
        EntityResolutionOrchestrator,
    )
    from smartbi.canonical.silver_writers import BaseWriter, WriteSummary

logger = logging.getLogger(__name__)


# Maps detected shape → registered writer factory name. SCHEDULE / MEMBER are
# deferred to C-stage (return None).
WRITER_REGISTRY: dict[FileShape, Optional[str]] = {
    FileShape.BILL_FLOW: "bill_flow",
    FileShape.PRODUCT_SUMMARY: "product_summary",
    FileShape.REVIEW: "review",
    FileShape.FINANCE: "finance",
    FileShape.INVENTORY: "inventory",
    FileShape.SCHEDULE: None,
    FileShape.MEMBER: None,
    FileShape.UNKNOWN: None,
}


_SHAPE_DETECTION_ENTITY_TYPE = "shape_detection"


@dataclass(frozen=True)
class RouteResult:
    routed_to: Optional[str]
    shape: str
    confidence: float
    queued_for_admin: bool
    write_summary: Optional["WriteSummary"] = None
    reasoning: str = ""


def get_writer(
    writer_name: str,
    pool: "asyncpg.Pool",
    orchestrator: "EntityResolutionOrchestrator",
) -> Optional["BaseWriter"]:
    """Resolve writer name → instance. Returns None for unimplemented writers."""
    from smartbi.canonical.silver_writers import (
        BillFlowWriter,
        FinanceWriter,
        InventoryWriter,
        ProductSummaryWriter,
        ReviewWriter,
    )

    if writer_name == "bill_flow":
        return BillFlowWriter(pool=pool, orchestrator=orchestrator)
    if writer_name == "product_summary":
        return ProductSummaryWriter(pool=pool, orchestrator=orchestrator)
    if writer_name == "review":
        return ReviewWriter(pool=pool, orchestrator=orchestrator)
    if writer_name == "finance":
        return FinanceWriter(pool=pool, orchestrator=orchestrator)
    if writer_name == "inventory":
        return InventoryWriter(pool=pool, orchestrator=orchestrator)
    # schedule / member still deferred to C-stage.
    return None


async def route_upload(
    upload_id: int,
    factory_id: str,
    pool: "asyncpg.Pool",
    orchestrator: "EntityResolutionOrchestrator",
    detector: Optional[ShapeDetector] = None,
) -> RouteResult:
    """Detect shape + dispatch. Same factory uploads serialize via factory lock."""
    detector = detector or ShapeDetector()
    async with pool.acquire() as conn:
        return await with_factory_serialization(
            factory_id,
            conn,
            functools.partial(
                _route_upload_inner,
                upload_id,
                factory_id,
                pool,
                orchestrator,
                detector,
            ),
        )


async def _route_upload_inner(
    upload_id: int,
    factory_id: str,
    pool: "asyncpg.Pool",
    orchestrator: "EntityResolutionOrchestrator",
    detector: ShapeDetector,
    conn: "asyncpg.Connection",
) -> RouteResult:
    """Inner work after factory serialization is acquired."""
    col_rows = await conn.fetch(
        "SELECT original_name FROM smart_bi_pg_field_definitions "
        "WHERE upload_id = $1",
        upload_id,
    )
    sample_rows = await conn.fetch(
        "SELECT row_data FROM smart_bi_dynamic_data "
        "WHERE upload_id = $1 LIMIT 5",
        upload_id,
    )

    column_names = [r["original_name"] for r in col_rows]
    samples = [_unwrap_row_data(r["row_data"]) for r in sample_rows]

    detection = await detector.detect(samples, column_names)

    writer_name = WRITER_REGISTRY.get(detection.shape)
    if writer_name is None or detection.confidence < ShapeDetector.AUTO_ROUTE_THRESHOLD:
        await _queue_unknown_for_admin(conn, upload_id, factory_id, detection)
        return RouteResult(
            routed_to=None,
            shape=detection.shape.value,
            confidence=detection.confidence,
            queued_for_admin=True,
            reasoning=detection.reasoning,
        )

    writer = get_writer(writer_name, pool, orchestrator)
    if writer is None:
        # Mapped name exists but writer not yet implemented — admin queue path.
        await _queue_unknown_for_admin(conn, upload_id, factory_id, detection)
        return RouteResult(
            routed_to=None,
            shape=detection.shape.value,
            confidence=detection.confidence,
            queued_for_admin=True,
            reasoning=f"writer not yet implemented: {writer_name}",
        )

    summary = await writer.write(upload_id, factory_id)
    return RouteResult(
        routed_to=writer_name,
        shape=detection.shape.value,
        confidence=detection.confidence,
        queued_for_admin=False,
        write_summary=summary,
        reasoning=detection.reasoning,
    )


def _unwrap_row_data(raw):
    """smart_bi_dynamic_data.row_data may be JSON string or dict."""
    if isinstance(raw, str):
        try:
            return _json.loads(raw)
        except _json.JSONDecodeError:
            return {"_raw": raw}
    return raw or {}


async def _queue_unknown_for_admin(
    conn: "asyncpg.Connection",
    upload_id: int,
    factory_id: str,
    detection: DetectionResult,
) -> None:
    """Insert a row marking the upload for admin shape review."""
    await conn.execute(
        """
        INSERT INTO entity_resolution_admin_queue
          (factory_id, entity_type, raw_name, candidate_entity_id, confidence,
           decided_by_agent, source_upload_id)
        VALUES ($1, $2, $3, NULL, $4, $5, $6)
        """,
        factory_id,
        _SHAPE_DETECTION_ENTITY_TYPE,
        f"upload:{upload_id}",
        detection.confidence,
        f"shape_detector:{detection.shape.value}",
        upload_id,
    )
