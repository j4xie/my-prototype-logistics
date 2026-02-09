-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_21_06__chart_templates.sql
-- Conversion date: 2026-01-26 18:49:11
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================================
-- SmartBI 图表模板配置表
--
-- 支持动态配置各类图表模板，用于财务分析、销售分析等场景
-- 包含 ECharts 完整配置、数据映射规则、布局配置等
--
-- 图表类型：
--   LINE      - 折线图
--   BAR       - 柱状图
--   PIE       - 饼图
--   RADAR     - 雷达图
--   WATERFALL - 瀑布图
--   TREE      - 树图
--   SANKEY    - 桑基图
--   GAUGE     - 仪表盘
--   LINE_BAR  - 折线柱状混合图
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-21
-- ============================================================================

-- 创建图表模板配置表
CREATE TABLE IF NOT EXISTS smart_bi_chart_templates (
    id BIGSERIAL PRIMARY KEY COMMENT '主键ID',

    -- 模板基本信息
    template_code VARCHAR(64) NOT NULL COMMENT '模板代码，如 dupont_tree',
    template_name VARCHAR(128) NOT NULL COMMENT '模板名称',
    chart_type VARCHAR(32) NOT NULL COMMENT '基础图表类型：LINE/BAR/PIE/RADAR/WATERFALL/TREE/SANKEY/GAUGE',
    category VARCHAR(32) DEFAULT 'GENERAL' COMMENT '分类：FINANCE/SALES/OPERATION/GENERAL',

    -- 配置信息（JSON 格式）
    applicable_metrics JSON COMMENT '适用指标代码列表',
    chart_options JSON COMMENT 'ECharts 配置选项（完整覆盖）',
    data_mapping JSON COMMENT '数据字段映射规则',
    layout_config JSON COMMENT '布局配置（宽高、位置等）',

    -- 描述与展示
    description VARCHAR(255) COMMENT '描述',
    thumbnail_url VARCHAR(255) COMMENT '缩略图URL',

    -- 工厂配置
    factory_id VARCHAR(32) COMMENT '工厂ID（NULL=全局）',

    -- 状态与排序
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    sort_order INT DEFAULT 0 COMMENT '排序',

    -- 审计字段 (继承 BaseEntity)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',

    -- 唯一约束：同一工厂下模板代码唯一
    UNIQUE KEY uk_template_factory (template_code, factory_id),

    -- 索引
    INDEX idx_chart_type (chart_type),
    INDEX idx_category (category),
    INDEX idx_active (is_active)
)
;

-- ============================================================================
-- 初始化数据：财务分析图表模板
-- ============================================================================

-- 1. 财务健康度雷达图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('finance_health_radar', '财务健康度雷达图', 'RADAR', 'FINANCE',
 '["profitability", "liquidity", "solvency", "efficiency", "growth"]',
 '{
   "title": {"text": "财务健康度分析", "left": "center"},
   "tooltip": {"trigger": "item"},
   "legend": {"orient": "vertical", "left": "left"},
   "radar": {
     "indicator": [
       {"name": "盈利能力", "max": 100},
       {"name": "流动性", "max": 100},
       {"name": "偿债能力", "max": 100},
       {"name": "运营效率", "max": 100},
       {"name": "成长能力", "max": 100}
     ],
     "shape": "polygon",
     "splitNumber": 5,
     "axisLine": {"lineStyle": {"color": "rgba(211, 253, 250, 0.8)"}},
     "splitLine": {"lineStyle": {"color": "rgba(211, 253, 250, 0.8)"}},
     "splitArea": {"areaStyle": {"color": ["rgba(250,250,250,0.3)", "rgba(200,200,200,0.3)"]}}
   },
   "series": [{
     "type": "radar",
     "data": [],
     "areaStyle": {"opacity": 0.3},
     "lineStyle": {"width": 2}
   }]
 }',
 '{
   "dimensions": ["profitability", "liquidity", "solvency", "efficiency", "growth"],
   "valueField": "score",
   "nameField": "indicatorName"
 }',
 '{"width": 600, "height": 500, "position": "center"}',
 '综合评估企业财务健康状况的五个维度：盈利能力、流动性、偿债能力、运营效率、成长能力',
 1);

