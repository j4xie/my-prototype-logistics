-- =====================================================
-- V6.0 食品分类初始化脚本
-- 删除Apple相关数据，添加白垩纪食品分类
-- =====================================================

-- 1. 清理购物车中的Apple商品
DELETE FROM shopping_cart WHERE spu_name LIKE '%iPhone%' OR spu_name LIKE '%Apple%' OR spu_name LIKE '%AirPods%' OR spu_name LIKE '%Mac%' OR spu_name LIKE '%iPad%';

-- 2. 清理订单项中的Apple商品
DELETE FROM order_item WHERE spu_name LIKE '%iPhone%' OR spu_name LIKE '%Apple%' OR spu_name LIKE '%AirPods%' OR spu_name LIKE '%Mac%' OR spu_name LIKE '%iPad%';

-- 3. 清理订单信息 (清理无订单项的订单)
DELETE FROM order_info WHERE id NOT IN (SELECT DISTINCT order_id FROM order_item);

-- 4. 清理商品SPU (Apple产品)
DELETE FROM goods_spu WHERE name LIKE '%iPhone%' OR name LIKE '%Apple%' OR name LIKE '%AirPods%' OR name LIKE '%Mac%' OR name LIKE '%iPad%' OR name LIKE '%Huawei%';

-- 5. 删除旧的二级分类
DELETE FROM goods_category WHERE parent_id IN (
    SELECT id FROM (SELECT id FROM goods_category WHERE name IN ('手机', '电脑', '服饰', '鞋包', 'JooLun', 'Joolun')) AS tmp
);

-- 6. 删除旧的一级分类
DELETE FROM goods_category WHERE name IN ('手机', '电脑', '服饰', '鞋包', 'JooLun', 'Joolun');

-- 7. 插入新的食品分类 (与首页分类对应)
-- 一级分类 (10个)
INSERT INTO goods_category (id, enable, parent_id, name, description, pic_url, sort, create_time, update_time, del_flag) VALUES
('FOOD_CAT_001', '1', '0', '牛羊肉类', '优质牛羊肉，新鲜直供', '', 1, NOW(), NOW(), '0'),
('FOOD_CAT_002', '1', '0', '家禽蛋副', '新鲜家禽、禽蛋、副产品', '', 2, NOW(), NOW(), '0'),
('FOOD_CAT_003', '1', '0', '调理肉类', '调理肉制品，方便烹饪', '', 3, NOW(), NOW(), '0'),
('FOOD_CAT_004', '1', '0', '肉肠罐头', '肉肠、罐头、腌制食品', '', 4, NOW(), NOW(), '0'),
('FOOD_CAT_005', '1', '0', '海鲜水产', '新鲜海鲜、水产品', '', 5, NOW(), NOW(), '0'),
('FOOD_CAT_006', '1', '0', '蔬菜菌菇', '新鲜蔬菜、食用菌菇', '', 6, NOW(), NOW(), '0'),
('FOOD_CAT_007', '1', '0', '米面制品', '米面、粮油、主食', '', 7, NOW(), NOW(), '0'),
('FOOD_CAT_008', '1', '0', '小吃点心', '传统点心、休闲小吃', '', 8, NOW(), NOW(), '0'),
('FOOD_CAT_009', '1', '0', '水发产品', '水发食材、干货泡发', '', 9, NOW(), NOW(), '0'),
('FOOD_CAT_010', '1', '0', '其他食品', '其他食品类目', '', 10, NOW(), NOW(), '0');

-- 8. 插入二级分类 (示例)
-- 牛羊肉类
INSERT INTO goods_category (id, enable, parent_id, name, description, pic_url, sort, create_time, update_time, del_flag) VALUES
('FOOD_CAT_001_01', '1', 'FOOD_CAT_001', '牛肉', '优质牛肉', '', 1, NOW(), NOW(), '0'),
('FOOD_CAT_001_02', '1', 'FOOD_CAT_001', '羊肉', '新鲜羊肉', '', 2, NOW(), NOW(), '0'),
('FOOD_CAT_001_03', '1', 'FOOD_CAT_001', '牛排', '精选牛排', '', 3, NOW(), NOW(), '0');

