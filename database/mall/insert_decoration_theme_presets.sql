-- 插入15套主题预设种子数据
-- 执行: PGPASSWORD=cretas psql -U cretas -h localhost -d mall_center -f insert_decoration_theme_presets.sql

-- 清空旧数据（如有）
DELETE FROM decoration_theme_preset;

INSERT INTO decoration_theme_preset (name, code, description, color_config, style_tags, industry_tags, slogan, status, sort_order, use_count, create_time) VALUES

-- 1. 清新绿
('清新绿', 'fresh_green', '自然清新，适合生鲜蔬果、有机食品',
 '{"primaryColor":"#52c41a","secondaryColor":"#1a1a1a","backgroundColor":"#f5f5f5","textColor":"#333333","accentColor":"#52c41a","primaryLight":"#d7f0db","primaryDark":"#389e0d","noticeBg":"#d7f0db","noticeText":"#389e0d","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#52c41a"}',
 'fresh,natural,clean', 'food,organic,vegetable,fruit', '新鲜直达，品质生活', 1, 1, 0, NOW()),

-- 2. 海洋蓝
('海洋蓝', 'ocean_blue', '清爽海洋风，适合海鲜水产、进口食品',
 '{"primaryColor":"#1890ff","secondaryColor":"#001529","backgroundColor":"#f0f5ff","textColor":"#333333","accentColor":"#1890ff","primaryLight":"#bae7ff","primaryDark":"#096dd9","noticeBg":"#e6f7ff","noticeText":"#096dd9","darkBg":"#001529","darkSecondary":"#002140","borderColor":"#1890ff"}',
 'ocean,fresh,modern', 'seafood,import,frozen', '深海臻选，鲜活到家', 1, 2, 0, NOW()),

-- 3. 田园绿
('田园绿', 'farm_green', '淳朴自然，适合农产品、土特产',
 '{"primaryColor":"#7CB305","secondaryColor":"#254000","backgroundColor":"#fcffe6","textColor":"#333333","accentColor":"#7CB305","primaryLight":"#eaff8f","primaryDark":"#5B8C00","noticeBg":"#f6ffed","noticeText":"#5B8C00","darkBg":"#254000","darkSecondary":"#3f6600","borderColor":"#7CB305"}',
 'farm,organic,rustic', 'farm,specialty,grain', '田间直送，原味乡土', 1, 3, 0, NOW()),

-- 4. 经典金
('经典金', 'classic_gold', '尊贵大气，适合高端礼品、奢侈品',
 '{"primaryColor":"#D4AF37","secondaryColor":"#1a1a1a","backgroundColor":"#fffdf5","textColor":"#333333","accentColor":"#D4AF37","primaryLight":"#fff1b8","primaryDark":"#B8860B","noticeBg":"#fffbe6","noticeText":"#B8860B","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#D4AF37"}',
 'luxury,classic,elegant', 'gift,jewelry,wine,tea', '臻选品质，尊享生活', 1, 4, 0, NOW()),

-- 5. 茶韵棕
('茶韵棕', 'tea_brown', '古朴雅致，适合茶叶、咖啡、传统糕点',
 '{"primaryColor":"#8B4513","secondaryColor":"#3E2723","backgroundColor":"#faf5ef","textColor":"#333333","accentColor":"#8B4513","primaryLight":"#efdbcb","primaryDark":"#6D4C41","noticeBg":"#f5efe8","noticeText":"#6D4C41","darkBg":"#3E2723","darkSecondary":"#4E342E","borderColor":"#8B4513"}',
 'vintage,classic,warm', 'tea,coffee,pastry', '一盏茶香，品味人生', 1, 5, 0, NOW()),

-- 6. 母婴暖
('母婴暖', 'baby_warm', '柔和温暖，适合母婴用品、儿童玩具',
 '{"primaryColor":"#F4C2C2","secondaryColor":"#fff0f6","backgroundColor":"#fff5f5","textColor":"#333333","accentColor":"#EE96AA","primaryLight":"#ffd6e7","primaryDark":"#EE96AA","noticeBg":"#fff0f6","noticeText":"#c41d7f","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#F4C2C2"}',
 'warm,soft,cute', 'baby,mother,children,toy', '用心呵护，陪伴成长', 1, 6, 0, NOW()),

-- 7. 甜美粉
('甜美粉', 'sweet_pink', '温馨甜美，适合甜品烘焙、少女风',
 '{"primaryColor":"#eb2f96","secondaryColor":"#120338","backgroundColor":"#fff0f6","textColor":"#333333","accentColor":"#eb2f96","primaryLight":"#ffadd2","primaryDark":"#c41d7f","noticeBg":"#fff0f6","noticeText":"#c41d7f","darkBg":"#120338","darkSecondary":"#1a0547","borderColor":"#eb2f96"}',
 'sweet,cute,romantic', 'bakery,dessert,girl,gift', '甜蜜时光，幸福味道', 1, 7, 0, NOW()),

