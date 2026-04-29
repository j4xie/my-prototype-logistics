-- Harden factory_equipment.version so Hibernate @Version never NPE's again.
--
-- 2026-04-17 prod NPE: EquipmentController.record-maintenance triggered an
-- auto-flush on FactoryEquipment with version=NULL (14/22 rows pre-existed
-- the @Version column). Hibernate's VersionGeneration.generate() crashes on
-- NULL with "Cannot invoke Integer.intValue() because current is null".
--
-- Idempotent: UPDATE is a no-op on rows already set to 1 during incident
-- response (which both prod and test DBs were).

UPDATE factory_equipment SET version = 1 WHERE version IS NULL;

ALTER TABLE factory_equipment ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE factory_equipment ALTER COLUMN version SET NOT NULL;
