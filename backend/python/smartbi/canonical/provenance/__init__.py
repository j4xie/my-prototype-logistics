"""Field provenance — cell-level lineage for data fabric authority resolution."""
from __future__ import annotations

from .types import ProvenanceValue
from .writer import read_authoritative_value, write_provenance

__all__ = ["ProvenanceValue", "write_provenance", "read_authoritative_value"]
