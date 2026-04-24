-- Add optimistic lock version to sales_orders and purchase_orders
-- Extends Customer/Supplier pattern (V20260424_05 / V20260424_06)
-- SO and PO are high-conflict (multi-role workflow: salesperson / finance / warehouse / shipping)
--
-- Note: factory_equipment already has a version column (Integer, pre-existing from
-- FactoryEquipment entity). Service-level explicit compare handles the Long/Integer
-- type mismatch via longValue() comparison.

ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN sales_orders.version IS 'Optimistic lock version (Hibernate @Version). Mismatch → 409 Conflict.';
COMMENT ON COLUMN purchase_orders.version IS 'Optimistic lock version (Hibernate @Version). Mismatch → 409 Conflict.';
