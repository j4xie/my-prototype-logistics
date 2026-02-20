-- =====================================================
-- 任务4: 关键词效果追踪表
-- 用于记录每个关键词的匹配反馈和效果评分
-- =====================================================

CREATE TABLE IF NOT EXISTS keyword_effectiveness (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
  intent_code VARCHAR(100) NOT NULL COMMENT '意图代码',
  keyword VARCHAR(255) NOT NULL COMMENT '关键词',

  -- 反馈统计
  positive_count INT DEFAULT 0 COMMENT '正向反馈次数（用户确认匹配正确）',
  negative_count INT DEFAULT 0 COMMENT '负向反馈次数（用户选择其他意图）',

  -- 效果评分
  effectiveness_score DECIMAL(5,4) DEFAULT 1.0000 COMMENT 'Wilson Score 效果评分 (0-1)',
  weight DECIMAL(3,2) DEFAULT 1.00 COMMENT '匹配权重 (0.5-1.5)',
  specificity DECIMAL(5,4) DEFAULT 1.0000 COMMENT '特异性评分 (1/intent_count)',

  -- 元数据
  source VARCHAR(50) DEFAULT 'MANUAL' COMMENT '来源: MANUAL/AUTO_LEARNED/PROMOTED',
  is_auto_learned BOOLEAN DEFAULT FALSE COMMENT '是否自动学习',
  last_matched_at DATETIME NULL COMMENT '最后一次匹配时间',

  -- 审计字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_factory_intent_keyword (factory_id, intent_code, keyword),
  INDEX idx_effectiveness (effectiveness_score),
  INDEX idx_intent_code (intent_code),
  INDEX idx_factory_id (factory_id),
  INDEX idx_keyword (keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='关键词效果追踪表';

-- =====================================================
-- 初始化：从现有 ai_intent_configs 迁移关键词到效果表
-- 全局关键词 (factory_id = 'GLOBAL')
-- =====================================================
INSERT INTO keyword_effectiveness (factory_id, intent_code, keyword, source, is_auto_learned)
SELECT
    'GLOBAL' as factory_id,
    intent_code,
    JSON_UNQUOTE(kw.keyword) as keyword,
    'MANUAL' as source,
    FALSE as is_auto_learned
FROM ai_intent_configs aic
CROSS JOIN JSON_TABLE(
    aic.keywords,
    '$[*]' COLUMNS (keyword VARCHAR(255) PATH '$')
) as kw
WHERE aic.keywords IS NOT NULL
  AND JSON_LENGTH(aic.keywords) > 0
ON DUPLICATE KEY UPDATE updated_at = NOW();
