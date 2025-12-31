# 未实现的后端 API 端点

## 概述

以下后端 API 端点已实现但前端尚未集成，保留供后续版本使用。

**最后更新**: 2025-12-30
**状态**: Phase 3 API 集成完成 + ReportService 架构整合完成 + 原材料简化完成

### 后端规模统计 (更新于 2025-12-30)

| 指标 | 数量 |
|------|------|
| Controller 文件 | **47 个** |
| API 端点总数 | **677 个** |

---

## 架构变更 (2025-12-22)

**ReportService 现在是 Dashboard 的统一入口**

ReportController 新增 Dashboard 端点 (委托 ProcessingService):

| 新端点 | 说明 |
|--------|------|
| `/reports/dashboard/overview` | 生产概览 |
| `/reports/dashboard/production` | 生产统计 |
| `/reports/dashboard/quality` | 质量统计 |
| `/reports/dashboard/equipment` | 设备统计 |
| `/reports/dashboard/alerts` | 告警统计 |
| `/reports/dashboard/trends` | 趋势分析 |

**废弃端点** (ProcessingController - 已标记 @Deprecated):

| 废弃端点 | 替代方案 |
|----------|----------|
| `/processing/dashboard/overview` | `/reports/dashboard/overview` |
| `/processing/dashboard/production` | `/reports/dashboard/production` |
| `/processing/dashboard/quality` | `/reports/dashboard/quality` |
| `/processing/dashboard/equipment` | `/reports/dashboard/equipment` |
| `/processing/dashboard/alerts` | `/reports/dashboard/alerts` |
| `/processing/dashboard/trends` | `/reports/dashboard/trends` |

**成本分析**: 仍由 AIController `/ai/analysis/cost/*` 提供 (Python DeepSeek 服务)

---

## SupplierController - 未实现的端点 (7 个)

路径前缀: `/api/mobile/{factoryId}/suppliers`

| 端点 | HTTP方法 | 描述 | 原因 |
|------|---------|------|------|
| `/check-code` | GET | 检查供应商代码是否存在 | 可在创建时由后端返回错误 |
| `/export` | GET | 导出供应商列表为Excel | 导出功能属于高级特性 |
| `/export/template` | GET | 下载导入模板 | 配合批量导入使用 |
| `/import` | POST | 批量导入供应商 | 批量导入功能属于高级特性 |
| `/rating-distribution` | GET | 获取评级分布统计 | 统计分析功能 |
| `/outstanding-balance` | GET | 获取有欠款的供应商 | 财务对账功能 |
| `/{id}/credit-limit` | PUT | 更新供应商信用额度 | 财务管理功能 |

---

## WhitelistController - 不实现的端点 (3 个)

路径前缀: `/api/mobile/{factoryId}/whitelist`

| 端点 | HTTP方法 | 描述 | 原因 |
|------|---------|------|------|
| `/{id}/reset-usage` | PUT | 重置使用次数 | 后端内部管理功能 |
| `/usage/{phoneNumber}` | PUT | 增加使用次数 | 后端自动处理 |
| `/limit-reached` | PUT | 更新达限状态 | 后端定时任务处理 |

---

## MaterialBatchController - 保留但前端未使用的端点 (4 个)

路径前缀: `/api/mobile/{factoryId}/material-batches`

| 端点 | HTTP方法 | 描述 | 原因 |
|------|---------|------|------|
| `/{batchId}/reserve` | POST | 预留批次材料 | 已移至生产计划模块上下文 |
| `/{batchId}/release` | POST | 释放预留材料 | 已移至生产计划模块上下文 |
| `/{batchId}/consume` | POST | 消耗批次材料 | 已移至生产计划模块上下文 |
| `/{batchId}/adjust` | POST | 调整批次数量 | 与编辑功能重复，已移除UI |

**背景**: 2025-12-25 简化原材料管理界面，移除复杂操作

