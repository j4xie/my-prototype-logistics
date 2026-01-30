---
name: quality-analysis
displayName: 质量管理分析
description: 分析首检合格率、缺陷率、返工成本等质量指标，支持缺陷帕累托分析和趋势追踪
version: 1.0.0
triggers:
  - "质量"
  - "合格率"
  - "缺陷"
  - "返工"
  - "报废"
  - "FPY"
  - "不良品"
tools:
  - QualityInspectionQueryTool
  - ReworkRecordQueryTool
  - DisposalRecordQueryTool
  - ChartGeneratorTool
contextNeeded:
  - factoryId
  - dateRange
requiredPermission: "smartbi:quality:read"
category: "quality"
priority: 40
outputFormat:
  - GAUGE
  - BAR
  - PIE
  - LINE
---

## 功能说明

质量管理核心指标分析：

- **FPY**: 首检合格率 = 首检合格数 / 总检验数
- **缺陷率**: 不合格数 / 样本数
- **返工率**: 返工数 / 总产量
- **报废成本**: Σ(报废数 × 单价)

## 预警阈值

| 指标 | 红色 | 黄色 | 绿色 |
|------|------|------|------|
| FPY | <95% | <98% | ≥98% |
| 缺陷率 | >5% | >2% | ≤2% |
| 返工率 | >3% | >1% | ≤1% |

## 示例查询

- "本月的合格率是多少？"
- "缺陷类型分布"
- "返工成本分析"
