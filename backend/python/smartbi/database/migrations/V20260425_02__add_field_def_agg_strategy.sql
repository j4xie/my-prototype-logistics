-- V20260425_02__add_field_def_agg_strategy.sql
--
-- Add per-field aggregation strategy column. Replaces the Apr 24 stop-gap
-- heuristics in:
--   - backend/python/smartbi/api/insight.py (quick_summary regex on col-name)
--   - web-admin/src/api/smartbi/analysis.ts (FE getSmartKPIs implicit dispatch)
--
-- Values:
--   'sum'  — measures aggregated as SUM for KPI cards (default for legacy rows)
--   'mean' — ratings (1-5 scale) shown as MEAN: "平均星级 = 4.83 分"
--   'none' — IDs and non-measures excluded from KPI cards entirely
--
-- Upstream: backend/python/smartbi/services/field_classifier.py
--           infer_agg_strategy(name, semantic_type, is_measure, statistics)
--
-- Populated by: /api/smartbi/analytics/reclassify/{upload_id} endpoint
--               (γ-1c hook fires this after each upload commit)
--
-- Default 'sum' is safe for existing rows: matches the pre-Apr 24 behaviour
-- where every numeric col was summed. Backfill script runs reclassify per
-- upload to refine IDs → 'none' and ratings → 'mean'.

ALTER TABLE smart_bi_pg_field_definitions
    ADD COLUMN IF NOT EXISTS agg_strategy VARCHAR(20) NOT NULL DEFAULT 'sum';

COMMENT ON COLUMN smart_bi_pg_field_definitions.agg_strategy IS
    'KPI aggregation strategy: sum | mean | none. See field_classifier.infer_agg_strategy().';
