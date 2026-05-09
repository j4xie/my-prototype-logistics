"""TransitiveAgent: 2-hop chain closure over entity_resolution_history."""
from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from smartbi.canonical.entity_resolution.agents.base import BaseAgent
from smartbi.canonical.entity_resolution.orchestrator import (
    AgentResult,
    ResolutionInput,
)

if TYPE_CHECKING:
    import asyncpg


class TransitiveAgent(BaseAgent):
    """Walk a→b→c chain in entity_resolution_history; ship if c == b's match."""

    name = "transitive"
    ship_threshold = 0.80
    DISCOUNT = 0.95

    async def resolve(
        self,
        input: ResolutionInput,
        pool: "asyncpg.Pool",
    ) -> AgentResult:
        async with pool.acquire() as conn:
            first_hop = await conn.fetch(
                """
                SELECT b_entity_id, b_name, confidence
                FROM entity_resolution_history
                WHERE factory_id = $1
                  AND entity_type = $2
                  AND a_name = $3
                  AND confidence > 0.85
                ORDER BY confidence DESC
                LIMIT 5
                """,
                input.factory_id,
                input.entity_type.value,
                input.raw_name,
            )

            if not first_hop:
                return AgentResult(
                    matched_entity_id=None,
                    confidence=0.0,
                    reasoning="no first-hop history for raw_name",
                )

            best_match: Optional[int] = None
            best_conf: float = 0.0
            best_chain: str = ""

            for cand in first_hop:
                b_eid = cand["b_entity_id"]
                b_name = cand["b_name"]
                cand_conf = float(cand["confidence"])

                next_hop = await conn.fetchrow(
                    """
                    SELECT b_entity_id, confidence
                    FROM entity_resolution_history
                    WHERE factory_id = $1
                      AND entity_type = $2
                      AND a_name = $3
                      AND confidence > 0.85
                    ORDER BY confidence DESC
                    LIMIT 1
                    """,
                    input.factory_id,
                    input.entity_type.value,
                    b_name,
                )

                if next_hop is None:
                    continue
                if next_hop["b_entity_id"] != b_eid:
                    continue

                next_conf = float(next_hop["confidence"])
                closure_conf = min(cand_conf, next_conf) * self.DISCOUNT

                if closure_conf > best_conf:
                    best_conf = closure_conf
                    best_match = b_eid
                    best_chain = (
                        f"'{input.raw_name}' → '{b_name}' (conf={cand_conf:.2f}) "
                        f"→ id={b_eid} (conf={next_conf:.2f})"
                    )

            if best_match is None:
                return AgentResult(
                    matched_entity_id=None,
                    confidence=0.0,
                    reasoning="no transitive closure",
                )

            return AgentResult(
                matched_entity_id=best_match,
                confidence=best_conf,
                reasoning=f"transitive closure: {best_chain}",
            )
