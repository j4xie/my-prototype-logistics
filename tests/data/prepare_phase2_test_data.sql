-- Phase 2 测试数据准备脚本
-- 生成时间: 2025-11-20
-- 用途: 为Phase 2.1-2.8测试准备基础数据

USE cretas_db;

-- ==========================================
-- 1. 原料类型 (raw_material_types)
-- ==========================================
INSERT INTO raw_material_types (id, factory_id, material_code, code, name, category, unit, unit_price, min_stock, max_stock, shelf_life_days, storage_type, description, is_active, created_at, updated_at, created_by)
VALUES
('MT001', 'CRETAS_2024_001', 'MAT-FISH-001', 'MT001', '鲜鱼', '海鲜', 'kg', 35.00, 50.00, 500.00, 3, '冷藏 0-4°C', '新鲜海鱼，用于加工海鲜产品', 1, NOW(), NOW(), 1),
('MT002', 'CRETAS_2024_001', 'MAT-CHICKEN-001', 'MT002', '鸡胸肉', '肉类', 'kg', 28.00, 100.00, 800.00, 5, '冷藏 0-4°C', '优质鸡胸肉，用于肉类加工', 1, NOW(), NOW(), 1),
('MT003', 'CRETAS_2024_001', 'MAT-VEG-001', 'MT003', '大白菜', '蔬菜', 'kg', 3.50, 200.00, 1000.00, 7, '常温通风', '新鲜蔬菜，用于食品加工', 1, NOW(), NOW(), 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==========================================
-- 2. 供应商 (suppliers)
-- ==========================================
INSERT INTO suppliers (id, factory_id, supplier_code, code, name, contact_person, contact_phone, contact_email, address, business_license, quality_certificates, bank_name, bank_account, credit_level, payment_terms, is_active, created_at, updated_at, created_by)
VALUES
('SUP001', 'CRETAS_2024_001', 'SUP-SH-001', 'SUP001', '上海海鲜供应有限公司', '张经理', '13800138001', 'zhang@seafood.com', '上海市浦东新区海鲜路123号', '91310115MA1K3E8X1A', 'QC2024001', '工商银行上海分行', '6222021001234567890', 'AAA', '月结30天', 1, NOW(), NOW(), 1),
('SUP002', 'CRETAS_2024_001', 'SUP-JS-002', 'SUP002', '江苏优质肉类批发中心', '李经理', '13900139002', 'li@meat.com', '江苏省南京市建邺区肉类大道456号', '91320115MA1K3E8X2B', 'QC2024002', '建设银行南京分行', '6217001001234567891', 'AA', '月结45天', 1, NOW(), NOW(), 1),
('SUP003', 'CRETAS_2024_001', 'SUP-ZJ-003', 'SUP003', '浙江绿色蔬菜基地', '王经理', '13700137003', 'wang@veggie.com', '浙江省杭州市余杭区农业园区789号', '91330115MA1K3E8X3C', 'QC2024003', '农业银行杭州分行', '6228481001234567892', 'A', '货到付款', 1, NOW(), NOW(), 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==========================================
-- 3. 原材料批次 (material_batches)
-- ==========================================
-- 批次状态: AVAILABLE(可用), IN_STOCK(库存), FRESH(新鲜), FROZEN(已冷冻), DEPLETED(耗尽), USED_UP(已用完), EXPIRED(已过期), RESERVED(预留), SCRAPPED(报废)

INSERT INTO material_batches (id, batch_number, factory_id, material_type_id, supplier_id, inbound_date, inbound_quantity, receipt_quantity, remaining_quantity, reserved_quantity, used_quantity, unit_price, total_cost, quantity_unit, status, quality_grade, storage_location, expiry_date, production_date, notes, created_by, created_at, updated_at)
VALUES
-- 可用批次
('MB-001', 'MB-2024-001', 'CRETAS_2024_001', 'MT001', 'SUP001', '2025-11-18', 200.00, 200.00, 200.00, 0.00, 0.00, 35.00, 7000.00, 'kg', 'AVAILABLE', 'A', 'A区冷藏室1号', '2025-11-21', '2025-11-18', '新鲜鱼类，质量优良', 1, NOW(), NOW()),
('MB-002', 'MB-2024-002', 'CRETAS_2024_001', 'MT002', 'SUP002', '2025-11-19', 500.00, 500.00, 500.00, 0.00, 0.00, 28.00, 14000.00, 'kg', 'AVAILABLE', 'A', 'A区冷藏室2号', '2025-11-24', '2025-11-19', '优质鸡胸肉', 1, NOW(), NOW()),
('MB-003', 'MB-2024-003', 'CRETAS_2024_001', 'MT003', 'SUP003', '2025-11-20', 800.00, 800.00, 800.00, 0.00, 0.00, 3.50, 2800.00, 'kg', 'FRESH', 'A', 'B区常温库1号', '2025-11-27', '2025-11-20', '新鲜大白菜', 1, NOW(), NOW()),

-- 使用中批次 (部分消耗)
('MB-004', 'MB-2024-004', 'CRETAS_2024_001', 'MT001', 'SUP001', '2025-11-17', 300.00, 300.00, 150.00, 0.00, 150.00, 35.00, 10500.00, 'kg', 'IN_STOCK', 'A', 'A区冷藏室1号', '2025-11-20', '2025-11-17', '已用一半，剩余150kg', 1, NOW(), NOW()),
('MB-005', 'MB-2024-005', 'CRETAS_2024_001', 'MT002', 'SUP002', '2025-11-18', 400.00, 400.00, 100.00, 0.00, 300.00, 28.00, 11200.00, 'kg', 'IN_STOCK', 'A', 'A区冷藏室2号', '2025-11-23', '2025-11-18', '已用75%，剩余100kg', 1, NOW(), NOW()),

-- 预留批次
('MB-006', 'MB-2024-006', 'CRETAS_2024_001', 'MT001', 'SUP001', '2025-11-19', 150.00, 150.00, 150.00, 150.00, 0.00, 35.00, 5250.00, 'kg', 'RESERVED', 'A', 'A区冷藏室1号', '2025-11-22', '2025-11-19', '已预留给批次BATCH-003', 1, NOW(), NOW()),

-- 已用完批次
('MB-007', 'MB-2024-007', 'CRETAS_2024_001', 'MT003', 'SUP003', '2025-11-15', 500.00, 500.00, 0.00, 0.00, 500.00, 3.50, 1750.00, 'kg', 'USED_UP', 'A', 'B区常温库1号', '2025-11-22', '2025-11-15', '已全部用于批次BATCH-001', 1, NOW(), NOW()),

-- 已过期批次
('MB-008', 'MB-2024-008', 'CRETAS_2024_001', 'MT001', 'SUP001', '2025-11-12', 100.00, 100.00, 100.00, 0.00, 0.00, 35.00, 3500.00, 'kg', 'EXPIRED', 'C', 'C区过期品区', '2025-11-15', '2025-11-12', '已过期，待处理', 1, NOW(), NOW()),

-- 已冷冻批次
('MB-009', 'MB-2024-009', 'CRETAS_2024_001', 'MT001', 'SUP001', '2025-11-16', 250.00, 250.00, 250.00, 0.00, 0.00, 32.00, 8000.00, 'kg', 'FROZEN', 'B', 'D区冷冻室1号', '2026-02-16', '2025-11-16', '已转冷冻保存，延长保质期', 1, NOW(), NOW()),

-- 已报废批次
('MB-010', 'MB-2024-010', 'CRETAS_2024_001', 'MT002', 'SUP002', '2025-11-14', 200.00, 200.00, 0.00, 0.00, 0.00, 28.00, 5600.00, 'kg', 'SCRAPPED', 'D', NULL, '2025-11-14', '2025-11-14', '质检不合格，已报废', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==========================================
-- 4. 产品类型 (product_types) - 确保存在
-- ==========================================
INSERT INTO product_types (id, factory_id, type_code, type_name, category, unit, standard_price, description, is_active, created_at, updated_at)
VALUES
(1, 'CRETAS_2024_001', 'PT001', '龙虾', '海鲜', 'kg', 168.00, '冷冻龙虾产品', 1, NOW(), NOW()),
(2, 'CRETAS_2024_001', 'PT002', '鸡胸肉卷', '肉类', 'kg', 45.00, '即食鸡胸肉卷', 1, NOW(), NOW()),
(3, 'CRETAS_2024_001', 'PT003', '泡菜', '蔬菜制品', 'kg', 12.00, '韩式泡菜', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==========================================
-- 数据插入完成
-- ==========================================
-- 总计:
-- - 3 种原料类型
-- - 3 个供应商
-- - 10 个原材料批次 (8种状态)
-- - 3 种产品类型
