-- =====================================================
-- AI配额规则配置表
-- 用于配置化不同问题类型的AI配额消耗规则
-- V2025_12_31_1
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_quota_configs (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID (*表示全局默认配置)',
    question_type VARCHAR(50) NOT NULL COMMENT '问题类型 (historical, comparison, time_range, default)',
    quota_cost INT NOT NULL DEFAULT 1 COMMENT '配额消耗次数',
    weekly_limit INT COMMENT '每周配额限制 (null表示使用全局限制)',
    description VARCHAR(200) COMMENT '规则描述',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '优先级 (数值越大优先级越高)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME COMMENT '删除时间 (软删除)',

    -- 唯一约束: 同一工厂同一问题类型只能有一条配置
    UNIQUE KEY uk_factory_type (factory_id, question_type),

    -- 索引
    INDEX idx_factory_id (factory_id),
    INDEX idx_question_type (question_type),
    INDEX idx_factory_enabled (factory_id, enabled),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI配额规则配置表';

-- =====================================================
-- 插入默认全局配置
-- =====================================================

INSERT INTO ai_quota_configs (id, factory_id, question_type, quota_cost, description, priority) VALUES
('default-historical', '*', 'historical', 5, '历史数据分析 - 消耗5次配额', 100),
('default-comparison', '*', 'comparison', 3, '批次对比分析 - 消耗3次配额', 90),
('default-time_range', '*', 'time_range', 2, '时间范围查询 - 消耗2次配额', 80),
('default-followup', '*', 'followup', 1, 'Follow-up问题 - 消耗1次配额', 70),
('default-simple', '*', 'default', 1, '简单查询 - 消耗1次配额', 60);

-- =====================================================
-- 插入F001工厂的自定义配置 (示例)
-- =====================================================

INSERT INTO ai_quota_configs (id, factory_id, question_type, quota_cost, weekly_limit, description, priority) VALUES
('f001-historical', 'F001', 'historical', 3, 150, 'F001工厂 - 历史分析调整为3次配额', 100),
('f001-comparison', 'F001', 'comparison', 2, 150, 'F001工厂 - 对比分析调整为2次配额', 90);
