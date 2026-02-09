-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_29_3__drools_rules_tables.sql
-- Conversion date: 2026-01-26 18:45:56
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- Drools 规则引擎表结构
-- Version: V2025_12_29_3
-- Description: P1 规则引擎相关表
-- =====================================================

-- 1. 规则定义表
CREATE TABLE IF NOT EXISTS drools_rules (
    id VARCHAR(50) PRIMARY KEY COMMENT '规则ID (UUID)',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    rule_group VARCHAR(50) NOT NULL COMMENT '规则组 (validation, workflow, costing, quality)',
    rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
    rule_description TEXT COMMENT '规则描述',
    rule_content TEXT NOT NULL COMMENT 'DRL 规则内容',
    decision_table BYTEA COMMENT 'Excel 决策表内容 (可选)',
    decision_table_type VARCHAR(20) COMMENT '决策表类型 (XLS, XLSX, CSV)',
    version INT DEFAULT 1 COMMENT '规则版本号',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '执行优先级 (越大越先)',
    created_by BIGINT COMMENT '创建者用户ID',
    updated_by BIGINT COMMENT '最后修改者用户ID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    INDEX idx_drools_rules_factory (factory_id),
    INDEX idx_drools_rules_group (factory_id, rule_group),
    INDEX idx_drools_rules_enabled (factory_id, enabled),
    UNIQUE KEY uk_drools_rules_name (factory_id, rule_group, rule_name)
);

-- 2. 规则事件绑定表
CREATE TABLE IF NOT EXISTS rule_event_bindings (
    id VARCHAR(50) PRIMARY KEY COMMENT '绑定ID (UUID)',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    entity_type VARCHAR(50) NOT NULL COMMENT '实体类型 (QUALITY_CHECK, MATERIAL_BATCH, PROCESSING_BATCH)',
    event_type VARCHAR(50) NOT NULL COMMENT '事件类型 (beforeSubmit, afterSubmit, onTransition, onValidation)',
    rule_group VARCHAR(50) NOT NULL COMMENT '关联的规则组',
    priority INT DEFAULT 0 COMMENT '执行优先级',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    condition_expression VARCHAR(500) COMMENT '触发条件表达式 (可选)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_rule_bindings_factory (factory_id),
    INDEX idx_rule_bindings_entity (factory_id, entity_type),
    INDEX idx_rule_bindings_event (factory_id, entity_type, event_type),
    UNIQUE KEY uk_rule_bindings (factory_id, entity_type, event_type, rule_group)
);

-- 3. 状态机配置表
CREATE TABLE IF NOT EXISTS state_machines (
    id VARCHAR(50) PRIMARY KEY COMMENT '状态机ID (UUID)',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    entity_type VARCHAR(50) NOT NULL COMMENT '实体类型 (QUALITY_CHECK, PROCESSING_BATCH)',
    machine_name VARCHAR(100) NOT NULL COMMENT '状态机名称',
    machine_description TEXT COMMENT '状态机描述',
    initial_state VARCHAR(50) NOT NULL COMMENT '初始状态',
    states_json JSON NOT NULL COMMENT '状态定义 JSON [{"code":"pending", "name":"待处理", "isFinal":false}]',
    transitions_json JSON NOT NULL COMMENT '状态转换 JSON [{"from":"pending", "to":"approved", "event":"approve", "guard":"..."}]',
    version INT DEFAULT 1 COMMENT '版本号',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_by BIGINT COMMENT '创建者用户ID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE COMMENT '软删除时间',

    INDEX idx_state_machines_factory (factory_id),
    INDEX idx_state_machines_entity (factory_id, entity_type),
    UNIQUE KEY uk_state_machines (factory_id, entity_type)
);

-- 4. 规则执行日志表 (可选，用于调试和审计)
CREATE TABLE IF NOT EXISTS rule_execution_logs (
    id BIGSERIAL PRIMARY KEY COMMENT '日志ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    rule_group VARCHAR(50) NOT NULL COMMENT '规则组',
    rule_name VARCHAR(100) COMMENT '触发的规则名称',
    entity_type VARCHAR(50) COMMENT '相关实体类型',
    entity_id VARCHAR(50) COMMENT '相关实体ID',
    input_facts JSON COMMENT '输入事实 (JSON)',
    output_results JSON COMMENT '输出结果 (JSON)',
    execution_time_ms INT COMMENT '执行时间 (毫秒)',
    fired_rules_count INT COMMENT '触发的规则数量',
    success BOOLEAN DEFAULT TRUE COMMENT '是否成功',
    error_message TEXT COMMENT '错误信息',
    executed_by BIGINT COMMENT '执行者用户ID',
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',

    INDEX idx_rule_logs_factory (factory_id),
    INDEX idx_rule_logs_time (executed_at),
    INDEX idx_rule_logs_entity (entity_type, entity_id)
);

-- 5. 规则版本历史表
CREATE TABLE IF NOT EXISTS drools_rule_versions (
    id VARCHAR(50) PRIMARY KEY COMMENT '版本ID (UUID)',
    rule_id VARCHAR(50) NOT NULL COMMENT '规则ID',
    version INT NOT NULL COMMENT '版本号',
    rule_content TEXT NOT NULL COMMENT 'DRL 规则内容',
    decision_table BYTEA COMMENT 'Excel 决策表内容',
    change_reason VARCHAR(500) COMMENT '变更原因',
    changed_by BIGINT COMMENT '变更者用户ID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_rule_versions_rule (rule_id),
    INDEX idx_rule_versions_number (rule_id, version)
);
