-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_19_01__agentic_rag_tables.sql
-- Conversion date: 2026-01-26 18:48:46
-- WARNING: This file requires manual review!
-- ============================================

-- ====================================================================
-- Agentic RAG 系统数据库表
-- 版本: v7.0
-- 创建日期: 2026-01-19
-- 描述: 支持 CRAG、知识库反馈、Agent 执行日志
-- ====================================================================

-- ====================================================================
-- 1. 知识反馈表
-- 用于收集用户反馈，支持知识库自学习
-- ====================================================================
CREATE TABLE IF NOT EXISTS knowledge_feedback (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键ID',
    session_id VARCHAR(100) COMMENT '会话ID',
    user_query TEXT NOT NULL COMMENT '用户查询',
    ai_response TEXT COMMENT 'AI响应内容',
    feedback_type ENUM('POSITIVE', 'NEGATIVE', 'CORRECTION', 'AUTO_APPROVED') NOT NULL COMMENT '反馈类型',
    correction_text TEXT COMMENT '纠正文本(当type=CORRECTION时)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    processed BOOLEAN DEFAULT FALSE COMMENT '是否已处理',
    processed_at TIMESTAMP WITH TIME ZONE COMMENT '处理时间',

    INDEX idx_knowledge_feedback_session (session_id),
    INDEX idx_knowledge_feedback_created (created_at),
    INDEX idx_knowledge_feedback_type_processed (feedback_type, processed)
);

-- ====================================================================
-- 2. 检索质量日志表
-- 记录 CRAG 检索质量评估结果
-- ====================================================================
CREATE TABLE IF NOT EXISTS retrieval_quality_log (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键ID',
    factory_id VARCHAR(50) COMMENT '工厂ID',
    query TEXT NOT NULL COMMENT '用户查询',
    retrieval_score DECIMAL(5,4) COMMENT '检索分数',
    quality_grade ENUM('CORRECT', 'AMBIGUOUS', 'INCORRECT') NOT NULL COMMENT '质量等级',
    fallback_triggered BOOLEAN DEFAULT FALSE COMMENT '是否触发降级检索',
    result_count INT DEFAULT 0 COMMENT '检索结果数量',
    latency_ms INT COMMENT '检索耗时(毫秒)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_retrieval_log_factory (factory_id),
    INDEX idx_retrieval_log_grade (quality_grade),
    INDEX idx_retrieval_log_created (created_at)
);

-- ====================================================================
-- 3. Agent 执行日志表
-- 记录多 Agent 协作的执行过程
-- ====================================================================
CREATE TABLE IF NOT EXISTS agent_execution_log (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键ID',
    session_id VARCHAR(100) COMMENT '会话ID',
    factory_id VARCHAR(50) COMMENT '工厂ID',
    user_id BIGINT COMMENT '用户ID',
    agent_name VARCHAR(50) NOT NULL COMMENT 'Agent名称',
    agent_stage ENUM('RETRIEVAL', 'EVALUATION', 'ANALYSIS', 'REVIEW', 'COMPLETED') COMMENT 'Agent阶段',
    input_summary TEXT COMMENT '输入摘要',
    output_summary TEXT COMMENT '输出摘要',
    execution_time_ms INT COMMENT '执行耗时(毫秒)',
    round_number INT DEFAULT 1 COMMENT '执行轮次',
    status ENUM('SUCCESS', 'RETRY', 'FAILED') NOT NULL COMMENT '执行状态',
    error_message TEXT COMMENT '错误信息',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_agent_log_session (session_id),
    INDEX idx_agent_log_factory (factory_id),
    INDEX idx_agent_log_agent (agent_name),
    INDEX idx_agent_log_status (status),
    INDEX idx_agent_log_created (created_at)
);

-- ====================================================================
-- 4. 分析路由决策日志表
-- 记录复杂度路由的决策过程
-- ====================================================================
CREATE TABLE IF NOT EXISTS analysis_routing_log (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键ID',
    factory_id VARCHAR(50) COMMENT '工厂ID',
    user_input TEXT NOT NULL COMMENT '用户输入',
    analysis_topic VARCHAR(50) COMMENT '分析主题',
    complexity_score DECIMAL(5,4) COMMENT '复杂度分数',
    processing_mode ENUM('FAST', 'ANALYSIS', 'MULTI_AGENT', 'DEEP_REASONING') COMMENT '处理模式',
    is_analysis_request BOOLEAN DEFAULT FALSE COMMENT '是否为分析请求',
    routing_latency_ms INT COMMENT '路由决策耗时(毫秒)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_routing_log_factory (factory_id),
    INDEX idx_routing_log_topic (analysis_topic),
    INDEX idx_routing_log_mode (processing_mode),
    INDEX idx_routing_log_created (created_at)
);

-- ====================================================================
-- 5. 行业知识条目表
-- 存储食品行业的知识条目
-- ====================================================================
CREATE TABLE IF NOT EXISTS industry_knowledge_entry (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键ID',
    topic_code VARCHAR(50) NOT NULL COMMENT '主题代码',
    topic_name VARCHAR(100) COMMENT '主题名称',
    knowledge_content TEXT NOT NULL COMMENT '知识内容',
    source_type ENUM('SYSTEM', 'FACTORY', 'USER', 'EXTERNAL') DEFAULT 'SYSTEM' COMMENT '来源类型',
    source_id VARCHAR(100) COMMENT '来源ID(如工厂ID)',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    version INT DEFAULT 1 COMMENT '版本号',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_knowledge_topic (topic_code),
    INDEX idx_knowledge_source (source_type, source_id),
    INDEX idx_knowledge_active (is_active)
);
