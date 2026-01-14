-- =============================================
-- V3.3: 为主题预设添加素材关联字段
-- 用于关联推荐的图片、布局、组件样式、图标、字体
-- 执行时间: 2026-01-14
-- =============================================

-- 1. 添加素材关联字段到 decoration_theme_preset 表
ALTER TABLE decoration_theme_preset
ADD COLUMN recommended_images TEXT COMMENT '推荐图片ID列表JSON' AFTER recommended_modules,
ADD COLUMN recommended_component_styles TEXT COMMENT '推荐组件样式JSON' AFTER recommended_images,
ADD COLUMN recommended_layout_id BIGINT COMMENT '推荐布局预设ID' AFTER recommended_component_styles,
ADD COLUMN recommended_icons TEXT COMMENT '推荐图标JSON' AFTER recommended_layout_id,
ADD COLUMN recommended_fonts TEXT COMMENT '推荐字体样式JSON' AFTER recommended_icons;

-- 2. 创建布局预设表（如果不存在）
CREATE TABLE IF NOT EXISTS decoration_layout_preset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '布局名称',
    code VARCHAR(50) NOT NULL UNIQUE COMMENT '布局编码',
    description VARCHAR(500) COMMENT '布局描述',
    preview_image VARCHAR(500) COMMENT '预览图URL',
    layout_config TEXT COMMENT '布局配置JSON',
    industry_tags VARCHAR(200) COMMENT '适用行业标签',
    status TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    sort_order INT DEFAULT 0 COMMENT '排序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT '布局预设表';

-- 3. 插入布局预设数据
INSERT INTO decoration_layout_preset (id, name, code, description, industry_tags, status, sort_order) VALUES
(1, '标准电商布局', 'standard_ecommerce', '适合大多数电商场景的标准布局，包含搜索、轮播、分类、商品列表', '通用,电商', 1, 1),
(2, '生鲜专属布局', 'fresh_layout', '针对生鲜行业优化的布局，突出新鲜度和限时促销', '生鲜,水果,蔬菜', 1, 2),
(3, '高端礼品布局', 'premium_layout', '奢华大气的布局，适合高端礼品和奢侈品展示', '礼品,奢侈品,高端', 1, 3),
(4, '海洋水产布局', 'ocean_layout', '海洋风格布局，突出产品新鲜和产地溯源', '海鲜,水产', 1, 4),
(5, '甜品烘焙布局', 'dessert_layout', '温馨甜美的布局，适合甜品蛋糕店', '甜品,蛋糕,烘焙', 1, 5),
(6, '母婴温馨布局', 'baby_layout', '温馨安全的布局，适合母婴用品展示', '母婴,儿童', 1, 6),
(7, '科技数码布局', 'tech_layout', '简洁现代的布局，突出科技感和参数展示', '科技,数码,电子', 1, 7),
(8, '促销活动布局', 'promo_layout', '强调促销氛围的布局，突出优惠信息', '促销,活动', 1, 8),
(9, '极简白净布局', 'minimal_layout', '极简风格布局，留白较多，突出产品', '极简,艺术,设计', 1, 9),
(10, '自然有机布局', 'nature_layout', '自然风格布局，适合有机健康产品', '有机,健康,自然', 1, 10),
(11, '茶饮咖啡布局', 'beverage_layout', '适合茶饮咖啡店的氛围布局', '茶饮,咖啡', 1, 11),
(12, '宠物用品布局', 'pet_layout', '可爱活泼的布局，适合宠物用品店', '宠物,萌宠', 1, 12),
(13, '夜间深色布局', 'dark_layout', '深色背景布局，适合夜间模式或高端产品', '通用,高端', 1, 13),
(14, '节日庆典布局', 'festival_layout', '喜庆氛围布局，适合节日促销', '节日,庆典', 1, 14),
(15, '图片画廊布局', 'gallery_layout', '突出图片展示的画廊式布局', '艺术,摄影,设计', 1, 15)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- =============================================
-- 4. 为15套主题添加素材推荐数据
-- =============================================

