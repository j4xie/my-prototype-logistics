# TRACK F STATUS — Sprint 2 / S-RD-1 / N48 研发样品 → BOM → 报价

> **Worker**: Chat F | **Brief**: `TRACK_F_BRIEF.md` | **Branch**: `feature/sprint2-track-f-n48-sample`
> **Start**: 2026-05-15 | **Target**: ~2.5-3 工作日 (revised, 远低于 brief 5d / 加速 3.5d)

---

## Day 1 (2026-05-15) — 错路重启 + 计划修订

### ⛔ 错路 (commit `8b8313b6b`, 已 force-push 删除)

按 brief §2 "工厂端无样品管理 — 从 0 建" 假设建了:
- `V20260601_01__sample_request.sql`
- `entity/sample/SampleRequest.java` + Repository + Service interface + 3 DTOs
- 8 files commit `8b8313b6b` push 到 origin

**Day 2 起跑前 grep `Sample` in `entity/rd/` 发现整套已存在** (HARD rule `feedback_organizer_projection_bug.md` 起作用):

| Brief 假设 | 实际 (2026-05-15 grep verified) |
|---|---|
| "工厂端无样品管理 — 从 0 建" | **ProductSample 全栈已存在** |
| - | `entity/rd/ProductSample.java` 含 40+ 字段 (含 customer_expected_price / product_quote_price / material_price / main_material_yield_rate / sample_version / selling_points / customer_latest_requirement / 等 brief 没列的字段) |
| - | `service/rd/ProductSampleService` + impl 含 11 方法 (createRequest/createSample/updateProgress/submitForApproval/approveSample/rejectSample/listSamples/getSample/getQuotationBySample/submitQuotation/confirmQuotation) |
| - | `controller/rd/RdController.java` 暴露 12+ endpoints under `/api/mobile/{factoryId}/rd/*` (含 `samples` GET/POST/PUT/{id}/submit/{id}/approve/{id}/reject) |
| - | `event/SampleApprovedEvent` + `SampleApprovedEventListener` 已 wired, approve 自动 publish event → listener 自动建 QuotationTask |
| - | `repository/rd/ProductSampleTrackingRecordRepository` 独立 tracking table (P1-8 已 ship) |

我建的 `sample_requests` 表跟 `product_samples` 平行重复, schema 双写, 完全冗余, 违反 brief §10 "v3 销售红线" 反 pattern.

### ✅ Day 1 修复

1. `git reset --hard HEAD~1` + `git push --force-with-lease` → commit `8b8313b6b` 已删, branch 回到 `3cd574f69` (main)
2. **Brief 派发方 (Steve as Organizer)** 决策: A) revert Day 1, extend ProductSample
3. STATUS Day 1 段重写 (本段)

### 🟢 实际 Track F gap (vs brief 客户期望, §10)

| 客户期望 | ProductSample 现状 | Gap → Track F 工作 |
|---|---|---|
| 研发员低成本建样品 | ✅ RdController POST /rd/samples 已 ship | (无) |
| 审核 approve 后自动 BOM | ❌ Listener 注释 "BOM需人工建立" | **Day 2 加 BOM 自动建** (调 BomRecipeService.createRecipe + sourceType=SAMPLE_AUTOGEN) |
| 报价任务自动推送销售 | ✅ Listener 自动建 QuotationTask | (无) |
| 钉钉群通知销售 | ❌ Listener 没调 NotificationService | **Day 2 加 NotificationService.sendToRole(sales_manager, INFO, ...)** |
| AI 协助建 BOM | ❌ 未实现 | **Day 3 加 SampleToBomTool** (基于 ProductSample) |
| RN UI 研发员屏幕 | ⚠️ 待 Day 4 调研 | **Day 4 调研 + 建/extend** |

### Revised 工时估算

| Day | 工作 | 估时 |
|---|---|---|
| Day 1 (今日) | Revert + 调研 + STATUS + extend listener 起步 | 0.3d |
| Day 2 | SampleApprovedEventListener extend (BOM + 通知) + 测试 | 0.5d |
| Day 3 | AI SampleToBomTool + intent 注册 | 1d |
| Day 4 | RN UI gap 调研 + 建/extend | 1-1.5d |
| Day 5 | E2E + Demo + PR | 0.5d |
| **合计** | | **~2.5-3 工作日** (brief 名义 5d / 加速 3.5d) |

### ❌ Blocker

无.

### 📋 PR 方向 (修订)

PR 标题改成: `[Sprint2-F] 在 ProductSample 上加 自动 BOM + 销售通知 + AI Tool + RN UI` (而非 brief 写的 "研发样品→BOM→报价" — 因为大部分已 ship, 我们只补 gap)

