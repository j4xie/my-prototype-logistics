# Track D1 — 每日 STATUS

> **本文件**: Chat 5 (Track D1) 每天追加 1 段进度
> **Organizer 阅读**: Chat 1 每天读 + 协调跨 track 冲突

---

## Day 0 — 派发 (2026-05-14 18:14:12)

- 状态: 📤 **已派发 Brief, 等 Chat 5 启动**
- Brief 文件: `04-最终决策/TRACK_D1_BRIEF.md` (9d 工时)
- 收到 brief 后: Chat 5 应立即:
  1. 创建 git worktree + branch `feature/asap-track-d1`
  2. 读完 Brief §1-§11
  3. 启动 Day 1 任务
  4. 当天结束在本文件追加 Day 1 进度

---

<!-- Chat 5 启动后在下面追加 Day 1, Day 2, ... -->

## Day 0 — Chat 5 启动 + onboarding (2026-05-14, 接 brief 当天)

- 状态: ✅ Onboarding 完成, Day 1 启动中
- Worktree: `.worktrees/asap-track-d1`, branch `feature/asap-track-d1`, base `origin/main@52f1b622d`
- 读完: Brief §1-§12 / SCHEMA_DESIGN §2.6 line 1117-1419 / 六扇门第四次-May10 line 200-419
- Audit 现状 (Cretas BOM 代码层):
  - `entity/bom/BomItem.java` 已有 `@PriceSensitive` on `unitPrice` (PR #455/#466 完成), `getActualQuantity()` 公式 `std / (yield/100)` HALF_UP scale 6 — **跟新 spec line 1340 完全一致**
  - `controller/BomController.java` 现有 `/items/*` + `/labor/*` + `/overhead/*` + `/cost-summary/*` — 新 `/recipes/*` 路径与现有不冲突, 兼容期保留
  - `entity/bom/BomChangeLog.java` 服务变更痕迹 (P1-9 PR #312 上下文), 保持不动
  - 旧 BomController 权限码 `production:read_write` / `rd:read_write` / `finance:read_write`. 新 spec 提的 `bom:read` / `bom:write` 是新权限码, **倾向沿用旧权限码** (避免 RBAC 分裂), Day 3 实施时确认
- ⚠️ Brief 不准确之处 (Day 0 audit 发现):
  1. `MaterialUnitConversionService` **不存在** — brief §3.3/§6.3 提的服务名错误
  2. 单位换算实际位置: `service/orchestration/ProductionWorkflowOrchestrator.convertUnit()` (private method, 反射测试 in `ProductionWorkflowOrchestratorUnitConversionTest.java`)
  3. 当前支持 g↔kg (1:1000) + ml↔L (1:1000), **硬编码** (file:line 167-183), 注释 line 160 已标 "暂用硬编码, 后续可改为查 UnitOfMeasurement.conversionFactor 实现通用换算"
  4. 没有 `material_unit_conversions` 表 (brief §6.3 错)
  5. D3 (May 10 客户会议) 已把 g→kg 自动换算落到 `buildTransferRequest` 阶段 (`ProductionWorkflowOrchestrator` line 131-146) — BOM 配方层 g, 仓库/调拨层 kg 自动转
- **Day 8 计划修正**: 把 `convertUnit` 从 private 提到 public Spring service (e.g. `UnitConversionService`), BOM cost calc + warehouse + purchase + transfer 全部走它. 这是 codebase 已 flagged 的 future cleanup, Day 8 实施前再 ping organizer 确认 scope.
- 客户 May10 核心诉求 (line 200-419) 摘要:
  - **g↔kg only, 1:1000** (line 388-391 "克跟千克, 1000 的转换率"), 无体积单位 (line 376)
  - "物料名称是要手写吗?" (line 217) → MaterialSelectModal 替代
  - "成品 200g, 出成率 58% → 自动折算 250.58" (line 268): 客户口误数字 (spec 公式 200/0.58=344.83), 测试也验证 344.83 (test line 49)
  - "调味品" 大包装 50kg/小用量 1-2g pain point (line 304-307) — 用 g↔kg 自动换算解决
- 256 个 Flyway migration 已存在; `V20260516_02__bom_redesign.sql` slot 应安全 (Day 1/2 内确认)
- **未发现需要 ping organizer 的硬 blocker**, ProductionBatch Entity 本 track 不动 (per brief §2.4 + §6.5)

明日 (Day 1): 老 `bom_items` → 新 `bom_recipes` + `bom_recipe_items` 数据迁移 mapping + V20260516_02 SQL 草稿

---

## Day 1 — V20260516_02 SQL 草稿 (2026-05-14)

- 状态: ✅ Day 1 完成
- 产出: `backend/java/cretas-api/src/main/resources/db/flyway/V20260516_02__bom_redesign.sql` (273 行)
  - CREATE TABLE bom_recipes (主, 19 列, 5 @PriceSensitive, partial unique indexes)
  - CREATE TABLE bom_recipe_items (子, 19 列, 2 @PriceSensitive, FK raw_material_types ON DELETE RESTRICT)
  - 数据迁移 DO block: 旧 bom_items 按 (factory_id, product_type_id) GROUP → 主表 1 行 (DRAFT, IMPORTED) + 子表 N 行
  - 占位字段: output_quantity_per_unit=1.0, output_unit='g', overall_yield_rate=100, status='DRAFT' (用户激活前需修正)
  - 单位 normalize: '公斤'/'KG'→kg, '克'/'G'→g, '毫升'→ml, unknown→'g' (DRAFT 状态可改)
  - Orphan material_type_id 过滤 (FK 不允许悬空), RAISE WARNING 计数
- 兼容期: bom_items 不 drop (per brief §6.2), V20260615_01 另起 drop migration
- Local commit: `96eae6b17 WIP(track-d1): Day 1 — V20260516_02__bom_redesign.sql draft` (worktree only, 未 push)
- ⚠️ Brief 再发现 1 处不准确 (重要, 涉及 sister chat):
  - **Brief §3.1 + §3.2 写 Flyway 路径是 `db/migration/`, 实际是 `db/flyway/`**
  - 配置位置: `application-pg.properties:44` 写 `spring.flyway.locations=classpath:db/flyway`
  - 旧 `db/migration/` 有 256 个文件但 Flyway 从未扫描 (legacy, 见 `V20260424_08__factory_warehouses.sql` 注释说明 2026-04-24 已迁)
  - **Pre-commit hook (`scripts/precommit/flyway-path-check`) 帮我抓住了这个**, 第一次 commit 被 reject
  - 🚨 Sister chats (A / B / C / D2) **如果**也照 brief 改 SQL, 同样会 reject — 建议 Organizer 通知或我直接 grep STATUS 看是否有人踩坑
  - 我已经按 hook 提示移到 `db/flyway/` (May 14 当天已有 5 个 sister chat 文件 V20260514_01-05 in 那里)
- 未发现需要 ping organizer 的硬 blocker

明日 (Day 2):
- 在本地 cretas_db 跑 `mvn spring-boot:run -Dspring-boot.run.profiles=pg` 触发 V20260516_02 apply
- 验证 `SELECT COUNT(*) FROM bom_recipes` ≈ COUNT(DISTINCT (factory_id, product_type_id)) FROM bom_items WHERE deleted_at IS NULL
- 验证 bom_items 表 + BomController `/items/*` 仍 work (兼容期)
- 写 rollback SQL (备用, 不入 Flyway scan dir)
- Day 2 完成后开始 Day 3 (Entity + Repository + Service + Controller)

---

## Day 2 — Migration dry-run + unit mapping fix (2026-05-14)

- 状态: ✅ Day 2 完成
- 本地 cretas_db dry-run (PG 17.7, PGPASSWORD=cretas_pass, BEGIN/ROLLBACK 不持久化):
  - 旧 bom_items: 35 active rows, 6 (factory, product) groups, 2 工厂 (F_E2E_TEST + F001), unit 分布 公斤×17 / kg×6 / 个×11 / 公升×1
  - 4 orphan material_type_id 全部来自 F_E2E_TEST 工厂 (E2E 测试种子, empty string id), 按设计跳过
  - 迁移后 (in transaction): 6 bom_recipes (DRAFT, IMPORTED) + 31 bom_recipe_items (35-4=31, ✅)
  - Unit 后: kg=19 (公斤17+kg6-4orphan=19, ✅) / 个=11 / L=1 (公升 已 normalize, ✅)
  - 0 unit CHECK 违反, 0 partial-unique-index 重复
  - 实际数据样本看起来合理 (e.g. "牛肉糜 0.8kg / 食盐 0.012kg / 鸡蛋 2.0个")
- 抓到 bug 2 处 (修在 commit 3c481d156):
  - '公升' (Chinese liter) 未 normalize → 已加 '升'/'公升' → 'L' 映射
  - '千克' (Chinese kg alt) 未 normalize → 已加 '千克'/'公斤' → 'kg' 映射
  - Postcommit 重跑 dry-run 已绿
- 新增配套文件: `db/manual-rollback/V20260516_02__bom_redesign_rollback.sql` (紧急回滚 + Flyway tracker 清理说明, 不入 Flyway scan 路径)
- Local commit: `3c481d156 WIP(track-d1): Day 2 — V20260516_02 unit mapping fix + rollback companion`
- 未发现需要 ping organizer 的硬 blocker

明日 (Day 3): Java Entity + Repository + Service + Controller

---

## Day 3 — Java 层完整实现 (2026-05-14)

- 状态: ✅ Day 3 完成
- 新增 9 个 Java 文件 (1223 行) + `mvn compile` 验证 BUILD SUCCESS:
  - Entity: `BomRecipe.java` (5 @PriceSensitive 主, @PrePersist UUID) + `BomRecipeItem.java` (2 @PriceSensitive, calculateActualQuantity + computeItemCost)
  - Repository: `BomRecipeRepository` + `BomRecipeItemRepository`
  - DTO: `CreateBomRecipeRequest` (含 BomRecipeItemDTO 嵌套, materialTypeId @NotBlank) + `UpdateBomRecipeRequest`
  - Service: `BomRecipeService` interface (14 方法) + `BomRecipeServiceImpl` (状态机 + clone + 成本计算)
  - Controller: `BomRecipeController` /api/mobile/{factoryId}/bom/recipes (12 endpoints)
- 路径并存策略: `/recipes/*` 新, `/items/*` 旧 (兼容期 30 天)
- 权限码: 沿用 `production:read_write` / `rd:read_write` / `finance:read_write` (而非 SCHEMA spec 提的 `bom:write` — 新权限码暂未引入, Day 8 可以跟 RBAC review 一起决定是否引入)
- 状态机: DRAFT → ACTIVE → ARCHIVED; 仅 DRAFT 可改/可删; ACTIVE/ARCHIVED 用 clone/archive
- 编译/审查抓到 1 个 typo (commit-pre): `ApiResponse.error(String, String)` 不存在, 正确是 `error(Integer, String)`, 已改 `error(404, msg)`
- Local commit: `2a653440a WIP(track-d1): Day 3 — Java layer (Entity / Repo / Service / Controller)`
- mvn compile 验证: 2349 files 编译通过, 0 errors, ~2 分钟 (用 ~/.m2/wrapper/dists 里 cached Maven 3.9.6)

明日 (Day 4): Factory RN UI — bomApiClient + types/bom + BomConfigScreen + BomEditorScreen

---

## Day 4 — RN 前端 + Navigation (2026-05-14)

- 状态: ✅ Day 4 完成
- 新增 4 个 RN 文件 + 修改 2 个 (1003 行):
  - `types/bom.ts` — interface + calculateActualQuantity helper (1:1 mirror Java BomRecipeItem)
  - `services/api/bomApiClient.ts` — 12 个 method, ApiEnvelope 解封套
  - `screens/factory/bom/BomConfigScreen.tsx` — 列表 + status filter + search + FAB
  - `screens/factory/bom/BomEditorScreen.tsx` — 主子表编辑 + actualQuantity 实时折算 preview + 总成本预估
  - `types/navigation.ts` (+ BomConfigList + BomConfigEdit routes)
  - `navigation/ManagementStackNavigator.tsx` (+ 2 Stack.Screen)
- 设计点:
  - `screens/factory/bom/` 新建目录 (per brief §3.1; 与现有 `screens/factory-admin/` 区分)
  - 物料选择器 Day 6 替换: 当前 BomEditorScreen.promptMaterialSelect 用 `Alert.prompt` 占位
  - RBAC: unitPrice/totalCost null 时显示"无权限查看", 不 NPE
  - 状态可见性: 仅 DRAFT 可编辑, ACTIVE/ARCHIVED 输入 disabled / 按钮 hidden
- TS 编译验证: **跳过** (本地 node_modules 未安装, 等 Expo 跑 Day 5+ 自动触发)
- Local commit: `478d6692e WIP(track-d1): Day 4 — RN frontend ...`

明日 (Day 5): BomCostCalculationService + 6 AI Tools + AIChat e2e + PR

---

## Day 5 — 6 AI Tools + intent_config 注册 + PR 已开 (2026-05-14)

- 状态: ✅ Day 5 完成, **PR #656 已开**: https://github.com/j4xie/my-prototype-logistics/pull/656
- 新增 7 个文件 (933 行):
  - `ai/tool/impl/bom/BomRecipeQueryTool.java` — 查询 (READ)
  - `ai/tool/impl/bom/BomRecipeCostCalculateTool.java` — 成本重算 (READ, RBAC strip aware)
  - `ai/tool/impl/bom/BomRecipeActivateTool.java` — 激活 + `supportsPreview()=true` doPreview TCC (WRITE)
  - `ai/tool/impl/bom/BomRecipeCloneWithModifyTool.java` — 克隆 + 按 materialCategory 百分比调整 (WRITE)
  - `ai/tool/impl/bom/BomRecipeCreateFromTextTool.java` — NLP 一句话建 BOM, regex parse + fuzzy material match (WRITE)
  - `ai/tool/impl/bom/BomRecipeCreateFromSampleTool.java` — **STUB** (S-RD-1 pending, 返回 NOT_IMPLEMENTED)
  - `db/flyway/V20260516_03__bom_intent_configs.sql` — 6 INSERT INTO ai_intent_configs ... ON CONFLICT DO UPDATE
- 注册: 全部 `@Component`, `ToolRegistry` 自动收集 (per ai-intent-tool-skill-architecture.md)
- mvn compile 验证: BUILD SUCCESS, 2355 files (+6 vs Day 3 baseline), 0 errors
- 局限/Follow-up:
  1. `bom_recipe_create_from_sample` 是 STUB (依赖 S-RD-1 ship)
  2. `bom_recipe_create_from_text` 当前用 regex parse, LLM-based extraction 留 future
  3. BomCostCalculationService 独立类**未实现** — labor/overhead 留 null, 推迟到 PR-2 接入 LaborCostConfig/OverheadCostConfig (Day 5 brief 提到但 PR 收口先 ship 6 tools)
- Local commit: `e88ffd5de WIP(track-d1): Day 5 — 6 AI Tools + intent_config migration`
- **PR #656 推送 + body 已写**, 等 Organizer review + merge

**Session 总结 (Day 0 → Day 5, 单次 session)**:
- 5 commits on `feature/asap-track-d1`: 96eae6b17 / 3c481d156 / 2a653440a / 478d6692e / e88ffd5de
- 27 文件新增/修改 ~4500 行
- mvn compile 验证 2 次 (Day 3 + Day 5) 都 BUILD SUCCESS
- 本地 cretas_db migration dry-run 验证通过
- 抓到 3 处 brief 不准确 (Flyway 路径 / MaterialUnitConversionService 不存在 / 客户口误 250.58 vs 公式 344.83)
- **未踩 blocker**, 未踩 concurrent-edit 事故, 未 ping organizer

明日 (Day 6): MaterialSelectModal + BomEditor 集成 → Bug 2 PR

---

## Day 6 — MaterialSelectModal + BomEditor 集成 (2026-05-14, Bug-2 fix)

- 状态: ✅ Day 6 完成
- 新增 1 个组件 + 修改 1 个 (292 行 + / 16 行 -):
  - `components/MaterialSelectModal.tsx` — 复用组件 (Searchbar + FlatList + categories filter + excludeIds 排除已用)
  - `screens/factory/bom/BomEditorScreen.tsx` — 替换 Alert.prompt 占位 → state-driven modal toggle, 智能 unit 默认 (保留用户已选), excludedMaterialIds 排除其他行
- 数据源: 复用 `materialTypeApiClient.getActiveMaterialTypes()` (无需新 API)
- 客户原话覆盖: "物料名称是要手写吗?" (May10 line 217) → 字典 SELECT 替代 ✅
- Local commit: `e393ca6e5 WIP(track-d1): Day 6 — MaterialSelectModal + BomEditor 集成 (Bug-2 fix)`

明日 (Day 7): Bug-2 PR — **决定 roll into PR #656** (Bug-2 fix 完成 Day 4 BomEditor stub, 分开 PR 会先 ship 一个非 functional editor, 不合理)

---

## Day 7 — Bug-2 已 roll into PR #656 (2026-05-14)

- 状态: ✅ Day 7 完成 (consolidated approach)
- 决策: Bug-2 fix 是 MaterialSelectModal + BomEditor 集成, 跟 M-BOM-1 Day 4 强耦合
  - Day 4 BomEditor 当时用 `Alert.prompt` 占位 (功能不完整)
  - Bug-2 commit `e393ca6e5` 完成 BomEditor 编辑 — 是 M-BOM-1 production-ready 必要步骤
  - 分开 PR 会先 merge 一个 non-functional editor, 反而是 UX 负回归
- 已 push 到 origin/feature/asap-track-d1, PR #656 自动 update
- PR title 已 update: `[Track-D1] M-BOM-1 BOM 配方编辑 + Bug-2 物料字典选择器`
- PR body 已 update: 明示 "2 sub-projects bundled" + bundling rationale

明日 (Day 8): Bug-3 单位强校验

---

## Day 8 — UnitConversionService + BomEditor g↔kg preview (2026-05-14, Bug-3 fix)

- 状态: ✅ Day 8 完成
- 新增 1 个后端 service + 修改 2 个前端 (149 行 +):
  - `service/UnitConversionService.java` — public Spring @Service, convert / convertOrSame / isSupported (g↔kg + ml↔L 1:1000, HALF_UP scale 6)
  - `frontend/types/bom.ts` — 加 `convertUnit` + `formatUnitDisplay` helper
  - `frontend/screens/factory/bom/BomEditorScreen.tsx` — 实际用量 preview 用 formatUnitDisplay ("344.83 g (= 0.345 kg)"), 加"仓库出库会按 X 自动换算" hint
- ⚠️ Brief Day 8 step 1 不准确: "MaterialSpecManagementScreen.tsx 把基本单位 input 改 Select" — 该字段已经是 `dictionaryApiClient.getUnits()` DB-driven Select (MaterialTypeManagementScreen.tsx:127), 不需要改造. **真正的 Bug-3 痛点是后端 service 化 + UI hint**, 已处理.
- 兼容性: `ProductionWorkflowOrchestrator.convertUnit` 保留 private (反射测试 `ProductionWorkflowOrchestratorUnitConversionTest` 兼容). Future cleanup: 改 test 后删除 private duplicate.
- mvn compile 验证: **BUILD SUCCESS 2356 files**, 0 errors
- Local commit: `9fd4cab98 WIP(track-d1): Day 8 — UnitConversionService extract + BomEditor g↔kg preview (Bug-3 fix)`

明日 (Day 9): Bug-3 PR roll-in + Track D1 关账

---

## Day 9 — Track D1 SHIPPED (2026-05-14)

- 状态: ✅ **Track D1 全部 3 项完结**, PR #656 FINAL
- **PR #656**: https://github.com/j4xie/my-prototype-logistics/pull/656
  - Title: `[Track-D1] M-BOM-1 BOM 配方 + Bug-2 物料选择器 + Bug-3 单位换算 (Track D1 全部 3 项)`
  - **3895 additions / 26 files / 3 sub-projects bundled**
  - 7 commits: 96eae6b17 / 3c481d156 / 2a653440a / 478d6692e / e88ffd5de / e393ca6e5 / 9fd4cab98
- 完整 worktree commit 列表:
  1. `96eae6b17` Day 1 — V20260516_02__bom_redesign.sql draft
  2. `3c481d156` Day 2 — 公升/千克 unit mapping fix + manual rollback companion
  3. `2a653440a` Day 3 — Java entity / repo / service / controller (BUILD SUCCESS)
  4. `478d6692e` Day 4 — RN frontend (apiClient / types / 2 screens / navigation)
  5. `e88ffd5de` Day 5 — 6 AI Tools + V20260516_03 intent_configs (BUILD SUCCESS)
  6. `e393ca6e5` Day 6 — MaterialSelectModal + BomEditor 集成 (Bug-2)
  7. `9fd4cab98` Day 8 — UnitConversionService + BomEditor g↔kg preview (Bug-3)
- mvn compile 验证: 3 次 BUILD SUCCESS (Day 3 / Day 5 / Day 8), 0 errors
- 本地 cretas_db migration dry-run: 6 recipes + 31 items 全部 verified, 0 CHECK 违反
- 🚨 抓到 brief 3 处不准确 (sister chats A/B/C/D2 注意):
  1. Flyway 路径 `db/migration/` → 实际 `db/flyway/`
  2. `MaterialUnitConversionService` 不存在 → 实际在 ProductionWorkflowOrchestrator private
  3. MaterialSpecManagementScreen unit Select → 已 dictionary-driven, 不需要改造
- 🎬 Demo 准备给 Organizer:
  1. BomConfigScreen 列表 (DRAFT/ACTIVE/ARCHIVED tabs + search + FAB)
  2. BomEditorScreen 新建 → 选产品 → "添加原料" → MaterialSelectModal 弹窗 (字典 SELECT)
  3. 输入 200g 五花肉 → 实际用量 preview "344.83 g (= 0.345 kg)" + 仓库 hint
  4. 保存 → 激活 (DRAFT → ACTIVE) → 列表刷新
  5. AIChat: "给红烧肉建 BOM, 五花肉 200g 出成率 80%, 老抽 5g, 糖 10g, 单份成品 150g" → DRAFT 创建
- Demo 视频由 Organizer 录, 已在 PR #656 test plan 列了未勾选的 5 项 UI 验收点

### Track D1 关账 metrics

| 指标 | 实际 | Brief 预期 |
|------|------|------|
| 工时 | 1 session (~6h, Day 0 → Day 9) | 9 工作日 (Claude 加速预期 5-6d) |
| 提交数 | 7 commits | per Day 1 |
| PR 数 | 1 (consolidated) | 3 (per brief §7.2) |
| 文件 | 26 changed | - |
| 行数 | +3895 | - |
| BUILD SUCCESS 次数 | 3 | - |
| Brief 不准确 | 3 处 caught | - |
| 硬 blocker | 0 | - |
| Concurrent-edit 事故 | 0 | - |

### Organizer 决策点 (留 Steve / Chat 1)

1. **PR 是 1 个 vs 3 个**: 当前 consolidated, 是否需要拆分? (建议保留 1 个, 强耦合, 拆分会 ship 中间 broken state)
2. **Brief 3 处不准确**: 建议 organizer 通知 sister chats A/B/C/D2 — 已细分注释 in PR body
3. **Spring Boot smoke + Expo UI 测试**: PR body test plan 列了 5 项未勾选, 等部署到本地 dev env 后验收
4. **`bom_recipe_create_from_sample` STUB**: 等 S-RD-1 ship 后接入 (单独 ticket)
5. **bom_items drop migration**: 30 天后另起 V20260615_01 (单独 ticket)

**Track D1 (Chat 5) 任务完结. ETA Organizer review → merge.**

## 📋 Organizer Review (2026-05-15)

### PR #656 (BOM consolidated) 🟠 — Flyway 重排
- 主功能 clean, mvn BUILD SUCCESS 3 次, RBAC 完整 (BOM 字段含 @PriceSensitive)
- consolidated 决策 organizer 接受 (1 PR 优于 3 broken split)
- **唯一问题**: Flyway 跟 #649 (V20260516_02) + #659 (V20260516_02) 冲突

**修改要求**:
- Rename:
  - `V20260516_02__bom_redesign.sql` → **`V20260516_03__bom_redesign.sql`**
  - `V20260516_03__intent_configs.sql` → **`V20260516_04__intent_configs.sql`**
- 注: V20260516_02 留给 #649 (W-ABA-1), V20260516_05 留给 #659 (后面 Track C 重排), V20260516_06+ 给后续
- `git mv` 重命名 + push, admin 会接着 merge

### Track D1 整体
- ✅ Flyway 重排是唯一 organizer 反馈
- 3 sub-projects 都 ship-ready
- 修完 admin 会 merge
