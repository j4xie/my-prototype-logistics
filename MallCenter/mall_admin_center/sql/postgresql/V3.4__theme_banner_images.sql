-- ============================================
-- V3.4: 为15套主题添加Banner图片素材 - PostgreSQL 版本
-- 图片规格: Banner 750x300px, 背景图 750x1334px
-- 创建时间: 2026-01-14
-- Converted from MySQL
-- ============================================

-- 创建图片素材库表（如果不存在）
DROP TABLE IF EXISTS decoration_image_library CASCADE;
CREATE TABLE decoration_image_library (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    image_type VARCHAR(20) NOT NULL,
    industry_type VARCHAR(50),
    style_type VARCHAR(50),
    theme_code VARCHAR(50),
    width INT DEFAULT 750,
    height INT DEFAULT 300,
    format VARCHAR(10) DEFAULT 'jpg',
    file_size INT,
    tags VARCHAR(200),
    description VARCHAR(500),
    status SMALLINT DEFAULT 1,
    sort_order INT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_image_type ON decoration_image_library(image_type);
CREATE INDEX idx_theme_code ON decoration_image_library(theme_code);
CREATE INDEX idx_industry_style ON decoration_image_library(industry_type, style_type);

COMMENT ON TABLE decoration_image_library IS '装修图片素材库';
COMMENT ON COLUMN decoration_image_library.name IS '图片名称';
COMMENT ON COLUMN decoration_image_library.url IS '图片URL';
COMMENT ON COLUMN decoration_image_library.image_type IS '图片类型: banner/background/icon/product';
COMMENT ON COLUMN decoration_image_library.industry_type IS '行业类型: food/gift/seafood/dessert/baby/tech/pet/tea/art/business';
COMMENT ON COLUMN decoration_image_library.style_type IS '风格类型: fresh/luxury/warm/minimal/festive/modern';
COMMENT ON COLUMN decoration_image_library.theme_code IS '关联主题代码';
COMMENT ON COLUMN decoration_image_library.width IS '图片宽度';
COMMENT ON COLUMN decoration_image_library.height IS '图片高度';
COMMENT ON COLUMN decoration_image_library.format IS '图片格式';
COMMENT ON COLUMN decoration_image_library.file_size IS '文件大小(KB)';
COMMENT ON COLUMN decoration_image_library.tags IS '标签,逗号分隔';
COMMENT ON COLUMN decoration_image_library.description IS '图片描述';
COMMENT ON COLUMN decoration_image_library.status IS '状态: 0-禁用, 1-启用';
COMMENT ON COLUMN decoration_image_library.sort_order IS '排序';

-- Trigger for update_time auto-update
CREATE OR REPLACE FUNCTION update_decoration_image_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decoration_image_library_update_time
    BEFORE UPDATE ON decoration_image_library
    FOR EACH ROW
    EXECUTE FUNCTION update_decoration_image_library_updated_at();

-- ============================================
-- 1. 清新绿主题 (fresh_green) - 生鲜蔬果
-- ============================================
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('生鲜Banner-新鲜蔬果', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/fresh_green_banner_1.jpg', 'banner', 'food', 'fresh', 'fresh_green', 750, 300, 'jpg', '蔬菜,水果,新鲜,有机', '清新自然的蔬果展示，绿色主调', 1, 1, NOW()),
('生鲜Banner-有机食材', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/fresh_green_banner_2.jpg', 'banner', 'food', 'fresh', 'fresh_green', 750, 300, 'jpg', '有机,健康,绿色', '有机认证食材展示，自然风格', 1, 2, NOW()),
('生鲜Banner-农场直供', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/fresh_green_banner_3.jpg', 'banner', 'food', 'fresh', 'fresh_green', 750, 300, 'jpg', '农场,直供,新鲜', '农场直供概念，清晨露珠效果', 1, 3, NOW()),
('生鲜背景-绿叶纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/fresh_green_bg_1.jpg', 'background', 'food', 'fresh', 'fresh_green', 750, 1334, 'jpg', '绿叶,纹理,自然', '绿叶纹理背景，清新自然', 1, 1, NOW()),
('生鲜背景-渐变绿', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/fresh_green_bg_2.jpg', 'background', 'food', 'fresh', 'fresh_green', 750, 1334, 'jpg', '渐变,绿色,简洁', '清新绿渐变背景', 1, 2, NOW());

-- ============================================
-- 2. 经典金主题 (classic_gold) - 高端礼品
-- ============================================
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('高端Banner-尊贵礼盒', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/classic_gold_banner_1.jpg', 'banner', 'gift', 'luxury', 'classic_gold', 750, 300, 'jpg', '礼盒,金色,高端', '金色尊贵礼盒展示，黑金配色', 1, 1, NOW()),
('高端Banner-品质臻选', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/classic_gold_banner_2.jpg', 'banner', 'gift', 'luxury', 'classic_gold', 750, 300, 'jpg', '品质,臻选,奢华', '高端品质感展示，金色丝带', 1, 2, NOW()),
('高端Banner-节日礼遇', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/classic_gold_banner_3.jpg', 'banner', 'gift', 'luxury', 'classic_gold', 750, 300, 'jpg', '节日,礼遇,金色', '节日送礼主题，华丽金色', 1, 3, NOW()),
('高端背景-黑金纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/classic_gold_bg_1.jpg', 'background', 'gift', 'luxury', 'classic_gold', 750, 1334, 'jpg', '黑金,纹理,奢华', '黑底金色纹理背景', 1, 1, NOW()),
('高端背景-金色渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/classic_gold_bg_2.jpg', 'background', 'gift', 'luxury', 'classic_gold', 750, 1334, 'jpg', '金色,渐变,高端', '金色渐变背景，高贵典雅', 1, 2, NOW());

-- ============================================
-- 3. 海洋蓝主题 (ocean_blue) - 海鲜水产
-- ============================================
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('海鲜Banner-深海臻品', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/ocean_blue_banner_1.jpg', 'banner', 'seafood', 'fresh', 'ocean_blue', 750, 300, 'jpg', '海鲜,深海,新鲜', '深海海鲜展示，冰蓝色调', 1, 1, NOW()),
('海鲜Banner-鲜活海味', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/ocean_blue_banner_2.jpg', 'banner', 'seafood', 'fresh', 'ocean_blue', 750, 300, 'jpg', '鲜活,海味,蓝色', '鲜活海产品展示，海浪元素', 1, 2, NOW()),
('海鲜Banner-品质渔获', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/ocean_blue_banner_3.jpg', 'banner', 'seafood', 'fresh', 'ocean_blue', 750, 300, 'jpg', '品质,渔获,海洋', '优质渔获展示，深蓝背景', 1, 3, NOW()),
('海鲜背景-海浪纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/ocean_blue_bg_1.jpg', 'background', 'seafood', 'fresh', 'ocean_blue', 750, 1334, 'jpg', '海浪,纹理,蓝色', '海浪纹理背景，深海蓝', 1, 1, NOW()),
('海鲜背景-渐变蓝', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/ocean_blue_bg_2.jpg', 'background', 'seafood', 'fresh', 'ocean_blue', 750, 1334, 'jpg', '渐变,蓝色,清爽', '海洋蓝渐变背景', 1, 2, NOW());

-- ============================================
-- 4. 甜美粉主题 (sweet_pink) - 甜品烘焙
-- ============================================
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('甜品Banner-粉色马卡龙', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/sweet_pink_banner_1.jpg', 'banner', 'dessert', 'sweet', 'sweet_pink', 750, 300, 'jpg', '马卡龙,粉色,甜美', '粉色马卡龙展示，梦幻甜美', 1, 1, NOW()),
('甜品Banner-温馨蛋糕', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/sweet_pink_banner_2.jpg', 'banner', 'dessert', 'sweet', 'sweet_pink', 750, 300, 'jpg', '蛋糕,温馨,浪漫', '精致蛋糕展示，粉色浪漫', 1, 2, NOW()),
('甜品Banner-下午茶时光', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/sweet_pink_banner_3.jpg', 'banner', 'dessert', 'sweet', 'sweet_pink', 750, 300, 'jpg', '下午茶,甜点,粉色', '下午茶甜点组合，温馨氛围', 1, 3, NOW()),
('甜品背景-粉色渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/sweet_pink_bg_1.jpg', 'background', 'dessert', 'sweet', 'sweet_pink', 750, 1334, 'jpg', '粉色,渐变,甜美', '粉色渐变背景，少女心', 1, 1, NOW()),
('甜品背景-花瓣纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/sweet_pink_bg_2.jpg', 'background', 'dessert', 'sweet', 'sweet_pink', 750, 1334, 'jpg', '花瓣,纹理,浪漫', '粉色花瓣纹理背景', 1, 2, NOW());

-- ============================================
-- 5. 母婴暖主题 (baby_warm) - 母婴用品
-- ============================================
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('母婴Banner-温馨关爱', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/baby_warm_banner_1.jpg', 'banner', 'baby', 'warm', 'baby_warm', 750, 300, 'jpg', '母婴,温馨,关爱', '温馨母婴场景，暖色调', 1, 1, NOW()),
('母婴Banner-宝贝成长', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/baby_warm_banner_2.jpg', 'banner', 'baby', 'warm', 'baby_warm', 750, 300, 'jpg', '宝贝,成长,温暖', '宝贝成长主题，淡黄暖色', 1, 2, NOW()),
('母婴Banner-安心呵护', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/baby_warm_banner_3.jpg', 'banner', 'baby', 'warm', 'baby_warm', 750, 300, 'jpg', '安心,呵护,健康', '安心呵护理念，柔和色彩', 1, 3, NOW()),
('母婴背景-暖黄渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/baby_warm_bg_1.jpg', 'background', 'baby', 'warm', 'baby_warm', 750, 1334, 'jpg', '暖黄,渐变,温馨', '暖黄色渐变背景', 1, 1, NOW()),
('母婴背景-星星图案', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/baby_warm_bg_2.jpg', 'background', 'baby', 'warm', 'baby_warm', 750, 1334, 'jpg', '星星,图案,可爱', '可爱星星图案背景', 1, 2, NOW());

-- ============================================
-- 6. 科技蓝主题 (tech_blue) - 数码电子
-- ============================================
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('科技Banner-智能生活', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/tech_blue_banner_1.jpg', 'banner', 'tech', 'modern', 'tech_blue', 750, 300, 'jpg', '智能,科技,蓝色', '智能设备展示，深蓝科技感', 1, 1, NOW()),
('科技Banner-未来已来', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/tech_blue_banner_2.jpg', 'banner', 'tech', 'modern', 'tech_blue', 750, 300, 'jpg', '未来,科技,数码', '未来科技概念，光线效果', 1, 2, NOW()),
('科技Banner-品质数码', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/tech_blue_banner_3.jpg', 'banner', 'tech', 'modern', 'tech_blue', 750, 300, 'jpg', '品质,数码,高端', '高端数码产品，简洁科技风', 1, 3, NOW()),
('科技背景-电路纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/tech_blue_bg_1.jpg', 'background', 'tech', 'modern', 'tech_blue', 750, 1334, 'jpg', '电路,纹理,科技', '电路板纹理背景，深蓝', 1, 1, NOW()),
('科技背景-渐变蓝', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/tech_blue_bg_2.jpg', 'background', 'tech', 'modern', 'tech_blue', 750, 1334, 'jpg', '渐变,蓝色,科技', '科技蓝渐变背景', 1, 2, NOW());

-- ============================================
-- 7. 多巴胺橙主题 (dopamine_orange) - 潮流年轻
-- ============================================
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('潮流Banner-活力橙色', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/dopamine_orange_banner_1.jpg', 'banner', 'fashion', 'trendy', 'dopamine_orange', 750, 300, 'jpg', '活力,橙色,潮流', '活力橙色主视觉，年轻潮流', 1, 1, NOW()),
('潮流Banner-多巴胺配色', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/dopamine_orange_banner_2.jpg', 'banner', 'fashion', 'trendy', 'dopamine_orange', 750, 300, 'jpg', '多巴胺,配色,活力', '多巴胺配色风格，明亮醒目', 1, 2, NOW()),
('潮流Banner-青春活力', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/dopamine_orange_banner_3.jpg', 'banner', 'fashion', 'trendy', 'dopamine_orange', 750, 300, 'jpg', '青春,活力,橙色', '青春活力主题，动感设计', 1, 3, NOW()),
('潮流背景-橙色渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/dopamine_orange_bg_1.jpg', 'background', 'fashion', 'trendy', 'dopamine_orange', 750, 1334, 'jpg', '橙色,渐变,活力', '活力橙渐变背景', 1, 1, NOW()),
('潮流背景-几何图案', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/dopamine_orange_bg_2.jpg', 'background', 'fashion', 'trendy', 'dopamine_orange', 750, 1334, 'jpg', '几何,图案,潮流', '几何图案潮流背景', 1, 2, NOW());

-- ============================================
-- 8-15. 其他主题 (extreme_white, nature_green, tea_brown, pet_pink, midnight_black, festival_red, art_purple, business_gray)
-- ============================================
-- 8. 极简白主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('极简Banner-纯净生活', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/minimal_white_banner_1.jpg', 'banner', 'lifestyle', 'minimal', 'minimal_white', 750, 300, 'jpg', '极简,纯净,白色', '极简白色风格，干净纯粹', 1, 1, NOW()),
('极简Banner-品质之选', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/minimal_white_banner_2.jpg', 'banner', 'lifestyle', 'minimal', 'minimal_white', 750, 300, 'jpg', '品质,简约,高端', '简约品质感展示，留白设计', 1, 2, NOW()),
('极简Banner-生活美学', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/minimal_white_banner_3.jpg', 'banner', 'lifestyle', 'minimal', 'minimal_white', 750, 300, 'jpg', '生活,美学,简约', '生活美学主题，极简风格', 1, 3, NOW()),
('极简背景-纯白', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/minimal_white_bg_1.jpg', 'background', 'lifestyle', 'minimal', 'minimal_white', 750, 1334, 'jpg', '纯白,简约,干净', '纯白简约背景', 1, 1, NOW()),
('极简背景-浅灰纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/minimal_white_bg_2.jpg', 'background', 'lifestyle', 'minimal', 'minimal_white', 750, 1334, 'jpg', '浅灰,纹理,质感', '浅灰纹理质感背景', 1, 2, NOW());

-- 9. 自然绿主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('绿植Banner-自然之美', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/nature_green_banner_1.jpg', 'banner', 'plant', 'natural', 'nature_green', 750, 300, 'jpg', '绿植,自然,清新', '自然绿植展示，森系风格', 1, 1, NOW()),
('绿植Banner-花卉精选', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/nature_green_banner_2.jpg', 'banner', 'plant', 'natural', 'nature_green', 750, 300, 'jpg', '花卉,精选,自然', '精选花卉展示，清新自然', 1, 2, NOW()),
('绿植Banner-家居绿意', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/nature_green_banner_3.jpg', 'banner', 'plant', 'natural', 'nature_green', 750, 300, 'jpg', '家居,绿意,装饰', '家居绿植装饰，自然风', 1, 3, NOW()),
('绿植背景-叶片纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/nature_green_bg_1.jpg', 'background', 'plant', 'natural', 'nature_green', 750, 1334, 'jpg', '叶片,纹理,绿色', '绿叶纹理自然背景', 1, 1, NOW()),
('绿植背景-森林渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/nature_green_bg_2.jpg', 'background', 'plant', 'natural', 'nature_green', 750, 1334, 'jpg', '森林,渐变,自然', '森林绿渐变背景', 1, 2, NOW());

-- 10. 茶韵棕主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('茶韵Banner-品茗时光', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/tea_brown_banner_1.jpg', 'banner', 'tea', 'traditional', 'tea_brown', 750, 300, 'jpg', '茶叶,品茗,棕色', '品茗时光主题，古朴雅致', 1, 1, NOW()),
('茶韵Banner-茶道文化', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/tea_brown_banner_2.jpg', 'banner', 'tea', 'traditional', 'tea_brown', 750, 300, 'jpg', '茶道,文化,传统', '茶道文化展示，棕色调', 1, 2, NOW()),
('茶韵Banner-臻选好茶', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/tea_brown_banner_3.jpg', 'banner', 'tea', 'traditional', 'tea_brown', 750, 300, 'jpg', '臻选,好茶,品质', '精选茶叶展示，典雅风格', 1, 3, NOW()),
('茶韵背景-木纹质感', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/tea_brown_bg_1.jpg', 'background', 'tea', 'traditional', 'tea_brown', 750, 1334, 'jpg', '木纹,质感,棕色', '木纹质感背景，温润', 1, 1, NOW()),
('茶韵背景-棕色渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/tea_brown_bg_2.jpg', 'background', 'tea', 'traditional', 'tea_brown', 750, 1334, 'jpg', '棕色,渐变,典雅', '棕色渐变背景', 1, 2, NOW());

-- 11. 萌宠粉主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('萌宠Banner-爱宠生活', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/pet_pink_banner_1.jpg', 'banner', 'pet', 'cute', 'pet_pink', 750, 300, 'jpg', '宠物,萌宠,粉色', '可爱萌宠主题，粉嫩温馨', 1, 1, NOW()),
('萌宠Banner-宠物精选', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/pet_pink_banner_2.jpg', 'banner', 'pet', 'cute', 'pet_pink', 750, 300, 'jpg', '精选,宠物,可爱', '宠物用品精选，活泼可爱', 1, 2, NOW()),
('萌宠Banner-萌趣时光', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/pet_pink_banner_3.jpg', 'banner', 'pet', 'cute', 'pet_pink', 750, 300, 'jpg', '萌趣,时光,温馨', '萌趣宠物时光，温馨可爱', 1, 3, NOW()),
('萌宠背景-粉色可爱', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/pet_pink_bg_1.jpg', 'background', 'pet', 'cute', 'pet_pink', 750, 1334, 'jpg', '粉色,可爱,萌趣', '粉色可爱背景', 1, 1, NOW()),
('萌宠背景-爪印图案', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/pet_pink_bg_2.jpg', 'background', 'pet', 'cute', 'pet_pink', 750, 1334, 'jpg', '爪印,图案,宠物', '可爱爪印图案背景', 1, 2, NOW());

-- 12. 午夜黑主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('潮牌Banner-暗黑美学', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/midnight_black_banner_1.jpg', 'banner', 'fashion', 'dark', 'midnight_black', 750, 300, 'jpg', '暗黑,美学,潮牌', '暗黑美学风格，高级质感', 1, 1, NOW()),
('潮牌Banner-街头风尚', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/midnight_black_banner_2.jpg', 'banner', 'fashion', 'dark', 'midnight_black', 750, 300, 'jpg', '街头,风尚,黑色', '街头潮流风格，酷黑主调', 1, 2, NOW()),
('潮牌Banner-限定发售', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/midnight_black_banner_3.jpg', 'banner', 'fashion', 'dark', 'midnight_black', 750, 300, 'jpg', '限定,发售,潮流', '限定款发售，黑金配色', 1, 3, NOW()),
('潮牌背景-纯黑', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/midnight_black_bg_1.jpg', 'background', 'fashion', 'dark', 'midnight_black', 750, 1334, 'jpg', '纯黑,高级,质感', '纯黑高级背景', 1, 1, NOW()),
('潮牌背景-暗纹', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/midnight_black_bg_2.jpg', 'background', 'fashion', 'dark', 'midnight_black', 750, 1334, 'jpg', '暗纹,纹理,黑色', '黑色暗纹质感背景', 1, 2, NOW());

-- 13. 节庆红主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('节庆Banner-新年大促', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/festival_red_banner_1.jpg', 'banner', 'festival', 'festive', 'festival_red', 750, 300, 'jpg', '新年,大促,红色', '新年大促主题，喜庆红色', 1, 1, NOW()),
('节庆Banner-喜庆盛典', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/festival_red_banner_2.jpg', 'banner', 'festival', 'festive', 'festival_red', 750, 300, 'jpg', '喜庆,盛典,节日', '喜庆盛典风格，金红配色', 1, 2, NOW()),
('节庆Banner-限时特惠', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/festival_red_banner_3.jpg', 'banner', 'festival', 'festive', 'festival_red', 750, 300, 'jpg', '限时,特惠,促销', '限时特惠促销，醒目红色', 1, 3, NOW()),
('节庆背景-红色渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/festival_red_bg_1.jpg', 'background', 'festival', 'festive', 'festival_red', 750, 1334, 'jpg', '红色,渐变,喜庆', '喜庆红渐变背景', 1, 1, NOW()),
('节庆背景-祥云图案', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/festival_red_bg_2.jpg', 'background', 'festival', 'festive', 'festival_red', 750, 1334, 'jpg', '祥云,图案,中国风', '祥云图案中国风背景', 1, 2, NOW());

-- 14. 艺术紫主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('美妆Banner-紫色魅力', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/art_purple_banner_1.jpg', 'banner', 'beauty', 'artistic', 'art_purple', 750, 300, 'jpg', '紫色,魅力,美妆', '紫色魅力美妆，高贵优雅', 1, 1, NOW()),
('美妆Banner-护肤精选', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/art_purple_banner_2.jpg', 'banner', 'beauty', 'artistic', 'art_purple', 750, 300, 'jpg', '护肤,精选,紫色', '护肤精选展示，紫色梦幻', 1, 2, NOW()),
('美妆Banner-美丽绽放', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/art_purple_banner_3.jpg', 'banner', 'beauty', 'artistic', 'art_purple', 750, 300, 'jpg', '美丽,绽放,艺术', '美丽绽放主题，艺术感', 1, 3, NOW()),
('美妆背景-紫色渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/art_purple_bg_1.jpg', 'background', 'beauty', 'artistic', 'art_purple', 750, 1334, 'jpg', '紫色,渐变,梦幻', '紫色梦幻渐变背景', 1, 1, NOW()),
('美妆背景-星空纹理', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/art_purple_bg_2.jpg', 'background', 'beauty', 'artistic', 'art_purple', 750, 1334, 'jpg', '星空,纹理,紫色', '紫色星空纹理背景', 1, 2, NOW());

-- 15. 商务灰主题
INSERT INTO decoration_image_library (name, url, image_type, industry_type, style_type, theme_code, width, height, format, tags, description, status, sort_order, create_time) VALUES
('商务Banner-专业之选', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/business_gray_banner_1.jpg', 'banner', 'business', 'professional', 'business_gray', 750, 300, 'jpg', '商务,专业,灰色', '专业商务风格，稳重大气', 1, 1, NOW()),
('商务Banner-办公精选', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/business_gray_banner_2.jpg', 'banner', 'business', 'professional', 'business_gray', 750, 300, 'jpg', '办公,精选,商务', '办公用品精选，简洁专业', 1, 2, NOW()),
('商务Banner-品质办公', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/banners/business_gray_banner_3.jpg', 'banner', 'business', 'professional', 'business_gray', 750, 300, 'jpg', '品质,办公,高端', '品质办公展示，灰色调', 1, 3, NOW()),
('商务背景-灰色渐变', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/business_gray_bg_1.jpg', 'background', 'business', 'professional', 'business_gray', 750, 1334, 'jpg', '灰色,渐变,商务', '商务灰渐变背景', 1, 1, NOW()),
('商务背景-纹理质感', 'https://mall-products-shanghai.oss-cn-shanghai.aliyuncs.com/decoration/backgrounds/business_gray_bg_2.jpg', 'background', 'business', 'professional', 'business_gray', 750, 1334, 'jpg', '纹理,质感,专业', '灰色纹理质感背景', 1, 2, NOW());

-- ============================================
-- 创建主题与图片关联表
-- ============================================
DROP TABLE IF EXISTS decoration_theme_image_rel CASCADE;
CREATE TABLE decoration_theme_image_rel (
    id BIGSERIAL PRIMARY KEY,
    theme_id BIGINT NOT NULL,
    image_id BIGINT NOT NULL,
    position VARCHAR(50),
    is_default SMALLINT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (theme_id, image_id, position)
);

CREATE INDEX idx_theme_image_rel_theme_id ON decoration_theme_image_rel(theme_id);
CREATE INDEX idx_theme_image_rel_image_id ON decoration_theme_image_rel(image_id);

COMMENT ON TABLE decoration_theme_image_rel IS '主题图片关联表';
COMMENT ON COLUMN decoration_theme_image_rel.theme_id IS '主题ID';
COMMENT ON COLUMN decoration_theme_image_rel.image_id IS '图片ID';
COMMENT ON COLUMN decoration_theme_image_rel.position IS '图片位置: header/banner1/banner2/background/footer';
COMMENT ON COLUMN decoration_theme_image_rel.is_default IS '是否默认图片';

-- ============================================
-- 统计信息查询
-- ============================================
-- SELECT theme_code, COUNT(*) as image_count FROM decoration_image_library GROUP BY theme_code;
-- 预期结果: 每个主题5张图片(3 banner + 2 background), 共75张图片
