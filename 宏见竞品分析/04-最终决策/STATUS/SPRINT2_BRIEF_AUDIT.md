# SPRINT 2 BRIEF AUDIT — Sprint 1 Contract Drift Heads-up

> **生成**: 2026-05-15 by Chat F (Sprint 2 worker, 在 organizer 派下接 audit 任务)
> **触发**: Chat E + Chat F 各自撞到 brief 假设的 Sprint 1 service/entity/method 名字跟 main 实际代码不符 (n=2 → systemic pattern, 不是单 chat 问题)
> **覆盖**: 6 个 Sprint 2 brief (E/F/G/H/I/J)

---

## ⚠️ 重大 CAVEAT — 必读

**此 audit 不替代 worker 自己 grep verify**. 此 doc 仅是**已知 drift heads-up**, 让你接 task 起跑前避开 known traps. 仍然遵守 HARD rule `feedback_organizer_projection_bug.md`:

> 在写 import / @Autowired / .map → entity 之前, **必须**对 brief 提到的每个 Sprint 1 service / entity / repository / method **grep 真实 main 代码 verify**. Audit doc 写于 2026-05-15 14:00, 真实代码可能又变.

**Verify 命令模板**:
```bash
# Java 后端 service / entity / interface
Grep "class XxxService|interface XxxService" path=backend/java/cretas-api/src/main/java/com/cretas/aims output_mode=files_with_matches

# RN 前端 component / store / hook
Grep "useXxx|XxxScreen|XxxStore" path=frontend/CretasFoodTrace/src output_mode=files_with_matches
```

**如果 audit 里说"实际名是 X"** — 你还是要 grep `class X` 自己 confirm, 因为 audit 也可能错。

---

## 跨 chat 共同 drift 模式 (高优先级 — 多 chat 撞同一坑)

### Pattern 1 — `DingTalkBotService` 不存在; 用 **新** `service/notification/NotificationService` (E / F / J 都假设)

⚠️ **2026-05-15 更正** (organizer correction): 项目里**有两个** NotificationService, organizer 拍板用**新**那个 (`service/notification/NotificationService`):

| Service | 路径 | 签名 | 状态 |
|---|---|---|---|
| ⛔ **老 service** (不要用) | `service/NotificationService.java` | `sendToRole(factoryId, FactoryUserRole role, title, content, NotificationType type, source, sourceId)` (7-arg) | legacy, 复杂签名 |
| ✅ **新 service** (用这个) | `service/notification/NotificationService.java` | `notifyRole(factoryId, String roleCode, title, body)` (4-arg) | P1-5 通用通知, 当前 impl = `LoggingNotificationServiceImpl` (只 log); Track B1 merge 后 @Primary 切到 DingTalkNotificationServiceImpl, 业务代码 0 改 |

**正确用法** (organizer 提供):
```java
import com.cretas.aims.service.notification.NotificationService;  // ⚠️ 必须是 notification 子包

// 通知特定角色 (工厂内广播给该角色所有人)
notificationService.notifyRole(factoryId, "SALES_MANAGER", title, body);

// 通知特定用户
notificationService.notifyUser(factoryId, userId, title, body);

// 系统级工厂广播 (谨慎)
notificationService.broadcastFactory(factoryId, title, body);
```

**roleCode 字符串约定** (organizer 示例): `"SALES_MANAGER"` / `"FINANCE_MANAGER"` / `"FACTORY_ADMIN"` (全大写). 不是 `FactoryUserRole` enum.

**应用**:
- Chat E (N31): `notifyRole(factoryId, "FACTORY_ADMIN", "缺料告警", "销售单 SO-XXX 缺 3 物料")` (organizer 直接指定)
- Chat F (N48): `notifyRole(factoryId, "SALES_MANAGER", "样品审批通过", "...")` ✅ Chat F 已 fix in commit (listener 第二次更新)
- Chat J (P-FIN-1): `notifyRole(factoryId, "FINANCE_MANAGER", "采购单待财审", "PO-XXX")` (organizer 指定)

**为什么 audit 第一版给错的接口**:
audit 跑时只 grep `class NotificationService` 命中老的 `service/NotificationService.java`, 没注意到新的 `service/notification/NotificationService.java`. 教训: glob `**/NotificationService.java` 才能列全部, 不要只 grep `class NotificationService`. 这也是 caveat 第一条 "audit 也可能错" 的实例。

