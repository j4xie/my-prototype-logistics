-- W-07 fix (Round 9): restore planned_date column on production_plans.
--
-- Background: entity/mapper had `planned_date` commented out with "数据库表中没有此字段"
-- but CreateProductionPlanRequest still carries @NotNull plannedDate + FE form
-- marks it required. Result: user fills 计划日期 → POST 200 "创建成功" → response
-- shows plannedDate=null (silent drop) + list/detail will never render user's input.
--
-- Fix: add the column back as nullable (legacy rows remain valid; toDTO falls
-- back to startTime-derived date for pre-fix rows). Entity @Column(name="planned_date")
-- uncommented + mapper toEntity / updateEntity null-guard branches restored.
--
-- Schema precedent: materialBatch V20260424_01 used the same "ADD COLUMN IF NOT EXISTS"
-- idempotent pattern; Flyway metadata lock prevents concurrent-instance races.

ALTER TABLE production_plans
  ADD COLUMN IF NOT EXISTS planned_date DATE;

CREATE INDEX IF NOT EXISTS idx_plan_date ON production_plans (planned_date);
