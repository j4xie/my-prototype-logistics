-- Extend V20260420_01 fix to sibling tables with @Version columns that
-- have the same legacy NULL problem.
--
-- Discovered during R18 QA §19 deep test (2026-04-17): POST
-- /equipment/{id}/maintenance crashed with the same Integer.intValue NPE
-- before factory_equipment was backfilled. The maintenance POST path touches
-- multiple entities during auto-flush; any of them with NULL version would
-- trigger the crash.
--
-- Baseline NULL counts measured on test DB pre-fix:
--   equipment_maintenance       135/135 rows
--   equipment_alerts           3560/4968 rows
--   batch_equipment_usage         3/31 rows
--
-- Idempotent — UPDATE is no-op once rows are set, ALTER re-applies cleanly.

UPDATE equipment_maintenance SET version = 1 WHERE version IS NULL;
ALTER TABLE equipment_maintenance ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE equipment_maintenance ALTER COLUMN version SET NOT NULL;

UPDATE equipment_alerts SET version = 1 WHERE version IS NULL;
ALTER TABLE equipment_alerts ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE equipment_alerts ALTER COLUMN version SET NOT NULL;

UPDATE batch_equipment_usage SET version = 1 WHERE version IS NULL;
ALTER TABLE batch_equipment_usage ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE batch_equipment_usage ALTER COLUMN version SET NOT NULL;
