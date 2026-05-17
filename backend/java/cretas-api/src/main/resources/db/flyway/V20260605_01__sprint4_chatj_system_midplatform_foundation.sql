-- Sprint 4 Wave 2 Chat J — 系统中台 P1 bundle foundation tables.
-- 3 tables in single migration (transactional):
--   1. permission_registry      — C-CHECKPOWER-1 (this session, full schema)
--   2. opinion_templates        — C-OPINION-1 (skeleton; full impl in follow-up chat)
--   3. voucher_templates        — C-VOUCHER-TPL-1 (skeleton; full impl in follow-up chat)
--
-- All tables use BaseEntity audit columns (created_at / updated_at / deleted_at).
-- @Where(deleted_at IS NULL) per-entity. Soft-delete only.

-- =========================================================================
-- Table 1: permission_registry
-- Central registry of RBAC permission codes ("module:action" form).
-- Populated at startup by PermissionRegistryService via reflection scan of
-- @RequirePermission annotations + manual entries via API.
-- =========================================================================
CREATE TABLE permission_registry (
    id              VARCHAR(36)  PRIMARY KEY,
    permission_code VARCHAR(100) NOT NULL,
    module          VARCHAR(50)  NOT NULL,
    action          VARCHAR(50)  NOT NULL,
    description     TEXT,
    source          VARCHAR(20)  NOT NULL DEFAULT 'ANNOTATION',
        -- ANNOTATION: scanned from @RequirePermission
        -- MANUAL:     added via admin API
        -- SEED:       inserted by migration / seed data
    source_class    VARCHAR(255),
    source_method   VARCHAR(255),
    factory_id      VARCHAR(50),
        -- NULL = global / cross-factory permission
        -- non-NULL = factory-scoped permission
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

-- Unique on (permission_code, factory_id) so per-factory permissions can shadow global.
-- Partial unique index excludes soft-deleted rows.
CREATE UNIQUE INDEX uq_permission_registry_code_factory
    ON permission_registry (permission_code, COALESCE(factory_id, '__GLOBAL__'))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_permission_registry_module ON permission_registry (module);
CREATE INDEX idx_permission_registry_source ON permission_registry (source);
CREATE INDEX idx_permission_registry_factory ON permission_registry (factory_id) WHERE factory_id IS NOT NULL;

COMMENT ON TABLE  permission_registry IS 'C-CHECKPOWER-1 中央权限登记表 — 跨 controller @RequirePermission 自动 scan 注册';
COMMENT ON COLUMN permission_registry.permission_code IS '权限编码 module:action 形式, e.g. production:read';
COMMENT ON COLUMN permission_registry.source IS 'ANNOTATION / MANUAL / SEED';
COMMENT ON COLUMN permission_registry.factory_id IS 'NULL = 全局; 非 NULL = 工厂级权限';

-- =========================================================================
-- Table 2: opinion_templates
-- C-OPINION-1: 节点意见模板 (审批快捷常用语 e.g. "同意", "请补充材料")
-- Per-factory + per-decision-type catalog. Vue 审批 dialog 加快捷选择。
-- Skeleton this session — full service/controller in follow-up chat.
-- =========================================================================
CREATE TABLE opinion_templates (
    id            VARCHAR(36)  PRIMARY KEY,
    factory_id    VARCHAR(50),
        -- NULL = system-wide preset (seed); non-NULL = factory custom
    decision_type VARCHAR(50)  NOT NULL,
        -- 匹配 ApprovalChainConfig.DecisionType inner enum:
        -- FORCE_INSERT / QUALITY_RELEASE / QUALITY_EXCEPTION / BATCH_STATUS_CHANGE
        -- SUPPLIER_APPROVAL / SUPPLIER_STATUS_CHANGE / MATERIAL_DISPOSAL
        -- PRODUCTION_PLAN_CHANGE / EQUIPMENT_STATUS_CHANGE / CUSTOM
    content       VARCHAR(500) NOT NULL,
    sort_order    INT          NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMP
);

CREATE INDEX idx_opinion_templates_factory_decision
    ON opinion_templates (factory_id, decision_type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_opinion_templates_sort ON opinion_templates (sort_order) WHERE deleted_at IS NULL;

COMMENT ON TABLE  opinion_templates IS 'C-OPINION-1 审批意见快捷模板 (Sprint 4 Wave 2 Chat J foundation; full impl pending)';
COMMENT ON COLUMN opinion_templates.factory_id IS 'NULL = 系统预设; 非 NULL = 工厂自定义';
COMMENT ON COLUMN opinion_templates.decision_type IS '与 ApprovalChainConfig.DecisionType 同枚举';

-- Seed 5 system-wide opinions (factory_id NULL).
-- 不会与未来工厂自定义冲突 (unique 索引上 partial)。
INSERT INTO opinion_templates (id, factory_id, decision_type, content, sort_order, is_active)
VALUES
    (gen_random_uuid()::text, NULL, 'CUSTOM', '同意',                 1, TRUE),
    (gen_random_uuid()::text, NULL, 'CUSTOM', '不同意',               2, TRUE),
    (gen_random_uuid()::text, NULL, 'CUSTOM', '请补充材料后重新提交', 3, TRUE),
    (gen_random_uuid()::text, NULL, 'CUSTOM', '已核实',               4, TRUE),
    (gen_random_uuid()::text, NULL, 'CUSTOM', '金额过高，需总监审',   5, TRUE);

-- =========================================================================
-- Table 3: voucher_templates
-- C-VOUCHER-TPL-1: 凭证模板系统. Sprint 3 E Voucher generators 当前写死科目
-- (1122 应收账款 / 6001 主营业务收入 等). 加 template entity 让财务管理员可
-- 编辑科目映射. VoucherGenerator refactor 让 template 优先, hardcoded 兜底.
--
-- entries_json stores entry array as JSONB to keep this migration to 3 tables.
-- 每个 entry 形状:
--   { "sortOrder": 0,
--     "subjectCode": "1122",
--     "subjectName": "应收账款",
--     "direction":   "DEBIT" | "CREDIT",
--     "amountExpression": "#order.totalAmount",   -- SpEL
--     "description": "..." }
--
-- Skeleton this session — entity + repo only. Full service + refactor + Vue
-- editor in follow-up chat. Backward compat: 任何 voucherType+factory 无 active
-- template 时,VoucherGenerator 继续走 hardcoded 路径。
-- =========================================================================
CREATE TABLE voucher_templates (
    id            VARCHAR(36)  PRIMARY KEY,
    factory_id    VARCHAR(50)  NOT NULL,
    voucher_type  VARCHAR(50)  NOT NULL,
        -- 匹配 VoucherType enum: SALES_RECEIPT / PURCHASE_PAYMENT /
        -- INVENTORY_TRANSFER / EXPENSE / WAGE / RETURN / DEPRECATION
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    entries_json  JSONB        NOT NULL DEFAULT '[]'::jsonb,
        -- 借贷分录数组. Generator 用 SpEL 求值 amountExpression 拿到金额。
    is_default    BOOLEAN      NOT NULL DEFAULT FALSE,
        -- 同一 factory+voucherType 最多一条 is_default=TRUE
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMP
);

CREATE INDEX idx_voucher_templates_factory_type
    ON voucher_templates (factory_id, voucher_type)
    WHERE deleted_at IS NULL;

-- 只允许一条 default per (factory_id, voucher_type)
CREATE UNIQUE INDEX uq_voucher_templates_default
    ON voucher_templates (factory_id, voucher_type)
    WHERE is_default = TRUE AND deleted_at IS NULL;

COMMENT ON TABLE  voucher_templates IS 'C-VOUCHER-TPL-1 凭证生成模板 (Sprint 4 Wave 2 Chat J foundation; full impl + 7 generator refactor pending)';
COMMENT ON COLUMN voucher_templates.entries_json IS 'JSONB array of entries: [{sortOrder,subjectCode,subjectName,direction,amountExpression,description}]';
COMMENT ON COLUMN voucher_templates.is_default IS '同 factory+voucherType 唯一 default (unique partial index 强制)';
