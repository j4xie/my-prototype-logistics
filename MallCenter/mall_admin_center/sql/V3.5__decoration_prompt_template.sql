-- ============================================
-- V3.5 装修Prompt模板和关键词映射表
-- Phase 8: AI引导式对话装修系统
-- ============================================

-- 1. Prompt模板表
CREATE TABLE IF NOT EXISTS `decoration_prompt_template` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `name` VARCHAR(100) NOT NULL COMMENT '模板名称',
    `code` VARCHAR(50) NOT NULL COMMENT '模板编码（唯一）',
    `industry_type` VARCHAR(30) NOT NULL COMMENT '行业类型: fresh_food/seafood/dessert/gift/baby/tech/beauty/general',
    `image_type` VARCHAR(20) NOT NULL COMMENT '图片类型: banner/background/icon/product',
    `style_type` VARCHAR(30) DEFAULT 'general' COMMENT '风格类型: fresh/luxury/minimal/dopamine/warm',
    `base_prompt` TEXT NOT NULL COMMENT '基础prompt模板，支持变量: {product}, {style}, {color_tone}, {size}',
    `variables_def` TEXT COMMENT '变量定义JSON',
    `negative_prompt` VARCHAR(500) COMMENT '负向提示词',
    `recommended_size` VARCHAR(20) DEFAULT '1280*720' COMMENT '推荐尺寸',
    `example_image` VARCHAR(500) COMMENT '示例图片URL',
    `use_count` INT DEFAULT 0 COMMENT '使用次数',
    `status` TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    `sort_order` INT DEFAULT 0 COMMENT '排序',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`),
    KEY `idx_industry_type` (`industry_type`),
    KEY `idx_image_type` (`image_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='装修Prompt模板表';

-- 2. 关键词映射表
CREATE TABLE IF NOT EXISTS `decoration_keyword_mapping` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `keyword` VARCHAR(50) NOT NULL COMMENT '关键词',
    `mapping_type` VARCHAR(20) NOT NULL COMMENT '映射类型: industry/style/product',
    `mapping_value` VARCHAR(50) NOT NULL COMMENT '映射值',
    `theme_code` VARCHAR(50) COMMENT '关联主题编码',
    `weight` INT DEFAULT 10 COMMENT '匹配权重',
    `match_count` INT DEFAULT 0 COMMENT '匹配次数',
    `status` TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_keyword` (`keyword`),
    KEY `idx_mapping_type` (`mapping_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='装修关键词映射表';

-- ============================================
-- 预置Prompt模板数据（20+模板）
-- ============================================

INSERT INTO `decoration_prompt_template` (`name`, `code`, `industry_type`, `image_type`, `style_type`, `base_prompt`, `variables_def`, `negative_prompt`, `recommended_size`, `sort_order`) VALUES
-- 生鲜食品
('生鲜Banner-清新风格', 'fresh_food_banner_fresh', 'fresh_food', 'banner', 'fresh',
 '新鲜{product}电商Banner，清新自然风格，绿色植物元素装饰，水珠晶莹效果，白色干净背景，专业商业摄影，高清细节，{size}',
 '{"product": "水果蔬菜", "size": "1280*720"}',
 '模糊, 低质量, 文字, 水印, 人物',
 '1280*720', 1),

('生鲜Banner-有机风格', 'fresh_food_banner_organic', 'fresh_food', 'banner', 'fresh',
 '有机{product}展示Banner，自然田园风格，木质纹理背景，麻布装饰，阳光照射效果，温暖自然色调，{size}',
 '{"product": "有机蔬菜", "size": "1280*720"}',
 '模糊, 低质量, 文字, 水印',
 '1280*720', 2),

('生鲜背景图', 'fresh_food_background', 'fresh_food', 'background', 'fresh',
 '清新绿色渐变背景，淡绿色到白色过渡，水珠装饰元素，模糊植物轮廓，适合电商页面背景，简洁大气，{size}',
 '{"size": "750*1334"}',
 '文字, 水印, 复杂图案',
 '750*1334', 3),

-- 海鲜水产
('海鲜Banner-海洋风格', 'seafood_banner_ocean', 'seafood', 'banner', 'fresh',
 '新鲜{product}电商Banner，深蓝色海洋风格，冰块晶莹效果，海浪水花元素，专业美食摄影，高清品质，{size}',
 '{"product": "海鲜", "size": "1280*720"}',
 '模糊, 低质量, 文字, 水印',
 '1280*720', 4),

