-- Phase 2D §5 Option A — onboard 14 R_*_REAL chains into cretas_prod_db.factories
--
-- Steve sign-off 2026-05-11 on docs/superpowers/specs/2026-05-11-phase-2d-silver-migration-and-factory-impl-spec.md §5.
--
-- Background
-- ----------
-- Sub-ETL-3 V20260511_02 seeded `smartbi_prod_db.restaurant_chain_catalog` with 14
-- R_*_REAL chains (cuisine + chain_name_zh metadata). Those 14 factory_ids were
-- NOT in `cretas_prod_db.factories` tenant registry. tenant.py:get_tenant_type
-- defaults missing rows to TenantType.FACTORY (mirrors Java
-- SmartBIServiceImpl.isRestaurantTenant `orElse(false)`), so the 14 chains
-- routed to `_factory_*_dispatch` which raises NotImplementedError (chat-A1
-- PR #350 + chat-B1 PR #354 Option B defer) → 500 in prod.
--
-- This migration onboards the 14 chains as RESTAURANT tenants so they route to
-- the restaurant Python branch (chat-A2 PR #352 + chat4 PR #358 LIVE impl)
-- correctly. Each chain returns the restaurant envelope; null-marker payload
-- is expected until Sub-ETL-2c ingests their POS / review / wastage data (per
-- chat4 PR #372 audit §3 — 0 ingested rows for all 14 R_*_REAL today).
--
-- Idempotency
-- -----------
-- ON CONFLICT (id) DO NOTHING — re-running this migration is a no-op when the
-- 14 rows already exist. Safe to redeploy.
--
-- Columns
-- -------
-- Required NOT NULL columns per `Factory.java` entity:
--   id, name, type, level, is_active, manually_verified, ai_weekly_quota
-- Audit columns from BaseEntity:
--   created_at, updated_at (deleted_at defaults to NULL)
--
-- ai_weekly_quota = 1000 per Steve dispatch — these are real customer chains
-- expected to query heavily; entity default of 20 is too low.
--
-- Spec: docs/superpowers/specs/2026-05-11-phase-2d-silver-migration-and-factory-impl-spec.md §5.6
-- Seed: backend/python/smartbi/database/migrations/V20260511_02__t6_6_etl_seed_14_real_chains.sql
-- Audit: docs/qa-audits/2026-05-12-restaurant-data-readiness-prod-evidence.md

INSERT INTO factories (
    id, name, type, level,
    is_active, manually_verified, ai_weekly_quota,
    created_at, updated_at
) VALUES
    ('R_DONGMENKOU_REAL',     '东门口',          'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_HONGDEJI_REAL',       '鸿德记',          'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_HUOGUO_GENERIC_REAL', '火锅 (generic)',  'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_ILTEATRO_REAL',       'IL TEATRO 西餐',  'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_JINCHUAN_HG_REAL',    '锦川火锅',        'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_JINRINIUSHI_REAL',    '今日牛事',        'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_LINJIAYAN_REAL',      '邻家宴',          'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_QINGHUAJIAO_REAL',    '青花椒',          'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_SHANGMA_HG_REAL',     '上马火锅',        'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_XIMAXIANG_REAL',      '唏嘛香 牛肉面',   'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_XINBASHU_REAL',       '鑫巴蜀',          'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_YONGHE_REAL',         '永和豆浆',        'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_YOUZIYOUWEI_REAL',    '有滋有味',        'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_YUJIUJING_REAL',      '御九井 日料',     'RESTAURANT', 0, true, false, 1000, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
