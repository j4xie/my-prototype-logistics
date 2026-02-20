-- 插入3个工厂数据
-- 根据factories表结构：必填字段 id, name, created_at, updated_at, ai_weekly_quota, is_active, manually_verified

USE cretas;  -- 或 cretas_db，根据实际数据库名

-- ===== 插入3个工厂 =====
INSERT INTO factories (
    id, 
    name, 
    address, 
    contact_name, 
    contact_phone, 
    contact_email, 
    ai_weekly_quota, 
    is_active, 
    manually_verified, 
    created_at, 
    updated_at
) VALUES
-- 工厂1: F001 (测试工厂)
('F001', '测试工厂', '北京市朝阳区建国路XX号', '张经理', '010-12345678', 'zhang@test.com', 20, 1, 0, NOW(), NOW()),

-- 工厂2: F002 (白垩纪水产加工厂)
('F002', '白垩纪水产加工厂', '上海市浦东新区XX路XX号', '李经理', '021-87654321', 'li@cretas.com', 30, 1, 0, NOW(), NOW()),

-- 工厂3: F003 (优质食品加工厂)
('F003', '优质食品加工厂', '广州市天河区XX大道XX号', '王经理', '020-11223344', 'wang@food.com', 25, 1, 0, NOW(), NOW());

-- ===== 验证插入结果 =====
SELECT 'Factories' AS Category, COUNT(*) AS Count FROM factories WHERE deleted_at IS NULL;

-- ===== 查看插入的工厂详情 =====
SELECT id, name, address, contact_name, contact_phone, ai_weekly_quota, is_active FROM factories WHERE deleted_at IS NULL ORDER BY id;

SELECT '✅ 工厂数据插入完成！' AS Status;


