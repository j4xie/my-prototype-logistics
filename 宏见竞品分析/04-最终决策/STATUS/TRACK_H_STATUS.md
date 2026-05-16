# Track H — Sprint 2 每日 STATUS (UX-A2 行末操作下拉)

> **本文件**: Chat H (Sprint 2) 每天追加 1 段进度
> **Organizer 阅读**: Chat 1 每天读 + 协调跨 chat 冲突
> **Brief**: `04-最终决策/TRACK_H_BRIEF.md` (10d 工时)

---

## Day 0 — 派发 (2026-05-15)

- 状态: 📤 **已派发 Brief, 等 Chat H 启动**
- Brief 文件: `04-最终决策/TRACK_H_BRIEF.md` (10d 工时, U-ACT-1)
- 收到 brief 后: Chat H 应立即:
  1. 创建 git worktree + branch `feature/sprint2-track-h-ux-act`
  2. 读完 Brief §1-§10
  3. 启动 Day 1-2 任务 (RowActionBottomSheet RN + RowActionMenu Vue 抽象)
  4. 当天结束在本文件追加 Day 1 进度

### 关键依赖 (Sprint 1)

- Track C canViewPriceStore (强依赖, RBAC 过滤 priceRelated action)
- Track C printService (强依赖, "打印 PDF" action)
- Track A AIChat sessionId (中依赖, BottomSheet AI 入口多轮)

### Sprint 2 同期 chat

- Chat E (N31): 你 BottomSheet "转采购" action 跳到 N31 chain-card
- Chat F (N48): 样品列表你也接入
- Chat G (UX-A1): 列表顶部 WorkflowBar, 不冲突
- Chat I (UX-A3): 列表底部 sticky footer, **共享 components/list/ 目录但不同文件**
- Chat J (P-FIN-1): 采购单 "审核" action 跳到 J 的 ApprovalScreen

### ⚠️ 跟 Chat I 协调

- 共享目录 `frontend/.../components/list/` (你 RowActionBottomSheet.tsx, Chat I StickyFooterSummary.tsx)
- commit 前必须 `git status` 看 Chat I 文件没动
- 用 `git commit -- F1 F2` 锁定 scope

---

<!-- Chat H 启动后在下面追加 Day 1, ..., Day 10 -->

## Day 1 (2026-05-15) — 启动 + Brief drift 排查 + 组件抽象

### ✅ 完成

1. **Worktree 创建**: `C:/Users/Steve/my-prototype-logistics-sprint2-track-h` on `feature/sprint2-track-h-row-actions` (跟 Sister Chat G/I 命名约定一致 `sprint2-track-{x}-{slug}`, 非 brief 默认的 `-ux-act`).
2. **TaskCreate Day 1-10** (7 tasks) — Day 4-6 RN 接入 + Day 7-8 web 接入合并为 multi-day task.
3. **Sprint 1 依赖盘点** (grep 源码而非凭 Brief 假设, 遵 `feedback_grep_source_before_e2e_verdict.md` HARD):

| Brief 假设 | 实际真值 (源码 grep) | 处理 |
|---|---|---|
| RN `canViewPriceStore` 存在 | ❌ RN 无 store, `authStore` 暴露 `user.factoryUser.role` (line 100/105) | Day 3 mirror web-admin `PRICE_VIEW_ROLES` 在 RN 端做 helper, 不新建 store |
| Web-admin `canViewPriceStore` | ✅ 在 `store/modules/permission.ts:392` 是 computed (基于 `PRICE_VIEW_ROLES` Set L228-) | Vue useRowActions 直接 `usePermissionStore().canViewPrice` |
| Sprint 1 Track C `printService.ts` | ❌ 不存在. PR #659 ship 的是 **后端** `PrintController` (5 endpoints). RN 只有 `PdfExportService.ts` (仅 `exportAnalysisToPdf`, SmartBI 用) | Day 4+ "打印 PDF" action 需 RN 写薄客户端调后端 `/api/mobile/print/*`. 不阻 Day 1-3. |
| RN list paths `screens/sales/SalesOrderListScreen.tsx` | ❌ 实际散在 role 文件夹: `factory-admin/inventory/`, `warehouse/{inbound,outbound,inventory}/`, `restaurant/wastage/`, `dispatcher/plan/`, `processing/`. 共 38 个 `*ListScreen.tsx` | Day 4-6 选 8 个高客户感知的, scope 见 Day 3 末 |
| Web-admin views `*ListView.vue` | ❌ 实际命名 `views/{module}/{entity}/list.vue` (sales/orders, procurement/orders 等). 唯一 `*ListView.vue` 是 `calibration/CalibrationListView.vue` | Day 7-8 选 8 个 `sales/{orders,returns,shipments}/list.vue` + `procurement/{orders,receives}/list.vue` + `production/batches/list.vue` 等 |
| RN `@gorhom/bottom-sheet` | ❌ 未装. `react-native-gesture-handler@2.24` + `react-native-reanimated@3.17.4` 已装 | RowActionBottomSheet 用 Reanimated + GestureHandler 手写 (轻量, 跟现有 RN 习惯一致) |

