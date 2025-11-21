-- 创建标准测试账号
-- 所有账号密码: 123456
-- BCrypt hash: $2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa

USE cretas_db;

-- 创建平台级工厂（如果不存在）
INSERT INTO factories (id, name, industry, address, contact_name, contact_phone, is_active, created_at, updated_at)
VALUES
  ('PLATFORM', '平台管理', '平台', '平台地址', '平台', '10000000000', 1, NOW(), NOW()),
  ('CRETAS_2024_001', '白垩纪食品工厂', '食品加工', '上海市浦东新区', '张三', '13800138000', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 【平台用户】
INSERT INTO users (factory_id, username, password_hash, email, full_name, phone, is_active, role_code, position, created_at, updated_at)
VALUES
  ('PLATFORM', 'admin', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'admin@platform.com', '平台管理员', '13900000001', 1, 'factory_super_admin', 'admin', NOW(), NOW()),
  ('PLATFORM', 'developer', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'developer@platform.com', '开发者', '13900000002', 1, 'factory_super_admin', 'developer', NOW(), NOW()),
  ('PLATFORM', 'platform_admin', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'platform_admin@platform.com', '平台超管', '13900000003', 1, 'factory_super_admin', 'platform_admin', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  email = VALUES(email),
  is_active = 1,
  updated_at = NOW();

-- 【工厂用户】
INSERT INTO users (factory_id, username, password_hash, email, full_name, phone, is_active, role_code, department, position, created_at, updated_at)
VALUES
  ('CRETAS_2024_001', 'perm_admin', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'perm_admin@factory.com', '权限管理员', '13900000011', 1, 'permission_admin', 'management', 'perm_admin', NOW(), NOW()),
  ('CRETAS_2024_001', 'proc_admin', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'proc_admin@factory.com', '加工部管理员', '13900000012', 1, 'department_admin', 'processing', 'proc_admin', NOW(), NOW()),
  ('CRETAS_2024_001', 'farm_admin', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'farm_admin@factory.com', '养殖部管理员', '13900000013', 1, 'department_admin', 'farming', 'farm_admin', NOW(), NOW()),
  ('CRETAS_2024_001', 'logi_admin', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'logi_admin@factory.com', '物流部管理员', '13900000014', 1, 'department_admin', 'logistics', 'logi_admin', NOW(), NOW()),
  ('CRETAS_2024_001', 'proc_user', '$2b$10$ptRlNzr93WdvM2AoF546QeA1XtitkHijAG73G4cx6jqSqMtVU5LPa', 'proc_user@factory.com', '加工操作员', '13900000015', 1, 'operator', 'processing', 'proc_user', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  email = VALUES(email),
  is_active = 1,
  department = VALUES(department),
  updated_at = NOW();

-- 验证创建的账号
SELECT '=== 平台用户 ===' AS info;
SELECT id, username, role_code, position, factory_id, is_active
FROM users
WHERE username IN ('admin', 'developer', 'platform_admin')
ORDER BY id;

SELECT '=== 工厂用户 ===' AS info;
SELECT id, username, role_code, department, factory_id, is_active
FROM users
WHERE username IN ('perm_admin', 'proc_admin', 'farm_admin', 'logi_admin', 'proc_user')
ORDER BY id;

SELECT '所有测试账号创建完成！密码: 123456' AS status;
