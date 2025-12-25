-- =====================================================
-- MallCenter 数据库迁移脚本 V3.0
-- 客服思维智能推荐系统
-- 功能: 搜索关键词记录、商家通知、AI需求分析
-- 执行前请备份数据库
-- =====================================================

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- 1. 搜索关键词记录表
-- 记录用户搜索的关键词，特别是无结果的搜索
-- =====================================================

DROP TABLE IF EXISTS `search_keyword_record`;
CREATE TABLE `search_keyword_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '记录ID',

    -- 关键词信息
    `keyword` VARCHAR(200) NOT NULL COMMENT '搜索关键词',
    `normalized_keyword` VARCHAR(200) NULL COMMENT '标准化后的关键词(去空格/小写)',

    -- 用户信息
    `user_id` BIGINT NULL COMMENT '用户ID',
    `merchant_id` BIGINT NULL COMMENT '商户ID(如果是商户用户)',
    `phone` VARCHAR(20) NULL COMMENT '联系电话',
    `openid` VARCHAR(64) NULL COMMENT '微信openid',

    -- 搜索结果
    `result_count` INT NOT NULL DEFAULT 0 COMMENT '搜索结果数量',
    `search_source` VARCHAR(20) NULL COMMENT '搜索来源: search_bar/ai_chat/category',

    -- 处理状态
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态: 0=待处理 1=已匹配 2=已通知 3=已忽略',
    `matched_product_ids` JSON NULL COMMENT '匹配到的商品ID列表',
    `matched_time` DATETIME NULL COMMENT '匹配时间',
    `matched_by` BIGINT NULL COMMENT '匹配操作人ID',

    -- 通知信息
    `notification_id` BIGINT NULL COMMENT '关联的通知ID',
    `notified_time` DATETIME NULL COMMENT '通知时间',

    -- 扩展数据
    `extra_data` JSON NULL COMMENT '扩展数据(设备信息、位置等)',

    -- 审计字段
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    INDEX `idx_keyword` (`keyword`(100)),
    INDEX `idx_normalized_keyword` (`normalized_keyword`(100)),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_merchant_id` (`merchant_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_result_count` (`result_count`),
    INDEX `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='搜索关键词记录';

-- =====================================================
-- 2. 关键词统计表 (聚合表)
-- 对搜索关键词进行统计分析
-- =====================================================

DROP TABLE IF EXISTS `search_keyword_stats`;
CREATE TABLE `search_keyword_stats` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '统计ID',

    -- 关键词信息
    `keyword` VARCHAR(200) NOT NULL COMMENT '关键词(标准化后)',
    `original_keywords` JSON NULL COMMENT '原始关键词变体列表',

    -- 统计数据
    `search_count` INT NOT NULL DEFAULT 1 COMMENT '总搜索次数',
    `no_result_count` INT NOT NULL DEFAULT 0 COMMENT '无结果搜索次数',
    `unique_users` INT NOT NULL DEFAULT 0 COMMENT '独立用户数',
    `unique_merchants` INT NOT NULL DEFAULT 0 COMMENT '独立商户数',

    -- 时间分布
    `first_search_time` DATETIME NULL COMMENT '首次搜索时间',
    `last_search_time` DATETIME NULL COMMENT '最近搜索时间',

    -- 处理状态
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态: 0=待处理 1=已匹配 2=已通知 3=无需处理',
    `priority` TINYINT NOT NULL DEFAULT 0 COMMENT '优先级: 0=普通 1=中等 2=高',
    `is_hot` TINYINT NOT NULL DEFAULT 0 COMMENT '是否热门关键词',

    -- 匹配信息
    `matched_product_ids` JSON NULL COMMENT '匹配到的商品ID列表',
    `matched_category_ids` JSON NULL COMMENT '匹配到的分类ID列表',

    -- 备注
    `admin_note` VARCHAR(500) NULL COMMENT '管理员备注',

    -- 审计字段
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_keyword` (`keyword`(100)),
    INDEX `idx_search_count` (`search_count`),
    INDEX `idx_no_result_count` (`no_result_count`),
    INDEX `idx_status` (`status`),
    INDEX `idx_priority` (`priority`),
    INDEX `idx_is_hot` (`is_hot`),
    INDEX `idx_last_search_time` (`last_search_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='搜索关键词统计';

-- =====================================================
-- 3. 商家通知表
-- 用于站内消息和短信通知管理
-- =====================================================

DROP TABLE IF EXISTS `merchant_notification`;
CREATE TABLE `merchant_notification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '通知ID',

    -- 接收者信息
    `merchant_id` BIGINT NOT NULL COMMENT '商户ID',
    `user_id` BIGINT NULL COMMENT '用户ID',
    `phone` VARCHAR(20) NULL COMMENT '接收手机号',

    -- 通知内容
    `title` VARCHAR(200) NOT NULL COMMENT '通知标题',
    `content` TEXT NULL COMMENT '通知内容',
    `summary` VARCHAR(500) NULL COMMENT '内容摘要(用于列表显示)',

    -- 通知类型
    `category` VARCHAR(30) NOT NULL COMMENT '通知类型: product_found/promotion/system/order',
    `sub_category` VARCHAR(30) NULL COMMENT '子类型',
    `priority` TINYINT NOT NULL DEFAULT 0 COMMENT '优先级: 0=普通 1=重要 2=紧急',

    -- 关联信息
    `related_keyword` VARCHAR(200) NULL COMMENT '关联的搜索关键词',
    `related_product_ids` JSON NULL COMMENT '关联的商品ID列表',
    `related_order_id` BIGINT NULL COMMENT '关联的订单ID',
    `related_link` VARCHAR(500) NULL COMMENT '跳转链接',

    -- 站内消息状态
    `in_app_status` TINYINT NOT NULL DEFAULT 0 COMMENT '站内消息状态: 0=待发 1=已发 2=已读 3=已删除',
    `in_app_sent_time` DATETIME NULL COMMENT '站内消息发送时间',
    `in_app_read_time` DATETIME NULL COMMENT '站内消息阅读时间',

    -- 短信状态
    `sms_enabled` TINYINT NOT NULL DEFAULT 0 COMMENT '是否启用短信: 0=否 1=是',
    `sms_status` TINYINT NOT NULL DEFAULT 0 COMMENT '短信状态: 0=未发 1=待发 2=已发 3=发送失败',
    `sms_sent_time` DATETIME NULL COMMENT '短信发送时间',
    `sms_result` VARCHAR(200) NULL COMMENT '短信发送结果',
    `sms_template_id` VARCHAR(50) NULL COMMENT '短信模板ID',

    -- 操作人
    `created_by` BIGINT NULL COMMENT '创建人ID',
    `created_by_name` VARCHAR(50) NULL COMMENT '创建人姓名',

    -- 审计字段
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_merchant_id` (`merchant_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_category` (`category`),
    INDEX `idx_in_app_status` (`in_app_status`),
    INDEX `idx_sms_status` (`sms_status`),
    INDEX `idx_create_time` (`create_time`),
    INDEX `idx_related_keyword` (`related_keyword`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家通知';

-- =====================================================
-- 4. AI需求记录表
-- 记录AI对话中识别的用户需求
-- =====================================================

DROP TABLE IF EXISTS `ai_demand_record`;
CREATE TABLE `ai_demand_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '记录ID',

    -- 会话信息
    `session_id` VARCHAR(50) NOT NULL COMMENT 'AI会话ID',
    `message_id` VARCHAR(50) NULL COMMENT '消息ID',

    -- 用户信息
    `user_id` BIGINT NULL COMMENT '用户ID',
    `merchant_id` BIGINT NULL COMMENT '商户ID',
    `openid` VARCHAR(64) NULL COMMENT '微信openid',

    -- 原始消息
    `user_message` TEXT NOT NULL COMMENT '用户原始消息',
    `ai_response` TEXT NULL COMMENT 'AI回复内容',

    -- AI分析结果
    `extracted_keywords` JSON NULL COMMENT '提取的关键词列表',
    `extracted_intent` VARCHAR(50) NULL COMMENT '识别的用户意图',
    `confidence_score` DECIMAL(5,4) NULL COMMENT '置信度(0-1)',

    -- 商品匹配
    `matched_product_ids` JSON NULL COMMENT '匹配到的商品ID列表',
    `recommended_product_ids` JSON NULL COMMENT '推荐的商品ID列表',
    `match_count` INT NOT NULL DEFAULT 0 COMMENT '匹配商品数量',

    -- 需求类型
    `demand_type` VARCHAR(50) NULL COMMENT '需求类型: product_inquiry/price_inquiry/stock_inquiry/other',
    `demand_urgency` TINYINT NOT NULL DEFAULT 0 COMMENT '需求紧急度: 0=一般 1=较急 2=紧急',

    -- 处理状态
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态: 0=待处理 1=已处理 2=已转人工',
    `processed_time` DATETIME NULL COMMENT '处理时间',
    `processed_by` BIGINT NULL COMMENT '处理人ID',

    -- 反馈
    `user_feedback` TINYINT NULL COMMENT '用户反馈: 1=有帮助 0=无帮助',
    `feedback_time` DATETIME NULL COMMENT '反馈时间',

    -- 审计字段
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_session_id` (`session_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_merchant_id` (`merchant_id`),
    INDEX `idx_demand_type` (`demand_type`),
    INDEX `idx_status` (`status`),
    INDEX `idx_create_time` (`create_time`),
    INDEX `idx_extracted_intent` (`extracted_intent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI需求记录';

-- =====================================================
-- 5. 通知模板表
-- 管理站内消息和短信模板
-- =====================================================

DROP TABLE IF EXISTS `notification_template`;
CREATE TABLE `notification_template` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '模板ID',

    -- 模板信息
    `template_code` VARCHAR(50) NOT NULL COMMENT '模板代码',
    `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称',
    `template_type` VARCHAR(20) NOT NULL COMMENT '模板类型: in_app/sms/both',
    `category` VARCHAR(30) NOT NULL COMMENT '通知类型: product_found/promotion/system',

    -- 模板内容
    `title_template` VARCHAR(200) NULL COMMENT '标题模板(站内)',
    `content_template` TEXT NULL COMMENT '内容模板(站内)',
    `sms_template` VARCHAR(500) NULL COMMENT '短信模板内容',
    `sms_template_id` VARCHAR(50) NULL COMMENT '阿里云短信模板ID',

    -- 变量说明
    `variables` JSON NULL COMMENT '模板变量说明 [{name, desc, example}]',

    -- 状态
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0=禁用 1=启用',

    -- 审计
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_template_code` (`template_code`),
    INDEX `idx_template_type` (`template_type`),
    INDEX `idx_category` (`category`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知模板';

-- =====================================================
-- 6. 短信发送记录表
-- 记录短信发送历史
-- =====================================================

DROP TABLE IF EXISTS `sms_send_record`;
CREATE TABLE `sms_send_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '记录ID',

    -- 发送信息
    `phone` VARCHAR(20) NOT NULL COMMENT '接收手机号',
    `template_id` VARCHAR(50) NOT NULL COMMENT '短信模板ID',
    `template_params` JSON NULL COMMENT '模板参数',
    `content` VARCHAR(500) NULL COMMENT '实际发送内容',

    -- 发送结果
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态: 0=待发 1=发送中 2=成功 3=失败',
    `send_time` DATETIME NULL COMMENT '发送时间',
    `result_code` VARCHAR(50) NULL COMMENT '发送结果码',
    `result_message` VARCHAR(500) NULL COMMENT '发送结果消息',
    `biz_id` VARCHAR(100) NULL COMMENT '阿里云业务ID',

    -- 关联信息
    `notification_id` BIGINT NULL COMMENT '关联通知ID',
    `merchant_id` BIGINT NULL COMMENT '商户ID',
    `user_id` BIGINT NULL COMMENT '用户ID',

    -- 费用
    `fee_count` INT NOT NULL DEFAULT 1 COMMENT '计费条数',

    -- 审计
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_phone` (`phone`),
    INDEX `idx_status` (`status`),
    INDEX `idx_send_time` (`send_time`),
    INDEX `idx_merchant_id` (`merchant_id`),
    INDEX `idx_notification_id` (`notification_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信发送记录';

-- =====================================================
-- 7. 初始化数据 - 通知模板
-- =====================================================

INSERT INTO `notification_template`
(`template_code`, `template_name`, `template_type`, `category`, `title_template`, `content_template`, `sms_template`, `variables`, `status`)
VALUES
-- 商品找到通知
('PRODUCT_FOUND', '商品上架通知', 'both', 'product_found',
 '您搜索的商品已上架',
 '尊敬的商户，您之前搜索的"{keyword}"相关商品已上架！\n\n推荐商品：\n{product_list}\n\n点击查看详情，把握商机！',
 '您搜索的{keyword}已上架，点击查看：{url}',
 '[{"name":"keyword","desc":"搜索关键词","example":"有机蔬菜"},{"name":"product_list","desc":"商品列表","example":"有机西红柿、有机黄瓜"},{"name":"url","desc":"跳转链接","example":"https://..."}]',
 1),

-- 新品推荐
('NEW_PRODUCT_RECOMMEND', '新品推荐通知', 'both', 'promotion',
 '新品推荐：{product_name}',
 '尊敬的商户，我们上新了"{product_name}"，可能正是您需要的！\n\n{product_desc}\n\n限时优惠价：¥{price}起',
 '新品上架：{product_name}，优惠价{price}元起，点击查看{url}',
 '[{"name":"product_name","desc":"商品名称","example":"阿拉斯加野生虾仁"},{"name":"product_desc","desc":"商品描述","example":"新鲜捕捞..."},{"name":"price","desc":"价格","example":"58"},{"name":"url","desc":"链接","example":"https://..."}]',
 1),

-- 促销活动
('PROMOTION_NOTICE', '促销活动通知', 'in_app', 'promotion',
 '{title}',
 '{content}',
 NULL,
 '[{"name":"title","desc":"活动标题","example":"新春大促"},{"name":"content","desc":"活动内容","example":"全场8折..."}]',
 1),

-- 系统通知
('SYSTEM_NOTICE', '系统通知', 'in_app', 'system',
 '{title}',
 '{content}',
 NULL,
 '[{"name":"title","desc":"通知标题","example":"系统升级"},{"name":"content","desc":"通知内容","example":"系统将于..."}]',
 1),

-- AI推荐反馈
('AI_RECOMMEND_FEEDBACK', 'AI推荐结果', 'in_app', 'product_found',
 'AI为您找到了相关商品',
 '根据您的需求"{keyword}"，我们的AI助手为您推荐了以下商品：\n\n{product_list}\n\n如有问题，欢迎继续咨询AI助手。',
 NULL,
 '[{"name":"keyword","desc":"用户需求","example":"进口牛肉"},{"name":"product_list","desc":"推荐商品","example":"澳洲M9和牛..."}]',
 1);

-- =====================================================
-- 8. 系统配置 - 短信服务
-- 插入到系统配置表(如果存在)
-- =====================================================

-- 检查sys_config表是否存在，存在则插入配置
-- 注意: 实际生产环境需要替换为真实的阿里云配置

-- 如果使用若依框架的sys_config表
INSERT INTO `sys_config` (`config_name`, `config_key`, `config_value`, `config_type`, `create_by`, `create_time`, `remark`)
SELECT '阿里云短信AccessKey', 'sms.aliyun.access_key', 'your_access_key_here', 'Y', 'admin', NOW(), '阿里云短信服务AccessKey ID'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sys_config' AND table_schema = DATABASE())
AND NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sms.aliyun.access_key');

INSERT INTO `sys_config` (`config_name`, `config_key`, `config_value`, `config_type`, `create_by`, `create_time`, `remark`)
SELECT '阿里云短信Secret', 'sms.aliyun.access_secret', 'your_access_secret_here', 'Y', 'admin', NOW(), '阿里云短信服务AccessKey Secret'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sys_config' AND table_schema = DATABASE())
AND NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sms.aliyun.access_secret');

INSERT INTO `sys_config` (`config_name`, `config_key`, `config_value`, `config_type`, `create_by`, `create_time`, `remark`)
SELECT '短信签名', 'sms.aliyun.sign_name', '白垩纪食品', 'Y', 'admin', NOW(), '短信签名名称'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sys_config' AND table_schema = DATABASE())
AND NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sms.aliyun.sign_name');

INSERT INTO `sys_config` (`config_name`, `config_key`, `config_value`, `config_type`, `create_by`, `create_time`, `remark`)
SELECT '每日短信限额', 'sms.daily_limit', '100', 'Y', 'admin', NOW(), '每个商户每日短信发送上限'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sys_config' AND table_schema = DATABASE())
AND NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sms.daily_limit');

-- =====================================================
-- 9. 创建视图 - 热门搜索词统计
-- =====================================================

DROP VIEW IF EXISTS `v_hot_search_keywords`;
CREATE VIEW `v_hot_search_keywords` AS
SELECT
    s.id,
    s.keyword,
    s.search_count,
    s.no_result_count,
    s.unique_merchants,
    s.last_search_time,
    s.status,
    CASE
        WHEN s.no_result_count >= 10 AND s.unique_merchants >= 3 THEN 2
        WHEN s.no_result_count >= 5 OR s.unique_merchants >= 2 THEN 1
        ELSE 0
    END AS computed_priority,
    CASE
        WHEN s.search_count >= 50 THEN 1
        ELSE 0
    END AS is_trending
FROM search_keyword_stats s
WHERE s.status IN (0, 1)
  AND s.last_search_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY s.no_result_count DESC, s.search_count DESC;

-- =====================================================
-- 10. Mock 数据 - 搜索关键词记录
-- =====================================================

INSERT INTO `search_keyword_record`
(`keyword`, `normalized_keyword`, `user_id`, `merchant_id`, `phone`, `result_count`, `search_source`, `status`, `create_time`)
VALUES
('进口牛肉', '进口牛肉', 1001, 1, '13800138001', 0, 'search_bar', 0, DATE_SUB(NOW(), INTERVAL 2 DAY)),
('有机蔬菜礼盒', '有机蔬菜礼盒', 1002, 2, '13800138002', 3, 'search_bar', 0, DATE_SUB(NOW(), INTERVAL 1 DAY)),
('澳洲龙虾', '澳洲龙虾', 1003, 3, '13800138003', 0, 'search_bar', 0, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
('冷冻三文鱼', '冷冻三文鱼', 1001, 1, '13800138001', 0, 'ai_chat', 0, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('挪威鳕鱼', '挪威鳕鱼', 1004, 4, '13800138004', 2, 'search_bar', 0, NOW()),
('进口牛肉', '进口牛肉', 1005, 5, '13800138005', 0, 'search_bar', 0, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
('阿拉斯加帝王蟹', '阿拉斯加帝王蟹', 1002, 2, '13800138002', 0, 'ai_chat', 0, DATE_SUB(NOW(), INTERVAL 6 HOUR));

-- =====================================================
-- 11. Mock 数据 - 关键词统计
-- =====================================================

INSERT INTO `search_keyword_stats`
(`keyword`, `original_keywords`, `search_count`, `no_result_count`, `unique_users`, `unique_merchants`, `first_search_time`, `last_search_time`, `status`, `priority`, `is_hot`)
VALUES
('进口牛肉', '["进口牛肉", "牛肉 进口"]', 15, 12, 8, 5, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), 0, 2, 1),
('澳洲龙虾', '["澳洲龙虾", "龙虾 澳洲"]', 8, 8, 5, 3, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 3 HOUR), 0, 1, 0),
('冷冻三文鱼', '["冷冻三文鱼", "三文鱼 冷冻"]', 6, 6, 4, 2, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 1 HOUR), 0, 1, 0),
('阿拉斯加帝王蟹', '["阿拉斯加帝王蟹", "帝王蟹"]', 5, 5, 3, 2, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 6 HOUR), 0, 1, 0),
('有机蔬菜', '["有机蔬菜", "有机 蔬菜", "有机蔬菜礼盒"]', 25, 5, 15, 8, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 0, 1);

-- =====================================================
-- 12. Mock 数据 - 商家通知
-- =====================================================

INSERT INTO `merchant_notification`
(`merchant_id`, `user_id`, `phone`, `title`, `content`, `summary`, `category`, `priority`, `related_keyword`, `related_product_ids`, `in_app_status`, `sms_enabled`, `sms_status`, `created_by`, `created_by_name`, `create_time`)
VALUES
(1, 1001, '13800138001', '您搜索的商品已上架', '尊敬的商户，您之前搜索的"有机蔬菜"相关商品已上架！\n\n推荐商品：\n- 有机蔬菜礼盒\n- 有机番茄\n\n点击查看详情！', '有机蔬菜相关商品已上架', 'product_found', 1, '有机蔬菜', '[4]', 1, 1, 2, 1, '系统管理员', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 1002, '13800138002', '新品推荐：深海鳕鱼片', '尊敬的商户，我们上新了"深海鳕鱼片"，可能正是您需要的！\n\n来自挪威深海的优质鳕鱼\n\n限时优惠价：¥88起', '新品深海鳕鱼片上架', 'promotion', 0, NULL, '[2]', 1, 0, 0, 1, '系统管理员', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(3, 1003, '13800138003', '系统升级通知', '系统将于2025年1月20日凌晨2:00-4:00进行升级维护，届时可能影响下单功能，请提前做好安排。', '系统升级维护通知', 'system', 0, NULL, NULL, 0, 0, 0, 1, '系统管理员', NOW());

-- =====================================================
-- 13. Mock 数据 - AI需求记录
-- =====================================================

INSERT INTO `ai_demand_record`
(`session_id`, `user_id`, `merchant_id`, `user_message`, `ai_response`, `extracted_keywords`, `extracted_intent`, `confidence_score`, `matched_product_ids`, `match_count`, `demand_type`, `status`, `create_time`)
VALUES
('session_ai_001', 1001, 1, '我想找一些进口的牛肉，最好是澳洲的',
 '您好！很抱歉，目前我们平台暂时没有澳洲牛肉的库存。我已经记录了您的需求，一旦有相关商品上架，会第一时间通知您！\n\n目前我们有一些其他优质肉类可以推荐给您，比如精选牛排套餐，是否需要了解一下？',
 '["进口牛肉", "澳洲牛肉"]', 'product_inquiry', 0.92, '[5]', 1, 'product_inquiry', 0, DATE_SUB(NOW(), INTERVAL 1 DAY)),

('session_ai_002', 1002, 2, '有没有帝王蟹？要活的',
 '您好！我们平台有"活冻帝王蟹1kg"可供选购，来自俄罗斯远东海域，品质优良！\n\n当前价格：\n- 1-4只：¥688/只\n- 5-9只：¥628/只\n- 10只以上：¥568/只\n\n需要我为您推荐吗？',
 '["帝王蟹", "活蟹"]', 'product_inquiry', 0.95, '[3]', 1, 'product_inquiry', 1, DATE_SUB(NOW(), INTERVAL 6 HOUR)),

('session_ai_003', 1003, 3, '你们的虾仁怎么解冻比较好？',
 '您好！冷冻虾仁的推荐解冻方法：\n\n1. **冷藏解冻（推荐）**：放入冰箱冷藏室自然解冻4-6小时\n2. **流水解冻**：密封袋放入流动冷水中20-30分钟\n3. **盐水解冻**：淡盐水中解冻，保持鲜味\n\n⚠️ 不建议热水或微波炉解冻\n\n解冻后建议24小时内食用，不宜重新冷冻。',
 '["虾仁", "解冻方法"]', 'usage_inquiry', 0.88, '[1]', 1, 'other', 1, DATE_SUB(NOW(), INTERVAL 3 HOUR));

-- =====================================================
-- 完成
-- =====================================================

SET FOREIGN_KEY_CHECKS = 1;

SELECT '迁移完成: V3.0 客服思维智能推荐系统' AS message;
