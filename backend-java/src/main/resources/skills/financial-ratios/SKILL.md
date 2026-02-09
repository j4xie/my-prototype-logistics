---
name: financial-ratios-analysis
displayName: 财务比率分析
description: 分析现金流、财务比率(ROE/ROA/流动比率)等财务指标，支持财务健康评估
version: 1.0.0
triggers:
  - "现金流"
  - "财务比率"
  - "ROE"
  - "ROA"
  - "流动比率"
  - "速动比率"
  - "资金"
tools:
  - FinanceDataQueryTool
  - CashFlowTool
  - FinancialRatiosTool
  - ChartGeneratorTool
contextNeeded:
  - factoryId
  - dateRange
requiredPermission: "smartbi:finance:read"
category: "finance"
priority: 45
outputFormat:
  - WATERFALL
  - RADAR
  - BAR
  - LINE
---

## 功能说明

财务深度分析：

- **现金流**: 经营/投资/筹资现金流
- **盈利能力**: ROE、ROA、毛利率、净利率
- **偿债能力**: 流动比率、速动比率、资产负债率
- **运营效率**: 应收周转率、存货周转率

## 财务比率基准

| 指标 | 警戒线 | 健康值 |
|------|--------|--------|
| ROE | <10% | >15% |
| ROA | <3% | >5% |
| 流动比率 | <1.0 | 1.5-2.0 |
| 速动比率 | <0.5 | >1.0 |

## 示例查询

- "本月现金流情况"
- "财务比率分析"
- "ROE趋势"
