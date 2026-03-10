---
name: financial-dashboard
displayName: 财务分析看板
description: 完整财务分析看板，自动识别数据可生成的所有图表类型并批量生成分析
version: 1.0.0
triggers:
  - "财务分析报告"
  - "完整财务分析"
  - "财务看板"
  - "全面财务分析"
  - "财务报告"
  - "生成财务看板"
  - "财务分析全景"
tools:
  - financial_chart_generate
  - finance_ppt_export
contextNeeded:
  - factoryId
  - upload_id
category: finance
priority: 40
errorStrategy: CONTINUE_ON_ERROR
execution:
  - id: generate_all
    tool: financial_chart_generate
    params:
      chart_type: "all"
---

# 财务分析看板 Skill

自动识别已上传Excel数据中可用的列角色（预算/实际/上年/品类等），
批量生成所有可用的财务分析图表。

## 支持的图表类型

| 类型 | 说明 | 所需数据列 |
|------|------|-----------|
| budget_achievement | 预算完成情况 | 预算、实际、期间 |
| yoy_mom_comparison | 同比环比分析 | 实际、上年、期间 |
| pnl_waterfall | 损益表瀑布图 | 项目名称 |
| expense_yoy_budget | 费用同比及预算达成 | 预算、实际、上年、期间 |
| category_yoy_comparison | 品类同期对比 | 实际、上年、品类、期间 |
| gross_margin_trend | 毛利率趋势 | 实际、上年、期间 |
| category_structure_donut | 品类结构同比 | 实际、上年、品类 |

## 使用方式

用户说"帮我做完整的财务分析"或"生成财务看板" -> 自动触发此 Skill。
