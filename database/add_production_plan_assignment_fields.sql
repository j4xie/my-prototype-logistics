-- 生产计划扩展：添加产线建议、预计工人数、指派主管字段
-- 2026-02-26

ALTER TABLE production_plans
  ADD COLUMN IF NOT EXISTS suggested_production_line_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS estimated_workers INTEGER NULL,
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id BIGINT NULL;

COMMENT ON COLUMN production_plans.suggested_production_line_id IS '建议产线ID';
COMMENT ON COLUMN production_plans.estimated_workers IS '预计工人数';
COMMENT ON COLUMN production_plans.assigned_supervisor_id IS '指派车间主管ID';
