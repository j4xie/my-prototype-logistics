-- U-MARKER-1 (Sprint 4 Wave 2 Chat L) — row marker color column.
--
-- VARCHAR(16) NULL. UI-only visual marker, decoupled from business status.
-- Allowed values (validated controller-side, not DB CHECK): red/orange/yellow/green/blue.
-- NULL means "no marker" — default state.

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS marker_color VARCHAR(16) NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS marker_color VARCHAR(16) NULL;

COMMENT ON COLUMN sales_orders.marker_color IS 'U-MARKER-1 UI 行标颜色 (red/orange/yellow/green/blue/null) — 不影响业务状态';
COMMENT ON COLUMN purchase_orders.marker_color IS 'U-MARKER-1 UI 行标颜色 (red/orange/yellow/green/blue/null) — 不影响业务状态';
