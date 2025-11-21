-- Simple Test Users for Phase 1 Authentication Testing
-- Password for ALL test users: Test123!
-- BCrypt hash (verified): $2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay

USE cretas_db;

-- Use existing factory or create test factory
INSERT INTO factories (id, name, industry, address, contact_name, contact_phone, is_active, created_at, updated_at)
VALUES ('test-factory-001', 'E2E测试工厂', '食品加工', '测试地址', '测试联系人', '13800000000', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert test users for each role (5 roles in the system)
-- Password: Test123! (BCrypt: $2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay)

INSERT INTO users (factory_id, username, password_hash, email, full_name, phone, is_active, role_code, created_at, updated_at)
VALUES
  ('test-factory-001', 'test-super-admin', '$2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay', 'test-super-admin@test.com', '测试超级管理员', '13900000001', 1, 'factory_super_admin', NOW(), NOW()),
  ('test-factory-001', 'test-perm-admin', '$2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay', 'test-perm-admin@test.com', '测试权限管理员', '13900000002', 1, 'permission_admin', NOW(), NOW()),
  ('test-factory-001', 'test-dept-admin', '$2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay', 'test-dept-admin@test.com', '测试部门管理员', '13900000003', 1, 'department_admin', NOW(), NOW()),
  ('test-factory-001', 'test-operator', '$2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay', 'test-operator@test.com', '测试操作员', '13900000004', 1, 'operator', NOW(), NOW()),
  ('test-factory-001', 'test-viewer', '$2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay', 'test-viewer@test.com', '测试查看者', '13900000005', 1, 'viewer', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  email = VALUES(email),
  is_active = VALUES(is_active),
  updated_at = NOW();

-- Create second factory for cross-factory permission testing
INSERT INTO factories (id, name, industry, address, contact_name, contact_phone, is_active, created_at, updated_at)
VALUES ('test-factory-002', 'E2E测试工厂B', '食品加工', '测试地址B', '测试联系人B', '13800000001', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- User in factory B for permission isolation testing
INSERT INTO users (factory_id, username, password_hash, email, full_name, phone, is_active, role_code, created_at, updated_at)
VALUES
  ('test-factory-002', 'test-admin-factory-b', '$2b$10$b449zHmdziZFlWsqAgVqHuG6PF5fLXExvO6d6mJw0u4Q/CEZYX7Ay', 'test-admin-b@test.com', '测试工厂B管理员', '13900000006', 1, 'factory_super_admin', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  email = VALUES(email),
  is_active = VALUES(is_active),
  updated_at = NOW();

-- Verify test users
SELECT '=== Test Users Created/Updated ===' AS info;
SELECT id, username, role_code, factory_id, is_active, full_name
FROM users
WHERE username LIKE 'test-%'
ORDER BY factory_id, role_code;

SELECT '=== Test Factories ===' AS info;
SELECT id, name, is_active
FROM factories
WHERE id LIKE 'test-factory-%';

SELECT 'Test users ready! Password for all: Test123!' AS status;
