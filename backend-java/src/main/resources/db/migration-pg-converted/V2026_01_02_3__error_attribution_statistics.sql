-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_02_3__error_attribution_statistics.sql
-- Conversion date: 2026-01-26 18:46:57
-- WARNING: This file requires manual review!
-- ============================================

-- =============================================
-- 错误归因统计表 (按日汇总)
-- Error Attribution Statistics Table
-- 汇总每日的意图识别统计数据
-- =============================================

CREATE TABLE IF NOT EXISTS error_attribution_statistics (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    stat_date DATE NOT NULL COMMENT '统计日期',

    -- 总体统计
    total_requests INT NOT NULL DEFAULT 0 COMMENT '总请求数',
    matched_count INT NOT NULL DEFAULT 0 COMMENT '成功匹配数',
    unmatched_count INT NOT NULL DEFAULT 0 COMMENT '未匹配数',
    llm_fallback_count INT NOT NULL DEFAULT 0 COMMENT 'LLM Fallback次数',

    -- 信号分布
    strong_signal_count INT NOT NULL DEFAULT 0 COMMENT '强信号数',
    weak_signal_count INT NOT NULL DEFAULT 0 COMMENT '弱信号数',

    -- 确认统计
    confirmation_requested INT NOT NULL DEFAULT 0 COMMENT '请求确认数',
    user_confirmed_count INT NOT NULL DEFAULT 0 COMMENT '用户确认数',
    user_rejected_count INT NOT NULL DEFAULT 0 COMMENT '用户拒绝数',

    -- 执行统计
    executed_count INT NOT NULL DEFAULT 0 COMMENT '成功执行数',
    failed_count INT NOT NULL DEFAULT 0 COMMENT '执行失败数',
    cancelled_count INT NOT NULL DEFAULT 0 COMMENT '取消数',

    -- 错误归因分布
    rule_miss_count INT NOT NULL DEFAULT 0 COMMENT '规则缺失数',
    ambiguous_count INT NOT NULL DEFAULT 0 COMMENT '歧义匹配数',
    false_positive_count INT NOT NULL DEFAULT 0 COMMENT '误匹配数',
    user_cancel_count INT NOT NULL DEFAULT 0 COMMENT '用户取消数',
    system_error_count INT NOT NULL DEFAULT 0 COMMENT '系统错误数',

    -- 按分类统计 (JSON)
    intent_category_stats JSON COMMENT '按意图分类的统计 {category: {count, successRate}}',
    match_method_stats JSON COMMENT '按匹配方法的统计 {method: {count, avgConfidence}}',

    -- 置信度分布
    avg_confidence DECIMAL(5,4) COMMENT '平均置信度',
    confidence_distribution JSON COMMENT '置信度分布 {range: count}',

    -- BaseEntity 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- 索引
    INDEX idx_stat_date (stat_date),
    INDEX idx_factory_id (factory_id),

    -- 唯一约束: 每个工厂每天只有一条记录
    UNIQUE KEY uk_factory_date (factory_id, stat_date),

    -- 外键
    FOREIGN KEY (factory_id) REFERENCES factories(factory_id) ON DELETE CASCADE
)
;
