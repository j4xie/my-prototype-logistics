"""Bronze ingestion layer — unified adapter interface for all upstream sources.

v1 Week 1 Day 3. See docs/superpowers/specs/2026-04-22-unified-data-layer-v1-design.md §1.1 Bronze row.

Each upstream source (Excel / 美团 API / 大众点评 / 供应链 / 外卖) implements
BronzeAdapter. Callers consume the async iterator of RawEvent objects and
push them through Silver normalizer. Bronze does NOT touch business
semantics — it just parses the source format into a homogeneous stream.
"""
from __future__ import annotations

from smartbi.ingestion.base import BronzeAdapter, RawEvent, SourceMeta

__all__ = ["BronzeAdapter", "RawEvent", "SourceMeta"]
