-- 参数提取规则表
-- 用于存储从用户输入中提取参数的学习规则
CREATE TABLE IF NOT EXISTS ai_parameter_extraction_rules (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) COMMENT '工厂ID (null = 全局)',
    intent_code VARCHAR(100) NOT NULL COMMENT '关联的意图代码',
    param_name VARCHAR(100) NOT NULL COMMENT '参数名称',
    param_display_name VARCHAR(100) COMMENT '参数显示名称',
    
    -- 提取规则
    pattern_type VARCHAR(20) NOT NULL COMMENT '模式类型: KEYWORD_AFTER, KEYWORD_IS, REGEX, POSITION, NER, SEMANTIC',
    extraction_pattern VARCHAR(500) COMMENT '提取模式/关键词/正则表达式',
    extraction_config TEXT COMMENT '附加的提取配置（JSON格式）',
    
    -- 示例和验证
    example_input TEXT COMMENT '原始用户输入示例',
    example_value VARCHAR(500) COMMENT '提取出的值示例',
    value_type VARCHAR(20) DEFAULT 'STRING' COMMENT '参数值类型',
    value_validation_regex VARCHAR(200) COMMENT '值验证正则',
    
    -- 置信度和统计
    confidence DECIMAL(5,4) DEFAULT 0.8000 COMMENT '置信度 (0.0 - 1.0)',
    hit_count INT DEFAULT 0 COMMENT '命中次数',
    success_count INT DEFAULT 0 COMMENT '成功提取次数',
    last_hit_at DATETIME COMMENT '最后命中时间',
    
    -- 来源追踪
    source_type VARCHAR(20) DEFAULT 'LLM_LEARNED' NOT NULL COMMENT '来源类型',
    is_verified TINYINT(1) DEFAULT 0 COMMENT '是否已人工确认',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME COMMENT '软删除时间',
    
    INDEX idx_per_factory_intent (factory_id, intent_code),
    INDEX idx_per_intent_param (factory_id, intent_code, param_name),
    INDEX idx_per_pattern (pattern_type),
    INDEX idx_per_is_verified (is_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='参数提取规则表';
