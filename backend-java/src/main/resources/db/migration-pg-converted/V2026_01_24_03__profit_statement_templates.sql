-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_24_03__profit_statement_templates.sql
-- Conversion date: 2026-01-26 18:49:39
-- ============================================

-- ============================================================================
-- SmartBI 图表模板 - 利润表专用分析模板
--
-- 新增模板：
--   1. profit_trend           - 利润趋势分析图（收入、成本、毛利月度趋势）
--   2. budget_vs_actual       - 预实对比分析图（预算完成率、差异分析）
--   3. cost_structure_detail  - 成本结构分析图（详细成本构成饼图）
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-24
-- ============================================================================

-- 1. 利润趋势分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order, analysis_prompt, analysis_enabled)
VALUES
('profit_trend', '利润趋势分析图', 'LINE', 'FINANCE',
 '["revenue", "cost", "gross_profit", "operating_profit", "net_profit", "gross_margin_rate", "net_margin_rate"]',
 '{
   "title": {"text": "利润趋势分析", "subtext": "月度收入、成本、利润走势", "left": "center"},
   "tooltip": {
     "trigger": "axis",
     "axisPointer": {"type": "cross"},
     "formatter": "{Function}"
   },
   "legend": {"data": ["营业收入", "营业成本", "毛利润", "净利润", "毛利率"], "bottom": 10, "type": "scroll"},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {
     "type": "category",
     "boundaryGap": false,
     "data": [],
     "axisLabel": {"interval": 0, "rotate": 30}
   },
   "yAxis": [
     {"type": "value", "name": "金额（万元）", "position": "left", "axisLabel": {"formatter": "{value}"}},
     {"type": "value", "name": "利润率（%）", "position": "right", "min": 0, "max": 100, "axisLabel": {"formatter": "{value}%"}}
   ],
   "series": [
     {
       "name": "营业收入",
       "type": "line",
       "data": [],
       "smooth": true,
       "symbol": "circle",
       "symbolSize": 6,
       "lineStyle": {"width": 3, "color": "#5470c6"},
       "itemStyle": {"color": "#5470c6"},
       "areaStyle": {"color": {"type": "linear", "x": 0, "y": 0, "x2": 0, "y2": 1, "colorStops": [{"offset": 0, "color": "rgba(84, 112, 198, 0.3)"}, {"offset": 1, "color": "rgba(84, 112, 198, 0)"}]}}
     },
     {
       "name": "营业成本",
       "type": "line",
       "data": [],
       "smooth": true,
       "symbol": "square",
       "symbolSize": 6,
       "lineStyle": {"width": 2, "color": "#ee6666"},
       "itemStyle": {"color": "#ee6666"}
     },
     {
       "name": "毛利润",
       "type": "line",
       "data": [],
       "smooth": true,
       "symbol": "triangle",
       "symbolSize": 8,
       "lineStyle": {"width": 3, "color": "#91cc75"},
       "itemStyle": {"color": "#91cc75"},
       "label": {"show": true, "position": "top", "formatter": "{c}"}
     },
     {
       "name": "净利润",
       "type": "line",
       "data": [],
       "smooth": true,
       "symbol": "diamond",
       "symbolSize": 8,
       "lineStyle": {"width": 2, "color": "#fac858", "type": "dashed"},
       "itemStyle": {"color": "#fac858"}
     },
     {
       "name": "毛利率",
       "type": "line",
       "yAxisIndex": 1,
       "data": [],
       "smooth": true,
       "symbol": "pin",
       "symbolSize": 10,
       "lineStyle": {"width": 2, "color": "#73c0de"},
       "itemStyle": {"color": "#73c0de"},
       "label": {"show": true, "position": "top", "formatter": "{c}%"}
     }
   ],
   "dataZoom": [
     {"type": "inside", "start": 0, "end": 100},
     {"type": "slider", "start": 0, "end": 100, "bottom": 30}
   ]
 }',
 '{
   "xAxisField": "period",
   "periodFormat": "YYYY-MM",
   "series": [
     {"field": "revenue", "name": "营业收入", "yAxisIndex": 0, "unit": "万元"},
     {"field": "cost", "name": "营业成本", "yAxisIndex": 0, "unit": "万元"},
     {"field": "grossProfit", "name": "毛利润", "yAxisIndex": 0, "unit": "万元"},
     {"field": "netProfit", "name": "净利润", "yAxisIndex": 0, "unit": "万元"},
     {"field": "grossMarginRate", "name": "毛利率", "yAxisIndex": 1, "unit": "%"}
   ],
   "calculations": {
     "grossProfit": "revenue - cost",
     "grossMarginRate": "(revenue - cost) / revenue * 100"
   },
   "requiredFields": ["period", "revenue", "cost"],
   "optionalFields": ["grossProfit", "netProfit", "grossMarginRate", "netMarginRate"]
 }',
 '{"width": 900, "height": 550, "position": "center", "minWidth": 600, "minHeight": 400}',
 '展示利润表核心指标的月度变化趋势，包括收入、成本、毛利润、净利润及毛利率的走势分析',
 11,
 '请基于以下利润趋势数据进行专业分析：

