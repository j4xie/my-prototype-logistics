-- ============================================================================
-- 添加通用柱状图模板 (general_bar) - PostgreSQL 版本
--
-- 这是默认的兜底模板，当没有其他模板匹配时使用
-- 支持任意类型的数据展示
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-02-05
-- ============================================================================

-- 1. 通用柱状图模板（默认模板）
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order, is_active)
VALUES
('general_bar', '通用柱状图', 'BAR', 'GENERAL',
 '["amount", "quantity", "value", "total", "count"]',
 '{
   "title": {"text": "数据分析", "left": "center"},
   "tooltip": {
     "trigger": "axis",
     "axisPointer": {"type": "shadow"}
   },
   "legend": {"bottom": 10, "type": "scroll"},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {"type": "category", "data": [], "axisLabel": {"interval": 0, "rotate": 30}},
   "yAxis": {"type": "value", "name": "数值"},
   "series": []
 }',
 '{
   "xAxisField": "category",
   "valueFields": ["value", "amount", "quantity", "total"],
   "autoDetect": true
 }',
 '{"width": 800, "height": 450, "position": "center"}',
 '通用数据可视化模板，自动适配各类数据结构',
 100)
ON CONFLICT (template_code, factory_id) WHERE factory_id IS NULL
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  chart_options = EXCLUDED.chart_options,
  data_mapping = EXCLUDED.data_mapping,
  is_active = TRUE;

-- 2. 预算实际对比柱状图模板（专门用于预算vs实际数据）
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order, is_active)
VALUES
('budget_vs_actual', '预算实际对比图', 'BAR', 'FINANCE',
 '["budget_amount", "actual_amount", "budget", "actual", "variance"]',
 '{
   "title": {"text": "预算 vs 实际对比", "left": "center"},
   "tooltip": {
     "trigger": "axis",
     "axisPointer": {"type": "shadow"},
     "formatter": "{b}<br/>预算: {c0}<br/>实际: {c1}"
   },
   "legend": {"data": ["预算", "实际"], "bottom": 10},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {"type": "category", "data": [], "axisLabel": {"interval": 0, "rotate": 30}},
   "yAxis": {"type": "value", "name": "金额"},
   "series": [
     {
       "name": "预算",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#5470c6"},
       "barGap": "10%"
     },
     {
       "name": "实际",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#91cc75"}
     }
   ]
 }',
 '{
   "xAxisField": "category",
   "series": [
     {"field": "budget_amount", "name": "预算"},
     {"field": "actual_amount", "name": "实际"}
   ]
 }',
 '{"width": 800, "height": 500, "position": "center"}',
 '预算与实际金额的对比分析，适用于财务报表',
 5)
ON CONFLICT (template_code, factory_id) WHERE factory_id IS NULL
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  chart_options = EXCLUDED.chart_options,
  data_mapping = EXCLUDED.data_mapping,
  is_active = TRUE;

-- ============================================================================
-- 日志记录
-- ============================================================================
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM smart_bi_chart_templates WHERE is_active = TRUE;
  RAISE NOTICE 'V2026_02_05_01: 通用图表模板创建完成，当前总计 % 条有效模板', template_count;
END $$;
