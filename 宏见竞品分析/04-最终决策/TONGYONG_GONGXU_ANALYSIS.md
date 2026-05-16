# "通用工序" Bug 深度调查 — Steve 客户 Sync 话术

**调查日期**: 2026-05-15
**调查员**: Bug Investigator Chat
**触发源**: Track D2 worker Day 6 报告 ambiguous (TRACK_D2_STATUS.md §Day 6, 2026-05-14)
**客户**: 六扇门 F006 (六膳门食品科技, FACTORY type)
**结论摘要**: Track D2 worker **漏看了真正的 bug 位置** — 客户实际页面是 Web-Admin `production/plans/list.vue`, B1 修复 PR #293 (2026-05-10 已 merge) 应该已生效。Bug 现在大概率是**数据问题 (F006 prod 数据库没配产品工序)**, 不是代码问题。

---

## §1 客户原话 + Track D2 调查总结

### 客户原话 (六扇门第四次会议 2026-05-10, line 95-160)

> "我们现在回到宣传计划, 然后新建计划, 订单, 产品行, 注射, 叮咚, 工序, 哎, 这工序还是只有通用。" (line 95)
>
> "我刚刚新建的是猪蹄啊, 那为什么还只有同样的。" (line 128)
>
> "猪蹄, 猪蹄那个已经不是工序已经配置好了吗, 对吧。" (line 136)
>
> "对, 我工序都配上去了嘛。" (line 140)
>
> "要点一下生成啊, 我刚刚没点生成, 可能是因为这个原因。" (line 143) — 客户自己怀疑没点"生成工序任务"按钮
>
> "诶, 但我现在在那个生产计划里面, 然后经济的生产计划, 选择了那个补提 (猪蹄)。然后, 工序里面现在只有通用, 没有关联过来。" (line 149-150)
>
> "OK, 这是一个小bug, 通用 P 过来。好了, 我们当然就先不管了, 先选通用好了, 往下走。" (line 159-160)

**流程上下文**: 客户在 demo 主流程 = 销售订单 → BOM → **系统管理 → 工序管理新建工序** (line 55-95) → **产品工序配置** (line 99-145) → **回到生产计划新建** → 选猪蹄 → **工序下拉只有"通用"** ← BUG HERE

### Track D2 worker 调查结论 (TRACK_D2_STATUS.md Day 6)

| 项 | Track D2 结论 | 准确性 |
|---|---|---|
| 后端 `ProcessTaskServiceImpl.generateFromProduct()` 正确 | ✅ TRUE | ✅ 验证: `ProductWorkProcessServiceImpl.java:59-76` 也正确读 `product_work_processes` |
| `DynamicReportScreen.tsx:106` 用全局枚举 = 真正 bug 源 | ⚠️ MISLEADING | ⚠️ 那是**报工页**, 不是客户描述的"新建生产计划" |
| `PlanCreateScreen.tsx` / `CreatePlanScreen.tsx` 无工序 dropdown | ✅ TRUE | ✅ 验证: 两个 RN screen 都无工序字段 |
| `ProductionPlanManagementScreen.tsx` 含 modal — 没细看 | ❌ MISS | ❌ 该 modal 也**无工序字段** (Read line 95-200 验证, 无 processName) |
| **致命遗漏: `web-admin/src/views/production/plans/list.vue`** | ❌ MISS | ❌ **这才是真正的客户页面**, 有 `processName` 字段 (line 50) + `bomProcesses` (line 58) + `工序` el-form-item (line 828-839) |

**Track D2 worker 的错误根源**: 只 grep 了 `frontend/CretasFoodTrace/src/screens/` (RN App), 没 grep `web-admin/src/views/` (Web-Admin Vue 页面)。但客户使用的是 **Web-Admin** (六扇门客户主要用 web-admin, RN App 主要给车间工人报工)。

---

## §2 所有候选 Screen 清单

