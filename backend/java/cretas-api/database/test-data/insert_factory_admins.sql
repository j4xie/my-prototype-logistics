-- 为3个工厂创建各自的管理员用户
-- 密码统一为: 123456 (BCrypt hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy)
-- 如果需要不同的密码hash，请使用后端API创建用户或使用密码重置功能

USE cretas;  -- 或 cretas_db，根据实际数据库名

-- ===== 插入3个工厂的管理员用户 =====
INSERT INTO users (
    username,
    password_hash,
    factory_id,
    full_name,
    department,
    position,
    is_active,
    created_at,
    updated_at
) VALUES
-- F001工厂管理员
('admin_f001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'F001', 'F001工厂管理员', 'management', '工厂管理员', 1, NOW(), NOW()),

-- F002工厂管理员
('admin_f002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'F002', 'F002工厂管理员', 'management', '工厂管理员', 1, NOW(), NOW()),

-- F003工厂管理员
('admin_f003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'F003', 'F003工厂管理员', 'management', '工厂管理员', 1, NOW(), NOW());

-- ===== 验证插入结果 =====
SELECT 'Factory Admins' AS Category, COUNT(*) AS Count FROM users WHERE username LIKE 'admin_f%' AND deleted_at IS NULL;

-- ===== 查看插入的管理员用户 =====
SELECT id, username, factory_id, full_name, department, position, is_active FROM users WHERE username LIKE 'admin_f%' AND deleted_at IS NULL ORDER BY factory_id;

SELECT '✅ 工厂管理员用户创建完成！' AS Status;
SELECT '默认密码: 123456' AS PasswordInfo;


