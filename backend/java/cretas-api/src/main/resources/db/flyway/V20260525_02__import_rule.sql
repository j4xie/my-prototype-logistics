-- Sprint 4 Chat K C-IMPORT-CENTER-1 (2026-05-16)
-- 用户可配置的导入规则中心. ImportService.importByRule 解析 Excel + 行级 validate + dryrun + commit.
-- 与现有 module-specific /import 端点 (CustomerController:419/466, EquipmentController:453, ...)
-- 并存, 不替换. 失败行通过 ExcelUtil 反向导出.

CREATE TABLE IF NOT EXISTS import_rules (
    id                  BIGSERIAL    PRIMARY KEY,
    factory_id          VARCHAR(64)  NOT NULL,
    module_code         VARCHAR(64)  NOT NULL,
    rule_name           VARCHAR(200) NOT NULL,
    description         TEXT,
    -- mapping: [{"excelCol":"客户名","entityField":"customerName","validator":"required|maxLength:100"},...]
    -- validator 格式: pipe-separated rules. 支持 required / maxLength:N / minLength:N /
    --                 numeric / email / regex:<pattern> / enum:<comma-list>
    mapping             JSONB        NOT NULL,
    -- dedup_strategy: SKIP (existing row 跳过) | UPDATE (update existing) | ERROR (报错)
    dedup_strategy      VARCHAR(20)  NOT NULL DEFAULT 'ERROR',
    -- dedup_key_field: entity field used to detect duplicates, e.g. "customerCode"
    dedup_key_field     VARCHAR(100),
    -- target_entity: fully-qualified class name, e.g. "com.cretas.aims.entity.Customer"
    target_entity       VARCHAR(200) NOT NULL,
    created_by          BIGINT,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_rules_factory_module
    ON import_rules (factory_id, module_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_import_rules_factory_created
    ON import_rules (factory_id, created_at) WHERE deleted_at IS NULL;

-- ImportJob 表跟踪导入任务 (dryrun + commit 两步).
CREATE TABLE IF NOT EXISTS import_jobs (
    id              VARCHAR(64)  PRIMARY KEY,  -- UUID
    factory_id      VARCHAR(64)  NOT NULL,
    rule_id         BIGINT       NOT NULL REFERENCES import_rules(id),
    triggered_by    BIGINT       NOT NULL,
    -- status: PENDING | DRYRUN_DONE | COMMITTED | FAILED
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    source_filename TEXT,
    source_file_path TEXT,        -- 上传文件存储路径
    total_rows      INTEGER,
    valid_rows      INTEGER,
    error_rows      INTEGER,
    committed_rows  INTEGER,
    -- errors: [{"row":3,"col":"客户名","msg":"长度超过 100"},...]
    errors          JSONB,
    error_file_path TEXT,         -- 失败行反向导出 Excel 路径
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_factory_status
    ON import_jobs (factory_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_import_jobs_rule
    ON import_jobs (rule_id) WHERE deleted_at IS NULL;
