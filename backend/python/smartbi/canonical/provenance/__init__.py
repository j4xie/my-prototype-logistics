"""Field provenance — cell-level lineage for data fabric authority resolution."""
from __future__ import annotations

from .cascade import (
    compute_dish_margin,
    infer_product_summary_period,
)
from .conflict_resolver import (
    GLOBAL_PRIORITY_TABLE,
    invalidate_factory_config_cache,
    resolve_conflict,
)
from .industry_defaults import (
    INDUSTRY_DEFAULT_COST_RATIO,
    INDUSTRY_DEFAULT_MARGIN_RATE,
    get_industry_default,
)
from .types import ProvenanceValue
from .writer import read_authoritative_value, write_provenance

__all__ = [
    # core
    "ProvenanceValue",
    "write_provenance",
    "read_authoritative_value",
    "resolve_conflict",
    "invalidate_factory_config_cache",
    "GLOBAL_PRIORITY_TABLE",
    # Day 13-15 cascade
    "compute_dish_margin",
    "infer_product_summary_period",
    "INDUSTRY_DEFAULT_COST_RATIO",
    "INDUSTRY_DEFAULT_MARGIN_RATE",
    "get_industry_default",
]
