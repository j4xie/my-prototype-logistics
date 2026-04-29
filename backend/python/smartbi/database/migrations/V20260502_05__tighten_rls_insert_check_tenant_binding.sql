-- Tighten RLS INSERT WITH CHECK to prevent cross-tenant escape.
--
-- Reviewer (R+1, Apr 28 2026): V20260502_03/_04 INSERT policies use
-- `WITH CHECK (factory_id IS NOT NULL)` which lets a request with
-- GUC=F001 insert a row with factory_id='F999' (CHECK passes since F999
-- is non-null). This is a blue-team gap on PII tables — a tenant could
-- forge other tenants' data via SmartBI's INSERT path.
--
-- This migration recreates each INSERT policy on all 23 RLS-enabled tables
-- to enforce: factory_id MUST equal the current GUC setting (when GUC is
-- set), or GUC may be unset/empty for admin/migration sessions. The
-- previous IS NOT NULL guarantee is preserved within the same predicate.
--
-- Existing UPDATE/DELETE policies are NOT modified (they already use
-- USING + factory_id binding which prevents cross-tenant write to existing
-- rows). SELECT policies also unchanged (read leak prevention is the
-- USING side, which already binds correctly).
--
-- After this migration:
-- - App-level callers with GUC=F001 can only INSERT factory_id='F001'
-- - Admin/migration sessions (GUC unset) can INSERT any factory_id
-- - Bg tasks under '__internal__' sentinel CANNOT INSERT — they MUST set
--   ContextVar via tenant_ctx.set_factory_id() before pool.acquire()
--
-- Companion code change: hooks.py sets ContextVar from caller-passed
-- factory_id before pool.acquire() so post-V20260502_03 the materialization
-- hook resumes working under tenant GUC.

DO $do$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        -- V20260502_03 (3 tables)
        'smart_bi_pg_excel_uploads',
        'smart_bi_pg_analysis_results',
        'smart_bi_llm_fallback_log',
        -- V20260502_04 (20 tables)
        'restaurant_reviews',
        'restaurant_review_sources',
        'worker_trajectory',
        'worker_daily_efficiency',
        'worker_tracking_features',
        'smart_bi_finance_data',
        'client_requirement_companies',
        'efficiency_cost_records',
        'restaurant_monthly_purchases',
        'restaurant_sku_forms',
        'smart_bi_dashboard_layouts',
        'smart_bi_dynamic_data',
        'smart_bi_pg_upload_aggregate_cache',
        'smart_bi_query_templates',
        'smart_bi_shared_links',
        'smart_bi_llm_usage',
        'camera_scene_understanding',
        'camera_topology',
        'scene_change_history',
        'recording_analysis_tasks'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Skip tables that don't exist in this database (V20260502_04 was
        -- written for prod; some tables may not exist in test variants).
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            RAISE NOTICE 'skip % (table not found)', t;
            CONTINUE;
        END IF;

        -- Drop existing INSERT policy if present
        EXECUTE format('DROP POLICY IF EXISTS tenant_insert ON %I', t);

        -- Recreate with tighter check
        EXECUTE format(
            'CREATE POLICY tenant_insert ON %I FOR INSERT '
            'WITH CHECK (factory_id IS NOT NULL AND ('
            'current_setting(''app.factory_id'', true) IS NULL '
            'OR current_setting(''app.factory_id'', true) = '''' '
            'OR factory_id = current_setting(''app.factory_id'', true)'
            '))',
            t
        );

        RAISE NOTICE 'tightened tenant_insert policy on %', t;
    END LOOP;
END
$do$ LANGUAGE plpgsql;
