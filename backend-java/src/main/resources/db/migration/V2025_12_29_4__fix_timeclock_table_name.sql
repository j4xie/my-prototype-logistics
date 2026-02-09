-- =====================================================
-- V2025_12_29_4__fix_timeclock_table_name.sql
-- 修复 timeclock 表名不匹配问题
--
-- 问题: Entity 定义 @Table(name = "time_clock_records") (复数)
--       但原始SQL使用 time_clock_record (单数)
--       导致 Hibernate 查询 500 错误
--
-- 解决方案: 重命名表以匹配 Entity 定义
-- =====================================================

-- 1. 重命名表以匹配 Entity 定义
-- 检查表是否存在再重命名 (MySQL 8.0+)
SET @table_exists = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    AND table_name = 'time_clock_record'
);

SET @target_exists = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    AND table_name = 'time_clock_records'
);

-- 只有当旧表存在且新表不存在时才重命名
SET @sql = IF(
    @table_exists > 0 AND @target_exists = 0,
    'RENAME TABLE time_clock_record TO time_clock_records',
    'SELECT "Table already renamed or does not exist"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 确保 BaseEntity 必需字段存在
-- 添加 created_at 字段 (如果不存在)
SET @col_created = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'time_clock_records'
    AND column_name = 'created_at'
);

SET @sql_created = IF(
    @col_created = 0,
    'ALTER TABLE time_clock_records ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'SELECT "created_at already exists"'
);

PREPARE stmt FROM @sql_created;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 updated_at 字段 (如果不存在)
SET @col_updated = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'time_clock_records'
    AND column_name = 'updated_at'
);

SET @sql_updated = IF(
    @col_updated = 0,
    'ALTER TABLE time_clock_records ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'SELECT "updated_at already exists"'
);

PREPARE stmt FROM @sql_updated;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 deleted_at 字段 (如果不存在) - 软删除支持
SET @col_deleted = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'time_clock_records'
    AND column_name = 'deleted_at'
);

SET @sql_deleted = IF(
    @col_deleted = 0,
    'ALTER TABLE time_clock_records ADD COLUMN deleted_at DATETIME NULL',
    'SELECT "deleted_at already exists"'
);

PREPARE stmt FROM @sql_deleted;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 添加 clock_date 字段 (用于按日期查询)
SET @col_clock_date = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'time_clock_records'
    AND column_name = 'clock_date'
);

SET @sql_clock_date = IF(
    @col_clock_date = 0,
    'ALTER TABLE time_clock_records ADD COLUMN clock_date DATE NULL AFTER factory_id',
    'SELECT "clock_date already exists"'
);

PREPARE stmt FROM @sql_clock_date;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 添加索引优化查询性能
-- 用户+日期索引 (用于 getHistory)
CREATE INDEX IF NOT EXISTS idx_timeclock_user_date
ON time_clock_records(user_id, clock_date);

-- 工厂+用户索引 (用于 getTodayRecord)
CREATE INDEX IF NOT EXISTS idx_timeclock_factory_user
ON time_clock_records(factory_id, user_id);

-- 打卡时间索引 (用于范围查询)
CREATE INDEX IF NOT EXISTS idx_timeclock_clock_in_time
ON time_clock_records(clock_in_time);
