-- ============================================
-- 餐饮场景测试数据: R001 白垩纪示范餐厅
-- ============================================
-- 使用方式: psql -h 127.0.0.1 -U cretas_user -d cretas_db -f seed_restaurant_R001.sql

BEGIN;

-- 1. 工厂记录 (type=RESTAURANT)
INSERT INTO factories (id, name, type, level, address, contact_phone, ai_weekly_quota, is_active, manually_verified, created_at, updated_at)
VALUES ('R001', '白垩纪示范餐厅', 'RESTAURANT', 0, '上海市浦东新区陆家嘴环路1000号', '021-88881234', 100, true, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type;

-- 2. 餐饮管理员用户
-- 密码: 123456 (BCrypt hash 与 factory_admin1 相同)
DO $$
DECLARE
    v_pwd_hash TEXT;
BEGIN
    SELECT password_hash INTO v_pwd_hash FROM users WHERE username = 'factory_admin1' LIMIT 1;
    IF v_pwd_hash IS NULL THEN
        v_pwd_hash := '$2a$10$N.ZOn9G6/YLFixAOPMg/h.z7pCu6v2XyFDtC4q.jeeGM5ehKSFW2u';
    END IF;

    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('R001', 'restaurant_admin1', v_pwd_hash, '餐饮管理员', 'factory_super_admin', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO UPDATE SET factory_id = EXCLUDED.factory_id, role_code = EXCLUDED.role_code;
END $$;

-- 3. 菜品 (ProductType)
INSERT INTO product_types (id, factory_id, code, name, category, unit, unit_price, shelf_life_days, is_active, created_by, created_at, updated_at) VALUES
('R001-PT-001', 'R001', 'GBJD', '宫保鸡丁', '热菜', '份', 38.00, 1, true, 1, NOW(), NOW()),
('R001-PT-002', 'R001', 'MPDF', '麻婆豆腐', '热菜', '份', 28.00, 1, true, 1, NOW(), NOW()),
('R001-PT-003', 'R001', 'HSR',  '红烧肉',   '热菜', '份', 48.00, 1, true, 1, NOW(), NOW()),
('R001-PT-004', 'R001', 'DCF',  '蛋炒饭',   '主食', '份', 18.00, 1, true, 1, NOW(), NOW()),
('R001-PT-005', 'R001', 'SLT',  '酸辣汤',   '汤类', '份', 22.00, 1, true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 4. 食材 (RawMaterialType)
INSERT INTO raw_material_types (id, factory_id, code, name, category, unit, unit_price, storage_type, shelf_life_days, min_stock, is_active, created_by, created_at, updated_at) VALUES
('R001-RM-001', 'R001', 'JXR',  '鸡胸肉', '禽肉类', 'kg', 24.00, 'frozen',  90, 5.00,  true, 1, NOW(), NOW()),
('R001-RM-002', 'R001', 'DF',   '豆腐',   '豆制品', 'kg', 6.00,  'fresh',   3,  3.00,  true, 1, NOW(), NOW()),
('R001-RM-003', 'R001', 'WHR',  '五花肉', '猪肉类', 'kg', 32.00, 'frozen',  90, 5.00,  true, 1, NOW(), NOW()),
('R001-RM-004', 'R001', 'DM',   '大米',   '主粮类', 'kg', 5.50,  'dry',     365, 20.00, true, 1, NOW(), NOW()),
('R001-RM-005', 'R001', 'SYY',  '食用油', '油脂类', 'L',  12.00, 'dry',     365, 10.00, true, 1, NOW(), NOW()),
('R001-RM-006', 'R001', 'Y',    '盐',     '调味料', 'kg', 3.00,  'dry',     730, 5.00,  true, 1, NOW(), NOW()),
('R001-RM-007', 'R001', 'JY',   '酱油',   '调味料', 'L',  8.00,  'dry',     365, 3.00,  true, 1, NOW(), NOW()),
('R001-RM-008', 'R001', 'SJ',   '生姜',   '蔬菜类', 'kg', 15.00, 'fresh',   14, 2.00,  true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 5. 供应商
INSERT INTO suppliers (id, factory_id, code, supplier_code, name, contact_name, contact_phone, address, business_type, is_active, created_by, created_at, updated_at) VALUES
('R001-SUP-001', 'R001', 'SUP001', 'SUP001', '鲜达食材配送中心', '王经理', '13800138001', '上海市闵行区食品工业园A区', '食材供应商', true, 1, NOW(), NOW()),
('R001-SUP-002', 'R001', 'SUP002', 'SUP002', '绿源蔬菜批发', '李经理', '13900139002', '上海市嘉定区蔬菜批发市场B区', '蔬菜供应商', true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6. 客户
INSERT INTO customers (id, factory_id, code, customer_code, name, contact_name, contact_phone, shipping_address, customer_type, is_active, created_by, created_at, updated_at) VALUES
('R001-CUS-001', 'R001', 'CUS001', 'CUS001', '陆家嘴金融中心食堂', '张主任', '13700137001', '上海市浦东新区银城中路300号', 'ENTERPRISE', true, 1, NOW(), NOW()),
('R001-CUS-002', 'R001', 'CUS002', 'CUS002', '浦东世纪公园社区团购', '刘女士', '13600136002', '上海市浦东新区世纪大道1001号', 'RETAIL', true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 7. 采购订单示例
INSERT INTO purchase_orders (id, factory_id, supplier_id, order_number, status, total_amount, order_date, expected_delivery_date, created_by, created_at, updated_at) VALUES
('R001-PO-001', 'R001', 'R001-SUP-001', 'PO-R001-20260220-001', 'APPROVED', 1580.00, '2026-02-20', '2026-02-21', 1, NOW(), NOW()),
('R001-PO-002', 'R001', 'R001-SUP-002', 'PO-R001-20260220-002', 'DRAFT', 450.00, '2026-02-20', '2026-02-22', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 8. 销售订单示例
INSERT INTO sales_orders (id, factory_id, customer_id, order_number, status, total_amount, order_date, required_delivery_date, created_by, created_at, updated_at) VALUES
('R001-SO-001', 'R001', 'R001-CUS-001', 'SO-R001-20260220-001', 'CONFIRMED', 3200.00, '2026-02-20', '2026-02-20', 1, NOW(), NOW()),
('R001-SO-002', 'R001', 'R001-CUS-002', 'SO-R001-20260220-002', 'DRAFT', 860.00, '2026-02-20', '2026-02-21', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- 扩充数据 (Enhanced Seed v2)
-- ============================================================

-- A. 扩充菜品 (ProductType) — 增加到 20 道
INSERT INTO product_types (id, factory_id, code, name, category, unit, unit_price, shelf_life_days, is_active, created_by, created_at, updated_at) VALUES
-- 热菜(扩充)
('R001-PT-006', 'R001', 'YXRS', '鱼香肉丝', '热菜', '份', 32.00, 1, true, 1, NOW(), NOW()),
('R001-PT-007', 'R001', 'TCPG', '糖醋排骨', '热菜', '份', 48.00, 1, true, 1, NOW(), NOW()),
('R001-PT-008', 'R001', 'QZLV', '清蒸鲈鱼', '热菜', '份', 68.00, 1, true, 1, NOW(), NOW()),
-- 凉菜(4道)
('R001-PT-009', 'R001', 'LBHG', '凉拌黄瓜', '凉菜', '份', 12.00, 1, true, 1, NOW(), NOW()),
('R001-PT-010', 'R001', 'KSJ',  '口水鸡',   '凉菜', '份', 28.00, 1, true, 1, NOW(), NOW()),
('R001-PT-011', 'R001', 'PHG',  '拍黄瓜',   '凉菜', '份', 12.00, 1, true, 1, NOW(), NOW()),
('R001-PT-012', 'R001', 'PDDF', '皮蛋豆腐', '凉菜', '份', 18.00, 1, true, 1, NOW(), NOW()),
-- 主食(扩充)
('R001-PT-013', 'R001', 'YZCF', '扬州炒饭', '主食', '份', 22.00, 1, true, 1, NOW(), NOW()),
('R001-PT-014', 'R001', 'YCM',  '阳春面',   '主食', '份', 16.00, 1, true, 1, NOW(), NOW()),
('R001-PT-015', 'R001', 'XLB',  '小笼包',   '主食', '份', 28.00, 1, true, 1, NOW(), NOW()),
-- 汤类(扩充)
('R001-PT-016', 'R001', 'XHNJG','西湖牛肉羹','汤类', '份', 26.00, 1, true, 1, NOW(), NOW()),
-- 甜品(2道)
('R001-PT-017', 'R001', 'MGBD', '芒果布丁', '甜品', '份', 18.00, 1, true, 1, NOW(), NOW()),
('R001-PT-018', 'R001', 'HDSS', '红豆沙',   '甜品', '份', 14.00, 1, true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- B. 扩充食材 (RawMaterialType) — 增加到 25 种
INSERT INTO raw_material_types (id, factory_id, code, name, category, unit, unit_price, storage_type, shelf_life_days, min_stock, is_active, created_by, created_at, updated_at) VALUES
-- 禽肉类(扩充)
('R001-RM-009', 'R001', 'JC',   '鸡翅',   '禽肉类', 'kg', 28.00, 'frozen',  90,  5.00, true, 1, NOW(), NOW()),
('R001-RM-010', 'R001', 'YR',   '鸭肉',   '禽肉类', 'kg', 30.00, 'frozen',  90,  3.00, true, 1, NOW(), NOW()),
-- 猪肉类(扩充)
('R001-RM-011', 'R001', 'PG',   '排骨',   '猪肉类', 'kg', 38.00, 'frozen',  90,  4.00, true, 1, NOW(), NOW()),
('R001-RM-012', 'R001', 'ZLJ',  '猪里脊', '猪肉类', 'kg', 36.00, 'frozen',  90,  3.00, true, 1, NOW(), NOW()),
-- 水产类
('R001-RM-013', 'R001', 'LY',   '鲈鱼',   '水产类', 'kg', 55.00, 'fresh',    2,  3.00, true, 1, NOW(), NOW()),
('R001-RM-014', 'R001', 'XR',   '虾仁',   '水产类', 'kg', 68.00, 'frozen',  90,  2.00, true, 1, NOW(), NOW()),
('R001-RM-015', 'R001', 'MY',   '墨鱼',   '水产类', 'kg', 42.00, 'fresh',    2,  2.00, true, 1, NOW(), NOW()),
-- 蔬菜类(扩充)
('R001-RM-016', 'R001', 'HG',   '黄瓜',   '蔬菜类', 'kg',  4.00, 'fresh',    7,  5.00, true, 1, NOW(), NOW()),
('R001-RM-017', 'R001', 'XHF',  '西红柿', '蔬菜类', 'kg',  6.00, 'fresh',    7,  5.00, true, 1, NOW(), NOW()),
('R001-RM-018', 'R001', 'QJ',   '青椒',   '蔬菜类', 'kg',  5.00, 'fresh',    5,  3.00, true, 1, NOW(), NOW()),
('R001-RM-019', 'R001', 'TD',   '土豆',   '蔬菜类', 'kg',  3.50, 'fresh',   14, 10.00, true, 1, NOW(), NOW()),
('R001-RM-020', 'R001', 'BC',   '白菜',   '蔬菜类', 'kg',  2.50, 'fresh',    5, 10.00, true, 1, NOW(), NOW()),
('R001-RM-021', 'R001', 'C',    '葱',     '蔬菜类', 'kg',  6.00, 'fresh',    7,  3.00, true, 1, NOW(), NOW()),
-- 豆制品(扩充)
('R001-RM-022', 'R001', 'DP',   '豆皮',   '豆制品', 'kg',  8.00, 'fresh',    3,  2.00, true, 1, NOW(), NOW()),
-- 主粮类(扩充)
('R001-RM-023', 'R001', 'MF',   '面粉',   '主粮类', 'kg',  4.50, 'dry',     365, 20.00, true, 1, NOW(), NOW()),
('R001-RM-024', 'R001', 'NM',   '糯米',   '主粮类', 'kg',  7.00, 'dry',     365, 10.00, true, 1, NOW(), NOW()),
-- 调味料(扩充)
('R001-RM-025', 'R001', 'CU',   '醋',     '调味料', 'L',   6.00, 'dry',     365,  3.00, true, 1, NOW(), NOW()),
('R001-RM-026', 'R001', 'LJ',   '料酒',   '调味料', 'L',   8.00, 'dry',     365,  3.00, true, 1, NOW(), NOW()),
('R001-RM-027', 'R001', 'HJ',   '花椒',   '调味料', 'kg', 45.00, 'dry',     365,  1.00, true, 1, NOW(), NOW()),
('R001-RM-028', 'R001', 'LJZ',  '辣椒',   '调味料', 'kg', 20.00, 'dry',     180,  2.00, true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- C. 扩充供应商 — 增加到 5 家
INSERT INTO suppliers (id, factory_id, code, supplier_code, name, contact_name, contact_phone, address, business_type, is_active, created_by, created_at, updated_at) VALUES
('R001-SUP-003', 'R001', 'SUP003', 'SUP003', '东海水产批发', '陈经理', '13500135003', '上海市浦东新区高桥水产市场C区', '水产供应商', true, 1, NOW(), NOW()),
('R001-SUP-004', 'R001', 'SUP004', 'SUP004', '鸿运调味品直供', '周经理', '13400134004', '上海市宝山区调味品批发园区D区', '调味品供应商', true, 1, NOW(), NOW()),
('R001-SUP-005', 'R001', 'SUP005', 'SUP005', '金麦面点原料行', '吴经理', '13300133005', '上海市松江区食品原料工业园E区', '面点原料供应商', true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- D. 增加客户 — 增加到 5 家
INSERT INTO customers (id, factory_id, code, customer_code, name, contact_name, contact_phone, shipping_address, customer_type, is_active, created_by, created_at, updated_at) VALUES
('R001-CUS-003', 'R001', 'CUS003', 'CUS003', '张江科技园区餐厅', '孙总', '13200132003', '上海市浦东新区张江高科技园区', 'ENTERPRISE', true, 1, NOW(), NOW()),
('R001-CUS-004', 'R001', 'CUS004', 'CUS004', '东方明珠观光餐厅', '钱主任', '13100131004', '上海市浦东新区世纪大道1号东方明珠', 'ENTERPRISE', true, 1, NOW(), NOW()),
('R001-CUS-005', 'R001', 'CUS005', 'CUS005', '散客零售', NULL, NULL, '上海市浦东新区陆家嘴环路1000号', 'RETAIL', true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- E. 增加员工 — 5 人
DO $$
DECLARE
    v_pwd_hash TEXT;
BEGIN
    SELECT password_hash INTO v_pwd_hash FROM users WHERE username = 'factory_admin1' LIMIT 1;
    IF v_pwd_hash IS NULL THEN
        v_pwd_hash := '$2a$10$N.ZOn9G6/YLFixAOPMg/h.z7pCu6v2XyFDtC4q.jeeGM5ehKSFW2u';
    END IF;

    -- 厨师长
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('R001', 'restaurant_chef1', v_pwd_hash, '李厨师长', 'workshop_supervisor', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;

    -- 采购员
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('R001', 'restaurant_buyer1', v_pwd_hash, '王采购', 'warehouse_manager', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;

    -- 服务员1
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('R001', 'restaurant_staff1', v_pwd_hash, '张服务员', 'operator', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;

    -- 服务员2
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('R001', 'restaurant_staff2', v_pwd_hash, '赵服务员', 'operator', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;

    -- 收银员
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('R001', 'restaurant_cashier1', v_pwd_hash, '钱收银', 'quality_inspector', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;
END $$;

-- F. 扩充采购订单 — 增加到 8 笔
INSERT INTO purchase_orders (id, factory_id, supplier_id, order_number, purchase_type, status, total_amount, order_date, expected_delivery_date, created_by, created_at, updated_at) VALUES
-- 新增 6 笔(原有 2 笔已保留)
('R001-PO-003', 'R001', 'R001-SUP-001', 'PO-R001-20260217-001', 'DIRECT',  'COMPLETED',  2340.00, '2026-02-17', '2026-02-18', 1, NOW(), NOW()),
('R001-PO-004', 'R001', 'R001-SUP-002', 'PO-R001-20260217-002', 'DIRECT',  'COMPLETED',   680.00, '2026-02-17', '2026-02-18', 1, NOW(), NOW()),
('R001-PO-005', 'R001', 'R001-SUP-003', 'PO-R001-20260218-001', 'DIRECT',  'APPROVED',   1560.00, '2026-02-18', '2026-02-19', 1, NOW(), NOW()),
('R001-PO-006', 'R001', 'R001-SUP-004', 'PO-R001-20260218-002', 'DIRECT',  'APPROVED',    420.00, '2026-02-18', '2026-02-20', 1, NOW(), NOW()),
('R001-PO-007', 'R001', 'R001-SUP-005', 'PO-R001-20260219-001', 'URGENT',  'APPROVED',    380.00, '2026-02-19', '2026-02-20', 1, NOW(), NOW()),
('R001-PO-008', 'R001', 'R001-SUP-001', 'PO-R001-20260215-001', 'DIRECT',  'CANCELLED',   960.00, '2026-02-15', '2026-02-16', 1, NOW(), NOW()),
('R001-PO-009', 'R001', 'R001-SUP-002', 'PO-R001-20260215-002', 'DIRECT',  'DRAFT',       310.00, '2026-02-15', '2026-02-17', 1, NOW(), NOW()),
('R001-PO-010', 'R001', 'R001-SUP-003', 'PO-R001-20260216-001', 'DIRECT',  'DRAFT',       890.00, '2026-02-16', '2026-02-18', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- G. 扩充销售订单 — 增加到 8 笔
INSERT INTO sales_orders (id, factory_id, customer_id, order_number, status, total_amount, order_date, required_delivery_date, created_by, created_at, updated_at) VALUES
('R001-SO-003', 'R001', 'R001-CUS-001', 'SO-R001-20260218-001', 'CONFIRMED',  4800.00, '2026-02-18', '2026-02-18', 1, NOW(), NOW()),
('R001-SO-004', 'R001', 'R001-CUS-002', 'SO-R001-20260218-002', 'COMPLETED',  1260.00, '2026-02-18', '2026-02-18', 1, NOW(), NOW()),
('R001-SO-005', 'R001', 'R001-CUS-003', 'SO-R001-20260217-001', 'CONFIRMED',  2380.00, '2026-02-17', '2026-02-17', 1, NOW(), NOW()),
('R001-SO-006', 'R001', 'R001-CUS-004', 'SO-R001-20260217-002', 'COMPLETED',  6200.00, '2026-02-17', '2026-02-17', 1, NOW(), NOW()),
('R001-SO-007', 'R001', 'R001-CUS-001', 'SO-R001-20260216-001', 'PROCESSING', 3600.00, '2026-02-16', '2026-02-16', 1, NOW(), NOW()),
('R001-SO-008', 'R001', 'R001-CUS-005', 'SO-R001-20260216-002', 'CONFIRMED',   540.00, '2026-02-16', '2026-02-16', 1, NOW(), NOW()),
('R001-SO-009', 'R001', 'R001-CUS-002', 'SO-R001-20260215-001', 'COMPLETED',   980.00, '2026-02-15', '2026-02-15', 1, NOW(), NOW()),
('R001-SO-010', 'R001', 'R001-CUS-003', 'SO-R001-20260215-002', 'DRAFT',      1750.00, '2026-02-15', '2026-02-17', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- H. 库存批次 (material_batches) — 15 笔
-- 字段: id, factory_id, batch_number, material_type_id, supplier_id,
--       inbound_date, production_date, purchase_date, expire_date, version,
--       receipt_quantity, quantity_unit, used_quantity, reserved_quantity,
--       unit_price, status, storage_location, notes, created_by, created_at, updated_at
INSERT INTO material_batches (
    id, factory_id, batch_number, material_type_id, supplier_id,
    inbound_date, production_date, purchase_date, expire_date, version,
    receipt_quantity, quantity_unit, used_quantity, reserved_quantity,
    unit_price, status, storage_location, notes, created_by, created_at, updated_at
) VALUES
-- 鸡胸肉批次 (正常库存)
('R001-MB-001', 'R001', 'MB-R001-20260201-001', 'R001-RM-001', 'R001-SUP-001',
 '2026-02-01', '2026-01-28', '2026-02-01', '2026-05-01', 0,
 30.00, 'kg', 12.00, 0.00,
 24.00, 'AVAILABLE', '冷冻库A区-01', '鸡胸肉第一批', 1, NOW(), NOW()),

-- 豆腐批次 (即将过期，用于保质期预警测试)
('R001-MB-002', 'R001', 'MB-R001-20260218-001', 'R001-RM-002', 'R001-SUP-002',
 '2026-02-18', '2026-02-18', '2026-02-18', '2026-02-21', 0,
 20.00, 'kg', 8.00, 0.00,
 6.00, 'AVAILABLE', '冷鲜库B区-01', '豆腐今日新到，3日内使用', 1, NOW(), NOW()),

-- 五花肉批次 (正常库存)
('R001-MB-003', 'R001', 'MB-R001-20260205-001', 'R001-RM-003', 'R001-SUP-001',
 '2026-02-05', '2026-02-02', '2026-02-05', '2026-05-05', 0,
 25.00, 'kg', 10.00, 0.00,
 32.00, 'AVAILABLE', '冷冻库A区-02', '五花肉批次', 1, NOW(), NOW()),

-- 大米批次 (干货，库存充足)
('R001-MB-004', 'R001', 'MB-R001-20260101-001', 'R001-RM-004', 'R001-SUP-001',
 '2026-01-01', '2025-11-01', '2026-01-01', '2026-12-31', 0,
 100.00, 'kg', 45.00, 0.00,
 5.50, 'AVAILABLE', '干货仓C区-01', '大米库存', 1, NOW(), NOW()),

-- 食用油批次 (干货)
('R001-MB-005', 'R001', 'MB-R001-20260110-001', 'R001-RM-005', 'R001-SUP-001',
 '2026-01-10', '2025-10-01', '2026-01-10', '2026-10-01', 0,
 40.00, 'L', 18.00, 0.00,
 12.00, 'AVAILABLE', '干货仓C区-02', '食用油库存', 1, NOW(), NOW()),

-- 酱油批次 (调味料)
('R001-MB-006', 'R001', 'MB-R001-20260115-001', 'R001-RM-007', 'R001-SUP-004',
 '2026-01-15', '2025-09-01', '2026-01-15', '2026-09-01', 0,
 20.00, 'L', 8.00, 0.00,
 8.00, 'AVAILABLE', '干货仓C区-03', '酱油库存', 1, NOW(), NOW()),

-- 鲈鱼批次 (生鲜，即将过期)
('R001-MB-007', 'R001', 'MB-R001-20260219-001', 'R001-RM-013', 'R001-SUP-003',
 '2026-02-19', '2026-02-19', '2026-02-19', '2026-02-21', 0,
 15.00, 'kg', 3.00, 0.00,
 55.00, 'AVAILABLE', '冷鲜库B区-02', '鲈鱼今日新到', 1, NOW(), NOW()),

-- 虾仁批次 (冷冻)
('R001-MB-008', 'R001', 'MB-R001-20260210-001', 'R001-RM-014', 'R001-SUP-003',
 '2026-02-10', '2026-02-08', '2026-02-10', '2026-08-10', 0,
 20.00, 'kg', 6.00, 0.00,
 68.00, 'AVAILABLE', '冷冻库A区-03', '虾仁冷冻批次', 1, NOW(), NOW()),

-- 黄瓜批次 (蔬菜，近期到货)
('R001-MB-009', 'R001', 'MB-R001-20260219-002', 'R001-RM-016', 'R001-SUP-002',
 '2026-02-19', '2026-02-18', '2026-02-19', '2026-02-26', 0,
 30.00, 'kg', 5.00, 0.00,
 4.00, 'AVAILABLE', '蔬菜区D区-01', '黄瓜今日新到', 1, NOW(), NOW()),

-- 排骨批次 (冷冻)
('R001-MB-010', 'R001', 'MB-R001-20260208-001', 'R001-RM-011', 'R001-SUP-001',
 '2026-02-08', '2026-02-06', '2026-02-08', '2026-05-08', 0,
 20.00, 'kg', 7.00, 0.00,
 38.00, 'AVAILABLE', '冷冻库A区-04', '排骨批次', 1, NOW(), NOW()),

-- 面粉批次 (干货)
('R001-MB-011', 'R001', 'MB-R001-20260120-001', 'R001-RM-023', 'R001-SUP-005',
 '2026-01-20', '2025-12-01', '2026-01-20', '2026-12-20', 0,
 50.00, 'kg', 20.00, 0.00,
 4.50, 'AVAILABLE', '干货仓C区-04', '面粉库存', 1, NOW(), NOW()),

-- 西红柿批次 (蔬菜，已部分使用)
('R001-MB-012', 'R001', 'MB-R001-20260217-001', 'R001-RM-017', 'R001-SUP-002',
 '2026-02-17', '2026-02-16', '2026-02-17', '2026-02-24', 0,
 25.00, 'kg', 10.00, 0.00,
 6.00, 'AVAILABLE', '蔬菜区D区-02', '西红柿库存', 1, NOW(), NOW()),

-- 鸡翅批次 (冷冻)
('R001-MB-013', 'R001', 'MB-R001-20260212-001', 'R001-RM-009', 'R001-SUP-001',
 '2026-02-12', '2026-02-10', '2026-02-12', '2026-05-12', 0,
 18.00, 'kg', 4.00, 0.00,
 28.00, 'AVAILABLE', '冷冻库A区-05', '鸡翅批次', 1, NOW(), NOW()),

-- 料酒批次 (调味料，接近低库存警戒)
('R001-MB-014', 'R001', 'MB-R001-20260115-002', 'R001-RM-026', 'R001-SUP-004',
 '2026-01-15', '2025-08-01', '2026-01-15', '2026-08-01', 0,
 10.00, 'L', 7.50, 0.00,
 8.00, 'AVAILABLE', '干货仓C区-05', '料酒库存偏低，建议补货', 1, NOW(), NOW()),

-- 猪里脊批次 (冷冻，已用完大部分，测试低库存)
('R001-MB-015', 'R001', 'MB-R001-20260201-002', 'R001-RM-012', 'R001-SUP-001',
 '2026-02-01', '2026-01-30', '2026-02-01', '2026-05-01', 0,
 15.00, 'kg', 13.00, 0.00,
 36.00, 'AVAILABLE', '冷冻库A区-06', '猪里脊库存偏低', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 9. FactoryTypeBlueprint 餐饮模板
INSERT INTO factory_type_blueprints (id, name, description, industry_type, default_config, product_type_templates, department_templates, is_active, version, created_at, updated_at) VALUES
(
    'blueprint-restaurant-001',
    '餐饮门店模板',
    '适用于中餐馆、快餐店、团餐配送等餐饮场景。含菜品管理、食材采购、门店进销存等功能模块。',
    'RESTAURANT',
    '{"dailyCapacity": 200, "shiftCount": 2, "peakHours": "11:00-13:00,17:00-20:00", "averageTableTurnover": 3}',
    '[{"name":"热菜","category":"热菜","unit":"份"},{"name":"凉菜","category":"凉菜","unit":"份"},{"name":"主食","category":"主食","unit":"份"},{"name":"汤类","category":"汤类","unit":"份"},{"name":"甜品","category":"甜品","unit":"份"}]',
    '[{"name":"前厅部","type":"SERVICE"},{"name":"后厨部","type":"PRODUCTION"},{"name":"采购部","type":"PROCUREMENT"},{"name":"财务部","type":"FINANCE"}]',
    true,
    1,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- I. BOM 配方 (recipes) — 13 道菜，共 47 行
-- ============================================================
-- 列: id, factory_id, product_type_id, raw_material_type_id,
--     standard_quantity, unit, net_yield_rate, is_main_ingredient,
--     notes, is_active, created_by, created_at, updated_at
-- ============================================================

INSERT INTO recipes (
    id, factory_id, product_type_id, raw_material_type_id,
    standard_quantity, unit, net_yield_rate, is_main_ingredient,
    notes, is_active, created_by, created_at, updated_at
) VALUES

-- -------------------------------------------------------
-- 宫保鸡丁 (PT-001): 鸡胸肉、花生(RM-027借用花椒槽位→用辣椒代替)、干辣椒、食用油、酱油、生姜
-- RM-001鸡胸肉, RM-028辣椒(干辣椒), RM-005食用油, RM-007酱油, RM-008生姜, RM-026料酒
-- -------------------------------------------------------
('R001-RCP-001', 'R001', 'R001-PT-001', 'R001-RM-001',
 0.2000, 'kg', 0.9500, true,
 '鸡胸肉切丁，主料', true, 1, NOW(), NOW()),

('R001-RCP-002', 'R001', 'R001-PT-001', 'R001-RM-028',
 0.0150, 'kg', 1.0000, false,
 '干辣椒段，提色增香', true, 1, NOW(), NOW()),

('R001-RCP-003', 'R001', 'R001-PT-001', 'R001-RM-005',
 0.0300, 'L',  1.0000, false,
 '食用油炒制用', true, 1, NOW(), NOW()),

('R001-RCP-004', 'R001', 'R001-PT-001', 'R001-RM-007',
 0.0200, 'L',  1.0000, false,
 '酱油调味', true, 1, NOW(), NOW()),

('R001-RCP-005', 'R001', 'R001-PT-001', 'R001-RM-008',
 0.0100, 'kg', 0.9000, false,
 '生姜切片，去腥', true, 1, NOW(), NOW()),

('R001-RCP-006', 'R001', 'R001-PT-001', 'R001-RM-026',
 0.0150, 'L',  1.0000, false,
 '料酒腌制鸡丁', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 麻婆豆腐 (PT-002): 豆腐、猪里脊(肉末)、辣椒(豆瓣酱代用)、花椒、食用油、酱油
-- RM-002豆腐, RM-012猪里脊, RM-028辣椒, RM-027花椒, RM-005食用油, RM-007酱油
-- -------------------------------------------------------
('R001-RCP-007', 'R001', 'R001-PT-002', 'R001-RM-002',
 0.3000, 'kg', 1.0000, true,
 '豆腐切小块，主料', true, 1, NOW(), NOW()),

('R001-RCP-008', 'R001', 'R001-PT-002', 'R001-RM-012',
 0.1000, 'kg', 0.9500, true,
 '猪里脊剁成肉末', true, 1, NOW(), NOW()),

('R001-RCP-009', 'R001', 'R001-PT-002', 'R001-RM-028',
 0.0200, 'kg', 1.0000, false,
 '辣椒面/豆瓣酱调味', true, 1, NOW(), NOW()),

('R001-RCP-010', 'R001', 'R001-PT-002', 'R001-RM-027',
 0.0050, 'kg', 1.0000, false,
 '花椒粉增麻香', true, 1, NOW(), NOW()),

('R001-RCP-011', 'R001', 'R001-PT-002', 'R001-RM-005',
 0.0250, 'L',  1.0000, false,
 '食用油炒制', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 红烧肉 (PT-003): 五花肉、酱油、料酒、生姜、盐、食用油
-- RM-003五花肉, RM-007酱油, RM-026料酒, RM-008生姜, RM-006盐, RM-005食用油
-- -------------------------------------------------------
('R001-RCP-012', 'R001', 'R001-PT-003', 'R001-RM-003',
 0.3500, 'kg', 0.9000, true,
 '五花肉切方块，主料', true, 1, NOW(), NOW()),

('R001-RCP-013', 'R001', 'R001-PT-003', 'R001-RM-007',
 0.0300, 'L',  1.0000, false,
 '老抽+生抽调色调味', true, 1, NOW(), NOW()),

('R001-RCP-014', 'R001', 'R001-PT-003', 'R001-RM-026',
 0.0300, 'L',  1.0000, false,
 '料酒去腥增香', true, 1, NOW(), NOW()),

('R001-RCP-015', 'R001', 'R001-PT-003', 'R001-RM-008',
 0.0150, 'kg', 0.8500, false,
 '生姜去腥', true, 1, NOW(), NOW()),

('R001-RCP-016', 'R001', 'R001-PT-003', 'R001-RM-006',
 0.0050, 'kg', 1.0000, false,
 '食盐调味', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 蛋炒饭 (PT-004): 大米(熟米饭)、鸡蛋(无RM，用葱代替)、食用油、酱油、盐、葱
-- RM-004大米, RM-005食用油, RM-007酱油, RM-006盐, RM-021葱
-- -------------------------------------------------------
('R001-RCP-017', 'R001', 'R001-PT-004', 'R001-RM-004',
 0.2000, 'kg', 1.0000, true,
 '大米煮成米饭作为主料', true, 1, NOW(), NOW()),

('R001-RCP-018', 'R001', 'R001-PT-004', 'R001-RM-005',
 0.0200, 'L',  1.0000, false,
 '食用油翻炒', true, 1, NOW(), NOW()),

('R001-RCP-019', 'R001', 'R001-PT-004', 'R001-RM-006',
 0.0030, 'kg', 1.0000, false,
 '盐调味', true, 1, NOW(), NOW()),

('R001-RCP-020', 'R001', 'R001-PT-004', 'R001-RM-021',
 0.0100, 'kg', 0.9000, false,
 '葱花增香', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 酸辣汤 (PT-005): 豆腐、猪里脊、醋、辣椒、酱油、盐、食用油
-- RM-002豆腐, RM-012猪里脊, RM-025醋, RM-028辣椒, RM-007酱油, RM-006盐
-- -------------------------------------------------------
('R001-RCP-021', 'R001', 'R001-PT-005', 'R001-RM-002',
 0.1500, 'kg', 1.0000, true,
 '豆腐切丝', true, 1, NOW(), NOW()),

('R001-RCP-022', 'R001', 'R001-PT-005', 'R001-RM-012',
 0.0500, 'kg', 0.9500, true,
 '猪里脊切丝', true, 1, NOW(), NOW()),

('R001-RCP-023', 'R001', 'R001-PT-005', 'R001-RM-025',
 0.0200, 'L',  1.0000, false,
 '醋增酸味', true, 1, NOW(), NOW()),

('R001-RCP-024', 'R001', 'R001-PT-005', 'R001-RM-028',
 0.0080, 'kg', 1.0000, false,
 '辣椒增辣味', true, 1, NOW(), NOW()),

('R001-RCP-025', 'R001', 'R001-PT-005', 'R001-RM-007',
 0.0150, 'L',  1.0000, false,
 '酱油调色调味', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 鱼香肉丝 (PT-006): 猪里脊、青椒、胡萝卜(用西红柿代)、食用油、酱油、醋、辣椒
-- RM-012猪里脊, RM-018青椒, RM-017西红柿, RM-005食用油, RM-007酱油, RM-025醋, RM-028辣椒
-- -------------------------------------------------------
('R001-RCP-026', 'R001', 'R001-PT-006', 'R001-RM-012',
 0.1800, 'kg', 0.9500, true,
 '猪里脊切丝，主料', true, 1, NOW(), NOW()),

('R001-RCP-027', 'R001', 'R001-PT-006', 'R001-RM-018',
 0.0800, 'kg', 0.8500, true,
 '青椒切丝配菜', true, 1, NOW(), NOW()),

('R001-RCP-028', 'R001', 'R001-PT-006', 'R001-RM-005',
 0.0300, 'L',  1.0000, false,
 '食用油炒制', true, 1, NOW(), NOW()),

('R001-RCP-029', 'R001', 'R001-PT-006', 'R001-RM-007',
 0.0150, 'L',  1.0000, false,
 '酱油调味', true, 1, NOW(), NOW()),

('R001-RCP-030', 'R001', 'R001-PT-006', 'R001-RM-025',
 0.0150, 'L',  1.0000, false,
 '醋增酸味（鱼香汁）', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 糖醋排骨 (PT-007): 排骨、醋、酱油、食用油、料酒、生姜
-- RM-011排骨, RM-025醋, RM-007酱油, RM-005食用油, RM-026料酒, RM-008生姜
-- -------------------------------------------------------
('R001-RCP-031', 'R001', 'R001-PT-007', 'R001-RM-011',
 0.4000, 'kg', 0.7000, true,
 '排骨斩件，含骨净料率约70%', true, 1, NOW(), NOW()),

('R001-RCP-032', 'R001', 'R001-PT-007', 'R001-RM-025',
 0.0250, 'L',  1.0000, false,
 '醋增酸味（糖醋汁）', true, 1, NOW(), NOW()),

('R001-RCP-033', 'R001', 'R001-PT-007', 'R001-RM-007',
 0.0200, 'L',  1.0000, false,
 '酱油调色', true, 1, NOW(), NOW()),

('R001-RCP-034', 'R001', 'R001-PT-007', 'R001-RM-026',
 0.0200, 'L',  1.0000, false,
 '料酒去腥腌制', true, 1, NOW(), NOW()),

('R001-RCP-035', 'R001', 'R001-PT-007', 'R001-RM-008',
 0.0100, 'kg', 0.9000, false,
 '生姜去腥', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 清蒸鲈鱼 (PT-008): 鲈鱼、生姜、葱、酱油、食用油、料酒
-- RM-013鲈鱼, RM-008生姜, RM-021葱, RM-007酱油, RM-005食用油, RM-026料酒
-- -------------------------------------------------------
('R001-RCP-036', 'R001', 'R001-PT-008', 'R001-RM-013',
 0.5500, 'kg', 0.6500, true,
 '整鲈鱼净料率约65%（去骨去内脏）', true, 1, NOW(), NOW()),

('R001-RCP-037', 'R001', 'R001-PT-008', 'R001-RM-008',
 0.0200, 'kg', 0.9000, false,
 '生姜切丝铺底去腥', true, 1, NOW(), NOW()),

('R001-RCP-038', 'R001', 'R001-PT-008', 'R001-RM-021',
 0.0150, 'kg', 0.8500, false,
 '葱切丝装饰提香', true, 1, NOW(), NOW()),

('R001-RCP-039', 'R001', 'R001-PT-008', 'R001-RM-007',
 0.0250, 'L',  1.0000, false,
 '蒸鱼豉油淋面', true, 1, NOW(), NOW()),

('R001-RCP-040', 'R001', 'R001-PT-008', 'R001-RM-005',
 0.0200, 'L',  1.0000, false,
 '热油泼香', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 凉拌黄瓜 (PT-009): 黄瓜、醋、酱油、辣椒、盐、食用油
-- RM-016黄瓜, RM-025醋, RM-007酱油, RM-028辣椒, RM-006盐, RM-005食用油
-- -------------------------------------------------------
('R001-RCP-041', 'R001', 'R001-PT-009', 'R001-RM-016',
 0.2500, 'kg', 0.9000, true,
 '黄瓜拍碎，去皮尾', true, 1, NOW(), NOW()),

('R001-RCP-042', 'R001', 'R001-PT-009', 'R001-RM-025',
 0.0150, 'L',  1.0000, false,
 '醋调酸味', true, 1, NOW(), NOW()),

('R001-RCP-043', 'R001', 'R001-PT-009', 'R001-RM-007',
 0.0100, 'L',  1.0000, false,
 '酱油调鲜', true, 1, NOW(), NOW()),

('R001-RCP-044', 'R001', 'R001-PT-009', 'R001-RM-028',
 0.0050, 'kg', 1.0000, false,
 '辣椒油调辣', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 口水鸡 (PT-010): 鸡胸肉、花椒、辣椒、酱油、醋、食用油、葱、生姜
-- RM-001鸡胸肉, RM-027花椒, RM-028辣椒, RM-007酱油, RM-025醋, RM-021葱
-- -------------------------------------------------------
('R001-RCP-045', 'R001', 'R001-PT-010', 'R001-RM-001',
 0.2500, 'kg', 0.9500, true,
 '鸡胸肉白煮后手撕', true, 1, NOW(), NOW()),

('R001-RCP-046', 'R001', 'R001-PT-010', 'R001-RM-027',
 0.0080, 'kg', 1.0000, false,
 '花椒麻味底料', true, 1, NOW(), NOW()),

('R001-RCP-047', 'R001', 'R001-PT-010', 'R001-RM-028',
 0.0120, 'kg', 1.0000, false,
 '辣椒油增辣', true, 1, NOW(), NOW()),

('R001-RCP-048', 'R001', 'R001-PT-010', 'R001-RM-007',
 0.0200, 'L',  1.0000, false,
 '酱油调鲜', true, 1, NOW(), NOW()),

('R001-RCP-049', 'R001', 'R001-PT-010', 'R001-RM-021',
 0.0100, 'kg', 0.8500, false,
 '葱花点缀提香', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 拍黄瓜 (PT-011): 黄瓜、大蒜(用生姜代)、醋、盐、辣椒、食用油
-- RM-016黄瓜, RM-008生姜, RM-025醋, RM-006盐, RM-028辣椒
-- -------------------------------------------------------
('R001-RCP-050', 'R001', 'R001-PT-011', 'R001-RM-016',
 0.2500, 'kg', 0.9000, true,
 '黄瓜用刀拍碎切段', true, 1, NOW(), NOW()),

('R001-RCP-051', 'R001', 'R001-PT-011', 'R001-RM-008',
 0.0050, 'kg', 0.9000, false,
 '姜末腌制提味', true, 1, NOW(), NOW()),

('R001-RCP-052', 'R001', 'R001-PT-011', 'R001-RM-025',
 0.0120, 'L',  1.0000, false,
 '醋调酸', true, 1, NOW(), NOW()),

('R001-RCP-053', 'R001', 'R001-PT-011', 'R001-RM-006',
 0.0040, 'kg', 1.0000, false,
 '盐腌出水', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 扬州炒饭 (PT-013): 大米、虾仁、青椒、酱油、食用油、盐、葱
-- RM-004大米, RM-014虾仁, RM-018青椒, RM-007酱油, RM-005食用油, RM-021葱
-- -------------------------------------------------------
('R001-RCP-054', 'R001', 'R001-PT-013', 'R001-RM-004',
 0.2000, 'kg', 1.0000, true,
 '大米隔夜饭，颗粒分明', true, 1, NOW(), NOW()),

('R001-RCP-055', 'R001', 'R001-PT-013', 'R001-RM-014',
 0.0800, 'kg', 0.9500, true,
 '虾仁主配料', true, 1, NOW(), NOW()),

('R001-RCP-056', 'R001', 'R001-PT-013', 'R001-RM-018',
 0.0500, 'kg', 0.8500, false,
 '青椒丁配色', true, 1, NOW(), NOW()),

('R001-RCP-057', 'R001', 'R001-PT-013', 'R001-RM-005',
 0.0250, 'L',  1.0000, false,
 '食用油大火翻炒', true, 1, NOW(), NOW()),

('R001-RCP-058', 'R001', 'R001-PT-013', 'R001-RM-021',
 0.0100, 'kg', 0.9000, false,
 '葱花提香', true, 1, NOW(), NOW()),

-- -------------------------------------------------------
-- 小笼包 (PT-015): 面粉、猪里脊(猪肉馅)、生姜、酱油、料酒、盐
-- RM-023面粉, RM-012猪里脊, RM-008生姜, RM-007酱油, RM-026料酒, RM-006盐
-- -------------------------------------------------------
('R001-RCP-059', 'R001', 'R001-PT-015', 'R001-RM-023',
 0.1500, 'kg', 1.0000, true,
 '面粉和面做包子皮（一笼6个）', true, 1, NOW(), NOW()),

('R001-RCP-060', 'R001', 'R001-PT-015', 'R001-RM-012',
 0.1200, 'kg', 0.9500, true,
 '猪里脊剁馅，主料', true, 1, NOW(), NOW()),

('R001-RCP-061', 'R001', 'R001-PT-015', 'R001-RM-008',
 0.0080, 'kg', 0.9000, false,
 '姜末去腥', true, 1, NOW(), NOW()),

('R001-RCP-062', 'R001', 'R001-PT-015', 'R001-RM-007',
 0.0120, 'L',  1.0000, false,
 '酱油调馅味', true, 1, NOW(), NOW()),

('R001-RCP-063', 'R001', 'R001-PT-015', 'R001-RM-026',
 0.0100, 'L',  1.0000, false,
 '料酒去腥增香', true, 1, NOW(), NOW())

ON CONFLICT DO NOTHING;

COMMIT;

-- 验证
SELECT '=== 餐饮数据验证 v2 ===' AS info;
SELECT 'Factory: ' || count(*) FROM factories WHERE id = 'R001';
SELECT 'Users: ' || count(*) FROM users WHERE factory_id = 'R001';
SELECT 'ProductTypes (菜品): ' || count(*) FROM product_types WHERE factory_id = 'R001';
SELECT 'RawMaterialTypes (食材): ' || count(*) FROM raw_material_types WHERE factory_id = 'R001';
SELECT 'Suppliers: ' || count(*) FROM suppliers WHERE factory_id = 'R001';
SELECT 'Customers: ' || count(*) FROM customers WHERE factory_id = 'R001';
SELECT 'PurchaseOrders: ' || count(*) FROM purchase_orders WHERE factory_id = 'R001';
SELECT 'SalesOrders: ' || count(*) FROM sales_orders WHERE factory_id = 'R001';
SELECT 'MaterialBatches: ' || count(*) FROM material_batches WHERE factory_id = 'R001';
SELECT 'MaterialBatches (AVAILABLE): ' || count(*) FROM material_batches WHERE factory_id = 'R001' AND status = 'AVAILABLE';
SELECT 'MaterialBatches (LOW_STOCK): ' || count(*) FROM material_batches WHERE factory_id = 'R001' AND status = 'LOW_STOCK';
SELECT 'Blueprint: ' || count(*) FROM factory_type_blueprints WHERE industry_type = 'RESTAURANT';
SELECT 'Recipes (BOM rows): ' || count(*) FROM recipes WHERE factory_id = 'R001';
SELECT 'Recipes (dishes covered): ' || count(DISTINCT product_type_id) FROM recipes WHERE factory_id = 'R001';
