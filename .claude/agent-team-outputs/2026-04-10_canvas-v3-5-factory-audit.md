# Canvas V3 五工厂业务场景深度审计 — 第四轮

**日期**: 2026-04-10
**工作流**: agent-team (4 parallel personas → synthesis)
**审计范围**: 5 个真实工厂场景 × 跨角色工作流 × 真实浏览器 UI

---

## 审计场景

| # | 工厂类型 | 核心业务特征 | Persona |
|---|---------|------------|---------|
| 1 | 昆山六扇门食品 (熟食加工) | BOM 达成率、批次追溯、实际用量追踪 | A |
| 2 | 七点面包 (早餐烘焙连锁) | 4小时保质期、日产销、门店可售状态 | A |
| 3 | 蓝海水产 (养殖 + 加工) | 养殖周期 90-270 天、活体/冷冻、分批捕捞 | B |
| 4 | 草原鲜牧 (定制肉类) | 非标订单、按重计价、耳标追溯、客户等级驱动规格 | B |
| 5 | 巴蜀味道 (调味品发酵) | 发酵周期、多级加工、陈酿年份、跨角色协作 | C |

**加上**: Canvas Editor 实地浏览器探索 (Browser Explorer)

---

## 执行摘要

**四轮审计后 Canvas V3 声称 49/49 API + 10/10 UI 100% 通过，但本轮多场景审计暴露 32 个真实 Gap**。

### 核心发现

> **之前的验证是单路径、单角色、单场景，掩盖了系统性缺陷。**

1. **审核流程是前端空壳** — CanvasHeader 的 5 个审核按钮（提交审核/通过/驳回/立即发布/取消）调用的 API **全部不存在**，点击即 404
2. **Canvas 编辑器对标准管理员用户呈空白** — factory_admin1 访问 /canvas-editor 模块树 0 节点、Phase Tabs 不渲染
3. **数据污染**：客户等级 Select 下拉混入开票状态枚举值（未开票/部分开票/已全额开票）
4. **声称支持的功能不生效**：动态 SUB_TABLE 字段被 FactoryConfigServiceImpl:131 硬跳过，永远不在表单渲染
5. **Round 3 Fix #13 的副作用**：模板 defaultValue 被 Map.of("value", x) 包装后，前端未解包，渲染为 `[object Object]`
6. **版本回滚产生幽灵字段**：rollbackConfig 不执行 DDL，CanvasDynamicField 仍 ACTIVE，低版本界面会看到高版本添加的字段
7. **权限无分级**：ConfigController / DynamicFieldController / TriggerChainController 无 @PreAuthorize，只做 URL factoryId 校验，同工厂任意角色等权

---

## 32 个具体 Gap（按严重度）

### 🔴 P0 — 系统性 Bug（7 个）

#### P0-1: 审核流程前端 5 态 vs 后端 2 态不一致

