-- ========================================
-- MallCenter V4.0 数据库迁移脚本
-- 推荐系统、内容审核、AI知识库
-- ========================================

-- ========================================
-- 1. 推荐系统表
-- ========================================

-- 推荐记录表
CREATE TABLE IF NOT EXISTS `referral` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '推荐ID',
    `referral_code` VARCHAR(50) NOT NULL COMMENT '推荐码',
    `referrer_id` BIGINT NOT NULL COMMENT '推荐人用户ID',
    `referrer_name` VARCHAR(100) DEFAULT NULL COMMENT '推荐人名称',
    `referee_id` BIGINT NOT NULL COMMENT '被推荐人用户ID',
    `referee_name` VARCHAR(100) DEFAULT NULL COMMENT '被推荐人名称',
    `referee_phone` VARCHAR(20) DEFAULT NULL COMMENT '被推荐人手机号',
    `referral_type` TINYINT NOT NULL DEFAULT 1 COMMENT '推荐类型：1新用户注册 2首单购买 3累计消费',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0待确认 1已确认 2已奖励 3已失效',
    `order_id` BIGINT DEFAULT NULL COMMENT '关联订单ID',
    `order_amount` DECIMAL(10,2) DEFAULT NULL COMMENT '订单金额',
    `reward_amount` DECIMAL(10,2) DEFAULT NULL COMMENT '奖励金额',
    `reward_type` TINYINT DEFAULT NULL COMMENT '奖励类型：1现金 2积分 3优惠券',
    `reward_time` DATETIME DEFAULT NULL COMMENT '奖励发放时间',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标记：0正常 1删除',
    PRIMARY KEY (`id`),
    KEY `idx_referral_code` (`referral_code`),
    KEY `idx_referrer_id` (`referrer_id`),
    KEY `idx_referee_id` (`referee_id`),
    KEY `idx_status` (`status`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐记录表';

-- 推荐奖励配置表
CREATE TABLE IF NOT EXISTS `referral_reward_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `config_name` VARCHAR(100) NOT NULL COMMENT '配置名称',
    `referral_type` TINYINT NOT NULL COMMENT '推荐类型：1新用户注册 2首单购买 3累计消费',
    `reward_type` TINYINT NOT NULL DEFAULT 1 COMMENT '奖励类型：1现金 2积分 3优惠券',
    `referrer_reward` DECIMAL(10,2) DEFAULT NULL COMMENT '推荐人奖励金额/积分',
    `referee_reward` DECIMAL(10,2) DEFAULT NULL COMMENT '被推荐人奖励金额/积分',
    `coupon_id` BIGINT DEFAULT NULL COMMENT '关联优惠券ID',
    `min_order_amount` DECIMAL(10,2) DEFAULT NULL COMMENT '最低订单金额',
    `reward_rate` DECIMAL(5,2) DEFAULT NULL COMMENT '奖励比例（百分比）',
    `max_reward` DECIMAL(10,2) DEFAULT NULL COMMENT '最高奖励金额限制',
    `start_time` DATETIME DEFAULT NULL COMMENT '生效开始时间',
    `end_time` DATETIME DEFAULT NULL COMMENT '生效结束时间',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0停用 1启用',
    `priority` INT DEFAULT 0 COMMENT '优先级',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标记',
    PRIMARY KEY (`id`),
    KEY `idx_referral_type` (`referral_type`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐奖励配置表';

-- 插入默认奖励配置
INSERT INTO `referral_reward_config` (`config_name`, `referral_type`, `reward_type`, `referrer_reward`, `referee_reward`, `min_order_amount`, `status`, `priority`, `remark`) VALUES
('新用户注册奖励', 1, 1, 10.00, 5.00, NULL, 1, 10, '新用户注册即可获得奖励'),
('首单购买奖励', 2, 1, 20.00, 10.00, 50.00, 1, 20, '被推荐人首单满50元触发'),
('累计消费返佣', 3, 1, NULL, NULL, 100.00, 1, 5, '按消费金额5%返佣，最高50元');

UPDATE `referral_reward_config` SET `reward_rate` = 5.00, `max_reward` = 50.00 WHERE `referral_type` = 3;

-- ========================================
-- 2. 内容审核表
-- ========================================

CREATE TABLE IF NOT EXISTS `content_review` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '审核ID',
    `content_type` TINYINT NOT NULL COMMENT '内容类型：1商品 2评论 3广告 4商户资料',
    `content_id` BIGINT NOT NULL COMMENT '内容ID',
    `content_title` VARCHAR(255) DEFAULT NULL COMMENT '内容标题/摘要',
    `content_detail` TEXT COMMENT '内容详情（JSON格式）',
    `submitter_id` BIGINT NOT NULL COMMENT '提交人ID',
    `submitter_name` VARCHAR(100) DEFAULT NULL COMMENT '提交人名称',
    `merchant_id` BIGINT DEFAULT NULL COMMENT '商户ID',
    `merchant_name` VARCHAR(100) DEFAULT NULL COMMENT '商户名称',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0待审核 1已通过 2已拒绝 3需修改',
    `priority` TINYINT NOT NULL DEFAULT 1 COMMENT '优先级：1普通 2重要 3紧急',
    `reviewer_id` BIGINT DEFAULT NULL COMMENT '审核人ID',
    `reviewer_name` VARCHAR(100) DEFAULT NULL COMMENT '审核人名称',
    `review_time` DATETIME DEFAULT NULL COMMENT '审核时间',
    `review_remark` VARCHAR(500) DEFAULT NULL COMMENT '审核意见',
    `reject_reason` VARCHAR(500) DEFAULT NULL COMMENT '拒绝原因',
    `ai_result` TEXT COMMENT 'AI审核结果（JSON格式）',
    `ai_score` INT DEFAULT NULL COMMENT 'AI审核分数（0-100）',
    `skip_ai` TINYINT DEFAULT 0 COMMENT '是否跳过AI审核',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标记',
    PRIMARY KEY (`id`),
    KEY `idx_content_type` (`content_type`),
    KEY `idx_content_id` (`content_id`),
    KEY `idx_status` (`status`),
    KEY `idx_merchant_id` (`merchant_id`),
    KEY `idx_create_time` (`create_time`),
    KEY `idx_priority_status` (`priority`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容审核表';

-- ========================================
-- 3. AI知识库表
-- ========================================

-- AI知识分类表
CREATE TABLE IF NOT EXISTS `ai_knowledge_category` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '分类ID',
    `parent_id` BIGINT DEFAULT 0 COMMENT '父分类ID',
    `category_name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `category_code` VARCHAR(50) DEFAULT NULL COMMENT '分类编码',
    `description` VARCHAR(500) DEFAULT NULL COMMENT '描述',
    `icon` VARCHAR(255) DEFAULT NULL COMMENT '图标',
    `sort` INT DEFAULT 0 COMMENT '排序',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0停用 1启用',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标记',
    PRIMARY KEY (`id`),
    KEY `idx_parent_id` (`parent_id`),
    KEY `idx_category_code` (`category_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI知识分类表';

-- AI知识文档表
CREATE TABLE IF NOT EXISTS `ai_knowledge_document` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '文档ID',
    `category_id` BIGINT NOT NULL COMMENT '分类ID',
    `title` VARCHAR(255) NOT NULL COMMENT '文档标题',
    `content` LONGTEXT COMMENT '文档内容',
    `summary` VARCHAR(1000) DEFAULT NULL COMMENT '摘要',
    `keywords` VARCHAR(500) DEFAULT NULL COMMENT '关键词（逗号分隔）',
    `source` VARCHAR(255) DEFAULT NULL COMMENT '来源',
    `file_url` VARCHAR(500) DEFAULT NULL COMMENT '原始文件URL',
    `file_type` VARCHAR(50) DEFAULT NULL COMMENT '文件类型',
    `vector_status` TINYINT DEFAULT 0 COMMENT '向量化状态：0未处理 1处理中 2已完成 3失败',
    `vector_id` VARCHAR(100) DEFAULT NULL COMMENT '向量库ID',
    `view_count` INT DEFAULT 0 COMMENT '查看次数',
    `like_count` INT DEFAULT 0 COMMENT '点赞次数',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0草稿 1发布',
    `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标记',
    PRIMARY KEY (`id`),
    KEY `idx_category_id` (`category_id`),
    KEY `idx_status` (`status`),
    KEY `idx_vector_status` (`vector_status`),
    FULLTEXT KEY `ft_title_content` (`title`, `summary`, `keywords`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI知识文档表';

-- AI问答对表
CREATE TABLE IF NOT EXISTS `ai_qa_pair` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `category_id` BIGINT DEFAULT NULL COMMENT '分类ID',
    `question` TEXT NOT NULL COMMENT '问题',
    `answer` TEXT NOT NULL COMMENT '答案',
    `keywords` VARCHAR(500) DEFAULT NULL COMMENT '关键词',
    `hit_count` INT DEFAULT 0 COMMENT '命中次数',
    `like_count` INT DEFAULT 0 COMMENT '点赞次数',
    `dislike_count` INT DEFAULT 0 COMMENT '踩次数',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0停用 1启用',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标记',
    PRIMARY KEY (`id`),
    KEY `idx_category_id` (`category_id`),
    KEY `idx_status` (`status`),
    FULLTEXT KEY `ft_question_answer` (`question`, `answer`, `keywords`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI问答对表';

-- AI聊天历史表
CREATE TABLE IF NOT EXISTS `ai_chat_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `session_id` VARCHAR(64) NOT NULL COMMENT '会话ID',
    `user_id` BIGINT DEFAULT NULL COMMENT '用户ID',
    `role` VARCHAR(20) NOT NULL COMMENT '角色：user/assistant/system',
    `content` TEXT NOT NULL COMMENT '消息内容',
    `tokens` INT DEFAULT NULL COMMENT 'Token数量',
    `model` VARCHAR(50) DEFAULT NULL COMMENT '使用的模型',
    `feedback` TINYINT DEFAULT NULL COMMENT '反馈：1满意 0不满意',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI聊天历史表';

-- 插入默认知识分类
INSERT INTO `ai_knowledge_category` (`parent_id`, `category_name`, `category_code`, `description`, `sort`, `status`) VALUES
(0, '商品知识', 'goods', '商品相关的知识库', 1, 1),
(0, '售后服务', 'service', '售后服务相关问题', 2, 1),
(0, '物流配送', 'logistics', '物流配送相关知识', 3, 1),
(0, '支付结算', 'payment', '支付和结算相关', 4, 1),
(0, '平台规则', 'rules', '平台规则和政策', 5, 1);

-- 插入示例问答对
INSERT INTO `ai_qa_pair` (`category_id`, `question`, `answer`, `keywords`, `status`) VALUES
(1, '如何查看商品溯源信息？', '您可以通过扫描商品包装上的溯源二维码，或在商品详情页点击"溯源查询"按钮，输入批次号即可查看完整的溯源信息，包括产地、生产日期、质检报告等。', '溯源,二维码,批次号,查询', 1),
(2, '如何申请退款？', '您可以在"我的订单"中找到需要退款的订单，点击"申请退款"按钮，选择退款原因并提交申请。我们会在1-3个工作日内审核处理。', '退款,申请,订单', 1),
(3, '配送范围是哪些地区？', '我们目前支持全国大部分地区配送，偏远地区可能需要加收运费。具体配送范围和运费详情请在下单时查看。', '配送,范围,运费,地区', 1);

-- ========================================
-- 4. 创建视图
-- ========================================

-- 推荐统计视图
CREATE OR REPLACE VIEW `v_referral_stats` AS
SELECT 
    referrer_id,
    COUNT(*) as total_referrals,
    SUM(CASE WHEN status IN (1, 2) THEN 1 ELSE 0 END) as valid_referrals,
    SUM(CASE WHEN status = 2 THEN reward_amount ELSE 0 END) as total_reward,
    SUM(CASE WHEN status = 1 THEN reward_amount ELSE 0 END) as pending_reward
FROM referral
WHERE del_flag = 0
GROUP BY referrer_id;

-- 内容审核统计视图
CREATE OR REPLACE VIEW `v_content_review_stats` AS
SELECT 
    content_type,
    COUNT(*) as total_count,
    SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as pending_count,
    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as rejected_count,
    SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as modify_count
FROM content_review
WHERE del_flag = 0
GROUP BY content_type;

-- ========================================
-- 完成
-- ========================================
SELECT 'V4.0 Migration completed successfully!' as status;







