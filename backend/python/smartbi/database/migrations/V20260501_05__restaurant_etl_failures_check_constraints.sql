-- V20260501_05__restaurant_etl_failures_check_constraints.sql
-- Add CHECK constraints to restaurant_etl_failures per codebase convention.
-- Pattern reference: V20260426_01__entity_resolution_b_baseline.sql (status / entity_type / admin_action all CHECK-constrained).
-- BUG-11 (quality_inspections.result) showed real cost of missing constraints — 6 distinct values accumulated
-- where 4 canonical were expected. Adding now while table is empty avoids future drift.

ALTER TABLE restaurant_etl_failures
  ADD CONSTRAINT restaurant_etl_failures_status_check
  CHECK (status IN ('failed', 'retrying', 'failed_final'));

ALTER TABLE restaurant_etl_failures
  ADD CONSTRAINT restaurant_etl_failures_attempt_check
  CHECK (attempt BETWEEN 1 AND 3);