-- 2. 杜邦分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('dupont_analysis', '杜邦分析图', 'LINE_BAR', 'FINANCE',
 '["roe", "net_margin_rate", "asset_turnover", "equity_multiplier", "net_profit", "sales_amount", "total_assets", "equity"]',
 '{
   "title": {"text": "杜邦分析 - ROE 分解", "left": "center"},
   "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
   "legend": {"data": ["净利率", "资产周转率", "权益乘数", "ROE"], "bottom": 10},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {"type": "category", "data": []},
   "yAxis": [
     {"type": "value", "name": "比率 (%)", "position": "left"},
     {"type": "value", "name": "倍数", "position": "right"}
   ],
   "series": [
     {"name": "净利率", "type": "bar", "yAxisIndex": 0, "data": []},
     {"name": "资产周转率", "type": "bar", "yAxisIndex": 1, "data": []},
     {"name": "权益乘数", "type": "bar", "yAxisIndex": 1, "data": []},
     {"name": "ROE", "type": "line", "yAxisIndex": 0, "data": [], "smooth": true, "lineStyle": {"width": 3}}
   ]
 }',
 '{
   "xAxisField": "period",
   "series": [
     {"field": "netMarginRate", "name": "净利率"},
     {"field": "assetTurnover", "name": "资产周转率"},
     {"field": "equityMultiplier", "name": "权益乘数"},
     {"field": "roe", "name": "ROE"}
   ]
 }',
 '{"width": 800, "height": 500, "position": "center"}',
 '杜邦分析：ROE = 净利率 x 资产周转率 x 权益乘数，用于分解企业盈利能力来源',
 2);

-- 3. 现金流量瀑布图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('cashflow_waterfall', '现金流量瀑布图', 'WATERFALL', 'FINANCE',
 '["operating_cashflow", "investing_cashflow", "financing_cashflow", "net_cashflow", "beginning_cash", "ending_cash"]',
 '{
   "title": {"text": "现金流量瀑布分析", "left": "center"},
   "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
   "legend": {"data": ["增加", "减少", "总计"], "bottom": 10},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {"type": "category", "data": ["期初余额", "经营活动", "投资活动", "筹资活动", "期末余额"]},
   "yAxis": {"type": "value", "name": "金额（万元）"},
   "series": [
     {"name": "辅助", "type": "bar", "stack": "Total", "itemStyle": {"borderColor": "transparent", "color": "transparent"}, "data": []},
     {"name": "增加", "type": "bar", "stack": "Total", "itemStyle": {"color": "#91cc75"}, "label": {"show": true, "position": "top"}, "data": []},
     {"name": "减少", "type": "bar", "stack": "Total", "itemStyle": {"color": "#ee6666"}, "label": {"show": true, "position": "bottom"}, "data": []},
     {"name": "总计", "type": "bar", "stack": "Total", "itemStyle": {"color": "#5470c6"}, "label": {"show": true, "position": "top"}, "data": []}
   ]
 }',
 '{
   "categories": ["beginningCash", "operatingCashflow", "investingCashflow", "financingCashflow", "endingCash"],
   "valueField": "amount",
   "typeField": "flowType"
 }',
 '{"width": 700, "height": 450, "position": "center"}',
 '展示现金流量从期初到期末的变化过程，区分经营、投资、筹资活动的影响',
 3);

-- 4. 盈亏平衡分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('breakeven_analysis', '盈亏平衡分析图', 'LINE', 'FINANCE',
 '["fixed_cost", "variable_cost", "unit_price", "breakeven_point", "sales_amount", "total_cost", "profit"]',
 '{
   "title": {"text": "盈亏平衡分析", "left": "center"},
   "tooltip": {"trigger": "axis"},
   "legend": {"data": ["总收入", "总成本", "固定成本"], "bottom": 10},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {"type": "value", "name": "销量（件）", "min": 0},
   "yAxis": {"type": "value", "name": "金额（万元）"},
   "series": [
     {"name": "总收入", "type": "line", "data": [], "lineStyle": {"color": "#91cc75", "width": 2}},
     {"name": "总成本", "type": "line", "data": [], "lineStyle": {"color": "#ee6666", "width": 2}},
     {"name": "固定成本", "type": "line", "data": [], "lineStyle": {"color": "#fac858", "type": "dashed"}}
   ],
   "markPoint": {
     "data": [{"name": "盈亏平衡点", "coord": [], "itemStyle": {"color": "#5470c6"}}]
   },
   "markArea": {
     "data": [[{"name": "亏损区", "xAxis": 0}, {"xAxis": null}], [{"name": "盈利区", "xAxis": null}, {"xAxis": "max"}]]
   }
 }',
 '{
   "xAxisField": "quantity",
   "series": [
     {"field": "revenue", "name": "总收入"},
     {"field": "totalCost", "name": "总成本"},
     {"field": "fixedCost", "name": "固定成本"}
   ],
   "breakeven": {"quantityField": "breakevenQuantity", "amountField": "breakevenAmount"}
 }',
 '{"width": 700, "height": 450, "position": "center"}',
 '分析固定成本、变动成本与收入的关系，找出盈亏平衡点',
 4);

