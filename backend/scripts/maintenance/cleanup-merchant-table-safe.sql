-- ============================================================
-- Merchant表安全清理脚本
-- 执行前确认：所有数据已成功迁移到Supplier和Customer表
-- ============================================================

-- 步骤1: 删除material_batches表的merchant_id列（会自动删除外键）
ALTER TABLE `material_batches` DROP COLUMN `merchant_id`;

-- 步骤2: 删除production_plans表的merchant_id列（会自动删除外键）
ALTER TABLE `production_plans` DROP COLUMN `merchant_id`;

-- 步骤3: 删除shipment_records表的merchant_id列（会自动删除外键）
ALTER TABLE `shipment_records` DROP COLUMN `merchant_id`;

-- 步骤4: 删除merchants表
DROP TABLE `merchants`;

-- 步骤5: 验证清理结果
SELECT '✅ Merchant表清理完成！' AS status;