**注**: 钉钉真实推送 ship 是 Track B1 merge 后的事; 在此之前所有调用只 log. 业务代码用新 service 是 forward-compatible.

---

### Pattern 2 — Brief 引用的 `service/impl/` 路径多个错 — 实际在子包

Chat E brief §3.4 列 4 个 service:
| Brief 路径 | 实际路径 |
|---|---|
| `service/impl/BomExpansionService.java` | ✅ 存在但在 `service/orchestration/BomExpansionService.java` |
| `service/impl/InventoryMatchingService.java` | ✅ 存在但在 `service/orchestration/InventoryMatchingService.java` |
| `service/impl/ProcurementSuggestionService.java` | ✅ 存在但在 `service/orchestration/ProcurementSuggestionService.java` |
| `service/impl/SupplyChainOrchestrator.java` | ✅ 存在但在 `service/orchestration/SupplyChainOrchestrator.java` |

**应用**: import path 改 `com.cretas.aims.service.orchestration.*` 不是 `com.cretas.aims.service.impl.*`

---

### Pattern 3 — Sprint 1 Track C 误标 "RBAC + 单据打印 ship" — 实际 Track C ship 是 Attachment

多个 chat brief 引用:
- "Sprint 1 Track C `canViewPriceStore` ship" (Chat H / I)
- "Sprint 1 Track C `printService.ts` ship" (Chat H)
- "Sprint 1 Track C `exportService.ts` ship" (Chat I)
- "Sprint 1 Track C `RBACService.java` ship" (Chat I / J)

**实际 Sprint 1 Track C 是**: Attachment 系统 (`AttachmentController` + `AttachmentService` + `Attachment` entity + V20260516_01__attachment.sql, ship 2026-05-15)

**实际 RBAC 在哪**: `@PriceSensitive` 注解 (`security/PriceSensitive.java`) + `PriceFieldResponseAdvice` 后端 strip. 前端 store 我**没找到** `canViewPriceStore.ts` — closest 是 `store/fieldVisibilityStore.ts` (可能是同义 ship), 各 chat 自行 verify。

**前端 PDF 服务实际叫**: `services/PdfExportService.ts` (不是 `printService.ts` 也不是 `exportService.ts`)

**应用**:
- Chat H §3 "Sprint 1 已 ship 你强依赖" `canViewPriceStore` / `printService` 都得 grep verify。
- Chat I §3 同上 `exportService` / `RBACService`。
- Chat J §3 `RBACService.java` — 自己 grep 验证, 我没找到此 class. 也许在 `security/` 子包。

---

## 各 chat 已识别 drift 详表

### Chat E (N31 销售→采购自动分流)

| Brief 段落 | Brief 假设 | 实际 | 影响 |
|---|---|---|---|
| §3.4 ship 列表 | `service/impl/BomExpansionService` | `service/orchestration/BomExpansionService` | Day 2 import path 错 |
| §3.4 ship 列表 | `service/impl/InventoryMatchingService` | `service/orchestration/InventoryMatchingService` | 同上 |
| §3.4 ship 列表 | `service/impl/ProcurementSuggestionService` | `service/orchestration/ProcurementSuggestionService` | 同上 |
| §3.4 ship 列表 | `service/impl/SupplyChainOrchestrator` | `service/orchestration/SupplyChainOrchestrator` | 同上 |
| §3.4 ship 列表 | `service/dingtalk/DingTalkBotService` | ⛔ **不存在**, 用 NotificationService | Day 4 钉钉推送整段重写 |
| §6 接口契约 | `DingTalkBotService.sendNotification(factoryId, title, content)` | 用 `NotificationService.sendToRole/sendToAllUsers` | 同上 |
| §3.4 ship 列表 | "Track C `MaterialPriceComparisonDTO`" | ✅ 存在 `dto/inventory/MaterialPriceComparisonDTO.java` | OK |
| Day 2 Flyway | `V20260601_01__sales_order_shortage_report.sql` | 主 main 最新 V20260516_07, V20260601_01 可用 | OK 但跟 Chat F brief 撞号 (Chat F brief 也用 V20260601_01); Chat F 已 commit V20260601_01 后 reverted, 现在主 branch 上没该号; Chat E 可继续用 |

