"""Gold layer — durable rollup tables + materialization machinery.

Week 3 of Unified Data Layer v1 spec (§4.1).

The existing `smartbi/services/materialized_analytics/` package (per-upload
chart cache writing into SmartBiPgAnalysisResult) remains unchanged. Both
it and this package live under the conceptual "Gold" layer per spec §1.1:

  Gold = durable agg_* tables (THIS package, Week 3)
       + per-upload chart cache (existing materialized_analytics/)

Downstream modules read agg_* directly via RLS-filtered SELECT. No Java-
to-Python hop for common rollups.

Public surface
--------------
- `GoldMaterializer` — reads Silver, writes agg_*. One method per target
  table. Each call upserts with version bump.
- `MaterializationTrigger` — ABC for "when should we rematerialize?";
  Day 3 implements upload_complete / field_registry_reviewed /
  api_append_incremental.
"""
from __future__ import annotations

from smartbi.gold.materializer import GoldMaterializer, MaterializeStats

__all__ = ["GoldMaterializer", "MaterializeStats"]
