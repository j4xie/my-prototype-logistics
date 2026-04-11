-- P1-9 BOM 变更痕迹追踪 (v1 §2.2.6)
--
-- 客户需求: BOM 配方调整(加减物料/改用量)的审计历史, 方便看到"什么时候把带鱼段
-- 10kg 改成了 12kg / 谁改的 / 为什么".

CREATE TABLE IF NOT EXISTS bom_change_logs (
    id                  VARCHAR(64)  PRIMARY KEY,
    factory_id          VARCHAR(64)  NOT NULL,
    bom_id              VARCHAR(191),
    bom_item_id         BIGINT,
    change_type         VARCHAR(20)  NOT NULL CHECK (change_type IN ('CREATE','UPDATE','DELETE')),
    old_value           JSONB,
    new_value           JSONB,
    changed_by          BIGINT,
    changed_by_name     VARCHAR(100),
    change_reason       TEXT,
    created_at          TIMESTAMP    DEFAULT NOW(),
    updated_at          TIMESTAMP    DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bcl_bom ON bom_change_logs(bom_id);
CREATE INDEX IF NOT EXISTS idx_bcl_bom_item ON bom_change_logs(bom_item_id);
CREATE INDEX IF NOT EXISTS idx_bcl_factory_time ON bom_change_logs(factory_id, created_at);

COMMENT ON TABLE bom_change_logs IS
    'BOM 变更痕迹追踪 (P1-9, v1 §2.2.6). Service 层 wire up 留后续 — 可用 AOP 或 EventListener.';