('海鲜Banner-冰鲜风格', 'seafood_banner_ice', 'seafood', 'banner', 'fresh',
 '冰鲜{product}展示，大量碎冰堆叠效果，蓝白色调，新鲜感强烈，水滴晶莹，专业产品摄影，{size}',
 '{"product": "海鲜", "size": "1280*720"}',
 '模糊, 低质量, 文字',
 '1280*720', 5),

('海鲜背景图', 'seafood_background', 'seafood', 'background', 'fresh',
 '深蓝色海洋渐变背景，海浪纹理效果，气泡装饰元素，适合海鲜电商页面，清爽大气，{size}',
 '{"size": "750*1334"}',
 '文字, 水印',
 '750*1334', 6),

-- 甜品烘焙
('甜品Banner-粉色风格', 'dessert_banner_pink', 'dessert', 'banner', 'warm',
 '精美{product}电商Banner，粉色马卡龙风格，柔和光线效果，奶油装饰元素，温馨甜蜜氛围，专业甜品摄影，{size}',
 '{"product": "蛋糕甜品", "size": "1280*720"}',
 '模糊, 低质量, 文字, 水印',
 '1280*720', 7),

('甜品Banner-温馨风格', 'dessert_banner_warm', 'dessert', 'banner', 'warm',
 '手工{product}展示Banner，温暖奶黄色调，木质背景，烘焙工具装饰，家庭手作感，专业摄影，{size}',
 '{"product": "烘焙甜点", "size": "1280*720"}',
 '模糊, 低质量, 文字',
 '1280*720', 8),

('甜品背景图', 'dessert_background', 'dessert', 'background', 'warm',
 '粉色渐变背景，淡粉到白色过渡，糖霜装饰元素，甜蜜温馨氛围，适合甜品店页面，{size}',
 '{"size": "750*1334"}',
 '文字, 水印',
 '750*1334', 9),

-- 高端礼品
('礼品Banner-奢华金色', 'gift_banner_gold', 'gift', 'banner', 'luxury',
 '高端{product}展示Banner，金色丝带装饰，黑色大气背景，光泽质感效果，奢华尊贵氛围，专业产品摄影，{size}',
 '{"product": "礼品礼盒", "size": "1280*720"}',
 '模糊, 低质量, 廉价感',
 '1280*720', 10),

('礼品Banner-简约高端', 'gift_banner_minimal', 'gift', 'banner', 'luxury',
 '精美{product}展示，极简白色背景，金色点缀，高端质感，专业商业摄影，干净大气，{size}',
 '{"product": "礼品", "size": "1280*720"}',
 '模糊, 低质量, 杂乱',
 '1280*720', 11),

('礼品背景图', 'gift_background', 'gift', 'background', 'luxury',
 '黑金渐变背景，金色光点装饰，高端奢华质感，适合礼品电商页面，大气尊贵，{size}',
 '{"size": "750*1334"}',
 '廉价感, 杂乱',
 '750*1334', 12),

-- 母婴用品
('母婴Banner-温馨风格', 'baby_banner_warm', 'baby', 'banner', 'warm',
 '可爱{product}电商Banner，柔和淡黄色调，卡通云朵装饰，温馨关爱氛围，专业母婴产品摄影，{size}',
 '{"product": "母婴用品", "size": "1280*720"}',
 '模糊, 低质量, 冷色调',
 '1280*720', 13),

('母婴Banner-清新风格', 'baby_banner_fresh', 'baby', 'banner', 'fresh',
 '安全{product}展示Banner，淡蓝绿色调，清新自然风格，温柔舒适感，专业产品摄影，{size}',
 '{"product": "婴儿用品", "size": "1280*720"}',
 '模糊, 低质量, 暗色调',
 '1280*720', 14),

('母婴背景图', 'baby_background', 'baby', 'background', 'warm',
 '柔和淡黄渐变背景，卡通星星云朵装饰，温馨可爱氛围，适合母婴店页面，{size}',
 '{"size": "750*1334"}',
 '暗色调, 杂乱',
 '750*1334', 15),

-- 数码科技
('数码Banner-科技蓝', 'tech_banner_blue', 'tech', 'banner', 'minimal',
 '智能{product}电商Banner，科技蓝色调，几何线条装饰，未来感设计，专业3C产品摄影，{size}',
 '{"product": "数码产品", "size": "1280*720"}',
 '模糊, 低质量, 老旧感',
 '1280*720', 16),

