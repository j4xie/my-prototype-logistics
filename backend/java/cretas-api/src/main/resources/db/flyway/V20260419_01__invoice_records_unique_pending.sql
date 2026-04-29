-- Bug #2 硬化 (R4 2026-04-16): 防止同一 SO 多个待处理发票并发创建
-- 业务规则: 一个 SO 在任意时刻最多只能有 1 个 REQUESTED + 多个 APPROVED/ISSUED/REJECTED
-- 原服务层 pre-check 存在 TOCTOU race; DB 层 partial unique index 作为最终兜底.
--
-- 状态语义:
--   REQUESTED = 待审核 (客户端提交, 财务未审)
--   APPROVED = 审核通过 (未开具)
--   ISSUED = 已开具 (税票已出, 可多张)
--   REJECTED = 驳回 (业务拒绝, 可重提)
-- 只锁 REQUESTED — 其他状态可重复以支持分次开票/驳回重提场景.

-- Step 1: 清理现有历史 duplicate REQUESTED invoices — 只保留每 SO 最新的 1 张
-- 其他 REQUESTED 标 REJECTED + 审计备注 (软处理, 不删数据)
WITH dupes AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY factory_id, sales_order_id
               ORDER BY requested_at DESC, id DESC
           ) AS rn
    FROM invoice_records
    WHERE status = 'REQUESTED' AND deleted_at IS NULL
)
UPDATE invoice_records ir
SET status = 'REJECTED',
    remark = COALESCE(remark, '') || ' [V20260419_01 auto-reject: duplicate REQUESTED before unique constraint]'
FROM dupes
WHERE ir.id = dupes.id AND dupes.rn > 1;

-- Step 2: Partial unique index — 只锁 REQUESTED 防并发重复提交
CREATE UNIQUE INDEX IF NOT EXISTS uk_invoice_records_pending_per_so
ON invoice_records (factory_id, sales_order_id)
WHERE status = 'REQUESTED' AND deleted_at IS NULL;

-- Note: partial unique index works in PostgreSQL. On MySQL would need trigger approach,
-- but project is now PG-only (per database-entity-sync rule).
