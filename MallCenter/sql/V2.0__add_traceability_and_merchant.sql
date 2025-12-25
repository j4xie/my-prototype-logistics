-- =====================================================
-- MallCenter 数据库迁移脚本 V2.0
-- 添加溯源系统、商户管理等新模块
-- 执行前请备份数据库
-- =====================================================

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- 1. 商户管理模块
-- =====================================================

-- 商户主表
DROP TABLE IF EXISTS `merchant`;
CREATE TABLE `merchant` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '商户ID',
    `user_id` BIGINT NULL COMMENT '关联用户ID',
    `merchant_no` VARCHAR(32) NULL COMMENT '商户编号',
    `merchant_name` VARCHAR(100) NOT NULL COMMENT '商户名称',
    `short_name` VARCHAR(50) NULL COMMENT '简称',
    `logo_url` VARCHAR(255) NULL COMMENT 'Logo图片',

    -- 认证信息
    `license_no` VARCHAR(50) NULL COMMENT '营业执照号',
    `license_image` VARCHAR(255) NULL COMMENT '营业执照图片',
    `legal_person` VARCHAR(50) NULL COMMENT '法人姓名',
    `legal_id_card` VARCHAR(50) NULL COMMENT '法人身份证',
    `legal_id_front` VARCHAR(255) NULL COMMENT '身份证正面',
    `legal_id_back` VARCHAR(255) NULL COMMENT '身份证反面',

    -- 银行信息
    `bank_account` VARCHAR(50) NULL COMMENT '银行账户',
    `bank_name` VARCHAR(100) NULL COMMENT '开户银行',
    `bank_branch` VARCHAR(100) NULL COMMENT '支行名称',

    -- 联系信息
    `contact_name` VARCHAR(50) NULL COMMENT '联系人',
    `contact_phone` VARCHAR(20) NULL COMMENT '联系电话',
    `contact_email` VARCHAR(100) NULL COMMENT '联系邮箱',
    `address` VARCHAR(255) NULL COMMENT '经营地址',

    -- 状态与统计
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0待审核 1已认证 2已封禁 3已注销',
    `rating` DECIMAL(2,1) NOT NULL DEFAULT 5.0 COMMENT '评分',
    `review_rate` DECIMAL(5,2) NOT NULL DEFAULT 100.00 COMMENT '好评率%',
    `operating_years` INT NOT NULL DEFAULT 0 COMMENT '经营年限',
    `product_count` INT NOT NULL DEFAULT 0 COMMENT '商品数量',
    `order_count` INT NOT NULL DEFAULT 0 COMMENT '订单数量',
    `total_sales` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '总销售额',

    -- 审计字段
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标记',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_merchant_no` (`merchant_no`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户表';

-- 商户审核记录
DROP TABLE IF EXISTS `merchant_review`;
CREATE TABLE `merchant_review` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `merchant_id` BIGINT NOT NULL COMMENT '商户ID',
    `reviewer_id` BIGINT NULL COMMENT '审核人ID',
    `reviewer_name` VARCHAR(50) NULL COMMENT '审核人姓名',
    `action` TINYINT NULL COMMENT '操作：1通过 2拒绝',
    `remark` TEXT NULL COMMENT '审核备注',
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户审核记录';

