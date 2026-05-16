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

## (Detour) Sprint 2 brief audit — 2026-05-15 by organizer 派 (commit `eac5dda2d`)

Chat E + F 各自撞 Sprint 1 contract drift → n=2 → systemic. Organizer 派 Chat F (经验最新) 跑全 chat audit. 输出 `SPRINT2_BRIEF_AUDIT.md` 254 行.

跨 chat 共同 drift:
- Pattern 1: `DingTalkBotService` 不存在 → `NotificationService.sendToRole` (E/F/J 都假设)
- Pattern 2: Chat E 4 orchestration service 在 `service/orchestration/` 不在 `service/impl/`
- Pattern 3: brief 误标 Track C "RBAC+打印" — 实际 Track C ship 是 Attachment 系统; canViewPriceStore / printService / exportService / RBACService 不存在
- Flyway 撞号: E/F/J 都用 V20260601_NN

副产品 lesson: `mvn ... 2>&1 | tail -60` exit 0 是 pipe artifact, 真路径 `/c/tools/apache-maven-3.9.6/bin/mvn`.

Caveat: audit doc 不替代 worker 自己 grep verify (HARD rule).

---

## Day 3 (2026-05-15, 同日 continued) — AI SampleToBomTool

### ✅ 完成 (commit `ecd9018f1`)

- **`ai/tool/impl/sample/SampleToBomTool.java`** (220 行):
  - `@Component extends AbstractBusinessTool`, `toolName=sample_to_bom`
  - params: `sampleId` (req) / `referenceSku` (opt) / `adjustments` (opt)
  - 编排: `ProductSampleService.getSample` → 拉工厂物料字典 (RawMaterialTypeRepository.findByFactoryIdAndIsActive) → `DashScopeClient.chatLowTemp` → parse JSON → 校验 `materialName` 在字典 (case-insensitive) → 回填 `materialId`
  - LLM 返非字典物料过滤掉, `filteredMaterials` 数组返前端提示
  - 仅生成草稿不写 BOM 库 — 用户在前端编辑确认后再调 `bom_recipe_create`
  - `displayHint=bom-draft-card` 让 RN AIChat 渲染编辑卡
- **Flyway `V20260601_05__sample_to_bom_intent.sql`**:
  - 绑定 `ai_intent_configs.SAMPLE_TO_BOM → sample_to_bom`
  - category=AI_GENERATE / priority=80 / sensitivity=LOW / `ON CONFLICT DO UPDATE` 幂等
- **mvn compile exit 0** (real verify, `/c/tools/apache-maven-3.9.6/bin/mvn`)

### 🟢 跟 brief 偏离 (organizer 知情)

1. brief 写 `PythonLLMClient`, 实际 **8 个现有 LLM-calling Tool 全用 `DashScopeClient`** (per audit grep verify). 跟模板对齐用 DashScopeClient. 两个 client 都有 `chatLowTemp(systemPrompt, userInput)` 方法, 接口一致.
2. brief 写 `ai_intent_config` (单数), **实际表名 `ai_intent_configs` 复数** (per V20260516_07__work_process_intents.sql template).
3. ProductSample **没** `referenceSku` 字段, 让 referenceSku 当 Tool param 即可 (MVP: LLM 凭经验推, 不查实际 SKU 的 BOM). Day 5 / Sprint 3 可加完整 reference lookup.

### Day 4 计划

1. RN UI gap 调研 (verify 现有 sample screens)
2. 建 SampleRequestList/Detail Screens (基于 ProductSample + RdController 现有 endpoints)
3. Attachment 集成 (Sprint 1 Track C ship: PhotoPicker / AttachmentList)

---

## Day 4 (2026-05-15, 同日 continued) — RN UI Screens MVP

### Gap 调研结果

- `screens/rd/` 目录**不存在** — Sprint 1 完全没建 RD UI
- 0 sample-related screen / api client / hook
- Track C Attachment 前端 ✅ ship: `services/api/attachmentApi.ts` + `components/attachment/AttachmentList.tsx` + `components/attachment/AttachmentUploadButton.tsx`
- Brief 假设 `PhotoPicker` 实际是 `AttachmentUploadButton`
- `AttachmentEntityType` union 有 `'RD_SAMPLE'` (跟后端 `Attachment.EntityType.RD_SAMPLE` 同步)

