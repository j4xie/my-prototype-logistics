-- V20260411_04: Register menu_engineering intent for P3 Task 3.2
-- Binds RESTAURANT_MENU_ENGINEERING intent to restaurant_menu_engineering
-- tool (created in P3.2, wrapping P3.1 MenuEngineeringAnalyzer).

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_MENU_ENGINEERING', '菜品工程 4 象限', 'SMARTBI', 'restaurant_menu_engineering', 'LOW',
        '["菜品工程","4 象限","Star","Puzzle","Dog","哪些菜撑","菜单结构","Kasavana","菜单瘦身","高利无人点"]',
        '菜品工程 4 象限分析 (Kasavana-Smith 模型). 按销量 × 毛利把菜品分为 Star/Cash Cow/Puzzle/Dog.',
        85, true)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = 'restaurant_menu_engineering',
    is_active = true;
