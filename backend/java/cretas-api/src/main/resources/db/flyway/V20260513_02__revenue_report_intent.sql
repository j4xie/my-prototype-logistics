-- V20260513_02: Register REVENUE_REPORT_GENERATE intent for QHJ 收入管理报表.
--
-- Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §8.5
-- Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task H3
--
-- Pairs with RevenueReportGenerateTool.java (@Component, getToolName() returns
-- 'revenue_report_generate'). The IntentExecutor reads `tool_name` from this
-- row to dispatch.
--
-- Pattern mirrors V20260411_01__ai_intent_config_restaurant_diagnostics.sql:
--   - gen_random_uuid() for ID
--   - explicit created_at = NOW(), updated_at = NOW()
--     (ai_intent_configs.created_at/updated_at are NOT NULL with no DEFAULT —
--     see V20260407_07__factory_material_requisition_intents.sql comment)
--   - ON CONFLICT (intent_code) DO UPDATE keeps tool_name in sync if re-run
--     and refreshes updated_at = NOW() on every re-apply
--   - is_active=true at boot (gate via priority + sensitivity if needed)
--
-- Priority 80 chosen to match the finance/RD migrations (proven baseline).
-- Sensitivity LOW: read-only data, no PII exposure beyond what /audit-log
-- already governs via factory-id RLS on smart_bi_report_audit_log (Phase A).
--
-- Hotfix history: original migration omitted created_at/updated_at columns
-- and failed on Java prod deploy #4 with
--   ERROR: null value in column "created_at" of relation "ai_intent_configs"
--   violates not-null constraint
-- Failed flyway_schema_history row removed manually on prod via
-- scripts/migrations/cleanup-failed-v20260513-02.sh before re-deploy.

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'REVENUE_REPORT_GENERATE',
    '生成收入管理报表',
    'RESTAURANT',
    'revenue_report_generate',
    'LOW',
    '["收入管理报表","收入报表","营业收入分析","门店收入报表","堂食外卖占比","客单人数分析","环比报表","同比报表","生成收入报表","拉收入报表"]',
    '生成餐饮收入管理报表（同比/环比/堂食外卖占比/客单人数分析四个维度）。' ||
    '支持多门店多日期范围；班次过滤；输出 xlsx + 下载链接。',
    80,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    intent_name = EXCLUDED.intent_name,
    intent_category = EXCLUDED.intent_category,
    sensitivity_level = EXCLUDED.sensitivity_level,
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
