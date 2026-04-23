-- Round 7 W-01 fix: shipment UI form submitted vehicle/driver/phone but entity had no columns,
-- causing fields to be silently dropped. Add nullable columns so create path persists them
-- and existing detail view template (which reads detailRow.vehicleNumber/driverName/driverPhone)
-- starts showing real data.

ALTER TABLE shipment_records
  ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS driver_name    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS driver_phone   VARCHAR(30);
