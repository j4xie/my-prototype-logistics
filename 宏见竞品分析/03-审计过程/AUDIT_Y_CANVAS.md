# AUDIT Y — Cretas Canvas / 低代码 / 页面编辑器真实边界

**审计日期**：2026-05-14
**审计员**：Claude
**审计方法**：逐文件源码阅读 + Tool/Entity/API 路径串联 + 导航引用追溯

---

## TL;DR (verdict 总览)

| 子系统 | 真实状态 | Verdict |
|---|---|---|
| `lowcode/PageEditor.tsx` (1252 行) | **未挂导航，dead code**，无任何 caller 引用 | ❌ 仓库陈列品 |
| `factory-admin/home/HomeLayoutEditorScreen` | **真挂导航**（`FAHomeStackNavigator.tsx:113-121`），FAHome 长按→编辑器→保存→发布全链路真实 | ✅ 真实 |
| `BentoGridEditor` 拖拽+尺寸+可见性 | 真实，react-native-gesture-handler PanGesture，撤销/重做+网格碰撞重算都实现了 | ✅ 真实 |
| `AILayoutAssistant`（决策装饰路径） | 调 `/decoration/home-layout/ai-generate`，**但 backend 是 rule-based 不是 LLM** | ⚠️ 半假（UI 真，AI 假） |
| `pagedesign/PageGenerateTool` 4 个 Tool（决策低代码路径） | 真调 DashScopeClient LLM，真写 `lowcode_page_config` 表，**但前端 PageEditor 没挂导航看不见结果** | ⚠️ 后端真，前端废 |
| `decoration/HomeLayout*Tool` 3 个 Tool | 真调 DashScopeClient LLM，**但写到 `FactorySettings` 表**（不是 `factory_home_layout`，HomeLayoutEditor 读不到） | ❌ Tool 链断裂 |
| 通用「拖拽生成业务表单」 | 不存在 | ❌ |
| 通用「对话生成销售仪表盘」运行时 | FAHomeScreen 是 hard-coded switch `(module.type)`，只渲染 5 种类型 | ❌ 无运行时通用渲染器 |

---

## §1 Canvas 系统文件清单 + 真实能力评估

### 1.1 `lowcode/` 子系统（通用页面编辑器）

| 文件 | 行数 | 真实能力 | Verdict |
|---|---|---|---|
| `frontend/CretasFoodTrace/src/screens/lowcode/PageEditor.tsx` | 1252 | 完整设计器（左：组件库 / 中：2 列 BentoGrid Canvas / 右：属性面板 / 底：撤销重做+状态徽章）；支持 home/dashboard/list/detail/form 5 种 pageType | ⚠️ **未挂导航**：grep `PageEditor` 全仓 → 仅 `lowcode/index.ts` re-export 和测试，**0 个 navigation 文件引用**（`PageEditor.tsx:450-807`）。仓库陈列品 |
| `frontend/CretasFoodTrace/src/screens/lowcode/components/ComponentPalette.tsx` | 698 | 6 大类 15 个组件硬编码 `AVAILABLE_COMPONENTS`（stats_card / ai_insight / welcome_card / quick_actions / data_table / data_list / chart_bar / chart_line / chart_pie / form_input / form_select / form_date / layout_grid / layout_card / layout_divider）（`ComponentPalette.tsx:79-286`）。注释说 "Will be loaded from API in future" → 没用 API | ⚠️ 硬编码组件目录，未对接 `/lowcode/components` API |
| `frontend/CretasFoodTrace/src/store/pageConfigStore.ts` | 45 (re-export) | 实际 slice 拆分到 `store/pageConfig/`；含 `aiSlice.ts` 调 `lowcodeApiClient.aiGeneratePage` | ✅ store 真实 |
| `frontend/CretasFoodTrace/src/services/api/lowcodeApiClient.ts` | ~480 | 真实 HTTP client：CRUD `/lowcode/pages`、`/lowcode/components`；AI 操作经 `/ai/intent/execute` 走 intentCode 路由（`lowcodeApiClient.ts:338-440`） | ✅ 真实 |

**整个 lowcode/ 子树 verdict**：**实现完成度 90%，但前端无入口**。HTTP/store/UI 全都真，缺最后一根毛线 — 把 PageEditor 加到某个 Stack。

### 1.2 `factory-admin/home/` 首页装饰子系统（真实在用）

