-- workflow_templates: AI-generated workflow templates for Factory Config Agent
-- Templates are auto-extracted from published StateMachine configurations
-- when source_count >= 3 (quality threshold). Requires manual review before use.

CREATE TABLE IF NOT EXISTS workflow_templates (
    id              BIGSERIAL PRIMARY KEY,
    template_name   VARCHAR(200) NOT NULL,
    description     TEXT,
    industry_tags   JSONB DEFAULT '[]'::jsonb,
    workflow_json   JSONB NOT NULL,
    node_configs_json JSONB DEFAULT '{}'::jsonb,
    global_config_json JSONB DEFAULT '{}'::jsonb,
    source_count    INTEGER NOT NULL DEFAULT 0,
    review_status   VARCHAR(30) NOT NULL DEFAULT 'pending_review'
        CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'deprecated')),
    reviewed_by     BIGINT,
    reviewed_at     TIMESTAMP,
    review_notes    TEXT,
    is_seed_data    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wft_review_status ON workflow_templates(review_status);
CREATE INDEX idx_wft_industry_tags ON workflow_templates USING GIN(industry_tags);

COMMENT ON TABLE workflow_templates IS 'AI自动维护的工作流模板库，用于Factory Config Agent推荐';
COMMENT ON COLUMN workflow_templates.source_count IS '基于多少个真实配置抽象而来，>= 3才可提审';
COMMENT ON COLUMN workflow_templates.review_status IS 'pending_review=待审 / approved=已批准 / rejected=已驳回 / deprecated=已废弃';
COMMENT ON COLUMN workflow_templates.is_seed_data IS '是否为冷启动种子数据（手工预置）';
