-- 创建考勤打卡记录表
-- 数据库：cretas_db
-- 表名：time_clock_record

CREATE TABLE IF NOT EXISTS `time_clock_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `factory_id` VARCHAR(50) NOT NULL COMMENT '工厂ID',
  `clock_in_time` DATETIME NULL COMMENT '上班打卡时间',
  `clock_out_time` DATETIME NULL COMMENT '下班打卡时间',
  `break_start_time` DATETIME NULL COMMENT '开始休息时间',
  `break_end_time` DATETIME NULL COMMENT '结束休息时间',
  `location` VARCHAR(255) NULL COMMENT '打卡位置描述',
  `device` VARCHAR(255) NULL COMMENT '打卡设备信息',
  `latitude` DOUBLE NULL COMMENT 'GPS纬度',
  `longitude` DOUBLE NULL COMMENT 'GPS经度',
  `work_duration` INT NULL COMMENT '工作时长（分钟）',
  `break_duration` INT NULL COMMENT '休息时长（分钟）',
  `status` VARCHAR(20) NULL DEFAULT 'working' COMMENT '状态：working(工作中), on_break(休息中), off_work(已下班)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remarks` VARCHAR(500) NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  INDEX `idx_user_factory_time` (`user_id`, `factory_id`, `clock_in_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='考勤打卡记录表';

-- 示例数据插入（用于测试）
-- INSERT INTO `time_clock_record` (`user_id`, `factory_id`, `clock_in_time`, `location`, `device`, `latitude`, `longitude`, `status`)
-- VALUES
-- (1, 'F001', NOW(), '上海市浦东新区', 'iPhone 13', 31.2304, 121.4737, 'working');