-- 商户员工表
DROP TABLE IF EXISTS `merchant_staff`;
CREATE TABLE `merchant_staff` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `merchant_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'staff' COMMENT '角色：owner/admin/staff',
    `permissions` JSON NULL COMMENT '权限列表',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0禁用 1启用',
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_merchant_user` (`merchant_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户员工';

-- =====================================================
-- 2. 溯源系统模块
-- =====================================================

-- 溯源批次
DROP TABLE IF EXISTS `traceability_batch`;
CREATE TABLE `traceability_batch` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_no` VARCHAR(50) NOT NULL COMMENT '批次号 FAC001-20250105-001',
    `product_id` BIGINT NULL COMMENT '关联商品SPU',
    `merchant_id` BIGINT NULL COMMENT '关联商户',
    `product_name` VARCHAR(100) NULL COMMENT '产品名称（冗余）',

    -- 生产信息
    `production_date` DATE NULL COMMENT '生产日期',
    `expiry_date` DATE NULL COMMENT '过期日期',
    `quantity` DECIMAL(10,2) NULL COMMENT '数量',
    `unit` VARCHAR(20) NULL COMMENT '单位',
    `workshop` VARCHAR(50) NULL COMMENT '生产车间',

    -- 状态
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0进行中 1已完成 2待处理',

    -- 审计
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_batch_no` (`batch_no`),
    INDEX `idx_product_id` (`product_id`),
    INDEX `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='溯源批次';

-- 溯源时间线
DROP TABLE IF EXISTS `traceability_timeline`;
CREATE TABLE `traceability_timeline` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `stage` VARCHAR(50) NULL COMMENT '阶段代码',
    `title` VARCHAR(100) NULL COMMENT '标题',
    `description` TEXT NULL COMMENT '描述',

    -- 操作信息
    `operator` VARCHAR(50) NULL COMMENT '操作员',
    `operator_id` BIGINT NULL COMMENT '操作员ID',
    `workshop` VARCHAR(50) NULL COMMENT '车间',
    `equipment` VARCHAR(100) NULL COMMENT '设备',

    -- 状态与排序
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0待处理 1进行中 2已完成',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `timestamp` DATETIME NULL COMMENT '发生时间',

    -- 扩展数据
    `extra_data` JSON NULL COMMENT '扩展数据',

    PRIMARY KEY (`id`),
    INDEX `idx_batch_id` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='溯源时间线';

-- 原料信息
DROP TABLE IF EXISTS `traceability_raw_material`;
CREATE TABLE `traceability_raw_material` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `material_name` VARCHAR(100) NULL COMMENT '原料名称',
    `supplier` VARCHAR(100) NULL COMMENT '供应商',
    `supplier_id` BIGINT NULL COMMENT '供应商ID',
    `origin` VARCHAR(100) NULL COMMENT '产地',

    -- 批次信息
    `material_batch_no` VARCHAR(50) NULL COMMENT '原料批次号',
    `production_date` DATE NULL COMMENT '生产日期',
    `expiry_date` DATE NULL COMMENT '过期日期',
    `quantity` DECIMAL(10,2) NULL COMMENT '数量',
    `unit` VARCHAR(20) NULL COMMENT '单位',

    -- 验证状态
    `verified` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已验证',
    `verify_time` DATETIME NULL COMMENT '验证时间',

    PRIMARY KEY (`id`),
    INDEX `idx_batch_id` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='溯源原料';

-- 质检报告
DROP TABLE IF EXISTS `traceability_quality_report`;
CREATE TABLE `traceability_quality_report` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `stage` VARCHAR(50) NULL COMMENT '检验阶段：raw_material/finished',
    `result` VARCHAR(20) NULL COMMENT '检验结果：pass/fail',

    -- 检验信息
    `inspector` VARCHAR(50) NULL COMMENT '检验员',
    `inspector_id` BIGINT NULL COMMENT '检验员ID',
    `inspection_time` DATETIME NULL COMMENT '检验时间',

    -- 检验项目
    `test_items` JSON NULL COMMENT '检验项目JSON',

    -- 证书
    `certificate_image` VARCHAR(255) NULL COMMENT '证书图片',
    `report_file` VARCHAR(255) NULL COMMENT '报告文件',

    PRIMARY KEY (`id`),
    INDEX `idx_batch_id` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检报告';

-- 现场证据
DROP TABLE IF EXISTS `traceability_evidence`;
CREATE TABLE `traceability_evidence` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `type` VARCHAR(20) NULL COMMENT '类型：video/photo',
    `title` VARCHAR(100) NULL COMMENT '标题',
    `description` VARCHAR(255) NULL COMMENT '描述',
    `url` VARCHAR(255) NOT NULL COMMENT '文件URL',
    `thumbnail_url` VARCHAR(255) NULL COMMENT '缩略图',
    `sort_order` INT NOT NULL DEFAULT 0,
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_batch_id` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='溯源证据';

-- =====================================================
-- 3. 阶梯定价模块
-- =====================================================

DROP TABLE IF EXISTS `goods_price_tier`;
CREATE TABLE `goods_price_tier` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `spu_id` BIGINT NOT NULL COMMENT '商品SPU ID',
    `min_quantity` INT NOT NULL COMMENT '最小数量',
    `max_quantity` INT NULL COMMENT '最大数量（NULL表示无上限）',
    `price` DECIMAL(10,2) NOT NULL COMMENT '单价',
    `discount_rate` DECIMAL(5,2) NULL COMMENT '折扣率%',
    `sort_order` INT NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`),
    INDEX `idx_spu_id` (`spu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品阶梯定价';

-- =====================================================
-- 4. 广告系统模块
-- =====================================================

DROP TABLE IF EXISTS `advertisement`;
CREATE TABLE `advertisement` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(20) NOT NULL COMMENT '类型：splash_ad/home_banner/detail_bottom',
    `title` VARCHAR(100) NULL COMMENT '标题',
    `description` VARCHAR(255) NULL COMMENT '描述',

    -- 素材
    `image_url` VARCHAR(255) NOT NULL COMMENT '图片URL',
    `video_url` VARCHAR(255) NULL COMMENT '视频URL',

    -- 链接
    `link_type` VARCHAR(20) NULL COMMENT '链接类型：product/url/miniprogram/none',
    `link_value` VARCHAR(255) NULL COMMENT '链接值',

    -- 展示控制
    `position` INT NOT NULL DEFAULT 0 COMMENT '位置/排序',
    `start_time` DATETIME NULL COMMENT '开始时间',
    `end_time` DATETIME NULL COMMENT '结束时间',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0下线 1上线',

    -- 统计
    `view_count` INT NOT NULL DEFAULT 0 COMMENT '展示次数',
    `click_count` INT NOT NULL DEFAULT 0 COMMENT '点击次数',

    -- 审计
    `create_by` BIGINT NULL,
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_type_status` (`type`, `status`),
    INDEX `idx_time_range` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='广告';

-- =====================================================
-- 5. 内容审核模块
-- =====================================================

DROP TABLE IF EXISTS `content_review`;
CREATE TABLE `content_review` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `content_type` VARCHAR(20) NOT NULL COMMENT '内容类型：product/banner/text/image',
    `content_id` BIGINT NULL COMMENT '内容ID',
    `merchant_id` BIGINT NULL COMMENT '商户ID',

    -- 内容快照
    `content_snapshot` JSON NULL COMMENT '内容快照',
    `content_title` VARCHAR(200) NULL COMMENT '内容标题',
    `content_preview` VARCHAR(500) NULL COMMENT '内容预览',

    -- 审核状态
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0待审核 1通过 2拒绝',

    -- 审核信息
    `reviewer_id` BIGINT NULL COMMENT '审核人ID',
    `reviewer_name` VARCHAR(50) NULL COMMENT '审核人',
    `review_remark` TEXT NULL COMMENT '审核备注',
    `review_time` DATETIME NULL COMMENT '审核时间',

    -- 时间
    `submit_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',

    PRIMARY KEY (`id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_content_type` (`content_type`),
    INDEX `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容审核';

-- =====================================================
-- 6. AI问答模块
-- =====================================================

-- 知识库分类
DROP TABLE IF EXISTS `ai_knowledge_category`;
CREATE TABLE `ai_knowledge_category` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `parent_id` BIGINT NOT NULL DEFAULT 0 COMMENT '父级ID',
    `sort_order` INT NOT NULL DEFAULT 0,
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库分类';

-- 知识库文档
DROP TABLE IF EXISTS `ai_knowledge_document`;
CREATE TABLE `ai_knowledge_document` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NULL COMMENT '分类ID',
    `title` VARCHAR(200) NOT NULL COMMENT '标题',
    `content` MEDIUMTEXT NULL COMMENT '内容',

    -- 文件信息
    `file_url` VARCHAR(255) NULL COMMENT '文件URL',
    `file_type` VARCHAR(20) NULL COMMENT '文件类型',
    `file_size` BIGINT NULL COMMENT '文件大小',

    -- 版本
    `version` VARCHAR(20) NOT NULL DEFAULT '1.0' COMMENT '版本号',

    -- 向量化状态
    `vector_status` TINYINT NOT NULL DEFAULT 0 COMMENT '0未处理 1处理中 2已完成 3失败',
    `vector_id` VARCHAR(100) NULL COMMENT '向量ID',

    -- 审计
    `create_by` BIGINT NULL,
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库文档';

-- 问答对
DROP TABLE IF EXISTS `ai_qa_pair`;
CREATE TABLE `ai_qa_pair` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NULL COMMENT '分类ID',
    `question` TEXT NOT NULL COMMENT '问题',
    `answer` TEXT NOT NULL COMMENT '答案',
    `keywords` VARCHAR(500) NULL COMMENT '关键词',

    -- 统计
    `hit_count` INT NOT NULL DEFAULT 0 COMMENT '命中次数',

    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_category_id` (`category_id`),
    FULLTEXT INDEX `ft_question` (`question`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='问答对';

-- 聊天历史
DROP TABLE IF EXISTS `ai_chat_history`;
CREATE TABLE `ai_chat_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL COMMENT '用户ID',
    `session_id` VARCHAR(50) NOT NULL COMMENT '会话ID',
    `role` VARCHAR(10) NOT NULL COMMENT '角色：user/assistant',
    `content` TEXT NOT NULL COMMENT '内容',

    -- 元数据
    `tokens` INT NULL COMMENT 'Token数',
    `model` VARCHAR(50) NULL COMMENT '使用的模型',

    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_user_session` (`user_id`, `session_id`),
    INDEX `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天历史';

-- =====================================================
-- 7. 推荐系统模块
-- =====================================================

DROP TABLE IF EXISTS `referral`;
CREATE TABLE `referral` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `referrer_id` BIGINT NOT NULL COMMENT '推荐人ID',
    `referee_id` BIGINT NOT NULL COMMENT '被推荐人ID',

    -- 状态追踪
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0已注册 1首单完成 2奖励已发放',

    -- 奖励信息
    `reward_type` VARCHAR(20) NULL COMMENT '奖励类型：cash/coupon/points',
    `reward_amount` DECIMAL(10,2) NULL COMMENT '奖励金额',
    `reward_time` DATETIME NULL COMMENT '发放时间',

    -- 首单信息
    `first_order_id` BIGINT NULL COMMENT '首单ID',
    `first_order_amount` DECIMAL(10,2) NULL COMMENT '首单金额',
    `first_order_time` DATETIME NULL COMMENT '首单时间',

    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_referrer_id` (`referrer_id`),
    INDEX `idx_referee_id` (`referee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐记录';

-- 推荐奖励配置
DROP TABLE IF EXISTS `referral_reward_config`;
CREATE TABLE `referral_reward_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NULL COMMENT '配置名称',
    `reward_type` VARCHAR(20) NULL COMMENT '奖励类型',
    `reward_amount` DECIMAL(10,2) NULL COMMENT '奖励金额',
    `min_order_amount` DECIMAL(10,2) NULL COMMENT '最低订单金额',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐奖励配置';

-- =====================================================
-- 8. 修改现有表
-- =====================================================

-- 商品表增加字段
ALTER TABLE `goods_spu`
ADD COLUMN `merchant_id` BIGINT NULL COMMENT '商户ID' AFTER `id`,
ADD COLUMN `has_traceability` TINYINT NOT NULL DEFAULT 0 COMMENT '是否支持溯源',
ADD COLUMN `latest_batch_no` VARCHAR(50) NULL COMMENT '最新批次号',
ADD COLUMN `tags` JSON NULL COMMENT '标签列表',
ADD COLUMN `min_price` DECIMAL(10,2) NULL COMMENT '最低价格（阶梯定价）',
ADD INDEX `idx_merchant_id` (`merchant_id`);

-- 订单表增加字段
ALTER TABLE `order_info`
ADD COLUMN `merchant_id` BIGINT NULL COMMENT '商户ID' AFTER `user_id`,
ADD COLUMN `batch_no` VARCHAR(50) NULL COMMENT '溯源批次号',
ADD INDEX `idx_merchant_id` (`merchant_id`);

-- =====================================================
-- 9. 初始化数据 & Mock 数据
-- =====================================================

-- 插入知识库默认分类
INSERT INTO `ai_knowledge_category` (`name`, `parent_id`, `sort_order`) VALUES
('产品知识', 0, 1),
('溯源指南', 0, 2),
('常见问题', 0, 3),
('使用帮助', 0, 4);

-- 插入推荐奖励默认配置
INSERT INTO `referral_reward_config` (`name`, `reward_type`, `reward_amount`, `min_order_amount`, `status`) VALUES
('首单奖励', 'cash', 10.00, 100.00, 1);

-- =====================================================
-- Mock 数据：商户
-- =====================================================

INSERT INTO `merchant` (`id`, `user_id`, `merchant_no`, `merchant_name`, `short_name`, `logo_url`,
    `license_no`, `license_image`, `legal_person`, `legal_id_card`,
    `contact_name`, `contact_phone`, `contact_email`, `address`,
    `status`, `rating`, `review_rate`, `operating_years`, `product_count`, `order_count`, `total_sales`) VALUES
(1, 1001, 'MCH001', '白垩纪食品有限公司', '白垩纪食品', 'https://img.cretas.cn/merchant/logo_001.png',
    '91310000MA1FL5XX1X', 'https://img.cretas.cn/license/license_001.jpg', '张明远', '310101199001011234',
    '李经理', '13800138001', 'contact@cretas.cn', '上海市浦东新区张江高科技园区',
    1, 4.9, 98.50, 8, 25, 1520, 2580000.00),
(2, 1002, 'MCH002', '鲜美水产贸易公司', '鲜美水产', 'https://img.cretas.cn/merchant/logo_002.png',
    '91310000MA1FL6XX2X', 'https://img.cretas.cn/license/license_002.jpg', '王海涛', '310101198505052345',
    '陈经理', '13800138002', 'fresh@seafood.cn', '上海市宝山区国际水产城',
    1, 4.7, 96.20, 5, 18, 890, 1250000.00),
(3, 1003, 'MCH003', '绿源农产品合作社', '绿源农产', 'https://img.cretas.cn/merchant/logo_003.png',
    '91310000MA1FL7XX3X', 'https://img.cretas.cn/license/license_003.jpg', '刘建国', '310101197808083456',
    '周经理', '13800138003', 'green@farm.cn', '江苏省苏州市吴江区农业园区',
    1, 4.8, 97.80, 12, 32, 2100, 3200000.00),
(4, 1004, 'MCH004', '金牌肉类加工厂', '金牌肉类', 'https://img.cretas.cn/merchant/logo_004.png',
    '91310000MA1FL8XX4X', 'https://img.cretas.cn/license/license_004.jpg', '赵伟', '310101198012124567',
    '孙经理', '13800138004', 'gold@meat.cn', '浙江省嘉兴市秀洲区食品工业园',
    1, 4.6, 95.00, 6, 15, 650, 980000.00),
(5, 1005, 'MCH005', '新申请商户测试', '测试商户', 'https://img.cretas.cn/merchant/logo_005.png',
    '91310000MA1FL9XX5X', 'https://img.cretas.cn/license/license_005.jpg', '测试人', '310101199506065678',
    '测试经理', '13800138005', 'test@merchant.cn', '上海市测试地址',
    0, 5.0, 100.00, 0, 0, 0, 0.00);

-- 商户审核记录
INSERT INTO `merchant_review` (`merchant_id`, `reviewer_id`, `reviewer_name`, `action`, `remark`) VALUES
(1, 1, '系统管理员', 1, '资质齐全，审核通过'),
(2, 1, '系统管理员', 1, '资质齐全，审核通过'),
(3, 1, '系统管理员', 1, '资质齐全，审核通过'),
(4, 1, '系统管理员', 1, '资质齐全，审核通过');

-- 商户员工
INSERT INTO `merchant_staff` (`merchant_id`, `user_id`, `role`, `permissions`, `status`) VALUES
(1, 1001, 'owner', '["all"]', 1),
(1, 1010, 'admin', '["product","order"]', 1),
(1, 1011, 'staff', '["order"]', 1),
(2, 1002, 'owner', '["all"]', 1),
(3, 1003, 'owner', '["all"]', 1),
(4, 1004, 'owner', '["all"]', 1);

-- =====================================================
-- Mock 数据：溯源批次
-- =====================================================

INSERT INTO `traceability_batch` (`id`, `batch_no`, `product_id`, `merchant_id`, `product_name`,
    `production_date`, `expiry_date`, `quantity`, `unit`, `workshop`, `status`) VALUES
(1, 'BAT-2025-001-0105', 1, 1, '冷冻虾仁500g', '2025-01-05', '2025-07-05', 500.00, 'kg', '加工一车间', 1),
(2, 'BAT-2025-001-0108', 2, 1, '深海鳕鱼片300g', '2025-01-08', '2025-07-08', 300.00, 'kg', '加工二车间', 1),
(3, 'BAT-2025-002-0110', 3, 2, '活冻帝王蟹1kg', '2025-01-10', '2025-04-10', 200.00, 'kg', '冷链车间', 1),
(4, 'BAT-2025-003-0112', 4, 3, '有机蔬菜礼盒', '2025-01-12', '2025-01-22', 100.00, '箱', '分拣车间', 1),
(5, 'BAT-2025-004-0115', 5, 4, '精选牛排套餐', '2025-01-15', '2025-04-15', 150.00, 'kg', '切割车间', 2),
(6, 'BAT-2025-001-0118', 6, 1, '即食海参礼盒', '2025-01-18', '2025-07-18', 80.00, '盒', '精加工车间', 0);

-- =====================================================
-- Mock 数据：溯源时间线
-- =====================================================

-- 批次1的时间线（冷冻虾仁）
INSERT INTO `traceability_timeline` (`batch_id`, `stage`, `title`, `description`, `operator`, `operator_id`,
    `workshop`, `equipment`, `status`, `sort_order`, `timestamp`, `extra_data`) VALUES
(1, 'raw_material', '原料入库', '阿拉斯加野生虾到货验收', '张三', 101, '原料仓库', '电子地磅', 2, 1, '2025-01-05 08:00:00',
    '{"weight": "520kg", "temperature": "-18°C", "supplier": "阿拉斯加水产"}'),
(1, 'inspection', '原料检验', '微生物、重金属、农残检测', '李四', 102, '质检室', '检测仪器', 2, 2, '2025-01-05 09:30:00',
    '{"result": "合格", "report_no": "QC-2025-0105-001"}'),
(1, 'processing', '去壳清洗', '虾仁去壳、清洗、分级', '王五', 103, '加工一车间', '自动剥壳机', 2, 3, '2025-01-05 10:00:00',
    '{"processed_weight": "480kg", "grade": "特级"}'),
(1, 'freezing', '速冻处理', '液氮速冻，保持鲜度', '赵六', 104, '冷冻车间', '液氮速冻机', 2, 4, '2025-01-05 12:00:00',
    '{"temperature": "-40°C", "duration": "30分钟"}'),
(1, 'packaging', '真空包装', '500g规格真空包装', '钱七', 105, '包装车间', '真空包装机', 2, 5, '2025-01-05 14:00:00',
    '{"packs": 1000, "weight_per_pack": "500g"}'),
(1, 'quality_check', '成品质检', '抽检包装完整性、重量', '孙八', 106, '质检室', '称重仪', 2, 6, '2025-01-05 15:00:00',
    '{"sample_size": 50, "pass_rate": "100%"}'),
(1, 'storage', '入库存储', '成品入冷库存储', '周九', 107, '成品仓库', '货架系统', 2, 7, '2025-01-05 16:00:00',
    '{"location": "A区-1-5", "temperature": "-18°C"}');

-- 批次2的时间线（深海鳕鱼片）
INSERT INTO `traceability_timeline` (`batch_id`, `stage`, `title`, `description`, `operator`, `operator_id`,
    `workshop`, `equipment`, `status`, `sort_order`, `timestamp`, `extra_data`) VALUES
(2, 'raw_material', '原料入库', '挪威深海鳕鱼到货', '张三', 101, '原料仓库', '电子地磅', 2, 1, '2025-01-08 08:00:00',
    '{"weight": "320kg", "temperature": "-20°C"}'),
(2, 'inspection', '原料检验', '品质检测', '李四', 102, '质检室', '检测仪器', 2, 2, '2025-01-08 09:00:00',
    '{"result": "合格"}'),
(2, 'processing', '切片加工', '去骨切片', '王五', 103, '加工二车间', '切片机', 2, 3, '2025-01-08 10:00:00',
    '{"processed_weight": "280kg"}'),
(2, 'freezing', '速冻处理', '速冻保鲜', '赵六', 104, '冷冻车间', '速冻机', 2, 4, '2025-01-08 12:00:00',
    '{"temperature": "-35°C"}'),
(2, 'packaging', '包装入库', '300g包装', '钱七', 105, '包装车间', '包装机', 2, 5, '2025-01-08 14:00:00',
    '{"packs": 933}');

-- 批次5的时间线（进行中）
INSERT INTO `traceability_timeline` (`batch_id`, `stage`, `title`, `description`, `operator`, `operator_id`,
    `workshop`, `equipment`, `status`, `sort_order`, `timestamp`, `extra_data`) VALUES
(5, 'raw_material', '原料入库', '澳洲和牛入库', '张三', 101, '原料仓库', '电子地磅', 2, 1, '2025-01-15 08:00:00',
    '{"weight": "160kg", "grade": "M9"}'),
(5, 'inspection', '原料检验', '品质检测', '李四', 102, '质检室', '检测仪器', 2, 2, '2025-01-15 09:00:00',
    '{"result": "合格"}'),
(5, 'processing', '分切处理', '分切牛排', '王五', 103, '切割车间', '分切设备', 1, 3, '2025-01-15 10:00:00',
    '{"status": "进行中"}'),
(5, 'packaging', '待包装', '等待包装', NULL, NULL, '包装车间', NULL, 0, 4, NULL, NULL);

-- =====================================================
-- Mock 数据：原料信息
-- =====================================================

INSERT INTO `traceability_raw_material` (`batch_id`, `material_name`, `supplier`, `supplier_id`, `origin`,
    `material_batch_no`, `production_date`, `expiry_date`, `quantity`, `unit`, `verified`, `verify_time`) VALUES
(1, '阿拉斯加野生白虾', '阿拉斯加水产有限公司', 201, '美国阿拉斯加', 'AK-2025-0101', '2025-01-01', '2025-06-30', 520.00, 'kg', 1, '2025-01-05 08:30:00'),
(2, '挪威深海鳕鱼', '北欧水产集团', 202, '挪威', 'NO-2025-0105', '2025-01-05', '2025-06-30', 320.00, 'kg', 1, '2025-01-08 08:30:00'),
(3, '俄罗斯帝王蟹', '远东海鲜贸易', 203, '俄罗斯', 'RU-2025-0108', '2025-01-08', '2025-03-08', 210.00, 'kg', 1, '2025-01-10 08:30:00'),
(4, '有机时蔬', '绿源农场', 204, '江苏苏州', 'GF-2025-0110', '2025-01-10', '2025-01-20', 120.00, 'kg', 1, '2025-01-12 08:00:00'),
(4, '有机番茄', '绿源农场', 204, '江苏苏州', 'GF-2025-0111', '2025-01-11', '2025-01-21', 80.00, 'kg', 1, '2025-01-12 08:00:00'),
(5, '澳洲M9和牛', '澳洲牧业集团', 205, '澳大利亚', 'AU-2025-0112', '2025-01-12', '2025-04-12', 160.00, 'kg', 1, '2025-01-15 08:30:00');

-- =====================================================
-- Mock 数据：质检报告
-- =====================================================

INSERT INTO `traceability_quality_report` (`batch_id`, `stage`, `result`, `inspector`, `inspector_id`,
    `inspection_time`, `test_items`, `certificate_image`, `report_file`) VALUES
(1, 'raw_material', 'pass', '李四', 102, '2025-01-05 09:30:00',
    '{"微生物检测": "阴性", "重金属检测": "未检出", "农药残留": "未检出", "新鲜度": "优"}',
    'https://img.cretas.cn/cert/cert_001.jpg', 'https://img.cretas.cn/report/QC-2025-0105-001.pdf'),
(1, 'finished', 'pass', '孙八', 106, '2025-01-05 15:00:00',
    '{"包装完整性": "合格", "净含量": "合格", "标签规范": "合格", "感官评定": "优"}',
    'https://img.cretas.cn/cert/cert_002.jpg', 'https://img.cretas.cn/report/QC-2025-0105-002.pdf'),
(2, 'raw_material', 'pass', '李四', 102, '2025-01-08 09:00:00',
    '{"微生物检测": "阴性", "重金属检测": "未检出", "寄生虫检测": "未检出"}',
    'https://img.cretas.cn/cert/cert_003.jpg', NULL),
(2, 'finished', 'pass', '孙八', 106, '2025-01-08 15:00:00',
    '{"包装完整性": "合格", "净含量": "合格", "冷链温度": "-18°C"}',
    NULL, 'https://img.cretas.cn/report/QC-2025-0108-001.pdf'),
(3, 'raw_material', 'pass', '李四', 102, '2025-01-10 09:00:00',
    '{"活力检测": "优", "重金属检测": "未检出", "外观检查": "完整"}',
    'https://img.cretas.cn/cert/cert_004.jpg', NULL),
(4, 'raw_material', 'pass', '李四', 102, '2025-01-12 08:30:00',
    '{"农药残留": "未检出", "新鲜度": "优", "有机认证": "通过"}',
    'https://img.cretas.cn/cert/organic_001.jpg', NULL),
(5, 'raw_material', 'pass', '李四', 102, '2025-01-15 09:00:00',
    '{"瘦肉精检测": "未检出", "等级鉴定": "M9", "色泽": "优"}',
    'https://img.cretas.cn/cert/cert_005.jpg', NULL);

-- =====================================================
-- Mock 数据：现场证据
-- =====================================================

INSERT INTO `traceability_evidence` (`batch_id`, `type`, `title`, `description`, `url`, `thumbnail_url`, `sort_order`) VALUES
(1, 'photo', '原料验收', '阿拉斯加野生虾到货验收现场', 'https://img.cretas.cn/evidence/bat1_01.jpg', 'https://img.cretas.cn/evidence/bat1_01_thumb.jpg', 1),
(1, 'photo', '加工车间', '虾仁加工现场实拍', 'https://img.cretas.cn/evidence/bat1_02.jpg', 'https://img.cretas.cn/evidence/bat1_02_thumb.jpg', 2),
(1, 'photo', '速冻过程', '液氮速冻设备运行', 'https://img.cretas.cn/evidence/bat1_03.jpg', 'https://img.cretas.cn/evidence/bat1_03_thumb.jpg', 3),
(1, 'video', '生产过程', '完整生产流程视频记录', 'https://video.cretas.cn/evidence/bat1_video.mp4', 'https://img.cretas.cn/evidence/bat1_video_thumb.jpg', 4),
(2, 'photo', '鳕鱼原料', '挪威深海鳕鱼验收', 'https://img.cretas.cn/evidence/bat2_01.jpg', 'https://img.cretas.cn/evidence/bat2_01_thumb.jpg', 1),
(2, 'photo', '切片加工', '鳕鱼切片加工现场', 'https://img.cretas.cn/evidence/bat2_02.jpg', 'https://img.cretas.cn/evidence/bat2_02_thumb.jpg', 2),
(3, 'photo', '帝王蟹', '活冻帝王蟹验收', 'https://img.cretas.cn/evidence/bat3_01.jpg', 'https://img.cretas.cn/evidence/bat3_01_thumb.jpg', 1),
(4, 'photo', '有机蔬菜', '有机蔬菜分拣现场', 'https://img.cretas.cn/evidence/bat4_01.jpg', 'https://img.cretas.cn/evidence/bat4_01_thumb.jpg', 1);

-- =====================================================
-- Mock 数据：阶梯定价
-- =====================================================

-- 商品1：冷冻虾仁500g
INSERT INTO `goods_price_tier` (`spu_id`, `min_quantity`, `max_quantity`, `price`, `discount_rate`, `sort_order`) VALUES
(1, 1, 9, 85.00, NULL, 1),
(1, 10, 49, 75.00, 11.76, 2),
(1, 50, 99, 65.00, 23.53, 3),
(1, 100, NULL, 58.00, 31.76, 4);

-- 商品2：深海鳕鱼片300g
INSERT INTO `goods_price_tier` (`spu_id`, `min_quantity`, `max_quantity`, `price`, `discount_rate`, `sort_order`) VALUES
(2, 1, 9, 128.00, NULL, 1),
(2, 10, 29, 115.00, 10.16, 2),
(2, 30, 99, 98.00, 23.44, 3),
(2, 100, NULL, 88.00, 31.25, 4);

-- 商品3：活冻帝王蟹1kg
INSERT INTO `goods_price_tier` (`spu_id`, `min_quantity`, `max_quantity`, `price`, `discount_rate`, `sort_order`) VALUES
(3, 1, 4, 688.00, NULL, 1),
(3, 5, 9, 628.00, 8.72, 2),
(3, 10, NULL, 568.00, 17.44, 3);

-- 商品4：有机蔬菜礼盒
INSERT INTO `goods_price_tier` (`spu_id`, `min_quantity`, `max_quantity`, `price`, `discount_rate`, `sort_order`) VALUES
(4, 1, 9, 168.00, NULL, 1),
(4, 10, 29, 148.00, 11.90, 2),
(4, 30, NULL, 128.00, 23.81, 3);

-- 商品5：精选牛排套餐
INSERT INTO `goods_price_tier` (`spu_id`, `min_quantity`, `max_quantity`, `price`, `discount_rate`, `sort_order`) VALUES
(5, 1, 4, 398.00, NULL, 1),
(5, 5, 9, 358.00, 10.05, 2),
(5, 10, 19, 318.00, 20.10, 3),
(5, 20, NULL, 288.00, 27.64, 4);

-- =====================================================
-- Mock 数据：广告
-- =====================================================

INSERT INTO `advertisement` (`type`, `title`, `description`, `image_url`, `link_type`, `link_value`,
    `position`, `start_time`, `end_time`, `status`, `view_count`, `click_count`) VALUES
('splash_ad', '新春大促', '新春佳节，全场8折起', 'https://img.cretas.cn/ad/splash_spring.jpg', 'url', '/pages/activity/spring',
    1, '2025-01-01 00:00:00', '2025-02-28 23:59:59', 1, 15680, 1250),
('home_banner', '冷冻虾仁特惠', '阿拉斯加野生虾仁，限时7折', 'https://img.cretas.cn/ad/banner_shrimp.jpg', 'product', '1',
    1, '2025-01-01 00:00:00', '2025-01-31 23:59:59', 1, 8520, 620),
('home_banner', '深海鳕鱼新品', '挪威深海鳕鱼片，新鲜上市', 'https://img.cretas.cn/ad/banner_cod.jpg', 'product', '2',
    2, '2025-01-01 00:00:00', '2025-01-31 23:59:59', 1, 6840, 480),
('home_banner', '有机蔬菜礼盒', '绿色有机，健康首选', 'https://img.cretas.cn/ad/banner_veg.jpg', 'product', '4',
    3, '2025-01-01 00:00:00', '2025-01-31 23:59:59', 1, 5200, 320),
('detail_bottom', '满500减50', '满额立减，优惠多多', 'https://img.cretas.cn/ad/detail_coupon.jpg', 'url', '/pages/coupon/list',
    1, '2025-01-01 00:00:00', '2025-03-31 23:59:59', 1, 12000, 890);

-- =====================================================
-- Mock 数据：内容审核
-- =====================================================

INSERT INTO `content_review` (`content_type`, `content_id`, `merchant_id`, `content_title`, `content_preview`,
    `status`, `reviewer_id`, `reviewer_name`, `review_remark`, `review_time`, `submit_time`) VALUES
('product', 6, 1, '即食海参礼盒', '大连即食海参，开袋即食...', 0, NULL, NULL, NULL, NULL, '2025-01-18 10:00:00'),
('product', 7, 2, '挪威三文鱼刺身', '新鲜三文鱼，适合刺身...', 0, NULL, NULL, NULL, NULL, '2025-01-18 11:00:00'),
('banner', 5, 3, '春节礼盒推广', 'Banner广告素材待审核', 0, NULL, NULL, NULL, NULL, '2025-01-18 12:00:00'),
('product', 8, 4, '和牛肉卷套餐', '日式火锅和牛肉卷...', 1, 1, '系统管理员', '审核通过', '2025-01-17 15:00:00', '2025-01-17 10:00:00'),
('text', 1, 1, '商户介绍更新', '白垩纪食品专注于高端海鲜...', 2, 1, '系统管理员', '内容涉及夸大宣传，请修改', '2025-01-16 16:00:00', '2025-01-16 10:00:00');

-- =====================================================
-- Mock 数据：AI知识库
-- =====================================================

INSERT INTO `ai_knowledge_document` (`category_id`, `title`, `content`, `file_type`, `version`, `vector_status`) VALUES
(1, '冷冻虾仁产品介绍', '阿拉斯加野生虾仁是我们的明星产品，采用先进的液氮速冻技术...', 'text', '1.0', 2),
(1, '深海鳕鱼产品介绍', '挪威深海鳕鱼片来自北大西洋纯净海域...', 'text', '1.0', 2),
(2, '如何使用溯源功能', '扫描产品包装上的二维码或在小程序中输入批次号即可查询...', 'text', '1.0', 2),
(2, '溯源信息说明', '溯源信息包含原料来源、生产加工、质量检测等全流程记录...', 'text', '1.0', 2),
(3, '如何下单', '选择商品，添加到购物车，填写收货地址，选择支付方式即可完成下单...', 'text', '1.0', 2),
(3, '配送时效', '一般情况下，冷链配送1-3天送达，具体以物流信息为准...', 'text', '1.0', 2),
(4, '账户注册', '点击"我的"页面，选择微信授权登录即可完成注册...', 'text', '1.0', 2);

-- AI问答对
INSERT INTO `ai_qa_pair` (`category_id`, `question`, `answer`, `keywords`, `hit_count`) VALUES
(3, '如何查询订单状态', '您可以在"我的订单"页面查看订单状态，点击订单详情可以查看物流信息。', '订单,查询,状态,物流', 156),
(3, '支持哪些支付方式', '目前支持微信支付、支付宝支付和银行卡支付。企业客户还可以选择对公转账。', '支付,微信,支付宝,银行卡', 89),
(3, '如何申请退款', '在订单详情页点击"申请退款"，填写退款原因后提交，客服会在24小时内处理。', '退款,退货,售后', 67),
(2, '溯源信息是真实的吗', '所有溯源信息均由生产企业实时上传，并经过平台审核，确保真实可靠。', '溯源,真实,可靠,认证', 45),
(1, '冷冻虾仁如何解冻', '建议放入冰箱冷藏室自然解冻，约4-6小时。不建议直接用热水解冻，会影响口感。', '解冻,虾仁,方法', 234),
(1, '产品保质期多久', '冷冻海鲜产品在-18°C以下保存，保质期一般为6个月。具体请查看包装上的生产日期。', '保质期,保存,冷冻', 178);

-- AI聊天历史示例
INSERT INTO `ai_chat_history` (`user_id`, `session_id`, `role`, `content`, `tokens`, `model`) VALUES
(1001, 'session_001', 'user', '冷冻虾仁怎么解冻比较好？', 15, 'qwen-plus'),
(1001, 'session_001', 'assistant', '您好！冷冻虾仁的解冻方法有以下几种推荐：\n\n1. **冷藏解冻（推荐）**：将虾仁放入冰箱冷藏室，自然解冻约4-6小时，这种方式最能保持虾仁的鲜度和口感。\n\n2. **流水解冻**：将虾仁放在密封袋中，用流动的冷水冲洗，约20-30分钟即可解冻。\n\n3. **盐水解冻**：将虾仁放入淡盐水中，可以加快解冻速度并保持鲜味。\n\n**注意**：不建议使用热水或微波炉解冻，会导致虾仁外层过熟而内部仍冻结，影响口感。', 180, 'qwen-plus'),
(1001, 'session_001', 'user', '解冻后可以保存多久？', 10, 'qwen-plus'),
(1001, 'session_001', 'assistant', '解冻后的虾仁建议尽快烹饪食用，最佳食用时间为**24小时内**。\n\n如果暂时不烹饪，可以：\n- 放入冰箱冷藏保存，最多2天\n- 不建议重新冷冻，会严重影响口感和营养\n\n小贴士：建议按需解冻，吃多少解冻多少哦！', 95, 'qwen-plus');

-- =====================================================
-- Mock 数据：推荐
-- =====================================================

INSERT INTO `referral` (`referrer_id`, `referee_id`, `status`, `reward_type`, `reward_amount`, `reward_time`,
    `first_order_id`, `first_order_amount`, `first_order_time`) VALUES
(1001, 1010, 2, 'cash', 10.00, '2025-01-10 12:00:00', 1001, 358.00, '2025-01-08 15:30:00'),
(1001, 1011, 2, 'cash', 10.00, '2025-01-12 10:00:00', 1005, 520.00, '2025-01-10 16:20:00'),
(1001, 1012, 1, NULL, NULL, NULL, 1008, 168.00, '2025-01-15 14:00:00'),
(1002, 1013, 0, NULL, NULL, NULL, NULL, NULL, NULL),
(1003, 1014, 0, NULL, NULL, NULL, NULL, NULL, NULL);

-- =====================================================
-- 更新商品表字段（如果商品表已有数据）
-- =====================================================

-- 假设已有商品数据，更新关联字段
UPDATE `goods_spu` SET `merchant_id` = 1, `has_traceability` = 1, `latest_batch_no` = 'BAT-2025-001-0105',
    `tags` = '["可溯源", "热销"]', `min_price` = 58.00 WHERE `id` = 1;
UPDATE `goods_spu` SET `merchant_id` = 1, `has_traceability` = 1, `latest_batch_no` = 'BAT-2025-001-0108',
    `tags` = '["可溯源", "新品"]', `min_price` = 88.00 WHERE `id` = 2;
UPDATE `goods_spu` SET `merchant_id` = 2, `has_traceability` = 1, `latest_batch_no` = 'BAT-2025-002-0110',
    `tags` = '["可溯源", "限量"]', `min_price` = 568.00 WHERE `id` = 3;
UPDATE `goods_spu` SET `merchant_id` = 3, `has_traceability` = 1, `latest_batch_no` = 'BAT-2025-003-0112',
    `tags` = '["有机认证", "健康"]', `min_price` = 128.00 WHERE `id` = 4;
UPDATE `goods_spu` SET `merchant_id` = 4, `has_traceability` = 1, `latest_batch_no` = 'BAT-2025-004-0115',
    `tags` = '["可溯源", "精选"]', `min_price` = 288.00 WHERE `id` = 5;

SET FOREIGN_KEY_CHECKS = 1;

-- 迁移完成
SELECT '迁移完成: V2.0 溯源系统和商户管理模块（含Mock数据）' AS message;
