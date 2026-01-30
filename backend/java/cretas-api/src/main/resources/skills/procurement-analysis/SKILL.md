---
name: procurement-analysis
displayName: 采购分析
description: 分析供应商评估、采购成本、交期准时率等采购指标，支持供应商多维度对比
version: 1.0.0
triggers:
  - "采购"
  - "供应商"
  - "采购成本"
  - "交期"
  - "供应商评估"
  - "进货"
  - "到货率"
tools:
  - PurchaseOrderQueryTool
  - SupplierEvaluationTool
  - ProcurementMetricsTool
  - ChartGeneratorTool
contextNeeded:
  - factoryId
  - dateRange
requiredPermission: "smartbi:procurement:read"
category: "procurement"
priority: 50
outputFormat:
  - RADAR
  - BAR
  - LINE_BAR
  - PIE
---

## 功能说明

采购管理核心指标分析：

- **采购成本率**: 采购成本 / 销售收入
- **准时交货率**: 准时交货数 / 总订单数
- **质量合格率**: 合格批次 / 总批次
- **采购周期**: 下单到入库天数

## 供应商评估维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 价格 | 25% | 价格竞争力 |
| 质量 | 25% | 来料合格率 |
| 交期 | 20% | 准时交货率 |
| 服务 | 15% | 响应速度 |
| 稳定性 | 15% | 供货稳定性 |

## 示例查询

- "供应商排名"
- "采购成本趋势"
- "供应商评估对比"
