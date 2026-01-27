-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_24_02__budget_yoy_templates.sql
-- Conversion date: 2026-01-26 18:49:36
-- ============================================

-- ============================================================================
-- SmartBI 图表模板 - 预算达成与同比环比分析
--
-- 新增模板：
--   1. budget_achievement    - 预算达成分析图（季度+月度组合展示）
--   2. yoy_mom_comparison   - 同比环比分析图（年月季多层对比）
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-24
-- ============================================================================

-- 1. 预算达成分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('budget_achievement', '预算达成分析图', 'LINE_BAR', 'FINANCE',
 '["budget_amount", "actual_amount", "achievement_rate", "variance", "quarterly_budget", "monthly_actual"]',
 '{
   "title": {"text": "预算达成分析", "subtext": "季度预算 vs 月度实际", "left": "center"},
   "tooltip": {
     "trigger": "axis",
     "axisPointer": {"type": "cross", "crossStyle": {"color": "#999"}}
   },
   "legend": {"data": ["预算金额", "实际金额", "达成率"], "bottom": 10},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": [
     {
       "type": "category",
       "data": [],
       "axisPointer": {"type": "shadow"},
       "axisLabel": {"interval": 0, "rotate": 0}
     }
   ],
   "yAxis": [
     {"type": "value", "name": "金额（万元）", "position": "left", "axisLabel": {"formatter": "{value}"}},
     {"type": "value", "name": "达成率（%）", "position": "right", "min": 0, "max": 150, "axisLabel": {"formatter": "{value}%"}}
   ],
   "series": [
     {
       "name": "预算金额",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#5470c6"},
       "barGap": "0%",
       "label": {"show": false}
     },
     {
       "name": "实际金额",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#91cc75"},
       "label": {"show": true, "position": "top", "formatter": "{c}"}
     },
     {
       "name": "达成率",
       "type": "line",
       "yAxisIndex": 1,
       "data": [],
       "smooth": true,
       "symbol": "circle",
       "symbolSize": 8,
       "lineStyle": {"width": 3, "color": "#ee6666"},
       "itemStyle": {"color": "#ee6666"},
       "label": {"show": true, "position": "top", "formatter": "{c}%"},
       "markLine": {
         "data": [{"yAxis": 100, "name": "目标线"}],
         "lineStyle": {"type": "dashed", "color": "#fac858"},
         "label": {"formatter": "目标 100%"}
       }
     }
   ],
   "dataZoom": [
     {"type": "inside", "start": 0, "end": 100},
     {"type": "slider", "start": 0, "end": 100, "bottom": 30}
   ]
 }',
 '{
   "xAxisField": "period",
   "periodType": "mixed",
   "quarterIndicator": true,
   "series": [
     {"field": "budgetAmount", "name": "预算金额", "yAxisIndex": 0},
     {"field": "actualAmount", "name": "实际金额", "yAxisIndex": 0},
     {"field": "achievementRate", "name": "达成率", "yAxisIndex": 1}
   ],
   "calculations": {
     "achievementRate": "actualAmount / budgetAmount * 100",
     "variance": "actualAmount - budgetAmount"
   }
 }',
 '{"width": 850, "height": 500, "position": "center"}',
 '季度时间轴+月度指示器，展示预算达成情况',
 9);

-- 2. 同比环比综合分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('yoy_mom_comparison', '同比环比分析图', 'LINE_BAR', 'FINANCE',
 '["current_value", "last_year_value", "last_month_value", "yoy_rate", "mom_rate", "sales_amount", "profit", "cost"]',
 '{
   "title": {"text": "同比环比综合分析", "subtext": "多维度对比视图", "left": "center"},
   "tooltip": {
     "trigger": "axis",
     "axisPointer": {"type": "cross"},
     "formatter": "{Function}"
   },
   "legend": {"data": ["本期", "去年同期", "上月", "同比增长率", "环比增长率"], "bottom": 10, "type": "scroll"},
   "grid": {"left": "3%", "right": "4%", "bottom": "18%", "containLabel": true},
   "xAxis": [
     {
       "type": "category",
       "data": [],
       "axisPointer": {"type": "shadow"},
       "axisLabel": {"interval": 0, "rotate": 30}
     }
   ],
   "yAxis": [
     {"type": "value", "name": "金额（万元）", "position": "left"},
     {"type": "value", "name": "增长率（%）", "position": "right", "axisLabel": {"formatter": "{value}%"}}
   ],
   "series": [
     {
       "name": "本期",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#5470c6"},
       "label": {"show": true, "position": "top"}
     },
     {
       "name": "去年同期",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#91cc75", "opacity": 0.7}
     },
     {
       "name": "上月",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#fac858", "opacity": 0.7}
     },
     {
       "name": "同比增长率",
       "type": "line",
       "yAxisIndex": 1,
       "data": [],
       "smooth": true,
       "symbol": "triangle",
       "symbolSize": 10,
       "lineStyle": {"width": 2, "color": "#ee6666"},
       "itemStyle": {"color": "#ee6666"},
       "label": {"show": true, "position": "top", "formatter": "{c}%"}
     },
     {
       "name": "环比增长率",
       "type": "line",
       "yAxisIndex": 1,
       "data": [],
       "smooth": true,
       "symbol": "diamond",
       "symbolSize": 10,
       "lineStyle": {"width": 2, "color": "#73c0de", "type": "dashed"},
       "itemStyle": {"color": "#73c0de"},
       "label": {"show": true, "position": "bottom", "formatter": "{c}%"}
     }
   ],
   "visualMap": {
     "show": false,
     "seriesIndex": [3, 4],
     "pieces": [
       {"gt": 0, "color": "#91cc75"},
       {"lte": 0, "color": "#ee6666"}
     ]
   },
   "dataZoom": [
     {"type": "inside", "start": 0, "end": 100}
   ]
 }',
 '{
   "xAxisField": "period",
   "periodType": "flexible",
   "supportedPeriods": ["month", "quarter", "year"],
   "series": [
     {"field": "currentValue", "name": "本期", "yAxisIndex": 0},
     {"field": "lastYearValue", "name": "去年同期", "yAxisIndex": 0},
     {"field": "lastMonthValue", "name": "上月", "yAxisIndex": 0},
     {"field": "yoyRate", "name": "同比增长率", "yAxisIndex": 1},
     {"field": "momRate", "name": "环比增长率", "yAxisIndex": 1}
   ],
   "calculations": {
     "yoyRate": "(currentValue - lastYearValue) / lastYearValue * 100",
     "momRate": "(currentValue - lastMonthValue) / lastMonthValue * 100"
   },
   "colorMapping": {
     "positive": "#91cc75",
     "negative": "#ee6666",
     "neutral": "#909399"
   }
 }',
 '{"width": 900, "height": 550, "position": "center"}',
 '年月季多层数据展示，支持同比环比对比',
 10);

-- ============================================================================
-- 日志记录
-- ============================================================================
SELECT CONCAT('V2026_01_24_02: 预算达成与同比环比模板创建完成，新增 2 条数据，当前总计 ',
    (SELECT COUNT(*) FROM smart_bi_chart_templates), ' 条模板') AS migration_info;
