-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_6__ai_intent_configs.sql
-- Conversion date: 2026-01-26 18:46:45
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2025_12_31_4__ai_intent_configs.sql
-- AI意图配置表
-- ============================================================

-- 创建AI意图配置表
CREATE TABLE IF NOT EXISTS ai_intent_configs (
    id VARCHAR(36) PRIMARY KEY,
    intent_code VARCHAR(50) NOT NULL UNIQUE COMMENT '意图代码',
    intent_name VARCHAR(100) NOT NULL COMMENT '意图名称',
    intent_category VARCHAR(50) COMMENT '意图分类 (ANALYSIS, DATA_OP, FORM, SCHEDULE, SYSTEM)',
    sensitivity_level VARCHAR(20) DEFAULT 'LOW' COMMENT '敏感度 (LOW, MEDIUM, HIGH, CRITICAL)',
    required_roles JSON COMMENT '允许的角色列表',
    quota_cost INT DEFAULT 1 COMMENT '配额消耗值',
    cache_ttl_minutes INT DEFAULT 0 COMMENT '缓存有效期 (分钟)',
    requires_approval BOOLEAN DEFAULT FALSE COMMENT '是否需要审批',
    approval_chain_id VARCHAR(36) COMMENT '审批链ID',
    keywords JSON COMMENT '触发关键词列表',
    regex_pattern VARCHAR(500) COMMENT '正则匹配规则',
    description VARCHAR(500) COMMENT '意图描述',
    handler_class VARCHAR(200) COMMENT '处理器类名',
    max_tokens INT DEFAULT 2000 COMMENT '最大响应token数',
    response_template TEXT COMMENT '响应模板',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '优先级',
    metadata JSON COMMENT '扩展元数据',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    INDEX idx_intent_category (intent_category),
    INDEX idx_intent_sensitivity (sensitivity_level),
    INDEX idx_intent_is_active (is_active)
);

-- ============================================================
-- 初始化AI意图配置数据
-- ============================================================

-- ANALYSIS 类意图 (数据分析，只读操作)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, cache_ttl_minutes, keywords, description, priority)
VALUES
    (UUID(), 'COST_ANALYSIS', '成本分析', 'ANALYSIS', 'MEDIUM', 2, 30,
     '["成本", "费用", "预算", "开支", "分析", "cost"]',
     '分析生产成本、原材料成本、人工成本等', 100),

    (UUID(), 'QUALITY_ANALYSIS', '质量分析', 'ANALYSIS', 'LOW', 1, 60,
     '["质量", "合格率", "不良率", "质检", "检验"]',
     '分析产品质量数据、合格率趋势等', 90),

    (UUID(), 'PRODUCTION_ANALYSIS', '生产分析', 'ANALYSIS', 'LOW', 1, 30,
     '["产量", "产能", "效率", "生产", "统计"]',
     '分析生产数据、产能利用率等', 90),

    (UUID(), 'INVENTORY_ANALYSIS', '库存分析', 'ANALYSIS', 'LOW', 1, 30,
     '["库存", "存量", "库存", "盘点"]',
     '分析库存状况、周转率等', 80),

    (UUID(), 'TREND_PREDICTION', '趋势预测', 'ANALYSIS', 'MEDIUM', 3, 60,
     '["预测", "趋势", "预计", "展望", "forecast"]',
     '基于历史数据预测未来趋势', 70);

-- DATA_OP 类意图 (数据操作，可能修改数据)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, requires_approval, keywords, description, priority)
VALUES
    (UUID(), 'BATCH_UPDATE', '批量更新', 'DATA_OP', 'HIGH', 2, FALSE,
     '["批量", "更新", "修改", "调整", "update"]',
     '批量更新数据记录', 80),

    (UUID(), 'DATA_CORRECTION', '数据修正', 'DATA_OP', 'HIGH', 2, FALSE,
     '["修正", "纠正", "更正", "fix"]',
     '修正错误数据', 70),

    (UUID(), 'BATCH_DELETE', '批量删除', 'DATA_OP', 'CRITICAL', 3, TRUE,
     '["批量删除", "清除", "移除", "delete all"]',
     '批量删除数据记录 (需要审批)', 60);

-- FORM 类意图 (表单生成)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, cache_ttl_minutes, keywords, description, priority)
VALUES
    (UUID(), 'FORM_GENERATION', '表单生成', 'FORM', 'LOW', 2, 0,
     '["表单", "添加字段", "新增", "form", "field"]',
     '根据需求生成表单字段配置', 100),

    (UUID(), 'FORM_VALIDATION', '表单校验', 'FORM', 'LOW', 1, 30,
     '["校验", "验证", "规则", "validate"]',
     '生成表单校验规则', 90),

    (UUID(), 'FORM_SUGGESTION', '表单建议', 'FORM', 'LOW', 1, 60,
     '["建议", "推荐", "优化", "suggest"]',
     '提供表单优化建议', 80);

-- SCHEDULE 类意图 (排程相关)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, keywords, description, priority)
VALUES
    (UUID(), 'SCHEDULE_OPTIMIZATION', '排程优化', 'SCHEDULE', 'MEDIUM', 3,
     '["排程", "调度", "优化", "schedule", "安排"]',
     '优化生产排程方案', 100),

    (UUID(), 'RESOURCE_ALLOCATION', '资源分配', 'SCHEDULE', 'MEDIUM', 2,
     '["资源", "分配", "人员", "设备", "allocate"]',
     '优化资源分配建议', 90),

    (UUID(), 'CAPACITY_PLANNING', '产能规划', 'SCHEDULE', 'MEDIUM', 2,
     '["产能", "规划", "容量", "capacity"]',
     '产能规划和瓶颈分析', 80),

    (UUID(), 'URGENT_INSERT', '紧急插单', 'SCHEDULE', 'HIGH', 3,
     '["紧急", "插单", "加急", "urgent"]',
     '紧急插单影响分析', 70);

-- SYSTEM 类意图 (系统管理)
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, sensitivity_level, quota_cost, requires_approval, keywords, description, priority)
VALUES
    (UUID(), 'SYSTEM_REPORT', '系统报表', 'SYSTEM', 'LOW', 1,FALSE,
     '["报表", "汇总", "report", "summary"]',
     '生成系统报表和汇总', 90),

    (UUID(), 'SYSTEM_CONFIG', '系统配置', 'SYSTEM', 'CRITICAL', 2, TRUE,
     '["配置", "设置", "参数", "config", "setting"]',
     '修改系统配置 (需要审批)', 80),

    (UUID(), 'USER_QUERY', '用户咨询', 'SYSTEM', 'LOW', 1, FALSE,
     '["怎么", "如何", "什么", "帮助", "help"]',
     '回答用户使用问题', 100);
