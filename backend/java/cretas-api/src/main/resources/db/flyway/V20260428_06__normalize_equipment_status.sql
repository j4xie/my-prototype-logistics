-- R42 BUG-16 fix: factory_equipment.status mixed semantics.
-- DB has BOTH lowercase enum names (running/idle/maintenance) AND frontend values
-- (active/inactive) — confusing reports + inconsistent grouping.
--
-- F001 prod audit:
--   running: 6, idle: 7, maintenance: 1  ← lowercase enum names (canonical)
--   active: 1, inactive: 1               ← frontend values (outliers)
--
-- Normalize on lowercase enum names since 14/16 already match. EquipmentStatus
-- enum still serializes via @JsonValue to "active"/"inactive" for FE consumption.

UPDATE factory_equipment SET status = 'running' WHERE status = 'active';
UPDATE factory_equipment SET status = 'idle'    WHERE status = 'inactive';
UPDATE factory_equipment SET status = 'offline' WHERE status = 'scrapped';
UPDATE factory_equipment SET status = 'fault'   WHERE status = 'FAULT';

-- After this migration, status column should only contain:
--   running / idle / maintenance / fault / offline
