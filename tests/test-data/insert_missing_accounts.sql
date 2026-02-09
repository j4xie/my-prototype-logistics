-- Insert missing test accounts: dispatcher1, platform_admin
-- Password: 123456 (BCrypt hash)

-- Create PLATFORM factory if not exists
INSERT INTO factories (id, name, industry, address, contact_name, contact_phone, is_active, ai_weekly_quota, manually_verified, created_at, updated_at)
VALUES ('PLATFORM', 'Platform Admin', 'platform', 'Platform', 'Platform', '10000000000', true, 100, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- dispatcher1
INSERT INTO users (factory_id, username, password_hash, email, full_name, phone, is_active, role_code, department, position, created_at, updated_at)
VALUES ('F001', 'dispatcher1', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'dispatcher1@factory.com', 'Dispatcher Wang', '13900001001', true, 'dispatcher', 'Production', 'Dispatcher', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET is_active = true, password_hash = EXCLUDED.password_hash;

-- platform_admin
INSERT INTO users (factory_id, username, password_hash, email, full_name, phone, is_active, role_code, position, created_at, updated_at)
VALUES ('PLATFORM', 'platform_admin', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'platform_admin@platform.com', 'Platform Admin', '13900000003', true, 'platform_admin', 'platform_admin', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET is_active = true, password_hash = EXCLUDED.password_hash;

-- Verify
SELECT id, username, is_active, role_code, factory_id FROM users WHERE username IN ('dispatcher1', 'platform_admin');
