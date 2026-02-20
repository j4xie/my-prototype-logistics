---
name: schema-detection
displayName: Schema 变更检测
description: 检测 Excel 上传时的 Schema 变化，推断字段含义
version: 1.0.0
triggers:
  - "上传Excel"
  - "数据导入"
  - "字段变化"
  - "Schema检测"
  - "结构分析"
tools:
  - ExcelDynamicParserService
  - QueryEntitySchemaTool
contextNeeded:
  - factoryId
  - uploadedFile
---

# Schema 检测 Skill

## 任务
分析上传的 Excel 文件，检测与现有 Schema 的差异，推断新字段的业务含义。

## 新增字段列表
{{newColumns}}

## 示例数据
{{sampleData}}

## 推断规则
请根据列名和示例数据，推断每个新字段的：
1. 业务含义 (alias)
2. 数据类型 (NUMBER/STRING/DATE/BOOLEAN)
3. 指标类型 (MEASURE/DIMENSION/TIME)
4. 适用的聚合方式 (SUM/AVG/COUNT/NONE)
5. 推荐的图表类型

## 输出格式
```json
{
  "fields": [
    {
      "name": "原始列名",
      "alias": "中文名称",
      "dataType": "NUMBER",
      "metricType": "MEASURE",
      "aggregation": "SUM",
      "chartTypes": ["LINE", "BAR"]
    }
  ],
  "confidence": 0.85
}
```