### Chat F (N48 研发样品→BOM→报价) — 已自 audit (commit `7652888db` 详)

| Brief 假设 | 实际 |
|---|---|
| §2 "工厂端无样品管理" | ⛔ **ProductSample 全栈已存在** (entity 40+ 字段, Service 11 方法, RdController 12 endpoints, SampleApprovedEvent + Listener 已 wired 自动建 QuotationTask) |
| §3 Sprint 1 Track D1 `BomService.createFromSample(sampleId, factoryId, userId)` | 实际 `BomRecipeService.createRecipe(factoryId, CreateBomRecipeRequest)` (但 BomRecipe entity 已设计 `sourceType=SAMPLE_AUTOGEN` + `sourceSampleId` 字段, sample 集成是已设计意图) |
| §4 Day 2 `QuotationService.createTaskFromSample` | ⛔ `QuotationService` 类完全不存在; 但 `QuotationTask` entity (`entity/rd/QuotationTask.java`) 已存在含 `sample_id` 字段; 直接 `quotationTaskRepository.save()` |
| §3 `service/dingtalk/DingTalkBotService` | 见 Pattern 1 — 用 `NotificationService.sendToRole(sales_manager, ...)` |
| §3 Track C `AttachmentService.upload / list` + `PhotoPicker` RN | `AttachmentService` 存在 ✅; `PhotoPicker` RN 组件**未 verify**, Day 4 自查 |

**Chat F 处理**: Day 1 错路 commit revert, Day 2 改 extend `SampleApprovedEventListener` 加 BOM 自动建 + 销售通知, 已 ship commit `65b201046`.

### Chat G (UX-A1 业务流程图导航)

| Brief 假设 | 实际 |
|---|---|
| §3 `FactoryHomeLayout` Sprint 1 Track A ship | ✅ 存在 `frontend/.../store/homeLayoutStore.ts` + `screens/factory-admin/home/HomeLayoutEditorScreen.tsx` (Track A 真 ship) |
| §3 `AIChat sessionId 多轮 (PR #651)` | **未 verify** — Chat G 自己 `gh pr view 651` 看是否 merged + sessionId 实际是否在 AIChatScreen |
| §3 5 角色 HomeScreen | **未 verify** 5 个 HomeScreen 是否都存在. brief 已含"降级方案": 共用 FAHomeScreen — 但 Chat G 起跑前应 grep `screens/sales/SalesHomeScreen.tsx` 等真实存在性 |

**风险**: Chat G 工时 10d → 加速 5-6d, Sprint 1 sessionId 依赖如果有 bug 会拖 Day 8

### Chat H (UX-A2 行末操作下拉)

| Brief 假设 | 实际 |
|---|---|
| §3 Sprint 1 Track C `canViewPriceStore` (RN + Vue) | ⛔ **未找到** `canViewPriceStore.ts` 在 frontend/store; 最近匹配是 `fieldVisibilityStore.ts` — Chat H 起跑前 grep 验证 |
| §3 Sprint 1 Track C `printService` | ⛔ 实际叫 `PdfExportService.ts` (`services/PdfExportService.ts`); brief 写的 `printService` 不存在 |
| §4 Day 1 "已有 BottomSheet 抽象? grep `BottomSheet`. 如有, 复用基础组件" | **未 verify**; Chat H 自己 grep `components/**/BottomSheet*.tsx` 决定复用 vs 新建 |
| §3 Sprint 1 Track A AIChat sessionId 多轮 | 同 Chat G 风险 — 自己 PR 验证 |
| §6 8 个 list screen (SalesOrderList / PurchaseOrderList / ProductionPlanList / InventoryList / ShipmentList / ReturnOrderList / TransferList / WastageList) | **未 verify** 这 8 个文件都存在; Chat H Day 4 接入前 glob `screens/**/*ListScreen.tsx` confirm |

### Chat I (UX-A3 Sticky Footer 实时合计)

