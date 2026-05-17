-- Sprint 4 Chat K C-EXPORT-CENTER-1 (2026-05-16)
-- 用户可配置的导出规则中心. ExportService.exportByRule 读 rule + 跑查询 + EasyExcel 写文件.
-- 与现有 12 module-specific /export 端点 (CustomerController:356, EquipmentController:501, ...)
-- 并存, 不替换. 与 ReportExportService (per-reportType hardcoded) 也并存.

CREATE TABLE IF NOT EXISTS export_rules (
    id                  BIGSERIAL    PRIMARY KEY,
    factory_id          VARCHAR(64)  NOT NULL,
    module_code         VARCHAR(64)  NOT NULL,
    rule_name           VARCHAR(200) NOT NULL,
    description         TEXT,
    -- columns: [{"field":"customerName","header":"客户名","width":20},...]
    columns             JSONB        NOT NULL,
    -- filterExpression: SpEL expression evaluated against rowMap (NOT raw SQL/JPQL — SQL injection risk).
    -- e.g. "#row['status'] == 'ACTIVE' && #row['createdAt'] >= #startDate"
    filter_expression   TEXT,
    -- format: XLSX | CSV | PDF
    format              VARCHAR(10)  NOT NULL DEFAULT 'XLSX',
    is_async            BOOLEAN      NOT NULL DEFAULT FALSE,
    -- 触发 async 的阈值. 行数估算 > row_threshold 走 queue; 默认 10000 行.
    row_threshold       INTEGER      NOT NULL DEFAULT 10000,
    -- target_entity: fully-qualified JPA entity class name driving the SELECT,
    -- e.g. "com.cretas.aims.entity.Customer". ExportService uses reflection +
    -- EntityManager.createQuery to fetch by factoryId.
    target_entity       VARCHAR(200) NOT NULL,
    created_by          BIGINT,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_export_rules_factory_module
    ON export_rules (factory_id, module_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_export_rules_factory_created
    ON export_rules (factory_id, created_at) WHERE deleted_at IS NULL;

-- AsyncJob 表用于跟踪 >10MB / >row_threshold 的异步导出任务.
CREATE TABLE IF NOT EXISTS export_jobs (
    id              VARCHAR(64)  PRIMARY KEY,  -- UUID
    factory_id      VARCHAR(64)  NOT NULL,
    rule_id         BIGINT       NOT NULL REFERENCES export_rules(id),
    triggered_by    BIGINT       NOT NULL,
    -- status: PENDING | RUNNING | SUCCESS | FAILED
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    -- runtime_params: {"startDate":"2026-01-01",...} — SpEL filter 的输入变量
    runtime_params  JSONB,
    file_path       TEXT,         -- 完成后填: /tmp/export/{jobId}.xlsx
    file_size_bytes BIGINT,
    row_count       INTEGER,
    error_message   TEXT,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_factory_status
    ON export_jobs (factory_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_export_jobs_rule
    ON export_jobs (rule_id) WHERE deleted_at IS NULL;
