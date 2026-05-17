-- V20260606_01: HR self-service workflow tables (Sprint 4 W2 Chat E — H-LEAVE+OVT+EXP)
--
-- Creates 4 tables for 3 employee self-service flows + 1 balance tracker:
--   * leave_requests       — 请假申请
--   * overtime_requests    — 加班/调休申请
--   * expense_requests     — 报销申请
--   * leave_balances       — 假期余额 (调休/年假/病假 月度累计)
--
-- Approval routing: ApprovalChainConfig.DecisionType enum extended with
--   LEAVE_APPROVAL / OVERTIME_APPROVAL / EXPENSE_APPROVAL (Java side).
--   Approval execution flows through ApprovalChainService.requiresApproval()
--   which dual-source-reads ApprovalWorkflow (graph) → flat fallback.
--
-- Attachments: receiptAttachments / leaveAttachments reuse polymorphic Attachment
--   (entity_type='LEAVE_REQUEST' / 'EXPENSE_REQUEST', entity_id=<request id>).
--
-- Payment hook: expense_requests.payment_record_id nullable, set on approve →
--   PaymentRecord PENDING (AP — outgoing reimbursement).

-- ============================================================
-- 1. leave_requests — 请假申请
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
        -- SICK / PERSONAL / ANNUAL / MARRIAGE / FUNERAL / MATERNITY / PATERNITY / COMPTIME / OTHER
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_hours NUMERIC(6,2) NOT NULL,
    reason VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        -- DRAFT / SUBMITTED / APPROVED / REJECTED / CANCELLED
    approval_workflow_id VARCHAR(36),
        -- ApprovalWorkflow / ApprovalChainConfig 链接, nullable 直到 SUBMITTED
    approver_ids JSONB,
        -- Long[] — 当前/已审批人员
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    reject_reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT ck_leave_dates CHECK (end_date >= start_date),
    CONSTRAINT ck_leave_duration_positive CHECK (duration_hours > 0)
);

CREATE INDEX IF NOT EXISTS idx_leave_factory_user
    ON leave_requests (factory_id, user_id, start_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leave_factory_status
    ON leave_requests (factory_id, status, submitted_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leave_factory_type_month
    ON leave_requests (factory_id, leave_type, start_date)
    WHERE deleted_at IS NULL AND status = 'APPROVED';

-- ============================================================
-- 2. overtime_requests — 加班/调休申请
-- ============================================================

CREATE TABLE IF NOT EXISTS overtime_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    overtime_type VARCHAR(20) NOT NULL,
        -- WEEKDAY / WEEKEND / HOLIDAY
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    hours NUMERIC(6,2) NOT NULL,
    reason VARCHAR(1000),
    compensation_type VARCHAR(20) NOT NULL,
        -- CASH (转加班工资) / COMPTIME (转调休余额)
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    approval_workflow_id VARCHAR(36),
    approver_ids JSONB,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    reject_reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT ck_ovt_times CHECK (end_time > start_time),
    CONSTRAINT ck_ovt_hours_positive CHECK (hours > 0)
);

CREATE INDEX IF NOT EXISTS idx_ovt_factory_user
    ON overtime_requests (factory_id, user_id, start_time)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ovt_factory_status
    ON overtime_requests (factory_id, status, submitted_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ovt_factory_comp
    ON overtime_requests (factory_id, compensation_type, start_time)
    WHERE deleted_at IS NULL AND status = 'APPROVED';

-- ============================================================
-- 3. expense_requests — 报销申请
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    category VARCHAR(20) NOT NULL,
        -- TRAVEL / MEAL / OFFICE / ENTERTAIN / TRAINING / OTHER
    amount NUMERIC(14,2) NOT NULL,
    expense_date DATE NOT NULL,
    reason VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    approval_workflow_id VARCHAR(36),
    approver_ids JSONB,
    payment_record_id VARCHAR(191),
        -- Set on APPROVED → PaymentRecord PENDING (AP — 报销付款)
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    paid_at TIMESTAMP,
    reject_reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT ck_exp_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_exp_factory_user
    ON expense_requests (factory_id, user_id, expense_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exp_factory_status
    ON expense_requests (factory_id, status, submitted_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exp_factory_category_month
    ON expense_requests (factory_id, category, expense_date)
    WHERE deleted_at IS NULL AND status IN ('APPROVED', 'PAID');

-- ============================================================
-- 4. leave_balances — 假期余额 (月度累计)
-- ============================================================
-- 每个 (factory, user, leave_type, year_month) 一行.
-- earned_hours: 累计获得 (调休加班 / 年假入职累计 / 月度发放)
-- used_hours:   累计已用 (审批通过的请假)
-- balance_hours: earned - used (derived in service layer or generated column)

CREATE TABLE IF NOT EXISTS leave_balances (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
        -- ANNUAL / SICK / COMPTIME / OTHER — 仅跟踪需要余额的类型
    year_month VARCHAR(7) NOT NULL,
        -- 'YYYY-MM' 格式
    earned_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    used_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    balance_hours NUMERIC(8,2) GENERATED ALWAYS AS (earned_hours - used_hours) STORED,
    last_calculated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_balance_user_type_month UNIQUE (factory_id, user_id, leave_type, year_month),
    CONSTRAINT ck_balance_earned_nonneg CHECK (earned_hours >= 0),
    CONSTRAINT ck_balance_used_nonneg CHECK (used_hours >= 0)
);

CREATE INDEX IF NOT EXISTS idx_balance_factory_user_month
    ON leave_balances (factory_id, user_id, year_month)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_balance_factory_type_month
    ON leave_balances (factory_id, leave_type, year_month)
    WHERE deleted_at IS NULL;
