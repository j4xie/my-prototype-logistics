-- =====================================================
-- 02_categories.sql - 创建商品分类 (14个二级分类)
-- =====================================================

-- 创建一级分类 (根分类)
INSERT INTO goods_category (id, enable, parent_id, name, description, sort, create_time, del_flag)
VALUES
    ('ROOT', '1', '0', '全部商品', '根分类', 0, NOW(), '0');

-- 创建14个二级分类
INSERT INTO goods_category (id, enable, parent_id, name, description, sort, create_time, del_flag)
VALUES
    ('CAT001', '1', 'ROOT', '丸滑产品', '丸滑产品类', 1, NOW(), '0'),
    ('CAT002', '1', 'ROOT', '家禽蛋副', '家禽蛋副类', 2, NOW(), '0'),
    ('CAT003', '1', 'ROOT', '小吃点心', '小吃点心类', 3, NOW(), '0'),
    ('CAT004', '1', 'ROOT', '水发产品', '水发产品类', 4, NOW(), '0'),
    ('CAT005', '1', 'ROOT', '海鲜水产', '海鲜水产类', 5, NOW(), '0'),
    ('CAT006', '1', 'ROOT', '牛羊肉类', '牛羊肉类', 6, NOW(), '0'),
    ('CAT007', '1', 'ROOT', '猪肉猪副', '猪肉猪副类', 7, NOW(), '0'),
    ('CAT008', '1', 'ROOT', '米面制品', '米面制品类', 8, NOW(), '0'),
    ('CAT009', '1', 'ROOT', '肉肠罐头', '肉肠罐头类', 9, NOW(), '0'),
    ('CAT010', '1', 'ROOT', '蔬菜菌菇', '蔬菜菌菇类', 10, NOW(), '0'),
    ('CAT011', '1', 'ROOT', '蘸料底料', '蘸料底料类', 11, NOW(), '0'),
    ('CAT012', '1', 'ROOT', '调理肉类', '调理肉类', 12, NOW(), '0'),
    ('CAT013', '1', 'ROOT', '豆制品类', '豆制品类', 13, NOW(), '0'),
    ('CAT014', '1', 'ROOT', '饮料甜品', '饮料甜品类', 14, NOW(), '0');

SELECT COUNT(*) AS category_count, '分类创建完成' AS status FROM goods_category;