-- 家禽蛋副
INSERT INTO goods_category (id, enable, parent_id, name, description, pic_url, sort, create_time, update_time, del_flag) VALUES
('FOOD_CAT_002_01', '1', 'FOOD_CAT_002', '鸡肉', '新鲜鸡肉', '', 1, NOW(), NOW(), '0'),
('FOOD_CAT_002_02', '1', 'FOOD_CAT_002', '鸭肉', '新鲜鸭肉', '', 2, NOW(), NOW(), '0'),
('FOOD_CAT_002_03', '1', 'FOOD_CAT_002', '禽蛋', '新鲜禽蛋', '', 3, NOW(), NOW(), '0');

-- 海鲜水产
INSERT INTO goods_category (id, enable, parent_id, name, description, pic_url, sort, create_time, update_time, del_flag) VALUES
('FOOD_CAT_005_01', '1', 'FOOD_CAT_005', '鱼类', '新鲜鱼类', '', 1, NOW(), NOW(), '0'),
('FOOD_CAT_005_02', '1', 'FOOD_CAT_005', '虾蟹', '虾蟹贝类', '', 2, NOW(), NOW(), '0'),
('FOOD_CAT_005_03', '1', 'FOOD_CAT_005', '贝类', '新鲜贝类', '', 3, NOW(), NOW(), '0');

-- 蔬菜菌菇
INSERT INTO goods_category (id, enable, parent_id, name, description, pic_url, sort, create_time, update_time, del_flag) VALUES
('FOOD_CAT_006_01', '1', 'FOOD_CAT_006', '叶菜类', '新鲜叶菜', '', 1, NOW(), NOW(), '0'),
('FOOD_CAT_006_02', '1', 'FOOD_CAT_006', '根茎类', '根茎蔬菜', '', 2, NOW(), NOW(), '0'),
('FOOD_CAT_006_03', '1', 'FOOD_CAT_006', '菌菇类', '食用菌菇', '', 3, NOW(), NOW(), '0');

-- 9. 插入示例商品 (用于测试)
INSERT INTO goods_spu (id, spu_code, name, sell_point, description, category_first, category_second, pic_urls, shelf, sort, cost_price, sales_price, market_price, stock, sale_num, create_time, update_time, del_flag) VALUES
('FOOD_SPU_001', 'BEEF001', '澳洲进口牛排', '精选澳洲谷饲牛肉，口感鲜嫩', '优质澳洲进口牛排，品质保证', 'FOOD_CAT_001', 'FOOD_CAT_001_03', '["https://via.placeholder.com/400x400?text=Steak"]', '1', 1, 50.00, 128.00, 168.00, 100, 0, NOW(), NOW(), '0'),
('FOOD_SPU_002', 'CHICKEN001', '农家散养土鸡', '自然放养，肉质紧实', '正宗农家土鸡，自然放养180天', 'FOOD_CAT_002', 'FOOD_CAT_002_01', '["https://via.placeholder.com/400x400?text=Chicken"]', '1', 2, 30.00, 68.00, 88.00, 50, 0, NOW(), NOW(), '0'),
('FOOD_SPU_003', 'SHRIMP001', '南美白对虾', '鲜活直达，个大饱满', '新鲜南美白对虾，冷链配送', 'FOOD_CAT_005', 'FOOD_CAT_005_02', '["https://via.placeholder.com/400x400?text=Shrimp"]', '1', 3, 40.00, 89.00, 109.00, 80, 0, NOW(), NOW(), '0'),
('FOOD_SPU_004', 'MUSHROOM001', '云南野生菌菇', '山珍野味，营养丰富', '云南高原野生菌菇，天然美味', 'FOOD_CAT_006', 'FOOD_CAT_006_03', '["https://via.placeholder.com/400x400?text=Mushroom"]', '1', 4, 25.00, 58.00, 78.00, 60, 0, NOW(), NOW(), '0');

-- 完成
SELECT '食品分类初始化完成' AS message;
