-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_03_4__keyword_factory_adoption.sql
-- Conversion date: 2026-01-26 18:47:03
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- 任务5: 跨工厂关键词采用表
-- 用于追踪同一关键词在不同工厂的使用情况
-- 支持关键词从工厂级别晋升到全局级别
-- =====================================================

CREATE TABLE IF NOT EXISTS keyword_factory_adoption (
  id BIGSERIAL PRIMARY KEY,
  intent_code VARCHAR(100) NOT NULL COMMENT '意图代码',
  keyword VARCHAR(255) NOT NULL COMMENT '关键词',
  factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

  -- 效果统计
  effectiveness_score DECIMAL(5,4) DEFAULT 1.0000 COMMENT '该工厂的效果评分',
  usage_count INT DEFAULT 0 COMMENT '使用次数',

  -- 状态
  is_disabled BOOLEAN DEFAULT FALSE COMMENT '是否被该工厂禁用',
  disabled_at TIMESTAMP WITH TIME ZONE NULL COMMENT '禁用时间',
  disabled_reason VARCHAR(500) NULL COMMENT '禁用原因',

  -- 晋升相关
  is_promoted BOOLEAN DEFAULT FALSE COMMENT '是否已晋升到全局',
  promoted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '晋升时间',

  -- 审计字段
  adopted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '采用时间',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_intent_keyword_factory (intent_code, keyword, factory_id),
  INDEX idx_intent_keyword (intent_code, keyword),
  INDEX idx_factory_id (factory_id),
  INDEX idx_effectiveness (effectiveness_score),
  INDEX idx_is_promoted (is_promoted)
);

-- =====================================================
-- 关键词晋升历史记录表
-- =====================================================

CREATE TABLE IF NOT EXISTS keyword_promotion_history (
  id BIGSERIAL PRIMARY KEY,
  intent_code VARCHAR(100) NOT NULL COMMENT '意图代码',
  keyword VARCHAR(255) NOT NULL COMMENT '关键词',

  -- 晋升信息
  factory_count INT NOT NULL COMMENT '采用工厂数量',
  avg_effectiveness DECIMAL(5,4) NOT NULL COMMENT '平均效果评分',
  factory_ids JSON NOT NULL COMMENT '采用该关键词的工厂列表',

  -- 状态
  promotion_status VARCHAR(50) DEFAULT 'PROMOTED' COMMENT 'PROMOTED/REVOKED',
  revoked_at TIMESTAMP WITH TIME ZONE NULL COMMENT '撤销时间',
  revoke_reason VARCHAR(500) NULL COMMENT '撤销原因',

  -- 审计字段
  promoted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '晋升时间',
  promoted_by VARCHAR(100) DEFAULT 'SYSTEM' COMMENT '晋升操作者',

  INDEX idx_intent_keyword (intent_code, keyword),
  INDEX idx_promotion_status (promotion_status),
  INDEX idx_promoted_at (promoted_at)
);
