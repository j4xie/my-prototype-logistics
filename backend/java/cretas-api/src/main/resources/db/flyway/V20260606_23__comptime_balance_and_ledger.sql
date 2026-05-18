-- ============================================================================
-- 调休账单 (CompTime Balance & Ledger) — #835 H-ATT MVP follow-up
--
-- 引入两个新表:
--   1. comp_time_balances — 月度调休聚合余额 (按 user_id + year_month)
--   2. comp_time_ledger_entries — 每笔调休变更明细 (审计跟踪)
--
-- 设计原因:
--   - 现有 LeaveBalance(leaveType=COMPTIME) 只有月度聚合, 无审计痕迹
--   - 业务需求: 仓管员等基层员工需要查每笔调休 credit/debit 的来源单据
--   - 防呆 R2 (上下文+身份): 每条 ledger 含 sourceType + sourceRefId, 可下钻到原单
--   - 防呆 R4 (幂等): (source_type, source_ref_id) UNIQUE, 防 listener 重放重复入账
--
-- 关联事件:
--   - OvertimeApprovedEvent (compensationType=COMPTIME) → ledger EARN
--   - LeaveApprovedEvent (leaveType=COMPTIME)         → ledger USE
--
-- @author Cretas Team — #835 follow-up CompTime Balance
-- @since 2026-05-18
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) 月度调休聚合余额表
-- ----------------------------------------------------------------------------
CREATE TABLE comp_time_balances (
    id              VARCHAR(36)     PRIMARY KEY,
    factory_id      VARCHAR(50)     NOT NULL,
    user_id         BIGINT          NOT NULL,

    -- 'YYYY-MM' 格式
    year_month      VARCHAR(7)      NOT NULL,

    -- 当月新获得的调休小时数 (来自 OT 审批通过, COMPTIME)
    earned_this_month   NUMERIC(8, 2) NOT NULL DEFAULT 0,

    -- 当月已使用的调休小时数 (来自 LeaveRequest 审批通过, COMPTIME)
    used_this_month     NUMERIC(8, 2) NOT NULL DEFAULT 0,

    -- 截至当月可用余额 (跨月累计 — 由 service 层维护, NOT generated)
    -- 计算公式: 上月 available_hours + earned_this_month - used_this_month
    available_hours     NUMERIC(8, 2) NOT NULL DEFAULT 0,

    last_calculated_at  TIMESTAMP,

    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP       NULL,

    -- 一个员工每月只能有一行
    CONSTRAINT uq_comptime_balance_user_month
        UNIQUE (factory_id, user_id, year_month)
);

CREATE INDEX idx_comptime_balance_factory_user
    ON comp_time_balances (factory_id, user_id);

CREATE INDEX idx_comptime_balance_factory_month
    ON comp_time_balances (factory_id, year_month);

COMMENT ON TABLE comp_time_balances IS '调休账单月度聚合 — #835 follow-up';
COMMENT ON COLUMN comp_time_balances.available_hours IS '截至当月可用余额 (跨月累计, service 层维护)';

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_comp_time_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comp_time_balances_updated_at
    BEFORE UPDATE ON comp_time_balances
    FOR EACH ROW EXECUTE FUNCTION update_comp_time_balances_updated_at();

-- ----------------------------------------------------------------------------
-- 2) 调休账户明细 (audit trail)
-- ----------------------------------------------------------------------------
CREATE TABLE comp_time_ledger_entries (
    id              VARCHAR(36)     PRIMARY KEY,
    factory_id      VARCHAR(50)     NOT NULL,
    user_id         BIGINT          NOT NULL,

    -- 交易类型: EARN / USE
    transaction_type VARCHAR(10)    NOT NULL,
    CONSTRAINT ck_comptime_ledger_txn_type
        CHECK (transaction_type IN ('EARN', 'USE')),

    -- 小时数 (始终正数; transaction_type 决定加减)
    hours           NUMERIC(6, 2)   NOT NULL,
    CONSTRAINT ck_comptime_ledger_hours_positive
        CHECK (hours > 0),

    -- 来源类型: OT_APPROVED / LEAVE_APPROVED / MANUAL_ADJUST
    source_type     VARCHAR(20)     NOT NULL,
    CONSTRAINT ck_comptime_ledger_source_type
        CHECK (source_type IN ('OT_APPROVED', 'LEAVE_APPROVED', 'MANUAL_ADJUST')),

    -- 关联原单据 ID (overtime_requests.id 或 leave_requests.id 或 NULL for MANUAL)
    source_ref_id   VARCHAR(36),

    -- 当月所属 (用于查询聚合)
    year_month      VARCHAR(7)      NOT NULL,

    -- 入账后余额 (snapshot — 让 ledger 可读, 不用每次重算)
    balance_after_hours NUMERIC(8, 2) NOT NULL,

    -- 备注 (e.g. "周六加班 4h 转调休" / "调休请假 8h")
    note            VARCHAR(500),

    -- 操作员 (自动入账 = approver_id; 手工调整 = 调整人 ID)
    operator_id     BIGINT,

    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP       NULL,

    -- 防呆 R4 idempotent: 同一来源单据只能入账一次
    -- 例: OT request abc-123 approve 两次 (重放 event) 第二次会被 UNIQUE 阻止
    CONSTRAINT uq_comptime_ledger_source
        UNIQUE (source_type, source_ref_id)
);

CREATE INDEX idx_comptime_ledger_factory_user_created
    ON comp_time_ledger_entries (factory_id, user_id, created_at DESC);

CREATE INDEX idx_comptime_ledger_factory_month
    ON comp_time_ledger_entries (factory_id, year_month);

CREATE INDEX idx_comptime_ledger_source_ref
    ON comp_time_ledger_entries (source_type, source_ref_id);

COMMENT ON TABLE comp_time_ledger_entries IS '调休账户明细 — #835 follow-up, 审计跟踪';
COMMENT ON COLUMN comp_time_ledger_entries.source_ref_id IS '原单据 ID (overtime_requests / leave_requests)';
COMMENT ON CONSTRAINT uq_comptime_ledger_source ON comp_time_ledger_entries
    IS '防呆 R4 — listener 重放幂等';

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_comp_time_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comp_time_ledger_updated_at
    BEFORE UPDATE ON comp_time_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION update_comp_time_ledger_updated_at();