| Brief 假设 | 实际 |
|---|---|
| §3 Sprint 1 Track C `canViewPriceStore.ts` | 同 Chat H Pattern 3 — 未找到该 store, 用 `fieldVisibilityStore.ts` 或自己实现 RBAC 过滤 |
| §3 Sprint 1 Track C `RBACService.java` | ⛔ grep `class RBACService` 0 hit; 实际 RBAC 在 `security/PriceSensitive` 注解 + 各 Controller `@RequirePermission` |
| §3 Sprint 1 Track C `exportService.ts` | ⛔ 不存在, 实际 `PdfExportService.ts` |
| §6 10 个 list screen + 10 个 list view | **未 verify** 全部存在; 起跑前 glob confirm |

### Chat J (P-FIN-1 采购财务审核+三价标红)

| Brief 假设 | 实际 |
|---|---|
| §3 ship 列表 `service/dingtalk/DingTalkBotService` "标红时通知财务" | 见 Pattern 1 — `NotificationService.sendToRole(...)` 注: `FactoryUserRole` enum 是否有 finance_manager / accounting Chat J 自己 grep `FactoryUserRole.java` confirm |
| §3 ship 列表 Sprint 1 Track C `RBACService.java` | 同 Chat I — 0 hit, 实际 `@RequirePermission` 注解 + `permissionResolver` |
| §3 ship 列表 `MaterialPriceComparisonDTO` (Sprint 1 ship) | ✅ 真存在 `dto/inventory/MaterialPriceComparisonDTO.java` (含 priceAlert: Boolean 字段) |
| §3 ship 列表 `MaterialPriceComparisonService.java` (Sprint 1 PR #660) | ⛔ grep `class MaterialPriceComparisonService` 0 hit; 但 PR #660 真的 fix 了三价, 服务可能命名不同; Chat J 自己 grep `MaterialPrice` 找真实 service |
| §3 别 chat ownership 写 "Chat J: `service/purchase/PurchaseOrderApprovalFlow.java`" | 暗示已存在, 但 Chat J §3.1 让 NEW; **实际**: 不存在, NEW 是对的 (但 brief 内部矛盾, 不致命) |
| §4 Day 1 Flyway V20260601_05 | OK 但跟 Chat F brief V20260601_03 + Chat E brief V20260601_01 + Chat F brief V20260601_04 撞号风险; 各 chat **强烈建议**起跑前 `ls backend/.../db/flyway/V202606*.sql` 看 main 最新, 自己挑非冲突号 |

---

## Flyway 版本号撞号风险 — 高优先级

`main` 当前最新 Flyway: `V20260516_07__work_process_intents.sql`

Sprint 2 各 chat brief 假设的 Flyway 号 (可能撞):
- Chat E: V20260601_01 / V20260601_02
- Chat F: V20260601_03 / V20260601_04 (已 revert, 实际 commit 用 V20260601_01 但已撤)
- Chat J: V20260601_05 / V20260601_06

**建议**:
- 每个 chat 起跑前 `ls backend/java/cretas-api/src/main/resources/db/flyway/ | sort | tail -5` 看真实最新
- 各 chat 挑明显非冲突号, 例如:
  - Chat E: V20260601_01..04 (按 Day 1 ship 顺序)
  - Chat F: V20260601_05..06 (本来用 V20260601_01 已 revert)
  - Chat G: 无 Flyway
  - Chat H: 无 Flyway (RN/Vue only)
  - Chat I: 无 Flyway
  - Chat J: V20260601_07..08

— 但 organizer 拍板更准 (各 chat 起跑时间不一致, 实际撞号取决于 push 顺序)。

---

## 通用 grep verify cheatsheet (各 chat 起跑前必跑)

```bash
# 1. Sprint 1 service 命名
Grep "class XxxService|interface XxxService" path=backend/java/cretas-api/src/main/java/com/cretas/aims output_mode=files_with_matches

# 2. RN component / store / screen 存在性
Glob "frontend/CretasFoodTrace/src/{screens,components,store}/**/Xxx*.{tsx,ts}"

# 3. Vue component / view 存在性
Glob "web-admin/src/{views,components,composables}/**/Xxx*.{vue,ts}"

# 4. Flyway 最新版本号
ls backend/java/cretas-api/src/main/resources/db/flyway/ | sort | tail -5

# 5. Spring Boot 跑通 (file syntax 真 verify, 不是 pipe artifact)
/c/tools/apache-maven-3.9.6/bin/mvn -q -o compile  # 不用 |tail (会吞 exit code)
echo EXIT=$?  # 必须 = 0

# 6. Tool name 全仓唯一 (per ai-intent-tool-skill-architecture.md)
Grep '"xxx_yyy_zzz"' path=backend/java/cretas-api/src/main/java
```

**注**: 之前 Chat F 用 `mvn ... 2>&1 | tail -60` exit 0 是 pipe artifact (`mvn: command not found` 但 tail exit 0). 真路径 `/c/tools/apache-maven-3.9.6/bin/mvn`. 此 lesson 也是 audit 顺手抓出, 加这里。

---

## 推荐行动 (按 chat)

| Chat | 起跑前 ~5min 必做 | 风险 |
|---|---|---|
| **E (N31)** | grep `BomExpansionService` etc 实际 in `service/orchestration/` 不是 `service/impl/`; 通知销售改用 `NotificationService` | 中 — 已撞过 |
| **F (N48)** | ✅ 已 audit + plan 修订 ship (commit `7652888db`) | 已处理 |
| **G (UX-A1)** | gh pr view 651 看 sessionId 是否真 ship; glob 5 HomeScreen | 中 |
| **H (UX-A2)** | grep `canViewPriceStore` / `fieldVisibilityStore` 实际 RBAC store; glob `BottomSheet*.tsx` 决定复用; rename `printService` → `PdfExportService` | 中 |
| **I (UX-A3)** | 同 H 的 RBAC store; rename `exportService` → `PdfExportService`; `RBACService.java` 替换为 `@RequirePermission` pattern | 中 |
| **J (P-FIN-1)** | grep `MaterialPriceComparison` 真实 service; grep `FactoryUserRole` 有没 finance_manager; 通知用 `NotificationService` | 中 — 跟 Chat F 同 Pattern 1 + 3 |

---

## Audit 自己的不确定 (worker 务必自己最后 verify)

我 Chat F 跑 audit 时没 verify 的项 (time-box 限制):
- Chat G HomeScreen 实际 5 角色都存在
- Chat H/I 各 8/10 list screen 实际存在
- AIChat sessionId 多轮 (PR #651) 真实 ship 状态
- `fieldVisibilityStore.ts` 是否真是 Track C RBAC ship (我看到名字但没读内容)
- `RawMaterialType.findByFactoryIdAndName` repo 方法 — 我 Chat F 自己绕开了 (用 stream filter), 但其他 chat 可能踩
- `FactoryUserRole` enum 完整角色列表 (我只 verified `sales_manager`)

**这些每个 chat 接 task 时自己 30s grep 即可 verify**, audit 不替代你 grep。

---

## Audit 复盘 (供 organizer 参考)

**为什么 Sprint 2 brief drift 这么多**:
1. Brief 写于 2026-05-15, 引用 Sprint 1 ship 内容; Sprint 1 6 个 track 实际 ship 的命名/位置可能跟 organizer 写 brief 时的 mental model 不一致 (Sprint 1 ship 顺序: A → B1 → B2 → C → D1 → D2 → 实际有 PR refactor 改了路径)
2. 命名约定不一致: 各 Sprint 1 track ship 时 service 放 `service/impl/` vs `service/{domain}/` 不统一 (E 的 4 个 service 在 `orchestration/` 是反例)
3. brief 内 ownership 表写 "别 chat 的 (绝对不准碰)" 列了 Chat J 的 PurchaseOrderApprovalFlow.java 暗示已存在, 但 Chat J §3.1 是 NEW — 内部矛盾

**未来 Sprint 3 brief 建议**:
1. Organizer 写 brief 时**先跑一遍** Sprint 2 ship 的 grep, 确认每个引用的 service/entity 实际命名/位置
2. brief §3 "Sprint X 已 ship 你强依赖" 必须含实际 file path + class 全名 + 关键 method signature
3. 写 brief 前先 `git log --since=$SPRINT_START main` 看实际 merged PR 数 + 实际 ship 内容, 不靠 mental model

---

**Audit 结束**. 各 chat 接到 task 起跑前 5 min 跑通用 cheatsheet, **不盲信 audit doc**, 自己 grep verify 关键依赖。
