-- ========================================
-- MallCenter V3.0 数据库迁移脚本
-- 商城装修系统
-- ========================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ========================================
-- 1. 装修模板表
-- ========================================

DROP TABLE IF EXISTS `decoration_template`;
CREATE TABLE `decoration_template` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '模板ID',
    `name` VARCHAR(100) NOT NULL COMMENT '模板名称',
    `code` VARCHAR(50) NOT NULL COMMENT '模板编码',
    `description` VARCHAR(500) DEFAULT NULL COMMENT '模板描述',
    `thumbnail` VARCHAR(500) DEFAULT NULL COMMENT '缩略图URL',
    `preview_url` VARCHAR(500) DEFAULT NULL COMMENT '预览URL',

    -- 风格分类
    `style_type` VARCHAR(50) NOT NULL COMMENT '风格类型：fresh/luxury/simple/dopamine',
    `industry_type` VARCHAR(50) DEFAULT NULL COMMENT '行业类型：food/retail/beauty',

    -- 配置数据
    `theme_config` JSON DEFAULT NULL COMMENT '主题配置（颜色、字体等）',
    `modules_config` JSON DEFAULT NULL COMMENT '模块配置（页面布局）',

    -- 状态与统计
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0停用 1启用',
    `is_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认模板：0否 1是',
    `use_count` INT NOT NULL DEFAULT 0 COMMENT '使用次数',

    -- 审计字段
    `create_by` BIGINT DEFAULT NULL COMMENT '创建人ID',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`),
    KEY `idx_style_type` (`style_type`),
    KEY `idx_industry_type` (`industry_type`),
    KEY `idx_status` (`status`),
    KEY `idx_is_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='装修模板表';

-- ========================================
-- 2. 页面模块定义表
-- ========================================

DROP TABLE IF EXISTS `decoration_module`;
CREATE TABLE `decoration_module` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '模块ID',
    `name` VARCHAR(100) NOT NULL COMMENT '模块名称',
    `code` VARCHAR(50) NOT NULL COMMENT '模块编码',
    `module_type` VARCHAR(50) NOT NULL COMMENT '模块类型：header/navigation/content/footer',

    -- 组件配置
    `component_name` VARCHAR(100) DEFAULT NULL COMMENT '组件名称（前端组件）',
    `wxml_template` TEXT DEFAULT NULL COMMENT 'WXML模板',
    `wxss_template` TEXT DEFAULT NULL COMMENT 'WXSS样式模板',

    -- 参数定义
    `params_schema` JSON DEFAULT NULL COMMENT '参数JSON Schema定义',
    `default_params` JSON DEFAULT NULL COMMENT '默认参数值',

    -- 数据源配置
    `data_source_type` VARCHAR(50) DEFAULT NULL COMMENT '数据源类型：static/api/dynamic',
    `data_source_api` VARCHAR(255) DEFAULT NULL COMMENT '数据源API路径',

    -- 状态与排序
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0停用 1启用',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值',

    -- 审计字段
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`),
    KEY `idx_module_type` (`module_type`),
    KEY `idx_status` (`status`),
    KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='页面模块定义表';

-- ========================================
-- 3. 主题预设表
-- ========================================

