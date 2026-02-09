-- ============================================================
-- V2025_12_29_8: 生产计划审批流程字段
-- 功能：支持强制插单审批闭环
-- 作者：Cretas Team
-- 日期：2025-12-29
-- ============================================================

-- 添加强制插单相关字段
ALTER TABLE production_plans
    ADD COLUMN is_force_inserted BOOLEAN DEFAULT FALSE COMMENT '是否为强制插单',
    ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE COMMENT '是否需要审批',
    ADD COLUMN approval_status VARCHAR(20) COMMENT '审批状态: PENDING/APPROVED/REJECTED',
    ADD COLUMN approver_id BIGINT COMMENT '审批人ID',
    ADD COLUMN approver_name VARCHAR(50) COMMENT '审批人姓名',
    ADD COLUMN approved_at DATETIME COMMENT '审批时间',
    ADD COLUMN approval_comment VARCHAR(500) COMMENT '审批备注/理由',
    ADD COLUMN force_insert_reason VARCHAR(500) COMMENT '强制插单原因',
    ADD COLUMN force_insert_by BIGINT COMMENT '强制插单操作人ID',
    ADD COLUMN force_inserted_at DATETIME COMMENT '强制插单时间';

-- 创建审批状态索引
CREATE INDEX idx_plan_approval_status ON production_plans(approval_status);

-- 创建强制插单索引
CREATE INDEX idx_plan_force_inserted ON production_plans(is_force_inserted);

-- 添加外键约束（可选，根据业务需要）
-- ALTER TABLE production_plans
--     ADD CONSTRAINT fk_plan_approver FOREIGN KEY (approver_id) REFERENCES users(id),
--     ADD CONSTRAINT fk_plan_force_insert_by FOREIGN KEY (force_insert_by) REFERENCES users(id);

-- ============================================================
-- 创建待审批视图
-- ============================================================
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT
    pp.id,
    pp.plan_number,
    pp.factory_id,
    pp.product_type_id,
    pt.name AS product_type_name,
    pp.planned_quantity,
    pp.priority,
    pp.is_force_inserted,
    pp.force_insert_reason,
    pp.force_insert_by,
    u1.real_name AS force_insert_by_name,
    pp.force_inserted_at,
    pp.approval_status,
    pp.created_at
FROM production_plans pp
LEFT JOIN product_types pt ON pp.product_type_id = pt.id
LEFT JOIN users u1 ON pp.force_insert_by = u1.id
WHERE pp.requires_approval = TRUE
  AND pp.approval_status = 'PENDING'
ORDER BY pp.priority DESC, pp.created_at ASC;
