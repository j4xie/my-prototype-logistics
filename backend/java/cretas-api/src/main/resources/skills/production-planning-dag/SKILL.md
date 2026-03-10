---
name: production-planning-dag
displayName: 排产规划(DAG版)
description: 排产全流程：检查原料库存 → 库存充足则创建生产计划并分配工人，库存不足则建议采购
version: 2.0.0
triggers:
  - "排产规划DAG"
  - "智能排产"
tools:
  - material_stock_summary
  - processing_batch_list
  - production_plan_create
  - processing_worker_assign
  - purchase_order_create
contextNeeded:
  - factoryId
category: production
priority: 35
errorStrategy: CONTINUE_ON_ERROR
execution:
  - id: check_stock
    tool: material_stock_summary
  - id: check_lines
    tool: processing_batch_list
    dependsOn: [check_stock]
    condition: "check_stock.success"
  - id: create_plan
    tool: production_plan_create
    dependsOn: [check_stock, check_lines]
    condition: "check_stock.success && check_lines.success"
  - id: assign_workers
    tool: processing_worker_assign
    dependsOn: [create_plan]
    condition: "create_plan.success"
  - id: suggest_purchase
    tool: purchase_order_create
    dependsOn: [check_stock]
    condition: "check_stock.success && !check_stock.data.hasStock"
---

# 排产规划 DAG Skill

为工厂${factoryId}进行智能排产规划。

## 执行流程

1. **check_stock**: 查询原料库存
2. 根据库存结果分支:
   - **库存充足路径**: check_lines → create_plan → assign_workers
   - **库存不足路径**: suggest_purchase (建议采购)

## 错误策略

CONTINUE_ON_ERROR — 部分工具失败不会阻止其余工具执行。

用户问题: ${userQuery}
