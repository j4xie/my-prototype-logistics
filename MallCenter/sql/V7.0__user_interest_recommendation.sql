-- ==========================================================
-- V7.0 用户兴趣推荐系统数据库表
-- 实现类抖音的兴趣电商推荐机制
-- 创建日期: 2025-12-27
-- ==========================================================

-- 1. 用户行为事件表 (记录所有用户行为)
CREATE TABLE IF NOT EXISTS user_behavior_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    wx_user_id VARCHAR(64) NOT NULL COMMENT '微信用户ID (小程序openid)',
    event_type VARCHAR(32) NOT NULL COMMENT '事件类型: view/click/search/cart_add/cart_remove/purchase/favorite/share',
    event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '事件发生时间',

    -- 事件目标信息
    target_type VARCHAR(32) NOT NULL COMMENT '目标类型: product/category/merchant/search',
    target_id VARCHAR(64) COMMENT '目标ID (商品ID/商家ID等)',
    target_name VARCHAR(256) COMMENT '目标名称 (用于快速查询)',

    -- 事件详情 (JSON格式)
    event_data JSON COMMENT '事件详情数据',
    -- 示例: {"duration": 30, "scroll_depth": 0.8} (浏览时长、滚动深度)
    -- 示例: {"search_keyword": "牛肉", "result_count": 20} (搜索关键词、结果数)
    -- 示例: {"quantity": 2, "sku_id": "xxx"} (加购数量、SKU)

    -- 上下文信息
    session_id VARCHAR(64) COMMENT '会话ID (用于追踪单次访问)',
    device_type VARCHAR(32) COMMENT '设备类型: ios/android/devtools',
    ip_address VARCHAR(64) COMMENT 'IP地址',

    -- 来源追踪
    source_type VARCHAR(32) COMMENT '来源类型: home/search/category/recommend/share',
    source_id VARCHAR(64) COMMENT '来源ID (分享者ID、推荐位ID等)',

    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_wx_user_id (wx_user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_time (event_time),
    INDEX idx_target_type_id (target_type, target_id),
    INDEX idx_session_id (session_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户行为事件表';

-- 2. 用户兴趣标签表 (AI分析后的用户兴趣)
CREATE TABLE IF NOT EXISTS user_interest_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    wx_user_id VARCHAR(64) NOT NULL COMMENT '微信用户ID',

    -- 标签信息
    tag_type VARCHAR(32) NOT NULL COMMENT '标签类型: category/brand/price_range/feature/keyword',
    tag_value VARCHAR(128) NOT NULL COMMENT '标签值 (如: 肉类、进口、高端)',
    tag_level INT DEFAULT 1 COMMENT '标签层级 (一级/二级/三级分类)',

    -- 权重与置信度
    weight DECIMAL(5,4) NOT NULL DEFAULT 0.5000 COMMENT '兴趣权重 (0.0001-1.0000)',
    confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5000 COMMENT 'AI分析置信度 (0.0001-1.0000)',

    -- 来源与更新
    source VARCHAR(32) NOT NULL DEFAULT 'behavior' COMMENT '来源: behavior/ai_analysis/manual',
    interaction_count INT DEFAULT 1 COMMENT '相关行为次数',
    last_interaction_time DATETIME COMMENT '最后交互时间',

    -- 衰减计算
    decay_factor DECIMAL(5,4) DEFAULT 1.0000 COMMENT '时间衰减因子',
    effective_weight DECIMAL(5,4) GENERATED ALWAYS AS (weight * decay_factor) STORED COMMENT '有效权重=权重*衰减',

    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY uk_user_tag (wx_user_id, tag_type, tag_value),
    INDEX idx_wx_user_id (wx_user_id),
    INDEX idx_tag_type (tag_type),
    INDEX idx_effective_weight (effective_weight DESC),
    INDEX idx_update_time (update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户兴趣标签表';

-- 3. 用户推荐画像表 (聚合的用户画像，用于快速推荐)
CREATE TABLE IF NOT EXISTS user_recommendation_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    wx_user_id VARCHAR(64) NOT NULL UNIQUE COMMENT '微信用户ID',

    -- 用户状态
    profile_status VARCHAR(32) DEFAULT 'cold_start' COMMENT '画像状态: cold_start/warming/mature/inactive',
    behavior_count INT DEFAULT 0 COMMENT '总行为数',
    purchase_count INT DEFAULT 0 COMMENT '购买次数',

    -- 偏好汇总 (JSON格式，定期从interest_tags聚合)
    category_preferences JSON COMMENT '品类偏好: {"肉类": 0.8, "海鲜": 0.6}',
    price_preferences JSON COMMENT '价格偏好: {"range": "medium", "avg": 150, "max": 500}',
    brand_preferences JSON COMMENT '品牌偏好: {"科尔沁": 0.9, "恒都": 0.7}',
    feature_preferences JSON COMMENT '特性偏好: {"organic": 0.8, "imported": 0.5}',

    -- 行为模式
    active_hours JSON COMMENT '活跃时段: {"morning": 0.3, "afternoon": 0.5, "evening": 0.7}',
    browse_pattern JSON COMMENT '浏览模式: {"avg_duration": 30, "avg_products": 5}',
    purchase_pattern JSON COMMENT '购买模式: {"frequency": "weekly", "avg_amount": 300}',

    -- 推荐相关
    last_recommendation_time DATETIME COMMENT '最后推荐时间',
    recommendation_click_rate DECIMAL(5,4) COMMENT '推荐点击率',
    recommendation_convert_rate DECIMAL(5,4) COMMENT '推荐转化率',

    -- 冷启动信息
    cold_start_strategy VARCHAR(32) COMMENT '冷启动策略: popular/category_based/similar_user',

    first_visit_time DATETIME COMMENT '首次访问时间',
    last_active_time DATETIME COMMENT '最后活跃时间',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_profile_status (profile_status),
    INDEX idx_last_active_time (last_active_time),
    INDEX idx_behavior_count (behavior_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户推荐画像表';

-- 4. 商品特征标签表 (用于内容推荐匹配)
CREATE TABLE IF NOT EXISTS product_feature_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    product_id VARCHAR(64) NOT NULL COMMENT '商品ID (goods_spu.id)',

    -- 标签信息
    tag_type VARCHAR(32) NOT NULL COMMENT '标签类型: category/brand/feature/price_level/quality',
    tag_value VARCHAR(128) NOT NULL COMMENT '标签值',

    -- 权重
    weight DECIMAL(5,4) DEFAULT 1.0000 COMMENT '标签权重',
    source VARCHAR(32) DEFAULT 'system' COMMENT '来源: system/ai/manual',

    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY uk_product_tag (product_id, tag_type, tag_value),
    INDEX idx_product_id (product_id),
    INDEX idx_tag_type_value (tag_type, tag_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品特征标签表';

-- 5. 推荐日志表 (记录推荐结果，用于评估和优化)
CREATE TABLE IF NOT EXISTS recommendation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    wx_user_id VARCHAR(64) NOT NULL COMMENT '微信用户ID',

    -- 推荐信息
    recommendation_type VARCHAR(32) NOT NULL COMMENT '推荐类型: home_feed/search_result/similar_product/cart_recommend',
    recommendation_position INT COMMENT '推荐位置',
    product_id VARCHAR(64) NOT NULL COMMENT '推荐商品ID',

    -- 推荐原因
    recommendation_reason VARCHAR(256) COMMENT '推荐原因说明',
    match_tags JSON COMMENT '匹配的标签: ["肉类", "高端"]',
    score DECIMAL(5,4) COMMENT '推荐分数',

    -- 算法信息
    algorithm_type VARCHAR(32) COMMENT '算法类型: content_based/collaborative/hybrid/popular',
    algorithm_version VARCHAR(32) COMMENT '算法版本',

    -- 用户反馈
    is_clicked TINYINT(1) DEFAULT 0 COMMENT '是否点击',
    is_purchased TINYINT(1) DEFAULT 0 COMMENT '是否购买',
    feedback_time DATETIME COMMENT '反馈时间',

    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_wx_user_id (wx_user_id),
    INDEX idx_product_id (product_id),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_create_time (create_time),
    INDEX idx_is_clicked (is_clicked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐日志表';

-- 6. 热门商品缓存表 (定时更新，用于冷启动和热门推荐)
CREATE TABLE IF NOT EXISTS popular_products_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',

    -- 时间范围
    time_range VARCHAR(32) NOT NULL COMMENT '时间范围: hourly/daily/weekly/monthly',
    category_id VARCHAR(64) COMMENT '分类ID (NULL表示全品类)',

    -- 热门商品列表 (JSON数组)
    product_ids JSON NOT NULL COMMENT '商品ID列表: ["id1", "id2", ...]',
    product_scores JSON COMMENT '商品分数: [0.95, 0.88, ...]',

    -- 统计信息
    total_views INT COMMENT '总浏览数',
    total_sales INT COMMENT '总销量',

    -- 更新信息
    calculated_at DATETIME NOT NULL COMMENT '计算时间',
    valid_until DATETIME NOT NULL COMMENT '有效期至',

    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    UNIQUE KEY uk_time_category (time_range, category_id),
    INDEX idx_valid_until (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='热门商品缓存表';

-- ==========================================================
-- 初始化数据
-- ==========================================================

-- 初始化热门商品缓存 (全品类)
INSERT INTO popular_products_cache (time_range, category_id, product_ids, product_scores, total_views, total_sales, calculated_at, valid_until)
SELECT
    'daily' as time_range,
    NULL as category_id,
    JSON_ARRAY() as product_ids,
    JSON_ARRAY() as product_scores,
    0 as total_views,
    0 as total_sales,
    NOW() as calculated_at,
    DATE_ADD(NOW(), INTERVAL 1 DAY) as valid_until
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM popular_products_cache WHERE time_range = 'daily' AND category_id IS NULL);
