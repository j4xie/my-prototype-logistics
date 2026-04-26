"""Entity resolution package."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import asyncpg

    from smartbi.canonical.entity_resolution.orchestrator import (
        EntityResolutionOrchestrator,
    )


def make_default_orchestrator(pool: "asyncpg.Pool") -> "EntityResolutionOrchestrator":
    """5-agent chain: deterministic → embedding → contextual → transitive → llm_arbitrator."""
    from smartbi.canonical.entity_resolution.agents.contextual import ContextualAgent
    from smartbi.canonical.entity_resolution.agents.deterministic import (
        DeterministicAgent,
    )
    from smartbi.canonical.entity_resolution.agents.embedding import EmbeddingAgent
    from smartbi.canonical.entity_resolution.agents.llm_arbitrator import (
        LLMArbitrator,
    )
    from smartbi.canonical.entity_resolution.agents.transitive import TransitiveAgent
    from smartbi.canonical.entity_resolution.orchestrator import (
        EntityResolutionOrchestrator,
    )

    return EntityResolutionOrchestrator(
        pool,
        [
            DeterministicAgent(),
            EmbeddingAgent(),
            ContextualAgent(),
            TransitiveAgent(),
            LLMArbitrator(),
        ],
    )
