# Track D Brief — BOM 配方 + 工序管理 + 3 生产 Bug

> **接收方**: Chat 5 (Track D worker)
> **派发方**: Organizer (Chat 1)
> **生效日**: 2026-05-14
> **总工时**: 名义 16 工作日 / Claude 加速预期 9-10 工作日
> **本文件目标**: 给到一份完全 self-contained 的 brief, 你不需要任何额外 context 就能立即上手干活

---

## §1 项目 Onboarding

### 1.1 这是什么项目

**Cretas (白垩纪) 食品溯源系统** — 一套面向**食品加工厂 + 餐饮企业**双主线的全链路溯源 + 生产管理 SaaS。

技术栈:
- **后端**: Java 21 + Spring Boot 3.2.12 + PostgreSQL + JPA (Hibernate 6) — 端口 10010
- **前端**: Expo 53+ React Native + TypeScript + React Navigation 7+ — 端口 3010
- **AI 服务**: Python FastAPI + LLM (Aliyun Qwen / DashScope) — 端口 8083
- **Embedding**: Java gRPC — 端口 9090
- **DB**: PostgreSQL (cretas_db = test, cretas_prod_db = prod) — 端口 5432

项目状态: Phase 3 核心完成 (~82-85%). 现处 ASAP Phase 0 + Sprint 1 ("六扇门交付冲刺")。

### 1.2 客户背景: 六扇门 F006 卤制品工厂

- **factoryId**: F006 (六腾门)
- **行业**: 卤制品加工 (猪蹄 / 猪头肉 / 牛肉等)
- **节奏**: ASAP 1.5 月交付 P0 客户测试关键功能
- **关键产品**: 珠奇 / 鲁猪蹄 / 牛肉等卤制品
- **客户已开过 4 次会议** — 第四次 (May 10) 提出本 brief 涉及的全部 BOM/工序/单位 痛点

测试时**用 F006 prod 账号** (16 个真实角色账号已存在生产 DB), 不用 F001 dev seed。账号清单 see `reference_f006_liutengmen_prod_accounts.md` memory entry (organizer 知)。本地测试用 F001/cretas_db。

### 1.3 你在做什么

**你是 Track D**, 4 个并行 chat (A/B/C/D) 之一, 由 Organizer (Chat 1) 协调:
- Track A — Canvas 死代码修复 (9d)
- Track B — AI 钉钉 + 抄码 + PDF (12d)
- Track C — Attachment + 打印 + 三价 + RBAC (11d)
- **Track D — BOM 配方 + 工序管理 + 3 生产 bug (16d)** ← **你**

你是**最大 track** (16 工时), 因为 BOM/工序是六扇门 P0 客户测试关键点, 是新 UI + 新表 + 3 个直接 follow-up bug 的组合。

---

## §2 任务范围与工时

### 2.1 5 个 sub-project 总览

| # | 项目 | 工时 | P 级 | 说明 |
|---|---|---|---|---|
| 1 | **M-BOM-1 BOM 配方编辑 UI (工厂端)** | 5d | P0 | 餐饮端 RecipeListScreen 已有, 工厂端缺 BomConfigScreen |
| 2 | **M-WP-1/2 工序管理 + 产品工序配置** | 5d | P0 | 后端 Controller 齐, 前端 grep 0 |
| 3 | **Bug 修: 生产工序"通用 P 过来"未关联** | 2d | P0 | 第四次会议 bug, partial #567, follow-up #622/#623 open |
| 4 | **Bug 修: BOM 物料选择器** | 2d | P0 | 客户原话"物料名称是要手写吗?" → 应该是 Select |
| 5 | **Bug 修: 单位转换强校验** | 2d | P0 | 客户原话"统一单位"或"自动折算" → 强校验 g/kg |

**Total**: 16 工作日 (名义). Claude 加速 1.7-2x → **预期 ~9-10 工作日完成**。

### 2.2 为什么这 5 项打包给 Track D

- BOM (项目 1) + 单位转换 (项目 5) + 物料 Select (项目 4) 高度耦合 — 都涉及 `bom_recipes` 主子表 + `raw_material_types` 字典硬外键
- 工序 (项目 2) + 工序 bug (项目 3) 同源 — 都涉及 `work_process_tasks` + `product_work_processes` + ProductionBatch
- BOM 和 工序 是六扇门 1.5 月交付的两大功能验收点
- 3 个 bug 是客户实测发现的, 跟 BOM/工序密切关联, 一并修

### 2.3 关键节点

- **Day 5 末**: BOM 配方编辑 UI 工厂端可用, AIChat 一句话建 BOM 可跑
- **Day 10 末**: 工序管理完整链路 (新增工序 → 产品工序配置 → 生成工序任务 → 状态机)
- **Day 12 末**: 3 个 bug 中"通用 P 过来"修复 (这是客户实测发现的 P0)
- **Day 16 末**: 5 项全部 ship, 准备 demo 录制

### 2.4 ProductionBatch Entity Fork 需谨慎

`ProductionBatch` 当前是单表服务餐饮 + 工厂双主线, 但语义差异大 (餐饮 = 中央厨房批次, 工厂 = 车间生产批次)。**长期需要 fork 成 `RestaurantBatch` + `FactoryBatch`**, 但**不在本 track 范围**。你在本 track 中**不要动 ProductionBatch Entity**, 如发现必须改, **先 ping Organizer**, organizer 评估时机。

---

## §3 文件 Ownership (你的 / 不准动)

### 3.1 你拥有的目录/文件

**后端 (Java)**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/bom/` — `BomRecipe.java` (新增) + `BomRecipeItem.java` (新增) + 现有 `BomItem.java`/`BomChangeLog.java` (保留兼容期)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/workprocess/` (新建包) — `WorkProcessTask.java` (新增)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/bom/BomRecipeRepository.java` + `BomRecipeItemRepository.java` (新增)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/workprocess/WorkProcessTaskRepository.java` (新增)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/bom/` (新建包) — BomRecipeService 接口 + impl
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/workprocess/` (新建包) — WorkProcessTaskService 接口 + impl
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BomRecipeController.java` (新增)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/WorkProcessTaskController.java` (新增)
- 现有 `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/WorkProcessController.java` + `ProductWorkProcessController.java` (保持不动, 仅必要时小补丁)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/bom/` (新建包) — 6 个 Tool
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/workprocess/` (新建包) — 5 个 Tool

**Flyway 迁移**:
- `backend/java/cretas-api/src/main/resources/db/migration/V20260516_02__bom_redesign.sql` (新增)
- `backend/java/cretas-api/src/main/resources/db/migration/V20260516_03__work_process_tasks.sql` (新增)
- (Flyway tracker 由 Cretas 默认机制, 不手动 INSERT)