DROP TABLE IF EXISTS `decoration_theme_preset`;
CREATE TABLE `decoration_theme_preset` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主题ID',
    `name` VARCHAR(100) NOT NULL COMMENT '主题名称',
    `code` VARCHAR(50) NOT NULL COMMENT '主题编码',
    `description` VARCHAR(500) DEFAULT NULL COMMENT '主题描述',
    `preview_image` VARCHAR(500) DEFAULT NULL COMMENT '预览图URL',

    -- 配色配置
    `color_config` JSON NOT NULL COMMENT '配色配置JSON',

    -- 标签分类
    `style_tags` VARCHAR(255) DEFAULT NULL COMMENT '风格标签（逗号分隔）',
    `industry_tags` VARCHAR(255) DEFAULT NULL COMMENT '行业标签（逗号分隔）',

    -- 状态与统计
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0停用 1启用',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值',
    `use_count` INT NOT NULL DEFAULT 0 COMMENT '使用次数',

    -- 审计字段
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`),
    KEY `idx_status` (`status`),
    KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主题预设表';

-- ========================================
-- 4. 商户页面配置表
-- ========================================

DROP TABLE IF EXISTS `merchant_page_config`;
CREATE TABLE `merchant_page_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `merchant_id` BIGINT NOT NULL COMMENT '商户ID',
    `page_type` VARCHAR(50) NOT NULL COMMENT '页面类型：home/category/detail/cart',

    -- 配置数据
    `template_id` BIGINT DEFAULT NULL COMMENT '使用的模板ID',
    `theme_config` JSON DEFAULT NULL COMMENT '主题配置（覆盖模板配置）',
    `modules_config` JSON DEFAULT NULL COMMENT '模块配置（页面布局）',

    -- 状态
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0草稿 1已发布',
    `published_at` DATETIME DEFAULT NULL COMMENT '发布时间',

    -- AI生成标记
    `ai_generated` TINYINT NOT NULL DEFAULT 0 COMMENT '是否AI生成：0否 1是',
    `ai_prompt` TEXT DEFAULT NULL COMMENT 'AI生成时使用的提示词',

    -- 审计字段
    `create_by` BIGINT DEFAULT NULL COMMENT '创建人ID',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_merchant_page` (`merchant_id`, `page_type`),
    KEY `idx_merchant_id` (`merchant_id`),
    KEY `idx_template_id` (`template_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户页面配置表';

-- ========================================
-- 5. AI装修会话表
-- ========================================

DROP TABLE IF EXISTS `ai_decoration_session`;
CREATE TABLE `ai_decoration_session` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `session_id` VARCHAR(64) NOT NULL COMMENT '会话唯一标识',
    `merchant_id` BIGINT NOT NULL COMMENT '商户ID',
    `user_id` BIGINT NOT NULL COMMENT '操作用户ID',

    -- 会话内容
    `user_prompt` TEXT NOT NULL COMMENT '用户输入的提示词',
    `ai_analysis` JSON DEFAULT NULL COMMENT 'AI分析结果',
    `generated_config` JSON DEFAULT NULL COMMENT 'AI生成的配置',

    -- 反馈评价
    `feedback_score` TINYINT DEFAULT NULL COMMENT '评分：1-5',
    `feedback_comment` VARCHAR(500) DEFAULT NULL COMMENT '反馈评论',

    -- 状态
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0处理中 1已完成 2失败 3已应用',

    -- 审计字段
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_session_id` (`session_id`),
    KEY `idx_merchant_id` (`merchant_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI装修会话表';

-- ========================================
-- 6. 预置数据：主题预设
-- ========================================

