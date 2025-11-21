-- ============================================
-- 添加 production_efficiency 字段到 processing_batches 表
-- 修复后端启动错误
-- 创建日期: 2025-11-20
-- ============================================

USE cretas_db;

-- 检查字段是否已存在
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'cretas_db'
  AND TABLE_NAME = 'processing_batches'
  AND COLUMN_NAME = 'production_efficiency';

-- 如果字段不存在，则添加
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE processing_batches ADD COLUMN production_efficiency DECIMAL(5,2) DEFAULT 0.00 COMMENT ''生产效率(%)''',
    'SELECT ''字段 production_efficiency 已存在，跳过添加'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 验证字段是否添加成功
SELECT
    COLUMN_NAME AS '字段名',
    COLUMN_TYPE AS '数据类型',
    IS_NULLABLE AS '允许NULL',
    COLUMN_DEFAULT AS '默认值',
    COLUMN_COMMENT AS '注释'
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'cretas_db'
  AND TABLE_NAME = 'processing_batches'
  AND COLUMN_NAME = 'production_efficiency';

-- 可选：为现有数据初始化默认值
-- UPDATE processing_batches
-- SET production_efficiency = 0.00
-- WHERE production_efficiency IS NULL;

SELECT '✅ production_efficiency 字段添加完成' AS '执行结果';
