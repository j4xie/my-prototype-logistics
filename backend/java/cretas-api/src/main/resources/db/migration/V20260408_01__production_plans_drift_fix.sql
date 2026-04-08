-- W2 P0-5 E2E 验证时暴露的 production_plans schema 漂移
-- (entity 有字段, 但历史 DB 缺列)
--
-- 发现环境: 2026-04-08 test(10011) 和 prod(10010) 都缺部分列
-- 已在两环境手工应用, 此 migration 用于未来干净环境或新搭环境.

ALTER TABLE production_plans
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS batch_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_workers INTEGER,
  ADD COLUMN IF NOT EXISTS process_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS suggested_production_line_id VARCHAR(36);