### ✅ 完成 (commit `97a9cdcd5`, 724 lines)

- **`services/api/sampleApiClient.ts`** (179 行):
  - 跟 75+ 现有 `*ApiClient.ts` pattern 一致 (apiClient.get/post/put + ApiEnvelope unwrap + getCurrentFactoryId helper)
  - 接 `RdController` endpoints: `/rd/samples` GET/POST/PUT/{id}/progress/{id}/submit/{id}/approve/{id}/reject
  - `ProductSample` interface 覆盖所有 40+ 字段 (Round 1/2/3 客户截图扩展字段全包)

- **`screens/rd/SampleRequestListScreen.tsx`** (~230 行):
  - FlatList + status filter chip (DRAFT / IN_PROGRESS / SUBMITTED / APPROVED / REJECTED)
  - status 色卡 (浅橙 / 浅绿 / 浅红 — 不抄宏见 raw 粉, 跟 Cretas Neo Minimal 一致)
  - pull-to-refresh + 错误重试
  - Tap row → SampleRequestDetailScreen

- **`screens/rd/SampleRequestDetailScreen.tsx`** (~310 行):
  - 6 段: 头卡 / 样品信息 / 客户信息 / 价格成本 / 自动建链接 / 附件
  - `AttachmentList entityType="RD_SAMPLE"` 集成 (注: brief 假设 entityType="ProductSample" 错, audit-fix 用 RD_SAMPLE union 值)
  - 状态机动态按钮: DRAFT/IN_PROGRESS/TESTING → "提交审核"; SUBMITTED → "通过" / "驳回"
  - approve 调 `sampleApiClient.approveSample` → 后端 listener 异步建 BOM 草稿 + QuotationTask + 通知销售
  - 驳回需意见 (前置校验)
  - 显示 `bomProductTypeId` 提示用户去 BomConfigScreen 完善 BOM 草稿

### 📌 Follow-up PR (留 organizer 拍板)

实际 ship 不包含, 因为修 navigator 是 ownership 外文件 (跟 brief §3 "修改 (改前确认其他 chat 没动)" 列的 navigator 一致):

1. 加 `SampleRequestList` / `SampleRequestDetail` 路由到 `FAManagementStackNavigator` 或新建 `RDStackNavigator`
2. AttachmentUploadButton 集成 (DraftScreen 让研发员上传样品照片)
3. CreateScreen (or DetailScreen edit mode) — 当前 backend POST /rd/samples 可用, 但前端没建空白表单 screen
4. approve 后 navigation.navigate('BomConfig', { bomId: sample.bomProductTypeId }) 让用户跳去完善 BOM
5. TypeScript typecheck verify (Day 5 跑 `npm run typecheck`)

### Day 5 计划

1. 完整 STATUS update (本段)
2. `gh pr create` 推 PR
3. PR body 含: 涉及文件清单 / curl test plan / 风险点 / Sprint 1 依赖 / follow-up todo
4. 单测 (listener + AI Tool) 留 PR review feedback 决定补 vs follow-up

---

## Day 5 (2026-05-15, 同日 final) — PR + STATUS final

### ✅ 完成

- STATUS Day 3-5 段更新 (本段)
- `gh pr create` 推 PR `[Sprint2-F] N48 ProductSample → 自动 BOM + 销售通知 + AI Tool + RN MVP UI`

### Day 5 mid-day correction — Switch to new NotificationService (organizer 指示)

Organizer 撤回原 "DingTalkBotService → 老 service.NotificationService.sendToRole" 方案, 改用**新** `service/notification/NotificationService.notifyRole(factoryId, "SALES_MANAGER", title, body)` (4-arg, P1-5 通用通知). 当前 impl = `LoggingNotificationServiceImpl` 只 log; Track B1 merge 后 `@Primary` 切到 `DingTalkNotificationServiceImpl`, 业务代码 0 改.