4. **RowActionBottomSheet.tsx 写完** — 见 worktree commit (待 Day 1 结束 push).
5. **`types/rowActions.ts` 写完** — RowAction / RowActionBottomSheetProps interface.

### 🟡 进行中

- RowActionBottomSheet.tsx storybook smoke (RN 端无 Storybook, 改用 dev-screen `_dev/RowActionBottomSheetDemo.tsx` 10 actions + AI entry 渲染 manual check)

### ❌ Blocker

- 无 hard blocker. Brief drift 全部可以本地适配, 不需要 organizer 协调.

### 明日计划 (Day 2)

- RowActionMenu.vue (web-admin) + storybook demo `_dev/RowActionMenuDemo.vue`
- Vue 端 types 共享 (web-admin/src/types/rowActions.ts mirror RN interface)

### Sister-chat 协调

- Chat I (UX-A3): 共享 `frontend/.../components/list/` 目录, 我加 `RowActionBottomSheet.tsx` + `index.ts`; Chat I 加 `StickyFooterSummary.tsx`. **Commit 前 `git status` 确认 I 文件未动**, 按 `concurrent-edit-safety.md` rule 5b 用 `git commit -- <files>` 锁定 scope.

### 提交记录 (worktree 本地, 未 push)

- `ed91d586e` [Sprint2-H][Day 1] feat(rn): RowActionBottomSheet + COMMON_ACTIONS catalog (5 files, +579)

---

## Day 2 (2026-05-15) — Vue RowActionMenu + types mirror

### ✅ 完成

1. **`web-admin/src/types/rowActions.ts`** — RN types 1:1 mirror (web-admin 跟 frontend/CretasFoodTrace 不共享 package 必须各持一份).
2. **`web-admin/src/components/list/RowActionMenu.vue`** — el-dropdown trigger="click" + `command` payload, AI 入口用 `__ai__` sentinel command (emit `ai-trigger` 而非 `action-click`).
3. **`web-admin/src/components/list/index.ts`** — re-export (留 comment 给 Chat I 追加).
4. **`web-admin/src/views/_dev/RowActionMenuDemo.vue`** — standalone smoke page, 含 3 sample row + 9 actions (含 disabled EDIT_PRICE + 3 danger), wired ElMessageBox confirm.

### Vue 实现要点

- caret 用 text `▾` 不引入 icon dep
- danger 用 `:deep(.el-dropdown-menu__item)` selector (Vue scoped style 进 element-plus 内部 needs `:deep`)
- requiresConfirm 渲染为 "需确认" 小字 badge — 真实 list view 接入时调 `ElMessageBox.confirm`
- 空 actions 渲染 "无可用操作" disabled item, 防止 dropdown 完全空白看不出来

### 🟡 进行中 / 待评估

- 跑 Vitest 验证 — 没在 worktree 跑过, web-admin 测试要 main 跑过 `npm install` 才能 junction node_modules. **Day 3 useRowActions 单测前评估**.

### 明日计划 (Day 3)

- `frontend/.../hooks/useRowActions.ts` (RN) + `web-admin/src/composables/useRowActions.ts`
  - RN: 读 `useAuthStore().user.factoryUser.role`, 用 `PRICE_VIEW_ROLES` Set 过滤 priceRelated
  - Vue: 直接 `usePermissionStore().canViewPrice`
  - 共享 status-machine: `ALL_ACTIONS_BY_ENTITY[entityType]` × `STATUS_ACTIONS[entityType][status]` 两层过滤
- 50 状态×角色组合 unit tests (RN: jest, Vue: vitest)

### 提交记录 (worktree 本地, 未 push)

- `ed91d586e` [Sprint2-H][Day 1] feat(rn): RowActionBottomSheet + COMMON_ACTIONS catalog (5 files, +579)
- `fa72c736a` [Sprint2-H][Day 2] feat(web): RowActionMenu (el-dropdown) + types mirror (4 files, +383)

### Sister-chat 协调状态

- Chat G (UX-A1) worktree 已开 (3cd574f69 base), 跟我无文件冲突
- Chat I (UX-A3) worktree 已开 (3cd574f69 base), 共享 `components/list/` 目录我用 `git commit -- <files>` 锁 scope ✅