**前端 (RN)**:
- `frontend/CretasFoodTrace/src/screens/factory/bom/BomConfigScreen.tsx` (新增, 工厂端 BOM 列表)
- `frontend/CretasFoodTrace/src/screens/factory/bom/BomEditorScreen.tsx` (新增, 主子表编辑)
- `frontend/CretasFoodTrace/src/screens/factory/workprocess/WorkProcessListScreen.tsx` (新增)
- `frontend/CretasFoodTrace/src/screens/factory/workprocess/WorkProcessCreateScreen.tsx` (新增)
- `frontend/CretasFoodTrace/src/screens/factory/workprocess/ProductWorkProcessConfigScreen.tsx` (新增)
- `frontend/CretasFoodTrace/src/screens/management/MaterialSpecManagementScreen.tsx` (修改: 强制 g/kg + 二级单位转换默认)
- 生产计划页 (Bug "通用 P") 涉及的 ProductionPlan 创建/工序选择 — 现有页, 你修, 文件路径见 §4.11
- `frontend/CretasFoodTrace/src/services/api/bomApiClient.ts` (新增) + `workProcessApiClient.ts` (新增)
- `frontend/CretasFoodTrace/src/types/bom.ts` (新增) + `workProcess.ts` (新增)

### 3.2 你不准改的 (改必先 ping Organizer)

- `backend/.../entity/BaseEntity.java` — 项目根 Entity, 影响所有表
- `backend/.../service/impl/IntentExecutorServiceImpl.java` — AI 意图路由核心
- `frontend/.../services/api/aiApiClient.ts` — AI API client 共享层
- `CLAUDE.md` + `.claude/rules/` — 项目规范
- `backend/.../entity/ProductionBatch.java` — 餐饮/工厂共享, fork 决策需 organizer
- Track A 目录: `frontend/.../screens/lowcode/` + `service/impl/DecorationServiceImpl.java` + `ai/tool/impl/pagedesign/` + `ai/tool/impl/decoration/`
- Track B 目录: `service/dingtalk/` + `entity/integration/` + `screens/shared/LabelScanScreen.tsx` + `ai/tool/impl/material/`
- Track C 目录: `entity/Attachment.java` + `service/attachment/` + `screens/smartbi/` + `ai/tool/impl/finance/RBACAuditTool.java`
- 餐饮端 `frontend/.../screens/restaurant/recipes/RecipeListScreen.tsx` — 是你的**参考实现**, 但不准破坏 (餐饮端继续用)

### 3.3 共享文件 (轻量改动 OK, 大改先 ping)

- `frontend/.../types/navigation.ts` — 加新 screen 到 Stack 是 OK 的 (你的新页面 BomConfigScreen 等需要加)
- `frontend/.../i18n/locales/` — 加新 i18n key 是 OK 的
- `frontend/.../types/material.ts` 或 `restaurant.ts` — 仅查看, 不改

### 3.4 Git Worktree 策略

强烈推荐用 git worktree 隔离:

```bash
cd C:/Users/Steve/my-prototype-logistics
git worktree add ../my-prototype-logistics-track-d -b feature/asap-track-d HEAD
cd ../my-prototype-logistics-track-d
# 在此 worktree 内工作, 防止跟 main worktree 冲突
```

Branch 命名: `feature/asap-track-d-{编号}` 如 `feature/asap-track-d-m-bom-1`。

---

## §4 Day-by-Day 执行计划

### Day 1 — BOM 配方 spec 吸收 + 现状 audit

**目标**: 完全掌握 `bom_recipes` + `bom_recipe_items` 新主子表 spec, 知道现有 `bom_items` 单表数据迁移路径

