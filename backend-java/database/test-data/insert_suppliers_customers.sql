-- 为3个工厂创建供应商和客户数据
-- 使用每个工厂的管理员ID作为created_by

USE cretas;  -- 或 cretas_db，根据实际数据库名

-- ===== 1. 插入供应商（每个工厂3个供应商）=====
INSERT INTO suppliers (
    factory_id,
    name,
    code,
    supplier_code,
    contact_person,
    contact_phone,
    contact_email,
    address,
    rating,
    is_active,
    created_by,
    created_at,
    updated_at
) VALUES
-- F001工厂的供应商
('F001', '海洋渔业有限公司', 'SUP001', 'SUP001', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', 5, 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), NOW(), NOW()),
('F001', '新鲜禽肉批发', 'SUP002', 'SUP002', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', 4, 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), NOW(), NOW()),
('F001', '绿色蔬菜基地', 'SUP003', 'SUP003', '王五', '13800138003', 'wangwu@veg.com', '江苏省南京市', 4, 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), NOW(), NOW()),

-- F002工厂的供应商
('F002', '优质海鲜供应商', 'SUP001', 'SUP001', '赵经理', '13900139001', 'zhao@seafood.com', '广东省深圳市', 5, 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), NOW(), NOW()),
('F002', '冷冻食品批发', 'SUP002', 'SUP002', '钱经理', '13900139002', 'qian@frozen.com', '上海市浦东新区', 4, 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), NOW(), NOW()),
('F002', '调料供应商', 'SUP003', 'SUP003', '孙经理', '13900139003', 'sun@spice.com', '北京市朝阳区', 5, 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), NOW(), NOW()),

-- F003工厂的供应商
('F003', '新鲜食材供应商', 'SUP001', 'SUP001', '周经理', '13700137001', 'zhou@fresh.com', '杭州市西湖区', 4, 1, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), NOW(), NOW()),
('F003', '肉类供应商', 'SUP002', 'SUP002', '吴经理', '13700137002', 'wu@meat.com', '成都市锦江区', 4, 1, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), NOW(), NOW()),
('F003', '包装材料供应商', 'SUP003', 'SUP003', '郑经理', '13700137003', 'zheng@pack.com', '武汉市江汉区', 3, 1, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), NOW(), NOW());

-- ===== 2. 插入客户（每个工厂3个客户）=====
INSERT INTO customers (
    factory_id,
    name,
    code,
    customer_code,
    contact_person,
    contact_phone,
    contact_email,
    billing_address,
    shipping_address,
    industry,
    credit_limit,
    is_active,
    created_by,
    created_at,
    updated_at
) VALUES
-- F001工厂的客户
('F001', '大型连锁超市A', 'CUS001', 'CUS001', '陈经理', '13900139001', 'chen@supermarket-a.com', '上海市浦东新区', '上海市浦东新区', '零售', 500000.00, 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), NOW(), NOW()),
('F001', '酒店集团B', 'CUS002', 'CUS002', '刘经理', '13900139002', 'liu@hotel-b.com', '北京市朝阳区', '北京市朝阳区', '餐饮', 300000.00, 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), NOW(), NOW()),
('F001', '食品批发市场C', 'CUS003', 'CUS003', '周经理', '13900139003', 'zhou@market-c.com', '广州市天河区', '广州市天河区', '批发', 800000.00, 1, (SELECT id FROM users WHERE username='admin_f001' LIMIT 1), NOW(), NOW()),

-- F002工厂的客户
('F002', '高端餐饮连锁', 'CUS001', 'CUS001', '王经理', '13800138001', 'wang@restaurant.com', '深圳市南山区', '深圳市南山区', '餐饮', 400000.00, 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), NOW(), NOW()),
('F002', '大型商超集团', 'CUS002', 'CUS002', '李经理', '13800138002', 'li@mall.com', '上海市黄浦区', '上海市黄浦区', '零售', 600000.00, 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), NOW(), NOW()),
('F002', '电商平台', 'CUS003', 'CUS003', '张经理', '13800138003', 'zhang@ecommerce.com', '杭州市余杭区', '杭州市余杭区', '电商', 1000000.00, 1, (SELECT id FROM users WHERE username='admin_f002' LIMIT 1), NOW(), NOW()),

-- F003工厂的客户
('F003', '连锁便利店', 'CUS001', 'CUS001', '赵经理', '13700137001', 'zhao@convenience.com', '成都市武侯区', '成都市武侯区', '零售', 200000.00, 1, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), NOW(), NOW()),
('F003', '餐饮配送公司', 'CUS002', 'CUS002', '钱经理', '13700137002', 'qian@delivery.com', '武汉市武昌区', '武汉市武昌区', '配送', 350000.00, 1, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), NOW(), NOW()),
('F003', '食品加工企业', 'CUS003', 'CUS003', '孙经理', '13700137003', 'sun@processing.com', '长沙市岳麓区', '长沙市岳麓区', '加工', 450000.00, 1, (SELECT id FROM users WHERE username='admin_f003' LIMIT 1), NOW(), NOW());

-- ===== 3. 验证插入结果 =====
SELECT 'Suppliers by Factory' AS Category, factory_id, COUNT(*) AS Count 
FROM suppliers 
WHERE deleted_at IS NULL 
GROUP BY factory_id
ORDER BY factory_id;

SELECT 'Customers by Factory' AS Category, factory_id, COUNT(*) AS Count 
FROM customers 
WHERE deleted_at IS NULL 
GROUP BY factory_id
ORDER BY factory_id;

-- ===== 4. 查看详细数据 =====
SELECT 'F001 Suppliers' AS Type, id, name, code, contact_person FROM suppliers WHERE factory_id='F001' AND deleted_at IS NULL
UNION ALL
SELECT 'F001 Customers', id, name, code, contact_person FROM customers WHERE factory_id='F001' AND deleted_at IS NULL;

SELECT '✅ 供应商和客户数据插入完成！' AS Status;


