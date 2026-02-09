-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_21_07__extend_metric_formulas.sql
-- Conversion date: 2026-01-26 18:49:13
-- ============================================

-- ============================================================================
-- SmartBI 指标公式扩展字段
--
-- 为 smart_bi_metric_formulas 表添加图表相关配置字段
-- 支持指标与图表模板的关联，以及显示配置
--
-- 新增字段：
--   recommended_charts   - 推荐图表类型列表（JSON 数组）
--   chart_template_code  - 关联的默认图表模板代码
--   display_config       - 显示配置（颜色、图标等）
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-21
-- ============================================================================

-- 添加推荐图表类型列表字段
ALTER TABLE smart_bi_metric_formulas
ADD COLUMN recommended_charts JSON COMMENT '推荐图表类型列表，如 ["LINE", "BAR", "PIE"]';

-- 添加关联图表模板代码字段
ALTER TABLE smart_bi_metric_formulas
ADD COLUMN chart_template_code VARCHAR(64) COMMENT '关联的图表模板代码，如 finance_ratio_trend';

-- 添加显示配置字段
ALTER TABLE smart_bi_metric_formulas
ADD COLUMN display_config JSON COMMENT '显示配置（颜色、图标、阈值等）';

-- 添加索引以优化查询
ALTER TABLE smart_bi_metric_formulas
ADD INDEX idx_chart_template (chart_template_code);

-- ============================================================================
-- 更新现有指标的图表配置
-- ============================================================================

-- 销售额 - 推荐使用折线图、柱状图
UPDATE smart_bi_metric_formulas
SET recommended_charts = '["LINE", "BAR", "GAUGE"]',
    display_config = '{"color": "#5470c6", "icon": "trending-up", "thresholds": {"warning": 0.9, "danger": 0.7}}'
WHERE metric_code = 'sales_amount';

-- 毛利率 - 推荐使用折线图、仪表盘
UPDATE smart_bi_metric_formulas
SET recommended_charts = '["LINE", "GAUGE", "RADAR"]',
    chart_template_code = 'finance_ratio_trend',
    display_config = '{"color": "#91cc75", "icon": "percent", "thresholds": {"good": 0.3, "warning": 0.2, "danger": 0.1}}'
WHERE metric_code = 'gross_margin_rate';

-- 净利率 - 推荐使用折线图、仪表盘
UPDATE smart_bi_metric_formulas
SET recommended_charts = '["LINE", "GAUGE", "RADAR"]',
    chart_template_code = 'finance_ratio_trend',
    display_config = '{"color": "#fac858", "icon": "dollar-sign", "thresholds": {"good": 0.15, "warning": 0.08, "danger": 0.03}}'
WHERE metric_code = 'net_margin_rate';

-- 库存周转率 - 推荐使用柱状图、对比图
UPDATE smart_bi_metric_formulas
SET recommended_charts = '["BAR", "LINE"]',
    chart_template_code = 'turnover_comparison',
    display_config = '{"color": "#ee6666", "icon": "refresh-cw", "unit": "次/年"}'
WHERE metric_code = 'inventory_turnover';

-- 费用率 - 推荐使用饼图、折线图
UPDATE smart_bi_metric_formulas
SET recommended_charts = '["PIE", "LINE", "BAR"]',
    chart_template_code = 'cost_structure_pie',
    display_config = '{"color": "#73c0de", "icon": "pie-chart"}'
WHERE metric_code = 'expense_rate';

-- 达成率 - 推荐使用仪表盘
UPDATE smart_bi_metric_formulas
SET recommended_charts = '["GAUGE", "BAR"]',
    chart_template_code = 'kpi_gauge',
    display_config = '{"color": "#3ba272", "icon": "target", "thresholds": {"success": 1.0, "warning": 0.8, "danger": 0.6}}'
WHERE metric_code = 'achievement_rate';

-- ============================================================================
-- 日志记录
-- ============================================================================
SELECT 'V2026_01_21_07: smart_bi_metric_formulas 表扩展字段添加完成' AS migration_info;
