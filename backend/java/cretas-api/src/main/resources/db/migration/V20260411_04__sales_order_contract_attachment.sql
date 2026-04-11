-- P1-7 预订合同附件 (v1 §2.4.3, 客户会议 2257s 提及)
--
-- SalesOrder 加 contract_file_url + contract_file_name 字段,
-- 支持销售订单创建时上传合同 PDF/图片作为附件.

ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS contract_file_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS contract_file_name VARCHAR(255);

COMMENT ON COLUMN sales_orders.contract_file_url IS '预订合同附件 URL (OSS path)';
COMMENT ON COLUMN sales_orders.contract_file_name IS '预订合同附件原文件名';
