"""Section handler base classes - contract for all restaurant analysis sections."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class SectionStatus(str, Enum):
    OK = "ok"
    SKIPPED = "skipped"       # Missing required inputs, skipped gracefully
    FAILED = "failed"         # Compute error, details in warnings


@dataclass
class SectionRequest:
    """Uniform input for all section handlers."""
    factory_id: str
    upload_id: Optional[str]
    sub_sector: str                           # e.g. "火锅", "川菜", "烧烤"
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    period: str = "current"
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class SectionResponse:
    """Uniform output for all section handlers."""
    section_name: str
    status: SectionStatus
    data: dict[str, Any]
    warnings: list[str] = field(default_factory=list)
    cache_key: str = ""
    computed_at_ms: int = 0


class AbstractSectionHandler(ABC):
    """Every section must inherit and implement compute().

    Subclasses declare `section_name` as a class attribute (not method).

    The `@abstractmethod` on `compute()` means any subclass that does not
    override `compute()` will raise TypeError on instantiation:
    ``Can't instantiate abstract class X with abstract method compute``.
    This is the mechanism the contract test relies on.
    """
    section_name: str = ""

    @abstractmethod
    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        """Compute this section. `context` holds cross-section shared state
        (e.g. pre-loaded POS DataFrame, financial metrics dict) so multiple
        sections in a batch don't re-parse Excel.
        """
        raise NotImplementedError

    def cache_key(self, request: SectionRequest) -> str:
        return f"{self.section_name}:{request.factory_id}:{request.upload_id or 'live'}:{request.period}"
