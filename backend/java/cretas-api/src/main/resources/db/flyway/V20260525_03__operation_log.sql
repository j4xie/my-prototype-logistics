-- Sprint 4 Chat K C-LOG-AUDIT-1 (2026-05-16)
-- 通用业务操作日志. 与 ai_audit_logs (AI 专用) / decision_audit_logs (决策审计) 并存,
-- 覆盖 CREATE/UPDATE/DELETE entity-level 操作. 通过 @Loggable AOP 自动采集.
-- 字段命名与 AIAuditLog 对齐 (factoryId / userId / ipAddress / userAgent).

CREATE TABLE IF NOT EXISTS operation_logs (
    id              BIGSERIAL    PRIMARY KEY,
    factory_id      VARCHAR(64)  NOT NULL,
    user_id         BIGINT,
    username        VARCHAR(100),
    module          VARCHAR(64)  NOT NULL,
    -- action: CREATE | UPDATE | DELETE | EXPORT | IMPORT | OTHER
    action          VARCHAR(20)  NOT NULL,
    -- entity_type: fully-qualified or simple class name, e.g. "Customer"
    entity_type     VARCHAR(200),
    entity_id       VARCHAR(100),
    -- old_value: full entity snapshot before; CREATE 时 null
    old_value       JSONB,
    -- new_value: full entity snapshot after; DELETE 时 null
    new_value       JSONB,
    -- diff: [{"field":"name","from":"foo","to":"bar"},...] — 计算后的字段级 diff
    diff            JSONB,
    -- summary: 业务级说明, e.g. "客户 ABC 状态改为停用"
    summary         TEXT,
    ip_address      VARCHAR(64),
    user_agent      VARCHAR(500),
    -- elapsed_ms: AOP 测得的方法执行耗时, 排查慢操作用
    elapsed_ms      BIGINT,
    -- success: AOP 捕获异常时 false, error_message 填入异常 msg
    success         BOOLEAN      NOT NULL DEFAULT TRUE,
    error_message   VARCHAR(1000),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_factory_created
    ON operation_logs (factory_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_created
    ON operation_logs (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operation_logs_module_action
    ON operation_logs (factory_id, module, action, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operation_logs_entity
    ON operation_logs (entity_type, entity_id) WHERE deleted_at IS NULL;
