-- V20260606_19: HR Attendance MVP — Shift + ShiftAssignment + Exception (P1 #41 H-ATT-FULL MVP)
--
-- Creates 3 tables for attendance MVP:
--   * attendance_shifts            — 班次模板 (factory × shiftCode → startTime/endTime/isOvernight)
--   * employee_shift_assignments   — 员工排班分配 (factory × user × workDate → shift)
--   * attendance_exceptions        — 考勤异常 (LATE / EARLY_LEAVE / ABSENT / OT_OVERSCHEDULED / OTHER)
--
-- AttendanceExceptionService.detectExceptions(factoryId, yearMonth) 扫描:
--   1) 加载月度 employee_shift_assignments
--   2) 比对 time_clock_records (existing) 上下班时间 vs shift 起止
--   3) 生成 PENDING attendance_exceptions (幂等: 同 user-date-type unique)
--
-- 防呆 (per fool-proof-design.md):
--   R2: description 字段包含员工全名 + workDate + shift 名 + 实际/预期时间
--   R3: exception_type CHECK 5 个 enum 值 (LATE / EARLY_LEAVE / ABSENT / OT_OVERSCHEDULED / OTHER)
--   R4: 幂等 — unique constraint (factory, user, workDate, exceptionType)
--   R5: 空 PENDING 列表前端显示 "暂无待处理异常" + 重新检测 button
--
-- Deferred (full H-ATT-FULL backlog, 10d):
--   * 高级排班可视化日历 (visual scheduler)
--   * 调休账单 / 工时统计报表
--   * 微信打卡集成
--   * AI 自动识别 (call center 排班冲突等)
--   * Shift/Assignment CRUD UI (本 MVP 只透传 exception 流, shift/assignment 通过 sql/api 灌入)

-- ============================================================
-- 1. attendance_shifts — 班次定义
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_shifts (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    shift_code VARCHAR(30) NOT NULL,
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_shift_factory_code UNIQUE (factory_id, shift_code)
);

CREATE INDEX IF NOT EXISTS idx_shift_factory
    ON attendance_shifts (factory_id)
    WHERE deleted_at IS NULL;

-- ============================================================
-- 2. employee_shift_assignments — 员工排班分配
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_shift_assignments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    shift_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
        -- SCHEDULED / CLOCKED / MISSED / EXCEPTION
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_assign_user_date UNIQUE (factory_id, user_id, work_date),
    CONSTRAINT ck_assign_status CHECK (
        status IN ('SCHEDULED', 'CLOCKED', 'MISSED', 'EXCEPTION')
    )
);

CREATE INDEX IF NOT EXISTS idx_assign_factory_date
    ON employee_shift_assignments (factory_id, work_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assign_factory_user
    ON employee_shift_assignments (factory_id, user_id, work_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assign_factory_status
    ON employee_shift_assignments (factory_id, status)
    WHERE deleted_at IS NULL;

-- ============================================================
-- 3. attendance_exceptions — 考勤异常
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_exceptions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    shift_assignment_id VARCHAR(36),
        -- nullable — ABSENT 时可能未排班; 或手工 OTHER 类
    exception_type VARCHAR(30) NOT NULL,
        -- LATE / EARLY_LEAVE / ABSENT / OT_OVERSCHEDULED / OTHER
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        -- PENDING / APPROVED / REJECTED
    description VARCHAR(500),
        -- R2 防呆: 自动生成 "{员工} 于 {date} {late|absent...} (排班: {shift}, 应 {expected}, 实际 {actual})"
    processed_by BIGINT,
    processed_at TIMESTAMP,
    notes VARCHAR(1000),
    delta_minutes INTEGER,
        -- LATE/EARLY_LEAVE/OT_OVERSCHEDULED 时的差异分钟数
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_exception_user_date_type UNIQUE (factory_id, user_id, work_date, exception_type),
    CONSTRAINT ck_exception_type CHECK (
        exception_type IN ('LATE', 'EARLY_LEAVE', 'ABSENT', 'OT_OVERSCHEDULED', 'OTHER')
    ),
    CONSTRAINT ck_exception_status CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED')
    )
);

CREATE INDEX IF NOT EXISTS idx_exception_factory_date
    ON attendance_exceptions (factory_id, work_date)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exception_factory_status
    ON attendance_exceptions (factory_id, status, work_date)
    WHERE deleted_at IS NULL;
