-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_02_2__intent_match_records.sql
-- Conversion date: 2026-01-26 18:46:55
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2026_01_02_2__intent_match_records.sql
-- 创建意图匹配记录表
-- 用于记录每次意图识别的详细信息，支持错误归因和规则优化
-- ============================================================

-- 意图匹配记录表
CREATE TABLE IF NOT EXISTS intent_match_records (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    session_id VARCHAR(100) COMMENT '会话ID（用于关联多轮对话）',

    -- 用户输入
    user_input TEXT NOT NULL COMMENT '用户原始输入',
    normalized_input TEXT COMMENT '标准化后的输入',

    -- 匹配结果
    matched_intent_code VARCHAR(50) COMMENT '匹配的意图代码（可能为空）',
    matched_intent_name VARCHAR(100) COMMENT '匹配的意图名称',
    matched_intent_category VARCHAR(50) COMMENT '匹配的意图分类',

    -- 置信度信息
    confidence_score DECIMAL(5,4) COMMENT '置信度分数 (0.0000-1.0000)',
    match_score INT COMMENT '原始匹配分数',
    match_method VARCHAR(20) COMMENT '匹配方法: REGEX/KEYWORD/LLM/NONE',

    -- 候选意图
    top_candidates JSON COMMENT 'Top-N候选意图列表 [{intentCode, confidence, matchScore}]',
    matched_keywords JSON COMMENT '匹配到的关键词列表',

    -- 信号判断
    is_strong_signal BOOLEAN DEFAULT FALSE COMMENT '是否为强信号',
    requires_confirmation BOOLEAN DEFAULT FALSE COMMENT '是否需要用户确认',
    clarification_question TEXT COMMENT '澄清问题内容',

    -- LLM 相关
    llm_called BOOLEAN DEFAULT FALSE COMMENT '是否调用了LLM fallback',
    llm_response TEXT COMMENT 'LLM返回的原始内容',
    llm_intent_code VARCHAR(50) COMMENT 'LLM判断的意图代码',
    llm_confidence DECIMAL(5,4) COMMENT 'LLM返回的置信度',

    -- 用户反馈
    user_confirmed BOOLEAN COMMENT '用户是否确认（null=未确认，true=确认，false=拒绝）',
    user_selected_intent VARCHAR(50) COMMENT '用户选择的意图代码（当有多候选时）',
    user_feedback TEXT COMMENT '用户反馈内容',

    -- 执行结果
    execution_status VARCHAR(20) COMMENT '执行状态: PENDING/EXECUTED/FAILED/CANCELLED',
    execution_result TEXT COMMENT '执行结果摘要',
    error_message TEXT COMMENT '错误信息（如果执行失败）',

    -- 错误归因
    error_attribution VARCHAR(50) COMMENT '错误归因: RULE_MISS/AMBIGUOUS/FALSE_POSITIVE/USER_CANCEL/SYSTEM_ERROR',
    attribution_details TEXT COMMENT '错误归因详情',

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    confirmed_at TIMESTAMP WITH TIME ZONE COMMENT '用户确认时间',
    executed_at TIMESTAMP WITH TIME ZONE COMMENT '执行时间',

    -- 索引
    INDEX idx_factory_user (factory_id, user_id),
    INDEX idx_session (session_id),
    INDEX idx_intent_code (matched_intent_code),
    INDEX idx_created_at (created_at),
    INDEX idx_execution_status (execution_status),
    INDEX idx_error_attribution (error_attribution),
    INDEX idx_llm_called (llm_called)
)
;

-- 错误归因统计表（按日汇总）
CREATE TABLE IF NOT EXISTS error_attribution_statistics (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    stat_date DATE NOT NULL COMMENT '统计日期',

    -- 总体统计
    total_requests INT DEFAULT 0 COMMENT '总请求数',
    matched_count INT DEFAULT 0 COMMENT '成功匹配数',
    unmatched_count INT DEFAULT 0 COMMENT '未匹配数',
    llm_fallback_count INT DEFAULT 0 COMMENT 'LLM Fallback次数',

    -- 信号分布
    strong_signal_count INT DEFAULT 0 COMMENT '强信号数',
    weak_signal_count INT DEFAULT 0 COMMENT '弱信号数',

    -- 确认统计
    confirmation_requested INT DEFAULT 0 COMMENT '请求确认数',
    user_confirmed_count INT DEFAULT 0 COMMENT '用户确认数',
    user_rejected_count INT DEFAULT 0 COMMENT '用户拒绝数',

    -- 执行统计
    executed_count INT DEFAULT 0 COMMENT '成功执行数',
    failed_count INT DEFAULT 0 COMMENT '执行失败数',
    cancelled_count INT DEFAULT 0 COMMENT '取消数',

    -- 错误归因分布
    rule_miss_count INT DEFAULT 0 COMMENT '规则缺失数',
    ambiguous_count INT DEFAULT 0 COMMENT '歧义匹配数',
    false_positive_count INT DEFAULT 0 COMMENT '误匹配数',
    user_cancel_count INT DEFAULT 0 COMMENT '用户取消数',
    system_error_count INT DEFAULT 0 COMMENT '系统错误数',

    -- 按意图分类统计 (JSON)
    intent_category_stats JSON COMMENT '按意图分类的统计 {category: {count, successRate}}',

    -- 按匹配方法统计 (JSON)
    match_method_stats JSON COMMENT '按匹配方法的统计 {method: {count, avgConfidence}}',

    -- 置信度分布
    avg_confidence DECIMAL(5,4) COMMENT '平均置信度',
    confidence_distribution JSON COMMENT '置信度分布 {range: count}',

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 唯一约束
    UNIQUE KEY uk_factory_date (factory_id, stat_date),
    INDEX idx_stat_date (stat_date)
)
;

-- 意图优化建议表
CREATE TABLE IF NOT EXISTS intent_optimization_suggestions (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    intent_code VARCHAR(50) COMMENT '相关意图代码',

    -- 建议类型
    suggestion_type VARCHAR(30) NOT NULL COMMENT '建议类型: ADD_KEYWORD/ADJUST_PRIORITY/ADD_REGEX/MERGE_INTENT/SPLIT_INTENT',

    -- 建议内容
    suggestion_title VARCHAR(200) NOT NULL COMMENT '建议标题',
    suggestion_detail TEXT NOT NULL COMMENT '建议详情',

    -- 支持数据
    supporting_examples JSON COMMENT '支持该建议的用户输入样例',
    frequency INT DEFAULT 0 COMMENT '相关问题出现频率',
    impact_score DECIMAL(5,2) COMMENT '预估影响分数 (0-100)',

    -- 状态
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态: PENDING/APPLIED/REJECTED/EXPIRED',
    applied_at TIMESTAMP WITH TIME ZONE COMMENT '应用时间',
    applied_by BIGINT COMMENT '应用人ID',
    reject_reason TEXT COMMENT '拒绝原因',

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    expired_at TIMESTAMP WITH TIME ZONE COMMENT '过期时间（建议有效期30天）',

    INDEX idx_factory_intent (factory_id, intent_code),
    INDEX idx_status (status),
    INDEX idx_impact_score (impact_score DESC)
)
;