INSERT INTO `decoration_theme_preset` (`name`, `code`, `description`, `preview_image`, `color_config`, `style_tags`, `industry_tags`, `status`, `sort_order`, `use_count`) VALUES
(
    '清新绿',
    'fresh_green',
    '清新自然的绿色主题，适合生鲜、有机食品类商城',
    'https://img.cretas.cn/themes/fresh_green_preview.jpg',
    '{
        "primaryColor": "#52c41a",
        "secondaryColor": "#73d13d",
        "backgroundColor": "#f6ffed",
        "textColor": "#262626",
        "textSecondary": "#8c8c8c",
        "borderColor": "#b7eb8f",
        "successColor": "#52c41a",
        "warningColor": "#faad14",
        "errorColor": "#ff4d4f",
        "gradientStart": "#95de64",
        "gradientEnd": "#52c41a"
    }',
    'fresh,natural,green',
    'food,organic,grocery',
    1,
    1,
    0
),
(
    '经典金',
    'classic_gold',
    '高端奢华的金色主题，适合高端品牌、礼品类商城',
    'https://img.cretas.cn/themes/classic_gold_preview.jpg',
    '{
        "primaryColor": "#d4af37",
        "secondaryColor": "#f5d76e",
        "backgroundColor": "#fffef5",
        "textColor": "#1a1a1a",
        "textSecondary": "#666666",
        "borderColor": "#e8d5a3",
        "successColor": "#52c41a",
        "warningColor": "#faad14",
        "errorColor": "#ff4d4f",
        "gradientStart": "#f5d76e",
        "gradientEnd": "#d4af37"
    }',
    'luxury,classic,premium',
    'gift,jewelry,cosmetics',
    1,
    2,
    0
),
(
    '极简白',
    'minimal_white',
    '简约现代的白色主题，适合科技、数码类商城',
    'https://img.cretas.cn/themes/minimal_white_preview.jpg',
    '{
        "primaryColor": "#1890ff",
        "secondaryColor": "#40a9ff",
        "backgroundColor": "#ffffff",
        "textColor": "#262626",
        "textSecondary": "#8c8c8c",
        "borderColor": "#f0f0f0",
        "successColor": "#52c41a",
        "warningColor": "#faad14",
        "errorColor": "#ff4d4f",
        "gradientStart": "#69c0ff",
        "gradientEnd": "#1890ff"
    }',
    'simple,modern,minimal',
    'tech,digital,lifestyle',
    1,
    3,
    0
),
(
    '多巴胺橙',
    'dopamine_orange',
    '活力四射的橙色主题，适合年轻时尚、快消品类商城',
    'https://img.cretas.cn/themes/dopamine_orange_preview.jpg',
    '{
        "primaryColor": "#fa8c16",
        "secondaryColor": "#ffc069",
        "backgroundColor": "#fff7e6",
        "textColor": "#262626",
        "textSecondary": "#8c8c8c",
        "borderColor": "#ffd591",
        "successColor": "#52c41a",
        "warningColor": "#faad14",
        "errorColor": "#ff4d4f",
        "gradientStart": "#ffc069",
        "gradientEnd": "#fa8c16"
    }',
    'dopamine,vibrant,youthful',
    'fashion,snack,beverage',
    1,
    4,
    0
);

-- ========================================
-- 7. 预置数据：模块定义
-- ========================================

