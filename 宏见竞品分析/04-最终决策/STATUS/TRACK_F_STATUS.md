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
