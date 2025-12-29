-- 表单模板版本历史表
-- 用于存储模板的历史版本，支持版本回滚

CREATE TABLE IF NOT EXISTS form_template_versions (
    id VARCHAR(50) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL COMMENT '关联的模板ID',
    factory_id VARCHAR(50) COMMENT '工厂ID',
    entity_type VARCHAR(50) NOT NULL COMMENT '实体类型',
    name VARCHAR(100) NOT NULL COMMENT '模板名称',
    schema_json TEXT COMMENT 'Schema JSON',
    ui_schema_json TEXT COMMENT 'UI Schema JSON',
    description VARCHAR(500) COMMENT '描述',
    version INT NOT NULL COMMENT '版本号',
    source VARCHAR(20) COMMENT '来源 (MANUAL, AI_ASSISTANT, IMPORT)',
    created_by BIGINT COMMENT '创建者ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '版本创建时间',
    change_summary VARCHAR(500) COMMENT '变更摘要',

    INDEX idx_template_id (template_id),
    INDEX idx_factory_entity_version (factory_id, entity_type, version),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单模板版本历史';
