-- Fix-1 (P0): 报工防重提交 — 同一工人+同一批次+同一日期唯一约束
-- Fix-3 (P1): 效率对比 AI Tool 意图配置

-- ==================== Fix-1: 报工防重唯一约束 ====================
-- 注意: 仅对 batch_id 非空的记录生效 (HOURS 类型报工无 batchId)
CREATE UNIQUE INDEX IF NOT EXISTS uk_report_worker_batch_date
    ON production_reports (factory_id, worker_id, batch_id, report_date)
    WHERE deleted_at IS NULL AND batch_id IS NOT NULL;

-- ==================== Fix-3: 效率对比意图配置 ====================
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, keywords, regex_pattern,
    is_active, priority, sensitivity_level,
    description
) VALUES (
    gen_random_uuid(),
    'EFFICIENCY_COMPARISON',
    '效率对比分析',
    'ANALYSIS',
    'efficiency_comparison',
    '["效率对比","效率比较","产能对比","产能比较","效率排名","工人排名","生产效率","人效对比","产出对比","效率趋势","绩效排名","效率分析"]',
    '.*(效率.*(对比|比较|排名|分析)|产能.*(对比|比较)|人效.*(对比|分析)|工人.*(排名|效率)|绩效.*(排名|对比)).*',
    true,
    85,
    'LOW',
    '对比不同时间段或不同工人的生产效率，包含产出效率、良品率、人均产出、工时利用率等指标'
) ON CONFLICT (intent_code) DO NOTHING;

-- 添加短语映射
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    tool_name, keywords, regex_pattern,
    is_active, priority, sensitivity_level
) VALUES (
    gen_random_uuid(),
    'EFFICIENCY_COMPARE_ALIAS',
    '效率对比(别名)',
    'ANALYSIS',
    'efficiency_comparison',
    '["对比一下效率","比较一下效率","看看效率","效率怎么样","产出排行"]',
    '.*(对比一下|比较一下).*(效率|产出|产能).*',
    true,
    80,
    'LOW'
) ON CONFLICT (intent_code) DO NOTHING;