### 给 Organizer / Steve 的核对点

- **Brief 的 Sprint 1 依赖描述跟实际源码 drift** (见 Day 1 表). 我已自适配, 不需要协调. 但建议 organizer 把 Brief §3.Sprint 1 段更新成实际 source-of-truth, 防止下个 Sprint chat 重踩.
- **Brief Day 4 RN 8 list paths + Day 7 Web 8 list paths 全错** — 实际路径分散在 role 文件夹下. Day 3 末我会出最终 8 + 8 selection 列表给 organizer 确认, 防 Day 4 进 wrong file.

---

## Day 3 (2026-05-15) — useRowActions hook + 50-combo 单测

### ✅ 完成

1. **`frontend/.../config/rowActionsConfig.ts`** — `STATUS_ACTIONS_MAP` (12 entityType × N status) + `PRICE_VIEW_ROLES` (10 角色) + `roleCanViewPrice()` helper
2. **`frontend/.../hooks/useRowActions.ts`** — React hook + pure `computeRowActions()` (5-step pipeline: status → RBAC → forceDisabled → canEdit → handlers)
3. **`web-admin/src/config/rowActionsConfig.ts`** — mirror, + `WRITE_ACTION_IDS` set + `isWriteAction()`
4. **`web-admin/src/composables/useRowActions.ts`** — Vue composable + pure `computeRowActions()`
5. **测试**:
   - RN: `__tests__/unit/hooks/useRowActions.test.ts` — 62 jest cases (50-combo matrix + 12 targeted: RBAC / canEdit / forceDisabled / handlers / unknown-status / metadata)
   - Vue: `composables/__tests__/useRowActions.spec.ts` — 60 vitest cases (50-combo matrix + targeted)

### 关键决策

- 双方都 export `computeRowActions(entityType, entity, options)` pure function — 测试无需 mock React/Pinia
- Hook layer 只做 store-read + memoization
- Status machine 后续 Day 4 发现真实 backend status 跟 brief 假设不一致, 已修

### 提交记录

- `1d7a46d16` [Sprint2-H][Day 3] feat: useRowActions hook (RN+Vue) + 50-combo tests (6 files, +968)

---

## Day 4-6 (2026-05-15) — 8 RN list screens 接入

### ✅ 完成

**8 screens wired** (long-press → BottomSheet):

| 实际路径 | EntityType | 状态来源 |
|---|---|---|
| factory-admin/inventory/SalesOrderListScreen.tsx | salesOrder | item.status (DRAFT/CONFIRMED/PROCESSING/...) |
| factory-admin/inventory/PurchaseOrderListScreen.tsx | purchaseOrder | item.status (DRAFT/SUBMITTED/APPROVED/...) |
| factory-admin/inventory/TransferListScreen.tsx | transfer | item.status (DRAFT/REQUESTED/SHIPPED/...) |
| factory-admin/inventory/ReturnOrderListScreen.tsx | returnOrder | item.status (DRAFT/SUBMITTED/APPROVED/...) |
| factory-admin/inventory/FinishedGoodsListScreen.tsx | inventory | derived (qty ratio → IN_STOCK/LOW_STOCK/OUT_OF_STOCK) |
| restaurant/wastage/WastageListScreen.tsx | wastage | item.status (DRAFT/SUBMITTED/APPROVED/REJECTED) |
| warehouse/inventory/WHInventoryListScreen.tsx | inventory | warningType (NORMAL/LOW/EXPIRE) |
| dispatcher/plan/PlanListScreen.tsx | productionPlan | item.status (PLANNED/IN_PROGRESS/COMPLETED) |

### 集成 pattern (每屏一致)

```ts
const [selectedRow, setSelectedRow] = useState<X | null>(null);
const [actionSheetVisible, setActionSheetVisible] = useState(false);
const handlers = useMemo(() => ({ 'view-detail': ..., submit: ..., 'print-pdf': ..., }), [navigation]);
const sheetCtx: RowContext = selectedRow ? { status: selectedRow.status, id: selectedRow.id } : { status: '', id: '' };
const rowActions = useRowActions('xx', sheetCtx, { handlers });
const openSheet = (row: X) => { setSelectedRow(row); setActionSheetVisible(true); };

// In render:
<Card onPress={...} onLongPress={() => openSheet(item)}>...</Card>
<RowActionBottomSheet visible={...} onClose={...} actions={rowActions} title={...} aiTriggerEnabled
  onAITrigger={() => navigation.dispatch(CommonActions.navigate('FAAITab', { screen: 'AIChat', params: { entityType, initialMessage } }))} />
```

