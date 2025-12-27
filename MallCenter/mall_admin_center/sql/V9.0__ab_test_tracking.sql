-- V9.0: A/B测试追踪字段
-- 用于对比 LinUCB 和 Thompson Sampling 探索算法效果
-- 创建时间: 2025-12-27

-- 添加A/B测试追踪字段到 recommendation_logs 表
ALTER TABLE recommendation_logs
ADD COLUMN ab_test_group VARCHAR(32) COMMENT 'A/B分组: linucb/thompson' AFTER algorithm_version,
ADD COLUMN explorer_algorithm VARCHAR(32) COMMENT '使用的探索算法名称' AFTER ab_test_group;

-- 添加索引以便于分析查询
CREATE INDEX idx_ab_group_time ON recommendation_logs (ab_test_group, create_time);

-- 查询示例 (运行2周后执行以分析A/B测试效果):
-- SELECT
--     ab_test_group,
--     COUNT(*) as impressions,
--     SUM(CASE WHEN is_clicked THEN 1 ELSE 0 END) as clicks,
--     SUM(CASE WHEN is_purchased THEN 1 ELSE 0 END) as purchases,
--     ROUND(SUM(CASE WHEN is_clicked THEN 1 ELSE 0 END) / COUNT(*), 4) as ctr,
--     ROUND(SUM(CASE WHEN is_purchased THEN 1 ELSE 0 END) / COUNT(*), 4) as cvr,
--     COUNT(DISTINCT wx_user_id) as unique_users
-- FROM recommendation_logs
-- WHERE ab_test_group IS NOT NULL
--   AND create_time >= DATE_SUB(NOW(), INTERVAL 14 DAY)
-- GROUP BY ab_test_group;
