-- Client Requirement Feedback System
-- 客户需求反馈系统 - 数据库迁移

CREATE TABLE IF NOT EXISTS client_requirement_company (
    id BIGSERIAL PRIMARY KEY,
    company_id VARCHAR(100) NOT NULL UNIQUE,
    company_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    total_fields INTEGER DEFAULT 0,
    completed_fields INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_requirement_feedback (
    id BIGSERIAL PRIMARY KEY,
    company_id VARCHAR(100) NOT NULL,
    section VARCHAR(100) NOT NULL,
    row_index INTEGER NOT NULL,
    field_name VARCHAR(200),
    applicability VARCHAR(50),
    priority VARCHAR(50),
    note VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT uk_company_section_row UNIQUE (company_id, section, row_index)
);

CREATE INDEX IF NOT EXISTS idx_feedback_company_id ON client_requirement_feedback(company_id);
