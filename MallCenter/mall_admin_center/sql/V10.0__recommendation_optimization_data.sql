-- ==========================================================
-- V10.0 推荐算法优化 - 数据准备
-- 解决问题: 所有商品集中在1个商户，导致推荐没有多样性
-- 创建日期: 2026-01-19
-- ==========================================================

-- ============================================
-- Phase 1.1: 创建8个新商户
-- ============================================

INSERT INTO merchant (merchant_no, merchant_name, short_name, contact_name, contact_phone, status, rating, review_rate, operating_years, create_time, update_time) VALUES
('M005', '绿色农场直供', '绿色农场', '陈经理', '13900139005', 1, 4.90, 99.00, 5, NOW(), NOW()),
('M006', '山东海鲜批发', '海鲜批发', '刘总', '13900139006', 1, 4.70, 96.50, 7, NOW(), NOW()),
('M007', '四川特产专营', '川特专营', '王店长', '13900139007', 1, 4.60, 94.00, 3, NOW(), NOW()),
('M008', '进口食材汇', '进口汇', '张经理', '13900139008', 1, 4.85, 98.00, 4, NOW(), NOW()),
('M009', '有机蔬果坊', '有机坊', '李主管', '13900139009', 1, 4.75, 97.00, 2, NOW(), NOW()),
('M010', '东北粮油批发', '粮油批发', '赵总', '13900139010', 1, 4.55, 93.00, 8, NOW(), NOW()),
('M011', '广东调味品厂', '调味品厂', '黄经理', '13900139011', 1, 4.65, 95.00, 6, NOW(), NOW()),
('M012', '新疆干果特产', '干果特产', '阿里木', '13900139012', 1, 4.80, 97.50, 4, NOW(), NOW())
ON DUPLICATE KEY UPDATE
    merchant_name = VALUES(merchant_name),
    update_time = NOW();

-- ============================================
-- Phase 1.2: 分配商品到不同商户
-- 将161个商品均匀分配到12个商户 (每个约13-14个)
-- ============================================

-- 临时表存储商品ID和排名
DROP TEMPORARY TABLE IF EXISTS temp_product_ranking;
CREATE TEMPORARY TABLE temp_product_ranking AS
SELECT id, @row_num := @row_num + 1 AS row_num
FROM goods_spu, (SELECT @row_num := 0) AS init
WHERE del_flag = 0
ORDER BY id;

-- 获取商户ID映射
SET @merchant1 := (SELECT id FROM merchant WHERE merchant_no = 'M005' LIMIT 1);
SET @merchant2 := (SELECT id FROM merchant WHERE merchant_no = 'M006' LIMIT 1);
SET @merchant3 := (SELECT id FROM merchant WHERE merchant_no = 'M007' LIMIT 1);
SET @merchant4 := (SELECT id FROM merchant WHERE merchant_no = 'M008' LIMIT 1);
SET @merchant5 := (SELECT id FROM merchant WHERE merchant_no = 'M009' LIMIT 1);
SET @merchant6 := (SELECT id FROM merchant WHERE merchant_no = 'M010' LIMIT 1);
SET @merchant7 := (SELECT id FROM merchant WHERE merchant_no = 'M011' LIMIT 1);
SET @merchant8 := (SELECT id FROM merchant WHERE merchant_no = 'M012' LIMIT 1);

-- 分配商品: 每组约13-14个商品，共12个商户
-- 原有商户 merchant_id=4 保留约40个商品 (row_num 1-40)

-- merchant_id=1 (原有): row_num 41-54
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = 1
WHERE t.row_num BETWEEN 41 AND 54;

-- merchant_id=2 (原有): row_num 55-68
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = 2
WHERE t.row_num BETWEEN 55 AND 68;

-- merchant_id=3 (原有): row_num 69-82
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = 3
WHERE t.row_num BETWEEN 69 AND 82;

-- M005 (绿色农场): row_num 83-96
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant1
WHERE t.row_num BETWEEN 83 AND 96 AND @merchant1 IS NOT NULL;

-- M006 (海鲜批发): row_num 97-110
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant2
WHERE t.row_num BETWEEN 97 AND 110 AND @merchant2 IS NOT NULL;

-- M007 (川特专营): row_num 111-124
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant3
WHERE t.row_num BETWEEN 111 AND 124 AND @merchant3 IS NOT NULL;

-- M008 (进口汇): row_num 125-138
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant4
WHERE t.row_num BETWEEN 125 AND 138 AND @merchant4 IS NOT NULL;

-- M009 (有机坊): row_num 139-148
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant5
WHERE t.row_num BETWEEN 139 AND 148 AND @merchant5 IS NOT NULL;

-- M010 (粮油批发): row_num 149-154
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant6
WHERE t.row_num BETWEEN 149 AND 154 AND @merchant6 IS NOT NULL;

-- M011 (调味品厂): row_num 155-158
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant7
WHERE t.row_num BETWEEN 155 AND 158 AND @merchant7 IS NOT NULL;

