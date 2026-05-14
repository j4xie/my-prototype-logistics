-- #566 T4-B6: 30s dedup partial index for production_reports
--
-- Background: ProcessWorkReportingServiceImpl.submitNormalReport 在 SQL 化 dedup 之前
-- 用 in-memory stream filter 扫描 `findByProcessTaskIdAndDeletedAtIsNull` 返回的全部
-- 报工 (F006 prod 单任务累计 ~6700 行 → 单次提交 3-15s, 客户感知 spinner 卡死).
--
-- 现在 query 形态: (process_task_id, worker_id, output_quantity, created_at > since)
-- WHERE deleted_at IS NULL, LIMIT 1.
-- 现有 idx_pr_process_task 单列索引仍要回表过滤 6700 行;
-- 此 partial 复合索引让 Postgres 直接在索引层完成等值+范围+死信过滤 → <5 ms.
--
-- 索引顺序: equality(taskId) → equality(workerId) → equality(qty) → range(createdAt DESC)
-- 匹配 btree 等值-范围模式. created_at DESC 确保 LIMIT 1 命中最近一行不需要排序.
--
-- Partial WHERE deleted_at IS NULL 避免对软删除行建索引 (~99% 行 deleted_at 为 NULL).
CREATE INDEX IF NOT EXISTS idx_pr_dedup
    ON production_reports (process_task_id, worker_id, output_quantity, created_at DESC)
    WHERE deleted_at IS NULL;
