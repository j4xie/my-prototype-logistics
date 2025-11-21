-- ============================================================
-- 多工厂完整测试数据脚本 (Multi-Factory Complete Test Data)
-- ============================================================
-- 日期: 2025-11-22
-- 数据库: cretas_db
-- 用途: 在服务器上插入3个不同业务线的工厂测试数据
-- ============================================================

USE cretas_db;

-- ============================================================
-- 第1部分: 更新用户密码 (所有工厂)
-- ============================================================
UPDATE users SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username IN ('super_admin', 'dept_admin', 'operator1');

UPDATE platform_admins SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username = 'platform_admin';

-- ============================================================
-- 第2部分: 工厂1 (F001) - 海鲜冷冻加工厂
-- 业务线: 海鲜产品冷冻加工、包装、冷链存储
-- ============================================================

-- 产品类型 - 海鲜冷冻系列
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('F001-PT001', 'F001', '冷冻鱼片', 'FROZEN-FISH-FILLET', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('F001-PT002', 'F001', '冷冻虾仁', 'FROZEN-SHRIMP-MEAT', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('F001-PT003', 'F001', '冷冻鱼块', 'FROZEN-FISH-CHUNK', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('F001-PT004', 'F001', '冷冻带鱼段', 'FROZEN-RIBBONFISH', '海鲜', '公斤', 1, 360, NOW(), NOW());

-- 原料类型 - 海洋产品
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('F001-RMT001', 'F001', '鲜活鱼', 'FRESH-FISH', '海鲜', '公斤', '冷藏', 1, 3, NOW(), NOW()),
('F001-RMT002', 'F001', '鲜活虾', 'FRESH-SHRIMP', '海鲜', '公斤', '冷藏', 1, 2, NOW(), NOW()),
('F001-RMT003', 'F001', '带鱼', 'RIBBONFISH', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('F001-RMT004', 'F001', '食盐(防腐)', 'SALT-PRESERVATIVE', '调料', '公斤', '常温', 1, 730, NOW(), NOW());

-- 部门 - 海鲜加工流程
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(101, 'F001', '收购部', 'PROCUREMENT-F001', 1, 1, NOW(), NOW()),
(102, 'F001', '加工部', 'PROCESSING-F001', 1, 2, NOW(), NOW()),
(103, 'F001', '冷链部', 'COLD-CHAIN-F001', 1, 3, NOW(), NOW()),
(104, 'F001', '质检部', 'QC-F001', 1, 4, NOW(), NOW()),
(105, 'F001', '销售部', 'SALES-F001', 1, 5, NOW(), NOW());

-- 供应商 - 海鲜产地
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, contact_phone, contact_email, address, is_active, rating, created_at, updated_at) VALUES
(201, 'F001', '舟山渔业有限公司', '张渔主', '13800138001', 'zsfish@ocean.com', '浙江省舟山市普陀区', 1, 5, NOW(), NOW()),
(202, 'F001', '三亚海产批发', '李海山', '13900139001', 'lihaishan@seafood.com', '海南省三亚市吉阳区', 1, 5, NOW(), NOW()),
(203, 'F001', '青岛海鲜市场', '王青海', '15500156001', 'qingdao@market.com', '山东省青岛市黄岛区', 1, 4, NOW(), NOW());

-- 客户 - 海鲜经销商/餐饮
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, contact_phone, contact_email, type, is_active, rating, created_at, updated_at) VALUES
(301, 'F001', '大洋超市连锁', '陈海洋', '13900139101', 'chen@ocean-market.com', '零售', 1, 5, NOW(), NOW()),
(302, 'F001', '海底捞火锅集团', '刘海底', '13900139102', 'liu@haidilao.com', '餐饮', 1, 5, NOW(), NOW()),
(303, 'F001', '新鲜海产批发', '周鲜鱼', '13900139103', 'zhou@seafood-wholesale.com', '批发', 1, 5, NOW(), NOW());

-- ============================================================
-- 第3部分: 工厂2 (F002) - 肉制品深加工厂
-- 业务线: 禽肉/牛肉/猪肉深加工、腌制、烟熏、包装
-- ============================================================

-- 产品类型 - 肉制品系列
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('F002-PT001', 'F002', '腌制鸡肉', 'SALTED-CHICKEN', '肉制品', '公斤', 1, 180, NOW(), NOW()),
('F002-PT002', 'F002', '烟熏猪肉', 'SMOKED-PORK', '肉制品', '公斤', 1, 120, NOW(), NOW()),
('F002-PT003', 'F002', '午餐肉罐头', 'LUNCHEON-MEAT', '肉制品', '罐', 1, 730, NOW(), NOW()),
('F002-PT004', 'F002', '肉类香肠', 'SAUSAGE', '肉制品', '公斤', 1, 90, NOW(), NOW());

-- 原料类型 - 畜禽产品
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('F002-RMT001', 'F002', '新鲜鸡肉', 'FRESH-CHICKEN', '肉类', '公斤', '冷藏', 1, 5, NOW(), NOW()),
('F002-RMT002', 'F002', '冷冻猪肉', 'FROZEN-PORK', '肉类', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('F002-RMT003', 'F002', '腌制盐', 'CURING-SALT', '调料', '公斤', '常温', 1, 730, NOW(), NOW()),
('F002-RMT004', 'F002', '烟熏香料', 'SMOKE-SPICE', '调料', '公斤', '常温', 1, 365, NOW(), NOW());

-- 部门 - 肉制品加工流程
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(201, 'F002', '采购部', 'PROCUREMENT-F002', 1, 1, NOW(), NOW()),
(202, 'F002', '腌制车间', 'CURING-WORKSHOP', 1, 2, NOW(), NOW()),
(203, 'F002', '烟熏车间', 'SMOKING-WORKSHOP', 1, 3, NOW(), NOW()),
(204, 'F002', '包装部', 'PACKAGING-F002', 1, 4, NOW(), NOW()),
(205, 'F002', '仓储部', 'WAREHOUSE-F002', 1, 5, NOW(), NOW());

-- 供应商 - 畜禽产品
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, contact_phone, contact_email, address, is_active, rating, created_at, updated_at) VALUES
(204, 'F002', '山东禽肉有限公司', '王禽农', '13800138002', 'wangpoultry@farm.com', '山东省济宁市任城区', 1, 5, NOW(), NOW()),
(205, 'F002', '河南猪肉养殖基地', '李猪王', '13800138003', 'lipork@farm.com', '河南省郑州市中牟县', 1, 4, NOW(), NOW()),
(206, 'F002', '优质香料供应商', '赵香料', '13800138004', 'zhaospice@supplier.com', '广东省广州市白云区', 1, 5, NOW(), NOW());

-- 客户 - 肉制品经销
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, contact_phone, contact_email, type, is_active, rating, created_at, updated_at) VALUES
(304, 'F002', '永辉超市集团', '陈肉品', '13900139104', 'chen@yonghui.com', '零售', 1, 5, NOW(), NOW()),
(305, 'F002', '真功夫餐饮', '刘快餐', '13900139105', 'liu@zhenggongfu.com', '餐饮', 1, 5, NOW(), NOW()),
(306, 'F002', '肉类食品批发', '周肉商', '13900139106', 'zhou@meat-wholesale.com', '批发', 1, 4, NOW(), NOW());

-- ============================================================
-- 第4部分: 工厂3 (F003) - 果蔬加工厂
-- 业务线: 新鲜蔬果、冷冻蔬菜、果汁、蔬菜罐头
-- ============================================================

-- 产品类型 - 蔬果加工系列
INSERT IGNORE INTO product_types (id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at) VALUES
('F003-PT001', 'F003', '速冻混合蔬菜', 'FROZEN-MIXED-VEG', '蔬菜', '公斤', 1, 180, NOW(), NOW()),
('F003-PT002', 'F003', '新鲜果汁', 'FRESH-JUICE', '饮品', '升', 1, 30, NOW(), NOW()),
('F003-PT003', 'F003', '蔬菜罐头', 'VEGETABLE-CANNED', '蔬菜', '罐', 1, 365, NOW(), NOW()),
('F003-PT004', 'F003', '速冻水果粒', 'FROZEN-FRUIT-GRANULE', '水果', '公斤', 1, 180, NOW(), NOW());

-- 原料类型 - 农产品
INSERT IGNORE INTO raw_material_types (id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at) VALUES
('F003-RMT001', 'F003', '新鲜叶菜', 'FRESH-LEAFY-VEG', '蔬菜', '公斤', '冷藏', 1, 7, NOW(), NOW()),
('F003-RMT002', 'F003', '新鲜果实', 'FRESH-FRUIT', '水果', '公斤', '冷藏', 1, 10, NOW(), NOW()),
('F003-RMT003', 'F003', '冷冻根茎菜', 'FROZEN-ROOT-VEG', '蔬菜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('F003-RMT004', 'F003', '食品添加剂', 'FOOD-ADDITIVES', '添加剂', '公斤', '常温', 1, 730, NOW(), NOW());

-- 部门 - 果蔬加工流程
INSERT IGNORE INTO departments (id, factory_id, name, code, is_active, display_order, created_at, updated_at) VALUES
(301, 'F003', '采购部', 'PROCUREMENT-F003', 1, 1, NOW(), NOW()),
(302, 'F003', '清洗车间', 'WASHING-WORKSHOP', 1, 2, NOW(), NOW()),
(303, 'F003', '冷冻车间', 'FREEZING-WORKSHOP', 1, 3, NOW(), NOW()),
(304, 'F003', '榨汁车间', 'JUICE-WORKSHOP', 1, 4, NOW(), NOW()),
(305, 'F003', '罐装车间', 'CANNING-WORKSHOP', 1, 5, NOW(), NOW());

-- 供应商 - 农产品基地
INSERT IGNORE INTO suppliers (id, factory_id, name, contact_person, contact_phone, contact_email, address, is_active, rating, created_at, updated_at) VALUES
(207, 'F003', '江苏蔬菜种植基地', '王青菜', '13800138005', 'wangvegetable@farm.com', '江苏省南京市浦口区', 1, 5, NOW(), NOW()),
(208, 'F003', '山东水果种植园', '李水果', '13800138006', 'lifruit@farm.com', '山东省烟台市牟平区', 1, 5, NOW(), NOW()),
(209, 'F003', '食品添加剂供应', '赵添加剂', '13800138007', 'zhaoadditive@supplier.com', '浙江省杭州市滨江区', 1, 4, NOW(), NOW());

-- 客户 - 零售/餐饮/批发
INSERT IGNORE INTO customers (id, factory_id, name, contact_person, contact_phone, contact_email, type, is_active, rating, created_at, updated_at) VALUES
(307, 'F003', '家乐福超市', '陈蔬果', '13900139107', 'chen@carrefour.com', '零售', 1, 5, NOW(), NOW()),
(308, 'F003', '快乐蜂便利店', '刘便利', '13900139108', 'liu@happybee.com', '零售', 1, 4, NOW(), NOW()),
(309, 'F003', '果汁饮品批发', '周果商', '13900139109', 'zhou@juice-wholesale.com', '批发', 1, 5, NOW(), NOW());

-- ============================================================
-- 第5部分: 验证所有工厂的数据
-- ============================================================

SELECT '==================== 数据导入验证 ====================' AS '';
SELECT '' AS '';

SELECT '✅ 工厂1 (F001 - 海鲜冷冻加工厂)' AS Category;
SELECT
  (SELECT COUNT(*) FROM product_types WHERE factory_id='F001') AS 产品数,
  (SELECT COUNT(*) FROM raw_material_types WHERE factory_id='F001') AS 原料数,
  (SELECT COUNT(*) FROM departments WHERE factory_id='F001') AS 部门数,
  (SELECT COUNT(*) FROM suppliers WHERE factory_id='F001') AS 供应商数,
  (SELECT COUNT(*) FROM customers WHERE factory_id='F001') AS 客户数;

SELECT '' AS '';
SELECT '✅ 工厂2 (F002 - 肉制品深加工厂)' AS Category;
SELECT
  (SELECT COUNT(*) FROM product_types WHERE factory_id='F002') AS 产品数,
  (SELECT COUNT(*) FROM raw_material_types WHERE factory_id='F002') AS 原料数,
  (SELECT COUNT(*) FROM departments WHERE factory_id='F002') AS 部门数,
  (SELECT COUNT(*) FROM suppliers WHERE factory_id='F002') AS 供应商数,
  (SELECT COUNT(*) FROM customers WHERE factory_id='F002') AS 客户数;

SELECT '' AS '';
SELECT '✅ 工厂3 (F003 - 果蔬加工厂)' AS Category;
SELECT
  (SELECT COUNT(*) FROM product_types WHERE factory_id='F003') AS 产品数,
  (SELECT COUNT(*) FROM raw_material_types WHERE factory_id='F003') AS 原料数,
  (SELECT COUNT(*) FROM departments WHERE factory_id='F003') AS 部门数,
  (SELECT COUNT(*) FROM suppliers WHERE factory_id='F003') AS 供应商数,
  (SELECT COUNT(*) FROM customers WHERE factory_id='F003') AS 客户数;

SELECT '' AS '';
SELECT '==================== 用户账号信息 ====================' AS '';
SELECT '用户名' AS username, '角色' AS role, '密码' AS password;
SELECT 'super_admin' AS '', 'factory_super_admin' AS '', '123456' AS '';
SELECT 'dept_admin' AS '', 'department_admin' AS '', '123456' AS '';
SELECT 'operator1' AS '', 'operator' AS '', '123456' AS '';
SELECT 'platform_admin' AS '', 'platform_admin' AS '', '123456' AS '';

SELECT '' AS '';
SELECT '==================== 多工厂测试数据导入成功！====================' AS Status;
SELECT '总计: 12个产品 + 12个原料 + 15个部门 + 9个供应商 + 9个客户' AS Summary;
SELECT '3个工厂已就绪，可进行多工厂场景测试' AS 'Next Steps';