### 明日计划 (Day 2)

1. 读 `SampleApprovedEventListener` + `BomRecipeService.createRecipe` 完整源 + `CreateBomRecipeRequest` 字段映射
2. 在 listener 加:
   - 校验 ProductSample.productTypeId 非空 (BOM 需要)
   - 校验 ProductSample.mainMaterial 非空 (用作 placeholder item.materialTypeId)
   - 调 `BomRecipeService.createRecipe(factoryId, req)` 建 DRAFT BOM:
     - `sourceType=SAMPLE_AUTOGEN`
     - `sourceSampleId=sample.id`
     - `productTypeId=sample.productTypeId`
     - `productName=sample.name`
     - `outputQuantityPerUnit=100` (默认 100g/份)
     - `outputUnit="g"`
     - `items=[1 个 placeholder from sample.mainMaterial]` (用户后续在 BomConfigScreen 完善)
   - 写回 `sample.bomProductTypeId = recipe.id` + save sample
   - 调 `NotificationService.sendToRole(factoryId, sales_manager, "样品审核通过", "样品 {sampleCode} 已审核通过, BOM 草稿已生成 (BOM-...), 报价任务 {taskNumber} 等待报价员处理", NotificationType.INFO, "RD", sample.id)`
3. 单测: mock BomRecipeService + NotificationService, verify call sequence + 参数正确
4. mvn compile / 启动 verify

---

## Day 2 (2026-05-15, 同日 continued) — SampleApprovedEventListener extended

### ✅ 完成 (commit `65b201046`)

- **重写 `event/listener/SampleApprovedEventListener.java`** — 从 ~60 行 → ~200 行, 加 BOM 自动建 + 销售通知, 拆 3 个 private helper:
  - `createQuotationTask` — 原逻辑保留, 兼容
  - `autoCreateBomDraft` — Best-effort, 失败 / 缺数据时返 null (不阻塞通知)
  - `notifySalesManager` — `NotificationService.sendToRole(sales_manager, INFO, "RD", sampleId)`
- **BOM 自动建 prerequisites 校验** (按顺序短路):
  1. `sample.productTypeId` 非空 → 否则 log warn 跳过
  2. `sample.mainMaterial` 非空 → 否则 log warn 跳过
  3. `mainMaterial` 在 `raw_material_types` 字典 case-insensitive 找到 → 否则 log warn 跳过
- **不改 RawMaterialTypeRepository** (ownership 外) — 用 `findByFactoryId(factoryId).stream().filter(...)` 过滤 name. 字典通常 < 500, 性能 OK
- **写回 `sample.bomProductTypeId = recipe.id`** 让前端 detail screen approve 后跳 BomConfigScreen
- **错误隔离**: BOM 失败不阻塞通知; 通知失败不阻塞主流程 — QuotationTask 已建可继续业务
- **mvn compile exit 0** real verified (注: Day 1 之前用 `mvn ... | tail` exit 0 是 pipe artifact, mvn 实际 `command not found`; 已改用 `/c/tools/apache-maven-3.9.6/bin/mvn` full path)

### 🟡 进行中 / 待 Day 3 早上做

- **单测** `SampleApprovedEventListenerTest`:
  - mock 5 deps (ProductSampleRepo / QuotationTaskRepo / BomRecipeService / RawMaterialTypeRepo / NotificationService)
  - case 1: prerequisites OK → 验证 BomRecipeService.createRecipe + NotificationService.sendToRole 都被调
  - case 2: productTypeId 空 → 跳 BOM, 仍 notify
  - case 3: mainMaterial 字典缺 → 跳 BOM, 仍 notify
  - case 4: NotificationService 抛异常 → 不影响 QuotationTask / BOM 持久化

### Day 3 计划 (明日早上)

1. 写 Day 2 单测 (~30 min)
2. **AI SampleToBomTool** (per `.claude/rules/ai-intent-tool-skill-architecture.md`):
   - `ai/tool/impl/sample/SampleToBomTool.java` extends `AbstractBusinessTool`
   - toolName: `sample_to_bom`, params: `sampleId` (req) / `referenceSku` (opt) / `adjustments` (opt)
   - 调 `PythonLLMClient` 生成 BOM draft JSON, 校验 materialId 在 `raw_material_types` 字典
   - Flyway `V20260601_01__sample_to_bom_intent.sql` 绑定 `SAMPLE_TO_BOM` intent
   - 单测 mock LLM 验证 prompt 含 sample 信息 + 非法 materialId 过滤

---