| 文件 | 行数 | 真实能力 | Verdict |
|---|---|---|---|
| `HomeLayoutEditorScreen.tsx` | 739 | 顶部时段切换 tab（默认/早间/午间/晚间，`HomeLayoutEditorScreen.tsx:49-54`），中间 BentoGridEditor 预览区，工具栏 AI 助手+撤销+重做+重置，底部草稿/发布按钮 | ✅ 真实，挂在 `FAHomeStackNavigator.tsx:113-121` |
| `BentoGridEditor.tsx` | 945 | 2 列 100px-cell BentoGrid（`BentoGridEditor.tsx:31-36`），PanGesture+LongPress+DoubleTap+Tap 复合手势（`BentoGridEditor.tsx:195-255`），4 种尺寸 1x1/2x1/1x2/2x2（`BentoGridEditor.tsx:58-63`），`recalculatePositions()` 重算避免重叠（`BentoGridEditor.tsx:127-170`）| ✅ 真实，react-native-reanimated + gesture-handler |
| `AILayoutAssistant.tsx` | 1153 | Modal+打字机效果+对话流+3 种 StylePreset（简洁高效/数据密集/操作优先，`AILayoutAssistant.tsx:93-115`）+ 4 个 QuickCommand（`AILayoutAssistant.tsx:118-139`）+ 自由输入 | ⚠️ UI 完美但底层 AI 是骗子（见 §1.3） |
| `ModulePropsEditor.tsx` | ~600 | 模块属性表单（开关/数字/选择/枚举），按 schema 动态渲染 | ✅ 真实 |
| `homeModuleSchemas.ts` | ~300 | 5 种模块的 schema 定义 | ✅ 真实但只覆盖 5 种 |
| `FAHomeScreen.tsx`（运行时渲染器） | ~400 | **硬编码 `switch (module.type)` 只渲染 5 种**：welcome / ai_insight / stats_grid / quick_actions / dev_tools（`FAHomeScreen.tsx:182-219`） | ❌ 不是通用渲染器，加新组件类型必须改代码 |

### 1.3 数据库表 + 真实存盘验证

| 表 | Entity | Repository | 真实写入 |
|---|---|---|---|
| `factory_home_layout` | `FactoryHomeLayout` (`entity/decoration/FactoryHomeLayout.java:28`) | `FactoryHomeLayoutRepository` | ✅ HomeLayoutEditor → `decorationApiClient.saveLayout` → `DecorationServiceImpl.saveDraft()` (`DecorationServiceImpl.java:127-141`) 真写 |
| `lowcode_page_config` | `LowcodePageConfig` (`entity/LowcodePageConfig.java:32`) | `LowcodePageConfigRepository` | ✅ Tool 链 + LowcodeController CRUD 真写，但 PageEditor 没挂前端入口 |
| `lowcode_component_definition` | `LowcodeComponentDefinition` | seeded by `V2026_01_14_02__add_lowcode_page_config_tables.sql:103-298` (7 个内置组件: stats_card / welcome_card / ai_insight / quick_actions / chart_bar / chart_line / data_table) | ✅ 数据库种子真实 |

---

## §2 pagedesign + decoration Tool 列表 + 真实可用性

### 2.1 `ai/tool/impl/pagedesign/` (4 个 Tool — LLM 真，前端废)

| Tool | toolName | 描述（截取） | doExecute 真实逻辑 |
|---|---|---|---|
| `PageGenerateTool` (`PageGenerateTool.java:30`) | `page_generate` | "AI生成页面布局配置..." (`:50-54`) | ✅ 真调 `dashScopeClient.chatLowTemp(systemPrompt, prompt)` (`:114`)；解析 JSON；保存到 `lowcode_page_config` 表 (`:228-254`) |
| `PageComponentAddTool` (`PageComponentAddTool.java:30`) | `page_component_add` | "向页面添加组件..." (`:50-53`) | ✅ 真 LLM + 真写 DB |
| `PageStyleUpdateTool` (`PageStyleUpdateTool.java:27`) | `page_style_update` | "更新页面样式和主题..." (`:43-47`) | ✅ 真 LLM + 真写 DB |
| `PageDataBindTool` (`PageDataBindTool.java:27`) | `page_data_bind` | "配置页面组件的数据绑定..." (`:43-47`) | ✅ 真 LLM + 真写 DB（写 `data_bindings` JSON 字段） |

**4 个 Tool 共同问题**：写到 `lowcode_page_config` 表，但前端 PageEditor 没挂导航（§1.1），客户用对话生成出来的页面**看不见**。

### 2.2 `ai/tool/impl/decoration/` (3 个 Tool — Tool 真但目标表错乱)