-- M012 (干果特产): row_num 159-161
UPDATE goods_spu g
JOIN temp_product_ranking t ON g.id = t.id
SET g.merchant_id = @merchant8
WHERE t.row_num BETWEEN 159 AND 161 AND @merchant8 IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS temp_product_ranking;

-- ============================================
-- Phase 1.3: 创建30个测试用户
-- ============================================

INSERT INTO wx_user (openid, nick_name, avatar_url, phone, create_time, update_time) VALUES
('test_user_101', '美食达人小王', 'https://placeholder.com/avatar.png', '13800000101', NOW(), NOW()),
('test_user_102', '养生爱好者', 'https://placeholder.com/avatar.png', '13800000102', NOW(), NOW()),
('test_user_103', '海鲜控小陈', 'https://placeholder.com/avatar.png', '13800000103', NOW(), NOW()),
('test_user_104', '川菜粉丝', 'https://placeholder.com/avatar.png', '13800000104', NOW(), NOW()),
('test_user_105', '进口控Lily', 'https://placeholder.com/avatar.png', '13800000105', NOW(), NOW()),
('test_user_106', '健康达人', 'https://placeholder.com/avatar.png', '13800000106', NOW(), NOW()),
('test_user_107', '烘焙爱好者', 'https://placeholder.com/avatar.png', '13800000107', NOW(), NOW()),
('test_user_108', '素食主义者', 'https://placeholder.com/avatar.png', '13800000108', NOW(), NOW()),
('test_user_109', '牛肉控Jack', 'https://placeholder.com/avatar.png', '13800000109', NOW(), NOW()),
('test_user_110', '调味料达人', 'https://placeholder.com/avatar.png', '13800000110', NOW(), NOW()),
('test_user_111', '干果零食控', 'https://placeholder.com/avatar.png', '13800000111', NOW(), NOW()),
('test_user_112', '餐厅采购员', 'https://placeholder.com/avatar.png', '13800000112', NOW(), NOW()),
('test_user_113', '家庭主妇Lisa', 'https://placeholder.com/avatar.png', '13800000113', NOW(), NOW()),
('test_user_114', '学生党小明', 'https://placeholder.com/avatar.png', '13800000114', NOW(), NOW()),
('test_user_115', '白领小张', 'https://placeholder.com/avatar.png', '13800000115', NOW(), NOW()),
('test_user_116', '退休老李', 'https://placeholder.com/avatar.png', '13800000116', NOW(), NOW()),
('test_user_117', '新手妈妈', 'https://placeholder.com/avatar.png', '13800000117', NOW(), NOW()),
('test_user_118', '健身达人Tom', 'https://placeholder.com/avatar.png', '13800000118', NOW(), NOW()),
('test_user_119', '素食主义Amy', 'https://placeholder.com/avatar.png', '13800000119', NOW(), NOW()),
('test_user_120', '美食博主', 'https://placeholder.com/avatar.png', '13800000120', NOW(), NOW()),
('test_user_121', '火锅爱好者', 'https://placeholder.com/avatar.png', '13800000121', NOW(), NOW()),
('test_user_122', '烧烤达人', 'https://placeholder.com/avatar.png', '13800000122', NOW(), NOW()),
('test_user_123', '甜品控Lucy', 'https://placeholder.com/avatar.png', '13800000123', NOW(), NOW()),
('test_user_124', '咖啡爱好者', 'https://placeholder.com/avatar.png', '13800000124', NOW(), NOW()),
('test_user_125', '茶道研究者', 'https://placeholder.com/avatar.png', '13800000125', NOW(), NOW()),
('test_user_126', '酒类收藏家', 'https://placeholder.com/avatar.png', '13800000126', NOW(), NOW()),
('test_user_127', '食材批发商', 'https://placeholder.com/avatar.png', '13800000127', NOW(), NOW()),
('test_user_128', '餐饮店老板', 'https://placeholder.com/avatar.png', '13800000128', NOW(), NOW()),
('test_user_129', '电商运营', 'https://placeholder.com/avatar.png', '13800000129', NOW(), NOW()),
('test_user_130', '社区团购长', 'https://placeholder.com/avatar.png', '13800000130', NOW(), NOW())
ON DUPLICATE KEY UPDATE
    nick_name = VALUES(nick_name),
    update_time = NOW();

-- ============================================
-- Phase 1.4: 生成5000+用户行为事件
-- 模拟真实的浏览、加购、收藏、购买行为
-- ============================================

-- 删除旧的模拟数据 (可选，避免重复)
DELETE FROM user_behavior_events WHERE wx_user_id LIKE 'test_user_%';

-- 使用存储过程生成行为数据
DROP PROCEDURE IF EXISTS generate_behavior_events;

DELIMITER //

