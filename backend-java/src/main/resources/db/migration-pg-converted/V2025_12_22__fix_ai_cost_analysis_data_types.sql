-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_22__fix_ai_cost_analysis_data_types.sql
-- Conversion date: 2026-01-26 18:45:42
-- ============================================

-- ============================================================
-- AI成本分析数据流完整性修复 - 数据库迁移脚本
-- 版本: V2025_12_22
-- 日期: 2025-12-22
--
-- 修复问题:
-- 1. MaterialConsumption.productionBatchId 类型从 VARCHAR 改为 BIGINT
-- 2. QualityInspection.productionBatchId 类型从 VARCHAR 改为 BIGINT
-- ============================================================

-- 备份当前数据（建议在生产环境执行前先备份）
-- CREATE TABLE material_consumptions_backup AS SELECT * FROM material_consumptions;
-- CREATE TABLE quality_inspections_backup AS SELECT * FROM quality_inspections;

-- ============================================================
-- 1. 修改 material_consumptions 表
-- ============================================================

-- 检查并修改 production_batch_id 列类型
-- 注意：如果列中包含非数字字符串，需要先清理数据

-- 方案A: 直接修改类型（适用于列中已存储的是数字字符串）
ALTER TABLE material_consumptions
ALTER COLUMN production_batch_id TYPE BIGINT;

-- 添加外键约束（可选，如果需要强制引用完整性）
-- ALTER TABLE material_consumptions
-- ADD CONSTRAINT fk_mc_production_batch
-- FOREIGN KEY (production_batch_id) REFERENCES production_batches(id)
-- ON DELETE SET NULL;

-- ============================================================
-- 2. 修改 quality_inspections 表
-- ============================================================

-- 检查并修改 production_batch_id 列类型
ALTER TABLE quality_inspections
ALTER COLUMN production_batch_id TYPE BIGINT NOT NULL;

-- 添加外键约束（可选，如果需要强制引用完整性）
-- ALTER TABLE quality_inspections
-- ADD CONSTRAINT fk_qi_production_batch
-- FOREIGN KEY (production_batch_id) REFERENCES production_batches(id)
-- ON DELETE CASCADE;

-- ============================================================
-- 3. 更新索引（优化查询性能）
-- ============================================================

-- 删除旧索引（如果存在）
-- DROP INDEX IF EXISTS idx_mc_production_batch ON material_consumptions;
-- DROP INDEX IF EXISTS idx_qi_production_batch ON quality_inspections;

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_mc_production_batch_id
ON material_consumptions(production_batch_id);

CREATE INDEX IF NOT EXISTS idx_qi_production_batch_id
ON quality_inspections(production_batch_id);

-- ============================================================
-- 验证修改
-- ============================================================

-- 检查列类型是否正确
-- SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME IN ('material_consumptions', 'quality_inspections')
-- AND COLUMN_NAME = 'production_batch_id';

-- ============================================================
-- 回滚脚本（如需回滚，请使用以下SQL）
-- ============================================================
-- ALTER TABLE material_consumptions ALTER COLUMN production_batch_id TYPE VARCHAR(191);
-- ALTER TABLE quality_inspections ALTER COLUMN production_batch_id TYPE VARCHAR(191) NOT NULL;
