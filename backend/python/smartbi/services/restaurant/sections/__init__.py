"""Restaurant analysis sections - one module per analyzer."""
from .base import AbstractSectionHandler, SectionRequest, SectionResponse, SectionStatus

__all__ = [
    "AbstractSectionHandler",
    "SectionRequest",
    "SectionResponse",
    "SectionStatus",
]