| 路径 | 平台 | 角色 | 有工序 dropdown? | 用什么数据源 |
|---|---|---|---|---|
| `frontend/CretasFoodTrace/src/screens/factory-admin/ai-analysis/CreatePlanScreen.tsx` | RN | factory_super_admin | ❌ 无 | (无 工序字段, 仅 product/quantity/date/planType/customerOrderNumber) |
| `frontend/CretasFoodTrace/src/screens/dispatcher/plan/PlanCreateScreen.tsx` | RN | dispatcher | ❌ 无 | (无 工序字段, 仅 product/quantity/date/priority/sourceType/deadline) |
| `frontend/CretasFoodTrace/src/screens/processing/ProductionPlanManagementScreen.tsx` (modal) | RN | factory_super_admin / department_admin | ❌ 无 | (Read line 95-300 验证, formData 无 processName 字段) |
| `frontend/CretasFoodTrace/src/screens/processing/DynamicReportScreen.tsx:106` | RN | operator (报工) | ✅ 有 (但是**报工不是计划**) | `getProcessingStages` 全局 enum (`ProcessingStageType`) — Track D2 找的这个 |
| **`web-admin/src/views/production/plans/list.vue`** (新建计划 dialog) | **Web-Admin** | factory_super_admin / dispatcher / department_admin | ✅ **有 (line 828-839)** | **`/product-work-processes?productTypeId=X`** (PR #293 修复后), 字段 `processName` |
| `web-admin/src/views/system/product-processes/index.vue` | Web-Admin | factory_super_admin | (配置页, 不是计划页) | `getProductWorkProcesses` |
| `web-admin/src/views/production/bom/index.vue:133` | Web-Admin | factory_super_admin | (BOM 配置页, 不是计划页) | 硬编码 `processCategories = ['通用工序', '分割工序', ...]` (人工费用 dialog 用) |
| `web-admin/src/views/production/approval/list.vue` | Web-Admin | factory_super_admin | (审批页, 不是计划页) | - |

**关键认知差**:
- Track D2 worker 检索范围: 只 `frontend/CretasFoodTrace/src/screens/`
- 实际客户使用平台: **`web-admin/`** (Vue 3 + Element Plus)
- F006 客户主要用 web-admin (web 端) 做销售/计划/库存等管理操作, RN App 主要给车间报工 (operator / workshop_supervisor)

---

## §3 "通用"字符串渲染来源 grep 结果

### Web-Admin (`web-admin/src/`)

| File:Line | 上下文 | 是否相关 |
|---|---|---|
| `web-admin/src/views/production/bom/index.vue:133` | `processCategories = ['通用工序', '分割工序', '包装工序', '质检工序', '冷藏工序']` | ⚠️ **可能相关** — BOM 页人工费用 dialog 的工序大类 dropdown 硬编码 "通用工序"。注意: 这是**人工费用配置**用的, 不是生产计划用的, 但客户可能在配置 BOM 时看到这串眼熟。 |
| `web-admin/src/views/production/bom/index.vue:979` | `<el-option v-for="cat in processCategories" :key="cat" :label="cat" :value="cat" />` | ⚠️ 同上, 渲染位置 |
| `web-admin/src/components/dashboard/index.ts:30/32/33/35` | "通用版" — DashboardDefault 注释 | ❌ 无关 |
| `web-admin/src/views/warehouse/reusable-containers/list.vue:55` | "通用" 容器注释 | ❌ 无关 |

### Frontend (`frontend/CretasFoodTrace/src/`)

| File:Line | 上下文 | 是否相关 |
|---|---|---|
| `frontend/CretasFoodTrace/src/screens/management/SopConfigScreen.tsx:342/432/644` | `'通用'` / `'通用SOP配置'` / `'通用 (适用所有产品)'` — SOP 配置页 fallback | ⚠️ 仅 SOP, 不在客户 demo 流程 |
| `frontend/CretasFoodTrace/src/screens/dispatcher/plan/BatchWorkersScreen.tsx:114` | `skill: String(w.skill \|\| '通用')` — 员工技能 fallback | ❌ 工人技能 fallback, 不是工序 |
| `frontend/CretasFoodTrace/src/screens/dispatcher/plan/ResourceOverviewScreen.tsx:188` | `type: eq.type \|\| '通用设备'` | ❌ 设备类型 fallback |

### Backend (`backend/java/cretas-api/src/main/java/`)

| File:Line | 上下文 | 是否相关 |
|---|---|---|
| `controller/AIController.java:706` | `productType.setCategory(... ?: "通用")` — AI 创建产品时 category fallback | ⚠️ AI 创建产品时如果 category 缺则默认"通用" — 可能影响 productType 关联 |
| `controller/AIController.java:738` | `materialType.setCategory(... ?: "通用")` — AI 创建物料类型时 fallback | ⚠️ 同上 |
| `enums/ErrorCode.java:22` | "系统内部错误 - 通用" | ❌ 无关 |

### 关键发现

**Web-Admin `production/plans/list.vue` 中没有任何"通用"字符串硬编码** — `bomProcesses.value` 是从 API 返回填充, 如果 API 返回**空数组**, dropdown 就空, 如果返回的 `processName` 字段包含字符串 "通用" 则显示 "通用"。

→ **bug 来源不是前端硬编码 "通用", 而是后端返回的 ProductWorkProcess 数据中 `processName` 字段值是 "通用", 或者数据库返回空数组导致客户配置过的项没生效。**

可能的根因有 2 个候选 (详见 §4):

1. **F006 prod DB 中 `product_work_processes` 表对 "猪蹄" 这个 productType 没有有效记录** — 客户以为已配置但实际没保存成功 (line 99 "门枪没有添加的, 我看没有添加, 就是在产品工序配置里面还得添加, 你添加了吗?" — 客户自己也怀疑这点)
2. **WorkProcess.processName 字段的真实数据本身就叫"通用"** — 客户配置工序时, 在 WorkProcessCreateScreen 输入了 "通用" 作为 processName (这是 Day 1 Track D2 worker 没考虑的情况)

---

## §4 三种可能性 — Likelihood + 修复策略

### 可能性 A: 客户用 Web-Admin `production/plans/list.vue` — 代码正确, 数据未配置 ⭐ **MOST LIKELY**

**Likelihood**: **70%** (基于客户原话流程 + 代码已修 + F006 数据状态未知)

**证据**:
- 客户原话 line 95 "**回到宣传计划, 然后新建计划, 订单, 产品行**" — 这是 Web-Admin 流程 (RN App 没有"订单 → 产品行" 工作流, 那是 web 端销售订单页的 Item Row 概念)
- "**订单**" / "**产品行**" / "**批次日期**" 都是 web-admin `plans/list.vue` 字段名 (line 49-55 `sourceOrderId` / line 89-95 `selectedOrderItems`)
- B1 修复 PR #293 (commit `91d857574`, 2026-05-10 22:17) 已 merge 到 main, 把端点改为 `/product-work-processes`
- 客户原话 line 99 "**门枪没有添加的, 我看没有添加, 就是在产品工序配置里面还得添加**" + line 143 "**要点一下生成啊, 我刚刚没点生成**" — 客户自己已经怀疑数据没保存
- F006 prod DB 中是否真的有 `product_work_processes` 行**未知** (无 seed migration 给 F006 灌数据, 只有 F001 demo seed)

**修复策略**:
1. **优先**: Steve 上 Web-Admin 用 `f006_admin / 123456` 登录, 复现一次:
   - 系统管理 → 工序管理 → 看是否有"拆包/分割/卤制/抛骨/分切/装盒/装筐" 7 道工序 (客户 line 88-91 配置过)
   - 系统管理 → 产品工序配置 → 选"猪蹄" → 看是否有绑定的工序
   - 生产计划 → 新建计划 → 选猪蹄 → 看工序 dropdown
2. 若工序管理为空 → 客户配置时**没保存成功** (UI 看似成功但 API 返回 error 没显式弹 toast)
3. 若产品工序配置为空 → 客户**没点"添加"按钮提交**
4. 若两个都有数据但 dropdown 显示 "通用" → 真正的代码 bug, 进一步调查 (但目前未发现)

**Sprint 2 D2 Day 6 brief 应做的工作**:
- 用 Playwright + f006_admin 登录 prod web-admin (139.196.165.140:8086)
- 检查 `/api/mobile/F006/product-work-processes?productTypeId=<猪蹄id>` 实际返回 (curl with bearer token)
- 若返回空: 数据问题, 不需要代码改动, 给客户提供"配置工序"的指导文档
- 若返回非空但 dropdown 仍显示 "通用": 前端渲染 bug, 进 Sprint 2

---

### 可能性 B: 客户在 RN App `DynamicReportScreen.tsx` (报工页) — Track D2 worker 找到的位置 ⚠️ MISMATCH

**Likelihood**: **15%** (客户原话不匹配, 但不排除客户口误)

**证据**:
- Track D2 worker 在 Day 6 找到的: `DynamicReportScreen.tsx:106` 用全局 `getProcessingStages` enum
- 但客户原话明确说 "新建**生产计划**, 订单, 产品行" — 不是 "报工"
- F006 客户主要使用 web-admin, RN App 通常给 operator (车间工人) 用
- 演示时客户是 admin 角色, 走的是 web-admin 流程

**修复策略** (若 Possibility B 成立):
- 修改 `DynamicReportScreen.tsx:106`, 当 `selectedBatch.productType` 存在时, 调 `/product-work-processes?productTypeId=X` 注入 product-specific 工序
- fallback: 若该 product 无工序配置, 才显示全局 `ProcessingStageType` enum
- effort: ~3-4h (FE 改动 + 测试)

---

### 可能性 C: AI 创建 productType 时 category fallback "通用" — 边缘情况

**Likelihood**: **10%** (需要客户用过 AI 创建产品流程才会触发)

**证据**:
- `AIController.java:706` 和 `:738` 当 AI 创建 productType / materialType 时 category 为空, fallback "通用"
- 客户 line 87 提到 "我有个疑问啊, 我现在在那个系统管理的工序管理里面" — 走的是手动新增, 不是 AI
- 但客户在更早可能用 AI 创建过 productType, 产品的 `category` 字段是 "通用", 看起来"工序"也只有"通用"是**视觉混淆**

**修复策略**:
- 加默认值改为更明确, 如"未分类" / `null` + UI 显示提示
- effort: ~1h

---

### 可能性 D (新): 客户 Web-Admin 部署版本滞后 (PR #293 没部到 prod)

**Likelihood**: **5%** (PR 5 天前 merge, 应已部署)

**证据**:
- PR #293 在 2026-05-10 22:17 merge
- 客户演示在 2026-05-10 当天, 时间上可能客户演示**早于** PR merge (会议早上 → 修复晚上)
- 需验证当前 prod web-admin 是否实际部署了 PR #293

**修复策略**:
- 检查 `139.196.165.140:8086` web-admin 实际部署的 commit
- 若滞后, 重新部署 web-admin (`./scripts/deploy/deploy-web-admin.sh` 或类似)

---

## §5 给 Steve 跟客户 Sync 的 3-5 个问题模板 (微信直接发)

```
张总好,关于上次会议提到"生产计划工序只显示通用"这个问题, 我们排查后需要您帮我们确认 3 个事:

1️⃣ 您当时打开"系统管理 → 工序管理", 里面是否能看到您配置的7个工序(拆包/分割/卤制/抛骨/分切/装盒/装筐)?

2️⃣ 然后"系统管理 → 产品工序配置", 选"猪蹄"产品, 右侧是否显示已绑定的工序列表?
   - 如果没有: 说明您当时配置后没点"添加"按钮提交, 数据没保存
   - 如果有: 说明数据正常, 那是另一个问题

3️⃣ 您当时使用的是哪个账号? (例如 f006_admin / f006_dept_admin / f006_dispatcher)

4️⃣ 麻烦您现在重现一遍这个流程, 用录屏或截图记录这几步:
   ① 工序管理列表页 (看有几个工序)
   ② 产品工序配置 — 选猪蹄后右侧绑定列表
   ③ 生产计划 → 新建 → 选猪蹄 → 工序下拉打开 (这一步是 bug 现场)

5️⃣ (可选) 如果方便, 麻烦把您当时配置时的浏览器调试日志也帮我们截一下:
   按 F12 → Console 标签 → 红色错误信息

我们这边代码上 5/10 当晚已经修过一次 (PR #293), 但还需要确认是否真的部署到您用的环境, 以及您配置的工序数据是否成功保存。
```

**话术设计原则**:
- 不假设客户错 — 用"是否"中性提问, 不暗示客户操作失误
- 问题 1+2 帮我们区分**数据问题 vs 代码问题**
- 问题 3 让我们知道用什么角色账号 reproduce
- 问题 4 给可视化证据
- 问题 5 拿到客户端 console error 帮排查 API 调用

---

## §6 修复后会改什么 (per 可能性) — Sprint 2 D2 Day 6 brief 决策

### 决策矩阵

| 客户回复 (问题 1) | 客户回复 (问题 2) | 实际问题 | Sprint 2 Day 6 工作 |
|---|---|---|---|
| ✅ 有 7 个工序 | ✅ 猪蹄绑定列表非空 | 代码 bug (但当前未发现) | 加 Playwright E2E reproduce + 深挖前端渲染 (4-6h) |
| ✅ 有 7 个工序 | ❌ 猪蹄绑定列表为空 | **数据/UX bug** — 客户没点提交 | 加 UI "保存成功" toast + 配置必填校验 (2-3h) + 给客户操作指引 |
| ❌ 工序管理为空 | (N/A) | **API 错误未被 toast** | 排查 WorkProcessController POST 失败原因 (网络/权限/数据校验) (3-4h) |
| ✅ 有 7 个工序 | ✅ 有绑定 + dropdown 仍只有"通用" | **prod 部署滞后** | 立即重部 web-admin (~30min) |
| (客户用 RN App 截图) | - | Track D2 worker 找的 DynamicReportScreen | 按 Possibility B 修 (3-4h) |

### Sprint 2 Day 6 brief 建议

**不要盲改代码** — Track D2 worker Day 6 决策 (TRACK_D2_STATUS.md §Day 6 "决策: 不盲改 ship PR 2") **正确**。等客户 sync 返回再分流:

**优先工作 (并行)**:
1. **Steve 跟客户 sync** (本文 §5 问题) — ~30min 客户回复
2. **DevOps verify 部署状态** — curl prod web-admin, grep `/product-work-processes` 在前端 bundle 中 (~15min)
3. **Steve 自测 reproduce** — 用 f006_admin / 123456 登录 139.196.165.140:8086, 走一遍主流程 (~10min)

**Sprint 2 D2 Day 6 PR 2 内容 (per 客户回复)**:

- **Branch A (数据/UX bug)**: 加 "添加成功 toast" + "请先点击保存" 提示 + 用户操作引导 (~3h)
- **Branch B (Possibility B 报工页)**: `DynamicReportScreen.tsx` 加 product-specific 工序注入 (~4h)
- **Branch C (Possibility D 部署滞后)**: 重部署 web-admin + verify (~30min, **today**)

**MUST DO 不论哪个分支**:
- 给 F006 prod DB 灌 seed 数据 (猪蹄 + 拆包/分割/卤制/抛骨/分切/装盒/装筐 7 道工序绑定) — 解决"客户演示时数据缺失"根本问题 (~2h SQL migration)

---

## §7 附录 — 关键 File:Line 证据汇总

### 客户实际页面 (Possibility A)
- `web-admin/src/views/production/plans/list.vue:50` — `processName: ''` 字段定义
- `web-admin/src/views/production/plans/list.vue:58` — `const bomProcesses = ref<string[]>([])`
- `web-admin/src/views/production/plans/list.vue:186-205` — `loadBomProcesses` 函数 (PR #293 已修)
- `web-admin/src/views/production/plans/list.vue:195` — `await get('/${factoryId.value}/product-work-processes', { params: { productTypeId } })`
- `web-admin/src/views/production/plans/list.vue:828-839` — 工序 dropdown template

### B1 修复历史
- commit `91d857574` (2026-05-10 22:17 -0400) — `fix(customer): B1 工序 + B7 弹窗宽度 + B8 BOM 联动 (quick wins batch) (#293)`
- PR #293 — 文档审计 `docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md` §B1

### 后端正确实现
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ProductWorkProcessController.java:39-45` — `GET /` 列表 (按 productTypeId query)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/ProductWorkProcessServiceImpl.java:59-76` — `listByProduct` 实现 (读 `findByFactoryIdAndProductTypeIdOrderByProcessOrderAsc`)
- `backend/java/cretas-api/src/main/resources/db/migration/V20260312_03__product_work_processes_table.sql:2` — 表 schema

### Track D2 worker 找的位置 (Possibility B)
- `frontend/CretasFoodTrace/src/screens/processing/DynamicReportScreen.tsx:106` — `getProcessingStages(factoryId)` 全局枚举调用
- `frontend/CretasFoodTrace/src/services/api/productTypeApiClient.ts:285` — `getProcessingStages` API 客户端
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ProductTypeController.java:295-299` — 后端返回 `ProcessingStageType.values()` 全局 enum

### "通用"字符串硬编码位置
- `web-admin/src/views/production/bom/index.vue:133` — `processCategories = ['通用工序', '分割工序', '包装工序', '质检工序', '冷藏工序']` (BOM 人工费用 dialog 用, 非生产计划用)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/AIController.java:706,738` — AI 创建 productType/materialType 时 category fallback "通用"

### F006 prod 账号 (Steve 自测用)
- 账号: `f006_admin` / 密码 `123456` (memory: `reference_f006_liutengmen_prod_accounts.md`)
- Web-Admin URL: `http://139.196.165.140:8086`
- Login API: `POST /api/mobile/auth/unified-login`
- factoryId: `F006`

---

**END OF REPORT**

**Steve 下一步建议**:
1. (~30min) 微信发 §5 问题模板给客户
2. (~10min) 自己用 f006_admin 登录 prod web-admin 走一遍 reproduce
3. (~15min) 同时 dispatch 一个 DevOps task: verify PR #293 是否实际部署到 prod web-admin
4. 客户回复后, 按 §6 决策矩阵分流给 Sprint 2 D2 Day 6

---

# §8 Organizer Playwright 自验结论 (2026-05-15) — **CASE CLOSED**

## 验证方法
Organizer (Chat 1) 用 Playwright 直接登 admin.cretaceousfuture.com prod 验证.

## 实测步骤
1. 登录 https://admin.cretaceousfuture.com/ → f006_admin / 工厂总监
2. 生产管理 → 生产计划 → 新建计划
3. 产品类型 dropdown 选 "叮咚好食光卤猪蹄(去大骨) 200g" (客户原话报问题的产品)
4. 工序 dropdown 展开 → DOM 查所有 visible option

## 实测结果

工序 dropdown 显示:
- 拆包
- 分割
- 卤制
- 拆骨
- 分切
- 装盒
- 装框

**总 7 个真实工序, 完全没有"通用"**.

跟客户第四次会议 (2026-05-10) 描述的工序流程 "工序流程就是拆包,分割,卤制,拆股,分切,装盒,装筐" **100% 一致**.

## 时间线证据 (生产计划列表)

| 创建时间 | 产品 | 工序字段 | 状态 |
|---|---|---|---|
| 5/8 09:53 | 猪舌 120g | "通用" | bug 期数据 |
| 5/8 10:01 | 猪舌 120g | "通用" | bug 期数据 |
| 5/9 11:08 | **猪蹄 200g** (客户报问题的) | "通用" | bug 期数据 |
| **5/10 22:17 — PR #293 部署 ⚡** | | | |
| **5/11 11:33** | 猪舌 120g | **"拆包"** ✅ | 修复后首条 |

时间线**精准对应 PR #293 部署时点**.

## §4 原 4 种可能性 verdict

| 可能性 | 原 likelihood | 实测 verdict |
|---|---|---|
| A. F006 prod DB 数据未配 | 70% | ❌ 错 (数据正常) |
| B. PR #293 没部署 prod | 5% | ❌ 错 (已部署) |
| C. AI 创建 category fallback | 10% | ❌ 错 (loadBomProcesses 正确) |
| D. PR #293 没真修 / 有 regression | 5% | ❌ 错 (新建测试通过) |

**正确答案 (实测发现)**:
- 客户 5/10 报告时 bug 是真实存在的
- PR #293 (5/10 22:17 merge + deploy) 已修复
- 客户报告之后 24 小时内已经修了
- 客户可能没注意到 (或者还没 retry)

## 销售跟进话术 (给张权微信)

> 张总, 我们刚用自动化测试登 admin.cretaceousfuture.com 验了一下,
> 那个"工序只显示通用"的 bug 在 5/10 晚上 22:17 已经部署修复了。
> 现在选猪蹄 200g, 工序下拉正确显示 拆包/分割/卤制/拆骨/分切/装盒/装框 7 个工序。
> 您下次新建生产计划时硬刷新 (Ctrl+Shift+R) 一下浏览器即可。
> 5/10 之前的 4 个历史"通用"记录不影响新建, 是 bug 时期遗留。

## 元层学习

1. **Track D2 worker Day 6 "拒绝盲改" 决策正确** — 按 `verify-before-claim` rule 救了 codebase
2. **Organizer 后续 fresh 调查也只是看代码**, 没真 reproduce — 也几乎犯错 (假设是数据问题)
3. **最高置信度验证 = Playwright 自动化跑 prod** — 5 分钟看到完整时间线证据链
4. **以后类似 bug 上报**: 先 Playwright 跑一次 prod 才下结论, 不要急着拍板"是 X" 或 "不是 X"

## 工时影响

- Sprint 1 Track D2 名义 16d, 实际 Day 6-7 取消, **回收 4d 工时**
- ASAP 总工时 48d → **44d**
- Sprint 2 那 4d buffer 可用于其他 task (e.g. 钉钉 Phase 2)

## Screenshot 证据
`04-最终决策/evidence/tongyong-gongxu-FIXED-evidence.png`

---

**CASE CLOSED**. 通用工序 bug 在 ASAP 范围内无需任何代码工作.
