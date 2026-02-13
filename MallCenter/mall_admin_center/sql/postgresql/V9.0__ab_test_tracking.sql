-- V9.0: A/B测试追踪字段 - PostgreSQL 版本
-- 用于对比 LinUCB 和 Thompson Sampling 探索算法效果
-- 创建时间: 2025-12-27
-- Converted from MySQL

-- 添加A/B测试追踪字段到 recommendation_logs 表
ALTER TABLE recommendation_logs
ADD COLUMN IF NOT EXISTS ab_test_group VARCHAR(32),
ADD COLUMN IF NOT EXISTS explorer_algorithm VARCHAR(32);

COMMENT ON COLUMN recommendation_logs.ab_test_group IS 'A/B分组: linucb/thompson';
COMMENT ON COLUMN recommendation_logs.explorer_algorithm IS '使用的探索算法名称';

-- 添加索引以便于分析查询
CREATE INDEX IF NOT EXISTS idx_ab_group_time ON recommendation_logs (ab_test_group, create_time);

-- 查询示例 (运行2周后执行以分析A/B测试效果):
-- SELECT
--     ab_test_group,
--     COUNT(*) as impressions,
--     SUM(CASE WHEN is_clicked THEN 1 ELSE 0 END) as clicks,
--     SUM(CASE WHEN is_purchased THEN 1 ELSE 0 END) as purchases,
--     ROUND(SUM(CASE WHEN is_clicked THEN 1 ELSE 0 END)::DECIMAL / COUNT(*), 4) as ctr,
--     ROUND(SUM(CASE WHEN is_purchased THEN 1 ELSE 0 END)::DECIMAL / COUNT(*), 4) as cvr,
--     COUNT(DISTINCT wx_user_id) as unique_users
-- FROM recommendation_logs
-- WHERE ab_test_group IS NOT NULL
--   AND create_time >= NOW() - INTERVAL '14 days'
-- GROUP BY ab_test_group;
