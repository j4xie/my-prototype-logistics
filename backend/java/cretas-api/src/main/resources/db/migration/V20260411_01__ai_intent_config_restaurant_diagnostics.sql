-- V20260411_01: Register 14 restaurant diagnostic intents for P2 Task 2.8
--
-- Binds keywords to each restaurant_*_analysis tool (created in P2.3-2.6).
-- Enables keyword-based intent matching in AIIntentService layers 1-4
-- (EXACT / PHRASE_MATCH / REGEX / KEYWORD) and falls back to LLM layer
-- via ToolRouterService.
--
-- Category: SMARTBI (reuses existing category used by other restaurant analytics)
-- Sensitivity: LOW (read-only diagnostic queries, no data mutation)
-- Idempotent via ON CONFLICT (intent_code) DO UPDATE.

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_COST_RIGIDITY', '成本刚性诊断', 'SMARTBI', 'restaurant_cost_rigidity_analysis', 'LOW',
        '["成本刚性","刚性","人工成本占比","为什么亏","营收和人工","成本结构"]',
        '分析餐厅成本刚性 (Δ人工/Δ营收), 识别过度刚性并给出年化影响', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_cost_rigidity_analysis', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_BENCHMARK_ALERT', '行业对标预警', 'SMARTBI', 'restaurant_benchmark_alert', 'LOW',
        '["对标","行业基准","行业平均","比别人差","火锅行业","川菜行业","差在哪"]',
        '对比门店指标与子行业中位数和健康区间, 输出警报和年化影响', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_benchmark_alert', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_CHANNEL_MARGIN', '渠道毛利率分析', 'SMARTBI', 'restaurant_channel_margin', 'LOW',
        '["渠道毛利","堂食外卖","美团抽成","饿了么抽成","团购","渠道贡献"]',
        '按订单来源 (堂食/外卖/团购) 拆分营收贡献和净收款率', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_channel_margin', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_DINING_HEATMAP', '时段客流热力图', 'SMARTBI', 'restaurant_dining_heatmap', 'LOW',
        '["时段客流","几点最忙","午市晚市","下午时段","空闲时段","热力图"]',
        '按小时聚合堂食营收, 识别高峰低谷时段', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_dining_heatmap', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_LONG_TAIL_SKU', '长尾菜品识别', 'SMARTBI', 'restaurant_long_tail_sku', 'LOW',
        '["长尾","哪些菜该砍","菜单瘦身","末位淘汰","冗余SKU","冗余菜品"]',
        '识别销量占比 <3% 的冗余 SKU, 估算年省成本', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_long_tail_sku', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_MENU_NORMALIZATION', '菜名归一统计', 'SMARTBI', 'restaurant_menu_normalization', 'LOW',
        '["菜单归一","重复菜名","SKU精简","菜名清洗","归一后SKU"]',
        '合并重复别名, 给出归一后的 unique SKU 数', 80, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_menu_normalization', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_TEMPORAL_COMPARISON', '同店同比分析', 'SMARTBI', 'restaurant_temporal_comparison', 'LOW',
        '["同店同比","同比","环比","比上个月","比去年","YoY","MoM"]',
        '对比不同时间段的营收变化, 给出趋势解读', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_temporal_comparison', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_REVIEW_ANALYSIS', '评论情感分析', 'SMARTBI', 'restaurant_review_analysis', 'LOW',
        '["评论","点评","大众点评","美团评论","客户怎么说","差评","好评","评分下降"]',
        '基于大众点评/美团评论的 SKU 情感抽取 (DeepSeek V3.2)', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_review_analysis', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_MEMBER_RFM', '会员RFM分层', 'SMARTBI', 'restaurant_member_rfm', 'LOW',
        '["会员分层","RFM","冠军客户","流失客户","召回","复购","客户留存"]',
        '基于 Recency/Frequency/Monetary 打分, 识别流失客户和核心贡献者', 80, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_member_rfm', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_STORED_VALUE', '储值卡健康分析', 'SMARTBI', 'restaurant_stored_value', 'LOW',
        '["储值卡","充值卡","核销率","兑付余额","储值余额","充卡"]',
        '评估充卡后的兑付健康度 (月核销率 + 兑付余额 + 警戒线)', 80, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_stored_value', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_MULTI_STORE', '多店对比异常检测', 'SMARTBI', 'restaurant_multi_store_comparison', 'LOW',
        '["多店对比","门店排名","17家店","哪家最好","哪家最差","异常店","门店Top"]',
        '横向对比多门店的财务和运营指标, 识别异常门店', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_multi_store_comparison', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_CALIBRATION_HISTORY', 'BOM月度校准历史', 'SMARTBI', 'restaurant_calibration_history', 'LOW',
        '["校准历史","BOM校准","食材成本偏移","月度异常","什么时候开始掉"]',
        '追溯食材成本率的月度偏移曲线, 识别异常时间点', 80, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_calibration_history', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_STORE_PNL', '单店P&L一页纸', 'SMARTBI', 'restaurant_store_pnl_one_pager', 'LOW',
        '["P&L","利润表","完整财务","一页纸","headline","门店诊断报告"]',
        '生成完整的单店利润表简报, 含 headline 金句和关键警告', 85, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_store_pnl_one_pager', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'RESTAURANT_BOM_LAYER_STATUS', 'BOM数据精度状态', 'SMARTBI', 'restaurant_bom_layer_status', 'LOW',
        '["BOM精度","数据缺口","还要上传什么","Layer","数据完整度"]',
        '报告当前 SKU 表单覆盖率和月度采购校准层级, 提示升级路径', 75, true, NOW(), NOW())
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_bom_layer_status', is_active = true;
