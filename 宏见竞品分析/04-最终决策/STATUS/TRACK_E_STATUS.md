# Track E STATUS — Sprint 2 S-MRP-1 (销售订单 → 采购自动分流)

> Chat E = N31 worker. 工作分支: `feature/sprint2-track-e-n31-shortage`.

## Day 1 (2026-05-15)

- ✅ 读完 4 个现有 service (orchestration package): BomExpansionService / InventoryMatchingService / ProcurementSuggestionService / SupplyChainOrchestrator
- ✅ 起 worktree `C:\Users\Steve\my-prototype-logistics-sprint2-track-e` on `feature/sprint2-track-e-n31-shortage` from `main` (3cd574f69)
- ✅ Day 1 commit: ShortageAnalysisService 接口 + 3 DTO (ShortageReport / ProcurementSuggestion / ProductionPlanSuggestion)
- 明日计划 (Day 2): ServiceImpl + 监听 SalesOrderFinanceApprovedEvent 异步持久化 + Flyway V20260601_01 + REST endpoint

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
