-- Process Mode Migration Verification Script
-- Run against test DB to verify all V20260312 migrations applied correctly
-- Usage: psql -h localhost -U cretas_user -d cretas_db -f tests/process-mode-migration-verify.sql

-- ==========================================
-- MIG-01: V20260312_01 — Factory feature config
-- ==========================================
DO $$
DECLARE
    cfg_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO cfg_count
    FROM factory_feature_config
    WHERE module_id = 'production'
      AND config::text LIKE '%PROCESS%';
    IF cfg_count > 0 THEN
        RAISE NOTICE 'MIG-01 PASS: factory_feature_config contains PROCESS mode config';
    ELSE
        RAISE WARNING 'MIG-01 FAIL: factory_feature_config missing PROCESS mode config';
    END IF;
END $$;

-- ==========================================
-- MIG-02: V20260312_02 — work_processes table
-- ==========================================
DO $$
DECLARE
    tbl_exists BOOLEAN;
    idx_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'work_processes') INTO tbl_exists;
    SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_wp_factory') INTO idx_exists;

    IF tbl_exists AND idx_exists THEN
        RAISE NOTICE 'MIG-02 PASS: work_processes table + idx_wp_factory index exist';
    ELSE
        RAISE WARNING 'MIG-02 FAIL: work_processes table=%, idx_wp_factory=%', tbl_exists, idx_exists;
    END IF;
END $$;

-- ==========================================
-- MIG-03: V20260312_03 — product_work_processes table
-- ==========================================
DO $$
DECLARE
    tbl_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'product_work_processes') INTO tbl_exists;
    IF tbl_exists THEN
        RAISE NOTICE 'MIG-03 PASS: product_work_processes table exists';
    ELSE
        RAISE WARNING 'MIG-03 FAIL: product_work_processes table missing';
    END IF;
END $$;

-- ==========================================
-- MIG-04: V20260312_04 — process_tasks table + indexes
-- ==========================================
DO $$
DECLARE
    tbl_exists BOOLEAN;
    idx_count INTEGER;
BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'process_tasks') INTO tbl_exists;
    SELECT COUNT(*) INTO idx_count FROM pg_indexes WHERE tablename = 'process_tasks';

    IF tbl_exists AND idx_count >= 3 THEN
        RAISE NOTICE 'MIG-04 PASS: process_tasks table + % indexes exist', idx_count;
    ELSE
        RAISE WARNING 'MIG-04 FAIL: process_tasks table=%, indexes=%', tbl_exists, idx_count;
    END IF;
END $$;

-- ==========================================
-- MIG-05: V20260312_05 — production_reports extensions
-- ==========================================
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'production_reports'
      AND column_name IN ('process_task_id', 'approval_status', 'is_supplemental');

    IF col_count = 3 THEN
        RAISE NOTICE 'MIG-05 PASS: production_reports has process_task_id, approval_status, is_supplemental columns';
    ELSE
        RAISE WARNING 'MIG-05 FAIL: production_reports missing columns (found %/3)', col_count;
    END IF;
END $$;

-- ==========================================
-- MIG-06: V20260312_06 — Drools production workflow rules
-- ==========================================
DO $$
DECLARE
    rule_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rule_count
    FROM drools_rules
    WHERE factory_id = 'SYSTEM'
      AND rule_group = 'production_workflow';

    IF rule_count >= 5 THEN
        RAISE NOTICE 'MIG-06 PASS: % SYSTEM production_workflow rules found', rule_count;
    ELSE
        RAISE WARNING 'MIG-06 FAIL: Expected >=5 SYSTEM production rules, found %', rule_count;
    END IF;
END $$;

-- ==========================================
-- MIG-07: V20260312_07 — StateMachine versioning
-- ==========================================
DO $$
DECLARE
    col_exists BOOLEAN;
    idx_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'state_machines' AND column_name = 'publish_status'
    ) INTO col_exists;

    SELECT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'state_machines'
          AND indexdef LIKE '%publish_status%'
    ) INTO idx_exists;

    IF col_exists THEN
        RAISE NOTICE 'MIG-07 PASS: state_machines has publish_status column, partial_index=%', idx_exists;
    ELSE
        RAISE WARNING 'MIG-07 FAIL: state_machines missing publish_status column';
    END IF;
END $$;

-- ==========================================
-- MIG-08: V20260312_08 — AI intent configs for process tasks
-- ==========================================
DO $$
DECLARE
    intent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO intent_count
    FROM ai_intent_config
    WHERE tool_name LIKE 'process_task_%';

    IF intent_count >= 4 THEN
        RAISE NOTICE 'MIG-08 PASS: % process_task AI intent configs found', intent_count;
    ELSE
        RAISE WARNING 'MIG-08 FAIL: Expected >=4 process_task intents, found %', intent_count;
    END IF;
END $$;

-- ==========================================
-- MIG-09: V20260312_09 — Factory config agent intent
-- ==========================================
DO $$
DECLARE
    agent_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM ai_intent_config
        WHERE tool_name = 'factory_config_agent'
    ) INTO agent_exists;

    IF agent_exists THEN
        RAISE NOTICE 'MIG-09 PASS: factory_config_agent intent exists';
    ELSE
        RAISE WARNING 'MIG-09 FAIL: factory_config_agent intent missing';
    END IF;
END $$;

-- ==========================================
-- MIG-10: V20260312_10 — workflow_templates table
-- ==========================================
DO $$
DECLARE
    tbl_exists BOOLEAN;
    col_count INTEGER;
    gin_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_templates') INTO tbl_exists;

    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'workflow_templates'
      AND column_name IN ('template_name', 'workflow_json', 'node_configs_json',
                          'global_config_json', 'source_count', 'review_status');

    SELECT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'workflow_templates'
          AND indexdef LIKE '%gin%'
    ) INTO gin_exists;

    IF tbl_exists AND col_count >= 6 THEN
        RAISE NOTICE 'MIG-10 PASS: workflow_templates table exists with % key columns, GIN=%', col_count, gin_exists;
    ELSE
        RAISE WARNING 'MIG-10 FAIL: workflow_templates table=%, columns=%/6, GIN=%', tbl_exists, col_count, gin_exists;
    END IF;
END $$;

-- ==========================================
-- SUMMARY: Count all new tables
-- ==========================================
SELECT
    'SUMMARY' AS check_type,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name IN ('work_processes', 'product_work_processes', 'process_tasks', 'workflow_templates')
    ) AS new_tables_count,
    (SELECT COUNT(*) FROM drools_rules WHERE factory_id = 'SYSTEM') AS system_rules_count,
    (SELECT COUNT(*) FROM ai_intent_config WHERE tool_name LIKE 'process_task_%') AS process_intents_count;
