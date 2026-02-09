---
name: sales-analysis
displayName: 销售分析
description: 基于 SmartBI 数据进行销售趋势、排名等分析
version: 1.0.0
triggers:
  - "销售分析"
  - "销售趋势"
  - "销售排名"
  - "营业额"
  - "销量统计"
  - "业绩分析"
tools:
  - SalesAnalysisService
contextNeeded:
  - factoryId
  - dateRange
---

# 销售分析 Skill

## 任务
根据用户查询执行销售数据分析，返回结构化的分析结果。

## 用户查询
{{userQuery}}

## 分析类型判断
从以下类型中选择最匹配的分析：
1. TREND - 销售趋势分析（含时间词如"趋势"、"走势"、"变化"）
2. RANKING - 销售排名分析（含"排名"、"top"、"最高"、"最低"）
3. COMPARISON - 同比环比分析（含"同比"、"环比"、"对比"）
4. SUMMARY - 销售汇总（默认）

## 输出格式
```json
{
  "analysisType": "TREND|RANKING|COMPARISON|SUMMARY",
  "timeRange": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "dimensions": ["维度字段列表"],
  "metrics": ["指标字段列表"],
  "filters": {}
}
```
