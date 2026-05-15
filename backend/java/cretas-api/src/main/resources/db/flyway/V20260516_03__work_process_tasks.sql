-- Track D2 — M-WP-1/2 工序任务表
--
-- 客户场景 (六扇门第四次会议): 给产品绑定工序模板 (product_work_processes) 后,
-- 启动生产批次时 spawn 工序任务实例到 work_process_tasks, 跟踪 PENDING/IN_PROGRESS/
-- COMPLETED/SKIPPED/CANCELLED 状态机。
--
-- 决策 D (SCHEMA_DESIGN §2.5): Sprint 1 仅支持线性顺序 (process_order 0..N), 不支持
-- DAG 依赖图。Phase 2 如需可扩 predecessor_task_id。
-- 决策 C: task 绑定 production_batch_id (Long) + product_work_process_id (Long 模板 ID)
-- + work_process_id (VARCHAR(50) 工序定义 ID), 三者冗余便于查询。

CREATE TABLE IF NOT EXISTS work_process_tasks (
    id                       BIGSERIAL PRIMARY KEY,
    factory_id               VARCHAR(50) NOT NULL,

    -- 关联
    production_batch_id      BIGINT NOT NULL,
    product_work_process_id  BIGINT NOT NULL,
    work_process_id          VARCHAR(50) NOT NULL,
    product_type_id          VARCHAR(50) NOT NULL,

    -- 顺序 + 状态
    process_order            INTEGER NOT NULL,
    status                   VARCHAR(32) NOT NULL DEFAULT 'PENDING',

    -- 计划 + 实际
    planned_quantity         DECIMAL(15, 4),
    planned_unit             VARCHAR(20),
    planned_start_at         TIMESTAMP,
    planned_end_at           TIMESTAMP,
    estimated_minutes        INTEGER,

    actual_quantity          DECIMAL(15, 4),
    actual_start_at          TIMESTAMP,
    actual_end_at            TIMESTAMP,
    actual_minutes           INTEGER,

    -- 人员
    assigned_to              BIGINT,
    completed_by             BIGINT,
    completed_at             TIMESTAMP,

    -- 业务字段
    notes                    VARCHAR(500),

    -- BaseEntity audit fields
    created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at               TIMESTAMP,

    CONSTRAINT fk_wpt_batch
        FOREIGN KEY (production_batch_id)
        REFERENCES production_batches(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_wpt_status
        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_wpt_factory_batch
    ON work_process_tasks (factory_id, production_batch_id, process_order);
CREATE INDEX IF NOT EXISTS idx_wpt_status
    ON work_process_tasks (factory_id, status);
CREATE INDEX IF NOT EXISTS idx_wpt_assignee
    ON work_process_tasks (factory_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_wpt_process
    ON work_process_tasks (factory_id, work_process_id);

COMMENT ON TABLE work_process_tasks IS
    'Track D2 — 工序任务实例 (六扇门第四次): 生产批次启动时从 product_work_processes 模板 spawn';
