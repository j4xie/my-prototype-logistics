-- 用户反馈表
-- 功能：存储用户反馈信息（Bug报告、功能建议、其他反馈）

CREATE TABLE IF NOT EXISTS `user_feedbacks` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `factory_id` VARCHAR(50) NOT NULL COMMENT '工厂ID',
    `user_id` INT DEFAULT NULL COMMENT '用户ID',
    `type` VARCHAR(20) NOT NULL COMMENT '反馈类型：bug/feature/other',
    `title` VARCHAR(200) NOT NULL COMMENT '反馈标题',
    `content` TEXT NOT NULL COMMENT '反馈内容',
    `contact` VARCHAR(100) DEFAULT NULL COMMENT '联系方式（手机号或邮箱）',
    `screenshots` TEXT DEFAULT NULL COMMENT '截图URL列表（JSON数组）',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/processing/resolved',
    `handler_id` INT DEFAULT NULL COMMENT '处理人ID',
    `handler_notes` TEXT DEFAULT NULL COMMENT '处理备注',
    `resolved_at` DATETIME DEFAULT NULL COMMENT '解决时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    INDEX `idx_feedback_factory` (`factory_id`),
    INDEX `idx_feedback_user` (`user_id`),
    INDEX `idx_feedback_status` (`status`),
    INDEX `idx_feedback_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户反馈表';

-- 插入测试数据（可选）
INSERT INTO `user_feedbacks` (`factory_id`, `user_id`, `type`, `title`, `content`, `contact`, `status`, `created_at`) VALUES
('CRETAS_2024_001', 1, 'bug', '打卡页面加载慢', '使用Android手机时，打卡页面加载需要3-5秒，希望能优化加载速度', '13800138000', 'resolved', NOW() - INTERVAL 5 DAY),
('CRETAS_2024_001', 2, 'feature', '希望添加数据导出功能', '建议在报表页面添加数据导出功能，可以导出为Excel或CSV格式，方便数据分析', 'user@example.com', 'processing', NOW() - INTERVAL 3 DAY),
('CRETAS_2024_001', 1, 'other', '系统整体使用体验很好', '系统功能很完善，界面也很友好，非常好用！', NULL, 'resolved', NOW() - INTERVAL 1 DAY);