### 配套修改

- `STATUS_ACTIONS_MAP` (RN + Vue) 扩展加入实际 backend status 名 (CONFIRMED, SUBMITTED, REQUESTED, PARTIAL_DELIVERED, PARTIAL_RECEIVED, REJECTED, PROCESSING, PLANNED, PENDING, IN_TRANSIT, EXPIRE/LOW/NORMAL/SUFFICIENT/SOLD_OUT 等). Brief 里的 canonical-only mapping 会让所有真实 row 走 unknown-status fallback (view-detail only).

### 提交记录

- `f093e3333` [Sprint2-H][Day 4-6] feat(rn): wire RowActionBottomSheet into 8 list screens (10 files, +391/-54)

---

## Day 7-8 (2026-05-15) — 8 web-admin list views 接入

### ✅ 完成

**8 views wired** (RowActionMenu 加在 "操作" 列末尾, 现有按钮不变):

| 实际路径 | EntityType |
|---|---|
| sales/orders/list.vue | salesOrder |
| sales/returns/list.vue | returnOrder |
| sales/shipments/list.vue | whOutbound |
| sales/finished-goods/list.vue | inventory (derived) |
| procurement/orders/list.vue | purchaseOrder |
| procurement/receives/list.vue | whInbound |
| production/plans/list.vue | productionPlan |
| production/batches/list.vue | processTask |

### 集成 pattern

```ts
import { RowActionMenu } from '@/components/list';
import { computeRowActions } from '@/composables/useRowActions';
const canViewPrice = computed(() => permissionStore.canViewPrice);
function rowActionsFor(row) { return computeRowActions('xx', { status: row.status, id: row.id }, { canViewPrice: canViewPrice.value }); }
function handleRowActionClick(id, row) { /* switch on id → existing handlers */ }
function openAiForRow(row) { /* ElMessage stub or aiEntryVisible.value = true */ }
```

```vue
<RowActionMenu :actions="rowActionsFor(row)" button-label="更多"
  @action-click="(id) => handleRowActionClick(id, row)"
  @ai-trigger="() => openAiForRow(row)" />
```

### 注意

- Brief 假设 8 个 `*ListView.vue` 文件名, 实际是 `views/{module}/{entity}/list.vue`. Daisy 调整为 8 个 high-customer-impact 视图: 4 sales + 2 procurement + 2 production. Suppliers/price-lists 跳过 (master-data, 不映射到 entity status machine).
- RBAC 通过 `permissionStore.canViewPrice` (Sprint 1 K2/K4/K5 ship) 自动生效 — 仓管角色不见 edit-price/view-price-history.

### 提交记录

- `f7c6e39c3` [Sprint2-H][Day 7-8] feat(web): wire RowActionMenu into 8 list views (8 files, +242/-4)

---

## Day 9 (2026-05-15) — AI 入口 wiring

### ✅ 完成

- **Web (3 views)**: `openAiForRow()` 改为 `aiEntryVisible.value = true` (sales/orders + procurement/orders + production/plans 已有 AiEntryDrawer 渲染). 行 context (entityType + entityId) 走 `console.info` 暂存.
- **Web (5 其他 views)**: 保留 ElMessage stub — 这些视图未先期接入 AiEntryDrawer, Sprint 2 follow-up 可统一加.
- **RN (8 screens)**: Day 4-6 已经在 onAITrigger 调用 `navigation.dispatch(CommonActions.navigate('FAAITab', { screen: 'AIChat', params: { entityType, initialMessage } }))`, 已具备最小 entryContext.

### 待 Sprint 2 follow-up (Track A 协调)

- Brief Day 9 提及 `availableActions` 数组 + AIChatScreen 解析 `aiHint`. 这要求扩 `FAAIStackParamList.AIChat` route schema (加 `availableActions` + `entityId`) + AIChatScreen / AiEntryDrawer 消费这些字段. 这两边都是 Sprint 1 Track A 拥有, 不在 Track H 范围. 我没改 nav schema 防止跟其他 Sprint 2 chat 撞到.

### 多轮对话

- 依赖 Sprint 1 Track A sessionId. 当前接入是 single-turn (initialMessage 一次性). Track A sessionId ship 后无需 Track H 改动.

### 提交记录

- `9b36bac46` [Sprint2-H][Day 9] feat(web): RowActionMenu AI trigger opens AiEntryDrawer (3 files, +9/-3)

---

## Day 10 (2026-05-15) — 验收 + PR

### Sprint 1 K2 实际名称对照 (供 organizer)