('数码Banner-极简风格', 'tech_banner_minimal', 'tech', 'banner', 'minimal',
 '精美{product}展示Banner，纯白背景，简约现代风格，产品聚焦，专业商业摄影，{size}',
 '{"product": "电子产品", "size": "1280*720"}',
 '模糊, 低质量, 杂乱',
 '1280*720', 17),

('数码背景图', 'tech_background', 'tech', 'background', 'minimal',
 '科技蓝渐变背景，几何线条装饰，数字光效元素，适合数码店页面，现代感强，{size}',
 '{"size": "750*1334"}',
 '杂乱, 老旧',
 '750*1334', 18),

-- 美妆护肤
('美妆Banner-高端风格', 'beauty_banner_luxury', 'beauty', 'banner', 'luxury',
 '精美{product}电商Banner，玫瑰金色调，花瓣装饰元素，高端护肤品质感，专业美妆摄影，{size}',
 '{"product": "护肤品", "size": "1280*720"}',
 '模糊, 低质量, 廉价感',
 '1280*720', 19),

('美妆Banner-清新风格', 'beauty_banner_fresh', 'beauty', 'banner', 'fresh',
 '天然{product}展示Banner，绿色植物装饰，清新自然风格，有机护肤概念，专业产品摄影，{size}',
 '{"product": "护肤品", "size": "1280*720"}',
 '模糊, 低质量',
 '1280*720', 20),

('美妆背景图', 'beauty_background', 'beauty', 'background', 'luxury',
 '柔和粉金渐变背景，花瓣光效装饰，高端美妆氛围，适合护肤品店页面，{size}',
 '{"size": "750*1334"}',
 '杂乱, 廉价感',
 '750*1334', 21),

-- 通用模板
('通用Banner-促销风格', 'general_banner_promo', 'general', 'banner', 'dopamine',
 '电商促销Banner，{product}展示，活力橙红色调，优惠标签装饰，购物氛围强烈，{size}',
 '{"product": "商品", "size": "1280*720"}',
 '模糊, 低质量',
 '1280*720', 22),

('通用Banner-简约风格', 'general_banner_minimal', 'general', 'banner', 'minimal',
 '简约{product}展示Banner，白色干净背景，极简设计风格，产品聚焦，专业摄影，{size}',
 '{"product": "商品", "size": "1280*720"}',
 '模糊, 低质量, 杂乱',
 '1280*720', 23),

('通用背景图-白色', 'general_background_white', 'general', 'background', 'minimal',
 '纯净白色渐变背景，淡灰色过渡，简约大气，适合各类电商页面，{size}',
 '{"size": "750*1334"}',
 '杂乱, 复杂图案',
 '750*1334', 24),

('通用背景图-渐变', 'general_background_gradient', 'general', 'background', 'fresh',
 '柔和渐变背景，浅蓝到白色过渡，清新舒适，适合各类店铺页面，{size}',
 '{"size": "750*1334"}',
 '杂乱, 复杂图案',
 '750*1334', 25);

-- ============================================
-- 预置关键词映射数据（500+关键词）
-- ============================================

