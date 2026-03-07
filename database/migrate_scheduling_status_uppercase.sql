-- Migration: Convert scheduling status values from lowercase to UPPER_CASE
-- Related to: LineSchedule.ScheduleStatus and SchedulingPlan.PlanStatus enum changes
-- Date: 2026-03-02

-- Migrate scheduling_plans.status
UPDATE scheduling_plans SET status = 'DRAFT' WHERE status = 'draft';
UPDATE scheduling_plans SET status = 'CONFIRMED' WHERE status = 'confirmed';
UPDATE scheduling_plans SET status = 'IN_PROGRESS' WHERE status = 'in_progress';
UPDATE scheduling_plans SET status = 'COMPLETED' WHERE status = 'completed';
UPDATE scheduling_plans SET status = 'CANCELLED' WHERE status = 'cancelled';

-- Migrate line_schedules.status
UPDATE line_schedules SET status = 'PENDING' WHERE status = 'pending';
UPDATE line_schedules SET status = 'IN_PROGRESS' WHERE status = 'in_progress';
UPDATE line_schedules SET status = 'COMPLETED' WHERE status = 'completed';
UPDATE line_schedules SET status = 'DELAYED' WHERE status = 'delayed';
UPDATE line_schedules SET status = 'CANCELLED' WHERE status = 'cancelled';

-- Migrate worker_assignments.status (if applicable)
UPDATE worker_assignments SET status = 'ASSIGNED' WHERE status = 'assigned';
UPDATE worker_assignments SET status = 'CHECKED_IN' WHERE status = 'checked_in';
UPDATE worker_assignments SET status = 'CHECKED_OUT' WHERE status = 'checked_out';

-- Migrate production_lines.status (if applicable)
UPDATE production_lines SET status = 'ACTIVE' WHERE status = 'active';
UPDATE production_lines SET status = 'MAINTENANCE' WHERE status = 'maintenance';
UPDATE production_lines SET status = 'INACTIVE' WHERE status = 'inactive';
