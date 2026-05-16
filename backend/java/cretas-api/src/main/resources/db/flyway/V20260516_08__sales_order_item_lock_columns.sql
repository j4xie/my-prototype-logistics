-- Sprint3-G S-LOCK-1: 销售单行内 锁/备/缺 3 chip
--
-- Brief 原计划 V20260516_02, audit 发现 V20260516_01 attachment / 02 abaca / 03 bom_redesign /
-- 04 bom_intent_configs / 05 print_document_intent / 06 work_process_tasks / 07 work_process_intents
-- 已被 Sprint1/2 占用 (origin/main 实测), 跳到 _08.
--
-- shortageQty 不存 DB — @Transient getter 计算 (quantity - reservedQty, clamp ≥0).
-- 写回 listener: SalesOrderShortageReportListener.onSalesOrderFinanceApproved
-- (lockedQty MVP=0, 等 production_plan reservation 模型接入).

ALTER TABLE sales_order_items
    ADD COLUMN locked_qty   NUMERIC(15, 4) DEFAULT 0 NOT NULL,
    ADD COLUMN reserved_qty NUMERIC(15, 4) DEFAULT 0 NOT NULL;
