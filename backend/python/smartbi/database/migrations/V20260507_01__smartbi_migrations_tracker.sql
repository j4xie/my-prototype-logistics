-- Bootstrap: tracker table for smartbi migration runner.
--
-- Spec: docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md
-- Trigger: task #30 — 8 个 data fabric C 系列 migrations 当初部署漏跑 prod, T6.2 4h 才发现
--
-- Chicken-and-egg: runner 需要这表才能跑, 所以部署 script 在 runner 之前先 psql -f 这个文件
-- 一次. 之后这文件 backfill 进 tracker 自身, 后续 idempotent.
--
-- PK = filename (not version) — 见 review 决策 2026-05-07: 历史上 V20260427_01 有两个不同
-- 文件 (chat_session_v3_history + extend_admin_queue_entity_types). 用 filename 作 PK
-- 防 future dupes 静默跳过.

CREATE TABLE IF NOT EXISTS smartbi_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    version VARCHAR(100) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100) DEFAULT current_user,
    duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_smartbi_migrations_applied_at
    ON smartbi_migrations(applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_smartbi_migrations_version
    ON smartbi_migrations(version);

GRANT SELECT, INSERT, UPDATE, DELETE ON smartbi_migrations TO smartbi_user;

-- Rollback:
--   DROP INDEX IF EXISTS idx_smartbi_migrations_version;
--   DROP INDEX IF EXISTS idx_smartbi_migrations_applied_at;
--   DROP TABLE IF EXISTS smartbi_migrations;
