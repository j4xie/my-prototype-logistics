"""Silver canonical layer — unified schema + field_registry + resolver + parser.

Week 1 Day 4 started with field_registry; Week 2 adds:
- combo_parser.parse_combo — splits POS line blob into per-item tuples
- DimResolver — INSERT...ON CONFLICT RETURNING id for all 5 dim tables
  with per-instance cache (one per upload) for batch dedup

Week 2 Day 4 will add normalizer.py that orchestrates field_registry +
combo_parser + DimResolver + fact writes.

See docs/superpowers/specs/2026-04-22-unified-data-layer-v1-design.md §1.1
for the Bronze/Silver/Gold/Agent separation of concerns.
"""
from __future__ import annotations

from smartbi.canonical.combo_parser import ComboItem, parse_combo
from smartbi.canonical.dim_resolver import DimResolver
from smartbi.canonical.field_registry import (
    FieldRegistry,
    RegistryEntry,
    RegistryLookupResult,
)
from smartbi.canonical.normalizer import (
    CanonicalRow,
    CostLine,
    NormalizeStats,
    SilverNormalizer,
)

__all__ = [
    "CanonicalRow",
    "ComboItem",
    "CostLine",
    "DimResolver",
    "FieldRegistry",
    "NormalizeStats",
    "RegistryEntry",
    "RegistryLookupResult",
    "SilverNormalizer",
    "parse_combo",
]
