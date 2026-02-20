---
name: sales-funnel-analysis
displayName: 销售漏斗分析
description: 分析销售转化漏斗、客户RFM分群、产品ABC分类，支持深度销售洞察
version: 1.0.0
triggers:
  - "漏斗"
  - "转化率"
  - "RFM"
  - "客户分群"
  - "ABC分析"
  - "客户价值"
  - "成交转化"
tools:
  - SalesFunnelQueryTool
  - CustomerRFMTool
  - ProductABCTool
  - ChartGeneratorTool
contextNeeded:
  - factoryId
  - dateRange
requiredPermission: "smartbi:sales:read"
category: "sales"
priority: 50
outputFormat:
  - FUNNEL
  - SCATTER
  - TREEMAP
  - PIE
---

## 功能说明

销售深度分析：

- **销售漏斗**: 线索 → 商机 → 报价 → 成交 转化率
- **RFM 分群**: 最近消费(R)、消费频率(F)、消费金额(M)
- **ABC 分类**: A类(80%) / B类(15%) / C类(5%)

## RFM 客户分群

| 分群 | R | F | M | 策略 |
|------|---|---|---|------|
| 高价值 | 高 | 高 | 高 | 维护 |
| 潜力股 | 高 | 低 | 低 | 激活 |
| 沉睡 | 低 | 低 | 高 | 唤醒 |
| 流失风险 | 低 | 低 | 低 | 挽回 |

## 示例查询

- "销售漏斗转化率"
- "客户RFM分析"
- "产品ABC分类"
