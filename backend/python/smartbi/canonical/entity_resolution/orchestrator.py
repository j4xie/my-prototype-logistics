"""Entity resolution orchestrator + shared types."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence, Set, TYPE_CHECKING

if TYPE_CHECKING:
    import asyncpg

    from smartbi.canonical.entity_resolution.agents.base import BaseAgent


class EntityType(Enum):
    """Resolvable entity kinds."""

    STORE = "store"
    PRODUCT = "product"
    STAFF = "staff"


@dataclass
class ResolutionInput:
    """Per-call input. Mutable: agents may write to context."""

    raw_name: str
    entity_type: EntityType
    factory_id: str
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentResult:
    """Per-agent output."""

    matched_entity_id: Optional[int]
    confidence: float
    reasoning: str
    candidates: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class OrchestrationContext:
    """Cross-agent shared state. Internal to orchestrator."""

    top_k_candidates: List[Dict[str, Any]] = field(default_factory=list)
    tried_entity_ids: Set[int] = field(default_factory=set)
    agent_outputs: Dict[str, AgentResult] = field(default_factory=dict)


@dataclass(frozen=True)
class ResolutionOutput:
    """Final resolution result."""

    matched_entity_id: Optional[int]
    confidence: float
    decided_by_agent: str
    reasoning: str
    fallback_chain: List[str] = field(default_factory=list)
    is_tentative: bool = False


class EntityResolutionOrchestrator:
    """Run agents in sequence; first to ship wins, else tentative or admin queue."""

    def __init__(
        self,
        pool: "asyncpg.Pool",
        agents: Sequence["BaseAgent"],
    ) -> None:
        self._pool = pool
        self._agents = list(agents)
        self._tentative_threshold = 0.80

    async def resolve(self, input: ResolutionInput) -> ResolutionOutput:
        ctx = OrchestrationContext()
        chain: List[str] = []
        best: Optional[tuple[str, AgentResult]] = None

        for agent in self._agents:
            input.context["top_k_candidates"] = ctx.top_k_candidates
            input.context["tried_entity_ids"] = list(ctx.tried_entity_ids)
            result = await agent.resolve(input, self._pool)
            chain.append(agent.name)
            ctx.agent_outputs[agent.name] = result
            if result.candidates:
                ctx.top_k_candidates = result.candidates[:5]
            if result.matched_entity_id is not None:
                ctx.tried_entity_ids.add(result.matched_entity_id)

            if result.confidence >= agent.ship_threshold:
                output = ResolutionOutput(
                    matched_entity_id=result.matched_entity_id,
                    confidence=result.confidence,
                    decided_by_agent=agent.name,
                    reasoning=result.reasoning,
                    fallback_chain=chain.copy(),
                    is_tentative=False,
                )
                await self._record_history(input, output)
                return output

            if best is None or result.confidence > best[1].confidence:
                best = (agent.name, result)

        if (
            best is not None
            and best[1].confidence >= self._tentative_threshold
            and best[1].matched_entity_id is not None
        ):
            output = ResolutionOutput(
                matched_entity_id=best[1].matched_entity_id,
                confidence=best[1].confidence,
                decided_by_agent=best[0],
                reasoning=f"[tentative] {best[1].reasoning}",
                fallback_chain=chain.copy(),
                is_tentative=True,
            )
            await self._record_history(input, output)
            await self._queue_for_admin(input, output, priority="low")
            return output

        output = ResolutionOutput(
            matched_entity_id=None,
            confidence=0.0,
            decided_by_agent="admin_queue",
            reasoning="所有 agent 置信度均不足, 进入人工审核",
            fallback_chain=chain.copy(),
        )
        await self._queue_for_admin(input, output, priority="high")
        return output

    async def _record_history(
        self,
        input: ResolutionInput,
        output: ResolutionOutput,
    ) -> None:
        """Insert/upsert audit row into entity_resolution_history."""
        if output.matched_entity_id is None:
            return
        async with self._pool.acquire() as conn:
            entity_table = f"dim_{input.entity_type.value}"
            id_column = f"{input.entity_type.value}_id"
            row = await conn.fetchrow(
                f"SELECT name FROM {entity_table} "
                f"WHERE factory_id = $1 AND {id_column} = $2",
                input.factory_id,
                output.matched_entity_id,
            )
            b_name = row["name"] if row else input.raw_name
            await conn.execute(
                """
                INSERT INTO entity_resolution_history
                  (factory_id, entity_type, a_name, b_name, b_entity_id,
                   confidence, decided_by_agent, reasoning)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (factory_id, entity_type, a_name, b_entity_id) DO UPDATE SET
                  confidence = GREATEST(
                      entity_resolution_history.confidence, EXCLUDED.confidence
                  ),
                  decided_by_agent = EXCLUDED.decided_by_agent,
                  reasoning = EXCLUDED.reasoning
                """,
                input.factory_id,
                input.entity_type.value,
                input.raw_name,
                b_name,
                output.matched_entity_id,
                output.confidence,
                output.decided_by_agent,
                output.reasoning,
            )

    async def _queue_for_admin(
        self,
        input: ResolutionInput,
        output: ResolutionOutput,
        priority: str,
    ) -> None:
        """Insert pending row into entity_resolution_admin_queue."""
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO entity_resolution_admin_queue
                  (factory_id, entity_type, raw_name, candidate_entity_id,
                   confidence, decided_by_agent)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                input.factory_id,
                input.entity_type.value,
                input.raw_name,
                output.matched_entity_id,
                output.confidence,
                output.decided_by_agent,
            )
