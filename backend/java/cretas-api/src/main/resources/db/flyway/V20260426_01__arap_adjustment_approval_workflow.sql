-- R23 audit C2:手工调整 (recordAdjustment) bypass dual-control gate.
--
-- 背景: pre-R23 任何 finance:read_write 用户 POST /finance/adjustment 立即修改
-- customer.currentBalance / supplier.currentBalance, 无审批流, 仅 remark 字段做"凭证".
-- 攻击场景: 销售员负数 adjustment 静默清零客户余款.
--
-- 修复: ar_ap_transactions 加 approval_status / approved_by / approved_at 三列.
-- 新调整插入 PENDING 状态, 不动余额. /adjustment/{id}/approve (新权限
-- finance:approve_adjustment) 才把金额 apply 到 customer/supplier balance + 状态 → APPROVED.
-- /adjustment/{id}/reject 状态 → REJECTED, 余额不动 (历史记录保留).
--
-- 现有行: 全部默认 APPROVED (向后兼容 — 这些是 R23 之前的直接 mutate 结果, 已经反映在
-- 当前 customer.currentBalance / supplier.currentBalance 中, 不需要 retro 应用).

-- 1. approval_status 列 (PENDING / APPROVED / REJECTED), 现有行 → APPROVED
ALTER TABLE ar_ap_transactions
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED';

-- 2. 审批人 user_id
ALTER TABLE ar_ap_transactions
    ADD COLUMN IF NOT EXISTS approved_by BIGINT;

-- 3. 审批时间
ALTER TABLE ar_ap_transactions
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- 4. 索引: PENDING 调整查询性能 (审批人 dashboard "待审批列表")
CREATE INDEX IF NOT EXISTS idx_aat_approval_status_factory
    ON ar_ap_transactions (factory_id, approval_status)
    WHERE approval_status = 'PENDING';

-- 5. CHECK: 仅 *_ADJUSTMENT 类型才允许 PENDING 状态 (其他类型如 AR_INVOICE/AR_PAYMENT
--    等一直是即时入账, approval flow 不适用)
ALTER TABLE ar_ap_transactions
    ADD CONSTRAINT ck_aat_pending_only_adjustment
    CHECK (
        approval_status IN ('APPROVED', 'PENDING', 'REJECTED')
        AND (approval_status != 'PENDING' OR transaction_type IN ('AR_ADJUSTMENT', 'AP_ADJUSTMENT'))
    );

-- Sanity check: 现有 0 行 PENDING (没人提前用过这个状态)
DO $$
DECLARE
    pending_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pending_count FROM ar_ap_transactions WHERE approval_status = 'PENDING';
    IF pending_count > 0 THEN
        RAISE WARNING 'Migration V20260426_01: % rows already have approval_status=PENDING — unexpected. Manual review needed.', pending_count;
    END IF;
END
$$;
