-- ============================================================
-- 餐饮场景测试数据: F002 张记餐饮管理有限公司
-- ============================================================
-- 用途: 为 restaurant_admin1 (factoryId=F002) 填充完整餐饮业务数据
--       修复 R001/F002 factoryId 不匹配导致的空数据问题
--
-- 前提: create_test_merchants.sql 已执行 (F002 工厂 + restaurant_admin1 用户已存在)
-- 使用: psql -h 127.0.0.1 -U cretas_user -d cretas_db -f seed_restaurant_F002.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 0. 获取 restaurant_admin1 的 user ID (后续 created_by 引用)
-- ============================================================
DO $$
DECLARE
    v_admin_id BIGINT;
BEGIN
    SELECT id INTO v_admin_id FROM users WHERE username = 'restaurant_admin1' LIMIT 1;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'restaurant_admin1 user not found. Run create_test_merchants.sql first.';
    END IF;
    -- Store in a temp table for use in subsequent INSERTs
    CREATE TEMP TABLE IF NOT EXISTS _seed_vars (key TEXT PRIMARY KEY, val BIGINT);
    INSERT INTO _seed_vars (key, val) VALUES ('admin_id', v_admin_id)
    ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;
END $$;


-- ============================================================
-- 1. 菜品 / 产品类型 (product_types) — 15 道菜
-- ============================================================
INSERT INTO product_types (id, factory_id, code, name, category, unit, unit_price, shelf_life_days, is_active, created_by, created_at, updated_at) VALUES
-- 热菜 (5 道)
('F002-PT-001', 'F002', 'GBJD', '宫保鸡丁', '热菜', '份', 38.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-002', 'F002', 'MPDF', '麻婆豆腐', '热菜', '份', 28.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-003', 'F002', 'HSR',  '红烧肉',   '热菜', '份', 48.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-004', 'F002', 'YXRS', '鱼香肉丝', '热菜', '份', 32.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-005', 'F002', 'TCPG', '糖醋排骨', '热菜', '份', 48.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 凉菜 (3 道)
('F002-PT-006', 'F002', 'LBHG', '凉拌黄瓜', '凉菜', '份', 12.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-007', 'F002', 'KSJ',  '口水鸡',   '凉菜', '份', 28.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-008', 'F002', 'PDDF', '皮蛋豆腐', '凉菜', '份', 18.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 主食 (3 道)
('F002-PT-009', 'F002', 'DCF',  '蛋炒饭',   '主食', '份', 18.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-010', 'F002', 'YZCF', '扬州炒饭', '主食', '份', 22.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-011', 'F002', 'XLB',  '小笼包',   '主食', '份', 28.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 汤类 (2 道)
('F002-PT-012', 'F002', 'SLT',  '酸辣汤',   '汤类', '份', 22.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-013', 'F002', 'XHNJG','西湖牛肉羹','汤类', '份', 26.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 甜品 (2 道)
('F002-PT-014', 'F002', 'MGBD', '芒果布丁', '甜品', '份', 18.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-PT-015', 'F002', 'HDSS', '红豆沙',   '甜品', '份', 14.00, 1, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================
-- 2. 食材 / 原材料类型 (raw_material_types) — 20 种
-- ============================================================
INSERT INTO raw_material_types (id, factory_id, code, name, category, unit, unit_price, storage_type, shelf_life_days, min_stock, is_active, created_by, created_at, updated_at) VALUES
-- 禽肉类
('F002-RM-001', 'F002', 'JXR',  '鸡胸肉', '禽肉类', 'kg', 24.00, 'frozen',  90, 5.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-002', 'F002', 'JC',   '鸡翅',   '禽肉类', 'kg', 28.00, 'frozen',  90, 5.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 猪肉类
('F002-RM-003', 'F002', 'WHR',  '五花肉', '猪肉类', 'kg', 32.00, 'frozen',  90, 5.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-004', 'F002', 'PG',   '排骨',   '猪肉类', 'kg', 38.00, 'frozen',  90, 4.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-005', 'F002', 'ZLJ',  '猪里脊', '猪肉类', 'kg', 36.00, 'frozen',  90, 3.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 豆制品
('F002-RM-006', 'F002', 'DF',   '豆腐',   '豆制品', 'kg',  6.00, 'fresh',    3, 3.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 蔬菜类
('F002-RM-007', 'F002', 'HG',   '黄瓜',   '蔬菜类', 'kg',  4.00, 'fresh',    7, 5.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-008', 'F002', 'QJ',   '青椒',   '蔬菜类', 'kg',  5.00, 'fresh',    5, 3.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-009', 'F002', 'SJ',   '生姜',   '蔬菜类', 'kg', 15.00, 'fresh',   14, 2.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-010', 'F002', 'C',    '葱',     '蔬菜类', 'kg',  6.00, 'fresh',    7, 3.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 主粮类
('F002-RM-011', 'F002', 'DM',   '大米',   '主粮类', 'kg',  5.50, 'dry',     365, 20.00, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-012', 'F002', 'MF',   '面粉',   '主粮类', 'kg',  4.50, 'dry',     365, 20.00, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 油脂类
('F002-RM-013', 'F002', 'SYY',  '食用油', '油脂类', 'L',  12.00, 'dry',     365, 10.00, true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 调味料
('F002-RM-014', 'F002', 'Y',    '盐',     '调味料', 'kg',  3.00, 'dry',     730, 5.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-015', 'F002', 'JY',   '酱油',   '调味料', 'L',   8.00, 'dry',     365, 3.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-016', 'F002', 'CU',   '醋',     '调味料', 'L',   6.00, 'dry',     365, 3.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-017', 'F002', 'LJ',   '料酒',   '调味料', 'L',   8.00, 'dry',     365, 3.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-018', 'F002', 'HJ',   '花椒',   '调味料', 'kg', 45.00, 'dry',     365, 1.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RM-019', 'F002', 'LJZ',  '辣椒',   '调味料', 'kg', 20.00, 'dry',     180, 2.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 乳制品
('F002-RM-020', 'F002', 'XN',   '鲜奶',   '乳制品', 'L',  10.00, 'fresh',    5, 5.00,  true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. 供应商 (suppliers) — 4 家
-- ============================================================
INSERT INTO suppliers (id, factory_id, code, supplier_code, name, contact_name, contact_phone, address, business_type, is_active, created_by, created_at, updated_at) VALUES
('F002-SUP-001', 'F002', 'SUP001', 'SUP001', '黄浦食材配送中心',   '王经理', '13800138101', '上海市黄浦区食品批发市场A区', '食材供应商', true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-SUP-002', 'F002', 'SUP002', 'SUP002', '静安绿源蔬菜行',     '李经理', '13900139102', '上海市静安区菜场路68号',       '蔬菜供应商', true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-SUP-003', 'F002', 'SUP003', 'SUP003', '长宁调味品直供',     '周经理', '13400134103', '上海市长宁区调味品批发城B区', '调味品供应商', true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-SUP-004', 'F002', 'SUP004', 'SUP004', '闸北面点原料行',     '吴经理', '13300133104', '上海市闸北区面粉批发市场C区', '面点原料供应商', true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================
-- 4. 客户 (customers) — 4 家
-- ============================================================
INSERT INTO customers (id, factory_id, code, customer_code, name, contact_name, contact_phone, shipping_address, customer_type, is_active, created_by, created_at, updated_at) VALUES
('F002-CUS-001', 'F002', 'CUS001', 'CUS001', '南京东路商务楼食堂', '张主任', '13700137201', '上海市黄浦区南京东路200号',   'ENTERPRISE', true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-CUS-002', 'F002', 'CUS002', 'CUS002', '人民广场社区团购',   '刘女士', '13600136202', '上海市黄浦区人民大道100号',   'RETAIL',     true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-CUS-003', 'F002', 'CUS003', 'CUS003', '外滩金融中心餐厅',   '孙总',   '13200132203', '上海市黄浦区中山东一路18号', 'ENTERPRISE', true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-CUS-004', 'F002', 'CUS004', 'CUS004', '散客堂食',           NULL,     NULL,          '上海市黄浦区南京东路100号',   'RETAIL',     true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================
-- 5. 采购订单 (purchase_orders) — 5 笔, 涵盖多种状态
-- ============================================================
INSERT INTO purchase_orders (id, factory_id, supplier_id, order_number, purchase_type, status, total_amount, order_date, expected_delivery_date, created_by, created_at, updated_at) VALUES
-- DRAFT: 未提交的草稿采购单
('F002-PO-001', 'F002', 'F002-SUP-001', 'PO-F002-20260219-001', 'DIRECT',  'DRAFT',     680.00, '2026-02-19', '2026-02-21', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- APPROVED: 已审批待收货
('F002-PO-002', 'F002', 'F002-SUP-002', 'PO-F002-20260218-001', 'DIRECT',  'APPROVED', 1280.00, '2026-02-18', '2026-02-19', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- COMPLETED: 已完成的采购单
('F002-PO-003', 'F002', 'F002-SUP-001', 'PO-F002-20260215-001', 'DIRECT',  'COMPLETED', 2340.00, '2026-02-15', '2026-02-16', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- SUBMITTED: 已提交审核中
('F002-PO-004', 'F002', 'F002-SUP-003', 'PO-F002-20260220-001', 'DIRECT',  'SUBMITTED',  420.00, '2026-02-20', '2026-02-22', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- CANCELLED: 已取消
('F002-PO-005', 'F002', 'F002-SUP-004', 'PO-F002-20260214-001', 'URGENT',  'CANCELLED',  380.00, '2026-02-14', '2026-02-15', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================
-- 5b. 采购订单明细 (purchase_order_items) — 每单 2-3 行
-- ============================================================
INSERT INTO purchase_order_items (purchase_order_id, material_type_id, material_name, quantity, unit, unit_price, received_quantity, remark, created_at, updated_at) VALUES
-- PO-001 (DRAFT): 鸡胸肉 + 五花肉
('F002-PO-001', 'F002-RM-001', '鸡胸肉', 15.00, 'kg', 24.00, 0.00, '本周鸡肉采购', NOW(), NOW()),
('F002-PO-001', 'F002-RM-003', '五花肉', 10.00, 'kg', 32.00, 0.00, '红烧肉备料',   NOW(), NOW()),
-- PO-002 (APPROVED): 蔬菜 + 豆腐 + 鸡翅
('F002-PO-002', 'F002-RM-007', '黄瓜',   30.00, 'kg',  4.00, 0.00, '凉菜用黄瓜',   NOW(), NOW()),
('F002-PO-002', 'F002-RM-006', '豆腐',   25.00, 'kg',  6.00, 0.00, '麻婆豆腐用',   NOW(), NOW()),
('F002-PO-002', 'F002-RM-002', '鸡翅',   20.00, 'kg', 28.00, 0.00, '口水鸡配料',   NOW(), NOW()),
-- PO-003 (COMPLETED): 肉类 + 大米 + 调味料 (全部已收货)
('F002-PO-003', 'F002-RM-001', '鸡胸肉', 30.00, 'kg', 24.00, 30.00, '上周鸡肉到货',   NOW(), NOW()),
('F002-PO-003', 'F002-RM-011', '大米',   50.00, 'kg',  5.50, 50.00, '大米补货完成',   NOW(), NOW()),
('F002-PO-003', 'F002-RM-013', '食用油', 40.00, 'L',  12.00, 40.00, '食用油大量采购', NOW(), NOW()),
-- PO-004 (SUBMITTED): 调味料采购
('F002-PO-004', 'F002-RM-015', '酱油',   20.00, 'L',   8.00, 0.00, '酱油补货',   NOW(), NOW()),
('F002-PO-004', 'F002-RM-016', '醋',     15.00, 'L',   6.00, 0.00, '醋补货',     NOW(), NOW()),
('F002-PO-004', 'F002-RM-017', '料酒',   10.00, 'L',   8.00, 0.00, '料酒补货',   NOW(), NOW()),
-- PO-005 (CANCELLED): 面粉紧急采购 (取消了)
('F002-PO-005', 'F002-RM-012', '面粉',   50.00, 'kg',  4.50, 0.00, '紧急采购已取消', NOW(), NOW()),
('F002-PO-005', 'F002-RM-005', '猪里脊', 10.00, 'kg', 36.00, 0.00, '取消',           NOW(), NOW());


-- ============================================================
-- 6. 销售订单 (sales_orders) — 5 笔, 涵盖多种状态
-- ============================================================
INSERT INTO sales_orders (id, factory_id, customer_id, order_number, status, total_amount, order_date, required_delivery_date, created_by, created_at, updated_at) VALUES
-- DRAFT: 新建草稿
('F002-SO-001', 'F002', 'F002-CUS-001', 'SO-F002-20260220-001', 'DRAFT',      1860.00, '2026-02-20', '2026-02-21', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- CONFIRMED: 已确认待配送
('F002-SO-002', 'F002', 'F002-CUS-002', 'SO-F002-20260219-001', 'CONFIRMED',  3200.00, '2026-02-19', '2026-02-19', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- PROCESSING: 配送中
('F002-SO-003', 'F002', 'F002-CUS-003', 'SO-F002-20260218-001', 'PROCESSING', 4800.00, '2026-02-18', '2026-02-18', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- COMPLETED: 已完成
('F002-SO-004', 'F002', 'F002-CUS-001', 'SO-F002-20260216-001', 'COMPLETED',  2580.00, '2026-02-16', '2026-02-16', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- CANCELLED: 已取消
('F002-SO-005', 'F002', 'F002-CUS-004', 'SO-F002-20260215-001', 'CANCELLED',   540.00, '2026-02-15', '2026-02-15', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================
-- 6b. 销售订单明细 (sales_order_items) — 每单 2-3 行
-- ============================================================
INSERT INTO sales_order_items (sales_order_id, product_type_id, product_name, quantity, unit, unit_price, delivered_quantity, remark, created_at, updated_at) VALUES
-- SO-001 (DRAFT): 热菜 + 主食
('F002-SO-001', 'F002-PT-001', '宫保鸡丁', 20.00, '份', 38.00, 0.00, '商务楼午餐订单',   NOW(), NOW()),
('F002-SO-001', 'F002-PT-009', '蛋炒饭',   30.00, '份', 18.00, 0.00, '配饭',             NOW(), NOW()),
('F002-SO-001', 'F002-PT-012', '酸辣汤',   20.00, '份', 22.00, 0.00, '配汤',             NOW(), NOW()),
-- SO-002 (CONFIRMED): 团购套餐
('F002-SO-002', 'F002-PT-003', '红烧肉',   30.00, '份', 48.00, 0.00, '社区团购热菜',     NOW(), NOW()),
('F002-SO-002', 'F002-PT-002', '麻婆豆腐', 25.00, '份', 28.00, 0.00, '社区团购热菜',     NOW(), NOW()),
('F002-SO-002', 'F002-PT-010', '扬州炒饭', 20.00, '份', 22.00, 0.00, '社区团购主食',     NOW(), NOW()),
-- SO-003 (PROCESSING): 金融中心大单
('F002-SO-003', 'F002-PT-005', '糖醋排骨', 40.00, '份', 48.00, 20.00, '外滩午餐配送中', NOW(), NOW()),
('F002-SO-003', 'F002-PT-001', '宫保鸡丁', 30.00, '份', 38.00, 15.00, '部分配送',       NOW(), NOW()),
('F002-SO-003', 'F002-PT-011', '小笼包',   20.00, '份', 28.00, 10.00, '部分配送',       NOW(), NOW()),
-- SO-004 (COMPLETED): 已完成配送
('F002-SO-004', 'F002-PT-004', '鱼香肉丝', 25.00, '份', 32.00, 25.00, '已全部送达',     NOW(), NOW()),
('F002-SO-004', 'F002-PT-006', '凉拌黄瓜', 30.00, '份', 12.00, 30.00, '已全部送达',     NOW(), NOW()),
('F002-SO-004', 'F002-PT-009', '蛋炒饭',   40.00, '份', 18.00, 40.00, '已全部送达',     NOW(), NOW()),
-- SO-005 (CANCELLED): 散客堂食 (取消)
('F002-SO-005', 'F002-PT-007', '口水鸡',   10.00, '份', 28.00, 0.00, '客户取消',       NOW(), NOW()),
('F002-SO-005', 'F002-PT-014', '芒果布丁', 10.00, '份', 18.00, 0.00, '客户取消',       NOW(), NOW());


-- ============================================================
-- 7. 退货记录 (return_orders + return_order_items)
--    1 采购退货 + 1 销售退货 + 1 待审核退货
-- ============================================================
INSERT INTO return_orders (id, factory_id, return_number, return_type, status, counterparty_id, source_order_id, return_date, total_amount, reason, created_by, created_at, updated_at) VALUES
-- 采购退货: 豆腐变质退回供应商
('F002-RO-001', 'F002', 'RO-F002-20260218-001', 'PURCHASE_RETURN', 'APPROVED', 'F002-SUP-002', 'F002-PO-003', '2026-02-18', 60.00, '豆腐到货后发现部分变质，退货10kg', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 销售退货: 客户退回多余菜品
('F002-RO-002', 'F002', 'RO-F002-20260217-001', 'SALES_RETURN',    'COMPLETED', 'F002-CUS-001', 'F002-SO-004', '2026-02-17', 96.00, '客户反馈宫保鸡丁口味偏辣，退回', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
-- 待审核: 采购退货草稿
('F002-RO-003', 'F002', 'RO-F002-20260220-001', 'PURCHASE_RETURN', 'DRAFT',    'F002-SUP-001', NULL,          '2026-02-20', 240.00, '鸡胸肉颜色异常，申请退货', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 退货明细
INSERT INTO return_order_items (return_order_id, material_type_id, product_type_id, item_name, quantity, unit_price, line_amount, batch_number, reason, created_at, updated_at) VALUES
-- RO-001 采购退货明细: 退豆腐
('F002-RO-001', 'F002-RM-006', NULL, '豆腐', 10.00, 6.00, 60.00, 'MB-F002-20260218-001', '部分变质，表面发粘', NOW(), NOW()),
-- RO-002 销售退货明细: 退菜品
('F002-RO-002', NULL, 'F002-PT-001', '宫保鸡丁', 2.00, 38.00, 76.00, NULL, '口味偏辣，客户要求退回', NOW(), NOW()),
('F002-RO-002', NULL, 'F002-PT-006', '凉拌黄瓜', 1.00, 12.00, 12.00, NULL, '打包漏液，品相不佳',     NOW(), NOW()),
('F002-RO-002', NULL, 'F002-PT-009', '蛋炒饭',   0.50, 18.00,  8.00, NULL, '冷了不好吃',             NOW(), NOW()),
-- RO-003 采购退货明细 (待审核): 退鸡胸肉
('F002-RO-003', 'F002-RM-001', NULL, '鸡胸肉', 10.00, 24.00, 240.00, 'MB-F002-20260201-001', '颜色发暗，疑似不新鲜', NOW(), NOW());


-- ============================================================
-- 8. 库存批次 (material_batches) — 10 笔
-- ============================================================
INSERT INTO material_batches (
    id, factory_id, batch_number, material_type_id, supplier_id,
    inbound_date, production_date, purchase_date, expire_date, version,
    receipt_quantity, quantity_unit, used_quantity, reserved_quantity,
    unit_price, status, storage_location, notes, created_by, created_at, updated_at
) VALUES
-- 鸡胸肉 (正常库存)
('F002-MB-001', 'F002', 'MB-F002-20260201-001', 'F002-RM-001', 'F002-SUP-001',
 '2026-02-01', '2026-01-28', '2026-02-01', '2026-05-01', 0,
 30.00, 'kg', 12.00, 0.00,
 24.00, 'AVAILABLE', '冷冻柜A-01', '鸡胸肉第一批', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 豆腐 (即将过期, 3天保质期)
('F002-MB-002', 'F002', 'MB-F002-20260219-001', 'F002-RM-006', 'F002-SUP-002',
 '2026-02-19', '2026-02-19', '2026-02-19', '2026-02-22', 0,
 20.00, 'kg', 8.00, 0.00,
 6.00, 'AVAILABLE', '冷藏柜B-01', '豆腐今日到货，3日内使用', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 五花肉 (正常库存)
('F002-MB-003', 'F002', 'MB-F002-20260205-001', 'F002-RM-003', 'F002-SUP-001',
 '2026-02-05', '2026-02-02', '2026-02-05', '2026-05-05', 0,
 25.00, 'kg', 10.00, 0.00,
 32.00, 'AVAILABLE', '冷冻柜A-02', '五花肉批次', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 大米 (干货，库存充足)
('F002-MB-004', 'F002', 'MB-F002-20260101-001', 'F002-RM-011', 'F002-SUP-001',
 '2026-01-01', '2025-11-01', '2026-01-01', '2026-12-31', 0,
 100.00, 'kg', 45.00, 0.00,
 5.50, 'AVAILABLE', '干货架C-01', '大米库存', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 食用油 (干货)
('F002-MB-005', 'F002', 'MB-F002-20260110-001', 'F002-RM-013', 'F002-SUP-001',
 '2026-01-10', '2025-10-01', '2026-01-10', '2026-10-01', 0,
 40.00, 'L', 18.00, 0.00,
 12.00, 'AVAILABLE', '干货架C-02', '食用油库存', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 酱油 (调味料)
('F002-MB-006', 'F002', 'MB-F002-20260115-001', 'F002-RM-015', 'F002-SUP-003',
 '2026-01-15', '2025-09-01', '2026-01-15', '2026-09-01', 0,
 20.00, 'L', 8.00, 0.00,
 8.00, 'AVAILABLE', '调味料架D-01', '酱油库存', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 黄瓜 (蔬菜，近期到货)
('F002-MB-007', 'F002', 'MB-F002-20260219-002', 'F002-RM-007', 'F002-SUP-002',
 '2026-02-19', '2026-02-18', '2026-02-19', '2026-02-26', 0,
 30.00, 'kg', 5.00, 0.00,
 4.00, 'AVAILABLE', '蔬菜冷藏E-01', '黄瓜今日到货', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 排骨 (冷冻)
('F002-MB-008', 'F002', 'MB-F002-20260208-001', 'F002-RM-004', 'F002-SUP-001',
 '2026-02-08', '2026-02-06', '2026-02-08', '2026-05-08', 0,
 20.00, 'kg', 7.00, 0.00,
 38.00, 'AVAILABLE', '冷冻柜A-03', '排骨批次', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 鲜奶 (即将过期，用于保质期预警测试)
('F002-MB-009', 'F002', 'MB-F002-20260219-003', 'F002-RM-020', 'F002-SUP-002',
 '2026-02-19', '2026-02-18', '2026-02-19', '2026-02-22', 0,
 10.00, 'L', 3.00, 0.00,
 10.00, 'AVAILABLE', '冷藏柜B-02', '鲜奶3天后过期', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 猪里脊 (冷冻，已用完大部分，低库存)
('F002-MB-010', 'F002', 'MB-F002-20260201-002', 'F002-RM-005', 'F002-SUP-001',
 '2026-02-01', '2026-01-30', '2026-02-01', '2026-05-01', 0,
 15.00, 'kg', 13.50, 0.00,
 36.00, 'AVAILABLE', '冷冻柜A-04', '猪里脊库存偏低，剩余1.5kg', (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================
-- 9. 工厂功能配置 (factory_feature_config)
--    为 F002 启用餐饮相关模块
-- ============================================================
INSERT INTO factory_feature_config (factory_id, module_id, module_name, enabled, config, created_at, updated_at) VALUES
('F002', 'smartbi',     'SmartBI 数据分析', true, '{}', NOW(), NOW()),
('F002', 'ai_analysis', 'AI 智能分析',      true, '{}', NOW(), NOW()),
('F002', 'ai_chat',     'AI 对话助手',      true, '{}', NOW(), NOW()),
('F002', 'inventory',   '库存管理',         true, '{"mode": "restaurant"}', NOW(), NOW()),
('F002', 'purchasing',  '采购管理',         true, '{}', NOW(), NOW()),
('F002', 'sales',       '销售管理',         true, '{}', NOW(), NOW()),
('F002', 'recipe',      '配方管理',         true, '{}', NOW(), NOW()),
('F002', 'wastage',     '损耗管理',         true, '{}', NOW(), NOW())
ON CONFLICT (factory_id, module_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW();


-- ============================================================
-- 10. 清理工厂告警泄漏 + 添加餐饮适用告警
-- ============================================================

-- 删除 F002 不应该看到的工厂设备类告警 (属于 F001 工厂场景)
DELETE FROM production_alerts
WHERE factory_id = 'F002'
  AND alert_type IN ('YIELD_DROP', 'COST_SPIKE', 'OEE_LOW', 'QUALITY_FAIL', 'EQUIPMENT_MAINTENANCE');

-- 添加餐饮适用的告警
INSERT INTO production_alerts (factory_id, alert_type, level, status, metric_name, current_value, baseline_value, threshold_value, description, created_at, updated_at) VALUES
-- 低库存告警: 鸡胸肉
('F002', 'YIELD_DROP', 'WARNING', 'ACTIVE', 'stock_level',
 5.0, 10.0, 5.0,
 '食材 [鸡胸肉] 库存不足，当前剩余约5kg，低于最低库存10kg，建议尽快补货',
 NOW(), NOW()),
-- 保质期预警: 鲜奶
('F002', 'QUALITY_FAIL', 'WARNING', 'ACTIVE', 'expiry_days',
 3.0, 30.0, 5.0,
 '食材 [鲜奶] 将于3天后过期（2026-02-22），剩余7L，请优先使用',
 NOW(), NOW()),
-- 保质期预警: 豆腐
('F002', 'QUALITY_FAIL', 'WARNING', 'ACTIVE', 'expiry_days',
 3.0, 14.0, 3.0,
 '食材 [豆腐] 将于3天后过期（2026-02-22），剩余12kg，请尽快消耗',
 NOW(), NOW());


-- ============================================================
-- 11. BOM 配方 (recipes) — 8 道菜的配方
-- ============================================================
INSERT INTO recipes (
    id, factory_id, product_type_id, raw_material_type_id,
    standard_quantity, unit, net_yield_rate, is_main_ingredient,
    notes, is_active, created_by, created_at, updated_at
) VALUES
-- 宫保鸡丁 (PT-001): 鸡胸肉、辣椒、食用油、酱油、生姜、料酒
('F002-RCP-001', 'F002', 'F002-PT-001', 'F002-RM-001', 0.2000, 'kg', 0.9500, true,  '鸡胸肉切丁，主料',     true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-002', 'F002', 'F002-PT-001', 'F002-RM-019', 0.0150, 'kg', 1.0000, false, '干辣椒段',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-003', 'F002', 'F002-PT-001', 'F002-RM-013', 0.0300, 'L',  1.0000, false, '食用油炒制',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-004', 'F002', 'F002-PT-001', 'F002-RM-015', 0.0200, 'L',  1.0000, false, '酱油调味',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-005', 'F002', 'F002-PT-001', 'F002-RM-009', 0.0100, 'kg', 0.9000, false, '生姜去腥',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-006', 'F002', 'F002-PT-001', 'F002-RM-017', 0.0150, 'L',  1.0000, false, '料酒腌制',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 麻婆豆腐 (PT-002): 豆腐、猪里脊、辣椒、花椒、食用油
('F002-RCP-007', 'F002', 'F002-PT-002', 'F002-RM-006', 0.3000, 'kg', 1.0000, true,  '豆腐切小块，主料',     true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-008', 'F002', 'F002-PT-002', 'F002-RM-005', 0.1000, 'kg', 0.9500, true,  '猪里脊剁肉末',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-009', 'F002', 'F002-PT-002', 'F002-RM-019', 0.0200, 'kg', 1.0000, false, '辣椒面调味',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-010', 'F002', 'F002-PT-002', 'F002-RM-018', 0.0050, 'kg', 1.0000, false, '花椒粉增麻香',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-011', 'F002', 'F002-PT-002', 'F002-RM-013', 0.0250, 'L',  1.0000, false, '食用油炒制',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 红烧肉 (PT-003): 五花肉、酱油、料酒、生姜、盐
('F002-RCP-012', 'F002', 'F002-PT-003', 'F002-RM-003', 0.3500, 'kg', 0.9000, true,  '五花肉切方块，主料',   true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-013', 'F002', 'F002-PT-003', 'F002-RM-015', 0.0300, 'L',  1.0000, false, '酱油调色调味',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-014', 'F002', 'F002-PT-003', 'F002-RM-017', 0.0300, 'L',  1.0000, false, '料酒去腥增香',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-015', 'F002', 'F002-PT-003', 'F002-RM-009', 0.0150, 'kg', 0.8500, false, '生姜去腥',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-016', 'F002', 'F002-PT-003', 'F002-RM-014', 0.0050, 'kg', 1.0000, false, '食盐调味',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 蛋炒饭 (PT-009): 大米、食用油、盐、葱
('F002-RCP-017', 'F002', 'F002-PT-009', 'F002-RM-011', 0.2000, 'kg', 1.0000, true,  '大米煮成米饭',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-018', 'F002', 'F002-PT-009', 'F002-RM-013', 0.0200, 'L',  1.0000, false, '食用油翻炒',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-019', 'F002', 'F002-PT-009', 'F002-RM-014', 0.0030, 'kg', 1.0000, false, '盐调味',               true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-020', 'F002', 'F002-PT-009', 'F002-RM-010', 0.0100, 'kg', 0.9000, false, '葱花增香',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 糖醋排骨 (PT-005): 排骨、醋、酱油、料酒、生姜
('F002-RCP-021', 'F002', 'F002-PT-005', 'F002-RM-004', 0.4000, 'kg', 0.7000, true,  '排骨斩件，含骨净料率约70%', true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-022', 'F002', 'F002-PT-005', 'F002-RM-016', 0.0250, 'L',  1.0000, false, '醋（糖醋汁）',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-023', 'F002', 'F002-PT-005', 'F002-RM-015', 0.0200, 'L',  1.0000, false, '酱油调色',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-024', 'F002', 'F002-PT-005', 'F002-RM-017', 0.0200, 'L',  1.0000, false, '料酒去腥腌制',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-025', 'F002', 'F002-PT-005', 'F002-RM-009', 0.0100, 'kg', 0.9000, false, '生姜去腥',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 凉拌黄瓜 (PT-006): 黄瓜、醋、酱油、辣椒、盐
('F002-RCP-026', 'F002', 'F002-PT-006', 'F002-RM-007', 0.2500, 'kg', 0.9000, true,  '黄瓜拍碎',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-027', 'F002', 'F002-PT-006', 'F002-RM-016', 0.0150, 'L',  1.0000, false, '醋调酸味',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-028', 'F002', 'F002-PT-006', 'F002-RM-015', 0.0100, 'L',  1.0000, false, '酱油调鲜',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-029', 'F002', 'F002-PT-006', 'F002-RM-019', 0.0050, 'kg', 1.0000, false, '辣椒油调辣',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-030', 'F002', 'F002-PT-006', 'F002-RM-014', 0.0040, 'kg', 1.0000, false, '盐调味',               true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 鱼香肉丝 (PT-004): 猪里脊、青椒、食用油、酱油、醋
('F002-RCP-031', 'F002', 'F002-PT-004', 'F002-RM-005', 0.1800, 'kg', 0.9500, true,  '猪里脊切丝，主料',     true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-032', 'F002', 'F002-PT-004', 'F002-RM-008', 0.0800, 'kg', 0.8500, true,  '青椒切丝配菜',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-033', 'F002', 'F002-PT-004', 'F002-RM-013', 0.0300, 'L',  1.0000, false, '食用油炒制',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-034', 'F002', 'F002-PT-004', 'F002-RM-015', 0.0150, 'L',  1.0000, false, '酱油调味',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-035', 'F002', 'F002-PT-004', 'F002-RM-016', 0.0150, 'L',  1.0000, false, '醋增酸味（鱼香汁）',   true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),

-- 小笼包 (PT-011): 面粉、猪里脊、生姜、酱油、料酒、盐
('F002-RCP-036', 'F002', 'F002-PT-011', 'F002-RM-012', 0.1500, 'kg', 1.0000, true,  '面粉和面做包子皮',     true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-037', 'F002', 'F002-PT-011', 'F002-RM-005', 0.1200, 'kg', 0.9500, true,  '猪里脊剁馅',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-038', 'F002', 'F002-PT-011', 'F002-RM-009', 0.0080, 'kg', 0.9000, false, '姜末去腥',             true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-039', 'F002', 'F002-PT-011', 'F002-RM-015', 0.0120, 'L',  1.0000, false, '酱油调馅味',           true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW()),
('F002-RCP-040', 'F002', 'F002-PT-011', 'F002-RM-017', 0.0100, 'L',  1.0000, false, '料酒去腥增香',         true, (SELECT val FROM _seed_vars WHERE key='admin_id'), NOW(), NOW())

ON CONFLICT DO NOTHING;


-- ============================================================
-- 12. 额外员工 (供 F002 餐厅使用)
-- ============================================================
DO $$
DECLARE
    v_pwd_hash TEXT;
BEGIN
    SELECT password_hash INTO v_pwd_hash FROM users WHERE username = 'factory_admin1' LIMIT 1;
    IF v_pwd_hash IS NULL THEN
        v_pwd_hash := '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse';
    END IF;

    -- 厨师长
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('F002', 'zj_chef1', v_pwd_hash, '张记厨师长', 'workshop_supervisor', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;

    -- 采购员 (仓储角色)
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('F002', 'zj_buyer1', v_pwd_hash, '张记采购员', 'warehouse_manager', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;

    -- 服务员
    INSERT INTO users (factory_id, username, password_hash, full_name, role_code, level, is_active, created_at, updated_at)
    VALUES ('F002', 'zj_staff1', v_pwd_hash, '张记服务员', 'operator', 0, true, NOW(), NOW())
    ON CONFLICT (username) DO NOTHING;
END $$;


-- ============================================================
-- 清理临时表
-- ============================================================
DROP TABLE IF EXISTS _seed_vars;

COMMIT;


-- ============================================================
-- 验证查询 (手动执行，不在事务内)
-- ============================================================
SELECT '=== F002 餐饮数据验证 ===' AS info;
SELECT 'Factory: '          || count(*) FROM factories WHERE id = 'F002';
SELECT 'Users: '            || count(*) FROM users WHERE factory_id = 'F002';
SELECT 'ProductTypes: '     || count(*) FROM product_types WHERE factory_id = 'F002';
SELECT 'RawMaterialTypes: ' || count(*) FROM raw_material_types WHERE factory_id = 'F002';
SELECT 'Suppliers: '        || count(*) FROM suppliers WHERE factory_id = 'F002';
SELECT 'Customers: '        || count(*) FROM customers WHERE factory_id = 'F002';
SELECT 'PurchaseOrders: '   || count(*) FROM purchase_orders WHERE factory_id = 'F002';
SELECT 'PurchaseItems: '    || count(*) FROM purchase_order_items WHERE purchase_order_id LIKE 'F002-%';
SELECT 'SalesOrders: '      || count(*) FROM sales_orders WHERE factory_id = 'F002';
SELECT 'SalesItems: '       || count(*) FROM sales_order_items WHERE sales_order_id LIKE 'F002-%';
SELECT 'ReturnOrders: '     || count(*) FROM return_orders WHERE factory_id = 'F002';
SELECT 'ReturnItems: '      || count(*) FROM return_order_items WHERE return_order_id LIKE 'F002-%';
SELECT 'MaterialBatches: '  || count(*) FROM material_batches WHERE factory_id = 'F002';
SELECT 'FeatureConfig: '    || count(*) FROM factory_feature_config WHERE factory_id = 'F002';
SELECT 'Recipes: '          || count(*) FROM recipes WHERE factory_id = 'F002';
SELECT 'Alerts: '           || count(*) FROM production_alerts WHERE factory_id = 'F002';

-- 详细验证
-- SELECT id, status, total_amount FROM purchase_orders WHERE factory_id = 'F002' ORDER BY order_date;
-- SELECT id, status, total_amount FROM sales_orders WHERE factory_id = 'F002' ORDER BY order_date;
-- SELECT id, return_type, status, total_amount FROM return_orders WHERE factory_id = 'F002';
-- SELECT id, batch_number, receipt_quantity - used_quantity AS remaining FROM material_batches WHERE factory_id = 'F002';
-- SELECT module_id, module_name, enabled FROM factory_feature_config WHERE factory_id = 'F002';
