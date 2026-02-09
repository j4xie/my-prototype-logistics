-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_24_10__active_learning_tables.sql
-- Conversion date: 2026-01-26 18:49:40
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- Active Learning System Tables
-- Version: 2026-01-24
-- Description: Complete active learning infrastructure for AI intent recognition
-- ============================================================

-- 1. 低置信度样本存储表
-- 用于收集置信度 < 0.7 的样本，进行聚类分析和学习
CREATE TABLE IF NOT EXISTS active_learning_samples (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    user_id BIGINT COMMENT '用户ID',
    session_id VARCHAR(100) COMMENT '会话ID',

    -- 用户输入
    user_input TEXT NOT NULL COMMENT '用户原始输入',
    normalized_input TEXT COMMENT '标准化后的输入',
    input_embedding BYTEA COMMENT '输入的向量嵌入 (可选)',

    -- 匹配结果
    matched_intent_code VARCHAR(50) COMMENT '匹配到的意图代码',
    confidence_score DECIMAL(5,4) NOT NULL COMMENT '置信度分数',
    match_method VARCHAR(20) COMMENT '匹配方法',
    top_candidates JSON COMMENT 'Top-N候选意图列表',
    matched_keywords JSON COMMENT '匹配到的关键词',

    -- 聚类信息
    cluster_id VARCHAR(50) COMMENT '聚类ID',
    cluster_label VARCHAR(200) COMMENT '聚类标签/描述',
    cluster_centroid_distance DECIMAL(10,6) COMMENT '到聚类中心的距离',

    -- 学习状态
    learning_status VARCHAR(20) DEFAULT 'PENDING' COMMENT '学习状态: PENDING/ANALYZED/LEARNED/IGNORED',
    suggestion_id BIGINT COMMENT '关联的建议ID',

    -- 用户反馈
    user_confirmed BOOLEAN COMMENT '用户是否确认',
    user_selected_intent VARCHAR(50) COMMENT '用户选择的意图',
    user_feedback TEXT COMMENT '用户反馈内容',

    -- 审计字段
    source_record_id VARCHAR(36) COMMENT '来源的 IntentMatchRecord ID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    analyzed_at TIMESTAMP WITH TIME ZONE COMMENT '分析完成时间',
    learned_at TIMESTAMP WITH TIME ZONE COMMENT '学习完成时间',

    INDEX idx_factory_confidence (factory_id, confidence_score),
    INDEX idx_learning_status (learning_status),
    INDEX idx_cluster_id (cluster_id),
    INDEX idx_created_at (created_at),
    INDEX idx_source_record (source_record_id)
);
-- 2. 意图转移概率矩阵表
-- 记录用户在不同意图之间的转移频率，用于置信度校准
CREATE TABLE IF NOT EXISTS intent_transition_matrix (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 转移信息
    from_intent_code VARCHAR(50) NOT NULL COMMENT '源意图代码',
    to_intent_code VARCHAR(50) NOT NULL COMMENT '目标意图代码',

    -- 统计数据
    transition_count INT DEFAULT 0 COMMENT '转移次数',
    total_from_count INT DEFAULT 0 COMMENT '源意图总出现次数',
    transition_probability DECIMAL(7,6) DEFAULT 0 COMMENT '转移概率 (Laplace平滑后)',

    -- 时间窗口
    window_start DATE NOT NULL COMMENT '统计窗口开始日期',
    window_end DATE NOT NULL COMMENT '统计窗口结束日期',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_factory_intents_window (factory_id, from_intent_code, to_intent_code, window_start),
    INDEX idx_from_intent (factory_id, from_intent_code),
    INDEX idx_to_intent (factory_id, to_intent_code),
    INDEX idx_probability (transition_probability DESC)
);
-- 3. 跨工厂知识库表
-- 存储可在多工厂间共享的高效关键词和表达式
CREATE TABLE IF NOT EXISTS cross_factory_knowledge (
    id BIGSERIAL PRIMARY KEY,

    -- 知识内容
    knowledge_type VARCHAR(30) NOT NULL COMMENT '知识类型: KEYWORD/EXPRESSION/PATTERN/INTENT_MAPPING',
    intent_code VARCHAR(50) NOT NULL COMMENT '关联的意图代码',
    content VARCHAR(500) NOT NULL COMMENT '知识内容 (关键词/表达式/正则模式)',
    content_hash VARCHAR(64) COMMENT '内容的SHA256哈希',

    -- 来源信息
    source_factory_id VARCHAR(50) NOT NULL COMMENT '来源工厂ID',
    discovered_at TIMESTAMP WITH TIME ZONE COMMENT '发现时间',

    -- 效果评估
    effectiveness_score DECIMAL(5,4) DEFAULT 0.5 COMMENT '效果评分 (Wilson Score)',
    adoption_count INT DEFAULT 1 COMMENT '采用的工厂数量',
    positive_feedback_count INT DEFAULT 0 COMMENT '正向反馈总数',
    negative_feedback_count INT DEFAULT 0 COMMENT '负向反馈总数',

    -- 推广状态
    promotion_status VARCHAR(20) DEFAULT 'LOCAL' COMMENT '推广状态: LOCAL/CANDIDATE/GLOBAL/DEPRECATED',
    promotion_threshold DECIMAL(3,2) DEFAULT 0.80 COMMENT '推广所需最低效果评分',
    min_adoption_count INT DEFAULT 3 COMMENT '推广所需最少工厂采用数',

    -- 质量控制
    is_verified BOOLEAN DEFAULT FALSE COMMENT '是否人工验证',
    verified_by VARCHAR(50) COMMENT '验证人',
    verified_at TIMESTAMP WITH TIME ZONE COMMENT '验证时间',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    promoted_at TIMESTAMP WITH TIME ZONE COMMENT '推广为全局时间',

    UNIQUE KEY uk_type_intent_content_hash (knowledge_type, intent_code, content_hash),
    INDEX idx_knowledge_type (knowledge_type),
    INDEX idx_intent_code (intent_code),
    INDEX idx_promotion_status (promotion_status),
    INDEX idx_effectiveness (effectiveness_score DESC),
    INDEX idx_adoption_count (adoption_count DESC)
);
-- 4. 跨工厂知识采用记录表
-- 记录各工厂对全局知识的采用情况
CREATE TABLE IF NOT EXISTS cross_factory_knowledge_adoption (
    id BIGSERIAL PRIMARY KEY,
    knowledge_id BIGINT NOT NULL COMMENT '知识库记录ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 采用信息
    adopted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '采用时间',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活使用',

    -- 效果评估 (工厂级别)
    local_effectiveness_score DECIMAL(5,4) COMMENT '该工厂的效果评分',
    local_positive_count INT DEFAULT 0 COMMENT '该工厂正向反馈数',
    local_negative_count INT DEFAULT 0 COMMENT '该工厂负向反馈数',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP WITH TIME ZONE COMMENT '停用时间',

    UNIQUE KEY uk_knowledge_factory (knowledge_id, factory_id),
    INDEX idx_factory (factory_id),
    INDEX idx_active (is_active),
    FOREIGN KEY (knowledge_id) REFERENCES cross_factory_knowledge(id) ON DELETE CASCADE
);
-- 5. 学习任务队列表
-- 管理各类学习任务的调度和执行
CREATE TABLE IF NOT EXISTS learning_tasks (
    id BIGSERIAL PRIMARY KEY,

    -- 任务标识
    task_type VARCHAR(50) NOT NULL COMMENT '任务类型: SAMPLE_CLUSTERING/TRANSITION_ANALYSIS/KEYWORD_EVAL/KNOWLEDGE_PROMOTION/MODEL_RETRAIN',
    task_name VARCHAR(200) COMMENT '任务名称',
    factory_id VARCHAR(50) COMMENT '关联的工厂ID (NULL表示全局任务)',

    -- 任务状态
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态: PENDING/RUNNING/COMPLETED/FAILED/CANCELLED',
    priority INT DEFAULT 5 COMMENT '优先级 (1-10, 10最高)',

    -- 调度信息
    scheduled_at TIMESTAMP WITH TIME ZONE COMMENT '计划执行时间',
    started_at TIMESTAMP WITH TIME ZONE COMMENT '开始执行时间',
    completed_at TIMESTAMP WITH TIME ZONE COMMENT '完成时间',
    timeout_minutes INT DEFAULT 60 COMMENT '超时时间(分钟)',

    -- 任务参数
    parameters JSON COMMENT '任务参数',

    -- 执行结果
    result JSON COMMENT '执行结果',
    error_message TEXT COMMENT '错误信息',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    max_retries INT DEFAULT 3 COMMENT '最大重试次数',

    -- 进度追踪
    progress_percent INT DEFAULT 0 COMMENT '进度百分比',
    progress_message VARCHAR(500) COMMENT '进度描述',

    -- 审计字段
    created_by VARCHAR(50) COMMENT '创建人',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_task_type (task_type),
    INDEX idx_factory (factory_id),
    INDEX idx_status (status),
    INDEX idx_scheduled (scheduled_at),
    INDEX idx_priority_status (priority DESC, status, scheduled_at)
);
-- 6. 模型性能日志表
-- 记录 AI 模型的性能指标，用于监控和优化
CREATE TABLE IF NOT EXISTS model_performance_log (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 时间窗口
    period_type VARCHAR(20) NOT NULL COMMENT '统计周期: HOURLY/DAILY/WEEKLY/MONTHLY',
    period_start TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '周期开始时间',
    period_end TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '周期结束时间',

    -- 基础指标
    total_requests BIGINT DEFAULT 0 COMMENT '总请求数',
    matched_requests BIGINT DEFAULT 0 COMMENT '成功匹配数',
    high_confidence_count BIGINT DEFAULT 0 COMMENT '高置信度(>=0.9)数量',
    low_confidence_count BIGINT DEFAULT 0 COMMENT '低置信度(<0.7)数量',

    -- 匹配方法分布
    exact_match_count BIGINT DEFAULT 0 COMMENT '精确匹配数',
    keyword_match_count BIGINT DEFAULT 0 COMMENT '关键词匹配数',
    semantic_match_count BIGINT DEFAULT 0 COMMENT '语义匹配数',
    llm_fallback_count BIGINT DEFAULT 0 COMMENT 'LLM回退数',
    unmatched_count BIGINT DEFAULT 0 COMMENT '未匹配数',

    -- 质量指标
    accuracy_rate DECIMAL(5,4) COMMENT '准确率 (用户确认计算)',
    precision_rate DECIMAL(5,4) COMMENT '精确率',
    recall_rate DECIMAL(5,4) COMMENT '召回率',
    f1_score DECIMAL(5,4) COMMENT 'F1分数',

    -- 置信度分布
    avg_confidence DECIMAL(5,4) COMMENT '平均置信度',
    median_confidence DECIMAL(5,4) COMMENT '中位数置信度',
    confidence_std_dev DECIMAL(5,4) COMMENT '置信度标准差',

    -- 用户反馈
    user_confirmed_count BIGINT DEFAULT 0 COMMENT '用户确认数',
    user_rejected_count BIGINT DEFAULT 0 COMMENT '用户拒绝数',
    no_feedback_count BIGINT DEFAULT 0 COMMENT '无反馈数',

    -- 错误归因分布
    rule_miss_count BIGINT DEFAULT 0 COMMENT '规则缺失数',
    ambiguous_count BIGINT DEFAULT 0 COMMENT '歧义匹配数',
    false_positive_count BIGINT DEFAULT 0 COMMENT '误匹配数',

    -- 响应时间
    avg_response_time_ms INT COMMENT '平均响应时间(毫秒)',
    p95_response_time_ms INT COMMENT 'P95响应时间(毫秒)',
    p99_response_time_ms INT COMMENT 'P99响应时间(毫秒)',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_factory_period (factory_id, period_type, period_start),
    INDEX idx_period_type (period_type),
    INDEX idx_period_start (period_start),
    INDEX idx_accuracy (accuracy_rate DESC)
);
-- 7. 人工标注队列表
-- 存储需要人工标注的样本
CREATE TABLE IF NOT EXISTS annotation_queue (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 样本信息
    sample_id BIGINT COMMENT '关联的 active_learning_samples ID',
    user_input TEXT NOT NULL COMMENT '用户输入',
    normalized_input TEXT COMMENT '标准化输入',

    -- 系统预测
    predicted_intent_code VARCHAR(50) COMMENT '系统预测的意图',
    predicted_confidence DECIMAL(5,4) COMMENT '预测置信度',
    alternative_intents JSON COMMENT '其他候选意图',

    -- 标注状态
    annotation_status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态: PENDING/ASSIGNED/COMPLETED/SKIPPED/DISPUTED',
    priority INT DEFAULT 5 COMMENT '优先级 (1-10)',
    difficulty_level VARCHAR(20) COMMENT '难度级别: EASY/MEDIUM/HARD',

    -- 标注结果
    annotated_intent_code VARCHAR(50) COMMENT '标注的意图代码',
    annotated_by VARCHAR(50) COMMENT '标注人',
    annotated_at TIMESTAMP WITH TIME ZONE COMMENT '标注时间',
    annotation_notes TEXT COMMENT '标注备注',

    -- 争议处理
    is_disputed BOOLEAN DEFAULT FALSE COMMENT '是否有争议',
    dispute_reason TEXT COMMENT '争议原因',
    resolved_by VARCHAR(50) COMMENT '解决人',
    resolved_at TIMESTAMP WITH TIME ZONE COMMENT '解决时间',

    -- 质量控制
    verification_status VARCHAR(20) COMMENT '验证状态: PENDING/VERIFIED/REJECTED',
    verified_by VARCHAR(50) COMMENT '验证人',
    verified_at TIMESTAMP WITH TIME ZONE COMMENT '验证时间',

    -- 分配信息
    assigned_to VARCHAR(50) COMMENT '分配给',
    assigned_at TIMESTAMP WITH TIME ZONE COMMENT '分配时间',
    due_at TIMESTAMP WITH TIME ZONE COMMENT '截止时间',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_factory (factory_id),
    INDEX idx_status (annotation_status),
    INDEX idx_priority (priority DESC),
    INDEX idx_assigned (assigned_to, annotation_status),
    INDEX idx_sample (sample_id),
    FOREIGN KEY (sample_id) REFERENCES active_learning_samples(id) ON DELETE SET NULL
);
-- 8. 学习建议表
-- 存储系统生成的学习建议 (新关键词、新表达式、新意图等)
CREATE TABLE IF NOT EXISTS learning_suggestions (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',

    -- 建议类型
    suggestion_type VARCHAR(30) NOT NULL COMMENT '建议类型: NEW_KEYWORD/NEW_EXPRESSION/NEW_INTENT/MERGE_INTENT/SPLIT_INTENT/DEPRECATE_KEYWORD',
    intent_code VARCHAR(50) COMMENT '关联的意图代码',

    -- 建议内容
    content VARCHAR(500) NOT NULL COMMENT '建议内容',
    description TEXT COMMENT '详细描述',
    reason TEXT COMMENT '建议原因',

    -- 支持数据
    supporting_samples JSON COMMENT '支持该建议的样本列表',
    sample_count INT DEFAULT 0 COMMENT '支持样本数量',
    confidence_score DECIMAL(5,4) COMMENT '建议置信度',

    -- 聚类信息 (如果来自聚类分析)
    cluster_id VARCHAR(50) COMMENT '来源聚类ID',
    cluster_size INT COMMENT '聚类大小',

    -- 状态
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态: PENDING/APPROVED/REJECTED/APPLIED/EXPIRED',
    priority INT DEFAULT 5 COMMENT '优先级 (1-10)',

    -- 审批信息
    reviewed_by VARCHAR(50) COMMENT '审批人',
    reviewed_at TIMESTAMP WITH TIME ZONE COMMENT '审批时间',
    review_notes TEXT COMMENT '审批备注',

    -- 应用信息
    applied_at TIMESTAMP WITH TIME ZONE COMMENT '应用时间',
    applied_by VARCHAR(50) COMMENT '应用人',

    -- 效果追踪
    effectiveness_before DECIMAL(5,4) COMMENT '应用前效果',
    effectiveness_after DECIMAL(5,4) COMMENT '应用后效果',
    effectiveness_delta DECIMAL(5,4) COMMENT '效果变化',

    -- 过期设置
    expires_at TIMESTAMP WITH TIME ZONE COMMENT '过期时间',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_factory (factory_id),
    INDEX idx_type (suggestion_type),
    INDEX idx_status (status),
    INDEX idx_intent (intent_code),
    INDEX idx_priority_status (priority DESC, status),
    INDEX idx_cluster (cluster_id)
);
-- 9. 样本聚类结果表
-- 存储低置信度样本的聚类结果
CREATE TABLE IF NOT EXISTS sample_clusters (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    cluster_id VARCHAR(50) NOT NULL COMMENT '聚类ID',

    -- 聚类信息
    cluster_label VARCHAR(200) COMMENT '聚类标签/描述',
    cluster_centroid BYTEA COMMENT '聚类中心向量',
    representative_sample TEXT COMMENT '代表性样本',

    -- 统计
    sample_count INT DEFAULT 0 COMMENT '样本数量',
    avg_confidence DECIMAL(5,4) COMMENT '平均置信度',

    -- 主要意图分布
    dominant_intent_code VARCHAR(50) COMMENT '主要意图代码',
    dominant_intent_ratio DECIMAL(5,4) COMMENT '主要意图占比',
    intent_distribution JSON COMMENT '意图分布 {intentCode: count}',

    -- 关键词分析
    common_keywords JSON COMMENT '常见关键词列表',
    suggested_keywords JSON COMMENT '建议新增的关键词',

    -- 状态
    analysis_status VARCHAR(20) DEFAULT 'PENDING' COMMENT '分析状态: PENDING/ANALYZED/ACTION_TAKEN',
    action_taken VARCHAR(50) COMMENT '采取的行动',
    action_details TEXT COMMENT '行动详情',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    analyzed_at TIMESTAMP WITH TIME ZONE COMMENT '分析时间',

    UNIQUE KEY uk_factory_cluster (factory_id, cluster_id),
    INDEX idx_factory (factory_id),
    INDEX idx_status (analysis_status),
    INDEX idx_dominant_intent (dominant_intent_code),
    INDEX idx_sample_count (sample_count DESC)
);
