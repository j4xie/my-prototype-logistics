-- 修复 production_batches.production_plan_id 类型: INTEGER → VARCHAR(191)
-- 原因: production_plans.id 是 VARCHAR(191) (如 "PLAN-1772146177247-117992E7")，
--       Integer 无法存储字符串类型的计划ID
-- 2026-02-26

ALTER TABLE production_batches
  ALTER COLUMN production_plan_id TYPE VARCHAR(191) USING production_plan_id::VARCHAR;
