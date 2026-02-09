-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_19_30__scheduling_metrics_view.sql
-- Conversion date: 2026-01-26 18:48:57
-- ============================================

-- 调度系统每日指标聚合视图
-- 用于加速监控仪表盘查询

CREATE OR REPLACE VIEW v_scheduling_daily_metrics AS
SELECT
    factory_id,
    DATE(assigned_at) as metric_date,
    COUNT(*) as total_allocations,
    AVG(actual_efficiency) as avg_efficiency,
    AVG(CASE
        WHEN predicted_score > 0 THEN ABS(predicted_score - actual_efficiency) / predicted_score
        ELSE NULL
    END) as avg_prediction_error,
    COUNT(DISTINCT worker_id) as active_workers,
    COUNT(DISTINCT task_type) as task_types,
    SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed_tasks,
    AVG(CASE WHEN completed_at IS NOT NULL THEN actual_hours ELSE NULL END) as avg_task_hours
FROM worker_allocation_feedback
WHERE assigned_at IS NOT NULL
GROUP BY factory_id, DATE(assigned_at);

-- 工人任务多样性统计视图
CREATE OR REPLACE VIEW v_worker_task_diversity AS
SELECT
    factory_id,
    worker_id,
    COUNT(*) as total_tasks,
    COUNT(DISTINCT task_type) as unique_task_types,
    COUNT(DISTINCT DATE(assigned_at)) as active_days,
    MAX(assigned_at) as last_task_date,
    AVG(actual_efficiency) as avg_efficiency
FROM worker_allocation_feedback
WHERE assigned_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY factory_id, worker_id;

-- 工序技能遗忘风险视图 (30天未执行的工序)
CREATE OR REPLACE VIEW v_skill_decay_risk AS
SELECT
    f.factory_id,
    f.worker_id,
    f.task_type,
    MAX(f.assigned_at) as last_executed,
    DATEDIFF(CURDATE(), MAX(f.assigned_at)) as days_since_last
FROM worker_allocation_feedback f
GROUP BY f.factory_id, f.worker_id, f.task_type
HAVING DATEDIFF(CURDATE(), MAX(f.assigned_at)) >= 30;