**动作**:
1. 读 `宏见竞品分析/01-客户档案/SCHEMA_DESIGN.md` §2.6 (line 1117-1419) — 完整 DDL + Entity + API
2. 读六扇门第四次会议 line 200-400 — 客户原话场景 (BOM 配方 + 物料 Select + 出成率 + 单位)
3. 现状 audit:
   - 看现有 `backend/.../entity/bom/BomItem.java` — 旧单表结构
   - 看现有 `BomController.java` (找 backend/.../controller/) — 旧 API
   - 看 `backend/.../service/.../BomExpansionService` 是怎么读 BomItem 的 (PR #312 上下文)
   - 看 `backend/.../service/conversion/` 现有 ConversionService — 单位换算逻辑
4. 列旧→新数据迁移 mapping (每条 bom_items → bom_recipes 1 行 + bom_recipe_items N 行, 聚合 by product_type_id)
5. 在 STATUS 写 Day 1 结论 + 第一版迁移 SQL 草稿

**产出**: Day 1 STATUS update + 迁移 SQL 草稿

### Day 2 — Flyway 迁移 V20260516_02__bom_redesign.sql

**目标**: 数据库 schema 上 (DRAFT, 本地 test 跑通)

**动作**:
1. 写 `V20260516_02__bom_redesign.sql`:
   - `CREATE TABLE bom_recipes (...)` (照搬 SCHEMA_DESIGN line 1135-1183)
   - `CREATE TABLE bom_recipe_items (...)` (照搬 line 1186-1229)
   - 数据迁移 INSERT: 现有 `bom_items` 按 (factory_id, product_type_id) 聚合 → 每组 1 条 `bom_recipes` (DRAFT 状态, source_type='MANUAL') + N 条 `bom_recipe_items`
   - 注意: 旧 `bom_items` 表**不 drop**, 保留 30 天观察期 (SCHEMA_DESIGN 决策 B)
   - 单位 normalize: 旧 bom_items.unit 可能是空或乱, normalize 成 ('g','kg','ml','L','个','袋','箱') 之一
2. 本地起 cretas_db 跑 migration, 验证:
   - `SELECT COUNT(*) FROM bom_recipes;` 跟 `SELECT COUNT(DISTINCT (factory_id, product_type_id)) FROM bom_items;` 一致
   - 没破坏现有 BOM 业务 (旧 BomController 还能查 bom_items)
3. 写回滚 SQL (备用)

**产出**: V20260516_02 SQL 文件 commit (本地未 push, 等组合 PR)

### Day 3 — Entity + Repository + Service

**目标**: Java 层就绪

**动作**:
1. 创建 `BomRecipe.java` Entity (照搬 SCHEMA_DESIGN line 1239-1294, 注意 `@PriceSensitive` 注解 5 个字段, 注意 `@PrePersist void assignUUID()`)
2. 创建 `BomRecipeItem.java` Entity (line 1297-1343, `@Transient calculateActualQuantity()` 方法很关键 — 出成率折算逻辑)
3. 创建 `BomRecipeRepository.java`:
   - `Optional<BomRecipe> findByFactoryIdAndProductTypeIdAndIsCurrentTrue(...)`
   - `Page<BomRecipe> findByFactoryIdAndStatus(...)`
4. 创建 `BomRecipeItemRepository.java`:
   - `List<BomRecipeItem> findByRecipeIdOrderBySortOrderAsc(...)`
5. 创建 `BomRecipeService` 接口 + `BomRecipeServiceImpl`:
   - `createRecipe(CreateBomRecipeRequest req)` — 创建草稿 + 自动 recipeCode 生成 (`BOM-YYYYMMDD-NNN`)
   - `activateRecipe(id)` — DRAFT → ACTIVE, 自动把同 productTypeId 其他版本 is_current=false (注意 partial unique 索引约束)
   - `cloneRecipe(id)` — 克隆为新 version
   - `calculateCost(id)` — 重算成本 (不写表, 返回 DTO)
   - `archiveRecipe(id)` — DRAFT/ACTIVE → ARCHIVED
6. 写 BomRecipeController.java (10 endpoint 照 SCHEMA_DESIGN line 1355-1369)
7. 跑单元测试 (用 H2 mock — Cretas 现有 pattern)
8. 提醒: **注意 PostgreSQL parameter-side IS NULL 用 CAST AS string** (per `.claude/rules/database-entity-sync.md`)

**产出**: Entity/Repo/Service/Controller all in, 单元测试 PASS

### Day 4 — 工厂端 BomConfigScreen + BomEditorScreen

**目标**: 工厂用户能在 RN App 配置 BOM

**动作**:
1. 先看餐饮端 `frontend/.../screens/restaurant/recipes/RecipeListScreen.tsx` (你的参考实现, 但餐饮端不准动)
2. 创建 `frontend/.../services/api/bomApiClient.ts`:
   - `getRecipes(productTypeId?, current?)` / `getRecipe(id)` / `createRecipe(req)` / `updateRecipe(id, req)` / `activateRecipe(id)` / `archiveRecipe(id)` / `cloneRecipe(id)` / `calculateCost(id)` / `addItem(recipeId, req)` / `updateItem(itemId, req)` / `deleteItem(itemId)`
   - 用现有 axios client + JWT interceptor (参考别的 api client)
3. 创建 `frontend/.../types/bom.ts`:
   - `interface BomRecipe { id, recipeCode, productTypeId, productName, version, isCurrent, overallYieldRate, outputQuantityPerUnit, outputUnit, totalMaterialCost?, ..., status: 'DRAFT'|'ACTIVE'|'ARCHIVED', items: BomRecipeItem[] }`
   - `interface BomRecipeItem { id, recipeId, materialTypeId, materialName, standardQuantity, yieldRate, actualQuantity, unit, unitPrice?, ... }`
4. 创建 `BomConfigScreen.tsx` — 列表页:
   - Tab: 全部 / DRAFT / ACTIVE / ARCHIVED
   - 列表项: productName + version + isCurrent badge + overallYieldRate + totalCost
   - FAB → 跳 BomEditorScreen 新建
5. 创建 `BomEditorScreen.tsx` — 主子表编辑页:
   - 表单: 产品 select (从 product_types 字典) + 出成率 input + 单份成品克数 + output_unit
   - 子表列表: 每行一个原料 (materialName 显示 + materialTypeId 隐藏 + standardQuantity + yieldRate + unit + unitPrice)
   - **物料添加按钮 → 弹出 raw_material_types Select 模态框** (这是项目 4 的核心)
   - 出成率自动折算 preview (per item): `actualQuantity = standardQuantity / (yieldRate/100)` 实时显示
   - 总成本聚合 preview (item_cost = actualQuantity × unitPrice, 总 = sum + labor + overhead)
   - 保存按钮 → POST /bom/recipes
   - 激活按钮 → POST /bom/recipes/{id}/activate
6. 加到 Stack navigation (`frontend/.../types/navigation.ts`)
7. 本地跑通 (cretas_db + 本地后端)

**产出**: 工厂端能列表 + 创建 + 编辑 + 激活 BOM 配方

### Day 5 — 出成率折算 service + AIChat Tool + PR

**目标**: 后端折算 service + 一句话建 BOM, ship 项目 1 PR

**动作**:
1. 写后端 `BomCostCalculationService`:
   - `calculateActualQuantity(standardQty, yieldRate)` — 单原料折算 (200g / 58% = 344.83g, 但 schema 注释说是 250.58g, 这是因为客户算的是"成品 200g 需要原料多少", 折算公式是 `200 / 0.58 = 344.83`, 但客户原话 "250.58" 看起来用了 `200 + 200×0.58/2.21` 之类奇怪算法, 实际**按 SCHEMA_DESIGN line 1340 `calculateActualQuantity()` 为准**: `standardQuantity.divide(yieldRate/100, 6, HALF_UP)`)
   - `calculateRecipeCost(recipe, items)` — 聚合成本
   - 注意 Java BigDecimal HALF_UP vs Python banker's rounding (per `.claude/rules/python-java-port.md` Rule 12, 虽然本 track 不涉及 Python, 但 Cretas 项目规则)
2. 创建 6 个 AI Tool (`ai/tool/impl/bom/`):
   - `BomRecipeCreateFromTextTool` — 实现 SCHEMA_DESIGN line 1410: "200g 牛肉 + 10g 盐 + 5g 糖" 一句话建 BOM
     - getToolName: `"bom_recipe_create_from_text"`
     - 参数: `productTypeId`, `outputQuantityPerUnit`, `outputUnit`, `ingredientsText` (LLM 解析)
     - 内部: 调 LLM 提取 → `material_type` 模糊匹配 → 调 `BomRecipeService.createRecipe(...)`
   - `BomRecipeCreateFromSampleTool` — `bom_recipe_create_from_sample` (从研发样品转)
   - `BomRecipeCloneWithModifyTool` — `bom_recipe_clone_with_modify` ("克隆 SKU-201 但减 10% 包材")
   - `BomRecipeCostCalculateTool` — `bom_recipe_cost_calculate` (重算成本+利润)
   - `BomRecipeActivateTool` — `bom_recipe_activate` (支持 WRITE preview, override `supportsPreview()` + `doPreview()`)
   - `BomRecipeQueryTool` — `bom_recipe_query` (查当前生效 BOM)
3. 注册 Tool: `@Component` 自动注册到 `ToolRegistry`, 无需手动 register, 启动日志确认 `✅ 注册工具: name=bom_recipe_*, class=Bom*Tool`
4. 在数据库 `ai_intent_config` 表插入 6 个 intent 行绑定这些 tool_name (per `.claude/rules/ai-intent-tool-skill-architecture.md`)
5. AIChat 跑通: 在 RN App 里说 "给红烧肉建 BOM, 五花肉 200g 出成率 80%, 老抽 5g, 糖 10g, 单份成品 150g" → BOM 创建成功
6. **写 PR**: `[Track-D] M-BOM-1 BOM 配方编辑 UI (工厂端)`
   - PR body 含: 涉及文件 (列举) / 测试方式 (本地 BomEditorScreen 截图 + AIChat 一句话 demo) / 风险点 (兼容期 bom_items 双写考虑)

**产出**: M-BOM-1 PR 开 Organizer review

### Day 6 — 工序管理 spec + 后端现状 audit

**目标**: 掌握 `work_processes` (已有) + `product_work_processes` (已有) + `work_process_tasks` (新建) 三表关系

**动作**:
1. 读 SCHEMA_DESIGN §2.5 (line 940-1115)
2. 读六扇门第四次会议 line 49-104 — 工序管理的客户场景 (拆包→分割→卤制→分切)
3. audit:
   - 看 `backend/.../controller/WorkProcessController.java` (已有, 不动) — 暴露的 API
   - 看 `backend/.../controller/ProductWorkProcessController.java` (已有, 不动) — 产品工序模板 API
   - 看 `backend/.../entity/.../WorkProcess.java` + `ProductWorkProcess.java` Entity 字段
   - grep 前端: `Grep "WorkProcess" frontend/CretasFoodTrace/src/screens/` 确认零命中
4. 列前端 3 个 screen 设计:
   - WorkProcessListScreen (查看所有工序定义, 用 GET /work-processes)
   - WorkProcessCreateScreen (新增工序, 用 POST /work-processes, 字段: workProcessName / category / outputUnit / estimatedMinutes — see 客户原话 line 76-91)
   - ProductWorkProcessConfigScreen (产品 → N 工序绑定, 用 POST /product-work-processes)

**产出**: Day 6 STATUS + 前端架构图

### Day 7 — WorkProcessListScreen + WorkProcessCreateScreen

**目标**: 工厂用户能在 RN App 新增工序定义

**动作**:
1. 创建 `frontend/.../services/api/workProcessApiClient.ts`:
   - 调用现有 `WorkProcessController` 的 GET / POST / PUT / DELETE 端点
   - 调用现有 `ProductWorkProcessController` 的端点
   - **不调用** WorkProcessTaskController (Day 9 才有)
2. 创建 `frontend/.../types/workProcess.ts`:
   - `interface WorkProcess { id, factoryId, processName, category: 'PRE_PROCESS'|'PROCESSING'|'PACKAGING'|'QUALITY', outputUnit, estimatedMinutes, ... }`
   - `interface ProductWorkProcess { id, productTypeId, workProcessId, processOrder, ... }`
3. 创建 `WorkProcessListScreen.tsx`:
   - 列表 GET /work-processes
   - FAB → 跳 Create
   - 长按 → 编辑 / 删除
4. 创建 `WorkProcessCreateScreen.tsx`:
   - 表单字段 (per 客户原话 line 76-91):
     - 工序名称 (必填, 如"拆包")
     - 工序列表 = category select (前处理 / 处理 / 包装 / 质检) — 客户原话 "选前处理"
     - 产出单位 (必填, 工金/件/份, 客户原话 "产出单位是工金")
     - 预估工时 (必填, 分钟数)
   - 保存 → POST /work-processes
5. navigation 加 Stack
6. 本地跑通

**产出**: 工序新增 + 列表可用

### Day 8 — ProductWorkProcessConfigScreen

**目标**: 工厂用户能给产品绑定多个工序

**动作**:
1. 创建 `ProductWorkProcessConfigScreen.tsx`:
   - 顶部 product select (从 product_types)
   - 中部: 该产品当前已绑定的工序列表 (按 processOrder 排序)
   - "添加工序"按钮 → 弹出 work_process Select 模态框 → 选好后追加到末尾 (processOrder = 当前 max + 1)
   - 拖拽排序 (用 react-native-draggable-flatlist 或简单上下箭头)
   - 删除工序绑定
2. 接口:
   - GET /product-work-processes?productTypeId=X
   - POST /product-work-processes
   - PUT /product-work-processes/{id}
   - DELETE /product-work-processes/{id}
3. **关键 UX**: 客户原话 line 95 "宣传计划, 新建计划, 订单, 产品行, 注射, 叮咚, 工序, 哎, 这工序还是只有通用" — 意思是说**生产计划界面应该自动带出该产品配置的工序**。这是项目 3 bug 的根因, Day 11 修。
4. 本地跑通: 给"猪蹄"产品绑定 [拆包, 分割, 卤制, 分切, 装筐] 5 道工序

**产出**: 产品 × 工序绑定可用

### Day 9 — 生成工序任务 + 状态机

**目标**: 生产批次启动时自动 spawn 工序任务实例, 状态机跑通

**动作**:
1. 写 `V20260516_03__work_process_tasks.sql` Flyway:
   - `CREATE TABLE work_process_tasks (...)` (照搬 SCHEMA_DESIGN line 953-1003)
   - 4 个索引
2. 创建 `WorkProcessTask.java` Entity (line 1009-1071, 注意 Status enum: PENDING/IN_PROGRESS/COMPLETED/SKIPPED/CANCELLED)
3. 创建 `WorkProcessTaskRepository.java`:
   - `List<WorkProcessTask> findByFactoryIdAndProductionBatchIdOrderByProcessOrderAsc(...)`
   - `Page<WorkProcessTask> findByFactoryIdAndStatus(...)`
4. 创建 `WorkProcessTaskService` 接口 + impl:
   - `spawnTasks(batchId)` — 从 `product_work_processes` 模板生成任务 (per batch, 一次性 spawn)
   - `start(taskId)` — PENDING → IN_PROGRESS, 记录 actualStartAt
   - `complete(taskId, actualQuantity)` — IN_PROGRESS → COMPLETED, 算 actualMinutes
   - `skip(taskId, reason)` — 任意 → SKIPPED (需主管, notes 必填)
   - `assign(taskId, userId)` — 分配责任人
   - 状态机校验: 用 enum + switch, 非法转换抛 BusinessException + actionHint
5. 创建 `WorkProcessTaskController.java` (8 endpoint, SCHEMA_DESIGN line 1093-1101)
6. 前端 (轻量, 主要后端):
   - 在生产批次详情页加"工序任务"tab — 调 GET /work-process-tasks?batchId=X
   - 每个任务卡片有"开始" / "完成" / "跳过"按钮
   - 这部分代码可能动到 ProductionBatch 详情页, **改前 ping Organizer** 确认是否安全
7. 创建 5 个 AI Tool (`ai/tool/impl/workprocess/`):
   - `WorkProcessTaskSpawnTool` — 一句话: "给批次 BAT-001 生成工序任务" (调 spawnTasks)
   - `WorkProcessTaskStartTool` — `work_process_task_start`
   - `WorkProcessTaskCompleteTool` — `work_process_task_complete` (带录入产量)
   - `WorkProcessTaskAssignTool` — 分配责任人
   - `WorkProcessConfigUpdateTool` — `work_process_config_update` (改产品×工序绑定, supportsPreview)
8. AIChat 跑通: "给猪蹄加工序: 拆包→分割→卤制→分切→装筐" 一句话配置 (这其实是 Day 8 + Day 9 的组合 — Tool 内部先调 product_work_process 绑定 5 道工序, 然后批次时再 spawn)
9. 注册 5 个 intent 到 ai_intent_config

**产出**: 工序任务生成 + 状态机可用 + AIChat 一句话配置

### Day 10 — 工序 PR + 收尾

**目标**: ship 项目 2 PR

**动作**:
1. 跑端到端:
   - 系统管理 → 工序管理 → 新增工序 "拆包"
   - 系统管理 → 产品工序配置 → 选"猪蹄" → 加 [拆包, 分割, 卤制, 分切, 装筐]
   - 生产计划 → 新建批次 → 启动 → 自动 spawn 5 个工序任务
   - 工序任务列表 → 点"开始" / "完成" 跑状态机
2. 整理 PR: `[Track-D] M-WP-1/M-WP-2 工序管理 + 产品工序配置`
   - PR body: 含截图 / 状态机图 / AIChat demo 视频
3. 更新 STATUS

**产出**: M-WP-1/M-WP-2 PR 开

### Day 11 — Bug 修: 生产工序"通用 P 过来"未关联

**目标**: 复现 + 修

**动作**:
1. 复现 bug (客户原话 line 95-99):
   - 在 cretas_db (本地) 给产品"猪蹄"绑定 5 道工序 (Day 8 的工作)
   - 新建生产计划 → 选"猪蹄" → 工序下拉 → **预期**显示 [拆包, 分割, 卤制, 分切, 装筐] / **实际**只有"通用"
2. 看现有 partial 修复:
   - `gh pr view 567 --json files,body` (本地必须用 gh CLI 在 PowerShell 跑)
   - 看 PR #622 / #623 (follow-up open, 看是否还有 open scope)
3. 定位代码:
   - 前端: 生产计划新建页 (grep "通用" + "工序" 找), 大概率在 `frontend/.../screens/production/` 或 `frontend/.../screens/factory/production/`
   - 后端: ProductionPlanController 创建批次时是否带 product_work_processes 查询
4. 修复路径:
   - 前端: 选产品后, 触发 GET /product-work-processes?productTypeId=X, 把返回的工序列表注入工序下拉 (不是 fallback 到"通用")
   - 后端: 如果是后端没暴露这个 endpoint, 加暴露 (但 ProductWorkProcessController 已有, 应该是前端 wiring 问题)
   - **不要**改 ProductionBatch Entity
5. 加单元测试: 给定 productTypeId X 有 5 个 product_work_process 配置, GET /product-work-processes 应返回 5 条
6. 加 E2E 验证: 本地跑一次完整流程, 截图 before/after

**产出**: Day 11 STATUS + 修复定位

### Day 12 — 工序 bug PR

**目标**: ship 项目 3 PR

**动作**:
1. 写测试 (单元 + E2E)
2. 自测全跑过
3. PR: `[Track-D] Bug 修: 生产工序"通用 P 过来"未关联 (#567 follow-up + #622/#623 close)`
4. 在 PR body 中 link #567 / #622 / #623 状态

**产出**: 工序 bug PR open

### Day 13 — Bug 修: BOM 物料选择器

**目标**: 复现 + 设计 Select 模态框

**动作**:
1. 复现: 在 Day 4 写的 BomEditorScreen 中, 如果还是手写 materialName, 改成 Select 弹窗
2. 看 `MaterialSpecManagementScreen.tsx` — 现有原料管理页, 了解 raw_material_types 字典结构
3. 创建 `MaterialSelectModal.tsx` 复用组件 (放 `frontend/.../components/`):
   - Searchbar (按 name/code 模糊搜索)
   - 列表显示 raw_material_types: 编码 + 名称 + 默认单位
   - 点击返回选中的 materialTypeId + materialName + defaultUnit
   - 接口: GET /raw-material-types?q=X&page=1&size=50
4. 集成到 BomEditorScreen.tsx 的"添加原料"按钮 → 弹出 MaterialSelectModal → 选中后自动 fill materialName + materialTypeId + unit (default)
5. **校验**: materialTypeId 必填, 提交 BOM 时若空报 "请从字典选择原料"
6. 后端校验 (Day 3 已写 ConstraintViolation, 此处再确认): @NotBlank private String materialTypeId 已生效

**产出**: MaterialSelectModal + BOM 物料选 (不是手写)

### Day 14 — 物料 Select PR

**目标**: ship 项目 4 PR

**动作**:
1. 测试: BOM 创建/编辑只能从字典选, 手写无效
2. PR: `[Track-D] Bug 修: BOM 物料选择器 (字典 Select 替代手写)`
3. PR body: 含 before/after 截图

**产出**: 物料 Select PR open

### Day 15 — Bug 修: 单位转换强校验 (MaterialSpec + 后台折算)

**目标**: 原料字典层强制 g/kg, 后台支持自动折算

**动作**:
1. 修 `MaterialSpecManagementScreen.tsx`:
   - 原料定义页的"基本单位"input 改成 Select, 限定 ('g', 'kg', 'mg', 'ml', 'L', '个', '袋', '箱', '瓶', '盒')
   - 默认推荐 g (固体) / ml (液体)
   - 加 i18n: "请选择标准单位 (推荐 g 或 kg 便于全链路统一)"
2. 后端 `MaterialUnitConversionService` (现有, 不改): 验证 g↔kg / mg↔g / ml↔L / mg↔kg (1000000x) 都通
3. BOM 端 (Day 4 写的 BomEditorScreen) 加自动折算 UI:
   - 用户输入 "200 g" 时, 旁边自动显示 "(= 0.2 kg)"
   - 客户原话 line 263 "我在这写的克, 那我做调包的时候会自动折换成公斤" — 这意思是 BOM 用 g, 但实际拣货/采购单位是 kg, 后台自动折算
4. 库存出库 + 采购入库 跑全链路 (确认 ConversionService 在所有链路生效):
   - BOM 标准量 = 200 g, 库存出库 200g 或 0.2kg 都 OK
   - 找 `WarehouseService` / `PurchaseService` 等用 ConversionService 的地方, 确保没 bypass
   - **不修**业务逻辑, 只修单位 normalize 入口
5. 加 e2e 测试用例

**产出**: 单位强校验 + 折算链路验证

### Day 16 — 单位 PR + 整体收尾

**目标**: ship 项目 5 PR + 整体演示准备

**动作**:
1. PR: `[Track-D] Bug 修: 单位转换强校验 (原料字典 g/kg + 全链路自动折算)`
2. 整体 demo 视频脚本:
   - 系统管理 → 工序管理 → 新增 5 道工序
   - 产品工序配置 → 绑定到"猪蹄"
   - BOM 成本管理 → 原辅料配方 → 新建 → 选猪蹄 → "添加物料" → MaterialSelectModal → 选五花肉 (g) → standardQty 200 → yieldRate 80% → 实际 250g 自动算出
   - 生产计划 → 新建 → 选猪蹄 → 工序下拉自动出 5 道工序 (不再是"通用")
   - AIChat → "给红烧肉建 BOM, 五花肉 200g 出成率 80%, 老抽 5g, 糖 10g, 单份成品 150g" → 成功
3. 写 final STATUS update — 列举所有 5 个 PR + screenshot 链接
4. **不录 demo 视频**, 由 Organizer 录

**产出**: 5 项全 ship, Track D 完结

---

## §5 关键参考文档

### 5.1 必读 (按顺序)

| 优先级 | 文档 | 用途 |
|---|---|---|
| ★★★ | `宏见竞品分析/01-客户档案/SCHEMA_DESIGN.md` §2.5 (line 905-1115) | work_process_tasks 完整 spec (DDL + Entity + API + Tool) |
| ★★★ | `宏见竞品分析/01-客户档案/SCHEMA_DESIGN.md` §2.6 (line 1117-1419) | bom_recipes + bom_recipe_items 完整 spec |
| ★★★ | `宏见竞品分析/01-客户档案/六扇门第四次-May10.md` | 客户原话场景 (BOM 配方 + 工序 + 物料 Select + 单位转换最详细的客户语料) |
| ★★ | `.claude/rules/ai-intent-tool-skill-architecture.md` | AI Tool-Skill 架构规范, 加 AI Tool 必读 |
| ★★ | `.claude/rules/database-entity-sync.md` | PostgreSQL 严格 GROUP BY + parameter-side IS NULL CAST AS string |
| ★★ | `.claude/rules/field-naming-convention.md` | Java entity camelCase / DB snake_case / JSON camelCase |
| ★★ | `.claude/rules/api-response-handling.md` | 统一 `{success, data, message}` 格式, 禁降级 |
| ★ | `宏见竞品分析/03-审计过程/AUDIT_FRESH_C_CODE.md` | Cretas 代码现状, 知道哪些已 ship |
| ★ | `frontend/CretasFoodTrace/src/screens/restaurant/recipes/RecipeListScreen.tsx` | 你的参考实现 (餐饮端配方列表, 类似工厂端 BOM) |
| ★ | `CLAUDE.md` 项目根 | 全局规范快查 |

### 5.2 现有相关 PR (历史 context)

| PR | 摘要 |
|---|---|
| #297 | D2 BOM yield-rate UI preview + D3 g↔kg unit conversion — 部分 BOM 折算 UI 已 ship, 你可参考但本 track 重做主子表 |
| #312 | BomExpansionService 读 BomItem (RPF fallback) — 旧 BomItem 表的展开服务, 兼容期保留 |
| #311 | bom_items.unit standardization — A4 eager normalize, 单位 normalize 历史 |
| #293 | B1 工序 + B7 弹窗宽度 + B8 BOM 联动 quick wins — 历史 quick fix |
| #173 | 餐饮 P1 batch 一二级单位转换 — 餐饮端的单位转换历史 |
| #567 / #622 / #623 | "通用 P 过来"工序 bug 链路, **你 Day 11 需要看** |
| #455 / #466 | @PriceSensitive on BomItem.unitPrice + 16 sister fields — RBAC 单价隐藏, 你的 BomRecipeItem 也要加 |

### 5.3 现有 API/Service 现状 (代码地址)

- 后端 BOM Controller: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BomController.java` (旧, 服务 bom_items, **保持不动**)
- 后端 BOM Entity: `backend/.../entity/bom/BomItem.java` (旧主表), `BomChangeLog.java` (变更日志)
- 后端 WorkProcess Controller: `backend/.../controller/WorkProcessController.java` (已有, 不动)
- 后端 ProductWorkProcess Controller: `backend/.../controller/ProductWorkProcessController.java` (已有, 不动)
- 后端 ProductionBatch Entity: `backend/.../entity/ProductionBatch.java` (餐饮+工厂共享, **不动**)
- 后端 Conversion Service: `backend/.../service/conversion/` 内 (单位换算逻辑, **不动核心**, 只用)
- 前端餐饮 RecipeListScreen: `frontend/CretasFoodTrace/src/screens/restaurant/recipes/RecipeListScreen.tsx` (参考, 不动)
- 前端 MaterialSpec: `frontend/CretasFoodTrace/src/screens/management/MaterialSpecManagementScreen.tsx` (Day 15 修)

---

## §6 接口契约 (重点细节)

### 6.1 BomRecipe + BomRecipeItem 主子表

**主表结构** (照搬 SCHEMA_DESIGN line 1135-1183):
- 主键: `id VARCHAR(191)` (UUID, 用 `@PrePersist void assignUUID()`)
- `factory_id` + `product_type_id` + `version` 组合唯一 (partial index where deleted_at IS NULL)
- `is_current` partial unique (同 product 只 1 个 ACTIVE)
- 5 个 `@PriceSensitive` 字段: totalMaterialCost / totalLaborCost / totalOverheadCost / totalCost / standardSalePrice
- 状态: DRAFT / ACTIVE / ARCHIVED
- 来源: MANUAL / SAMPLE_AUTOGEN / AI_GENERATED / IMPORTED

**子表结构** (line 1186-1229):
- 主键: `id BIGSERIAL` (auto-increment)
- `recipe_id` FK to bom_recipes(id) ON DELETE CASCADE
- `material_type_id` FK to `raw_material_types(id)` ON DELETE RESTRICT (硬外键, 禁手写)
- `unit` CHECK IN ('g','kg','mg','ml','L','个','袋','箱','瓶','盒')
- `material_category` IN ('RAW', 'AUXILIARY', 'PACKAGING')
- 2 个 `@PriceSensitive`: unitPrice / itemCost

### 6.2 老 bom_items 兼容期策略

- **不 drop** 旧 `bom_items` 表
- migration V20260516_02 一次性把 bom_items 数据**复制**到 bom_recipes + bom_recipe_items (而不是 move)
- 保留 30 天 (观察期), 之后另起 V20260615_01__drop_bom_items.sql 才删
- 期间 `BomExpansionService` 仍然读 `BomItem`, 但你的新 `BomRecipeService` 写新表
- 旧 BomController 端点 (`/api/mobile/{factoryId}/bom/items`) 保留, 新端点是 `/api/mobile/{factoryId}/bom/recipes`
- **不要** 删 `BomItem.java` Entity

### 6.3 WorkProcess + ProductWorkProcess API (现有, 不动)

只需了解 (调 from 前端):
- GET `/api/mobile/{factoryId}/work-processes` — 列出工序定义
- POST `/api/mobile/{factoryId}/work-processes` — 新增工序定义 (Day 7 工序新增页用)
- GET `/api/mobile/{factoryId}/product-work-processes?productTypeId=X` — 查产品×工序绑定
- POST `/api/mobile/{factoryId}/product-work-processes` — 新增绑定

### 6.4 WorkProcessTask API (你 Day 9 新建)

照 SCHEMA_DESIGN line 1093-1101:
- POST `/api/mobile/{factoryId}/production/batches/{batchId}/spawn-tasks` — 从模板生成任务
- GET `/api/mobile/{factoryId}/work-process-tasks?batchId=X&status=PENDING` — 列表
- GET `/api/mobile/{factoryId}/work-process-tasks/{id}` — 详情
- PUT `/api/mobile/{factoryId}/work-process-tasks/{id}/start` — PENDING → IN_PROGRESS
- PUT `/api/mobile/{factoryId}/work-process-tasks/{id}/complete` — IN_PROGRESS → COMPLETED (必填 actualQuantity)
- PUT `/api/mobile/{factoryId}/work-process-tasks/{id}/skip` — 任意 → SKIPPED (notes 必填, 主管权限)
- PUT `/api/mobile/{factoryId}/work-process-tasks/{id}` — 修改 (分配责任人/计划时间)
- DELETE `/api/mobile/{factoryId}/work-process-tasks/{id}` — 软删

### 6.5 单位转换 Service 接口 (现有 ConversionService, 不动)

- 现有 `MaterialUnitConversionService` 在 `backend/.../service/conversion/` 内
- 提供 `convert(value, fromUnit, toUnit)` 方法
- 内部用 `material_unit_conversions` 表存基础换算关系 (g↔kg=0.001, mg↔g=0.001, ml↔L=0.001)
- **你不修这个 service**, 只在 BomCostCalculationService + Day 15 的库存/采购入口确保所有 unit 都先 normalize 一遍 (调用此 service)

### 6.6 AIChat Tool 命名建议

照 SCHEMA_DESIGN line 1408-1416 + line 1106-1112:

**BOM** (6 个):
- `bom_recipe_create_from_text`
- `bom_recipe_create_from_sample`
- `bom_recipe_clone_with_modify`
- `bom_recipe_cost_calculate`
- `bom_recipe_activate` (WRITE preview)
- `bom_recipe_query`

**工序** (5 个):
- `work_process_task_spawn`
- `work_process_task_start`
- `work_process_task_complete`
- `work_process_task_assign`
- `work_process_config_update` (WRITE preview)

**Tool 类命名**: `XxxTool extends AbstractBusinessTool`, `@Component` 自动注册。

### 6.7 ProductionBatch Entity Fork (跟 Organizer 协调)

`ProductionBatch` 单表服务餐饮+工厂双主线。Day 9 spawn_tasks 时, batch 关联 5 个新工序任务, 但 ProductionBatch Entity **不需要加新字段** (task 单方面 FK 过来即可)。

**若发现确需改 ProductionBatch.java**:
1. STOP 你的修改
2. 在 STATUS 写 blocker: "Day X 发现需在 ProductionBatch 加 XXX 字段, 原因 YYY"
3. ping Organizer, 让 organizer 决定:
   - 加字段 (短期解决, fork 推迟)
   - fork (长期方案, 但跨 chat 协调)
4. **不擅自动手**

---

## §7 PR / Status Update 流程

### 7.1 每日 STATUS 同步

每天在 `宏见竞品分析/04-最终决策/STATUS/TRACK_D_STATUS.md` 追加 1 段 (如果文件不存在, 你自己创建):

```markdown
## Day N (YYYY-MM-DD)
- ✅ 完成: 项目内容 X / Y / Z
- 🟡 进行中: 项目 A (剩 N%)
- ❌ Blocker: 描述 (需 organizer 协调)
- 明日计划: 项目 B / C
```

Organizer 每天 review 你的 STATUS。

### 7.2 PR 流程

**每完成 1 项 sub-project 即 PR 1 次** (总共 5 个 PR), 不要憋大爆炸:
1. 起 branch `feature/asap-track-d-{编号}` (如 `feature/asap-track-d-m-bom-1`)
2. PR 标题: `[Track-D] N# 编号 项目名` (本 brief 用 M-BOM-1 / M-WP-1 / M-WP-2 编号)
3. PR body 模板:
   ```
   ## Summary
   - 项目: M-BOM-1 BOM 配方编辑 UI (工厂端)
   - 涉及文件: (列举 ~10 个关键)
   - 测试方式: 本地 BomEditorScreen 截图 + AIChat demo
   - 风险点: bom_items 兼容期双写考虑

   ## Test plan
   - [ ] 本地 cretas_db migration 跑通
   - [ ] 单元测试 PASS
   - [ ] 工厂端能创建 + 编辑 + 激活 BOM
   - [ ] AIChat 一句话建 BOM 跑通

   🤖 Generated with Claude Code
   ```
4. Push 前在自己 worktree 内**两次 git status** (本 brief §3 + `.claude/rules/concurrent-edit-safety.md` 强调) 确保没意外文件
5. 推送后跟 Organizer 说"PR open, 等 review"
6. Organizer review + merge

### 7.3 大改动先 ping (必须)

以下情况**必须先 ping Organizer**:
- BOM 主子表迁移 (Day 2 第一次 push 前) — schema 大改动, organizer 拍板 migration 时机
- ProductionBatch Entity fork (任何动作前) — 跨 track 共享 Entity
- 你想改 §3.3 共享文件中的某个 (改 navigation.ts 加 screen 不需要 ping, 改字段类型需要)

### 7.4 碰到 Blocker

任何 unknown / 阻塞 → STATUS 写 "❌ Blocker: ...", organizer 帮你解决。

---

## §8 不要做

### 8.1 不要 refactor BOM 整体架构

- 旧 BomController / BomItem 兼容期还在用, 30 天后才删
- 不要把 BomItem 重命名 / 改字段 / 改 Repository 签名 — 别的 service (BomExpansionService, BomChangeLog 等) 会炸
- 新功能全部在 `BomRecipe` + `BomRecipeItem` 上做

### 8.2 不要改 ProductionBatch Entity

- fork 决策需 organizer 拍板 (餐饮 vs 工厂语义差异问题)
- 你 Day 9 spawn_tasks 时, work_process_tasks 单方面 FK 过来即可
- 若发现确需改, ping organizer

### 8.3 不要写新 N# 编号

- 现有编号 M-BOM-1 / M-WP-1/M-WP-2 已映射到 SCHEMA_DESIGN
- 不要发明 D-XXX-1 之类新编号

### 8.4 不要破坏餐饮端 RecipeListScreen

- 餐饮端 `frontend/.../screens/restaurant/recipes/RecipeListScreen.tsx` 是你的**参考实现**
- 餐饮端不准动 — 餐饮客户继续用
- 工厂端做**独立**的 `BomConfigScreen` (不复用餐饮 Screen)

### 8.5 不要 bypass ConversionService

- 单位换算所有路径都走 `MaterialUnitConversionService` (现有)
- 你不要在 BomCostCalculationService 内自己 hard-code `1 kg = 1000 g`
- 通过现有 service 调用, 保持一致性

### 8.6 不要静默失败 / 降级处理

- 项目规范禁止: `.claude/rules/api-response-handling.md` 强调统一 `{success, data, message}` 格式
- BOM 校验失败 → 明确返回 `{success: false, message: "...", code: "BOM_VALIDATION_ERROR"}` + 前端 Alert
- 不要 try-catch 吞掉错误后返回假数据

### 8.7 不要硬编码 LLM key / DB 密码

- 凭证全部走环境变量 (`.claude/rules/CREDENTIAL-MANAGEMENT.md`)
- 你的 AI Tool 通过 `IntentExecutorServiceImpl` 间接调 LLM, 不直接拿 key

### 8.8 不要并发改同一文件

- 你跟 Track A/B/C 不会共享文件 (per §3.2 ownership)
- 但如果你开了 multi-worktree, 用 git worktree 隔离 (`.claude/rules/concurrent-edit-safety.md`)
- commit 前 `git status --short` 确认 staging 区只有预期文件 (规则 5)

---

## §9 验收清单 (Track D 完成判定)

### 9.1 5 项 sub-project 全 ship

- [ ] M-BOM-1: 工厂端能配置 BOM 配方 (主子表 + 出成率自动折算 + 物料 Select)
- [ ] M-WP-1 + M-WP-2: 工序管理 + 产品工序配置 + 生成工序任务 + 状态机
- [ ] Bug 3 (工序"通用 P"): 新建生产计划时工序下拉显示该产品配置的工序, 不再是"通用"
- [ ] Bug 4 (BOM 物料 Select): BOM 添加原料强制从 raw_material_types 字典选, 手写无效
- [ ] Bug 5 (单位强校验): 原料字典定义阶段强制 g/kg, BOM/库存/采购全链路自动折算

### 9.2 AIChat 一句话场景跑通

- [ ] "给红烧肉建 BOM, 五花肉 200g 出成率 80%, 老抽 5g, 糖 10g, 单份成品 150g" → bom_recipe_create_from_text Tool 触发 → BOM 创建
- [ ] "克隆 SKU-201 的 BOM 但减 10% 包材" → bom_recipe_clone_with_modify
- [ ] "给猪蹄加工序: 拆包→分割→卤制→分切→装筐" → 一句话配置完成
- [ ] "给批次 BAT-001 跳过质检工序, 原因: 客户加急免检" → work_process_task_skip

### 9.3 客户实测场景跑通

- [ ] 客户原话 "我做这个珠奇一个成品是 200 克, 出成率是 58%, 自动折算" → BomEditorScreen 实时折算 preview
- [ ] 客户原话 "物料名称是要手写吗?" → MaterialSelectModal 弹窗
- [ ] 客户原话 "统一单位, 公斤" → 原料字典强制 g/kg
- [ ] 客户原话 "工序流程: 拆包→分割→卤制" → 产品工序配置 + 任务生成

### 9.4 不破坏现有

- [ ] 旧 BomController 端点 + BomItem 表 30 天内仍正常 (兼容期)
- [ ] 餐饮端 RecipeListScreen 没动
- [ ] ProductionBatch Entity 没动
- [ ] 现有生产业务不破坏 (生产计划创建/批次启动/批次完成 link OK)

### 9.5 5 个 PR 全 merge

- [ ] PR 1: `[Track-D] M-BOM-1 BOM 配方编辑 UI (工厂端)` merged
- [ ] PR 2: `[Track-D] M-WP-1/M-WP-2 工序管理 + 产品工序配置` merged
- [ ] PR 3: `[Track-D] Bug 修: 生产工序"通用 P 过来"未关联 (#567 follow-up)` merged
- [ ] PR 4: `[Track-D] Bug 修: BOM 物料选择器 (字典 Select 替代手写)` merged
- [ ] PR 5: `[Track-D] Bug 修: 单位转换强校验 (原料字典 g/kg + 全链路自动折算)` merged

---

## §10 客户场景对照表

| 客户原话 | 我的实现 | 涉及项目 | 涉及代码 |
|---|---|---|---|
| "物料名称是要手写吗?" (line 217) | MaterialSelectModal 弹窗从 raw_material_types 选 | 项目 4 | BomEditorScreen + MaterialSelectModal |
| "比如说我这个是 200 克, 那我可能就写个 200, 这个最好加个单位" (line 230) | standardQuantity input + unit Select (限定 g/kg/...) | 项目 1 + 5 | BomEditorScreen 行内字段 |
| "尽量单位是克, 然后 200 克, 200 克我的出成的话是 58%" (line 232) | yieldRate 字段 (DECIMAL 6,2, CHECK 0-100) | 项目 1 | BomRecipeItem.yieldRate |
| "我做这个珠奇一个成品是 200 克, 那我就写个 200 克, 那么我出生率是 58%, 自动折算的话就是 250.58" (line 268) | calculateActualQuantity = standard / (yield/100); 200/0.58=344.83 (注: 客户口误"250.58", 按数学公式) | 项目 1 | BomCostCalculationService + BomEditorScreen preview |
| "可以后台自动折算, 比如说我在这写的克, 那我做调包的时候会自动折换成公斤" (line 263) | 后端 ConversionService 自动 g↔kg 转换, 全链路统一 | 项目 5 | MaterialUnitConversionService (现有) |
| "如果不能自动折算的话, 是统一单位比较好一点" (line 259) | 原料字典强制 ('g','kg','mg','ml','L','个','袋','箱','瓶','盒') | 项目 5 | MaterialSpecManagementScreen unit Select |
| "工序管理, 哦, 看到了。产品, 产品工序配置是吧?" (line 60-66) | WorkProcessListScreen + ProductWorkProcessConfigScreen | 项目 2 | 2 个新 screen |
| "第一个工序叫拆包... 工序我选前处理, 然后产出单位是工金, 然后下面是预估工时" (line 77-78) | WorkProcessCreateScreen 表单字段 (name + category select + outputUnit + estimatedMinutes) | 项目 2 | WorkProcessCreateScreen |
| "工序流程就是拆包, 分割, 卤制, 拆股, 分配" (line 104) | 产品工序配置 → 5 道工序绑定到"猪蹄" | 项目 2 | ProductWorkProcessConfigScreen |
| "回到宣传计划, 然后新建计划, 订单, 产品行, 注射, 叮咚, 工序, 哎, 这工序还是只有通用" (line 95) | 生产计划工序下拉自动 GET /product-work-processes?productTypeId=X 注入 | 项目 3 | 生产计划新建页 + #567 follow-up |
| "门枪没有添加的, 我看没有添加, 就是在产品工序配置里面还得添加" (line 99) | 引导客户先在产品工序配置加, 然后生产计划自动出 | 项目 2 + 3 | UX 引导 |

---

## §11 风险 + 应急

### 11.1 已知风险

| 风险 | 缓解 |
|---|---|
| BOM 主子表迁移破坏现有 BomExpansionService | Day 2 兼容期保留旧表, BomItem 同步双写观察期 30 天 |
| ProductionBatch 餐饮/工厂语义混乱 | fork 决策推迟到 organizer 拍板, 本 track 不动 |
| 单位换算字典在不同地方 hard-code | 全部通过 MaterialUnitConversionService 调用, 不重复定义 |
| 工序"通用 P"bug 牵扯到 ProductionPlan / ProductionBatch / Dispatcher 多模块 | Day 11 先复现, 定位最小修复点, 不扩大 scope |
| AIChat Tool 跟现有 337 tool 名字冲突 | 起名前 grep `getToolName()` 确认 unique |
| BomRecipe.id 是 String/UUID 而 BomRecipeItem.id 是 BIGSERIAL, mixed key 可能引混乱 | 文档清楚标明, JPA `@Column(name="id", length=191)` + `@PrePersist void assignUUID()` 保护 |

### 11.2 应急联系点

- **任何 blocker** → STATUS 写明, ping Organizer (Chat 1)
- **跑偏方向** → STATUS 写"我想做 X, 但是 Y, 请确认", organizer 反馈
- **碰到 Track A/B/C 文件** → STATUS 写, organizer 协调 (你不擅动)

---

## §12 启动 Checklist (Day 0)

接到本 brief 后, 你应该:

1. [ ] 读完整本 brief (10-20 分钟)
2. [ ] 读 SCHEMA_DESIGN.md §2.5 + §2.6 (15 分钟)
3. [ ] 读六扇门第四次会议 line 49-400 (10 分钟)
4. [ ] 浏览 `.claude/rules/` 7 个核心规范文件 (10 分钟)
5. [ ] 起 git worktree: `git worktree add ../my-prototype-logistics-track-d -b feature/asap-track-d HEAD`
6. [ ] 创建 STATUS 文件: `宏见竞品分析/04-最终决策/STATUS/TRACK_D_STATUS.md` 写 Day 0 onboarding 完成
7. [ ] 找 organizer 报到: "Track D 收到 brief, Day 1 开始 M-BOM-1 spec 吸收 + 现状 audit"
8. [ ] Day 1 开干

---

**祝顺利。任何疑问 ping Organizer (Chat 1)。**
