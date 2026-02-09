-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_08_06__add_mac_address_to_isapi_device.sql
-- Conversion date: 2026-01-26 18:48:03
-- ============================================

-- Add mac_address column to isapi_devices table
ALTER TABLE isapi_devices ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17) DEFAULT NULL COMMENT 'Device MAC address';
