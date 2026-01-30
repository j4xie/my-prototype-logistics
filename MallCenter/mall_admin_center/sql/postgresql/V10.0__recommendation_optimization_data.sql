-- ==========================================================
-- V10.0 推荐算法优化 - 数据准备 - PostgreSQL 版本
-- 解决问题: 所有商品集中在1个商户，导致推荐没有多样性
-- 创建日期: 2026-01-19
-- Converted from MySQL
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
ON CONFLICT (merchant_no) DO UPDATE SET
    merchant_name = EXCLUDED.merchant_name,
    update_time = NOW();

-- ============================================
-- Phase 1.2: 分配商品到不同商户
-- PostgreSQL 版本使用 CTE 和窗口函数
-- ============================================

-- 使用 CTE 为商品分配排名并更新商户
WITH product_ranking AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS row_num
    FROM goods_spu
    WHERE del_flag = '0'
),
merchant_ids AS (
    SELECT
        (SELECT id FROM merchant WHERE merchant_no = 'M005' LIMIT 1) AS m5,
        (SELECT id FROM merchant WHERE merchant_no = 'M006' LIMIT 1) AS m6,
        (SELECT id FROM merchant WHERE merchant_no = 'M007' LIMIT 1) AS m7,
        (SELECT id FROM merchant WHERE merchant_no = 'M008' LIMIT 1) AS m8,
        (SELECT id FROM merchant WHERE merchant_no = 'M009' LIMIT 1) AS m9,
        (SELECT id FROM merchant WHERE merchant_no = 'M010' LIMIT 1) AS m10,
        (SELECT id FROM merchant WHERE merchant_no = 'M011' LIMIT 1) AS m11,
        (SELECT id FROM merchant WHERE merchant_no = 'M012' LIMIT 1) AS m12
)
UPDATE goods_spu g
SET merchant_id = CASE
    WHEN pr.row_num BETWEEN 41 AND 54 THEN 1
    WHEN pr.row_num BETWEEN 55 AND 68 THEN 2
    WHEN pr.row_num BETWEEN 69 AND 82 THEN 3
    WHEN pr.row_num BETWEEN 83 AND 96 THEN (SELECT m5 FROM merchant_ids)
    WHEN pr.row_num BETWEEN 97 AND 110 THEN (SELECT m6 FROM merchant_ids)
    WHEN pr.row_num BETWEEN 111 AND 124 THEN (SELECT m7 FROM merchant_ids)
    WHEN pr.row_num BETWEEN 125 AND 138 THEN (SELECT m8 FROM merchant_ids)
    WHEN pr.row_num BETWEEN 139 AND 148 THEN (SELECT m9 FROM merchant_ids)
    WHEN pr.row_num BETWEEN 149 AND 154 THEN (SELECT m10 FROM merchant_ids)
    WHEN pr.row_num BETWEEN 155 AND 158 THEN (SELECT m11 FROM merchant_ids)
    WHEN pr.row_num BETWEEN 159 AND 161 THEN (SELECT m12 FROM merchant_ids)
    ELSE g.merchant_id
END
FROM product_ranking pr
WHERE g.id = pr.id;

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
ON CONFLICT (openid) DO UPDATE SET
    nick_name = EXCLUDED.nick_name,
    update_time = NOW();

-- ============================================
-- Phase 1.4: 生成用户行为事件
-- PostgreSQL 使用函数来生成行为数据
-- ============================================

-- 删除旧的模拟数据 (可选，避免重复)
DELETE FROM user_behavior_events WHERE wx_user_id LIKE 'test_user_%';

-- 创建生成行为事件的函数
CREATE OR REPLACE FUNCTION generate_behavior_events()
RETURNS TEXT AS $$
DECLARE
    v_user_id VARCHAR(64);
    v_product_id VARCHAR(64);
    v_product_name VARCHAR(256);
    v_merchant_id BIGINT;
    v_category_id VARCHAR(64);
    v_event_type VARCHAR(32);
    v_source_type VARCHAR(32);
    v_session_id VARCHAR(64);
    v_event_time TIMESTAMP;
    v_rand DOUBLE PRECISION;
    v_event_count INT := 0;
    i INT;
    j INT;
    events_per_user INT;
    product_rec RECORD;
