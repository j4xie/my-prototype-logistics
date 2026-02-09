-- =====================================================
-- AI配额规则表
-- 作者: Cretas Team
-- 日期: 2025-12-31
-- 描述: 实现AI配额的配置化管理，替代硬编码配额
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_quota_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '规则ID',
    factory_id VARCHAR(50) COMMENT '工厂ID（NULL表示全局默认规则）',
    weekly_quota INT NOT NULL DEFAULT 20 COMMENT '周配额（次/周）',
    role_multipliers JSON COMMENT '角色配额系数（JSON格式）',
    reset_day_of_week INT NOT NULL DEFAULT 1 COMMENT '配额重置周期（1=周一, 7=周日）',
    enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用',
    priority INT NOT NULL DEFAULT 0 COMMENT '优先级（数字越大优先级越高）',
    description VARCHAR(500) COMMENT '规则描述',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME NULL COMMENT '软删除时间',

    -- 索引
    INDEX idx_factory_id (factory_id),
    INDEX idx_enabled (enabled),

    -- 唯一约束：每个工厂只能有一个规则
    UNIQUE KEY uk_factory_quota_rule (factory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI配额规则表';

-- =====================================================
-- 初始化全局默认规则
-- =====================================================

INSERT INTO ai_quota_rules (
    factory_id,
    weekly_quota,
    role_multipliers,
    reset_day_of_week,
    enabled,
    priority,
    description
) VALUES (
    NULL,
    20,
    '{"dispatcher": 2.0, "quality_inspector": 1.5, "worker": 1.0}',
    1,
    TRUE,
    0,
    '全局默认配额规则：调度员2倍配额，质检员1.5倍配额，普通工人1倍配额'
) ON DUPLICATE KEY UPDATE
    weekly_quota = 20,
    role_multipliers = '{"dispatcher": 2.0, "quality_inspector": 1.5, "worker": 1.0}',
    description = '全局默认配额规则：调度员2倍配额，质检员1.5倍配额，普通工人1倍配额';

-- =====================================================
-- 说明
-- =====================================================
-- 1. factory_id为NULL表示全局默认规则，所有工厂都会继承
-- 2. 工厂特定规则优先级高于全局规则
-- 3. role_multipliers示例: {"dispatcher": 2.0, "quality_inspector": 1.5}
--    表示调度员配额为基础配额的2倍，质检员为1.5倍
-- 4. reset_day_of_week: 1=周一, 2=周二, ..., 7=周日
-- 5. 向后兼容：如果没有配置规则，系统使用硬编码默认值20次/周