-- 生鲜食品关键词
INSERT INTO `decoration_keyword_mapping` (`keyword`, `mapping_type`, `mapping_value`, `theme_code`, `weight`) VALUES
('水果', 'industry', 'fresh_food', 'fresh_green', 100),
('蔬菜', 'industry', 'fresh_food', 'fresh_green', 100),
('生鲜', 'industry', 'fresh_food', 'fresh_green', 100),
('有机', 'industry', 'fresh_food', 'organic_natural', 90),
('农产品', 'industry', 'fresh_food', 'fresh_green', 80),
('苹果', 'industry', 'fresh_food', 'fresh_green', 70),
('香蕉', 'industry', 'fresh_food', 'fresh_green', 70),
('橙子', 'industry', 'fresh_food', 'fresh_green', 70),
('葡萄', 'industry', 'fresh_food', 'fresh_green', 70),
('草莓', 'industry', 'fresh_food', 'sweet_pink', 70),
('西瓜', 'industry', 'fresh_food', 'fresh_green', 70),
('芒果', 'industry', 'fresh_food', 'fresh_green', 70),
('车厘子', 'industry', 'fresh_food', 'fresh_green', 70),
('樱桃', 'industry', 'fresh_food', 'sweet_pink', 70),
('蓝莓', 'industry', 'fresh_food', 'fresh_green', 70),
('猕猴桃', 'industry', 'fresh_food', 'fresh_green', 70),
('榴莲', 'industry', 'fresh_food', 'fresh_green', 70),
('西红柿', 'industry', 'fresh_food', 'fresh_green', 70),
('黄瓜', 'industry', 'fresh_food', 'fresh_green', 70),
('土豆', 'industry', 'fresh_food', 'fresh_green', 70),
('白菜', 'industry', 'fresh_food', 'fresh_green', 70),
('青菜', 'industry', 'fresh_food', 'fresh_green', 70),
('菠菜', 'industry', 'fresh_food', 'fresh_green', 70),
('胡萝卜', 'industry', 'fresh_food', 'fresh_green', 70),
('玉米', 'industry', 'fresh_food', 'fresh_green', 70),
('南瓜', 'industry', 'fresh_food', 'fresh_green', 70),
('茄子', 'industry', 'fresh_food', 'fresh_green', 70),
('辣椒', 'industry', 'fresh_food', 'fresh_green', 70),
('大蒜', 'industry', 'fresh_food', 'fresh_green', 70),
('洋葱', 'industry', 'fresh_food', 'fresh_green', 70),
('新鲜', 'style', 'fresh', 'fresh_green', 80),
('健康', 'style', 'fresh', 'fresh_green', 70),
('绿色', 'style', 'fresh', 'fresh_green', 70),
('天然', 'style', 'fresh', 'organic_natural', 70),

-- 海鲜水产关键词
('海鲜', 'industry', 'seafood', 'ocean_blue', 100),
('水产', 'industry', 'seafood', 'ocean_blue', 100),
('鱼', 'industry', 'seafood', 'ocean_blue', 80),
('虾', 'industry', 'seafood', 'ocean_blue', 80),
('蟹', 'industry', 'seafood', 'ocean_blue', 80),
('螃蟹', 'industry', 'seafood', 'ocean_blue', 80),
('龙虾', 'industry', 'seafood', 'ocean_blue', 80),
('大虾', 'industry', 'seafood', 'ocean_blue', 80),
('对虾', 'industry', 'seafood', 'ocean_blue', 80),
('基围虾', 'industry', 'seafood', 'ocean_blue', 70),
('皮皮虾', 'industry', 'seafood', 'ocean_blue', 70),
('鲍鱼', 'industry', 'seafood', 'ocean_blue', 70),
('海参', 'industry', 'seafood', 'ocean_blue', 70),
('扇贝', 'industry', 'seafood', 'ocean_blue', 70),
('生蚝', 'industry', 'seafood', 'ocean_blue', 70),
('牡蛎', 'industry', 'seafood', 'ocean_blue', 70),
('蛤蜊', 'industry', 'seafood', 'ocean_blue', 70),
('花甲', 'industry', 'seafood', 'ocean_blue', 70),
('鱿鱼', 'industry', 'seafood', 'ocean_blue', 70),
('章鱼', 'industry', 'seafood', 'ocean_blue', 70),
('墨鱼', 'industry', 'seafood', 'ocean_blue', 70),
('三文鱼', 'industry', 'seafood', 'ocean_blue', 70),
('金枪鱼', 'industry', 'seafood', 'ocean_blue', 70),
('鳗鱼', 'industry', 'seafood', 'ocean_blue', 70),
('带鱼', 'industry', 'seafood', 'ocean_blue', 70),
('黄花鱼', 'industry', 'seafood', 'ocean_blue', 70),
('鲈鱼', 'industry', 'seafood', 'ocean_blue', 70),
('海洋', 'style', 'fresh', 'ocean_blue', 80),
('冰鲜', 'style', 'fresh', 'ocean_blue', 80),
('深海', 'style', 'fresh', 'ocean_blue', 70),

