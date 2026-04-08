-- P0-NEW-1 出库签收拍照凭证 (客户原话 2807-2840s)
-- "手机端可以拍一下我们的出户单，对方签收的一个凭证，方便后面追溯"
ALTER TABLE sales_delivery_records
  ADD COLUMN IF NOT EXISTS signature_photo_urls TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS signature_remark VARCHAR(500);
