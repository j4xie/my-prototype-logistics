-- SmartBI Schema Metadata Tables
-- 用于动态管理数据源、字段定义、Schema 变更历史和分析配置

-- 数据源定义
CREATE TABLE IF NOT EXISTS smart_bi_datasource (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '数据源名称',
    source_type ENUM('EXCEL', 'API', 'DB') NOT NULL DEFAULT 'EXCEL',
    factory_id VARCHAR(50) NOT NULL,
    schema_version INT DEFAULT 1 COMMENT 'Schema 版本',
    last_schema_change DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_name_factory (name, factory_id)
);

-- 字段定义（动态）
CREATE TABLE IF NOT EXISTS smart_bi_field_definition (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    datasource_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL COMMENT '原始字段名',
    field_alias VARCHAR(100) COMMENT '显示名称',
    field_type ENUM('NUMBER', 'STRING', 'DATE', 'BOOLEAN') NOT NULL,
    metric_type ENUM('MEASURE', 'DIMENSION', 'TIME') NOT NULL COMMENT '指标类型',
    aggregation ENUM('SUM', 'AVG', 'COUNT', 'MAX', 'MIN', 'NONE') DEFAULT 'NONE',
    is_kpi BOOLEAN DEFAULT FALSE COMMENT '是否作为 KPI 展示',
    chart_types JSON COMMENT '适用的图表类型',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (datasource_id) REFERENCES smart_bi_datasource(id) ON DELETE CASCADE
);

-- Schema 变更历史
CREATE TABLE IF NOT EXISTS smart_bi_schema_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    datasource_id BIGINT NOT NULL,
    change_type ENUM('ADD_COLUMN', 'DROP_COLUMN', 'MODIFY_COLUMN', 'RENAME_COLUMN') NOT NULL,
    old_schema JSON,
    new_schema JSON,
    ddl_executed VARCHAR(1000),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    FOREIGN KEY (datasource_id) REFERENCES smart_bi_datasource(id) ON DELETE CASCADE
);

-- 分析配置（动态生成）
CREATE TABLE IF NOT EXISTS smart_bi_analysis_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    datasource_id BIGINT NOT NULL,
    config_type ENUM('KPI', 'CHART', 'RANKING', 'INSIGHT') NOT NULL,
    config_json JSON NOT NULL COMMENT '动态配置',
    prompt_template TEXT COMMENT 'AI 分析 Prompt',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (datasource_id) REFERENCES smart_bi_datasource(id) ON DELETE CASCADE
);

-- Skills 定义表
CREATE TABLE IF NOT EXISTS smart_bi_skill (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT 'skill 唯一标识',
    display_name VARCHAR(100) COMMENT '显示名称',
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    triggers JSON COMMENT '触发词列表',
    tools JSON COMMENT '关联的 Tool 名称',
    context_needed JSON COMMENT '需要的上下文',
    prompt_template TEXT COMMENT 'Prompt 模板',
    config JSON COMMENT '额外配置',
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
