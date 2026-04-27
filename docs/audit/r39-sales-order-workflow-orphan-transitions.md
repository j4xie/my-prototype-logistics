# R39 BUG-5: sales_order workflow_schema 5+ orphan transitions (DYNAMIC view 开始生产/发货 等按钮全断)

**发现**: Apr 28 2026 — R38 真窗 audit 续盘
**严重度**: P0 (但需要架构决策, 不能 quick fix)
**影响**: DYNAMIC SO list view 中 FINANCE_APPROVED 之后所有状态转移按钮 404

## 复现

```bash
# F001 SO-20260424-0013 现在是 FINANCE_APPROVED
SO_ID=74a54bf6-4365-41d9-8f1b-b47d008ba8f1

# 点击 "开始生产" 按钮 → DynamicModulePage POST
curl -X POST "/api/mobile/F001/sales/orders/$SO_ID/startProduction"  # 404
curl -X POST "/api/mobile/F001/sales/orders/$SO_ID/start-production" # 404 (kebab also 404)
```

backend `SalesController` 完全没有 `/start-production` (或任何 startProduction) endpoint.

## 根因

**workflow_schema 与 backend 实现的设计哲学不匹配**:

`module_schemas.sales_order.workflow_schema.transitions` 列了 14 个状态转移, 但只有 5 个有对应 backend POST endpoint:

| Schema action | BE endpoint exists? |
|---|---|
| `confirm` | ✅ /confirm |
| `cancel` | ✅ /cancel |
| `submit-for-review` (R38 fix) | ✅ /submit-for-review |
| `finance-approve` (R38 fix) | ✅ /finance-approve |
| `finance-reject` (R38 fix) | ✅ /finance-reject |
| `startProduction` | ❌ **不存在** |
| `revise` | ❌ |
| `partialDeliver` | ❌ |
| `completeRemaining` | ❌ |
| `ship` | ⚠️ 在 /deliveries/{id}/ship 不在 /sales/orders/{id}/ship |
| `complete` | ❌ |

**两种设计哲学冲突**:

A. **SO 状态 业务事件驱动** (backend 实际): 创建 PP → SO 自动 PROCESSING. 创建 delivery+ship → SO 自动 SHIPPED. 报工 100% → SO 自动 COMPLETED. **不需要用户按按钮**.

B. **SO 状态 用户按钮驱动** (workflow_schema 列法): 用户在 SO list 点 "开始生产" → backend 直接转 PROCESSING. **需要 endpoint**.

Schema 写法 (B) + backend 实现 (A) 不一致 → DynamicModulePage 渲染 5+ 个按钮但都打不通.

R38 BUG-3 fix 只解决了 finance review 4 个 transitions (恰好都有 endpoint), 没动 FINANCE_APPROVED 之后的 transitions.

## 修复 path (R39+ 选项)

### 选项 A — 删 orphan transitions (最快)
UPDATE workflow_schema.transitions array, 只保留 5 个有 backend endpoint 的. DynamicModulePage 自然不渲染那些按钮. 用户进入 PROCESSING 通过创建 PP 流程 (production_plans 模块).

风险: 客户期望 "在 SO list 一键开始生产" 的 UX 找不到. 需要 product 决策.

### 选项 B — 给 orphan transitions 加 backend endpoints
给 SalesController 加 5 个新 PostMapping: `/start-production`, `/revise`, `/partial-deliver`, `/complete-remaining`, `/ship`(redirect to delivery flow), `/complete`. 每个内部调用现有 service 方法.

风险: 大量代码 + 业务逻辑可能与现有 PP/delivery 流程冲突.

### 选项 C — Schema action 加 `viewOnly: true` flag
给 5 个 orphan transitions 加 flag, DynamicModulePage 检 flag 后:
- 不渲染按钮
- 或渲染按钮但 click 时显示 "由 [关联流程] 自动触发, 请使用 [生产计划/出库单]"
保留 schema 状态机定义完整性, 同时不暴露断裂按钮.

风险: 需要 schema + FE 配合. 中等工作量.

## 推荐

**短期 (R40)**: 选项 C variant — 给 5 个 orphan transitions 加 `manualTrigger: false` flag, DynamicModulePage 跳过渲染按钮. 同时 SO detail page 显示状态流转的"下一步去 [PP 列表/出库单]" 引导链接.

**中期 (V2)**: 选项 B 部分实现 — `/ship` (常用) 加 backend endpoint, 直接复用 delivery 创建+ship 逻辑.

## 关联 R38

R38 BUG-3 (V20260428_02) 修了 4 个 transitions 的 camelCase. 但**没意识到**这些 transitions 其实有 backend endpoint, 而**剩下 6 个完全没有**. 这次 audit 揭示了更深层问题.

## R38 真窗 evidence

```
点击 SO-20260428-0001 (财务通过) "开始生产" → 预计 ElNotification "请求的接口不存在 (POST /sales/orders/.../startProduction)" sticky+closable
(R38 之后的 R23-R26 sister sweep modal pattern 应该会捕获)
```

未真窗触发 — 文档化为 backlog. R39 implementer 应该先 真窗 verify 5 个 broken buttons.

## R39 backlog 完整列表

- BUG-5 (本文档): 5+ orphan transitions
- 完整 流程依赖错误 Rule 8 四位一体 verify (4 corner: 重复审批 / 库存不足 / 未分配批次 / 未审 SO)
- Rule 9 数据抽检 (中段+末段) — sales/orders list 44 条, 中段 row #22, 末段 #42-44
- DynamicModulePage.vue:189 加 body POST 选项 (避免 BUG-4 类需要 BE @RequestBody required=false)
- 其他 modules workflow_schema 同问题 audit (production_plan, purchase_order 等)
