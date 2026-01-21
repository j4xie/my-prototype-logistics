-- =============================================================================
-- AI 意图配置表与 Entity 对齐
-- 版本: V2026_01_21_10
-- 描述: 添加 AiIntentConfig entity 所需的列
-- =============================================================================

-- 添加 patterns 字段 (JSON数组，用于正则匹配)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'patterns');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN patterns JSON NULL COMMENT ''正则表达式模式列表 JSON数组''',
    'SELECT ''patterns column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 examples 字段 (示例问句)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'examples');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN examples JSON NULL COMMENT ''示例问句 JSON数组''',
    'SELECT ''examples column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 follow_up_questions 字段 (后续问题建议)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'follow_up_questions');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN follow_up_questions JSON NULL COMMENT ''后续问题建议 JSON数组''',
    'SELECT ''follow_up_questions column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 analysis_service 字段 (关联的分析服务)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'analysis_service');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN analysis_service VARCHAR(64) NULL COMMENT ''关联的分析服务''',
    'SELECT ''analysis_service column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 method_name 字段 (关联的方法名)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'method_name');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN method_name VARCHAR(64) NULL COMMENT ''关联的方法名''',
    'SELECT ''method_name column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 confidence_threshold 字段 (置信度阈值)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'confidence_threshold');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN confidence_threshold DOUBLE DEFAULT 0.6 COMMENT ''置信度阈值 0-1之间''',
    'SELECT ''confidence_threshold column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 factory_id 字段 (工厂ID)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND COLUMN_NAME = 'factory_id');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE ai_intent_configs ADD COLUMN factory_id VARCHAR(32) NULL COMMENT ''工厂ID null表示全局配置''',
    'SELECT ''factory_id column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_intent_configs' AND INDEX_NAME = 'idx_intent_factory');
SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_intent_factory ON ai_intent_configs(factory_id)',
    'SELECT ''idx_intent_factory index already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 迁移完成提示
SELECT 'AI意图配置表列对齐完成' AS migration_status;
