-- =====================================================
-- 白垩纪食品溯源系统 - 真实测试数据导入脚本
-- Cretas Food Traceability System - Realistic Test Data Import
-- =====================================================
--
-- 执行方式:
-- 方式1: mysql -u root -p cretas_db < 00_import_all.sql
-- 方式2: 在 MySQL 客户端中执行: source /path/to/00_import_all.sql
--
-- 数据说明:
-- - 时间跨度: 2025-11-01 ~ 2025-12-29 (约2个月)
-- - 5个工厂: F001(舟山), F002(青岛), F003(厦门), F004(湛江), F005(大连)
-- - 使用 INSERT IGNORE 追加模式，不影响现有数据
-- - 总计约 1185 条记录
--
-- 数据来源:
-- - 真实中国水产企业名称和地址
-- - 真实海鲜品种和市场价格
-- - 真实物流公司和配送地址
--
-- 创建日期: 2025-12-29
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

SELECT '===========================================' AS '';
SELECT '开始导入真实测试数据...' AS '状态';
SELECT '===========================================' AS '';

-- =====================================================
-- 第一步: 基础主数据 (无外键依赖)
-- =====================================================

SELECT '导入工厂数据 (5条)...' AS '进度';
SOURCE 01_factories.sql;

SELECT '导入用户数据 (100条)...' AS '进度';
SOURCE 02_users.sql;

SELECT '导入原材料类型数据 (30条)...' AS '进度';
SOURCE 03_raw_material_types.sql;

SELECT '导入产品类型数据 (30条)...' AS '进度';
SOURCE 04_product_types.sql;

-- =====================================================
-- 第二步: 关联主数据 (依赖工厂)
-- =====================================================

SELECT '导入供应商数据 (50条)...' AS '进度';
SOURCE 05_suppliers.sql;

SELECT '导入客户数据 (50条)...' AS '进度';
SOURCE 06_customers.sql;

SELECT '导入设备数据 (50条)...' AS '进度';
SOURCE 07_equipment.sql;

-- =====================================================
-- 第三步: 业务数据 (依赖主数据)
-- =====================================================

SELECT '导入原材料批次数据 (200条)...' AS '进度';
SOURCE 08_material_batches.sql;

SELECT '导入生产计划数据 (150条)...' AS '进度';
SOURCE 09_production_plans.sql;

SELECT '导入生产批次数据 (200条)...' AS '进度';
SOURCE 10_production_batches.sql;

SELECT '导入质检记录数据 (200条)...' AS '进度';
SOURCE 11_quality_inspections.sql;

SELECT '导入出货记录数据 (150条)...' AS '进度';
SOURCE 12_shipment_records.sql;

SELECT '导入考勤记录数据 (200条)...' AS '进度';
SOURCE 13_time_clock_records.sql;

-- =====================================================
-- 恢复外键检查
-- =====================================================

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 导入结果验证
-- =====================================================

SELECT '===========================================' AS '';
SELECT '导入完成! 验证数据...' AS '状态';
SELECT '===========================================' AS '';

SELECT '表名' AS 'Table', '记录数' AS 'Count' UNION ALL
SELECT 'factories', (SELECT COUNT(*) FROM factories WHERE id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'users', (SELECT COUNT(*) FROM users WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'raw_material_types', (SELECT COUNT(*) FROM raw_material_types WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'product_types', (SELECT COUNT(*) FROM product_types WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'suppliers', (SELECT COUNT(*) FROM suppliers WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'customers', (SELECT COUNT(*) FROM customers WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'factory_equipment', (SELECT COUNT(*) FROM factory_equipment WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'material_batches', (SELECT COUNT(*) FROM material_batches WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'production_plans', (SELECT COUNT(*) FROM production_plans WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'production_batches', (SELECT COUNT(*) FROM production_batches WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'quality_inspections', (SELECT COUNT(*) FROM quality_inspections WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'shipment_records', (SELECT COUNT(*) FROM shipment_records WHERE factory_id IN ('F001','F002','F003','F004','F005')) UNION ALL
SELECT 'time_clock_records', (SELECT COUNT(*) FROM time_clock_records WHERE factory_id IN ('F001','F002','F003','F004','F005'));

SELECT '===========================================' AS '';
SELECT '所有测试数据导入完成!' AS '状态';
SELECT '===========================================' AS '';