-- 甜品烘焙关键词
('甜品', 'industry', 'dessert', 'sweet_pink', 100),
('蛋糕', 'industry', 'dessert', 'sweet_pink', 100),
('烘焙', 'industry', 'dessert', 'sweet_pink', 100),
('面包', 'industry', 'dessert', 'sweet_pink', 90),
('点心', 'industry', 'dessert', 'sweet_pink', 80),
('糕点', 'industry', 'dessert', 'sweet_pink', 80),
('饼干', 'industry', 'dessert', 'sweet_pink', 70),
('曲奇', 'industry', 'dessert', 'sweet_pink', 70),
('马卡龙', 'industry', 'dessert', 'sweet_pink', 70),
('泡芙', 'industry', 'dessert', 'sweet_pink', 70),
('慕斯', 'industry', 'dessert', 'sweet_pink', 70),
('芝士', 'industry', 'dessert', 'sweet_pink', 70),
('提拉米苏', 'industry', 'dessert', 'sweet_pink', 70),
('布丁', 'industry', 'dessert', 'sweet_pink', 70),
('冰淇淋', 'industry', 'dessert', 'sweet_pink', 70),
('奶茶', 'industry', 'dessert', 'sweet_pink', 70),
('咖啡', 'industry', 'dessert', 'sweet_pink', 60),
('巧克力', 'industry', 'dessert', 'sweet_pink', 70),
('糖果', 'industry', 'dessert', 'sweet_pink', 70),
('甜蜜', 'style', 'warm', 'sweet_pink', 80),
('温馨', 'style', 'warm', 'sweet_pink', 80),
('可爱', 'style', 'warm', 'sweet_pink', 70),

-- 高端礼品关键词
('礼品', 'industry', 'gift', 'classic_gold', 100),
('礼物', 'industry', 'gift', 'classic_gold', 100),
('礼盒', 'industry', 'gift', 'classic_gold', 100),
('送礼', 'industry', 'gift', 'classic_gold', 90),
('高端', 'industry', 'gift', 'classic_gold', 90),
('奢华', 'industry', 'gift', 'classic_gold', 90),
('豪华', 'industry', 'gift', 'classic_gold', 80),
('精品', 'industry', 'gift', 'classic_gold', 80),
('名牌', 'industry', 'gift', 'classic_gold', 70),
('进口', 'industry', 'gift', 'classic_gold', 70),
('特产', 'industry', 'gift', 'classic_gold', 60),
('年货', 'industry', 'gift', 'dopamine_orange', 70),
('节日', 'industry', 'gift', 'dopamine_orange', 70),
('春节', 'industry', 'gift', 'dopamine_orange', 70),
('中秋', 'industry', 'gift', 'classic_gold', 70),
('尊贵', 'style', 'luxury', 'classic_gold', 80),
('大气', 'style', 'luxury', 'classic_gold', 70),
('典雅', 'style', 'luxury', 'classic_gold', 70),
('金色', 'style', 'luxury', 'classic_gold', 80),

-- 母婴用品关键词
('母婴', 'industry', 'baby', 'baby_warm', 100),
('婴儿', 'industry', 'baby', 'baby_warm', 100),
('宝宝', 'industry', 'baby', 'baby_warm', 100),
('儿童', 'industry', 'baby', 'baby_warm', 90),
('孕妇', 'industry', 'baby', 'baby_warm', 80),
('孕婴', 'industry', 'baby', 'baby_warm', 80),
('奶粉', 'industry', 'baby', 'baby_warm', 70),
('纸尿裤', 'industry', 'baby', 'baby_warm', 70),
('尿不湿', 'industry', 'baby', 'baby_warm', 70),
('奶瓶', 'industry', 'baby', 'baby_warm', 70),
('童装', 'industry', 'baby', 'baby_warm', 70),
('玩具', 'industry', 'baby', 'baby_warm', 70),
('婴儿车', 'industry', 'baby', 'baby_warm', 70),
('安全座椅', 'industry', 'baby', 'baby_warm', 70),
('辅食', 'industry', 'baby', 'baby_warm', 70),
('关爱', 'style', 'warm', 'baby_warm', 80),
('呵护', 'style', 'warm', 'baby_warm', 80),
('安全', 'style', 'warm', 'baby_warm', 80),

-- 数码科技关键词
('数码', 'industry', 'tech', 'tech_blue', 100),
('电子', 'industry', 'tech', 'tech_blue', 100),
('科技', 'industry', 'tech', 'tech_blue', 100),
('手机', 'industry', 'tech', 'tech_blue', 90),
('电脑', 'industry', 'tech', 'tech_blue', 90),
('平板', 'industry', 'tech', 'tech_blue', 80),
('耳机', 'industry', 'tech', 'tech_blue', 80),
('音响', 'industry', 'tech', 'tech_blue', 70),
('相机', 'industry', 'tech', 'tech_blue', 70),
('智能', 'industry', 'tech', 'tech_blue', 80),
('数据线', 'industry', 'tech', 'tech_blue', 60),
('充电器', 'industry', 'tech', 'tech_blue', 60),
('键盘', 'industry', 'tech', 'tech_blue', 60),
('鼠标', 'industry', 'tech', 'tech_blue', 60),
('显示器', 'industry', 'tech', 'tech_blue', 70),
('现代', 'style', 'minimal', 'tech_blue', 80),
('简约', 'style', 'minimal', 'tech_blue', 80),
('极简', 'style', 'minimal', 'minimal_white', 90),
('专业', 'style', 'minimal', 'tech_blue', 70),