**证据**:
- `web-admin/src/api/canvasApi.ts:83-96` 定义 5 个审核 API: `/submit-review`, `/approve`, `/reject`, `/publish-now`, `/cancel-approval`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java` — 全文无这 5 个端点，只有 `POST /publish` 和 `POST /rollback/{version}`
- `FactoryConfiguration` 状态机实际只有 `DRAFT`/`PUBLISHED`/`ARCHIVED` (`FactoryConfigServiceImpl.java:385,377`)

**影响**: Canvas 编辑器 CanvasHeader 的所有审核按钮全部 404 死链。用户以为能走 DRAFT→PENDING_REVIEW→APPROVED→PUBLISHED 四态审核流程，实际只能直接 DRAFT→PUBLISHED。

**修复**: 在 ConfigController 补充 5 个端点；在 FactoryConfiguration 增加 PENDING_REVIEW 和 APPROVED 状态字段；FactoryConfigServiceImpl 实现完整状态机流转。

---

#### P0-2: 模板 defaultValue 前端渲染 `[object Object]`

**证据**:
- `FactoryConfigServiceImpl.java:504` Round 3 Fix #13 包装: `fdv.setDefaultValue(Map.of("value", rawVal))`
- `buildEffectiveFields` 从 fieldOverrides 读 defaultValue，会返回 `{"value": "NORMAL"}` 对象
- `SchemaFormRenderer.vue:55` 直接 `field.defaultValue` 赋给 `formData.value[field.code]`
- el-input 渲染对象 → `[object Object]`

**影响**: BAKERY 模板应用后，`defaultPriority="HIGH"` 在表单显示为 `[object Object]`；任何通过 applyTemplate 预填的字段都出现这个问题。

**修复**: `buildEffectiveFields` 解包: `if (defaultValue instanceof Map && ((Map)defaultValue).containsKey("value")) defaultValue = ((Map)defaultValue).get("value");`

---

#### P0-3: 动态 SUB_TABLE 被 FactoryConfigServiceImpl:131 跳过

**证据**:
- `FactoryConfigServiceImpl.java:131` 行: `if ("SUB_TABLE".equals(df.getFieldType())) continue;`
- SchemaFormRenderer.vue:299-307 有 sub_table 渲染分支但永远不会被触发
- DDLExecutor 会正确建子表但字段不在 EffectiveField 列表

**影响**: 昆山六扇门在 material_batch 加 `cf_traceability_log` 子表 → DB 建表成功但表单不可见，追溯日志无法填写。

**修复**: Layer 2b 动态字段合并时为 SUB_TABLE 单独构建 `EffectiveField(type="sub_table", extra.columns=...)`。

---

#### P0-4: 客户等级 Select 选项数据污染

**证据**:
- Browser Explorer 截图 `flow-b-6-select.png`
- 下拉框包含 6 个选项: `未开票, 部分开票, 已全额开票, A级, B级`
- 前 3 项是开票状态枚举，与客户等级无关

**影响**: 用户录入数据错误，污染下游业务逻辑（如价格分级、发货优先级）。

**修复**: 检查 `cf_customer_level` 字段的 options 配置数据源，移除错误混入的开票状态值。可能是字段创建时误用了 invoice_status 模板。

---

#### P0-5: Canvas 编辑器对 factory_admin1 空白

**证据**:
- Browser Explorer Flow A 结果: 模块树 `.el-tree-node__content` count=0
- Phase Tabs `[role=tablist]` 不可见
- 新建草稿按钮不存在
- 页面 DOM 加载但数据层为空

**影响**: factory_admin1 作为超级管理员，访问 /canvas-editor 看不到任何模块，无法使用 Canvas 功能。

**修复**: 检查 useCanvasEditor.loadVersion 流程。可能是 loadModules 调用失败或 F001 工厂没有 FactoryModuleConfig 记录。需要添加空状态 UI（"您还没有模块配置，点此创建第一个"）+ 验证 F001 的初始化数据。

---

#### P0-6: 版本回滚产生幽灵字段

**证据**:
- `FactoryConfigServiceImpl.java:399-434` rollbackConfig 实现：只复制旧版本 `FactoryModuleConfig` JSON 到新 DRAFT，**不调用 ddlExecutor**
- v3 添加的 cf_xxx 列在回滚到 v2 后仍存在数据库
- CanvasDynamicField 记录仍是 ACTIVE
- EffectiveModuleConfig 读 `dynamicFieldService.getActiveFields()` 不按版本过滤 (FactoryConfigServiceImpl.java:113)

**影响**: 回滚 v3→v2，界面上仍看到 v3 添加的字段，造成版本错乱。

**修复**: (a) CanvasDynamicField 添加 `active_from_version` 字段 (b) rollback 时禁用高版本字段 `UPDATE canvas_dynamic_field SET status='DISABLED' WHERE active_from_version > :targetVersion`

---

#### P0-7: 工厂管理员权限无 @PreAuthorize

**证据**: `ConfigController`, `DynamicFieldController`, `TriggerChainController` 全文无任何 @PreAuthorize 注解

**影响**: FACTORY_ADMIN 和 FACTORY_SUPER_ADMIN 权限完全等价。**任何工厂登录用户都能修改 Canvas 配置、添加字段、配触发链**。设计上没有角色分级。

**修复**: 在关键端点添加 `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_ADMIN')")`；或把一部分 readonly 开放给 FACTORY_ADMIN，write 仅限 FACTORY_SUPER_ADMIN。

---

### 🟡 P1 — 功能缺失（14 个）

#### P1-8: computedWhen 不支持时间运算
- `SpelConditionEvaluator.java:60-66` buildContext 无 LocalDateTime 工具注入
- `spelEvaluator.ts` 前端是简单 new Function 无 Date 处理
- `cf_expire_at = start_time + 4h` 在前后端都静默失败

