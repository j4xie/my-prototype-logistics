-- =====================================================
-- 最小化测试数据初始化脚本
-- 适用于 creats-test 新数据库
-- =====================================================

-- 清空现有数据（如果需要重新初始化）
-- TRUNCATE TABLE users;
-- TRUNCATE TABLE factories;

-- =====================================================
-- 1. 工厂 (factories)
-- =====================================================
INSERT IGNORE INTO factories (id, name, address, is_active, ai_weekly_quota, manually_verified, confidence, created_at, updated_at) VALUES
('F001', '测试工厂一', '上海市浦东新区张江高科技园区', 1, 100, 1, 0.95, NOW(), NOW()),
('F002', '测试工厂二', '江苏省苏州市工业园区', 1, 100, 1, 0.90, NOW(), NOW()),
('F003', '测试工厂三', '浙江省杭州市萧山区', 1, 100, 1, 0.85, NOW(), NOW());

-- =====================================================
-- 2. 用户 (users)
-- 密码都是 123456，BCrypt 哈希值 (已验证正确)
-- =====================================================
INSERT IGNORE INTO users (username, password_hash, full_name, role_code, factory_id, is_active, phone, department, position, created_at, updated_at) VALUES
-- F001 用户
('factory_admin1', '$2a$10$.Bh9K7HfMGY48nTtq4icoOuoMEZsMY0k2tS13fcpnZAgJPrDdQUOy', 'F001工厂主管', 'factory_super_admin', 'F001', 1, '13900000101', 'management', '主管', NOW(), NOW()),
('dept_admin1', '$2a$10$.Bh9K7HfMGY48nTtq4icoOuoMEZsMY0k2tS13fcpnZAgJPrDdQUOy', 'F001部门主管', 'department_admin', 'F001', 1, '13900000102', 'production', '部门主管', NOW(), NOW()),
('operator1', '$2a$10$.Bh9K7HfMGY48nTtq4icoOuoMEZsMY0k2tS13fcpnZAgJPrDdQUOy', 'F001操作员', 'operator', 'F001', 1, '13900000103', 'production', '操作员', NOW(), NOW()),
-- F002 用户
('factory_admin2', '$2a$10$.Bh9K7HfMGY48nTtq4icoOuoMEZsMY0k2tS13fcpnZAgJPrDdQUOy', 'F002工厂主管', 'factory_super_admin', 'F002', 1, '13900000201', 'management', '主管', NOW(), NOW()),
-- F003 用户
('factory_admin3', '$2a$10$.Bh9K7HfMGY48nTtq4icoOuoMEZsMY0k2tS13fcpnZAgJPrDdQUOy', 'F003工厂主管', 'factory_super_admin', 'F003', 1, '13900000301', 'management', '主管', NOW(), NOW());

-- =====================================================
-- 3. 平台管理员 (platform_admins)
-- =====================================================
INSERT IGNORE INTO platform_admins (username, password_hash, real_name, platform_role, status, created_at, updated_at) VALUES
('platform_admin', '$2a$10$.Bh9K7HfMGY48nTtq4icoOuoMEZsMY0k2tS13fcpnZAgJPrDdQUOy', '平台管理员', 'super_admin', 'active', NOW(), NOW());

-- =====================================================
-- 4. 原材料类型 (raw_material_types)
-- =====================================================
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, unit, description, is_active, created_at, updated_at) VALUES
('RMT-F001-001', 'F001', '带鱼', 'DY001', 'kg', '新鲜带鱼', 1, NOW(), NOW()),
('RMT-F001-002', 'F001', '黄鱼', 'HY001', 'kg', '新鲜黄鱼', 1, NOW(), NOW()),
('RMT-F001-003', 'F001', '墨鱼', 'MY001', 'kg', '新鲜墨鱼', 1, NOW(), NOW());

-- =====================================================
-- 5. 产品类型 (product_types)
-- =====================================================
INSERT IGNORE INTO product_types (id, factory_id, name, code, sku, description, is_active, created_at, updated_at) VALUES
('PT-F001-001', 'F001', '带鱼段', 'DYD001', 'SKU-F001-0001', '切段带鱼', 1, NOW(), NOW()),
('PT-F001-002', 'F001', '黄鱼片', 'HYP001', 'SKU-F001-0002', '黄鱼切片', 1, NOW(), NOW());

-- =====================================================
-- 6. 供应商 (suppliers)
-- =====================================================
INSERT IGNORE INTO suppliers (id, factory_id, name, code, supplier_code, contact_person, contact_phone, address, is_active, created_at, updated_at) VALUES
('SUP-F001-001', 'F001', '东海水产批发', 'SUP001', 'SUP001', '陈老板', '13600136001', '浙江省舟山市定海区', 1, NOW(), NOW()),
('SUP-F001-002', 'F001', '南海渔业公司', 'SUP002', 'SUP002', '林老板', '13600136002', '广东省湛江市', 1, NOW(), NOW());

-- =====================================================
-- 7. 客户 (customers)
-- =====================================================
INSERT IGNORE INTO customers (id, factory_id, name, code, customer_code, contact_person, contact_phone, address, is_active, created_at, updated_at) VALUES
('CUS-F001-001', 'F001', '永辉超市', 'CUS001', 'CUS001', '王经理', '13700137001', '上海市浦东新区', 1, NOW(), NOW()),
('CUS-F001-002', 'F001', '盒马鲜生', 'CUS002', 'CUS002', '李经理', '13700137002', '上海市静安区', 1, NOW(), NOW());

SELECT '初始化完成！' AS message;
SELECT COUNT(*) AS factory_count FROM factories;
SELECT COUNT(*) AS user_count FROM users;
