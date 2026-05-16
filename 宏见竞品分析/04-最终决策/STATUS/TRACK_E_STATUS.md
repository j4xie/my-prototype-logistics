# Track E STATUS — Sprint 2 S-MRP-1 (销售订单 → 采购自动分流)

> Chat E = N31 worker. 工作分支: `feature/sprint2-track-e-n31-shortage`.

## Day 1 (2026-05-15)

- ✅ 读完 4 个现有 service (orchestration package): BomExpansionService / InventoryMatchingService / ProcurementSuggestionService / SupplyChainOrchestrator
- ✅ 起 worktree `C:\Users\Steve\my-prototype-logistics-sprint2-track-e` on `feature/sprint2-track-e-n31-shortage` from `main` (3cd574f69)
- ✅ Day 1 commit: ShortageAnalysisService 接口 + 3 DTO (ShortageReport / ProcurementSuggestion / ProductionPlanSuggestion)
- 明日计划 (Day 2): ServiceImpl + 监听 SalesOrderFinanceApprovedEvent 异步持久化 + Flyway V20260601_01 + REST endpoint

## Day 2 (2026-05-15) — organizer 拍板 ①②③④B 后

- ✅ Flyway `V20260601_01__sales_order_shortage_report.sql` — `sales_order_shortage_report` 表 (id VARCHAR(36) + 5 列 JSONB + analysis_summary + soft-delete; idx 2 个)
- ✅ Entity `SalesOrderShortageReport` + Repository `findByFactoryIdAndSalesOrderId`
- ✅ `ShortageAnalysisServiceImpl` — read-only 编排 4 service, 多 SKU 共用原料聚合 (LinkedHashMap), Day 2 MVP supplier/三价/工序链 留空 (Day 3 接入)
- ✅ `NotificationPort` SPI + `NoOpNotificationPort` (`@ConditionalOnMissingBean`) — Track B1 钉钉 PoC merge 后注册 Adapter 即可
- ✅ `SalesOrderShortageReportListener` — `@Async @EventListener @Transactional(REQUIRES_NEW)` on `SalesOrderFinanceApprovedEvent`, 失败时写 FAILED 占位行
- ✅ `SalesOrderShortageController` — `GET /api/mobile/{factoryId}/sales/orders/{orderId}/shortage-report` (NOT_AVAILABLE 占位响应)
- ✅ 单测 `ShortageAnalysisServiceImplTest` — 3 用例: 充足 / FG缺料原料够 / 多 SKU 共用原料聚合
- 🟡 待 push 前: mvn compile 本地校验 (CI 是 ground truth)
- 明日计划 (Day 3): ShortageAnalysisTool (AI Tool) + intent SHORTAGE_ANALYSIS Flyway V20260601_02 + RN ShortageChainCard + SalesOrderShortageReviewScreen

### Day 2 Commit 范围

```
backend/java/cretas-api/src/main/resources/db/flyway/V20260601_01__sales_order_shortage_report.sql
backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrderShortageReport.java
backend/java/cretas-api/src/main/java/com/cretas/aims/repository/inventory/SalesOrderShortageReportRepository.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/NotificationPort.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/impl/NoOpNotificationPort.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/impl/ShortageAnalysisServiceImpl.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/SalesOrderShortageReportListener.java
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/inventory/SalesOrderShortageController.java
backend/java/cretas-api/src/test/java/com/cretas/aims/service/shortage/ShortageAnalysisServiceImplTest.java
```

### Day 2 设计要点 (跟前面偏差一致)

- **复用 event**: listener 监听 `SalesOrderFinanceApprovedEvent`, **不动 SalesController** (event 已由 `SalesServiceImpl.financeApproveOrder` line 366 publish)
- **read-only**: `analyzeForSalesOrder` 只调 `checkAvailability` + `expandBOM` + `checkMaterialAvailability`, 不调 `reserveStock` / `generateSuggestions` / 不创建 PP — 副作用仍由现有 `SupplyChainOrchestrator.onSalesOrderFinanceApproved` 负责
- **聚合**: 多 SKU 共用原料 (e.g. 都用面粉) 在 BOM 检查前合并 (`LinkedHashMap` keyed by materialTypeId), 避免 `checkMaterialAvailability` 产出重复 shortfall
- **JSONB 列 5 个**: total_required (BOM 需求聚合) / available (FG 行项目匹配) / shortage (BOM 短缺) / procurement_suggestions / production_suggestions; 跟 brief §2 略不同但 superset
- **Async**: `@Async + @EventListener + REQUIRES_NEW` 标配 (跟 `SupplyChainOrchestrator.onSalesOrderFinanceApproved` 同 pattern); `AsyncConfig` 已存在 main

## Day 3 (2026-05-15) — AI Tool + intent + RN chain-card