-- 5. 成本结构分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('cost_structure_pie', '成本结构分析图', 'PIE', 'FINANCE',
 '["material_cost", "labor_cost", "manufacturing_overhead", "admin_expense", "sales_expense", "financial_expense"]',
 '{
   "title": {"text": "成本费用结构分析", "subtext": "按类别占比", "left": "center"},
   "tooltip": {"trigger": "item", "formatter": "{a} <br/>{b}: {c}万元 ({d}%)"},
   "legend": {"orient": "vertical", "left": "left", "top": "middle"},
   "series": [{
     "name": "成本结构",
     "type": "pie",
     "radius": ["40%", "70%"],
     "center": ["60%", "50%"],
     "avoidLabelOverlap": true,
     "itemStyle": {"borderRadius": 10, "borderColor": "#fff", "borderWidth": 2},
     "label": {"show": true, "formatter": "{b}: {d}%"},
     "emphasis": {
       "label": {"show": true, "fontSize": 16, "fontWeight": "bold"},
       "itemStyle": {"shadowBlur": 10, "shadowOffsetX": 0, "shadowColor": "rgba(0, 0, 0, 0.5)"}
     },
     "labelLine": {"show": true},
     "data": []
   }],
   "color": ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4"]
 }',
 '{
   "nameField": "costCategory",
   "valueField": "amount",
   "categories": [
     {"code": "material_cost", "name": "原材料成本"},
     {"code": "labor_cost", "name": "人工成本"},
     {"code": "manufacturing_overhead", "name": "制造费用"},
     {"code": "admin_expense", "name": "管理费用"},
     {"code": "sales_expense", "name": "销售费用"},
     {"code": "financial_expense", "name": "财务费用"}
   ]
 }',
 '{"width": 600, "height": 450, "position": "center"}',
 '分析企业成本费用的构成比例，识别主要成本驱动因素',
 5);

-- 6. 财务比率趋势图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('finance_ratio_trend', '财务比率趋势图', 'LINE', 'FINANCE',
 '["current_ratio", "quick_ratio", "debt_ratio", "interest_coverage", "gross_margin_rate", "net_margin_rate", "roe", "roa"]',
 '{
   "title": {"text": "关键财务比率趋势", "left": "center"},
   "tooltip": {"trigger": "axis"},
   "legend": {"data": ["流动比率", "速动比率", "毛利率", "净利率", "ROE"], "bottom": 10, "type": "scroll"},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {"type": "category", "boundaryGap": false, "data": []},
   "yAxis": [
     {"type": "value", "name": "比率", "position": "left", "axisLabel": {"formatter": "{value}"}},
     {"type": "value", "name": "百分比 (%)", "position": "right", "axisLabel": {"formatter": "{value}%"}}
   ],
   "series": [
     {"name": "流动比率", "type": "line", "yAxisIndex": 0, "data": [], "smooth": true, "symbol": "circle"},
     {"name": "速动比率", "type": "line", "yAxisIndex": 0, "data": [], "smooth": true, "symbol": "circle"},
     {"name": "毛利率", "type": "line", "yAxisIndex": 1, "data": [], "smooth": true, "symbol": "diamond"},
     {"name": "净利率", "type": "line", "yAxisIndex": 1, "data": [], "smooth": true, "symbol": "diamond"},
     {"name": "ROE", "type": "line", "yAxisIndex": 1, "data": [], "smooth": true, "symbol": "triangle", "lineStyle": {"width": 3}}
   ],
   "dataZoom": [{"type": "inside", "start": 0, "end": 100}]
 }',
 '{
   "xAxisField": "period",
   "series": [
     {"field": "currentRatio", "name": "流动比率", "yAxisIndex": 0},
     {"field": "quickRatio", "name": "速动比率", "yAxisIndex": 0},
     {"field": "grossMarginRate", "name": "毛利率", "yAxisIndex": 1},
     {"field": "netMarginRate", "name": "净利率", "yAxisIndex": 1},
     {"field": "roe", "name": "ROE", "yAxisIndex": 1}
   ]
 }',
 '{"width": 800, "height": 500, "position": "center"}',
 '追踪关键财务比率的变化趋势，评估企业财务状况演变',
 6);

