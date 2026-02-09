---
name: inventory-health-analysis
displayName: 库存健康分析
description: 分析库存周转率、过期风险、损耗率等库存健康指标，支持库龄分布和预警提醒
version: 1.0.0
triggers:
  - "库存"
  - "周转"
  - "过期"
  - "损耗"
  - "保质期"
  - "效期"
  - "库龄"
tools:
  - MaterialBatchQueryTool
  - MaterialAdjustmentQueryTool
  - InventoryMetricsTool
  - ChartGeneratorTool
contextNeeded:
  - factoryId
  - dateRange
requiredPermission: "smartbi:inventory:read"
category: "inventory"
priority: 45
outputFormat:
  - GAUGE
  - BAR
  - PIE
  - TREEMAP
---

## 功能说明

库存健康核心指标分析：

- **周转率**: 消耗量 / 平均库存
- **库存天数**: 365 / 周转率
- **过期风险率**: 近效期库存 / 总库存
- **损耗率**: (损耗 + 报废) / 入库

## 预警阈值

| 指标 | 红色 | 黄色 | 绿色 |
|------|------|------|------|
| 周转率 | <6次/年 | <12次/年 | ≥12次/年 |
| 过期风险 | >15% | >10% | ≤10% |
| 损耗率 | >5% | >2% | ≤2% |

## 示例查询

- "库存周转率是多少？"
- "哪些物料即将过期？"
- "库龄分布情况"