BEGIN
    -- 为每个测试用户生成行为
    FOR i IN 101..130 LOOP
        v_user_id := 'test_user_' || i::TEXT;
        v_session_id := 'session_' || v_user_id || '_' || (random() * 1000)::INT;

        -- 每个用户生成 50-200 个事件
        events_per_user := 50 + (random() * 150)::INT;

        FOR j IN 1..events_per_user LOOP
            -- 随机选择一个商品
            SELECT id, name, merchant_id, category_first
            INTO product_rec
            FROM goods_spu
            WHERE del_flag = '0'
            ORDER BY random()
            LIMIT 1;

            v_product_id := product_rec.id;
            v_product_name := product_rec.name;
            v_merchant_id := product_rec.merchant_id;
            v_category_id := product_rec.category_first;

            -- 生成随机事件类型 (view最多，purchase最少)
            v_rand := random();
            IF v_rand < 0.60 THEN
                v_event_type := 'view';
            ELSIF v_rand < 0.75 THEN
                v_event_type := 'click';
            ELSIF v_rand < 0.85 THEN
                v_event_type := 'cart_add';
            ELSIF v_rand < 0.92 THEN
                v_event_type := 'favorite';
            ELSIF v_rand < 0.97 THEN
                v_event_type := 'search';
            ELSE
                v_event_type := 'purchase';
            END IF;

            -- 生成来源类型
            v_rand := random();
            IF v_rand < 0.40 THEN
                v_source_type := 'home';
            ELSIF v_rand < 0.65 THEN
                v_source_type := 'search';
            ELSIF v_rand < 0.80 THEN
                v_source_type := 'category';
            ELSIF v_rand < 0.95 THEN
                v_source_type := 'recommend';
            ELSE
                v_source_type := 'share';
            END IF;

            -- 生成随机事件时间 (最近30天内)
            v_event_time := NOW() - ((random() * 30)::INT || ' days')::INTERVAL;
            v_event_time := v_event_time + ((random() * 86400)::INT || ' seconds')::INTERVAL;

            -- 每10个事件换一个session
            IF j % 10 = 0 THEN
                v_session_id := 'session_' || v_user_id || '_' || (random() * 1000)::INT;
            END IF;

            -- 插入事件
            INSERT INTO user_behavior_events (
                wx_user_id, event_type, event_time, target_type, target_id,
                target_name, session_id, device_type, source_type, create_time
            ) VALUES (
                v_user_id, v_event_type, v_event_time, 'product', v_product_id,
                v_product_name, v_session_id,
                (ARRAY['ios', 'android', 'devtools'])[1 + (random() * 2)::INT],
                v_source_type, NOW()
            );

            v_event_count := v_event_count + 1;
        END LOOP;
    END LOOP;

    RETURN 'Generated ' || v_event_count || ' behavior events for 30 test users';
END;
$$ LANGUAGE plpgsql;

-- 执行函数生成数据
SELECT generate_behavior_events();

-- 清理函数
DROP FUNCTION IF EXISTS generate_behavior_events();

-- ============================================
-- 验证数据分布
-- ============================================

-- 检查商户分布
-- SELECT
--     m.id AS merchant_id,
--     m.merchant_name,
--     COUNT(g.id) AS product_count,
--     ROUND(COUNT(g.id) * 100.0 / (SELECT COUNT(*) FROM goods_spu WHERE del_flag = '0'), 2) AS percentage
-- FROM merchant m
-- LEFT JOIN goods_spu g ON m.id = g.merchant_id AND g.del_flag = '0'
-- WHERE m.del_flag = '0' OR m.del_flag IS NULL
-- GROUP BY m.id, m.merchant_name
-- HAVING COUNT(g.id) > 0
-- ORDER BY product_count DESC;

-- 检查行为事件分布
-- SELECT
--     event_type,
--     COUNT(*) AS event_count,
--     ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_behavior_events WHERE wx_user_id LIKE 'test_user_%'), 2) AS percentage
-- FROM user_behavior_events
-- WHERE wx_user_id LIKE 'test_user_%'
-- GROUP BY event_type
-- ORDER BY event_count DESC;

-- 检查用户行为数量
-- SELECT
--     COUNT(DISTINCT wx_user_id) AS user_count,
--     COUNT(*) AS total_events,
--     ROUND(AVG(event_per_user), 2) AS avg_events_per_user
-- FROM (
--     SELECT wx_user_id, COUNT(*) AS event_per_user
--     FROM user_behavior_events
--     WHERE wx_user_id LIKE 'test_user_%'
--     GROUP BY wx_user_id
-- ) t;