{{dataJson}}

请从以下维度进行分析：
1. **整体趋势**：收入和利润的整体走势是上升、下降还是波动？
2. **毛利率分析**：毛利率的变化趋势及原因推测
3. **成本控制**：成本与收入的增长是否匹配，是否存在成本失控风险
4. **关键拐点**：是否存在明显的趋势转折点，可能的原因是什么
5. **预警提示**：如果发现异常波动或风险信号，请明确指出

请用简洁专业的语言，控制在200字以内。',
 TRUE);

-- 2. 预实对比分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order, analysis_prompt, analysis_enabled)
VALUES
('budget_vs_actual', '预实对比分析图', 'BAR', 'FINANCE',
 '["budget_revenue", "actual_revenue", "budget_cost", "actual_cost", "budget_profit", "actual_profit", "revenue_achievement_rate", "profit_achievement_rate", "variance"]',
 '{
   "title": {"text": "预算执行分析", "subtext": "预算 vs 实际完成情况", "left": "center"},
   "tooltip": {
     "trigger": "axis",
     "axisPointer": {"type": "shadow"},
     "formatter": "{Function}"
   },
   "legend": {"data": ["预算", "实际", "达成率", "差异"], "bottom": 10},
   "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": true},
   "xAxis": {
     "type": "category",
     "data": [],
     "axisPointer": {"type": "shadow"},
     "axisLabel": {"interval": 0, "rotate": 0}
   },
   "yAxis": [
     {"type": "value", "name": "金额（万元）", "position": "left"},
     {"type": "value", "name": "达成率（%）", "position": "right", "min": 0, "max": 150, "axisLabel": {"formatter": "{value}%"}}
   ],
   "series": [
     {
       "name": "预算",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#91cc75"},
       "barGap": "-30%",
       "barWidth": "40%",
       "z": 1,
       "label": {"show": false}
     },
     {
       "name": "实际",
       "type": "bar",
       "data": [],
       "itemStyle": {"color": "#5470c6"},
       "barWidth": "25%",
       "z": 2,
       "label": {"show": true, "position": "top", "formatter": "{c}"}
     },
     {
       "name": "达成率",
       "type": "line",
       "yAxisIndex": 1,
       "data": [],
       "smooth": true,
       "symbol": "circle",
       "symbolSize": 10,
       "lineStyle": {"width": 3, "color": "#ee6666"},
       "itemStyle": {"color": "#ee6666"},
       "label": {"show": true, "position": "top", "formatter": "{c}%"},
       "markLine": {
         "data": [
           {"yAxis": 100, "name": "目标线", "lineStyle": {"color": "#fac858", "type": "dashed", "width": 2}},
           {"yAxis": 80, "name": "预警线", "lineStyle": {"color": "#ee6666", "type": "dotted"}}
         ],
         "label": {"formatter": "{b}: {c}%"}
       }
     },
     {
       "name": "差异",
       "type": "bar",
       "data": [],
       "itemStyle": {
         "color": "{Function}"
       },
       "barWidth": "15%",
       "label": {
         "show": true,
         "position": "top",
         "formatter": "{c}",
         "color": "{Function}"
       }
     }
   ],
   "visualMap": {
     "show": false,
     "seriesIndex": 3,
     "pieces": [
       {"gt": 0, "color": "#91cc75"},
       {"lte": 0, "color": "#ee6666"}
     ]
   }
 }',
 '{
   "xAxisField": "itemName",
   "categories": [
     {"code": "revenue", "name": "营业收入"},
     {"code": "cost", "name": "营业成本"},
     {"code": "grossProfit", "name": "毛利润"},
     {"code": "operatingExpense", "name": "运营费用"},
     {"code": "netProfit", "name": "净利润"}
   ],
   "series": [
     {"field": "budgetAmount", "name": "预算", "yAxisIndex": 0},
     {"field": "actualAmount", "name": "实际", "yAxisIndex": 0},
     {"field": "achievementRate", "name": "达成率", "yAxisIndex": 1},
     {"field": "variance", "name": "差异", "yAxisIndex": 0}
   ],
   "calculations": {
     "achievementRate": "actualAmount / budgetAmount * 100",
     "variance": "actualAmount - budgetAmount",
     "varianceRate": "(actualAmount - budgetAmount) / budgetAmount * 100"
   },
   "requiredFields": ["itemName", "budgetAmount", "actualAmount"],
   "colorRules": {
     "achievementRate": {"good": ">= 100", "warning": ">= 80", "danger": "< 80"},
     "variance": {"positive": "> 0", "negative": "< 0"}
   }
 }',
 '{"width": 850, "height": 500, "position": "center", "minWidth": 600, "minHeight": 400}',
 '对比利润表各科目的预算与实际完成情况，分析达成率和差异，识别预算执行偏差',
 12,
 '请基于以下预算执行数据进行分析：

{{dataJson}}

