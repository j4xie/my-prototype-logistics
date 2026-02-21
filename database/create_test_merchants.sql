-- =============================================
-- 测试商家账号: 张记餐饮 (F002) + 绿源食品加工 (F003) + 鲜味零售 (F004)
-- 运行方式: psql -h localhost -U cretas_user -d cretas_db -f create_test_merchants.sql
-- 密码统一为: 123456
-- BCrypt Hash: $2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse
-- =============================================

BEGIN;

-- =============================================
-- 1. 工厂记录 (factories)
-- =============================================

-- 工厂1: 张记餐饮 (F002) — 餐饮行业
INSERT INTO factories (id, name, industry, type, address, contact_name, contact_phone, contact_email, ai_weekly_quota, is_active, manually_verified, created_at, updated_at)
VALUES ('F002', '张记餐饮管理有限公司', '餐饮', 'RESTAURANT', '上海市黄浦区南京东路100号', '张老板', '13800200001', 'admin@zhangjicatering.com', 50, true, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    industry = EXCLUDED.industry,
    type = EXCLUDED.type,
    address = EXCLUDED.address,
    contact_name = EXCLUDED.contact_name,
    contact_phone = EXCLUDED.contact_phone,
    updated_at = NOW();

-- 工厂2: 绿源食品加工 (F003) — 食品加工行业
INSERT INTO factories (id, name, industry, type, address, contact_name, contact_phone, contact_email, ai_weekly_quota, is_active, manually_verified, created_at, updated_at)
VALUES ('F003', '绿源食品加工有限公司', '食品加工', 'FACTORY', '江苏省苏州市工业园区星湖街328号', '李厂长', '13800300001', 'admin@lyfoods.com', 50, true, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    industry = EXCLUDED.industry,
    type = EXCLUDED.type,
    address = EXCLUDED.address,
    contact_name = EXCLUDED.contact_name,
    contact_phone = EXCLUDED.contact_phone,
    updated_at = NOW();

-- 工厂3: 鲜味零售 (F004) — 零售行业
INSERT INTO factories (id, name, industry, type, address, contact_name, contact_phone, contact_email, ai_weekly_quota, is_active, manually_verified, created_at, updated_at)
VALUES ('F004', '鲜味零售连锁有限公司', '零售', 'FACTORY', '广东省深圳市南山区科技园南路12号', '王总', '13800400001', 'admin@xianweiretail.com', 50, true, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    industry = EXCLUDED.industry,
    type = EXCLUDED.type,
    address = EXCLUDED.address,
    contact_name = EXCLUDED.contact_name,
    contact_phone = EXCLUDED.contact_phone,
    updated_at = NOW();

-- =============================================
-- 2. 工厂用户 (users)
-- 密码: 123456  BCrypt: $2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse
-- =============================================

DO $$
DECLARE
    v_pwd_hash TEXT := '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse';
BEGIN
    -- 尝试复用 factory_admin1 的密码哈希（与硬编码值相同，但保险起见）
    SELECT password_hash INTO v_pwd_hash FROM users WHERE username = 'factory_admin1' LIMIT 1;
    IF v_pwd_hash IS NULL THEN
        v_pwd_hash := '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse';
    END IF;

    -- =============================================
    -- F002 张记餐饮 用户
    -- =============================================

    -- 工厂超管: restaurant_admin1
    INSERT INTO users (factory_id, username, password_hash, full_name, phone, department, position, role_code, is_active, level, platform_type, created_at, updated_at)
    VALUES ('F002', 'restaurant_admin1', v_pwd_hash, '张记管理员', '13800200001', 'management', '工厂总监', 'factory_super_admin', true, 0, 'web,mobile', NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET
        factory_id = EXCLUDED.factory_id,
        password_hash = EXCLUDED.password_hash,
        role_code = EXCLUDED.role_code,
        is_active = true,
        updated_at = NOW();

    -- 财务主管: restaurant_fm1
    INSERT INTO users (factory_id, username, password_hash, full_name, phone, department, position, role_code, is_active, level, platform_type, created_at, updated_at)
    VALUES ('F002', 'restaurant_fm1', v_pwd_hash, '张记财务主管', '13800200002', 'management', '财务主管', 'finance_manager', true, 10, 'web,mobile', NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET
        factory_id = EXCLUDED.factory_id,
        password_hash = EXCLUDED.password_hash,
        role_code = EXCLUDED.role_code,
        is_active = true,
        updated_at = NOW();

    -- =============================================
    -- F003 绿源食品加工 用户
    -- =============================================

    -- 工厂超管: food_admin1
    INSERT INTO users (factory_id, username, password_hash, full_name, phone, department, position, role_code, is_active, level, platform_type, created_at, updated_at)
    VALUES ('F003', 'food_admin1', v_pwd_hash, '绿源管理员', '13800300001', 'management', '工厂总监', 'factory_super_admin', true, 0, 'web,mobile', NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET
        factory_id = EXCLUDED.factory_id,
        password_hash = EXCLUDED.password_hash,
        role_code = EXCLUDED.role_code,
        is_active = true,
        updated_at = NOW();

    -- 财务主管: food_fm1
    INSERT INTO users (factory_id, username, password_hash, full_name, phone, department, position, role_code, is_active, level, platform_type, created_at, updated_at)
    VALUES ('F003', 'food_fm1', v_pwd_hash, '绿源财务主管', '13800300002', 'management', '财务主管', 'finance_manager', true, 10, 'web,mobile', NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET
        factory_id = EXCLUDED.factory_id,
        password_hash = EXCLUDED.password_hash,
        role_code = EXCLUDED.role_code,
        is_active = true,
        updated_at = NOW();

    -- =============================================
    -- F004 鲜味零售 用户
    -- =============================================

    -- 工厂超管: retail_admin1
    INSERT INTO users (factory_id, username, password_hash, full_name, phone, department, position, role_code, is_active, level, platform_type, created_at, updated_at)
    VALUES ('F004', 'retail_admin1', v_pwd_hash, '鲜味零售管理员', '13800400001', 'management', '工厂总监', 'factory_super_admin', true, 0, 'web,mobile', NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET
        factory_id = EXCLUDED.factory_id,
        password_hash = EXCLUDED.password_hash,
        role_code = EXCLUDED.role_code,
        is_active = true,
        updated_at = NOW();

    -- 财务主管: retail_fm1
    INSERT INTO users (factory_id, username, password_hash, full_name, phone, department, position, role_code, is_active, level, platform_type, created_at, updated_at)
    VALUES ('F004', 'retail_fm1', v_pwd_hash, '鲜味零售财务主管', '13800400002', 'management', '财务主管', 'finance_manager', true, 10, 'web,mobile', NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET
        factory_id = EXCLUDED.factory_id,
        password_hash = EXCLUDED.password_hash,
        role_code = EXCLUDED.role_code,
        is_active = true,
        updated_at = NOW();

    RAISE NOTICE '创建完成: F002/F003/F004 工厂及用户';
END $$;

COMMIT;

-- =============================================
-- 验证
-- =============================================
SELECT '=== 测试商家验证 ===' AS info;
SELECT id, name, industry, is_active FROM factories WHERE id IN ('F002', 'F003', 'F004') ORDER BY id;
SELECT id, username, full_name, role_code, factory_id, is_active
FROM users
WHERE username IN ('restaurant_admin1', 'restaurant_fm1', 'food_admin1', 'food_fm1', 'retail_admin1', 'retail_fm1')
ORDER BY factory_id, role_code;
