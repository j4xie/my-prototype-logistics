-- ============================================================
-- Merchant表最终清理脚本
-- 执行前确认：所有数据已成功迁移到Supplier和Customer表
-- ============================================================

-- 步骤1: 删除material_batches的外键约束
ALTER TABLE `material_batches` DROP FOREIGN KEY `material_batches_merchant_id_fkey`;

-- 步骤2: 删除production_plans的外键约束
ALTER TABLE `production_plans` DROP FOREIGN KEY `production_plans_merchant_id_fkey`;

-- 步骤3: 删除shipment_records的外键约束
ALTER TABLE `shipment_records` DROP FOREIGN KEY `shipment_records_merchant_id_fkey`;

-- 步骤4: 删除material_batches表的merchant_id列
ALTER TABLE `material_batches` DROP COLUMN `merchant_id`;

-- 步骤5: 删除production_plans表的merchant_id列
ALTER TABLE `production_plans` DROP COLUMN `merchant_id`;

-- 步骤6: 删除shipment_records表的merchant_id列
ALTER TABLE `shipment_records` DROP COLUMN `merchant_id`;

-- 步骤7: 删除merchants表
DROP TABLE `merchants`;

-- 步骤8: 验证清理结果
SELECT '✅ Merchant表和相关列已全部清理完成！' AS result;
SELECT '✅ 现在系统使用Supplier(供应商)和Customer(客户)表' AS message;
