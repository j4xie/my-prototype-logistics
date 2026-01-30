-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_27_2__add_batch_work_session_assignment_fields.sql
-- Conversion date: 2026-01-26 18:45:45
-- ============================================

-- 添加批次员工分配功能所需字段
-- 支持主管分配员工到批次的工作流程

-- 添加新字段到 batch_work_sessions 表
ALTER TABLE batch_work_sessions
ADD COLUMN check_in_time TIMESTAMP WITH TIME ZONE NULL COMMENT '开始参与时间',
ADD COLUMN check_out_time TIMESTAMP WITH TIME ZONE NULL COMMENT '结束参与时间',
ADD COLUMN assigned_by BIGINT NULL COMMENT '分配人ID（主管）',
ADD COLUMN status VARCHAR(20) DEFAULT 'assigned' COMMENT '状态: assigned, working, completed, cancelled',
ADD COLUMN notes VARCHAR(500) NULL COMMENT '备注';

-- 添加外键约束（如果 users 表存在）
ALTER TABLE batch_work_sessions
ADD CONSTRAINT fk_batch_work_session_assigner
    FOREIGN KEY (assigned_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- 添加索引以提高查询性能
CREATE INDEX idx_bws_status ON batch_work_sessions(status);
CREATE INDEX idx_bws_assigned_by ON batch_work_sessions(assigned_by);
CREATE INDEX idx_bws_check_in_time ON batch_work_sessions(check_in_time);
CREATE INDEX idx_bws_employee_time ON batch_work_sessions(employee_id, created_at);

-- 更新现有记录的状态为已完成（如果有的话）
UPDATE batch_work_sessions
SET status = 'completed',
    check_in_time = created_at,
    check_out_time = updated_at
WHERE status IS NULL AND work_minutes IS NOT NULL;

UPDATE batch_work_sessions
SET status = 'assigned',
    check_in_time = created_at
WHERE status IS NULL AND work_minutes IS NULL;
