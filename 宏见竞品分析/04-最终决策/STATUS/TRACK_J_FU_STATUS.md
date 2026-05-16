# Track J Follow-Up STATUS (Chat 6 — P-FIN-1 Vue PC view)

> 主 Track J: `TRACK_J_STATUS.md`
> 主 PR (merged): **#675** (后端规则+触发 / AI Tool / RN view) + **#679** (NotificationService 通知 finance_manager)
> 本文件: Chat 6 follow-up — Vue web-admin PC 财务审核 view

---

## 2026-05-16 — Chat 6 FU 完了

### PR

**#686**: https://github.com/j4xie/my-prototype-logistics/pull/686
Branch: `fix/sprint2-fu-chat6-vue-finance-review` off `origin/main @ 8f0a6f8ce`
Commit: `021541ee3` (4 files, +699/-0)

### 完成

| 文件 | 类型 | 说明 |
|---|---|---|
| `web-admin/src/api/purchaseFinanceReview.ts` | NEW | 5 方法 (list/getOrderDetail/priceComparison/financeApprove/financeReject), 类型镜像 RN |
| `web-admin/src/views/procurement/finance-review/list.vue` | NEW | ElTable 待财审列表, 分页, 行点跳详情 |
| `web-admin/src/views/procurement/finance-review/detail.vue` | NEW | ElCard 摘要 + ElTable 三价对比 (`priceAlert=true` 行 `#FFE4E1` 红底 + `#C62828` 红字, 镜像 RN) + 备注 + 通过/驳回 (ElMessageBox 二次确认) |
| `web-admin/src/router/index.ts` | MOD | `procurement.children` 加 `finance-review` + `:id` 2 路由 |

### 验证

- ✅ `vite build` PASS 37s, 新文件入包 (`detail-5TbSr1TF.js` 49.81 kB + list chunks)
- ✅ `vitest --testNamePattern='manifest|invariant'`: 4 manifest-consistency PASS 18s
- ✅ vue-tsc 新文件 0 错; build:check 失败的全是 pre-existing 不相关错
- 🟡 E2E: 待 deploy + matrix 调整后人工验证

### ⚠️ 协调点 (web-admin matrix vs 后端 matrix drift)

后端 `PermissionService` 给 `finance_manager` 授 `finance:read_write` (Sprint 1 PR #674 K4), 但 web-admin `utils/permission.ts:44` 当前 `finance_manager.finance = 'none'` (deliberate, 注释 "隐藏旧财务管理,合并到 SmartBI").

当前 PR 不动这个 matrix。结果:
- `factory_super_admin` (matrix 有 `finance: 'read_write'`) → PC 端立刻可见 + 可操作
- `finance_manager` → PC 端**不可见**, 须 follow-up PR 给 matrix 加 `finance: 'read_write'`

ROI 评估: 加 1 行 matrix 5 min, 但要确认 Sprint 1 K4/K5 重构没有引入新的语义 (finance_manager 是否还应该看到"旧"finance management 入口? — 我不动是因为不确定)。

建议: 单独 follow-up PR, 调 matrix + 同步 mobile permissionHelper.ts。

### 不动 (per Steve 指示)

- ❌ RN
- ❌ 后端
- ❌ Track B1 钉钉
- ❌ web-admin matrix (上面协调点)

### 路由路径 (供后续 chat 接入)

| 类型 | 路径 | Route Name |
|---|---|---|
| 列表 | `/procurement/finance-review` | `PurchaseOrderFinanceReviewList` |
| 详情 | `/procurement/finance-review/:id` | `PurchaseOrderFinanceReviewDetail` |

后续可接入点:
- Chat G WorkflowBar 节点跳 `PurchaseOrderFinanceReviewList`
- Chat H RowActionMenu "审核" 跳 `PurchaseOrderFinanceReviewDetail`

### Chat 6 FU 完了 ✅
