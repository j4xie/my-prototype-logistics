-- QHJ 收入管理报表 — Upload 去重 content_hash
--
-- Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.4 + §6.8
--
-- 防止同一文件重传时建多份 fact rows. 重传同 content_hash 返 409 + existing upload_id.
-- 在 /upload endpoint 的 byte-streaming 阶段计算 sha256, 查 UNIQUE index 命中即跳过.

ALTER TABLE smart_bi_pg_excel_uploads
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Partial unique index: 仅对非 NULL content_hash 生效, 兼容历史无 hash 的行.
CREATE UNIQUE INDEX IF NOT EXISTS uq_upload_factory_hash
  ON smart_bi_pg_excel_uploads (factory_id, content_hash)
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN smart_bi_pg_excel_uploads.content_hash IS
  'sha256(file_bytes); UNIQUE per factory (partial index). '
  '重传同文件返 409 with existing upload_id. '
  'Added 2026-05-13 for QHJ revenue report (pos_router pre-write dedup).';