-- 4.1 清新绿主题 (fresh_green) - 生鲜专属
UPDATE decoration_theme_preset SET
    recommended_layout_id = 2,
    recommended_images = '{"banners": ["fresh_banner_01", "fresh_banner_02", "fresh_banner_03"], "backgrounds": ["fresh_bg_green", "fresh_bg_nature"], "icons": ["leaf", "organic", "fresh"]}',
    recommended_component_styles = '{"card": {"borderRadius": "12px", "shadow": "0 2px 8px rgba(82,196,26,0.15)"}, "button": {"borderRadius": "20px", "gradient": "linear-gradient(135deg, #52c41a, #389e0d)"}, "badge": {"background": "#52c41a", "color": "#fff"}}',
    recommended_icons = '{"category": "line", "pack": "fresh-icons", "list": ["icon-leaf", "icon-fruit", "icon-vegetable", "icon-organic", "icon-fresh-tag"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "600", "size": "18px"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "DIN Alternate", "weight": "700", "size": "20px", "color": "#52c41a"}}'
WHERE code = 'fresh_green';

-- 4.2 经典金主题 (classic_gold) - 高端礼品
UPDATE decoration_theme_preset SET
    recommended_layout_id = 3,
    recommended_images = '{"banners": ["gold_banner_luxury", "gold_banner_gift", "gold_banner_premium"], "backgrounds": ["gold_bg_dark", "gold_bg_texture"], "icons": ["crown", "diamond", "gift"]}',
    recommended_component_styles = '{"card": {"borderRadius": "4px", "border": "1px solid #d4af37", "shadow": "0 4px 12px rgba(212,175,55,0.2)"}, "button": {"borderRadius": "2px", "background": "#d4af37", "color": "#1a1a1a"}, "badge": {"background": "#d4af37", "color": "#1a1a1a"}}',
    recommended_icons = '{"category": "solid", "pack": "luxury-icons", "list": ["icon-crown", "icon-diamond", "icon-gift-box", "icon-premium", "icon-vip"]}',
    recommended_fonts = '{"title": {"family": "Playfair Display", "weight": "700", "size": "20px", "letterSpacing": "2px"}, "body": {"family": "PingFang SC", "weight": "300", "size": "14px"}, "price": {"family": "Didot", "weight": "400", "size": "22px", "color": "#d4af37"}}'
WHERE code = 'classic_gold';

-- 4.3 海洋蓝主题 (ocean_blue) - 海鲜水产
UPDATE decoration_theme_preset SET
    recommended_layout_id = 4,
    recommended_images = '{"banners": ["ocean_banner_sea", "ocean_banner_wave", "ocean_banner_fish"], "backgrounds": ["ocean_bg_wave", "ocean_bg_deep"], "icons": ["fish", "shrimp", "crab"]}',
    recommended_component_styles = '{"card": {"borderRadius": "16px", "background": "linear-gradient(180deg, #e6f7ff 0%, #ffffff 100%)", "shadow": "0 4px 16px rgba(24,144,255,0.12)"}, "button": {"borderRadius": "24px", "background": "#1890ff"}, "badge": {"background": "#1890ff", "color": "#fff"}}',
    recommended_icons = '{"category": "line", "pack": "ocean-icons", "list": ["icon-fish", "icon-shrimp", "icon-crab", "icon-wave", "icon-anchor"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "600", "size": "18px", "color": "#0050b3"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "DIN Alternate", "weight": "700", "size": "20px", "color": "#1890ff"}}'
WHERE code = 'ocean_blue';

-- 4.4 甜美粉主题 (sweet_pink) - 甜品烘焙
UPDATE decoration_theme_preset SET
    recommended_layout_id = 5,
    recommended_images = '{"banners": ["pink_banner_cake", "pink_banner_dessert", "pink_banner_sweet"], "backgrounds": ["pink_bg_gradient", "pink_bg_pattern"], "icons": ["cake", "cookie", "candy"]}',
    recommended_component_styles = '{"card": {"borderRadius": "20px", "background": "#fff", "shadow": "0 4px 20px rgba(255,105,180,0.15)"}, "button": {"borderRadius": "25px", "background": "linear-gradient(135deg, #ff69b4, #ff1493)"}, "badge": {"background": "#ff69b4", "color": "#fff", "borderRadius": "10px"}}',
    recommended_icons = '{"category": "filled", "pack": "sweet-icons", "list": ["icon-cake", "icon-cupcake", "icon-cookie", "icon-candy", "icon-heart"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "500", "size": "18px"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "Comic Sans MS", "weight": "700", "size": "18px", "color": "#ff1493"}}'
WHERE code = 'sweet_pink';