**API保留原因**:
- 后端 API 仍完整保留
- 生产计划完成时会通过 `/processing/batches/{id}/complete` 内部调用消耗
- 未来如需要可通过其他模块调用

---

## 职责划分

### 前端 API Client 分工

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Native 前端                            │
├─────────────────────────────────────────────────────────────────────┤
│ dashboardApiClient        │ aiApiClient          │ reportApiClient  │
│ - 实时 Dashboard          │ - AI 成本分析        │ - 库存报表       │
│ - 生产/质量/设备统计      │ - AI 批次分析        │ - 财务/人员报表  │
│ - 趋势数据                │ - 会话历史           │ - KPI/效率分析   │
│                           │                      │ - 预测/异常(AI)  │
│                           │                      │ - 导出/自定义    │
├─────────────────────────────────────────────────────────────────────┤
│ supplierApiClient (12方法) │ whitelistApiClient (17方法)            │
│ - CRUD + 筛选             │ - CRUD + 批量操作                       │
│ - 评级、统计、历史        │ - 统计、搜索、过期管理                  │
├─────────────────────────────────────────────────────────────────────┤
│ materialBatchApiClient (20方法，其中4个保留未用)                    │
│ - CRUD、库存统计、转冻品                                            │
│ - 保留: reserve/release/consume/adjust (由生产计划模块内部调用)     │
└─────────────────────────────────────────────────────────────────────┘
```

### 后端 Controller 分工

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Spring Boot 后端                             │
├─────────────────────────────────────────────────────────────────────┤
│ ProcessingController      │ AIController         │ ReportController │
│ - /processing/*           │ - /ai/analysis/*     │ - /dashboard/*   │ ← 统一入口
│ - /batches/*              │ - /ai/session/*      │ - /inventory     │
│ - /dashboard/* (废弃)     │ - /ai/health         │ - /finance       │
│                           │                      │ - /personnel     │
│                           │                      │ - /sales         │
│                           │                      │ - /kpi           │
│                           │                      │ - /forecast (AI) │
│                           │                      │ - /anomalies(AI) │
│                           │                      │ - /export/*      │
└─────────────────────────────────────────────────────────────────────┘
```

**注意**: ProcessingController 的 `/dashboard/*` 端点已标记 @Deprecated，
建议前端迁移到 ReportController 的 `/reports/dashboard/*` 端点。

---

## AI 增强功能

以下报表端点已集成 AI 服务 (Python DeepSeek):

1. **预测分析** (`/reports/forecast`)
   - 收集30天历史数据
   - 调用 AI 进行趋势分析和预测
   - 返回 aiAnalysis + reasoningContent

2. **异常检测** (`/reports/anomalies`)
   - 收集多维度数据 (库存、设备、成本)
   - 基于规则检测 + AI 智能分析
   - 返回 anomalies 列表 + AI 风险评估

---

## 后续版本计划

**Phase 4-5 可能添加的功能**:

- [ ] 供应商批量导入/导出
- [ ] 供应商财务对账
- [ ] 白名单使用次数管理
- [ ] 更多 AI 分析报表

---

## 相关文件

- `frontend/.../api/reportApiClient.ts` - 报表 API 客户端
- `frontend/.../api/supplierApiClient.ts` - 供应商 API 客户端
- `frontend/.../api/whitelistApiClient.ts` - 白名单 API 客户端
- `frontend/.../api/materialBatchApiClient.ts` - 原材料批次 API 客户端
- `backend/.../controller/ReportController.java` - 报表控制器
- `backend/.../controller/MaterialBatchController.java` - 原材料批次控制器
- `backend/.../service/impl/ReportServiceImpl.java` - 报表服务 (含 AI 集成)

---

## 更新历史

- **2025-12-22**: 初始版本，记录 SupplierController 和 WhitelistController 未实现端点
- **2025-12-25**: 添加 MaterialBatchController 保留端点说明 (简化原材料管理界面)
- **2025-12-30**: 更新后端规模统计 (Controller: 47个, API端点: 677个)
