-- V3 P0-3 / G1 — 税率分组开票
-- 客户原话 (会议 2645-2660s): 一笔订单可同时含 9% 原料 + 13% 加工费两个税项,
-- 开票必须按税率分组拆分显示。
--
-- 添加 invoice_records.tax_breakdown JSONB 字段, 存储分组明细:
-- [
--   {"taxRate": 9.00,  "taxableAmount": 5000.00, "taxAmount": 450.00, "lineCount": 3},
--   {"taxRate": 13.00, "taxableAmount": 2000.00, "taxAmount": 260.00, "lineCount": 2}
-- ]

ALTER TABLE invoice_records
    ADD COLUMN IF NOT EXISTS tax_breakdown JSONB;

COMMENT ON COLUMN invoice_records.tax_breakdown IS
'税率分组明细 JSON: 一笔订单按 tax_rate 聚合, 财务按组开票。 V3 P0-3 / G1';