-- 4.5 母婴暖主题 (baby_warm) - 母婴用品
UPDATE decoration_theme_preset SET
    recommended_layout_id = 6,
    recommended_images = '{"banners": ["baby_banner_warm", "baby_banner_family", "baby_banner_care"], "backgrounds": ["baby_bg_soft", "baby_bg_cloud"], "icons": ["baby", "heart", "star"]}',
    recommended_component_styles = '{"card": {"borderRadius": "16px", "background": "#fffbf0", "shadow": "0 2px 12px rgba(250,173,20,0.1)"}, "button": {"borderRadius": "20px", "background": "#faad14"}, "badge": {"background": "#faad14", "color": "#fff"}}',
    recommended_icons = '{"category": "cute", "pack": "baby-icons", "list": ["icon-baby", "icon-bottle", "icon-teddy", "icon-star", "icon-moon"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "500", "size": "17px"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "PingFang SC", "weight": "600", "size": "18px", "color": "#fa8c16"}}'
WHERE code = 'baby_warm';

-- 4.6 科技蓝主题 (tech_blue) - 科技数码
UPDATE decoration_theme_preset SET
    recommended_layout_id = 7,
    recommended_images = '{"banners": ["tech_banner_digital", "tech_banner_gadget", "tech_banner_future"], "backgrounds": ["tech_bg_grid", "tech_bg_circuit"], "icons": ["cpu", "phone", "laptop"]}',
    recommended_component_styles = '{"card": {"borderRadius": "8px", "background": "#f0f5ff", "border": "1px solid #adc6ff"}, "button": {"borderRadius": "4px", "background": "#2f54eb"}, "badge": {"background": "#2f54eb", "color": "#fff"}}',
    recommended_icons = '{"category": "line", "pack": "tech-icons", "list": ["icon-cpu", "icon-phone", "icon-laptop", "icon-chip", "icon-wifi"]}',
    recommended_fonts = '{"title": {"family": "SF Pro Display", "weight": "600", "size": "18px"}, "body": {"family": "SF Pro Text", "weight": "400", "size": "14px"}, "price": {"family": "SF Mono", "weight": "600", "size": "20px", "color": "#2f54eb"}}'
WHERE code = 'tech_blue';

-- 4.7 活力橙主题 (dopamine_orange) - 促销活动
UPDATE decoration_theme_preset SET
    recommended_layout_id = 8,
    recommended_images = '{"banners": ["orange_banner_sale", "orange_banner_hot", "orange_banner_promo"], "backgrounds": ["orange_bg_fire", "orange_bg_burst"], "icons": ["fire", "lightning", "gift"]}',
    recommended_component_styles = '{"card": {"borderRadius": "12px", "background": "linear-gradient(135deg, #fff7e6 0%, #fff 100%)", "border": "2px solid #fa8c16"}, "button": {"borderRadius": "25px", "background": "linear-gradient(135deg, #fa8c16, #ff4d4f)", "animation": "pulse"}, "badge": {"background": "#ff4d4f", "color": "#fff"}}',
    recommended_icons = '{"category": "animated", "pack": "promo-icons", "list": ["icon-fire", "icon-lightning", "icon-hot", "icon-sale", "icon-gift"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "800", "size": "20px", "color": "#ff4d4f"}, "body": {"family": "PingFang SC", "weight": "500", "size": "14px"}, "price": {"family": "Impact", "weight": "400", "size": "24px", "color": "#ff4d4f"}}'
WHERE code = 'dopamine_orange';

-- 4.8 简约白主题 (minimal_white) - 极简风格
UPDATE decoration_theme_preset SET
    recommended_layout_id = 9,
    recommended_images = '{"banners": ["minimal_banner_clean", "minimal_banner_white", "minimal_banner_space"], "backgrounds": ["minimal_bg_white", "minimal_bg_gray"], "icons": ["circle", "square", "line"]}',
    recommended_component_styles = '{"card": {"borderRadius": "0", "background": "#fff", "border": "1px solid #e8e8e8"}, "button": {"borderRadius": "0", "background": "#000", "color": "#fff"}, "badge": {"background": "#000", "color": "#fff"}}',
    recommended_icons = '{"category": "minimal", "pack": "minimal-icons", "list": ["icon-plus", "icon-minus", "icon-arrow", "icon-dot", "icon-line"]}',
    recommended_fonts = '{"title": {"family": "Helvetica Neue", "weight": "300", "size": "24px", "letterSpacing": "4px"}, "body": {"family": "Helvetica Neue", "weight": "300", "size": "13px"}, "price": {"family": "Helvetica Neue", "weight": "400", "size": "18px", "color": "#000"}}'
WHERE code = 'minimal_white';

