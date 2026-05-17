-- Sprint 4 W2 S-REMIND-1: reminders table (PAYMENT_DUE 收款提醒 + 未来扩展).
-- Scanner @Scheduled 每日扫描 SalesOrder, 对未结清订单生成 reminder 分配给销售员.

CREATE TABLE IF NOT EXISTS reminders (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(191) NOT NULL,
    type VARCHAR(32) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id VARCHAR(191) NOT NULL,
    due_date DATE NOT NULL,
    assignee_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    snoozed_until DATE,
    message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_factory_assignee_status_due
    ON reminders (factory_id, assignee_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_reminders_source
    ON reminders (factory_id, type, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_reminders_factory_due
    ON reminders (factory_id, due_date)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE reminders IS 'Sprint 4 W2 S-REMIND-1 提醒单 — scanner-pattern 驱动';
COMMENT ON COLUMN reminders.type IS 'ReminderType enum (PAYMENT_DUE)';
COMMENT ON COLUMN reminders.source_type IS 'business object type (SALES_ORDER)';
COMMENT ON COLUMN reminders.source_id IS 'business object id (e.g. SalesOrder.id)';
COMMENT ON COLUMN reminders.due_date IS '提醒到期日期 — scanner 用此判断是否触发';
COMMENT ON COLUMN reminders.snoozed_until IS 'SNOOZED 状态下恢复日期, scanner 到期转回 PENDING';
