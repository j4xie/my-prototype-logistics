-- Round 8 Optimization: Add missing indexes for high-frequency tables
-- Date: 2026-03-05
-- Applied to cretas_prod_db on 2026-03-05

-- TimeClockRecord: attendance queries by employee + date
CREATE INDEX IF NOT EXISTS idx_time_clock_factory ON time_clock_records (factory_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_user_date ON time_clock_records (user_id, clock_date);

-- LineSchedule: scheduling queries by plan + production line
CREATE INDEX IF NOT EXISTS idx_line_schedule_plan ON line_schedules (plan_id);
CREATE INDEX IF NOT EXISTS idx_line_schedule_prod_line ON line_schedules (production_line_id);

-- WorkerAssignment: queries by schedule + user
CREATE INDEX IF NOT EXISTS idx_worker_assignment_schedule ON worker_assignments (schedule_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignment_user ON worker_assignments (user_id);

-- SchedulingPlan: queries by factory + date
CREATE INDEX IF NOT EXISTS idx_scheduling_plan_factory ON scheduling_plans (factory_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_plan_date ON scheduling_plans (factory_id, plan_date);

-- Partial indexes for soft-delete filter on large tables
CREATE INDEX IF NOT EXISTS idx_material_batches_factory_active
    ON material_batches (factory_id) WHERE deleted_at IS NULL;