**修复**: 注入 `T(java.time.LocalDateTime)` SpEL 引用，前端识别 plusHours/plusMinutes 语法转换 JS Date。

---

#### P1-9: RN 移动端不消费 Canvas 动态字段
- `frontend/CretasFoodTrace/src` 全目录 grep `canvas_dynamic`、`getEffectiveConfig`、`canvasApi` **零匹配**
- `ReportDashboardScreen.tsx` 硬编码 DTO 字段

**修复**: 实现 RN `canvasApiClient.ts` + `DynamicFieldRenderer.tsx` 组件。

---

#### P1-10: 无 Scheduler UI
- `DynamicSchedulerService.java` 后端完备
- `web-admin/src/views/platform/canvas-editor/` 全目录 grep `scheduler/cron` **零匹配**
- 只能通过直接写数据库操作

**修复**: 新增 `SchedulerPanel.vue` 作为第 7 个 Tab。

---

#### P1-11: FIELD_PALETTE 缺 DATETIME/BOOLEAN
- `usePageEditor.ts:11-19` FIELD_PALETTE 只有 7 种类型
- `DDLExecutor.java:203-213` mapFieldTypeToSQL 同样缺 BOOLEAN
- SchemaFormRenderer 有 datetime 渲染分支但创建路径无法产出该类型

---

#### P1-12: Runtime 创建新模块不支持
- `ModuleSchema.java:23` moduleCode unique 约束，只通过 SQL 迁移 seed
- `ConfigController.java` 只有 `PUT /config/modules/{moduleCode}`，无 `POST /config/modules`
- `DDLExecutor.MODULE_TABLE_MAP` 硬编码 17 个表映射

**影响**: 蓝海水产要的 `pond_management` 完全无法配置。

---

#### P1-13: Sub-table 无过滤/范围查询
- `DynamicTableService.getRows()` SQL 固定 `WHERE parent_id = ?::uuid ORDER BY created_at`
- `DynamicFieldController.getSubTableRows()` 无过滤参数

**影响**: 养殖日志 270 天每天一行，查询只能拉全量。

---

#### P1-14: TriggerChain 不监听订单创建 + 无 HTTP 出站工具
- `TriggerChainExecutor.HANDLED_EVENTS:34-38` 无 `SalesOrderCreatedEvent`
- ToolRegistry 无通用 `http_call` / `http_post` 工具

**影响**: 草原鲜牧"订单创建时快照市场价" 无法通过 Canvas 配置实现。

---

#### P1-15: AggregateFormulaExecutor 无比率运算
- `AggregateFormulaExecutor.java:20-21` GROUP_BY 正则固定 `GROUP_BY(table, 'groupField', AGG('valueField'))`
- 无法做 `SUM(a) / SUM(b) * 100` 比率

**影响**: BOM 达成率、损耗率无法实现。

---

#### P1-16: 配置导出/导入完全不存在
- 全项目 grep `exportConfig`、`importConfig`、`cloneConfiguration` **零匹配**

**影响**: 平台管理员无法把一个工厂的 Canvas 配置复制给另一个相似工厂。

---

#### P1-17: 并发编辑无乐观锁
- `FactoryConfiguration.java` 72 行实体，无 `@Version` 乐观锁字段
- `findDraft` 无并发保护
- 两人并发 `getOrCreateDraft` 会触发 `ConstraintViolationException` → 500

---

#### P1-18: 字段类型变更无 ALTER COLUMN TYPE
- `DDLExecutor.java` 无 `ALTER COLUMN TYPE` 语句
- `updateDynamicField` 不允许修改 `fieldType`

**影响**: 把 cf_tank_in_date 从 TEXT 改为 DATE 无路径。

---

#### P1-19: OnboardingWizard Step 3 静态空壳 + finish() 不提交
- `OnboardingStep3Workflows.vue:32-38` `getStates()` 返回硬编码字符串数组
- "编辑流程"按钮无事件处理
- `OnboardingWizard.vue:77-81` finish() 只 `isOnboarding.value = false` + 提示，不调用任何 API
- Step 4 `checks` 是前端静态数据 "In production, call checkCompleteness API" 注释但未接入

---

#### P1-20: AI Autopilot 模式入口 UI 不存在
- Browser Explorer Flow C: `[class*=autopilot]` 未找到
- 只有 AI Chat Panel 可见，无 autopilot 模式切换按钮

---