CREATE PROCEDURE generate_behavior_events()
BEGIN
    DECLARE v_user_count INT DEFAULT 0;
    DECLARE v_product_count INT DEFAULT 0;
    DECLARE v_event_count INT DEFAULT 0;
    DECLARE i INT DEFAULT 0;
    DECLARE j INT DEFAULT 0;
    DECLARE v_user_id VARCHAR(64);
    DECLARE v_product_id VARCHAR(64);
    DECLARE v_product_name VARCHAR(256);
    DECLARE v_merchant_id BIGINT;
    DECLARE v_category_id VARCHAR(64);
    DECLARE v_event_type VARCHAR(32);
    DECLARE v_source_type VARCHAR(32);
    DECLARE v_session_id VARCHAR(64);
    DECLARE v_event_time DATETIME;
    DECLARE v_rand DOUBLE;

    -- 获取用户和商品数量
    SELECT COUNT(*) INTO v_user_count FROM wx_user WHERE openid LIKE 'test_user_%';
    SELECT COUNT(*) INTO v_product_count FROM goods_spu WHERE del_flag = 0;

    -- 为每个测试用户生成行为
    SET i = 101;
    WHILE i <= 130 DO
        SET v_user_id = CONCAT('test_user_', i);
        SET v_session_id = CONCAT('session_', v_user_id, '_', FLOOR(RAND() * 1000));

        -- 每个用户生成 50-200 个事件
        SET j = 0;
        WHILE j < 50 + FLOOR(RAND() * 150) DO
            -- 随机选择一个商品
            SELECT id, name, merchant_id, category_first
            INTO v_product_id, v_product_name, v_merchant_id, v_category_id
            FROM goods_spu
            WHERE del_flag = 0
            ORDER BY RAND()
            LIMIT 1;

            -- 生成随机事件类型 (view最多，purchase最少)
            SET v_rand = RAND();
            IF v_rand < 0.60 THEN
                SET v_event_type = 'view';
            ELSEIF v_rand < 0.75 THEN
                SET v_event_type = 'click';
            ELSEIF v_rand < 0.85 THEN
                SET v_event_type = 'cart_add';
            ELSEIF v_rand < 0.92 THEN
                SET v_event_type = 'favorite';
            ELSEIF v_rand < 0.97 THEN
                SET v_event_type = 'search';
            ELSE
                SET v_event_type = 'purchase';
            END IF;

            -- 生成来源类型
            SET v_rand = RAND();
            IF v_rand < 0.40 THEN
                SET v_source_type = 'home';
            ELSEIF v_rand < 0.65 THEN
                SET v_source_type = 'search';
            ELSEIF v_rand < 0.80 THEN
                SET v_source_type = 'category';
            ELSEIF v_rand < 0.95 THEN
                SET v_source_type = 'recommend';
            ELSE
                SET v_source_type = 'share';
            END IF;

            -- 生成随机事件时间 (最近30天内)
            SET v_event_time = DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY);
            SET v_event_time = DATE_ADD(v_event_time, INTERVAL FLOOR(RAND() * 86400) SECOND);

            -- 每10个事件换一个session
            IF j % 10 = 0 THEN
                SET v_session_id = CONCAT('session_', v_user_id, '_', FLOOR(RAND() * 1000));
            END IF;

            -- 插入事件
            INSERT INTO user_behavior_events (
                wx_user_id, event_type, event_time, target_type, target_id,
                target_name, session_id, device_type, source_type, create_time
            ) VALUES (
                v_user_id, v_event_type, v_event_time, 'product', v_product_id,
                v_product_name, v_session_id,
                ELT(1 + FLOOR(RAND() * 3), 'ios', 'android', 'devtools'),
                v_source_type, NOW()
            );

            SET j = j + 1;
            SET v_event_count = v_event_count + 1;
        END WHILE;

        SET i = i + 1;
    END WHILE;

    -- 输出生成的事件数量
    SELECT CONCAT('Generated ', v_event_count, ' behavior events for ', v_user_count, ' test users') AS result;
END //

DELIMITER ;

-- 执行存储过程
CALL generate_behavior_events();

-- 清理存储过程
DROP PROCEDURE IF EXISTS generate_behavior_events;

-- ============================================
-- 验证数据分布
-- ============================================

-- 检查商户分布
SELECT
    m.id AS merchant_id,
    m.merchant_name,
    COUNT(g.id) AS product_count,
    ROUND(COUNT(g.id) * 100.0 / (SELECT COUNT(*) FROM goods_spu WHERE del_flag = 0), 2) AS percentage
FROM merchant m
LEFT JOIN goods_spu g ON m.id = g.merchant_id AND g.del_flag = 0
WHERE m.del_flag = 0 OR m.del_flag IS NULL
GROUP BY m.id, m.merchant_name
HAVING product_count > 0
ORDER BY product_count DESC;

-- 检查行为事件分布
SELECT
    event_type,
    COUNT(*) AS event_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_behavior_events WHERE wx_user_id LIKE 'test_user_%'), 2) AS percentage
FROM user_behavior_events
WHERE wx_user_id LIKE 'test_user_%'
GROUP BY event_type
ORDER BY event_count DESC;

-- 检查用户行为数量
SELECT
    COUNT(DISTINCT wx_user_id) AS user_count,
    COUNT(*) AS total_events,
    ROUND(AVG(event_per_user), 2) AS avg_events_per_user
FROM (
    SELECT wx_user_id, COUNT(*) AS event_per_user
    FROM user_behavior_events
    WHERE wx_user_id LIKE 'test_user_%'
    GROUP BY wx_user_id
) t;
