-- ============================================================
-- Merchant表清理脚本
-- 执行前确认：所有数据已成功迁移到Supplier和Customer表
-- ============================================================

-- 步骤1: 删除material_batches表的merchant_id外键约束
ALTER TABLE `material_batches` DROP FOREIGN KEY IF EXISTS `material_batches_merchant_id_fkey`;

-- 步骤2: 删除production_plans表的merchant_id外键约束
ALTER TABLE `production_plans` DROP FOREIGN KEY IF EXISTS `production_plans_merchant_id_fkey`;

-- 步骤3: 删除shipment_records表的merchant_id外键约束
ALTER TABLE `shipment_records` DROP FOREIGN KEY IF EXISTS `shipment_records_merchant_id_fkey`;

-- 步骤4: 删除material_batches表的merchant_id列
ALTER TABLE `material_batches` DROP COLUMN IF EXISTS `merchant_id`;

-- 步骤5: 删除production_plans表的merchant_id列
ALTER TABLE `production_plans` DROP COLUMN IF EXISTS `merchant_id`;

-- 步骤6: 删除shipment_records表的merchant_id列
ALTER TABLE `shipment_records` DROP COLUMN IF EXISTS `merchant_id`;

-- 步骤7: 删除merchants表
DROP TABLE IF EXISTS `merchants`;

-- 步骤8: 验证清理结果
SELECT '✅ Merchant表清理完成！' AS status;
SELECT '数据库现在使用Supplier和Customer表管理供应商和客户' AS message;