#### P1-21: 表单提交按钮缺失
- Browser Explorer Flow B: `/提交|确定|保存/` 均未找到
- el-dialog 底部无明确提交按钮

---

### 🟢 P2 — 优化 + 扩展（11 个）

#### P2-22: Sub-table 无 UNIQUE 约束机制
`DDLExecutor.generateSubTableDDL` 只生成 parent_id 索引，不解析 columns 的 `unique` 属性。

#### P2-23: 订单行无法每行字段不同
`LineItemsEditor.vue` itemSchema 是统一的 fields 数组，所有行渲染相同列。

#### P2-24: Validation context 自动 hydration
ValidationRuleEvaluator.validate 入参 context 由调用方手动构建，容易遗漏字段。

#### P2-25: Canvas 缺拆单工具
无 `split_order` tool，无法配置"一半切块一半整条 → 拆成两个子订单"。

#### P2-26: 季节性优先级调整与 Canvas 解耦
APS StrategyWeightAdaptationController 与 Canvas 配置层是两条平行轨道。

#### P2-27: VersionHistory 组件不存在
`[class*=version-history]` 未找到，无回滚按钮。

#### P2-28: 预期毛利率字段未渲染
FOOD_3101_038 有 7 active fields，表单只显示 4/5。

#### P2-29: BAKERY 模板 seedDynamicFields 空
BAKERY 模板 defaultValues 只有 3 个配置，没有预置任何与短保质期/时间精度相关字段。

#### P2-30: FOOD_PROCESSING 模板 vs 发酵业务 Gap
无 fermentation_days / tank_id / aging_years 预设。

#### P2-31: required=true 后端无强制执行
`DynamicFieldService.setDynamicFields` 只更新传入字段，不校验 required。required 是纯前端约束。

#### P2-32: OnboardingWizard 下一步 disabled 无提示
按钮 disabled 时无 tooltip 说明原因，用户卡住。

---

## 跨 Persona 共性问题

1. **"声称支持但实际不生效"模式重复出现**
   - SUB_TABLE 能建但不渲染
   - 审核流程前端有 API 后端无端点
   - required=true 前端约束后端无强制
   - 模板 defaultValue 包装了但没解包

2. **Canvas 与其他子系统互相解耦**
   - RN 移动端不消费 Canvas
   - APS 权重独立于 Canvas 规则引擎
   - 报表系统硬编码 DTO

3. **行业模板浅薄**
   - 模板只启用模块和设 3 个默认值
   - 没有预置动态字段/验证规则/触发链
   - 每个新工厂都要重复手工配置

4. **缺少"全生命周期"思考**
   - 字段类型无法变更
   - 版本回滚不真回滚
   - 配置无法导出/导入
   - 并发无保护

---

## 优先级排序的修复建议

### 立即修（P0，本次 session）
1. 补全审核流程 5 个 API 端点
2. 修 defaultValue Map 解包
3. 修动态 SUB_TABLE 不跳过
4. 清理客户等级 Select 数据污染
5. Canvas 编辑器空状态处理

### 本周内修（P1 前 5）
6. 工厂管理员权限分级
7. 版本回滚字段跟随
8. computedWhen 时间运算
9. FIELD_PALETTE DATETIME/BOOLEAN
10. 无 Scheduler UI

### 下个迭代（P1 剩余 + 核心 P2）
11-21 其余 P1
22-32 优化扩展

---

## 测试覆盖缺口总结

**当前 49/49 API + 10/10 UI 测试覆盖**:
- 单工厂单场景配置 → 发布 → 基础业务操作
- 单用户单浏览器路径

**未覆盖**:
- 跨行业多工厂模板对比
- 跨角色权限边界（平台管理员 vs 工厂管理员）
- 配置变更的向后兼容（required 变更、类型变更）
- 回滚 + 数据一致性
- 并发编辑
- 生命周期完整性（创建 → 使用 → 变更 → 回滚 → 归档）
- 移动端与 Web-Admin 配置同步
- OnboardingWizard 真实完整流程

**建议新增测试维度**:
- 多工厂模板对比矩阵
- 权限矩阵测试（角色 × 端点 × 期望状态）
- 版本生命周期测试（v1→v2→v3→rollback v2 数据一致性）
- 并发保护测试（2 个 admin 同时 saveModuleConfig）

---

*Generated by agent-team skill with 4 parallel persona researchers + browser explorer.*
