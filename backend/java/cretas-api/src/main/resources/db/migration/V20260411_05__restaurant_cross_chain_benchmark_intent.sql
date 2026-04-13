-- V20260411_05: Register cross_chain_benchmark intent for P3 Task 3.3-3.4
-- Unzombifies the 508-line CrossChainBenchmark class that was tested but
-- never wired. Now reachable via mobile chat.

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_CROSS_CHAIN_BENCHMARK', '跨连锁品牌对标', 'SMARTBI', 'restaurant_cross_chain_benchmark', 'LOW',
        '["跨连锁","跨品牌对标","川菜连锁","排第几","蜀大侠","小龙坎","同量级品牌","连锁排名","品牌对比","连锁品牌比较"]',
        '跨连锁品牌对标. 把多个品牌的 POS 数据放在一起对比, 分析人均客单/SKU复杂度/价格带/品类分布/菜品重叠度.',
        85, true)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = 'restaurant_cross_chain_benchmark',
    is_active = true;
