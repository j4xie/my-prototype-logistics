-- v32.1: 更新餐饮意图描述，提升 LLM 分类区分度
-- 旧 description 过短（4-10字），导致 LLM 无法区分意图

-- 菜品查询类
UPDATE ai_intent_configs SET description = '查询餐厅当前在售菜品列表，包括菜名、分类、价格、状态（在售/停售）'
WHERE intent_code = 'RESTAURANT_DISH_LIST';

UPDATE ai_intent_configs SET description = '按销量降序查询最畅销的TOP菜品，返回菜名、销量、销售额'
WHERE intent_code = 'RESTAURANT_BESTSELLER_QUERY';

UPDATE ai_intent_configs SET description = '查询菜品销量排行榜，按销量从高到低排列，包含菜名、销量、金额'
WHERE intent_code = 'RESTAURANT_DISH_SALES_RANKING';

UPDATE ai_intent_configs SET description = '查询销量最低的滞销菜品，帮助菜单优化决策，返回低销量菜品列表'
WHERE intent_code = 'RESTAURANT_SLOW_SELLER_QUERY';

UPDATE ai_intent_configs SET description = '分析每道菜的食材成本构成和成本率，需要BOM配方数据支持'
WHERE intent_code = 'RESTAURANT_DISH_COST_ANALYSIS';

-- 食材管理类
UPDATE ai_intent_configs SET description = '查询各食材当前库存数量、单位及安全库存状态，列出所有食材清单'
WHERE intent_code = 'RESTAURANT_INGREDIENT_STOCK';

UPDATE ai_intent_configs SET description = '检查并列出距到期日不超过7天的食材批次，按到期时间排序给出处理建议'
WHERE intent_code = 'RESTAURANT_INGREDIENT_EXPIRY_ALERT';

UPDATE ai_intent_configs SET description = '查询库存低于安全库存量的食材，提醒需要补货的品类'
WHERE intent_code = 'RESTAURANT_INGREDIENT_LOW_STOCK';

UPDATE ai_intent_configs SET description = '分析食材采购价格的变化趋势，对比不同时期的进货成本变动'
WHERE intent_code = 'RESTAURANT_INGREDIENT_COST_TREND';

UPDATE ai_intent_configs SET description = '根据库存消耗速度和安全库存自动生成采购建议清单，包含建议采购量'
WHERE intent_code = 'RESTAURANT_PROCUREMENT_SUGGESTION';

-- 营业分析类
UPDATE ai_intent_configs SET description = '查询当日（或指定日期）的营业额总额，包含订单数、客单价等关键指标'
WHERE intent_code = 'RESTAURANT_DAILY_REVENUE';

UPDATE ai_intent_configs SET description = '查询近期营业额的变化趋势，按日/周/月展示收入走势图数据'
WHERE intent_code = 'RESTAURANT_REVENUE_TREND';

UPDATE ai_intent_configs SET description = '查询订单数量统计，包含总订单数、平均客单价、就餐人次等数据'
WHERE intent_code = 'RESTAURANT_ORDER_STATISTICS';

UPDATE ai_intent_configs SET description = '分析不同时段的客流和订单分布，识别午市晚市高峰时段'
WHERE intent_code = 'RESTAURANT_PEAK_HOURS_ANALYSIS';

UPDATE ai_intent_configs SET description = '分析餐厅整体毛利率和利润情况，计算收入减去食材成本后的利润'
WHERE intent_code = 'RESTAURANT_MARGIN_ANALYSIS';

-- 损耗管理类
UPDATE ai_intent_configs SET description = '汇总统计食材损耗总量和金额，按食材分类展示损耗明细'
WHERE intent_code = 'RESTAURANT_WASTAGE_SUMMARY';

UPDATE ai_intent_configs SET description = '计算食材损耗率百分比，损耗金额占采购金额的比例'
WHERE intent_code = 'RESTAURANT_WASTAGE_RATE';

UPDATE ai_intent_configs SET description = '检测损耗异常偏高的食材品类，识别超出正常范围的异常损耗'
WHERE intent_code = 'RESTAURANT_WASTAGE_ANOMALY';
