-- =============================================================================
-- V3.1 - 15套行业主题模板预置数据
-- 基于2025年UI设计趋势和电商配色研究
-- =============================================================================

-- 清空现有主题数据（保留结构）
DELETE FROM decoration_theme_preset;

-- =============================================================================
-- 15套行业主题预置
-- =============================================================================

-- 1. 清新绿 - 生鲜蔬果/有机食品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '清新绿',
    'fresh_green',
    '自然清新，适合生鲜蔬果、有机食品、健康饮食类店铺',
    '{"primaryColor":"#52c41a","secondaryColor":"#389e0d","backgroundColor":"#f6ffed","textColor":"#333333","textSecondary":"#666666","accentColor":"#73d13d","borderColor":"#b7eb8f","cardBg":"#ffffff","gradientStart":"#52c41a","gradientEnd":"#389e0d"}',
    'fresh,natural,healthy',
    'food,organic,vegetable,fruit',
    '新鲜直达，品质生活',
    '["header_bar","notice_bar","category_grid","banner_swiper","quick_actions","goods_hot_scroll","goods_recommend_grid"]',
    1, 1
);

-- 2. 经典金 - 高端礼品/奢侈品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '经典金',
    'classic_gold',
    '尊贵大气，适合高端礼品、奢侈品、精品茶酒类店铺',
    '{"primaryColor":"#D4AF37","secondaryColor":"#B8860B","backgroundColor":"#fffef5","textColor":"#333333","textSecondary":"#666666","accentColor":"#FFD700","borderColor":"#D4AF37","cardBg":"#ffffff","darkBg":"#1a1a1a","gradientStart":"#D4AF37","gradientEnd":"#B8860B"}',
    'luxury,elegant,premium',
    'gift,jewelry,wine,tea',
    '臻选品质，尊享生活',
    '["header_bar","notice_bar","banner_swiper","goods_hot_scroll","goods_recommend_grid","goods_waterfall"]',
    2, 1
);

-- 3. 简约白 - 通用/极简风格
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '简约白',
    'minimal_white',
    '简洁明了，适合追求极简风格的各类店铺',
    '{"primaryColor":"#333333","secondaryColor":"#666666","backgroundColor":"#ffffff","textColor":"#333333","textSecondary":"#999999","accentColor":"#1890ff","borderColor":"#e8e8e8","cardBg":"#fafafa","gradientStart":"#f5f5f5","gradientEnd":"#e0e0e0"}',
    'simple,minimal,clean',
    'general,retail,service',
    '简约不简单',
    '["header_bar","banner_swiper","category_grid","goods_recommend_grid","goods_waterfall"]',
    3, 1
);

-- 4. 活力橙 - 促销活动/快消品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '活力橙',
    'dopamine_orange',
    '热情活力，适合促销活动、快消品、年轻时尚类店铺',
    '{"primaryColor":"#fa8c16","secondaryColor":"#d46b08","backgroundColor":"#fff7e6","textColor":"#333333","textSecondary":"#666666","accentColor":"#ffa940","borderColor":"#ffd591","cardBg":"#ffffff","gradientStart":"#fa8c16","gradientEnd":"#d46b08"}',
    'energetic,young,promotion',
    'snack,beverage,fashion,promotion',
    '活力满满，惊喜不断',
    '["header_bar","notice_bar","banner_swiper","quick_actions","goods_hot_scroll","goods_recommend_grid"]',
    4, 1
);

-- 5. 海洋蓝 - 海鲜水产/进口食品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '海洋蓝',
    'ocean_blue',
    '清爽海洋风，适合海鲜水产、进口食品、冷链生鲜类店铺',
    '{"primaryColor":"#1890ff","secondaryColor":"#096dd9","backgroundColor":"#e6f7ff","textColor":"#333333","textSecondary":"#666666","accentColor":"#40a9ff","borderColor":"#91d5ff","cardBg":"#ffffff","gradientStart":"#1890ff","gradientEnd":"#096dd9"}',
    'ocean,fresh,cool',
    'seafood,import,frozen',
    '深海臻选，鲜活到家',
    '["header_bar","notice_bar","category_grid","banner_swiper","goods_hot_scroll","goods_recommend_grid"]',
    5, 1
);