- ✅ `ai/tool/impl/shortage/ShortageAnalysisTool.java` — extends `AbstractBusinessTool`, `@Lazy ShortageAnalysisService`, `getToolName()=shortage_analyze` (auto-derive ActionType=ANALYZE / RiskLevel=LOW)
- ✅ Flyway `V20260601_02__shortage_intent.sql` — intent `SHORTAGE_ANALYSIS` → tool `shortage_analyze`, 10 keywords (缺料/缺什么/库存够吗/...), DATA_QUERY category, priority 80, sensitivity LOW
- ✅ `salesApiClient.ts` 扩展 — 9 个 ShortageReport 相关 type + `getShortageReport(orderId)` 方法
- ✅ `components/chain/ShortageChainCard.tsx` — 3 段 react-native-paper Card (摘要 / 缺料采购 / 生产建议), 3 个 callback props (`onConfirmProcurement` / `onConfirmProduction` / `onDingTalkPush` 留待 Day 4)
- ✅ `screens/factory-admin/inventory/SalesOrderShortageReviewScreen.tsx` — useRoute<RouteProp<...>> 类型化, 处理 4 状态 (loading/NOT_AVAILABLE/PENDING/FAILED/COMPLETED), 并行 fetch report+order
- ✅ `types/navigation.ts` — `FAManagementStackParamList.SalesOrderShortageReview: { orderId: string }` (Day 4 接入 navigator)
- 🟡 Brief 偏差: brief 建议 `screens/sales/`, 实际 main 用 `screens/factory-admin/inventory/` — 跟 SalesOrderDetailScreen 同目录
- 明日计划 (Day 4): 接入 navigator (3 处: FAManagementStackNavigator + SalesManagerNavigator + ViewerNavigator) + 一键采购/生产跳转预填 + DingTalk port adapter 设计 + PR

### Day 3 验证

- `mvn -DskipTests test-compile`: **exit 0** (clean, 新 Tool 编译过)
- `npm run typecheck`: 68 errors **全部为 main 既有 baseline 噪声** (expo/tsconfig.base 缺 + tsconfig 没启 ES2015 lib), 过滤后我新增文件 (shortage/chain) **0 错** — 跟 main 同噪声基线, 无 regression

### Day 3 Commit 范围

```
backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/shortage/ShortageAnalysisTool.java
backend/java/cretas-api/src/main/resources/db/flyway/V20260601_02__shortage_intent.sql
frontend/CretasFoodTrace/src/services/api/salesApiClient.ts            (modify)
frontend/CretasFoodTrace/src/types/navigation.ts                       (modify, +1 route)
frontend/CretasFoodTrace/src/components/chain/ShortageChainCard.tsx
frontend/CretasFoodTrace/src/screens/factory-admin/inventory/SalesOrderShortageReviewScreen.tsx
宏见竞品分析/04-最终决策/STATUS/TRACK_E_STATUS.md                       (modify)
```

### 与 Brief 的偏差 (需 organizer 知会)

1. **Controller 名称**: brief 提的 `SalesOrderController.java` 不存在; 实际是 `controller/inventory/SalesController.java`, base path `/api/mobile/{factoryId}/sales/orders`。审批 endpoint 是 **3 段制**: `confirmOrder` (DRAFT→CONFIRMED) → `submitForFinanceReview` (CONFIRMED→PENDING_FINANCE_REVIEW) → `financeApproveOrder` (PENDING_FINANCE_REVIEW→FINANCE_APPROVED)。后者是真正的供应链触发点。

2. **Event 复用 (不创建新 event)**: brief 让我新建 `SalesOrderApprovedEvent`; 但 main 已有 `SalesOrderFinanceApprovedEvent` (event/SalesOrderFinanceApprovedEvent.java) **+ 已在** `SalesServiceImpl.java:366` **publish** **+ 已被** `SupplyChainOrchestrator.onSalesOrderFinanceApproved` **消费** (PP 自动创建 + BOM 展开 + 采购建议 generateSuggestions 全部已落地)。新建 event 会重复触发 / 风险拆分。我决定复用现有 event, **Day 2 新加一个 `@Async` Listener** 仅做"写报告表"+ 后续 Day 4 钉钉推送 (orchestration 副作用不重复)。

3. **Side-effect 已就位**: `SupplyChainOrchestrator.onSalesOrderFinanceApproved` 已经做了 brief Day 2 §2.4 描述的全部副作用 (创建 PP + BOM 展开 + 采购建议落库)。我的 `ShortageAnalysisService` 改为 **read-only snapshot** — 仅查询返回 DTO 给 AIChat / RN, 不写库不发 event, 持久化由 Day 2 新 listener 负责。这样:
   - 单元测试干净 (无副作用)
   - AIChat Tool 可以反复调用查询 (幂等)
   - 现有正向链不被破坏

4. **Package 路径**: brief 写 `service/shortage/dto/`, 我遵照 brief 放在 `service/shortage/dto/` (非项目典型 `dto/<domain>/`); 若 organizer 要求挪到 `dto/shortage/` 易改。

### Day 4 风险

- ❌ **DingTalkBotService 不在 main** (brief 说 Sprint 1 Track B1 未 merge, 跟 grep 一致)。Day 4 钉钉集成将改为:
  - A) 接口预留 (依赖注入 `@Lazy Optional<DingTalkBotService>`, Track B1 ship 后自动激活)
  - B) Demo 用截图 mock
  - 选 A — 倾向于完成接线不阻塞 ship。需 organizer 确认 Track B1 ETA 是否影响 Sprint 2 deadline。

### Day 1 Commit 范围

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/ShortageAnalysisService.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/dto/ShortageReport.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/dto/ProcurementSuggestion.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/shortage/dto/ProductionPlanSuggestion.java
宏见竞品分析/04-最终决策/STATUS/TRACK_E_STATUS.md
```
