-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_14__add_home_layout_tables.sql
-- Conversion date: 2026-01-26 18:48:25
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2026_01_14__add_home_layout_tables.sql
-- 白垩纪App装饰系统 - 首页布局与AI装饰会话表
-- ============================================================

-- 工厂首页布局配置表
CREATE TABLE IF NOT EXISTS factory_home_layout (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL UNIQUE COMMENT '工厂ID',
    modules_config JSON NOT NULL COMMENT '模块配置JSON',
    theme_config JSON COMMENT '主题配置JSON',
    status SMALLINT DEFAULT 1 COMMENT '状态: 0草稿 1发布',
    version INT DEFAULT 1 COMMENT '版本号',
    ai_generated SMALLINT DEFAULT 0 COMMENT '是否AI生成: 0否 1是',
    ai_prompt TEXT COMMENT 'AI生成时使用的提示词',
    created_by BIGINT COMMENT '创建人ID',

    -- Bento Grid 支持
    grid_columns INT DEFAULT 2 COMMENT '网格列数',

    -- 时段布局
    time_based_enabled SMALLINT DEFAULT 0 COMMENT '是否启用时段布局: 0否 1是',
    morning_layout JSON COMMENT '早间布局(6-12点)',
    afternoon_layout JSON COMMENT '午间布局(12-18点)',
    evening_layout JSON COMMENT '晚间布局(18-24点)',

    -- 行为学习
    usage_stats JSON COMMENT '模块使用统计',
    last_suggestion_at TIMESTAMP WITH TIME ZONE COMMENT '上次建议时间',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    INDEX idx_factory_home_layout_factory (factory_id),
    INDEX idx_factory_home_layout_status (status)
);

-- AI装饰会话表
CREATE TABLE IF NOT EXISTS app_decoration_session (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE COMMENT '会话ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    user_prompt TEXT NOT NULL COMMENT '用户输入的提示词',
    intent_code VARCHAR(50) COMMENT '识别的意图代码',
    generated_config JSON COMMENT 'AI生成的配置',
    status SMALLINT DEFAULT 0 COMMENT '状态: 0处理中 1成功 2失败 3已应用',
    conversation_history JSON COMMENT '对话历史',
    clarification_needed SMALLINT DEFAULT 0 COMMENT '是否需要澄清: 0否 1是',

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    INDEX idx_decoration_session_factory (factory_id),
    INDEX idx_decoration_session_user (user_id),
    INDEX idx_decoration_session_status (status)
);

-- ============================================================
-- 添加装饰相关的意图配置
-- ============================================================

INSERT INTO ai_intent_configs (id, factory_id, intent_code, intent_name, intent_category, sensitivity_level, keywords, description, is_active, created_at, updated_at)
VALUES
(UUID(), NULL, 'HOME_LAYOUT_UPDATE', '首页布局调整', 'DECORATION', 'MEDIUM',
 '["布局","调整","移动","顺序","排序","放到","移到","隐藏","显示"]',
 '调整首页模块的显示顺序或可见性', 1, NOW(), NOW()),

(UUID(), NULL, 'HOME_LAYOUT_GENERATE', 'AI生成首页布局', 'DECORATION', 'MEDIUM',
 '["生成","推荐","建议","自动","优化","布局","设计","首页"]',
 '根据用户描述使用AI生成首页布局配置', 1, NOW(), NOW()),

(UUID(), NULL, 'HOME_LAYOUT_SUGGEST', '智能布局建议', 'DECORATION', 'LOW',
 '["建议","推荐","分析","优化","习惯"]',
 '根据用户使用习惯分析并推荐最优布局', 1, NOW(), NOW());
