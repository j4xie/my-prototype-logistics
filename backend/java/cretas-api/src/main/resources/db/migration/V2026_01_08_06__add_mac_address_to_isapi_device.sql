-- Add mac_address column to isapi_devices table
ALTER TABLE isapi_devices ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17) DEFAULT NULL COMMENT 'Device MAC address';