请从以下维度进行分析：
1. **整体达成情况**：整体预算完成率如何？是否达到预期目标？
2. **收入分析**：收入预算达成情况，超额或不足的原因推测
3. **成本控制**：成本是否在预算范围内，是否存在超支项目
4. **利润差异**：利润差异的主要来源，是收入端还是成本端
5. **改进建议**：针对未达标项目的改进建议

请用简洁专业的语言，控制在200字以内。',
 TRUE);

-- 3. 成本结构详细分析图
INSERT INTO smart_bi_chart_templates
(template_code, template_name, chart_type, category, applicable_metrics, chart_options, data_mapping, layout_config, description, sort_order, analysis_prompt, analysis_enabled)
VALUES
('cost_structure_detail', '成本结构详细分析图', 'PIE', 'FINANCE',
 '["direct_material_cost", "direct_labor_cost", "manufacturing_overhead", "sales_expense", "admin_expense", "financial_expense", "rd_expense", "other_expense"]',
 '{
   "title": {"text": "成本费用结构分析", "subtext": "利润表成本构成详解", "left": "center"},
   "tooltip": {
     "trigger": "item",
     "formatter": "{a} <br/>{b}: {c}万元 ({d}%)"
   },
   "legend": {
     "orient": "vertical",
     "left": "left",
     "top": "middle",
     "formatter": "{name}"
   },
   "series": [
     {
       "name": "成本大类",
       "type": "pie",
       "selectedMode": "single",
       "radius": [0, "35%"],
       "center": ["55%", "50%"],
       "label": {"position": "inner", "fontSize": 12, "formatter": "{b}\n{d}%"},
       "labelLine": {"show": false},
       "itemStyle": {"borderRadius": 5, "borderColor": "#fff", "borderWidth": 2},
       "data": []
     },
     {
       "name": "成本明细",
       "type": "pie",
       "radius": ["45%", "70%"],
       "center": ["55%", "50%"],
       "labelLine": {"length": 20, "length2": 10},
       "label": {
         "show": true,
         "formatter": "{b}: {c}万元\n({d}%)",
         "fontSize": 11
       },
       "itemStyle": {"borderRadius": 8, "borderColor": "#fff", "borderWidth": 2},
       "emphasis": {
         "label": {"show": true, "fontSize": 14, "fontWeight": "bold"},
         "itemStyle": {"shadowBlur": 10, "shadowOffsetX": 0, "shadowColor": "rgba(0, 0, 0, 0.5)"}
       },
       "data": []
     }
   ],
   "color": [
     "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",
     "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc", "#48b8d0"
   ]
 }',
 '{
   "innerRing": {
     "field": "categoryName",
     "valueField": "categoryAmount",
     "categories": [
       {"code": "productionCost", "name": "生产成本", "color": "#5470c6"},
       {"code": "operatingExpense", "name": "运营费用", "color": "#91cc75"},
       {"code": "financialExpense", "name": "财务费用", "color": "#fac858"}
     ]
   },
   "outerRing": {
     "field": "itemName",
     "valueField": "amount",
     "parentField": "categoryCode",
     "items": [
       {"code": "directMaterial", "name": "直接材料", "parent": "productionCost"},
       {"code": "directLabor", "name": "直接人工", "parent": "productionCost"},
       {"code": "manufacturingOverhead", "name": "制造费用", "parent": "productionCost"},
       {"code": "salesExpense", "name": "销售费用", "parent": "operatingExpense"},
       {"code": "adminExpense", "name": "管理费用", "parent": "operatingExpense"},
       {"code": "rdExpense", "name": "研发费用", "parent": "operatingExpense"},
       {"code": "interestExpense", "name": "利息支出", "parent": "financialExpense"},
       {"code": "exchangeLoss", "name": "汇兑损失", "parent": "financialExpense"},
       {"code": "otherFinancial", "name": "其他财务费用", "parent": "financialExpense"}
     ]
   },
   "requiredFields": ["itemName", "amount"],
   "optionalFields": ["categoryCode", "categoryName", "percentage", "yoyChange"],
   "calculations": {
     "percentage": "amount / totalAmount * 100"
   }
 }',
 '{"width": 800, "height": 550, "position": "center", "minWidth": 600, "minHeight": 450}',
 '双层饼图展示利润表成本费用的层级结构，内环为大类（生产成本、运营费用、财务费用），外环为明细科目',
 13,
 '请基于以下成本结构数据进行分析：

{{dataJson}}

请从以下维度进行分析：
1. **成本构成**：各类成本在总成本中的占比，哪类成本占比最高？
2. **生产成本**：直接材料、直接人工、制造费用的比例是否合理？
3. **费用控制**：销售费用、管理费用、财务费用的占比是否正常？
4. **异常项目**：是否存在占比异常偏高的成本项目？
5. **优化建议**：基于成本结构，提出成本优化的方向

请用简洁专业的语言，控制在200字以内。',
 TRUE);

-- ============================================================================
-- 日志记录
-- ============================================================================
SELECT CONCAT('V2026_01_24_03: 利润表专用分析模板创建完成，新增 3 条数据，当前总计 ',
    (SELECT COUNT(*) FROM smart_bi_chart_templates), ' 条模板') AS migration_info;