| Tool | toolName | doExecute 真实逻辑 | 致命问题 |
|---|---|---|---|
| `HomeLayoutGenerateTool` (`HomeLayoutGenerateTool.java:30`) | `home_layout_generate` | ✅ 真调 `dashScopeClient.chatLowTemp` (`:94`)；JSON 解析；`layoutValidator.validate` (`:106`) | ❌ 写到 **`FactorySettings`** (`:33`)，HomeLayoutEditor 读的是 `FactoryHomeLayout`，**Tool 的输出首页看不到** |
| `HomeLayoutUpdateTool` (`HomeLayoutUpdateTool.java:30`) | `home_layout_update` | ✅ LLM 解析"把 AI 洞察移到顶部" | ❌ 同上写到 `FactorySettings` |
| `HomeLayoutSuggestTool` (`HomeLayoutSuggestTool.java:27`) | `home_layout_suggest` | 规则推荐（不调 LLM）（`:65-78`） | ❌ 同上 |

### 2.3 致命矛盾：AILayoutAssistant 调的不是 Tool！

- 前端 `decorationApiClient.generateLayoutWithAI` → `POST /api/mobile/{factoryId}/decoration/home-layout/ai-generate`（`decorationApiClient.ts:43`）
- 后端命中：`DecorationController.generateLayoutWithAI` (`DecorationController.java:79-85`) → `DecorationServiceImpl.generateLayoutWithAI` (`DecorationServiceImpl.java:162-210`)
- **`DecorationServiceImpl.java:207` 显式 `modelUsed("rule-based")`**，第 524 行 `generateModulesFromRequest()` 只是按 `priorityModules` 排序+主题调色板调整，**完全没调 LLM**

→ AILayoutAssistant 看着像 ChatGPT 一样打字机回复 + 澄清问题 + 建议气泡，**但后端没接 LLM**。所谓"AI 一句话改首页"是骗局。

---

## §3 客户场景验证

### Q1: 客户能否「对话式建一个销售分析仪表盘」？

**答**：❌ 不能。
- LLM-driven 后端 (`PageGenerateTool`) 真存在，可写到 `lowcode_page_config` 表
- **但前端 PageEditor 没挂任何 navigation**，生成的页面无入口查看
- FAHomeScreen 是 5 种类型硬编码 switch（`FAHomeScreen.tsx:182-219`），加新 dashboard 组件类型需要改前端代码

### Q2: 客户能否「拖拽生成一张表单」？

**答**：❌ 不能。
- `ComponentPalette` 列了 form_input / form_select / form_date 3 个表单组件（`ComponentPalette.tsx:209-246`）
- **但运行时 FAHomeScreen.renderModuleByType (`FAHomeScreen.tsx:182-219`) 没有 form_* 的 case**，拖出来不会渲染
- 而 `lowcode/PageEditor.tsx` 设计期支持 form 但**没挂导航**
- `FormilyDemoScreen.tsx` 是**轮播演示**（`FormilyDemoScreen.tsx:7-10` 注释承认），不是真实表单构建器

### Q3: 客户能否「AI 一句话改首页布局」？

**答**：⚠️ 操作链通，但 AI 是假的。
- HomeLayoutEditor → AILayoutAssistant Modal → 输入 "把 AI 洞察移到顶部" → 调 `/decoration/home-layout/ai-generate`
- 后端是 rule-based 不是 LLM（`DecorationServiceImpl.java:207`）
- 真实 LLM-driven 的 `HomeLayoutUpdateTool` 存在但写到 `FactorySettings` 而非 `FactoryHomeLayout`，端到端断链

---

## §4 vs 宏见传统 ERP UI 范式对比

宏见 keyframes_v2 观察到的范式：左 12 模块菜单 + 中表格 + 顶 tab 二级导航 + 行级操作 + 模态弹窗 + 底部批量操作。

| 维度 | 宏见 | Cretas Canvas | Cretas 弥补方法 |
|---|---|---|---|
| **左侧固定菜单** | 12 模块硬编码 | FAHome 同样是硬编码 navigation tree | 无差异，Cretas 没有"客户自配菜单" |
| **中部表格** | DevExtreme/AG-Grid 风 | `ComponentPalette` 列了 `data_table`，**运行时不渲染** | ❌ Canvas 抵不过 |
| **顶部 tab 二级导航** | 真，TabBar 切换业务子区 | 无对应抽象 | ❌ Canvas 抵不过 |
| **行级操作（编辑/删除/复制）** | 表格内联 ActionButton 列 | 无（PageEditor 没 row-action 抽象） | ❌ Canvas 抵不过 |
| **模态弹窗（增改）** | 标准模式 | 各业务页面自己 hard-code | ❌ Canvas 抵不过 |
| **底部批量操作 bar** | sticky bottom bar | 无对应抽象 | ❌ Canvas 抵不过 |