-- 8. 美妆紫
('美妆紫', 'beauty_purple', '优雅浪漫，适合美妆护肤、时尚配饰',
 '{"primaryColor":"#722ED1","secondaryColor":"#120338","backgroundColor":"#f9f0ff","textColor":"#333333","accentColor":"#722ED1","primaryLight":"#d3adf7","primaryDark":"#531DAB","noticeBg":"#f9f0ff","noticeText":"#531DAB","darkBg":"#120338","darkSecondary":"#1a0547","borderColor":"#722ED1"}',
 'elegant,romantic,fashion', 'cosmetics,skincare,fashion,perfume', '美丽绽放，自信由我', 1, 8, 0, NOW()),

-- 9. 深夜黑
('深夜黑', 'dark_night', '酷炫潮流，适合潮牌服饰、电竞周边',
 '{"primaryColor":"#FAAD14","secondaryColor":"#1a1a1a","backgroundColor":"#1a1a1a","textColor":"#ffffff","accentColor":"#FAAD14","primaryLight":"#ffe58f","primaryDark":"#D48806","noticeBg":"#2d2d2d","noticeText":"#FAAD14","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#FAAD14"}',
 'dark,cool,trendy', 'fashion,streetwear,gaming,nightlife', '释放自我，潮流不息', 1, 9, 0, NOW()),

-- 10. 科技蓝
('科技蓝', 'tech_blue', '科技感十足，适合数码产品、智能家电',
 '{"primaryColor":"#2F54EB","secondaryColor":"#030852","backgroundColor":"#f0f5ff","textColor":"#333333","accentColor":"#2F54EB","primaryLight":"#adc6ff","primaryDark":"#1D39C4","noticeBg":"#f0f5ff","noticeText":"#1D39C4","darkBg":"#030852","darkSecondary":"#061178","borderColor":"#2F54EB"}',
 'tech,modern,professional', 'digital,electronic,smart,appliance', '智能生活，触手可及', 1, 10, 0, NOW()),

-- 11. 自然木
('自然木', 'natural_wood', '质朴自然，适合家居家具、手工艺品',
 '{"primaryColor":"#A0522D","secondaryColor":"#3E2723","backgroundColor":"#faf5ef","textColor":"#333333","accentColor":"#A0522D","primaryLight":"#e6c8a0","primaryDark":"#8B4513","noticeBg":"#f5efe8","noticeText":"#8B4513","darkBg":"#3E2723","darkSecondary":"#4E342E","borderColor":"#A0522D"}',
 'natural,rustic,warm', 'furniture,home,craft,wood', '匠心之作，温暖家居', 1, 11, 0, NOW()),

-- 12. 活力橙
('活力橙', 'dopamine_orange', '热情活力，适合促销活动、快消品',
 '{"primaryColor":"#fa8c16","secondaryColor":"#1a1a1a","backgroundColor":"#fff7e6","textColor":"#333333","accentColor":"#fa8c16","primaryLight":"#ffd591","primaryDark":"#d46b08","noticeBg":"#fff7e6","noticeText":"#d46b08","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#fa8c16"}',
 'energetic,active,promotion', 'snack,beverage,fashion,promotion', '活力满满，惊喜不断', 1, 12, 0, NOW()),

-- 13. 节日红
('节日红', 'festival_red', '喜庆热烈，适合节日促销、喜庆礼品',
 '{"primaryColor":"#CF1322","secondaryColor":"#1a1a1a","backgroundColor":"#fff1f0","textColor":"#333333","accentColor":"#CF1322","primaryLight":"#ffa39e","primaryDark":"#A8071A","noticeBg":"#fff1f0","noticeText":"#A8071A","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#CF1322"}',
 'festival,celebration,joyful', 'festival,gift,specialty,newyear', '喜迎佳节，好礼相送', 1, 13, 0, NOW()),

-- 14. 医疗蓝
('医疗蓝', 'medical_blue', '专业可信，适合保健品、健康服务',
 '{"primaryColor":"#13C2C2","secondaryColor":"#002329","backgroundColor":"#e6fffb","textColor":"#333333","accentColor":"#13C2C2","primaryLight":"#87e8de","primaryDark":"#08979C","noticeBg":"#e6fffb","noticeText":"#08979C","darkBg":"#002329","darkSecondary":"#00474f","borderColor":"#13C2C2"}',
 'medical,professional,trust', 'health,supplement,medical,wellness', '专业守护，健康生活', 1, 14, 0, NOW()),

-- 15. 简约白
('简约白', 'minimal_white', '简洁明了，适合追求极简风格的各类店铺',
 '{"primaryColor":"#333333","secondaryColor":"#666666","backgroundColor":"#ffffff","textColor":"#333333","accentColor":"#333333","primaryLight":"#e0e0e0","primaryDark":"#1a1a1a","noticeBg":"#f5f5f5","noticeText":"#666666","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#e0e0e0"}',
 'minimal,simple,clean', 'general,retail,service', '简约不简单', 1, 15, 0, NOW());
