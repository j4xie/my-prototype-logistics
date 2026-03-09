# AI 意图识别系统覆盖率 Gap 评估报告

**日期**: 2026-03-07
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)

## Executive Summary

AI 意图系统存在三层覆盖率问题：(1) 5 个 ANALYSIS 类别意图因无 handler 且无别名映射构成确认死路；(2) 采购(12方法)、调拨(10方法)、退货(8方法) 三大核心业务模块完全无意图覆盖；(3) 18 个基础数据 CRUD 意图缺失。SCHEDULE 类别经代码验证已通过别名映射修复，不构成死路。

## Consensus Map

| 议题 | 最终定论 | 信心 |
|------|---------|------|
| ANALYSIS 5 意图死路 | 确认死路，需修复 — 无 handler，无别名映射 | 5/5 |
| SCHEDULE 类别死路 | 非死路 — SCHEDULING→REPORT 别名+override 已存在 | 1/5 |
| 采购/调拨/退货无意图 | 确认缺失 — handler 零引用 PurchaseService/TransferService | 5/5 |
| 需新建 PurchaseIntentHandler | 不必要 — 可扩展现有 Handler，先做查询再看写操作 | 2/5 |
| "新增客户"→CUSTOMER_STATS | 有意设计(统计语义)，非简单 Bug | 3/5 |
| 基础数据 18 个 CRUD 缺失 | 确认缺失，但优先级低，按频率筛选 | 4/5 |
| dispatcher 角色权限不足 | 确认 — 仅 1 个意图有权限 vs 24+ 前端页面 | 4/5 |

## Actionable Recommendations

### P0: 立即执行 (1-2 小时)

1. **修复 ANALYSIS 死路**: `IntentExecutorServiceImpl.java` L1614 — CATEGORY_ALIAS_MAP 添加 `Map.entry("ANALYSIS", "REPORT")`
2. **修复 INVENTORY_CHECK 映射**: `QueryPreprocessorServiceImpl.java` L1041 — 改映射到 `REPORT_INVENTORY`
3. **清理孤立映射**: `IntentKnowledgeBase.java` L6068 — 删除 `"purchase order"→PURCHASE_ORDER_QUERY`

### P1: 短期计划 (1-2 周)

1. **采购查询意图**: 扩展 DataOperationIntentHandler 添加 PURCHASE_ORDER_LIST/DETAIL — M (2-3天)
2. **调拨/退货查询**: 扩展 MaterialIntentHandler 添加 TRANSFER_LIST/RETURN_LIST — M (2-3天)
3. **dispatcher 权限**: SQL UPDATE 批量添加 allowed_roles — S (2小时)
4. **Customer CREATE/UPDATE**: 扩展 CRMIntentHandler — M (1-2天)

### P2: 条件性 (视数据决定)

7 个基础数据实体 CRUD 意图补充 (MaterialType/Department/WorkType/ConversionRate/DisposalRecord/ProductType/Supplier)，每个 S-M 工作量，建议先统计 OUT_OF_DOMAIN 日志确认实际需求频率。

### P3: 可延后

- ReportHandler ~20 个 orphan 意图 SQL 注册
- Restaurant 25+ 意图 SQL 注册 (餐饮模块上线后)
- 采购/调拨写操作 AI 化 (查询稳定 3 周后)

## Coverage Matrix

| 模块 | Service | Query 意图 | Create 意图 | Update 意图 | Delete 意图 | 状态机 |
|------|---------|-----------|------------|------------|------------|--------|
| 生产批次 | 12方法 | 有 | 有 | 有 | 有 | 有 |
| 物料批次 | 10方法 | 有 | 有 | 有 | 有 | 有 |
| 销售订单 | 8方法 | 有 | 有 | 有 | 有 | 部分 |
| 发货 | 12方法 | 有 | 有 | 无 | 有 | -- |
| 供应商 | CRUD | 有 | 有 | 无 | 有 | -- |
| 客户 | CRUD | 有 | **无** | **无** | 有 | -- |
| 产品类型 | CRUD | 有 | **无** | 有 | **无** | -- |
| **采购** | 12方法 | **无** | **无** | **无** | **无** | **无** |
| **调拨** | 10方法 | **无** | **无** | **无** | **无** | **无** |
| **退货** | 8方法 | **无** | **无** | **无** | **无** | **无** |
| **原料类型** | CRUD | **无** | **无** | **无** | **无** | -- |
| **部门** | CRUD | **无** | **无** | **无** | **无** | -- |
| **工种** | CRUD | **无** | **无** | **无** | **无** | -- |
| **处置记录** | CRUD | **无** | **无** | **无** | **无** | -- |
| 转换率 | CRUD | 无 | 合并在UPDATE | 有 | **无** | -- |

## Risk Assessment

| 风险 | 严重度 | 缓解策略 |
|------|--------|---------|
| 写操作误触发 | 高 | 所有写入意图设 sensitivity=HIGH + slot filling 确认 |
| 权限越界 | 中 | 逐个审核 allowed_roles 与业务权限矩阵一致 |
| 回归影响 | 中 | P0 修复先在测试环境(10011)验证 |

## Open Questions

1. ANALYSIS 的 5 个 intent_code 在 ReportHandler 中是否有 case 分支？
2. dispatcher 核心 AI 场景是哪 3-5 个？
3. OUT_OF_DOMAIN 日志中有无采购/基础数据高频请求？
4. Restaurant 模块是否已上线？

## Process Note

- Mode: Full
- Researchers: 3 (采购/仓储/库存, 基础数据管理, 调度员+注册完整性)
- Total sources: 60+ files
- Key disagreements resolved: SCHEDULE死路(非死路), 新建Handler(不必要)
- Phases: Research(parallel×3) → Analysis → Critique → Integration → Heal