**结论**：Cretas Canvas 当前只能做"卡片式 Bento 仪表盘"，**不能替代宏见的"表格驱动 CRUD 工作流"范式**。

---

## §5 Cretas Canvas 真实优势 + 局限 + 优化方向

### 真实优势 ✅

1. **架构选型超前**：4 张表（`lowcode_page_config` / `lowcode_component_definition` / `factory_home_layout` / `ai_decoration_session`） + 4 个 LLM Tool + 完整 LowcodeController CRUD — **数据底座基本到位**
2. **拖拽体验质量高**：BentoGridEditor 用 react-native-reanimated + gesture-handler，PanGesture/LongPress/DoubleTap/Tap 复合，碰撞重算（`BentoGridEditor.tsx:127-170`），撤销/重做 history slice 实现
3. **首页装饰场景真实可用**：HomeLayoutEditor 整条链端到端通：拖拽 → 保存草稿 → 发布 → FAHomeScreen 读 `factory_home_layout` 表渲染

### 致命局限 ❌

1. **`PageEditor` 完全 dead code**：grep 全仓 0 navigation 引用，1252 行 + 698 行 ComponentPalette 双双烂在仓库
2. **AI 是骗子**：`DecorationServiceImpl.generateLayoutWithAI` 写 `modelUsed("rule-based")` (`:207`)，没调 LLM
3. **Tool 写错表**：`HomeLayoutGenerateTool` 写 `FactorySettings`，不是 `FactoryHomeLayout`，对话生成不上首页
4. **运行时不通用**：FAHomeScreen 硬编码 switch 5 类，加组件必须改代码（`FAHomeScreen.tsx:182-219`）
5. **组件库浅**：硬编码 15 组件 (`ComponentPalette.tsx:79-286`)，DB seed 7 组件 (V2026_01_14_02 migration)，**表格/表单运行时缺失**

### 优化方向（按 ROI 排序）

| 优先级 | 工作 | 工作量 | 客户感知 |
|---|---|---|---|
| P0 | 把 `PageEditor` 挂到 `FAHomeStackNavigator` 或独立 lowcode Stack | 2h | 立刻"对话生成仪表盘"演示可达 |
| P0 | 修 `DecorationServiceImpl.generateLayoutWithAI` 改调 LLM（或转发到 `HomeLayoutGenerateTool`） | 4h | AILayoutAssistant 变真 AI |
| P0 | 修 `HomeLayoutGenerateTool` 改写 `FactoryHomeLayoutRepository`（替换 `FactorySettingsRepository`） | 3h | Tool 输出端到端可见 |
| P1 | 实现通用运行时 `<LowcodeRenderer config={config}>` 组件，根据 component_type 动态渲染 | 1-2 天 | FAHomeScreen 类型扩展不再改代码 |
| P1 | 表格 `data_table` 组件实运行时渲染（用 FlatList + 列定义） | 1 天 | 抵宏见表格能力的 60% |
| P2 | 表单 `form_*` 组件真运行时渲染（FormilyDemo 是演示不能用） | 2-3 天 | 抵宏见录入能力的 50% |
| P2 | 拖拽生成业务表单（schema-driven） | 1 周 | 真"低代码"标签 |

---

## 附：引用文件 (绝对路径)

- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\lowcode\PageEditor.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\lowcode\components\ComponentPalette.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\lowcode\index.ts`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\HomeLayoutEditorScreen.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\components\BentoGridEditor.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\components\AILayoutAssistant.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\components\ModulePropsEditor.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\components\homeModuleSchemas.ts`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\FAHomeScreen.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\demo\FormilyDemoScreen.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\navigation\factory-admin\FAHomeStackNavigator.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\services\api\decorationApiClient.ts`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\services\api\lowcodeApiClient.ts`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\store\homeLayoutStore.ts`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\store\pageConfigStore.ts`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\controller\DecorationController.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\controller\LowcodeController.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\service\decoration\impl\DecorationServiceImpl.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\pagedesign\PageGenerateTool.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\pagedesign\PageComponentAddTool.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\pagedesign\PageStyleUpdateTool.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\pagedesign\PageDataBindTool.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\decoration\HomeLayoutGenerateTool.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\decoration\HomeLayoutUpdateTool.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\ai\tool\impl\decoration\HomeLayoutSuggestTool.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\entity\decoration\FactoryHomeLayout.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\entity\LowcodePageConfig.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\java\com\cretas\aims\entity\LowcodeComponentDefinition.java`
- `C:\Users\Steve\my-prototype-logistics\backend\java\cretas-api\src\main\resources\db\migration\V2026_01_14_02__add_lowcode_page_config_tables.sql`