-- 6. 甜美粉 - 甜品烘焙/少女风
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '甜美粉',
    'sweet_pink',
    '温馨甜美，适合甜品烘焙、少女服饰、可爱周边类店铺',
    '{"primaryColor":"#eb2f96","secondaryColor":"#c41d7f","backgroundColor":"#fff0f6","textColor":"#333333","textSecondary":"#666666","accentColor":"#f759ab","borderColor":"#ffadd2","cardBg":"#ffffff","gradientStart":"#eb2f96","gradientEnd":"#c41d7f"}',
    'sweet,cute,romantic',
    'bakery,dessert,girl,gift',
    '甜蜜时光，幸福味道',
    '["header_bar","notice_bar","banner_swiper","category_grid","goods_hot_scroll","goods_recommend_grid"]',
    6, 1
);

-- 7. 母婴暖 - 母婴用品/儿童商品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '母婴暖',
    'baby_warm',
    '柔和温暖，适合母婴用品、儿童玩具、亲子服务类店铺',
    '{"primaryColor":"#F4C2C2","secondaryColor":"#EE96AA","backgroundColor":"#FFF5F5","textColor":"#5C4033","textSecondary":"#8B7355","accentColor":"#FFB6C1","borderColor":"#FFC0CB","cardBg":"#ffffff","lightYellow":"#FBF2AB","gradientStart":"#F4C2C2","gradientEnd":"#FFB6C1"}',
    'warm,soft,caring',
    'baby,mother,children,toy',
    '用心呵护，陪伴成长',
    '["header_bar","notice_bar","category_grid","banner_swiper","goods_recommend_grid","goods_waterfall"]',
    7, 1
);

-- 8. 茶韵棕 - 茶叶咖啡/传统食品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '茶韵棕',
    'tea_brown',
    '古朴雅致，适合茶叶、咖啡、传统糕点、养生食品类店铺',
    '{"primaryColor":"#8B4513","secondaryColor":"#6D4C41","backgroundColor":"#FAF0E6","textColor":"#3E2723","textSecondary":"#5D4037","accentColor":"#A0522D","borderColor":"#D7CCC8","cardBg":"#FFFAF0","gradientStart":"#8B4513","gradientEnd":"#6D4C41"}',
    'traditional,elegant,cultural',
    'tea,coffee,pastry,health',
    '一盏茶香，品味人生',
    '["header_bar","notice_bar","banner_swiper","category_grid","goods_hot_scroll","goods_waterfall"]',
    8, 1
);

-- 9. 科技蓝 - 数码家电/智能产品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '科技蓝',
    'tech_blue',
    '科技感十足，适合数码产品、智能家电、电子配件类店铺',
    '{"primaryColor":"#2F54EB","secondaryColor":"#1D39C4","backgroundColor":"#F0F5FF","textColor":"#262626","textSecondary":"#595959","accentColor":"#597EF7","borderColor":"#ADC6FF","cardBg":"#ffffff","darkBg":"#001529","gradientStart":"#2F54EB","gradientEnd":"#1D39C4"}',
    'tech,modern,smart',
    'digital,electronic,smart,appliance',
    '智能生活，触手可及',
    '["header_bar","banner_swiper","category_grid","quick_actions","goods_hot_scroll","goods_recommend_grid"]',
    9, 1
);

-- 10. 美妆紫 - 美妆护肤/时尚配饰
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '美妆紫',
    'beauty_purple',
    '优雅浪漫，适合美妆护肤、时尚配饰、香氛香水类店铺',
    '{"primaryColor":"#722ED1","secondaryColor":"#531DAB","backgroundColor":"#F9F0FF","textColor":"#262626","textSecondary":"#595959","accentColor":"#9254DE","borderColor":"#D3ADF7","cardBg":"#ffffff","gradientStart":"#722ED1","gradientEnd":"#531DAB"}',
    'elegant,romantic,beauty',
    'cosmetics,skincare,fashion,perfume',
    '美丽绽放，自信由我',
    '["header_bar","notice_bar","banner_swiper","category_grid","goods_hot_scroll","goods_recommend_grid"]',
    10, 1
);

