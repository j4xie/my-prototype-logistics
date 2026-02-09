-- =====================================================
-- 任务6: 工厂级AI学习配置表
-- 每个工厂可独立配置AI学习参数
-- =====================================================

CREATE TABLE IF NOT EXISTS factory_ai_learning_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL UNIQUE COMMENT '工厂ID',

  -- 自动学习配置
  auto_learn_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用自动学习',
  confidence_threshold DECIMAL(3,2) DEFAULT 0.90 COMMENT 'LLM置信度阈值 (0-1)',
  max_keywords_per_intent INT DEFAULT 50 COMMENT '每个意图最大关键词数',

  -- 学习阶段
  learning_phase VARCHAR(20) DEFAULT 'LEARNING' COMMENT '学习阶段: LEARNING/MATURE',
  phase_transition_date DATE NULL COMMENT '阶段转换日期',
  mature_threshold_days INT DEFAULT 90 COMMENT '成熟期天数阈值',

  -- 清理配置
  cleanup_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用自动清理',
  cleanup_threshold DECIMAL(3,2) DEFAULT 0.30 COMMENT '清理效果阈值',
  cleanup_min_negative INT DEFAULT 5 COMMENT '清理最小负反馈数',

  -- 晋升配置
  promotion_enabled BOOLEAN DEFAULT TRUE COMMENT '是否参与关键词晋升',
  promotion_min_effectiveness DECIMAL(3,2) DEFAULT 0.80 COMMENT '晋升最小效果评分',

  -- Specificity 配置
  specificity_recalc_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用特异性重算',
  last_specificity_recalc_at DATETIME NULL COMMENT '上次特异性重算时间',

  -- LLM Fallback 配置
  llm_fallback_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用LLM兜底',
  llm_new_keyword_weight DECIMAL(3,2) DEFAULT 0.80 COMMENT 'LLM学习新词初始权重',

  -- 审计字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_learning_phase (learning_phase),
  INDEX idx_auto_learn (auto_learn_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工厂级AI学习配置表';

-- =====================================================
-- 为现有工厂初始化默认配置
-- =====================================================
INSERT INTO factory_ai_learning_config (factory_id)
SELECT DISTINCT factory_id
FROM factories
WHERE factory_id IS NOT NULL
ON DUPLICATE KEY UPDATE updated_at = NOW();
