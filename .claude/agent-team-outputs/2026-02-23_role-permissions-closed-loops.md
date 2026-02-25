# 角色权限 + 报工/进销存闭环使用逻辑分析报告

**日期**: 2026-02-23
**研究主题**: 白垩纪食品溯源 RN App 不同角色权限以及两大闭环的实际使用逻辑

---

## Executive Summary

系统采用 7 个角色独立导航架构，三层权限控制（Navigator→Tab→API）。报工闭环由 workshop_sup 主导（6个快捷操作，1层导航），factory_admin 审批。进销存闭环由 factory_admin 创建订单、warehouse_mgr 执行入库/出库，quality_insp 质检。核心问题：报工审批缺拒绝原因字段；出库流程导航5层过深；餐饮版已有快捷采购/销售入口但工厂版缺少。

---

## 角色权限总览

| 角色 | Tab数 | Screen数 | 报工闭环 | 进销存闭环 | 核心职责 |
|------|-------|---------|---------|-----------|---------|
| factory_admin | 6 | 44+ | 创建计划+审批 | 创建PO/SO+确认 | 全局管控 |
| workshop_sup | 5 | 20+ | **主力**: 3种报工+签到+审批 | 原料消耗 | 生产现场 |
| warehouse_mgr | 5 | 25+ | — | **主力**: 入库+出库+库存 | 仓储执行 |
| hr_admin | 5 | 12+ | — | — | 人员考勤 |
| dispatcher | 6(条件) | 15+ | — | — | 生产调度 |
| quality_insp | 5 | 10+ | — | 质检作业 | 质量把关 |
| operator | 3 | 6+ | 被分配班组报工 | — | 基础岗位 |

---

## 报工闭环 — 四阶段完整流程

### 阶段1: 创建计划 (factory_admin)
```
FAHome → 管理Tab → ProductionPlanManagement → 新建计划
  - 类型: FROM_INVENTORY(基于库存) / FUTURE(预规划)
  - 填写: 产品/产量/日期/客户
  - API: POST /api/mobile/{factoryId}/production-plans
  - 状态: → PENDING
```

### 阶段2: 报工提交 (workshop_sup)
```
WSHome → 快捷操作 (1层导航!)
  ├─ 扫码报工 → 扫码 → 填产量/次品 → 提交
  ├─ 班组报工 → 选批次 → 多人填工时 → 批量提交
  └─ 动态上报 → PROGRESS(进度)/HOURS(工时) → 提交

离线支持: 网络失败 → draftReportStore → DraftReportsScreen 重新提交
状态: → SUBMITTED
```

### 阶段3: 主管审核 (factory_admin)
```
FAHome → 管理Tab → WorkReportApproval (2层导航)
  - 查看待审批列表
  - 单个/批量审批
  - 状态: SUBMITTED → APPROVED / REJECTED
```

### 阶段4: 数据统计
```
API: GET /work-reporting/summary (按日期/工人/产品统计)
KPI: 产能完成率、质量合格率、成本效率
```

**导航深度评分**: workshop_sup 报工 1层 ⭐⭐⭐⭐⭐ | factory_admin 审批 2层 ⭐⭐⭐⭐

---

## 进销存闭环 — 五阶段完整流程

### 阶段1: 采购 (factory_admin)
```
FAHome → 管理Tab → PurchaseOrderList → 新建 (3层)
  - DRAFT → SUBMITTED → APPROVED
  - 选供应商/物料/数量/价格
```

### 阶段2: 入库 (warehouse_mgr)
```
WHInboundTab → WHInboundList → 选择 → 质检 → 上架 (4层)
  - 关联PO → createReceive → 质检(PASS/FAIL) → 上架确认
  - MaterialBatch.status: pending → inspecting → available
```

### 阶段3: 生产消耗 (workshop_sup)
```
WSBatches → 选批次 → BatchDetail → Complete → MaterialConsumption (4层)
  - 预留原料 → 消耗扣减 → 完成 → 自动生成成品批次(FinishedGoodsBatch)
```

### 阶段4: 销售 (factory_admin)
```
FAHome → 管理Tab → SalesOrderList → 新建 (3层)
  - DRAFT → CONFIRMED(预留成品) → PROCESSING → COMPLETED
```

