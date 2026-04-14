# M4 · Orphan Endpoint Sweep — 2026-04-15

**Trigger**: R16 发现 `/sales-deliveries/items/{id}/batch-allocations` 后端存在但零前端调用, 引出 Rule 8 全局疑问: 还有多少 backend 端点前端没接?

**Scope**: 业务关键 controllers (sales, purchase, transfer, finance, customer). AI/canvas/system 配置类 controllers **不在本次扫描范围**.

## 方法

1. grep `@(Post|Put|Delete)Mapping` 提取 10 个 controller 的所有 mutation endpoints
2. 对每个路径提取**独特片段** (排除 generic 词 "/confirm", "/cancel", "/approve" 避免假阳性)
3. grep `web-admin/src/**/*.{vue,ts}` 搜索 distinctive 片段 + URL template 模式 (`${factoryId.value}/...`)
4. 0 matches = 真 orphan; ≥1 matches = 已集成

**避免之前子 agent 的错误**: 子 agent 报告 21 orphans 几乎全是假阳性, 因为它只搜字面路径, 漏掉了
`url: \`/${factoryId.value}/path/${action}\`` 的 URL 模板构造模式. 本次手动 grep 验证每一项.

## 真 Orphan 清单

### P0 (阻塞用户流程) — **0 个**
R16 的 batch-allocations 已通过 M2 (d6abcc913) 修复闭合.

### P1 (中等价值功能缺失) — **2 个**

| Endpoint | Controller:Line | 功能 | 修复建议 |
|---|---|---|---|
| POST `/finance/ap/adjustment` | finance/ArApController.java | 应付账款手动调整 | AR/AP 页面加"调整"按钮 + 对话框 |
| POST `/finance/ar/adjustment` | finance/ArApController.java | 应收账款手动调整 | 同上 |

**为什么 P1**: 财务月结/年结时难免有手动调整需求 (冲账、坏账核销等). 目前只能走数据库或 API. 但不像 batch-allocations 那样阻塞主流程.

### P2 (边缘/冗余/可选) — **6 个**

| Endpoint | Controller:Line | 归类 |
|---|---|---|
| POST `/sales/deliveries/{id}/signature` | inventory/SalesController.java:227 | 签收照片上传 — 可选功能 |
| PUT `/customers/{id}/credit-limit` | CustomerController.java | **冗余** — list.vue:182 的 PUT `/customers/{id}` 全量更新已包含此字段 |
| PUT `/customers/{id}/balance` | CustomerController.java | 同上冗余 |
| PUT `/customers/{id}/rating` | CustomerController.java | 同上冗余 (R7 bug 就在这里, 但实际走的是全量 PUT 路径) |
| PUT `/customers/{id}/status` | CustomerController.java | 同上冗余 |
| POST `/customers/import/json` | CustomerController.java | JSON 批量导入 — 仅 admin/迁移用, 一般 Excel 导入已有 UI |
| POST `/finance/ap/payable/payment` | finance/ArApController.java | **冗余** — PaymentRecordController `/record` 已承担此职责 |

**P2 处理建议**: 
- 不主动开发 UI
- **冗余端点**应在后续 refactor 时删除 (减少维护成本 + 避免设计漂移)
- `/signature` 如果产品要求, 可加一个上传组件

## 验证: M2 修复状态

✅ `batch-allocations` 片段在 web-admin/src/views/sales/orders/detail.vue 中:
- Line 316: `GET /sales-deliveries/items/{id}/batch-allocations/recommend-fifo` (FIFO 推荐)
- Line 377: `POST /sales-deliveries/items/{id}/batch-allocations` (分配提交)

R16 的 P0 bug 已完整闭合.

## 覆盖统计

**扫描范围**:
- 10 个业务 controller (sales/purchase/transfer/finance/customer)
- ~45 个 mutation endpoints (POST + PUT + DELETE, 排除 GET)

**分类结果**:
- 前端已接: ~37 (82%)
- P0 orphan: 0
- P1 orphan: 2 (finance adjustment)
- P2 orphan: 6 (冗余 + 可选)

**孤儿率**: ~18% (8/45)

## 对比 R16 发现模式

R16 的 batch-allocations 是 **P0 类型** (阻塞用户流程的真 bug). 本次扫描**未发现同类 P0**, 说明:

1. 前端已覆盖大部分核心 CRUD + 状态机操作
2. 剩余 orphans 偏向"冗余 API" (设计早期预留但实际走其他路径)
3. 真正功能缺失的是 finance adjustment (P1), 不影响主流程但影响月结

## 下一步 (不在本次工作中)

1. **可选**: 为 `/finance/ar/adjustment` + `/finance/ap/adjustment` 设计调整对话框 (P1)
2. **技术债**: 下次 CustomerController refactor 时删除冗余的单字段 PUT 端点 (P2)
3. **可选**: 为 delivery signature 加上传组件 (P2, 产品决策)

本文档产出后**不再主动推进**. 未来遇到客户反馈 "无法调整应收账款" 时回来读这份清单.

---

**生成**: 2026-04-15 执行的 M4 milestone (R16→R17 工作线收尾)
**Commit**: 查看附近的 commit history
**相关 memory**: `feedback_subagent_code_search_unreliable.md` — 本次第一次子 agent 扫描 21 orphan 全是假阳性, 进一步验证该反馈