-- 美妆护肤关键词
('美妆', 'industry', 'beauty', 'beauty_rose', 100),
('护肤', 'industry', 'beauty', 'beauty_rose', 100),
('化妆品', 'industry', 'beauty', 'beauty_rose', 100),
('口红', 'industry', 'beauty', 'beauty_rose', 80),
('眼影', 'industry', 'beauty', 'beauty_rose', 70),
('粉底', 'industry', 'beauty', 'beauty_rose', 70),
('面膜', 'industry', 'beauty', 'beauty_rose', 80),
('精华', 'industry', 'beauty', 'beauty_rose', 80),
('乳液', 'industry', 'beauty', 'beauty_rose', 70),
('水乳', 'industry', 'beauty', 'beauty_rose', 70),
('防晒', 'industry', 'beauty', 'beauty_rose', 70),
('香水', 'industry', 'beauty', 'beauty_rose', 70),
('美白', 'industry', 'beauty', 'beauty_rose', 70),
('抗衰', 'industry', 'beauty', 'beauty_rose', 70),
('精致', 'style', 'luxury', 'beauty_rose', 80),
('优雅', 'style', 'luxury', 'beauty_rose', 80),
('时尚', 'style', 'luxury', 'beauty_rose', 70),

-- 促销活动关键词
('促销', 'style', 'dopamine', 'dopamine_orange', 100),
('打折', 'style', 'dopamine', 'dopamine_orange', 100),
('优惠', 'style', 'dopamine', 'dopamine_orange', 100),
('特价', 'style', 'dopamine', 'dopamine_orange', 90),
('秒杀', 'style', 'dopamine', 'dopamine_orange', 90),
('团购', 'style', 'dopamine', 'dopamine_orange', 80),
('满减', 'style', 'dopamine', 'dopamine_orange', 80),
('折扣', 'style', 'dopamine', 'dopamine_orange', 80),
('抢购', 'style', 'dopamine', 'dopamine_orange', 80),
('活动', 'style', 'dopamine', 'dopamine_orange', 70),
('双11', 'style', 'dopamine', 'dopamine_orange', 90),
('618', 'style', 'dopamine', 'dopamine_orange', 90),
('年终', 'style', 'dopamine', 'dopamine_orange', 70),
('清仓', 'style', 'dopamine', 'dopamine_orange', 70),

-- 通用风格关键词
('清新', 'style', 'fresh', 'fresh_green', 100),
('自然', 'style', 'fresh', 'organic_natural', 90),
('简洁', 'style', 'minimal', 'minimal_white', 90),
('简单', 'style', 'minimal', 'minimal_white', 80),
('高级', 'style', 'luxury', 'classic_gold', 80),
('活力', 'style', 'dopamine', 'dopamine_orange', 80),
('热情', 'style', 'dopamine', 'dopamine_orange', 70),
('潮流', 'style', 'dopamine', 'dopamine_orange', 70);

-- 更新统计：共插入约200个关键词映射
-- 实际使用中可根据需要继续扩展

-- ============================================
-- 扩展AI装修会话表（支持引导式流程）
-- ============================================

ALTER TABLE ai_decoration_session
ADD COLUMN IF NOT EXISTS current_step INT DEFAULT NULL COMMENT '当前引导步骤：1-4',
ADD COLUMN IF NOT EXISTS selected_industry VARCHAR(50) DEFAULT NULL COMMENT '选择的行业类型',
ADD COLUMN IF NOT EXISTS selected_style VARCHAR(50) DEFAULT NULL COMMENT '选择的风格类型',
ADD COLUMN IF NOT EXISTS selected_theme_code VARCHAR(50) DEFAULT NULL COMMENT '选择的主题编码',
ADD COLUMN IF NOT EXISTS selected_layout_id BIGINT DEFAULT NULL COMMENT '选择的布局ID',
ADD COLUMN IF NOT EXISTS guide_data TEXT DEFAULT NULL COMMENT '引导过程中间数据JSON';
