-- =====================================================
-- 修复 equipment_alerts 表结构
-- 添加 BaseEntity 所需的 deleted_at 列
-- 添加 乐观锁 version 列
-- 添加 忽略相关字段
-- =====================================================

-- 添加 deleted_at 列（软删除支持）
ALTER TABLE equipment_alerts ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL COMMENT '软删除时间';

-- 添加 version 列（乐观锁支持）
ALTER TABLE equipment_alerts ADD COLUMN IF NOT EXISTS version INT DEFAULT 0 COMMENT '乐观锁版本号';

-- 确保 created_at 和 updated_at 存在
ALTER TABLE equipment_alerts MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '创建时间';
ALTER TABLE equipment_alerts MODIFY COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新时间';

-- 添加忽略相关字段（如果不存在）
ALTER TABLE equipment_alerts ADD COLUMN IF NOT EXISTS ignored_at DATETIME NULL COMMENT '忽略时间';
ALTER TABLE equipment_alerts ADD COLUMN IF NOT EXISTS ignored_by BIGINT NULL COMMENT '忽略人ID';
ALTER TABLE equipment_alerts ADD COLUMN IF NOT EXISTS ignored_by_name VARCHAR(100) NULL COMMENT '忽略人姓名';
ALTER TABLE equipment_alerts ADD COLUMN IF NOT EXISTS ignore_reason TEXT NULL COMMENT '忽略原因';
