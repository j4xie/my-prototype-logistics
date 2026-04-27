"""Field provenance — cell-level lineage for data fabric authority resolution."""
from __future__ import annotations

from .conflict_resolver import (
    GLOBAL_PRIORITY_TABLE,
    invalidate_factory_config_cache,
    resolve_conflict,
)
from .types import ProvenanceValue
from .writer import read_authoritative_value, write_provenance

__all__ = [
    "ProvenanceValue",
    "write_provenance",
    "read_authoritative_value",
    "resolve_conflict",
    "invalidate_factory_config_cache",
    "GLOBAL_PRIORITY_TABLE",
]
