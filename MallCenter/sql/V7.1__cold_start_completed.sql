-- ==========================================================
-- V7.1 冷启动完成标记字段
-- 用于标记用户是否已完成冷启动偏好设置
-- 只有首次使用的用户会看到冷启动弹窗，完成后不再显示
-- 创建日期: 2025-12-27
-- ==========================================================

-- 添加冷启动完成标记字段到用户画像表
ALTER TABLE user_recommendation_profiles
ADD COLUMN cold_start_completed TINYINT(1) DEFAULT 0 COMMENT '冷启动是否已完成 (1=已完成偏好设置)',
ADD COLUMN cold_start_completed_time DATETIME COMMENT '冷启动完成时间';

-- 添加索引，便于快速查询未完成冷启动的用户
ALTER TABLE user_recommendation_profiles
ADD INDEX idx_cold_start_completed (cold_start_completed);

-- 将现有非cold_start状态的用户标记为已完成冷启动
-- 这样老用户不会看到弹窗
UPDATE user_recommendation_profiles
SET cold_start_completed = 1,
    cold_start_completed_time = create_time
WHERE profile_status IN ('warming', 'mature')
  AND cold_start_completed = 0;
