-- 数据织网 Sub-Project B Day 1 (Apr 26 2026): entity resolution baseline schema.
--
-- Per 03-B v1.2 spec §2.2 (orchestrator) + §5.4.1 (admin queue) + §6 (labeling SOP).
-- Implements 3 tables:
--   1. entity_resolution_labels      — 1200-pair gold standard for B1/B2 holdout eval
--   2. entity_resolution_admin_queue — low-confidence pair arbitration UI backend
--   3. entity_resolution_history     — audit log + transitive agent input
--
-- All FORCE RLS. Apply timing: deploy at start of B Phase 1 (Day 1) test env, prod 灰度 with B M2 ship.

-- =============================================================================
-- Table 1: entity_resolution_labels
-- 1200-pair gold standard for B6 (per spec 03-B §6): 500 店名 + 500 菜名 + 200 人名
-- =============================================================================
CREATE TABLE IF NOT EXISTS entity_resolution_labels (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('store', 'product', 'staff')),
    pair_a TEXT NOT NULL,
    pair_b TEXT NOT NULL,
    -- Sources: 'real_sample' (from prod dim_*) or 'perturbation' (programmatically generated)
    source VARCHAR(20) NOT NULL DEFAULT 'real_sample',
    -- 标注 (gold label, double-blind, then arbitrated)
    gold_label VARCHAR(10) CHECK (gold_label IN ('match', 'no_match', 'unsure')),
    labeler_a VARCHAR(50),
    labeler_a_label VARCHAR(10) CHECK (labeler_a_label IN ('match', 'no_match', 'unsure')),
    labeler_a_at TIMESTAMP,
    labeler_b VARCHAR(50),
    labeler_b_label VARCHAR(10) CHECK (labeler_b_label IN ('match', 'no_match', 'unsure')),
    labeler_b_at TIMESTAMP,
    arbitrated_by VARCHAR(50),
    arbitrated_at TIMESTAMP,
    -- 60/20/20 split
    dataset_split VARCHAR(10) NOT NULL DEFAULT 'unassigned'
        CHECK (dataset_split IN ('train', 'dev', 'holdout', 'unassigned')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE entity_resolution_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_resolution_labels FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON entity_resolution_labels
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- Lookup pattern: query by entity_type + dataset_split for training/eval batches
CREATE INDEX idx_er_labels_type_split
    ON entity_resolution_labels (factory_id, entity_type, dataset_split);

-- Audit pattern: list pairs needing arbitration (labeler_a != labeler_b)
CREATE INDEX idx_er_labels_arbitration
    ON entity_resolution_labels (factory_id, entity_type)
    WHERE arbitrated_at IS NULL
      AND labeler_a_at IS NOT NULL
      AND labeler_b_at IS NOT NULL
      AND labeler_a_label != labeler_b_label;

-- =============================================================================
-- Table 2: entity_resolution_admin_queue
-- Low-confidence pair admin arbitration (per spec 03-B §5.4.1 + S-NEW-1 dropped_row_refs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS entity_resolution_admin_queue (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('store', 'product', 'staff')),
    raw_name TEXT NOT NULL,
    candidate_entity_id BIGINT,           -- 系统建议匹配的现有 entity (NULL = 全新)
    confidence NUMERIC(3,2),              -- 0.00-1.00
    decided_by_agent VARCHAR(30),         -- 'deterministic' / 'embedding' / 'llm_arbitrator' / etc
    -- spec S-NEW-1: confirm 后 replay 这些 dropped 行
    dropped_row_refs JSONB,               -- 例: [{"upload_id": 123, "row_index": 45}, ...]
    -- Admin 决定
    admin_action VARCHAR(20) CHECK (admin_action IN ('confirm', 'reject', 'create_new')),
    admin_resolved_to_entity_id BIGINT,   -- confirm/create_new 后的 entity
    admin_user VARCHAR(50),
    admin_at TIMESTAMP,
    -- Source
    source_upload_id BIGINT,              -- 哪个 upload 触发的
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE entity_resolution_admin_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_resolution_admin_queue FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON entity_resolution_admin_queue
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- 主查询: admin UI 列出待裁决队列
CREATE INDEX idx_er_admin_queue_pending
    ON entity_resolution_admin_queue (factory_id, entity_type, created_at DESC)
    WHERE admin_at IS NULL;

-- =============================================================================
-- Table 3: entity_resolution_history
-- Audit log + transitive agent input (spec 03-B §2.2 修 C-2)
-- =============================================================================
CREATE TABLE IF NOT EXISTS entity_resolution_history (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('store', 'product', 'staff')),
    -- a_name -> matched to b_entity_id (b's normalized name in b_name)
    a_name TEXT NOT NULL,
    b_entity_id BIGINT NOT NULL,
    b_name TEXT NOT NULL,                 -- spec C-NEW-2: lookup from dim, not self-ref
    confidence NUMERIC(3,2),
    decided_by_agent VARCHAR(30),
    reasoning TEXT,
    -- spec C-NEW-3: prevent table explosion
    -- (factory_id, entity_type, a_name, b_entity_id) UNIQUE
    UNIQUE (factory_id, entity_type, a_name, b_entity_id),
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE entity_resolution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_resolution_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON entity_resolution_history
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX idx_er_history_lookup
    ON entity_resolution_history (factory_id, entity_type, a_name);

-- Rollback:
--   DROP TABLE IF EXISTS entity_resolution_history;
--   DROP TABLE IF EXISTS entity_resolution_admin_queue;
--   DROP TABLE IF EXISTS entity_resolution_labels;