INSERT INTO `decoration_module` (`name`, `code`, `module_type`, `component_name`, `params_schema`, `default_params`, `data_source_type`, `data_source_api`, `status`, `sort_order`) VALUES
(
    '顶部导航栏',
    'header_bar',
    'header',
    'HeaderBar',
    '{
        "type": "object",
        "properties": {
            "showLogo": {"type": "boolean", "title": "显示Logo"},
            "showSearch": {"type": "boolean", "title": "显示搜索框"},
            "showCart": {"type": "boolean", "title": "显示购物车"},
            "backgroundColor": {"type": "string", "title": "背景色"},
            "textColor": {"type": "string", "title": "文字颜色"}
        }
    }',
    '{
        "showLogo": true,
        "showSearch": true,
        "showCart": true,
        "backgroundColor": "#ffffff",
        "textColor": "#333333"
    }',
    'static',
    NULL,
    1,
    1
),
(
    '公告通知栏',
    'notice_bar',
    'header',
    'NoticeBar',
    '{
        "type": "object",
        "properties": {
            "speed": {"type": "number", "title": "滚动速度"},
            "backgroundColor": {"type": "string", "title": "背景色"},
            "textColor": {"type": "string", "title": "文字颜色"},
            "icon": {"type": "string", "title": "图标"}
        }
    }',
    '{
        "speed": 60,
        "backgroundColor": "#fffbe6",
        "textColor": "#faad14",
        "icon": "notice"
    }',
    'api',
    '/api/mall/notice/latest',
    1,
    2
),
(
    '分类宫格',
    'category_grid',
    'navigation',
    'CategoryGrid',
    '{
        "type": "object",
        "properties": {
            "columns": {"type": "number", "title": "列数", "minimum": 3, "maximum": 5},
            "rows": {"type": "number", "title": "行数", "minimum": 1, "maximum": 3},
            "showMore": {"type": "boolean", "title": "显示更多按钮"},
            "iconSize": {"type": "number", "title": "图标尺寸"}
        }
    }',
    '{
        "columns": 5,
        "rows": 2,
        "showMore": true,
        "iconSize": 48
    }',
    'api',
    '/api/mall/category/list',
    1,
    3
),
(
    '轮播Banner',
    'banner_swiper',
    'content',
    'BannerSwiper',
    '{
        "type": "object",
        "properties": {
            "autoplay": {"type": "boolean", "title": "自动播放"},
            "interval": {"type": "number", "title": "切换间隔(ms)"},
            "indicatorDots": {"type": "boolean", "title": "显示指示点"},
            "indicatorColor": {"type": "string", "title": "指示点颜色"},
            "indicatorActiveColor": {"type": "string", "title": "当前指示点颜色"},
            "borderRadius": {"type": "number", "title": "圆角"}
        }
    }',
    '{
        "autoplay": true,
        "interval": 3000,
        "indicatorDots": true,
        "indicatorColor": "rgba(255,255,255,0.5)",
        "indicatorActiveColor": "#ffffff",
        "borderRadius": 8
    }',
    'api',
    '/api/mall/banner/list',
    1,
    4
),
(
    '快捷操作',
    'quick_actions',
    'navigation',
    'QuickActions',
    '{
        "type": "object",
        "properties": {
            "layout": {"type": "string", "title": "布局方式", "enum": ["grid", "scroll"]},
            "columns": {"type": "number", "title": "列数"},
            "iconStyle": {"type": "string", "title": "图标样式", "enum": ["circle", "square", "none"]}
        }
    }',
    '{
        "layout": "grid",
        "columns": 4,
        "iconStyle": "circle"
    }',
    'static',
    NULL,
    1,
    5
),
(
    '热销商品横滑',
    'goods_hot_scroll',
    'content',
    'GoodsHotScroll',
    '{
        "type": "object",
        "properties": {
            "title": {"type": "string", "title": "标题"},
            "showMore": {"type": "boolean", "title": "显示更多"},
            "cardWidth": {"type": "number", "title": "卡片宽度"},
            "limit": {"type": "number", "title": "显示数量"}
        }
    }',
    '{
        "title": "热销爆款",
        "showMore": true,
        "cardWidth": 140,
        "limit": 10
    }',
    'api',
    '/api/mall/goods/hot',
    1,
    6
),
(
    '推荐商品宫格',
    'goods_recommend_grid',
    'content',
    'GoodsRecommendGrid',
    '{
        "type": "object",
        "properties": {
            "title": {"type": "string", "title": "标题"},
            "columns": {"type": "number", "title": "列数"},
            "limit": {"type": "number", "title": "显示数量"},
            "showTag": {"type": "boolean", "title": "显示标签"}
        }
    }',
    '{
        "title": "为你推荐",
        "columns": 2,
        "limit": 6,
        "showTag": true
    }',
    'api',
    '/api/mall/goods/recommend',
    1,
    7
),
(
    '商品瀑布流',
    'goods_waterfall',
    'content',
    'GoodsWaterfall',
    '{
        "type": "object",
        "properties": {
            "columns": {"type": "number", "title": "列数"},
            "gap": {"type": "number", "title": "间距"},
            "loadMore": {"type": "boolean", "title": "加载更多"},
            "pageSize": {"type": "number", "title": "每页数量"}
        }
    }',
    '{
        "columns": 2,
        "gap": 10,
        "loadMore": true,
        "pageSize": 20
    }',
    'api',
    '/api/mall/goods/list',
    1,
    8
);

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 迁移完成
-- ========================================
SELECT 'V3.0 Migration completed: Decoration System tables created!' AS status;
