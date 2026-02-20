---
name: production-oee-analysis
displayName: 生产OEE分析
description: 分析设备综合效率(OEE)，包括可用性、性能、质量三大指标，支持产线效率对比和趋势分析
version: 1.0.0
triggers:
  - "OEE"
  - "设备效率"
  - "综合效率"
  - "产线效率"
  - "良品率"
  - "设备利用率"
  - "产能分析"
tools:
  - ProductionDataQueryTool
  - EquipmentUsageQueryTool
  - ChartGeneratorTool
contextNeeded:
  - factoryId
  - dateRange
requiredPermission: "smartbi:production:read"
category: "production"
priority: 40
outputFormat:
  - GAUGE
  - LINE_BAR
  - RADAR
---

## 功能说明

OEE (Overall Equipment Effectiveness) 设备综合效率分析：

- **可用性**: 实际运行时间 / 计划运行时间
- **性能**: 实际产量 / 理论产量
- **质量**: 良品数 / 总产量

## 预警阈值

| 指标 | 红色 | 黄色 | 绿色 |
|------|------|------|------|
| OEE | <65% | <85% | ≥85% |
| 可用性 | <80% | <90% | ≥90% |
| 质量率 | <95% | <98% | ≥98% |

## 示例查询

- "今天的OEE是多少？"
- "本周产线效率对比"
- "设备利用率趋势"
