-- P0 SECURITY (Apr 28 2026) — Sister sweep after V20260502_03 found 3 tables.
--
-- Rule 17.7 audit (qa-prompt v2.4) identified 20 MORE factory-scoped tables
-- on prod with relrowsecurity=f. Most concerning: restaurant_reviews (customer
-- PII), worker_trajectory (employee location), smart_bi_finance_data,
-- client_requirement_companies (B2B client info), efficiency_cost_records.
--
-- Same per-command policy pattern as V20260502_03 (permissive INSERT/SELECT
-- without GUC, strict UPDATE/DELETE) — Hibernate JPA compat + cross-tenant
-- block when GUC is set to a different tenant.

-- ============================================================
-- Helper macro: 4 policies per table
-- ============================================================
-- Apply to each factory-scoped table:
--   tenant_select  USING factory_id=GUC OR GUC unset
--   tenant_insert  WITH CHECK factory_id IS NOT NULL
--   tenant_update  USING factory_id=GUC OR GUC unset, WITH CHECK factory_id IS NOT NULL
--   tenant_delete  USING factory_id=GUC strict

-- ============================================================
-- BATCH 1 — User-facing critical tables (PII / financial)
-- ============================================================

-- restaurant_reviews (customer review text — PII risk)
ALTER TABLE restaurant_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON restaurant_reviews FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON restaurant_reviews FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON restaurant_reviews FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON restaurant_reviews FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- restaurant_review_sources
ALTER TABLE restaurant_review_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_review_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON restaurant_review_sources FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON restaurant_review_sources FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON restaurant_review_sources FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON restaurant_review_sources FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- worker_trajectory (employee location/movement data — PII)
ALTER TABLE worker_trajectory ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_trajectory FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON worker_trajectory FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON worker_trajectory FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON worker_trajectory FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON worker_trajectory FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- worker_daily_efficiency
ALTER TABLE worker_daily_efficiency ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_daily_efficiency FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON worker_daily_efficiency FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON worker_daily_efficiency FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON worker_daily_efficiency FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON worker_daily_efficiency FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- worker_tracking_features
ALTER TABLE worker_tracking_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_tracking_features FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON worker_tracking_features FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON worker_tracking_features FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON worker_tracking_features FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON worker_tracking_features FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- smart_bi_finance_data (financial data)
ALTER TABLE smart_bi_finance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_finance_data FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON smart_bi_finance_data FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON smart_bi_finance_data FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_finance_data FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_finance_data FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- client_requirement_companies (B2B client info)
ALTER TABLE client_requirement_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_requirement_companies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON client_requirement_companies FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON client_requirement_companies FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON client_requirement_companies FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON client_requirement_companies FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- efficiency_cost_records (cost data)
ALTER TABLE efficiency_cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE efficiency_cost_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON efficiency_cost_records FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON efficiency_cost_records FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON efficiency_cost_records FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON efficiency_cost_records FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- BATCH 2 — Operational data
-- ============================================================

-- restaurant_monthly_purchases
ALTER TABLE restaurant_monthly_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_monthly_purchases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON restaurant_monthly_purchases FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON restaurant_monthly_purchases FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON restaurant_monthly_purchases FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON restaurant_monthly_purchases FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- restaurant_sku_forms
ALTER TABLE restaurant_sku_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_sku_forms FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON restaurant_sku_forms FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON restaurant_sku_forms FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON restaurant_sku_forms FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON restaurant_sku_forms FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- BATCH 3 — SmartBI infrastructure
-- ============================================================

-- smart_bi_dashboard_layouts
ALTER TABLE smart_bi_dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_dashboard_layouts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON smart_bi_dashboard_layouts FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON smart_bi_dashboard_layouts FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_dashboard_layouts FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_dashboard_layouts FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- smart_bi_dynamic_data
ALTER TABLE smart_bi_dynamic_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_dynamic_data FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON smart_bi_dynamic_data FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON smart_bi_dynamic_data FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_dynamic_data FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_dynamic_data FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- smart_bi_pg_upload_aggregate_cache (aggregate cache from polars)
ALTER TABLE smart_bi_pg_upload_aggregate_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_pg_upload_aggregate_cache FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON smart_bi_pg_upload_aggregate_cache FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON smart_bi_pg_upload_aggregate_cache FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_pg_upload_aggregate_cache FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_pg_upload_aggregate_cache FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- smart_bi_query_templates
ALTER TABLE smart_bi_query_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_query_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON smart_bi_query_templates FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON smart_bi_query_templates FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_query_templates FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_query_templates FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- smart_bi_shared_links
ALTER TABLE smart_bi_shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_shared_links FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON smart_bi_shared_links FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON smart_bi_shared_links FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_shared_links FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_shared_links FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- smart_bi_llm_usage (LLM call history)
ALTER TABLE smart_bi_llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_llm_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON smart_bi_llm_usage FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON smart_bi_llm_usage FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON smart_bi_llm_usage FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON smart_bi_llm_usage FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- BATCH 4 — Camera / scene / recording
-- ============================================================

-- camera_scene_understanding
ALTER TABLE camera_scene_understanding ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_scene_understanding FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON camera_scene_understanding FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON camera_scene_understanding FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON camera_scene_understanding FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON camera_scene_understanding FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- camera_topology
ALTER TABLE camera_topology ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_topology FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON camera_topology FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON camera_topology FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON camera_topology FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON camera_topology FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- scene_change_history
ALTER TABLE scene_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_change_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON scene_change_history FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON scene_change_history FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON scene_change_history FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON scene_change_history FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- recording_analysis_tasks
ALTER TABLE recording_analysis_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_analysis_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON recording_analysis_tasks FOR SELECT
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL);
CREATE POLICY tenant_insert ON recording_analysis_tasks FOR INSERT
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_update ON recording_analysis_tasks FOR UPDATE
  USING (factory_id = current_setting('app.factory_id', true)
         OR current_setting('app.factory_id', true) = ''
         OR current_setting('app.factory_id', true) IS NULL)
  WITH CHECK (factory_id IS NOT NULL);
CREATE POLICY tenant_delete ON recording_analysis_tasks FOR DELETE
  USING (factory_id = current_setting('app.factory_id', true));

-- ============================================================
-- Verification (run after this migration applied):
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relrowsecurity=false AND relkind='r'
--      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
--      AND EXISTS (SELECT 1 FROM information_schema.columns
--                  WHERE table_schema='public' AND table_name=relname
--                    AND column_name='factory_id');
--   → should return 0 rows after this migration.
-- ============================================================
