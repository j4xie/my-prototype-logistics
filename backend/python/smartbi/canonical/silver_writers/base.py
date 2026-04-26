"""BaseWriter ABC + WriteSummary/ResolveResult dataclasses."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

import asyncpg

if TYPE_CHECKING:
    from smartbi.canonical.entity_resolution.orchestrator import (
        EntityResolutionOrchestrator,
    )


STAFF_AUTOCREATE_CONFIDENCE = 0.85


@dataclass
class WriteSummary:
    """Mutable accumulator returned by BaseWriter.write()."""

    rows_written: int
    rows_skipped: int
    new_entity_count: int
    admin_queue_count: int
    tentative_count: int = 0
    elapsed_ms: int = 0


@dataclass(frozen=True)
class ResolveResult:
    """Immutable result returned by BaseWriter._resolve_* helpers."""

    entity_id: Optional[int]
    is_tentative: bool
    confidence: float


class BaseWriter(ABC):
    """All Silver writers must implement this. NOT thread-safe — instantiate per upload task."""

    def __init__(
        self,
        pool: asyncpg.Pool,
        orchestrator: "EntityResolutionOrchestrator",
    ) -> None:
        self._pool = pool
        self._orchestrator = orchestrator

    @abstractmethod
    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        """Write Silver rows for the given upload."""
        ...

    async def _resolve_named(
        self,
        entity_kind: str,
        raw_name: Optional[str],
        factory_id: str,
        context: dict,
    ) -> ResolveResult:
        """entity_kind is 'STORE' or 'PRODUCT' — looked up against EntityType enum."""
        if not raw_name:
            return ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
        try:
            from smartbi.canonical.entity_resolution.orchestrator import (
                EntityType,
                ResolutionInput,
            )
        except ImportError as exc:
            raise NotImplementedError(
                "orchestrator awaits Day 3 implementation"
            ) from exc
        result = await self._orchestrator.resolve(
            ResolutionInput(
                raw_name=raw_name,
                entity_type=getattr(EntityType, entity_kind),
                factory_id=factory_id,
                context=context,
            )
        )
        return ResolveResult(
            entity_id=result.matched_entity_id,
            is_tentative=result.is_tentative,
            confidence=result.confidence,
        )

    async def _resolve_store(
        self,
        raw_name: Optional[str],
        factory_id: str,
        context: dict,
    ) -> ResolveResult:
        return await self._resolve_named("STORE", raw_name, factory_id, context)

    async def _resolve_product(
        self,
        raw_name: Optional[str],
        factory_id: str,
        context: dict,
    ) -> ResolveResult:
        return await self._resolve_named("PRODUCT", raw_name, factory_id, context)

    async def _resolve_staff(
        self,
        raw_name: Optional[str],
        factory_id: str,
        store_id: Optional[int],
    ) -> ResolveResult:
        """store_id required else tentative — staff cannot be created without a parent store."""
        if not raw_name:
            return ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
        if store_id is None:
            return ResolveResult(entity_id=None, is_tentative=True, confidence=0.0)
        try:
            from smartbi.canonical.entity_resolution.staff_handler import (
                resolve_staff_with_autocreate,
            )
        except ImportError as exc:
            raise NotImplementedError(
                "staff_handler awaits Day 3+ implementation"
            ) from exc
        async with self._pool.acquire() as conn:
            staff_id, was_auto = await resolve_staff_with_autocreate(
                raw_name, factory_id, store_id, conn
            )
        return ResolveResult(
            entity_id=staff_id,
            is_tentative=was_auto,
            confidence=STAFF_AUTOCREATE_CONFIDENCE,
        )
