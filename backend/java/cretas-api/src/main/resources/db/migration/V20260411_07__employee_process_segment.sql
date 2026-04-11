-- P1-1 员工工序片段 (v1 §2.x, 客户 4720s 欠退扫码)
--
-- 解决原 EmployeeWorkSession.workTypeId 单值瓶颈 — 一个员工一天可有多个
-- segment, 每个对应一个工种/工序, 独立 start/end 时间 + checkoutReason.
--
-- Service 层 wire up + RN 扫码集成 留下次.

CREATE TABLE IF NOT EXISTS employee_process_segments (
    id                  VARCHAR(64)  PRIMARY KEY,
    factory_id          VARCHAR(64)  NOT NULL,
    employee_id         BIGINT       NOT NULL,
    work_session_id     VARCHAR(64),
    work_type_id        INTEGER,
    process_id          VARCHAR(64),
    batch_id            VARCHAR(64),
    start_at            TIMESTAMP    NOT NULL,
    end_at              TIMESTAMP,
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','CLOSED_NORMAL','CLOSED_EARLY','CLOSED_SWITCH')),
    checkout_reason     VARCHAR(20)
                        CHECK (checkout_reason IS NULL OR checkout_reason IN
                               ('END_OF_SHIFT','EARLY_LEAVE','WORK_TYPE_SWITCH','BATCH_DONE','INCIDENT')),
    notes               TEXT,
    created_at          TIMESTAMP    DEFAULT NOW(),
    updated_at          TIMESTAMP    DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eps_factory_employee ON employee_process_segments(factory_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_eps_session ON employee_process_segments(work_session_id);
CREATE INDEX IF NOT EXISTS idx_eps_active ON employee_process_segments(factory_id, status);

COMMENT ON TABLE employee_process_segments IS
    '员工工序片段 (P1-1). 一天可多条, 每条对应一个工种/工序, 支持欠退/换岗/切工种.';
COMMENT ON COLUMN employee_process_segments.status IS
    'ACTIVE=进行中 / CLOSED_NORMAL=正常下班 / CLOSED_EARLY=欠退 / CLOSED_SWITCH=换岗';
COMMENT ON COLUMN employee_process_segments.checkout_reason IS
    'END_OF_SHIFT=下班 / EARLY_LEAVE=早退 / WORK_TYPE_SWITCH=换工种 / BATCH_DONE=批次完成 / INCIDENT=事故';
