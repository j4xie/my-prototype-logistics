-- =============================================================================
-- AI 意图配置表与 Entity 对齐
-- 版本: V2026_01_21_10
-- 描述: 添加 AiIntentConfig entity 所需的列
-- =============================================================================

-- 添加 patterns 字段 (JSON数组，用于正则匹配)
ALTER TABLE ai_intent_configs ADD COLUMN patterns JSON NULL COMMENT '正则表达式模式列表 JSON数组';

-- 添加 examples 字段 (示例问句)
ALTER TABLE ai_intent_configs ADD COLUMN examples JSON NULL COMMENT '示例问句 JSON数组';

-- 添加 follow_up_questions 字段 (后续问题建议)
ALTER TABLE ai_intent_configs ADD COLUMN follow_up_questions JSON NULL COMMENT '后续问题建议 JSON数组';

-- 添加 analysis_service 字段 (关联的分析服务)
ALTER TABLE ai_intent_configs ADD COLUMN analysis_service VARCHAR(64) NULL COMMENT '关联的分析服务';

-- 添加 method_name 字段 (关联的方法名)
ALTER TABLE ai_intent_configs ADD COLUMN method_name VARCHAR(64) NULL COMMENT '关联的方法名';

-- 添加 confidence_threshold 字段 (置信度阈值)
ALTER TABLE ai_intent_configs ADD COLUMN confidence_threshold DOUBLE DEFAULT 0.6 COMMENT '置信度阈值 0-1之间';

-- 迁移完成提示
SELECT 'AI意图配置表列对齐完成' AS migration_status;
