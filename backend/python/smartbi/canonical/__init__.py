"""Silver canonical layer — unified schema + field_registry knowledge base.

v1 Week 1 Day 4 starts here with just the field_registry service.
Week 2 adds the Silver normalizer (dim/fact UPSERT) and wires it to Bronze.

See docs/superpowers/specs/2026-04-22-unified-data-layer-v1-design.md §1.1
for the Bronze/Silver/Gold/Agent separation of concerns.
"""
from __future__ import annotations

from smartbi.canonical.field_registry import (
    FieldRegistry,
    RegistryEntry,
    RegistryLookupResult,
)

__all__ = ["FieldRegistry", "RegistryEntry", "RegistryLookupResult"]