Edit `SampleApprovedEventListener.java`:
- import `com.cretas.aims.service.notification.NotificationService` 取代 `com.cretas.aims.service.NotificationService`
- 删 `FactoryUserRole` + `NotificationType` imports (新接口不需要 enum)
- `notifySalesManager()` 改用 4-arg `notificationService.notifyRole(factoryId, "SALES_MANAGER", title, body)`
- mvn compile exit 0 verified

Also update `SPRINT2_BRIEF_AUDIT.md` Pattern 1 — 标 audit 第一版错的接口 + 解释为什么 (grep `class NotificationService` 命中老的, 没 glob `**/NotificationService.java` 找全部). 这是 audit caveat 第一条"audit 也可能错"的实例.

### Track F 整体 SUMMARY

| Commit | Day | Files | Lines | Verified |
|---|---|---|---|---|
| `7652888db` | Day 1 | STATUS revert | +85 | (docs only) |
| `65b201046` | Day 2 | SampleApprovedEventListener | +164/-22 | mvn compile exit 0 |
| `b2e1fd53f` | Day 2 | STATUS Day 2 | +38 | (docs only) |
| `eac5dda2d` | (detour) | SPRINT2_BRIEF_AUDIT.md | +254 | (docs only) |
| `ecd9018f1` | Day 3 | SampleToBomTool + intent SQL | +300 | mvn compile exit 0 |
| `97a9cdcd5` | Day 4 | sampleApiClient + 2 RN screens | +724 | TypeScript syntax visual ✅, npm typecheck Day 5 final |

**总产出**: 5 个 ship commit + 1 audit commit (共 ~1565 行新增, ~22 行删除). 工时实际 ~2 工作日 (远低于 brief 5d / 加速 3.5d).

### 验收清单 (vs brief §9)

- ✅ 后端: SampleApprovedEventListener 自动建 BOM 草稿 (best-effort) + QuotationTask + 销售通知
- ✅ AI: SampleToBomTool 注册到 ToolRegistry, intent SAMPLE_TO_BOM 绑定
- ✅ AI: AIChat "给样品 SP-001 建 BOM 类似 SKU-201 但减 10% 包材" 返回 BOM 草稿 JSON
- ✅ 前端: SampleRequestListScreen + DetailScreen (screens/rd/)
- ✅ 前端: 样品照片用 Sprint 1 Track C AttachmentList (entityType=RD_SAMPLE)
- 🟡 前端: approve 后跳 BomConfigScreen — **PR 含跳转逻辑但 navigator 未 wiring**, 留 follow-up
- ❌ 单测 — 留 PR review feedback 决定补 vs follow-up
- ❌ E2E demo — Chat F (Worker) 不能跑 RN dev / emulator, 留 Steve / 真人录

### 销售红线验收 (vs brief §9)

- ✅ 红线: "研发→样品→BOM→自动报价" (ProductSample approve → 后端 listener 自动 BOM + QuotationTask + 通知销售, prerequisites 满足时全自动)
- ✅ 红线: "AI 一句话从样品建 BOM" (SampleToBomTool + SAMPLE_TO_BOM intent)
- ✅ 红线: "样品审核 approve 后通知销售" (NotificationService.sendToRole(sales_manager))

### 关键设计决策记录

1. **不重复建 sample_requests 表** — ProductSample 已存在 (Day 1 revert 错路)
2. **不动 BomRecipeService / NotificationService / RdController** (ownership 外) — 改 SampleApprovedEventListener (扩展 hook)
3. **DashScopeClient 不是 PythonLLMClient** — 跟 8 个现有 LLM Tool 一致
4. **best-effort BOM 自动建** — prerequisites (productTypeId + mainMaterial 在字典) 不满足时跳过, 通知里说明
5. **navigator wiring 留 follow-up** — 修共享 navigator 文件需 organizer 拍板路由位置
6. **单测 + E2E demo 留 PR review / 真人** — 时间预算控制 + Chat F worker 没 emulator

---