### 阶段5: 出库 (warehouse_mgr)
```
WHOutboundTab → WHOutboundList → 选择 → 打包 → 装车 → 发货确认 (5层)
  - 成品库存: availableQuantity -= deliveredQuantity
  - 物流追踪: WHTrackingDetail
```

**导航深度评分**: 采购3层 ⭐⭐⭐⭐ | 入库4层 ⭐⭐⭐ | 出库5层 ⭐⭐

---

## Critic 验证结果

| 声明 | 验证状态 | 说明 |
|------|---------|------|
| WS首页6个快捷操作 | ✅ 已确认 | WSHomeScreen:310-376 完全匹配 |
| FA审批报工2层导航 | ✅ 已确认 | FAManagementStack:271 + FAManagement:81 |
| WH出库4层流程 | ⚠️ 更正为5层 | 含WHOutboundDetail选择步骤 |
| 操作员3个Tab | ✅ 已确认 | OperatorNavigator:15-63 |
| 餐饮版4个快捷入口 | ✅ 已确认 | FAHomeScreen:798-825 |
| 调度员6个Tab | ⚠️ 条件可见 | 取决于feature flags |
| 采购/销售缺快速入口 | ❌ 仅工厂版缺 | 餐饮版已有newPurchase/newSales |

### Critic 发现的遗漏

1. **Feature Flag 控制**: 所有主要Tab受 `isScreenEnabled()` 动态控制，实际可见数少于定义数
2. **WorkReportApproval 双入口**: FAHomeScreen(卡片) + FAManagementScreen(管理列表) 均可访问
3. **入库流程实际6步**: WHInboundList → Detail → Create → Inspect → Putaway → ScanOp
4. **报工审批缺拒绝原因**: approveReport() 仅支持 true/false，无 rejectionReason 字段
5. **已审批报工可被修改**: updateReport() 无状态检查，已批准报告仍可改

---

## 优先级排序的改进建议

### P0 (影响核心闭环)

| # | 改进项 | 文件 | 说明 |
|---|--------|------|------|
| 1 | 报工审批增加拒绝原因 | WorkReportingController.java | 扩展 rejectionReason 字段 |
| 2 | 已审批报工设为只读 | WorkReportingServiceImpl.java | status!=DRAFT 禁止修改 |
| 3 | 工厂版快捷操作增加"新建采购/销售" | FAHomeScreen.tsx | 参照餐饮版 newPurchase/newSales |

### P1 (改善体验)

| # | 改进项 | 文件 | 说明 |
|---|--------|------|------|
| 4 | 首页待审批徽章 | FAHomeScreen.tsx | 查询 pending count 显示红点 |
| 5 | 出库流程改为Tab向导 | WHOutboundDetail | 打包/装车/发货合并为1页3Tab |
| 6 | 离线草稿自动提交 | WSHomeScreen.tsx | 网络恢复时弹窗提示批量提交 |

### P2 (代码质量)

| # | 改进项 | 说明 |
|---|--------|------|
| 7 | Feature Flag 文档化 | 列出所有 flag 及控制的 Tab/Screen |
| 8 | FAManagement 分类视图 | 15+管理项改为分类Tab |
| 9 | 导航深度定义统一 | 明确"层"= Tab级还是Screen级 |

---

## Open Questions

1. **报工审批权限**: 仅 factory_admin 可审批，还是 workshop_sup 也可代审批？
2. **入库质检归属**: WHInspectScreen(仓储) vs QIInspectScreen(质检员) 是否功能重复？
3. **餐饮版功能范围**: 餐饮版是否需要库位管理、温控监测？
4. **Feature Flag 同步**: 前端 factoryFeatureStore 与后端权限表是否自动同步？
5. **报工草稿生命周期**: draftReportStore 多久自动清除？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (角色权限 / 报工闭环 / 进销存闭环)
- Total sources examined: 15+ files
- Key disagreements: 2 corrected (出库层数 4→5, 餐饮版已有快捷入口)
- Phases completed: Research → Analysis → Critique+Integration
- Healer: All checks passed ✅
