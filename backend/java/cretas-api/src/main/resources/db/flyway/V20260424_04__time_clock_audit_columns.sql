-- qa-prompt v2.4 Rule 17.3 fix: TimeClockRecord manual-edit audit trail silent-drop.
--
-- TimeClockServiceImpl.updateRecord (line 450-452) calls setIsManualEdit(true) /
-- setEditedBy(id) / setEditReason(reason) on an entity whose corresponding fields
-- were declared @Transient with the comment "扩展字段，表中暂无" — so the HR
-- admin's audit trail (who changed the clock record, and why) was silently lost
-- despite the save(existingRecord) call returning success.
--
-- Add the 3 missing columns so the existing Java code persists end-to-end.
-- Matches the field types declared in TimeClockRecord.java line 145-157.

ALTER TABLE time_clock_records
  ADD COLUMN IF NOT EXISTS is_manual_edit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edited_by      INTEGER,
  ADD COLUMN IF NOT EXISTS edit_reason    VARCHAR(500);

COMMENT ON COLUMN time_clock_records.is_manual_edit IS '是否为 HR 手动编辑 (true = 由 UpdateRecord 调整, false = 自动打卡)';
COMMENT ON COLUMN time_clock_records.edited_by      IS '手动编辑操作人 user_id (仅 is_manual_edit=true 时有值)';
COMMENT ON COLUMN time_clock_records.edit_reason    IS '手动编辑原因 (HR 填写, 审计用)';
