-- T-RTA business logic (issue #571, audit BLOCKER B1):
--
-- F006 客户 (第四次:956-1037) 明确区分两种退货:
--   有食物 (withGoods=true)  → 库存入库到总仓 (不良品状态) → 后续 AR 冲减
--   无食物 (withGoods=false) → 直接退款, 财务审批 (无库存动作)
--
-- 之前 ReturnOrderServiceImpl.approveReturnOrder 对两种情况做相同的 AR/AP 冲减,
-- 与客户预期不符. Phase A: 加 withGoods 字段; Phase B: approve 分支处理.
--
-- Default TRUE 因为客户主流场景是 实物退货 (customer 原话 "可能会涉及到一个退货,
-- 大家就是看下大家就是看下产品"). 无食物 退款 才是 minority case.
--
-- Nullable=false 因为新建退货单必填.
ALTER TABLE return_orders
    ADD COLUMN IF NOT EXISTS with_goods BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN return_orders.with_goods IS
    'T-RTA business logic (PR closing #571): TRUE=有食物 (库存入库到总仓 + 不良品状态), FALSE=无食物 (直接退款无库存动作). Phase B: approve flow branches by this field. Phase C (inventory inbound + 不良品 status flag) deferred to follow-up ticket.';
