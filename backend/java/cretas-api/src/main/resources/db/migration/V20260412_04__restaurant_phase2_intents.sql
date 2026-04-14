INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_SEAT_OCCUPANCY', '桌位配置分析', 'SMARTBI', 'restaurant_seat_occupancy', 'LOW',
        '["桌位","占有率","餐位","几人位","两人位","四人位","桌子利用","座位配置"]',
        '分析桌位配置是否匹配客群人数分布', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_seat_occupancy', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_SEAT_CONFIG_MANAGE', '桌位配置管理', 'SMARTBI', 'restaurant_seat_config_manage', 'LOW',
        '["录入桌位","配置桌位","设置桌位","几号桌","桌位管理"]',
        '录入或更新门店桌位配置', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_seat_config_manage', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_COMBO_SPLIT', '套餐拆单统计', 'SMARTBI', 'restaurant_combo_split', 'LOW',
        '["套餐拆","拆单","套餐统计","套餐销量","单点还是套餐","拆分菜品"]',
        '把套餐商品拆分为实际菜品统计', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_combo_split', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_RETURN_ANOMALY', '退货异常检测', 'SMARTBI', 'restaurant_return_anomaly', 'LOW',
        '["退货异常","反复退货","供应商退货","验收异常","退货率","退货归因"]',
        '检测同批次各门店退货率, 识别异常门店', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_return_anomaly', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_REVIEW_COMPETITIVE', '评论竞品分析', 'SMARTBI', 'restaurant_review_competitive', 'LOW',
        '["竞品分析","竞品对比","别家做得好","竞争对手","同行对比","评分对比","点评对比"]',
        '对比自家与竞品在点评平台的评分/评论数/客单价', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_review_competitive', is_active = true;