-- 7. 周转率对比分析
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('turnover_comparison', '周转率对比分析', 'BAR', 'FINANCE',
 '["inventory_turnover", "receivable_turnover", "payable_turnover", "asset_turnover", "working_capital_turnover"]',
 '{
   "title": {"text": "周转率对比分析", "left": "center"},
   "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
   "legend": {"data": ["本期", "上期", "行业平均"], "bottom": 10},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {"type": "category", "data": ["存货周转率", "应收周转率", "应付周转率", "资产周转率", "营运资金周转率"]},
   "yAxis": {"type": "value", "name": "周转次数"},
   "series": [
     {"name": "本期", "type": "bar", "data": [], "itemStyle": {"color": "#5470c6"}, "label": {"show": true, "position": "top"}},
     {"name": "上期", "type": "bar", "data": [], "itemStyle": {"color": "#91cc75"}},
     {"name": "行业平均", "type": "bar", "data": [], "itemStyle": {"color": "#fac858"}}
   ],
   "markLine": {
     "data": [{"type": "average", "name": "平均值"}],
     "lineStyle": {"type": "dashed", "color": "#ee6666"}
   }
 }',
 '{
   "categories": [
     {"code": "inventory_turnover", "name": "存货周转率"},
     {"code": "receivable_turnover", "name": "应收周转率"},
     {"code": "payable_turnover", "name": "应付周转率"},
     {"code": "asset_turnover", "name": "资产周转率"},
     {"code": "working_capital_turnover", "name": "营运资金周转率"}
   ],
   "series": [
     {"field": "currentValue", "name": "本期"},
     {"field": "lastPeriodValue", "name": "上期"},
     {"field": "industryAverage", "name": "行业平均"}
   ]
 }',
 '{"width": 750, "height": 450, "position": "center"}',
 '对比分析各类周转率指标，评估运营效率和资金使用效率',
 7);

-- 8. KPI 仪表盘
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order)
VALUES
('kpi_gauge', 'KPI 仪表盘', 'GAUGE', 'FINANCE',
 '["achievement_rate", "gross_margin_rate", "net_margin_rate", "roe", "customer_satisfaction"]',
 '{
   "title": {"text": "KPI 达成情况", "left": "center"},
   "tooltip": {"formatter": "{a} <br/>{b} : {c}%"},
   "series": [{
     "name": "KPI",
     "type": "gauge",
     "center": ["50%", "60%"],
     "radius": "75%",
     "startAngle": 200,
     "endAngle": -20,
     "min": 0,
     "max": 100,
     "splitNumber": 10,
     "progress": {"show": true, "width": 18},
     "pointer": {"show": true, "length": "60%", "width": 6},
     "axisLine": {
       "lineStyle": {
         "width": 18,
         "color": [[0.3, "#ee6666"], [0.7, "#fac858"], [1, "#91cc75"]]
       }
     },
     "axisTick": {"distance": -30, "splitNumber": 5, "lineStyle": {"width": 2, "color": "#999"}},
     "splitLine": {"distance": -35, "length": 12, "lineStyle": {"width": 3, "color": "#999"}},
     "axisLabel": {"distance": -20, "color": "#999", "fontSize": 12},
     "anchor": {"show": true, "showAbove": true, "size": 20, "itemStyle": {"borderWidth": 8}},
     "title": {"show": true, "offsetCenter": [0, "70%"], "fontSize": 16},
     "detail": {
       "valueAnimation": true,
       "fontSize": 36,
       "offsetCenter": [0, "40%"],
       "formatter": "{value}%",
       "color": "inherit"
     },
     "data": [{"value": 0, "name": "达成率"}]
   }]
 }',
 '{
   "valueField": "value",
   "nameField": "kpiName",
   "targetField": "target",
   "thresholds": {
     "danger": 30,
     "warning": 70,
     "success": 100
   }
 }',
 '{"width": 400, "height": 400, "position": "center"}',
 '直观展示单个 KPI 指标的达成情况，支持目标对比',
 8);

-- ============================================================================
-- 日志记录
-- ============================================================================
SELECT CONCAT('V2026_01_21_06: 图表模板配置表创建完成，共插入 ',
    (SELECT COUNT(*) FROM smart_bi_chart_templates), ' 条初始数据') AS migration_info;
