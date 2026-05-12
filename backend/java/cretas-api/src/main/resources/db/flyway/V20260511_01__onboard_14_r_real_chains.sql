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
-- P0 fix 2026-05-11 (chat1, post-PR #377):
--   R_YUJIUJING_REAL name disambiguated from '御九井 日料' → '御九井 日料 (真实)'
--   to avoid collision with existing R_YJJ_DEMO row in cretas_prod_db.factories
--   (UNIQUE constraint ukrjab5dbtnnpf6t623u4t24ikq on factories.name).
--   The initial migration apply crashed Java prod 10010 + test 10011 with
--   `duplicate key value violates unique constraint`. Sister-sweep confirmed
--   this was the only exact-string conflict among the 14 R_*_REAL roster
--   (chat4 audit + chat1 P0 verification via prod psql query 2026-05-11).
--   Flyway history was clean post-rollback (PostgreSQL transactional
--   semantics rolled both the row INSERT and the history-table INSERT),
--   so no `flyway repair` is required — Java picks up the corrected
--   migration on next deploy.
--
-- P0v2 fix 2026-05-11 (chat1, post-PR #395):
--   R_SHANGMA_HG_REAL name disambiguated from '上马火锅' → '上马火锅 (真实)'
--   to avoid collision with legacy R_SMH test_db seed (cretas_db). PR #395
--   fixed R_YUJIUJING_REAL ↔ R_YJJ_DEMO prod_db collision; this fix handles
--   the test_db symmetric case + applies prod_db reconciliation via
--   V20260512_01 sync migration. FlywayConfig.java auto-repair handles
--   checksum lock for prod_db (V20260511_01 success=true with checksum
--   -1849470695). Plan A long-term: unique-from-day-1 names for any new
--   env (stage, dev, future test rebuild) — no manual delete-and-forget.
--   Subagent A sweep 2026-05-11: only this 1 remaining exact conflict.
--
-- Spec: docs/superpowers/specs/2026-05-11-phase-2d-silver-migration-and-factory-impl-spec.md §5.6
-- Seed: backend/python/smartbi/database/migrations/V20260511_02__t6_6_etl_seed_14_real_chains.sql
-- Audit: docs/qa-audits/2026-05-12-restaurant-data-readiness-prod-evidence.md
-- Prior fix: PR #394 (file moved from migration-pg-converted/ → db/flyway/)

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
    -- P0v2 fix: disambiguated from '上马火锅' (collided with legacy R_SMH in test_db).
    ('R_SHANGMA_HG_REAL',     '上马火锅 (真实)',  'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_XIMAXIANG_REAL',      '唏嘛香 牛肉面',   'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_XINBASHU_REAL',       '鑫巴蜀',          'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_YONGHE_REAL',         '永和豆浆',        'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    ('R_YOUZIYOUWEI_REAL',    '有滋有味',        'RESTAURANT', 0, true, false, 1000, NOW(), NOW()),
    -- P0 fix: disambiguated from '御九井 日料' (collided with R_YJJ_DEMO).
    ('R_YUJIUJING_REAL',      '御九井 日料 (真实)', 'RESTAURANT', 0, true, false, 1000, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
