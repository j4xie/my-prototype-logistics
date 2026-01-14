-- =============================================================================
-- V3.2 - 装修素材资源库
-- 包含：图标库、字体样式、预置图片、组件样式、布局预设
-- =============================================================================

-- =============================================================================
-- 1. 图标素材库
-- =============================================================================

CREATE TABLE IF NOT EXISTS decoration_icon_library (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    icon_name VARCHAR(50) NOT NULL COMMENT '图标名称',
    icon_code VARCHAR(50) NOT NULL COMMENT '图标编码',
    icon_type VARCHAR(30) NOT NULL COMMENT '图标类型：cuIcon/iconfont/svg/image',
    icon_value VARCHAR(255) NOT NULL COMMENT '图标值：class名或URL',
    category VARCHAR(50) COMMENT '分类：category/action/status/social',
    suitable_industries VARCHAR(200) COMMENT '适用行业',
    color_suggestion VARCHAR(50) COMMENT '建议颜色',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_icon_code (icon_code),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图标素材库';

-- 插入图标素材
INSERT INTO decoration_icon_library (icon_name, icon_code, icon_type, icon_value, category, suitable_industries, color_suggestion, sort_order) VALUES
-- 分类图标 - 食品类
('水果', 'fruit', 'cuIcon', 'cuIcon-apple', 'category', 'food,organic', '#52c41a', 1),
('蔬菜', 'vegetable', 'cuIcon', 'cuIcon-flower', 'category', 'food,organic', '#73d13d', 2),
('肉类', 'meat', 'cuIcon', 'cuIcon-hot', 'category', 'food', '#f5222d', 3),
('海鲜', 'seafood', 'cuIcon', 'cuIcon-like', 'category', 'food,seafood', '#1890ff', 4),
('粮油', 'grain', 'cuIcon', 'cuIcon-emoji', 'category', 'food,farm', '#faad14', 5),
('零食', 'snack', 'cuIcon', 'cuIcon-favor', 'category', 'food,snack', '#fa8c16', 6),
('饮料', 'beverage', 'cuIcon', 'cuIcon-flashlightopen', 'category', 'food,beverage', '#13c2c2', 7),
('酒水', 'wine', 'cuIcon', 'cuIcon-wine', 'category', 'food,wine', '#722ed1', 8),

-- 分类图标 - 美妆类
('护肤', 'skincare', 'cuIcon', 'cuIcon-skin', 'category', 'cosmetics', '#eb2f96', 10),
('彩妆', 'makeup', 'cuIcon', 'cuIcon-paint', 'category', 'cosmetics', '#f759ab', 11),
('香水', 'perfume', 'cuIcon', 'cuIcon-magic', 'category', 'cosmetics,gift', '#722ed1', 12),

-- 分类图标 - 母婴类
('奶粉', 'milk_powder', 'cuIcon', 'cuIcon-cup', 'category', 'baby', '#F4C2C2', 20),
('尿裤', 'diaper', 'cuIcon', 'cuIcon-safe', 'category', 'baby', '#FFB6C1', 21),
('玩具', 'toy', 'cuIcon', 'cuIcon-toy', 'category', 'baby,gift', '#fadb14', 22),
('童装', 'kids_clothes', 'cuIcon', 'cuIcon-clothes', 'category', 'baby,fashion', '#ff85c0', 23),

-- 分类图标 - 数码类
('手机', 'phone', 'cuIcon', 'cuIcon-mobile', 'category', 'digital', '#2f54eb', 30),
('电脑', 'computer', 'cuIcon', 'cuIcon-computer', 'category', 'digital', '#1d39c4', 31),
('耳机', 'headphone', 'cuIcon', 'cuIcon-music', 'category', 'digital', '#597ef7', 32),
('相机', 'camera', 'cuIcon', 'cuIcon-camera', 'category', 'digital', '#9254de', 33),

-- 分类图标 - 家居类
('家具', 'furniture', 'cuIcon', 'cuIcon-home', 'category', 'furniture', '#a0522d', 40),
('床品', 'bedding', 'cuIcon', 'cuIcon-moon', 'category', 'furniture', '#d4b896', 41),
('厨具', 'kitchen', 'cuIcon', 'cuIcon-hot', 'category', 'furniture', '#fa541c', 42),
('收纳', 'storage', 'cuIcon', 'cuIcon-apps', 'category', 'furniture', '#8b4513', 43),

-- 功能图标
('搜索', 'search', 'cuIcon', 'cuIcon-search', 'action', 'general', '#333333', 50),
('扫码', 'scan', 'cuIcon', 'cuIcon-scan', 'action', 'general', '#52c41a', 51),
('定位', 'location', 'cuIcon', 'cuIcon-locationfill', 'action', 'general', '#1890ff', 52),
('购物车', 'cart', 'cuIcon', 'cuIcon-cart', 'action', 'general', '#fa8c16', 53),
('客服', 'service', 'cuIcon', 'cuIcon-service', 'action', 'general', '#13c2c2', 54),
('分享', 'share', 'cuIcon', 'cuIcon-share', 'action', 'general', '#1890ff', 55),
('收藏', 'favorite', 'cuIcon', 'cuIcon-favorfill', 'action', 'general', '#f5222d', 56),
('消息', 'message', 'cuIcon', 'cuIcon-message', 'action', 'general', '#faad14', 57),

-- 状态图标
('成功', 'success', 'cuIcon', 'cuIcon-roundcheckfill', 'status', 'general', '#52c41a', 60),
('警告', 'warning', 'cuIcon', 'cuIcon-warnfill', 'status', 'general', '#faad14', 61),
('错误', 'error', 'cuIcon', 'cuIcon-roundclosefill', 'status', 'general', '#f5222d', 62),
('信息', 'info', 'cuIcon', 'cuIcon-infofill', 'status', 'general', '#1890ff', 63),

-- 标签图标
('新品', 'new', 'cuIcon', 'cuIcon-new', 'tag', 'general', '#f5222d', 70),
('热销', 'hot', 'cuIcon', 'cuIcon-hotfill', 'tag', 'general', '#fa541c', 71),
('推荐', 'recommend', 'cuIcon', 'cuIcon-likefill', 'tag', 'general', '#eb2f96', 72),
('优惠', 'discount', 'cuIcon', 'cuIcon-sale', 'tag', 'general', '#faad14', 73);

-- =============================================================================
-- 2. 字体样式库
-- =============================================================================

CREATE TABLE IF NOT EXISTS decoration_font_style (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    style_name VARCHAR(50) NOT NULL COMMENT '样式名称',
    style_code VARCHAR(50) NOT NULL COMMENT '样式编码',
    font_family VARCHAR(100) COMMENT '字体族',
    font_weight VARCHAR(20) COMMENT '字重：normal/bold/100-900',
    font_size VARCHAR(20) COMMENT '字号',
    line_height VARCHAR(20) COMMENT '行高',
    letter_spacing VARCHAR(20) COMMENT '字间距',
    text_transform VARCHAR(20) COMMENT '文本转换：none/uppercase/lowercase',
    usage_type VARCHAR(50) COMMENT '用途：title/subtitle/body/price/tag',
    suitable_themes VARCHAR(200) COMMENT '适用主题',
    sample_text VARCHAR(100) COMMENT '示例文本',
    css_style TEXT COMMENT '完整CSS样式',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_style_code (style_code),
    INDEX idx_usage_type (usage_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字体样式库';

-- 插入字体样式
INSERT INTO decoration_font_style (style_name, style_code, font_family, font_weight, font_size, line_height, letter_spacing, usage_type, suitable_themes, sample_text, css_style, sort_order) VALUES
-- 标题样式
('大标题-粗体', 'title_bold', '-apple-system, BlinkMacSystemFont', 'bold', '36rpx', '1.4', '0', 'title', 'general', '标题文字', '{"fontSize":"36rpx","fontWeight":"bold","lineHeight":"1.4","letterSpacing":"0"}', 1),
('大标题-细体', 'title_light', '-apple-system, BlinkMacSystemFont', '300', '36rpx', '1.4', '2rpx', 'title', 'minimal,elegant', '标题文字', '{"fontSize":"36rpx","fontWeight":"300","lineHeight":"1.4","letterSpacing":"2rpx"}', 2),
('大标题-优雅', 'title_elegant', 'Georgia, serif', '500', '34rpx', '1.5', '4rpx', 'title', 'luxury,tea', '臻选品质', '{"fontSize":"34rpx","fontWeight":"500","lineHeight":"1.5","letterSpacing":"4rpx","fontFamily":"Georgia, serif"}', 3),

-- 副标题样式
('副标题-常规', 'subtitle_normal', '-apple-system, BlinkMacSystemFont', '500', '30rpx', '1.4', '0', 'subtitle', 'general', '副标题文字', '{"fontSize":"30rpx","fontWeight":"500","lineHeight":"1.4"}', 10),
('副标题-轻盈', 'subtitle_light', '-apple-system, BlinkMacSystemFont', '400', '28rpx', '1.5', '1rpx', 'subtitle', 'minimal,baby', '副标题文字', '{"fontSize":"28rpx","fontWeight":"400","lineHeight":"1.5","letterSpacing":"1rpx"}', 11),

-- 正文样式
('正文-标准', 'body_normal', '-apple-system, BlinkMacSystemFont', 'normal', '28rpx', '1.6', '0', 'body', 'general', '这是一段正文内容示例', '{"fontSize":"28rpx","fontWeight":"normal","lineHeight":"1.6"}', 20),
('正文-紧凑', 'body_compact', '-apple-system, BlinkMacSystemFont', 'normal', '26rpx', '1.5', '0', 'body', 'digital,tech', '这是一段正文内容示例', '{"fontSize":"26rpx","fontWeight":"normal","lineHeight":"1.5"}', 21),
('正文-舒展', 'body_relaxed', '-apple-system, BlinkMacSystemFont', 'normal', '28rpx', '1.8', '1rpx', 'body', 'luxury,tea', '这是一段正文内容示例', '{"fontSize":"28rpx","fontWeight":"normal","lineHeight":"1.8","letterSpacing":"1rpx"}', 22),

-- 价格样式
('价格-醒目', 'price_bold', '-apple-system, BlinkMacSystemFont', 'bold', '32rpx', '1', '0', 'price', 'general', '¥99.00', '{"fontSize":"32rpx","fontWeight":"bold","color":"#e74c3c"}', 30),
('价格-紧凑', 'price_compact', '-apple-system, BlinkMacSystemFont', 'bold', '28rpx', '1', '-1rpx', 'price', 'digital,fashion', '¥99.00', '{"fontSize":"28rpx","fontWeight":"bold","color":"#f5222d","letterSpacing":"-1rpx"}', 31),
('价格-优雅', 'price_elegant', 'Georgia, serif', '500', '30rpx', '1', '0', 'price', 'luxury,gift', '¥999.00', '{"fontSize":"30rpx","fontWeight":"500","color":"#8B4513","fontFamily":"Georgia, serif"}', 32),

-- 标签样式
('标签-圆角', 'tag_rounded', '-apple-system, BlinkMacSystemFont', '500', '20rpx', '1', '0', 'tag', 'general', '热销', '{"fontSize":"20rpx","fontWeight":"500","padding":"4rpx 12rpx","borderRadius":"20rpx"}', 40),
('标签-方角', 'tag_square', '-apple-system, BlinkMacSystemFont', '500', '20rpx', '1', '0', 'tag', 'digital,tech', '新品', '{"fontSize":"20rpx","fontWeight":"500","padding":"4rpx 8rpx","borderRadius":"4rpx"}', 41),
('标签-渐变', 'tag_gradient', '-apple-system, BlinkMacSystemFont', 'bold', '22rpx', '1', '0', 'tag', 'fashion,festival', '限时', '{"fontSize":"22rpx","fontWeight":"bold","background":"linear-gradient(90deg, #f5222d, #fa8c16)","color":"#fff"}', 42);

-- =============================================================================
-- 3. 预置图片素材库
-- =============================================================================

CREATE TABLE IF NOT EXISTS decoration_image_library (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_name VARCHAR(100) NOT NULL COMMENT '图片名称',
    image_code VARCHAR(50) NOT NULL COMMENT '图片编码',
    image_type VARCHAR(30) NOT NULL COMMENT '类型：banner/icon/background/placeholder',
    image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
    thumbnail_url VARCHAR(500) COMMENT '缩略图URL',
    width INT COMMENT '宽度',
    height INT COMMENT '高度',
    file_size INT COMMENT '文件大小KB',
    category VARCHAR(50) COMMENT '分类',
    suitable_industries VARCHAR(200) COMMENT '适用行业',
    tags VARCHAR(200) COMMENT '标签',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_image_code (image_code),
    INDEX idx_image_type (image_type),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预置图片素材库';

-- 插入预置图片（占位符，实际URL需要替换）
INSERT INTO decoration_image_library (image_name, image_code, image_type, image_url, width, height, category, suitable_industries, tags, sort_order) VALUES
-- Banner图片
('生鲜蔬果Banner', 'banner_fresh_fruit', 'banner', '/public/img/banners/fresh_fruit.jpg', 750, 320, 'banner', 'food,organic', '生鲜,水果,蔬菜', 1),
('海鲜特惠Banner', 'banner_seafood', 'banner', '/public/img/banners/seafood.jpg', 750, 320, 'banner', 'seafood,food', '海鲜,水产,特惠', 2),
('美妆护肤Banner', 'banner_cosmetics', 'banner', '/public/img/banners/cosmetics.jpg', 750, 320, 'banner', 'cosmetics', '美妆,护肤,彩妆', 3),
('母婴专区Banner', 'banner_baby', 'banner', '/public/img/banners/baby.jpg', 750, 320, 'banner', 'baby', '母婴,宝宝,儿童', 4),
('数码家电Banner', 'banner_digital', 'banner', '/public/img/banners/digital.jpg', 750, 320, 'banner', 'digital', '数码,家电,科技', 5),
('年货大街Banner', 'banner_newyear', 'banner', '/public/img/banners/newyear.jpg', 750, 320, 'banner', 'festival', '年货,节日,促销', 6),
('春季新品Banner', 'banner_spring', 'banner', '/public/img/banners/spring.jpg', 750, 320, 'banner', 'fashion,general', '春季,新品,上新', 7),
('夏日清凉Banner', 'banner_summer', 'banner', '/public/img/banners/summer.jpg', 750, 320, 'banner', 'food,beverage', '夏日,清凉,冰爽', 8),

-- 背景图片
('清新绿背景', 'bg_fresh_green', 'background', '/public/img/backgrounds/fresh_green.png', 750, 1000, 'background', 'food,organic', '绿色,清新,自然', 20),
('金色纹理背景', 'bg_gold_texture', 'background', '/public/img/backgrounds/gold_texture.png', 750, 1000, 'background', 'luxury,gift', '金色,纹理,高端', 21),
('粉色渐变背景', 'bg_pink_gradient', 'background', '/public/img/backgrounds/pink_gradient.png', 750, 1000, 'background', 'baby,bakery', '粉色,渐变,温馨', 22),
('深色科技背景', 'bg_dark_tech', 'background', '/public/img/backgrounds/dark_tech.png', 750, 1000, 'background', 'digital,fashion', '深色,科技,酷炫', 23),

-- 占位图
('商品默认图', 'placeholder_product', 'placeholder', '/public/img/no_pic.png', 400, 400, 'placeholder', 'general', '占位图,默认', 40),
('头像默认图', 'placeholder_avatar', 'placeholder', '/public/img/avatar_default.png', 200, 200, 'placeholder', 'general', '头像,默认', 41),
('店铺Logo默认', 'placeholder_logo', 'placeholder', '/public/img/logo_default.png', 200, 200, 'placeholder', 'general', 'Logo,默认', 42),

-- 装饰图片
('新品标签', 'deco_new_tag', 'decoration', '/public/img/tags/new.png', 80, 80, 'tag', 'general', '新品,标签', 50),
('热销标签', 'deco_hot_tag', 'decoration', '/public/img/tags/hot.png', 80, 80, 'tag', 'general', '热销,标签', 51),
('推荐标签', 'deco_recommend_tag', 'decoration', '/public/img/tags/recommend.png', 80, 80, 'tag', 'general', '推荐,标签', 52),
('促销角标', 'deco_sale_corner', 'decoration', '/public/img/tags/sale_corner.png', 100, 100, 'tag', 'general', '促销,角标', 53);

-- =============================================================================
-- 4. 组件样式预设库
-- =============================================================================

CREATE TABLE IF NOT EXISTS decoration_component_style (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    component_name VARCHAR(50) NOT NULL COMMENT '组件名称',
    component_code VARCHAR(50) NOT NULL COMMENT '组件编码',
    style_name VARCHAR(50) NOT NULL COMMENT '样式名称',
    style_code VARCHAR(50) NOT NULL COMMENT '样式编码',
    description VARCHAR(200) COMMENT '样式描述',
    css_config TEXT NOT NULL COMMENT 'CSS配置JSON',
    preview_image VARCHAR(255) COMMENT '预览图',
    suitable_themes VARCHAR(200) COMMENT '适用主题',
    suitable_industries VARCHAR(200) COMMENT '适用行业',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_component_style (component_code, style_code),
    INDEX idx_component_code (component_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组件样式预设库';

-- 插入组件样式
INSERT INTO decoration_component_style (component_name, component_code, style_name, style_code, description, css_config, suitable_themes, suitable_industries, sort_order) VALUES
-- 商品卡片样式
('商品卡片', 'goods_card', '经典卡片', 'classic', '经典白底卡片，阴影边框', '{"background":"#ffffff","borderRadius":"16rpx","boxShadow":"0 4rpx 16rpx rgba(0,0,0,0.08)","border":"1rpx solid #f0f0f0","padding":"0"}', 'general', 'general', 1),
('商品卡片', 'goods_card', '无边框', 'borderless', '无边框简约风格', '{"background":"#ffffff","borderRadius":"12rpx","boxShadow":"none","border":"none","padding":"0"}', 'minimal_white', 'fashion,digital', 2),
('商品卡片', 'goods_card', '深色卡片', 'dark', '深色背景卡片', '{"background":"#1f1f1f","borderRadius":"16rpx","boxShadow":"0 4rpx 20rpx rgba(0,0,0,0.3)","border":"1rpx solid #333","color":"#ffffff"}', 'dark_night', 'fashion,digital', 3),
('商品卡片', 'goods_card', '渐变边框', 'gradient_border', '渐变色边框', '{"background":"#ffffff","borderRadius":"16rpx","border":"2rpx solid transparent","backgroundClip":"padding-box","boxShadow":"0 0 0 2rpx var(--primary-color)"}', 'festival_red,dopamine_orange', 'festival,promotion', 4),

-- 按钮样式
('按钮', 'button', '圆角按钮', 'rounded', '全圆角按钮', '{"borderRadius":"40rpx","padding":"16rpx 32rpx","fontSize":"28rpx","fontWeight":"500"}', 'general', 'general', 10),
('按钮', 'button', '方角按钮', 'square', '小圆角方形按钮', '{"borderRadius":"8rpx","padding":"16rpx 32rpx","fontSize":"28rpx","fontWeight":"500"}', 'tech_blue,minimal_white', 'digital,service', 11),
('按钮', 'button', '胶囊按钮', 'capsule', '胶囊形状按钮', '{"borderRadius":"100rpx","padding":"12rpx 40rpx","fontSize":"26rpx","fontWeight":"bold"}', 'sweet_pink,baby_warm', 'baby,bakery', 12),
('按钮', 'button', '渐变按钮', 'gradient', '渐变色背景按钮', '{"borderRadius":"40rpx","padding":"16rpx 32rpx","background":"linear-gradient(90deg, var(--gradient-start), var(--gradient-end))","color":"#ffffff"}', 'festival_red,dopamine_orange', 'festival,promotion', 13),

-- 价格标签样式
('价格', 'price', '醒目红', 'prominent_red', '红色醒目价格', '{"color":"#e74c3c","fontSize":"32rpx","fontWeight":"bold"}', 'general', 'general', 20),
('价格', 'price', '品牌色', 'brand_color', '使用主题品牌色', '{"color":"var(--primary-color)","fontSize":"30rpx","fontWeight":"bold"}', 'general', 'general', 21),
('价格', 'price', '金色价格', 'gold', '金色高端感', '{"color":"#D4AF37","fontSize":"30rpx","fontWeight":"500","fontFamily":"Georgia, serif"}', 'classic_gold,luxury', 'gift,luxury', 22),
('价格', 'price', '橙色促销', 'orange_sale', '橙色促销风格', '{"color":"#fa8c16","fontSize":"34rpx","fontWeight":"bold","textShadow":"0 2rpx 4rpx rgba(250,140,22,0.3)"}', 'dopamine_orange,festival_red', 'festival,promotion', 23),

-- 标签样式
('标签', 'tag', '填充标签', 'filled', '实心填充标签', '{"background":"var(--primary-color)","color":"#ffffff","padding":"4rpx 12rpx","borderRadius":"4rpx","fontSize":"20rpx"}', 'general', 'general', 30),
('标签', 'tag', '描边标签', 'outlined', '描边空心标签', '{"background":"transparent","color":"var(--primary-color)","padding":"4rpx 12rpx","borderRadius":"4rpx","border":"1rpx solid var(--primary-color)","fontSize":"20rpx"}', 'minimal_white,tech_blue', 'digital,service', 31),
('标签', 'tag', '渐变标签', 'gradient', '渐变背景标签', '{"background":"linear-gradient(90deg, #f5222d, #fa8c16)","color":"#ffffff","padding":"4rpx 16rpx","borderRadius":"20rpx","fontSize":"20rpx"}', 'festival_red,dopamine_orange', 'festival,promotion', 32),
('标签', 'tag', '软糖标签', 'soft', '柔和背景标签', '{"background":"rgba(var(--primary-rgb), 0.1)","color":"var(--primary-color)","padding":"6rpx 16rpx","borderRadius":"8rpx","fontSize":"22rpx"}', 'baby_warm,sweet_pink', 'baby,bakery', 33),

-- 通知栏样式
('通知栏', 'notice_bar', '经典样式', 'classic', '经典通知栏', '{"background":"var(--notice-bg)","color":"var(--notice-text)","padding":"16rpx 24rpx","fontSize":"26rpx"}', 'general', 'general', 40),
('通知栏', 'notice_bar', '渐变背景', 'gradient', '渐变色通知栏', '{"background":"linear-gradient(90deg, rgba(var(--primary-rgb),0.1), rgba(var(--primary-rgb),0.05))","color":"var(--primary-color)","padding":"16rpx 24rpx"}', 'dopamine_orange,festival_red', 'festival,promotion', 41),
('通知栏', 'notice_bar', '深色通知', 'dark', '深色背景通知栏', '{"background":"#1a1a1a","color":"#faad14","padding":"16rpx 24rpx","fontSize":"26rpx"}', 'dark_night,classic_gold', 'luxury,fashion', 42);

-- =============================================================================
-- 5. 布局预设库
-- =============================================================================

CREATE TABLE IF NOT EXISTS decoration_layout_preset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    layout_name VARCHAR(50) NOT NULL COMMENT '布局名称',
    layout_code VARCHAR(50) NOT NULL COMMENT '布局编码',
    layout_type VARCHAR(30) NOT NULL COMMENT '布局类型：home/category/detail/list',
    description VARCHAR(200) COMMENT '布局描述',
    modules_config TEXT NOT NULL COMMENT '模块配置JSON',
    preview_image VARCHAR(255) COMMENT '预览图',
    suitable_themes VARCHAR(200) COMMENT '适用主题',
    suitable_industries VARCHAR(200) COMMENT '适用行业',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_layout_code (layout_code),
    INDEX idx_layout_type (layout_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='布局预设库';

-- 插入布局预设
INSERT INTO decoration_layout_preset (layout_name, layout_code, layout_type, description, modules_config, suitable_themes, suitable_industries, sort_order) VALUES
-- 首页布局
('经典首页', 'home_classic', 'home', '顶部导航+公告+分类+Banner+商品列表，适合大多数店铺',
'[{"code":"header_bar","enabled":true,"order":1},{"code":"notice_bar","enabled":true,"order":2},{"code":"category_grid","enabled":true,"order":3,"variant":"square"},{"code":"banner_swiper","enabled":true,"order":4,"variant":"card"},{"code":"quick_actions","enabled":true,"order":5},{"code":"goods_hot_scroll","enabled":true,"order":6},{"code":"goods_recommend_grid","enabled":true,"order":7}]',
'general', 'general', 1),

('生鲜首页', 'home_fresh', 'home', '突出新鲜感的首页布局，适合生鲜蔬果类',
'[{"code":"header_bar","enabled":true,"order":1},{"code":"notice_bar","enabled":true,"order":2,"params":{"text":"每日新鲜直达"}},{"code":"category_grid","enabled":true,"order":3,"variant":"circle"},{"code":"banner_swiper","enabled":true,"order":4,"variant":"card"},{"code":"quick_actions","enabled":true,"order":5},{"code":"goods_hot_scroll","enabled":true,"order":6,"title":"今日鲜货"},{"code":"goods_recommend_grid","enabled":true,"order":7,"title":"应季推荐"}]',
'fresh_green,farm_green', 'food,organic,farm', 2),

('高端首页', 'home_luxury', 'home', '高端大气的首页布局，适合奢侈品礼品类',
'[{"code":"header_bar","enabled":true,"order":1,"variant":"dark"},{"code":"banner_swiper","enabled":true,"order":2,"variant":"fullscreen"},{"code":"category_grid","enabled":true,"order":3,"variant":"large"},{"code":"goods_hot_scroll","enabled":true,"order":4,"variant":"large","title":"臻选推荐"},{"code":"goods_waterfall","enabled":true,"order":5}]',
'classic_gold,dark_night', 'gift,luxury,jewelry', 3),

('促销首页', 'home_promotion', 'home', '促销活动导向的首页布局，突出优惠信息',
'[{"code":"header_bar","enabled":true,"order":1},{"code":"notice_bar","enabled":true,"order":2,"variant":"gradient","params":{"text":"限时特惠进行中"}},{"code":"banner_swiper","enabled":true,"order":3,"variant":"fullscreen"},{"code":"quick_actions","enabled":true,"order":4},{"code":"category_grid","enabled":true,"order":5,"variant":"scroll"},{"code":"goods_hot_scroll","enabled":true,"order":6,"title":"爆款秒杀"},{"code":"goods_recommend_grid","enabled":true,"order":7,"title":"超值优选"}]',
'dopamine_orange,festival_red', 'promotion,festival', 4),

('母婴首页', 'home_baby', 'home', '温馨可爱的首页布局，适合母婴类店铺',
'[{"code":"header_bar","enabled":true,"order":1},{"code":"notice_bar","enabled":true,"order":2,"params":{"text":"用心呵护，陪伴成长"}},{"code":"category_grid","enabled":true,"order":3,"variant":"circle"},{"code":"banner_swiper","enabled":true,"order":4,"variant":"card"},{"code":"goods_hot_scroll","enabled":true,"order":5,"variant":"classic","title":"宝贝热销"},{"code":"goods_recommend_grid","enabled":true,"order":6,"variant":"grid2","title":"精选好物"}]',
'baby_warm,sweet_pink', 'baby,toy', 5),

('科技首页', 'home_tech', 'home', '科技感十足的首页布局，适合数码类店铺',
'[{"code":"header_bar","enabled":true,"order":1,"variant":"dark"},{"code":"banner_swiper","enabled":true,"order":2,"variant":"card3d"},{"code":"category_grid","enabled":true,"order":3,"variant":"square"},{"code":"quick_actions","enabled":true,"order":4},{"code":"goods_hot_scroll","enabled":true,"order":5,"variant":"small","title":"新品首发"},{"code":"goods_recommend_grid","enabled":true,"order":6,"variant":"grid3","title":"热门推荐"}]',
'tech_blue,dark_night', 'digital,electronic', 6),

('美妆首页', 'home_beauty', 'home', '优雅精致的首页布局，适合美妆护肤类',
'[{"code":"header_bar","enabled":true,"order":1},{"code":"notice_bar","enabled":true,"order":2,"params":{"text":"美丽绽放，自信由我"}},{"code":"banner_swiper","enabled":true,"order":3,"variant":"card"},{"code":"category_grid","enabled":true,"order":4,"variant":"circle"},{"code":"goods_hot_scroll","enabled":true,"order":5,"title":"明星单品"},{"code":"goods_recommend_grid","enabled":true,"order":6,"variant":"grid2","title":"美丽推荐"}]',
'beauty_purple,sweet_pink', 'cosmetics,skincare', 7),

('简约首页', 'home_minimal', 'home', '极简风格首页布局，内容精简突出',
'[{"code":"header_bar","enabled":true,"order":1},{"code":"banner_swiper","enabled":true,"order":2,"variant":"card"},{"code":"category_grid","enabled":true,"order":3,"variant":"scroll"},{"code":"goods_recommend_grid","enabled":true,"order":4,"variant":"bigImage"},{"code":"goods_waterfall","enabled":true,"order":5}]',
'minimal_white', 'fashion,furniture', 8);

-- =============================================================================
-- 查看插入结果
-- =============================================================================
SELECT 'decoration_icon_library' AS table_name, COUNT(*) AS count FROM decoration_icon_library
UNION ALL
SELECT 'decoration_font_style', COUNT(*) FROM decoration_font_style
UNION ALL
SELECT 'decoration_image_library', COUNT(*) FROM decoration_image_library
UNION ALL
SELECT 'decoration_component_style', COUNT(*) FROM decoration_component_style
UNION ALL
SELECT 'decoration_layout_preset', COUNT(*) FROM decoration_layout_preset;