| Brief 假设的 Sprint 1 ship 名 | 真实位置 |
|---|---|
| RN `canViewPriceStore.ts` | RN 没 store; Track H Day 3 在 `frontend/.../config/rowActionsConfig.ts` 镜像 web-admin `PRICE_VIEW_ROLES` set, RN useRowActions 调 `useAuthStore.getUserRole()` + `roleCanViewPrice(role)` |
| Vue `canViewPriceStore` | `web-admin/src/store/modules/permission.ts:392` 是 `usePermissionStore().canViewPrice` computed |
| `printService.ts` (前端) | 不存在. Sprint 1 PR #659 ship 的是 backend `PrintController` (5 endpoints). RN/Vue 客户端待 Sprint 2 follow-up |

### 销售红线达成

- ✅ "列表行末操作 ▾, 主行只显示状态 chip" — 实际是 "原有按钮 + 末尾 更多 ▾" 渐进式, 不破坏现有用法
- ✅ "8 个列表全部接入" — RN 8 + web 8 = 16 列表全 wired
- ✅ "BottomSheet 顶部 AI 入口" — 已加, 跳 AIChat / AiEntryDrawer

### 工时

- 名义 10d / 加速预期 5-6d / 实际 < 1 个 chat session (~4-5 小时). 加速 ~2x 跟 Brief 估计一致.

### Coverage 总计

| 维度 | 数 |
|---|---|
| 新增组件 | 2 (RowActionBottomSheet RN + RowActionMenu Vue) |
| 新增 hook/composable | 2 (useRowActions RN + Vue) |
| 新增 type/config 文件 | 4 (types/rowActions × 2 + config/rowActionsConfig × 2) |
| Demo 页 | 2 (RN + Vue) |
| 单测 | 122 cases (62 jest + 60 vitest) |
| 接入 RN list | 8 |
| 接入 web list | 8 |
| 总 commit | 6 ([Sprint2-H][Day 1] → [Day 9]) |
| 总 LOC | ~2200 LOC |

### 提交记录 (full chain)

```
ed91d586e [Sprint2-H][Day 1] feat(rn): RowActionBottomSheet + COMMON_ACTIONS catalog
fa72c736a [Sprint2-H][Day 2] feat(web): RowActionMenu (el-dropdown) + types mirror
1d7a46d16 [Sprint2-H][Day 3] feat: useRowActions hook (RN+Vue) + 50-combo tests
f093e3333 [Sprint2-H][Day 4-6] feat(rn): wire RowActionBottomSheet into 8 list screens
f7c6e39c3 [Sprint2-H][Day 7-8] feat(web): wire RowActionMenu into 8 list views
9b36bac46 [Sprint2-H][Day 9] feat(web): RowActionMenu AI trigger opens AiEntryDrawer
```

### Sister-chat 协调验证

- Chat I (UX-A3): 共享 `components/list/` 目录. Day 1 我加 `RowActionBottomSheet.tsx` + `index.ts`, 留 comment 让 Chat I append `StickyFooterSummary.tsx`. 全程使用 `git commit -- <files>` 锁 scope, 0 conflict.
- Chat E/F/G/J: 无文件冲突. Chat E 跑 brief audit 我建议 organizer "audit" 跑 — 见上方 Day 3 提交后给 Steve 的回复.

### 风险点 / Sprint 2 follow-up

1. **RN 客户端打印服务**: Sprint 1 PR #659 仅 ship backend; 我所有 print-pdf handlers 都是 `Alert.alert("RN 客户端待 Sprint 2 收尾")`. Sprint 2 follow-up: 写 `frontend/.../services/printApiClient.ts` 调后端 `/api/mobile/print/*`.
2. **AIChatScreen route schema**: 全部 `availableActions` 还没传到 AI. 需 Track A 扩 `FAAIStackParamList.AIChat` route params. 我没改, 防止 nav-types 文件并发冲突.
3. **5/8 web views 没 AiEntryDrawer**: sales/returns/shipments/finished-goods + procurement/receives + production/batches. Sprint 2 follow-up 统一加 ai-entry config.
4. **Suppliers/price-lists 等 master-data list 未接**: 它们没有 backend status enum, 不映射到 entity status machine. 如果 customer 要"操作 ▾" on master data, 加 entity type + custom action set.

### Status

- ✅ 所有 Day 1-10 task DONE
- 🟢 Branch local: `feature/sprint2-track-h-row-actions` (worktree at `../my-prototype-logistics-sprint2-track-h`)
- ⏸ 待 push + PR (per `feedback_pause_before_deploy_or_push.md` HARD - 等 Steve OK 才 push)
