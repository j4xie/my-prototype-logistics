-- 添加 user_whitelist 表的 invited_by 和 metadata 列
ALTER TABLE user_whitelist 
ADD COLUMN invited_by INT NULL AFTER added_by_user_id,
ADD COLUMN metadata JSON NULL AFTER expires_at;