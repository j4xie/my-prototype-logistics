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

-- V3 P0-3c — 发票附件回传 (客户原话 2675-2693s)
ALTER TABLE invoice_records
    ADD COLUMN IF NOT EXISTS invoice_file_name VARCHAR(255);

COMMENT ON COLUMN invoice_records.invoice_file_name IS
'发票PDF原文件名 — 销售从订单页下载时用于保留客户上传的命名。 V3 P0-3c';