-- 4.9 自然绿主题 (nature_green) - 有机健康
UPDATE decoration_theme_preset SET
    recommended_layout_id = 10,
    recommended_images = '{"banners": ["nature_banner_forest", "nature_banner_leaf", "nature_banner_organic"], "backgrounds": ["nature_bg_leaves", "nature_bg_wood"], "icons": ["leaf", "tree", "sun"]}',
    recommended_component_styles = '{"card": {"borderRadius": "8px", "background": "#f6ffed", "border": "1px solid #b7eb8f"}, "button": {"borderRadius": "20px", "background": "#73d13d"}, "badge": {"background": "#73d13d", "color": "#fff"}}',
    recommended_icons = '{"category": "organic", "pack": "nature-icons", "list": ["icon-leaf", "icon-tree", "icon-sun", "icon-flower", "icon-seed"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "500", "size": "18px", "color": "#237804"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "PingFang SC", "weight": "600", "size": "18px", "color": "#52c41a"}}'
WHERE code = 'nature_green';

-- 4.10 茶韵棕主题 (tea_brown) - 茶饮咖啡
UPDATE decoration_theme_preset SET
    recommended_layout_id = 11,
    recommended_images = '{"banners": ["tea_banner_brew", "tea_banner_leaf", "tea_banner_cup"], "backgrounds": ["tea_bg_wood", "tea_bg_paper"], "icons": ["tea", "cup", "leaf"]}',
    recommended_component_styles = '{"card": {"borderRadius": "8px", "background": "#fffbe6", "border": "1px solid #d4b896"}, "button": {"borderRadius": "4px", "background": "#8b5a2b"}, "badge": {"background": "#8b5a2b", "color": "#fff"}}',
    recommended_icons = '{"category": "classic", "pack": "tea-icons", "list": ["icon-teapot", "icon-teacup", "icon-tea-leaf", "icon-coffee", "icon-steam"]}',
    recommended_fonts = '{"title": {"family": "STKaiti", "weight": "400", "size": "20px"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "PingFang SC", "weight": "600", "size": "18px", "color": "#8b5a2b"}}'
WHERE code = 'tea_brown';

-- 4.11 萌宠粉主题 (pet_pink) - 宠物用品
UPDATE decoration_theme_preset SET
    recommended_layout_id = 12,
    recommended_images = '{"banners": ["pet_banner_cute", "pet_banner_paw", "pet_banner_love"], "backgrounds": ["pet_bg_paw", "pet_bg_hearts"], "icons": ["paw", "bone", "heart"]}',
    recommended_component_styles = '{"card": {"borderRadius": "24px", "background": "#fff0f6", "shadow": "0 4px 16px rgba(235,47,150,0.1)"}, "button": {"borderRadius": "30px", "background": "linear-gradient(135deg, #eb2f96, #722ed1)"}, "badge": {"background": "#eb2f96", "color": "#fff", "borderRadius": "12px"}}',
    recommended_icons = '{"category": "cute", "pack": "pet-icons", "list": ["icon-paw", "icon-bone", "icon-cat", "icon-dog", "icon-heart"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "600", "size": "18px"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "PingFang SC", "weight": "700", "size": "18px", "color": "#eb2f96"}}'
WHERE code = 'pet_pink';

-- 4.12 深夜黑主题 (midnight_black) - 夜间模式
UPDATE decoration_theme_preset SET
    recommended_layout_id = 13,
    recommended_images = '{"banners": ["dark_banner_night", "dark_banner_stars", "dark_banner_moon"], "backgrounds": ["dark_bg_gradient", "dark_bg_stars"], "icons": ["moon", "star", "sparkle"]}',
    recommended_component_styles = '{"card": {"borderRadius": "12px", "background": "#1f1f1f", "border": "1px solid #303030"}, "button": {"borderRadius": "8px", "background": "#fff", "color": "#000"}, "badge": {"background": "#fff", "color": "#000"}}',
    recommended_icons = '{"category": "glow", "pack": "dark-icons", "list": ["icon-moon", "icon-star", "icon-sparkle", "icon-night", "icon-lamp"]}',
    recommended_fonts = '{"title": {"family": "PingFang SC", "weight": "500", "size": "18px", "color": "#fff"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px", "color": "#a6a6a6"}, "price": {"family": "DIN Alternate", "weight": "700", "size": "20px", "color": "#fff"}}'
WHERE code = 'midnight_black';