-- 11. 自然木 - 家居家具/手工艺品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '自然木',
    'natural_wood',
    '质朴自然，适合家居家具、手工艺品、原木制品类店铺',
    '{"primaryColor":"#A0522D","secondaryColor":"#8B4513","backgroundColor":"#FDF5E6","textColor":"#3E2723","textSecondary":"#5D4037","accentColor":"#CD853F","borderColor":"#DEB887","cardBg":"#FFFAF0","gradientStart":"#A0522D","gradientEnd":"#8B4513"}',
    'natural,rustic,handmade',
    'furniture,home,craft,wood',
    '匠心之作，温暖家居',
    '["header_bar","banner_swiper","category_grid","goods_hot_scroll","goods_recommend_grid","goods_waterfall"]',
    11, 1
);

-- 12. 节日红 - 节日促销/喜庆礼品
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '节日红',
    'festival_red',
    '喜庆热烈，适合节日促销、喜庆礼品、年货特产类店铺',
    '{"primaryColor":"#CF1322","secondaryColor":"#A8071A","backgroundColor":"#FFF1F0","textColor":"#262626","textSecondary":"#595959","accentColor":"#FF4D4F","borderColor":"#FFA39E","cardBg":"#ffffff","goldAccent":"#FAAD14","gradientStart":"#CF1322","gradientEnd":"#A8071A"}',
    'festive,celebration,lucky',
    'festival,gift,specialty,newyear',
    '喜迎佳节，好礼相送',
    '["header_bar","notice_bar","banner_swiper","quick_actions","goods_hot_scroll","goods_recommend_grid"]',
    12, 1
);

-- 13. 深夜黑 - 潮流时尚/夜店风格
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '深夜黑',
    'dark_night',
    '酷炫潮流，适合潮牌服饰、电竞周边、夜店风格类店铺',
    '{"primaryColor":"#FAAD14","secondaryColor":"#D48806","backgroundColor":"#141414","textColor":"#FFFFFF","textSecondary":"#A6A6A6","accentColor":"#FFC53D","borderColor":"#434343","cardBg":"#1F1F1F","neonPink":"#FF4081","neonBlue":"#00E5FF","gradientStart":"#FAAD14","gradientEnd":"#D48806"}',
    'dark,trendy,cool',
    'fashion,streetwear,gaming,nightlife',
    '释放自我，潮流不息',
    '["header_bar","banner_swiper","category_grid","goods_hot_scroll","goods_recommend_grid"]',
    13, 1
);

-- 14. 田园绿 - 农产品/土特产
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '田园绿',
    'farm_green',
    '淳朴自然，适合农产品、土特产、乡村好物类店铺',
    '{"primaryColor":"#7CB305","secondaryColor":"#5B8C00","backgroundColor":"#FCFFE6","textColor":"#3F3F3F","textSecondary":"#6B6B6B","accentColor":"#A0D911","borderColor":"#D3F261","cardBg":"#ffffff","earthBrown":"#8B6914","gradientStart":"#7CB305","gradientEnd":"#5B8C00"}',
    'rural,natural,authentic',
    'farm,specialty,rural,grain',
    '田间直送，原味乡土',
    '["header_bar","notice_bar","category_grid","banner_swiper","goods_hot_scroll","goods_recommend_grid","goods_waterfall"]',
    14, 1
);

