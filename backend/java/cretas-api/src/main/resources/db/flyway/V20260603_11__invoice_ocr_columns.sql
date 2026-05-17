-- F-INV-1 gap-fill: OCR auto-parse on invoice PDF upload
-- DashScopeVisionClient + PDFBox render page 1 → vision OCR → 5 columns below.
-- All nullable: parse fail leaves cols null + ocr_error_message set; PDF upload still proceeds.
-- ocr_raw_json keeps the full LLM response for debugging / future re-parse.

ALTER TABLE invoice_records
    ADD COLUMN IF NOT EXISTS ocr_invoice_number  VARCHAR(50)    DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ocr_amount          NUMERIC(15, 2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ocr_tax_amount      NUMERIC(15, 2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ocr_confidence      NUMERIC(4, 3)  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ocr_raw_json        TEXT           DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ocr_error_message   TEXT           DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ocr_parsed_at       TIMESTAMP      DEFAULT NULL;

COMMENT ON COLUMN invoice_records.ocr_invoice_number IS 'OCR 识别的发票号 (供财务核对 record.invoice_number)';
COMMENT ON COLUMN invoice_records.ocr_amount         IS 'OCR 识别的不含税金额 (供财务核对 record.amount)';
COMMENT ON COLUMN invoice_records.ocr_tax_amount     IS 'OCR 识别的税额';
COMMENT ON COLUMN invoice_records.ocr_confidence    IS 'OCR 置信度 0.000-1.000';
COMMENT ON COLUMN invoice_records.ocr_raw_json      IS '原始 LLM 响应 (debug)';
COMMENT ON COLUMN invoice_records.ocr_error_message IS '解析失败原因 (e.g. PDF 损坏 / vision 服务不可用)';
COMMENT ON COLUMN invoice_records.ocr_parsed_at     IS 'OCR 解析时间';