-- 4.13 节日红主题 (festival_red) - 节日庆典
UPDATE decoration_theme_preset SET
    recommended_layout_id = 14,
    recommended_images = '{"banners": ["festival_banner_celebration", "festival_banner_fireworks", "festival_banner_lantern"], "backgrounds": ["festival_bg_red", "festival_bg_golden"], "icons": ["lantern", "firework", "lucky"]}',
    recommended_component_styles = '{"card": {"borderRadius": "8px", "background": "linear-gradient(135deg, #fff1f0 0%, #fff 100%)", "border": "2px solid #ff4d4f"}, "button": {"borderRadius": "8px", "background": "#f5222d", "boxShadow": "0 4px 12px rgba(245,34,45,0.4)"}, "badge": {"background": "#f5222d", "color": "#fff"}}',
    recommended_icons = '{"category": "festive", "pack": "festival-icons", "list": ["icon-lantern", "icon-firework", "icon-lucky-bag", "icon-red-packet", "icon-celebration"]}',
    recommended_fonts = '{"title": {"family": "STHupo", "weight": "400", "size": "22px", "color": "#cf1322"}, "body": {"family": "PingFang SC", "weight": "400", "size": "14px"}, "price": {"family": "PingFang SC", "weight": "800", "size": "22px", "color": "#f5222d"}}'
WHERE code = 'festival_red';

-- 4.14 艺术紫主题 (art_purple) - 艺术设计
UPDATE decoration_theme_preset SET
    recommended_layout_id = 15,
    recommended_images = '{"banners": ["art_banner_gallery", "art_banner_creative", "art_banner_design"], "backgrounds": ["art_bg_gradient", "art_bg_abstract"], "icons": ["palette", "brush", "frame"]}',
    recommended_component_styles = '{"card": {"borderRadius": "0", "background": "#fff", "border": "none", "boxShadow": "0 8px 24px rgba(114,46,209,0.12)"}, "button": {"borderRadius": "0", "background": "linear-gradient(135deg, #722ed1, #eb2f96)"}, "badge": {"background": "#722ed1", "color": "#fff"}}',
    recommended_icons = '{"category": "artistic", "pack": "art-icons", "list": ["icon-palette", "icon-brush", "icon-frame", "icon-camera", "icon-design"]}',
    recommended_fonts = '{"title": {"family": "Didot", "weight": "400", "size": "24px", "letterSpacing": "3px"}, "body": {"family": "Helvetica Neue", "weight": "300", "size": "14px"}, "price": {"family": "Futura", "weight": "500", "size": "18px", "color": "#722ed1"}}'
WHERE code = 'art_purple';

-- 4.15 商务灰主题 (business_gray) - 商务办公
UPDATE decoration_theme_preset SET
    recommended_layout_id = 1,
    recommended_images = '{"banners": ["business_banner_office", "business_banner_corporate", "business_banner_professional"], "backgrounds": ["business_bg_gray", "business_bg_pattern"], "icons": ["briefcase", "chart", "document"]}',
    recommended_component_styles = '{"card": {"borderRadius": "4px", "background": "#fff", "border": "1px solid #d9d9d9"}, "button": {"borderRadius": "4px", "background": "#595959"}, "badge": {"background": "#595959", "color": "#fff"}}',
    recommended_icons = '{"category": "professional", "pack": "business-icons", "list": ["icon-briefcase", "icon-chart", "icon-document", "icon-calendar", "icon-folder"]}',
    recommended_fonts = '{"title": {"family": "SF Pro Display", "weight": "600", "size": "18px"}, "body": {"family": "SF Pro Text", "weight": "400", "size": "14px"}, "price": {"family": "SF Pro Display", "weight": "600", "size": "18px", "color": "#262626"}}'
WHERE code = 'business_gray';

-- =============================================
-- 5. 添加索引优化查询性能
-- =============================================
CREATE INDEX IF NOT EXISTS idx_theme_preset_layout ON decoration_theme_preset(recommended_layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_preset_code ON decoration_layout_preset(code);
CREATE INDEX IF NOT EXISTS idx_layout_preset_status ON decoration_layout_preset(status);

-- =============================================
-- 6. 验证数据完整性
-- =============================================
-- 检查主题预设是否都有推荐布局
SELECT
    t.code AS theme_code,
    t.name AS theme_name,
    t.recommended_layout_id,
    l.name AS layout_name
FROM decoration_theme_preset t
LEFT JOIN decoration_layout_preset l ON t.recommended_layout_id = l.id
WHERE t.status = 1
ORDER BY t.sort_order;