-- 15. 医疗蓝 - 保健品/健康服务
INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, recommended_modules, sort_order, status) VALUES (
    '医疗蓝',
    'medical_blue',
    '专业可信，适合保健品、健康服务、医疗器械类店铺',
    '{"primaryColor":"#13C2C2","secondaryColor":"#08979C","backgroundColor":"#E6FFFB","textColor":"#262626","textSecondary":"#595959","accentColor":"#36CFC9","borderColor":"#87E8DE","cardBg":"#ffffff","trustBlue":"#1890FF","gradientStart":"#13C2C2","gradientEnd":"#08979C"}',
    'professional,trust,health',
    'health,supplement,medical,wellness',
    '专业守护，健康生活',
    '["header_bar","notice_bar","banner_swiper","category_grid","quick_actions","goods_recommend_grid"]',
    15, 1
);

-- =============================================================================
-- 更新模块配置 - 增加更多行业适配的默认参数
-- =============================================================================

-- 更新 notice_bar 模块，增加不同行业的默认公告语
UPDATE decoration_module SET default_params = '{
    "notices": [
        {"text": "欢迎光临本店，新用户专享优惠！", "type": "welcome"},
        {"text": "全场满99元包邮", "type": "promotion"},
        {"text": "品质保证，售后无忧", "type": "service"}
    ],
    "autoplay": true,
    "interval": 4000,
    "vertical": true
}' WHERE code = 'notice_bar';

-- 更新 quick_actions 模块
UPDATE decoration_module SET default_params = '{
    "actions": [
        {"icon": "scan", "title": "扫码溯源", "desc": "查看商品来源", "path": "/pages/traceability/scan/index", "bgGradient": ["#52c41a", "#389e0d"]},
        {"icon": "service", "title": "在线客服", "desc": "专属服务", "path": "", "bgGradient": ["#1890ff", "#096dd9"]},
        {"icon": "coupon", "title": "领取优惠", "desc": "新人福利", "path": "/pages/coupon/list/index", "bgGradient": ["#fa8c16", "#d46b08"]}
    ]
}' WHERE code = 'quick_actions';

-- =============================================================================
-- 新增：行业宣传语素材库表
-- =============================================================================

