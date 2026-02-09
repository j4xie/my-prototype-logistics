---
name: material-batch-query
displayName: 物料批次查询
description: 查询物料批次信息，支持模糊搜索和条件过滤
version: 1.0.0
triggers:
  - "查询物料"
  - "物料批次"
  - "批号"
  - "库存"
  - "物料编号"
  - "找物料"
  - "查批次"
tools:
  - MaterialBatchQueryTool
contextNeeded:
  - factoryId
---

# 物料批次查询 Skill

## 任务
根据用户查询提取物料查询参数，并返回结构化的 JSON 格式。

## 用户查询
{{userQuery}}

## 参数提取规则
请从用户查询中提取以下参数：
1. batchNumber: 批号（如 "批号XXX", "编号XXX"）
2. materialName: 物料名称
3. materialType: 物料类型（生鲜/冷冻/常温）
4. dateRange: 日期范围

## 输出格式
请返回 JSON 格式：
```json
{
  "batchNumber": "提取的批号或null",
  "materialName": "提取的物料名称或null",
  "materialType": "提取的类型或null",
  "startDate": "开始日期或null",
  "endDate": "结束日期或null"
}
```
