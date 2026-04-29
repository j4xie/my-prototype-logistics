"""Agent base class."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import asyncpg

    from smartbi.canonical.entity_resolution.orchestrator import (
        AgentResult,
        ResolutionInput,
    )


class BaseAgent(ABC):
    """All resolution agents implement this. name + ship_threshold are class-level."""

    name: str = ""
    ship_threshold: float = 1.0

    @abstractmethod
    async def resolve(
        self,
        input: "ResolutionInput",
        pool: "asyncpg.Pool",
    ) -> "AgentResult":
        ...