CREATE TABLE IF NOT EXISTS decoration_slogan_library (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    industry VARCHAR(50) NOT NULL COMMENT '行业类型',
    slogan_type VARCHAR(30) NOT NULL COMMENT '宣传语类型：welcome/promotion/service/brand',
    content VARCHAR(200) NOT NULL COMMENT '宣传语内容',
    occasion VARCHAR(50) COMMENT '适用场景：daily/festival/promotion/newuser',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_industry (industry),
    INDEX idx_type (slogan_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宣传语素材库';

-- 插入宣传语素材
INSERT INTO decoration_slogan_library (industry, slogan_type, content, occasion, sort_order) VALUES
-- 生鲜蔬果类
('food', 'welcome', '新鲜直达，品质生活', 'daily', 1),
('food', 'welcome', '源头直采，新鲜到家', 'daily', 2),
('food', 'promotion', '今日特惠，新鲜不等人', 'promotion', 1),
('food', 'promotion', '限时抢购，错过等明天', 'promotion', 2),
('food', 'service', '品质保证，不新鲜包退', 'daily', 1),
('food', 'brand', '吃得放心，买得安心', 'daily', 1),

-- 高端礼品类
('gift', 'welcome', '臻选品质，尊享生活', 'daily', 1),
('gift', 'welcome', '礼遇非凡，品味人生', 'daily', 2),
('gift', 'promotion', '佳节好礼，限时特惠', 'festival', 1),
('gift', 'service', '精美包装，专属定制', 'daily', 1),
('gift', 'brand', '送礼有面，收礼开心', 'daily', 1),

-- 母婴用品类
('baby', 'welcome', '用心呵护，陪伴成长', 'daily', 1),
('baby', 'welcome', '妈妈放心，宝贝开心', 'daily', 2),
('baby', 'promotion', '宝贝专属优惠，限时开抢', 'promotion', 1),
('baby', 'service', '正品保障，无忧退换', 'daily', 1),
('baby', 'brand', '给宝贝最好的', 'daily', 1),

-- 美妆护肤类
('cosmetics', 'welcome', '美丽绽放，自信由我', 'daily', 1),
('cosmetics', 'welcome', '让美丽更简单', 'daily', 2),
('cosmetics', 'promotion', '美妆节狂欢，低至5折', 'promotion', 1),
('cosmetics', 'service', '正品保证，过敏包退', 'daily', 1),
('cosmetics', 'brand', '你值得拥有更好的', 'daily', 1),

-- 数码科技类
('digital', 'welcome', '智能生活，触手可及', 'daily', 1),
('digital', 'welcome', '科技改变生活', 'daily', 2),
('digital', 'promotion', '数码狂欢，爆款直降', 'promotion', 1),
('digital', 'service', '7天无理由，1年质保', 'daily', 1),
('digital', 'brand', '品质数码，值得信赖', 'daily', 1),

-- 海鲜水产类
('seafood', 'welcome', '深海臻选，鲜活到家', 'daily', 1),
('seafood', 'welcome', '来自大海的馈赠', 'daily', 2),
('seafood', 'promotion', '鲜货直降，今日特价', 'promotion', 1),
('seafood', 'service', '冷链配送，锁住新鲜', 'daily', 1),
('seafood', 'brand', '每一口都是大海的味道', 'daily', 1),

-- 甜品烘焙类
('bakery', 'welcome', '甜蜜时光，幸福味道', 'daily', 1),
('bakery', 'welcome', '用甜蜜点缀生活', 'daily', 2),
('bakery', 'promotion', '满减优惠，甜蜜加倍', 'promotion', 1),
('bakery', 'service', '新鲜现做，当日送达', 'daily', 1),
('bakery', 'brand', '每一口都是幸福', 'daily', 1),

-- 茶叶咖啡类
('tea', 'welcome', '一盏茶香，品味人生', 'daily', 1),
('tea', 'welcome', '好茶，懂你', 'daily', 2),
('tea', 'promotion', '新茶上市，尝鲜价', 'promotion', 1),
('tea', 'service', '原产地直发，品质保证', 'daily', 1),
('tea', 'brand', '传承茶道，匠心制茶', 'daily', 1),

-- 家居家具类
('furniture', 'welcome', '匠心之作，温暖家居', 'daily', 1),
('furniture', 'welcome', '让家更有温度', 'daily', 2),
('furniture', 'promotion', '家装节，全场特惠', 'promotion', 1),
('furniture', 'service', '免费上门安装', 'daily', 1),
('furniture', 'brand', '用心造家，用爱生活', 'daily', 1),

-- 节日促销类
('festival', 'welcome', '喜迎佳节，好礼相送', 'festival', 1),
('festival', 'promotion', '年货大街，囤货正当时', 'newyear', 1),
('festival', 'promotion', '双节同庆，优惠翻倍', 'festival', 2),
('festival', 'service', '春节不打烊，照常发货', 'newyear', 1),
('festival', 'brand', '团圆时刻，好物相伴', 'festival', 1),

-- 农产品土特产类
('farm', 'welcome', '田间直送，原味乡土', 'daily', 1),
('farm', 'welcome', '来自大山的馈赠', 'daily', 2),
('farm', 'promotion', '助农特惠，产地直发', 'promotion', 1),
('farm', 'service', '农户直供，无中间商', 'daily', 1),
('farm', 'brand', '把家乡的味道带给你', 'daily', 1),

-- 保健品类
('health', 'welcome', '专业守护，健康生活', 'daily', 1),
('health', 'welcome', '健康，从现在开始', 'daily', 2),
('health', 'promotion', '健康好物，限时特惠', 'promotion', 1),
('health', 'service', '正规渠道，品质保障', 'daily', 1),
('health', 'brand', '关爱健康，关爱家人', 'daily', 1),

-- 潮流时尚类
('fashion', 'welcome', '释放自我，潮流不息', 'daily', 1),
('fashion', 'welcome', '做自己的时尚icon', 'daily', 2),
('fashion', 'promotion', '潮品特卖，限量抢购', 'promotion', 1),
('fashion', 'service', '7天无理由退换', 'daily', 1),
('fashion', 'brand', '潮流永不止步', 'daily', 1);

-- =============================================================================
-- 新增：模块样式变体表
-- =============================================================================

CREATE TABLE IF NOT EXISTS decoration_module_variant (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    module_code VARCHAR(50) NOT NULL COMMENT '模块编码',
    variant_name VARCHAR(50) NOT NULL COMMENT '变体名称',
    variant_code VARCHAR(50) NOT NULL COMMENT '变体编码',
    description VARCHAR(200) COMMENT '变体描述',
    style_config TEXT COMMENT '样式配置JSON',
    preview_image VARCHAR(255) COMMENT '预览图',
    suitable_industries VARCHAR(200) COMMENT '适用行业',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_module_variant (module_code, variant_code),
    INDEX idx_module_code (module_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块样式变体';

-- 插入模块变体
INSERT INTO decoration_module_variant (module_code, variant_name, variant_code, description, style_config, suitable_industries, sort_order) VALUES
-- 分类网格变体
('category_grid', '圆形图标', 'circle', '圆形分类图标，适合简约风格', '{"iconShape":"circle","iconSize":"80rpx","columns":5,"showBorder":false}', 'general,fashion', 1),
('category_grid', '方形图标', 'square', '方形分类图标，适合商务风格', '{"iconShape":"square","iconSize":"88rpx","columns":5,"showBorder":true,"borderRadius":"16rpx"}', 'digital,furniture', 2),
('category_grid', '大图标', 'large', '大图标分类，适合图片展示', '{"iconShape":"square","iconSize":"120rpx","columns":4,"showBorder":false,"borderRadius":"24rpx"}', 'food,bakery', 3),
('category_grid', '横向滚动', 'scroll', '横向滚动分类，适合多分类', '{"layout":"scroll","iconSize":"72rpx","showAll":true}', 'retail,general', 4),

-- Banner轮播变体
('banner_swiper', '全屏轮播', 'fullscreen', '全屏Banner，视觉冲击力强', '{"height":"400rpx","borderRadius":"0","indicatorDots":true}', 'fashion,festival', 1),
('banner_swiper', '圆角卡片', 'card', '圆角卡片式Banner', '{"height":"320rpx","borderRadius":"24rpx","margin":"24rpx","indicatorDots":true}', 'general,food', 2),
('banner_swiper', '3D卡片', 'card3d', '3D效果卡片Banner', '{"height":"280rpx","borderRadius":"16rpx","effect":"coverflow","indicatorDots":false}', 'digital,cosmetics', 3),

-- 商品列表变体
('goods_recommend_grid', '两列网格', 'grid2', '经典两列布局', '{"columns":2,"gap":"24rpx","cardStyle":"shadow","showPrice":true}', 'general,food', 1),
('goods_recommend_grid', '三列网格', 'grid3', '三列紧凑布局', '{"columns":3,"gap":"16rpx","cardStyle":"border","showPrice":true}', 'fashion,cosmetics', 2),
('goods_recommend_grid', '大图模式', 'bigImage', '单列大图展示', '{"columns":1,"imageHeight":"400rpx","cardStyle":"none","showDesc":true}', 'furniture,gift', 3),

-- 横向滚动变体
('goods_hot_scroll', '经典卡片', 'classic', '经典横向滚动卡片', '{"cardWidth":"280rpx","imageHeight":"280rpx","showPrice":true}', 'general', 1),
('goods_hot_scroll', '小卡片', 'small', '小尺寸横向滚动', '{"cardWidth":"220rpx","imageHeight":"220rpx","showPrice":true}', 'digital,fashion', 2),
('goods_hot_scroll', '大卡片', 'large', '大尺寸横向滚动', '{"cardWidth":"340rpx","imageHeight":"340rpx","showDesc":true}', 'furniture,gift', 3);

-- =============================================================================
-- 查看插入结果
-- =============================================================================
SELECT id, name, code, style_tags, industry_tags FROM decoration_theme_preset ORDER BY sort_order;
SELECT COUNT(*) AS slogan_count FROM decoration_slogan_library;
SELECT COUNT(*) AS variant_count FROM decoration_module_variant;
