# Canvas V2 — 统一配置引擎 Spec

> **基于**: V1 spec (`2026-04-09-canvas-configuration-system-design.md`) + Tool-Skill 架构 + 业务逻辑外化
> **版本**: 2.0.0
> **日期**: 2026-04-09
> **前提**: Phase 1 已完成 (5 tables + 3-layer merge + dynamic renderer + E2E 验证)

---

## 1. 目标

将系统从 "~1% 可配置" 提升到 "~70% 可配置"，覆盖所有工厂运营层面的业务决策点，使新工厂上线从"开发 4-8 周"降至"配置 1-3 天"。

**V1 已解决**: 字段显隐 + 标签 + 工作流选项开关 + 角色权限 + 动态渲染 (2 模块: sales_order + bom)

**V2 新增**:
- Layer A: 348 Tool + 16 Skill 的 per-factory 开关/编排
- Layer B: 364 条校验规则 + 触发链 + 默认值 + 公式 + 定时任务外化
- Canvas UI: 6 个配置面板 + 拖拽模块/字段 + SVG 状态机 + 3 种 AI Agent

---

## 2. 架构

```
Canvas UI (6 tab)
  ├─ 📋 字段配置 (拖拽排序 + 显隐 + 标签) ← V1 已有
  ├─ 🔄 流程设计 (SVG 状态机 + 条件编辑) ← V1 spec 设计
  ├─ 🛡️ 权限矩阵 (角色 × 字段) ← V1 spec 设计
  ├─ 🔗 触发链 (Event→Condition→Tool 编排) ← V2 新增
  ├─ 📐 校验规则 (开关 + 条件 + 严重级别) ← V2 新增
  └─ 🔧 工具/技能 (per-factory 开关矩阵) ← V2 新增
        │
        ▼
配置存储 (11 tables)
  ├─ V1 (4 tables): module_schemas / factory_configurations / factory_module_configs / config_change_log
  ├─ Layer A (3 tables): factory_tool_configs / factory_skill_configs / factory_trigger_chains
  └─ Layer B (4 tables): factory_validation_rules / factory_default_values / factory_formulas / factory_scheduler_configs
        │
        ▼
执行层
  ├─ ToolRegistry.getToolsForFactory(factoryId) ← 扩展已有
  ├─ SkillRegistry.getSkillsForFactory(factoryId) ← 扩展已有
  ├─ TriggerChainExecutor → 替代 @EventListener 硬编码
  ├─ ValidationRuleEvaluator → 替代 if-throw 硬编码
  ├─ DefaultValueResolver → 替代 null-check 硬编码
  ├─ FormulaEngine → 替代硬编码计算
  └─ DynamicScheduler → 替代 @Scheduled cron 硬编码
        │
        ▼
业务服务层 (295+ Services — 注入配置)
```

---

## 3. 数据模型 — 7 张新表

### 3.1 Layer A: Tool/Skill 工厂级配置

#### factory_tool_configs

| 列 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL PK | |
| factory_id | VARCHAR(50) NOT NULL | |
| tool_name | VARCHAR(100) NOT NULL | 关联 ToolRegistry |
| enabled | BOOLEAN DEFAULT true | 工厂级开关 |
| param_overrides | JSONB DEFAULT '{}' | 参数默认值覆盖 |
| risk_override | VARCHAR(20) | 风险级别覆盖 |
| custom_description | TEXT | 工厂自定义描述 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(factory_id, tool_name)

#### factory_skill_configs

| 列 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL PK | |
| factory_id | VARCHAR(50) NOT NULL | |
| skill_name | VARCHAR(100) NOT NULL | 关联 SkillRegistry |
| enabled | BOOLEAN DEFAULT true | |
| custom_dag | JSONB | 工厂自定义 DAG 步骤 (覆盖默认) |
| custom_triggers | JSONB | 工厂自定义触发词 |
| priority | INTEGER DEFAULT 100 | 工厂内排序 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(factory_id, skill_name)

#### factory_trigger_chains

| 列 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL PK | |
| factory_id | VARCHAR(50) NOT NULL | |
| chain_code | VARCHAR(64) NOT NULL | 如 "SO_FINANCE_APPROVED" |
| event_type | VARCHAR(100) NOT NULL | Java event class name |
| enabled | BOOLEAN DEFAULT true | |
| steps | JSONB NOT NULL | [{tool, condition, order, enabled}] |
| error_strategy | VARCHAR(20) DEFAULT 'CONTINUE' | STOP/CONTINUE/ROLLBACK |
| description | TEXT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(factory_id, chain_code)

**steps JSONB 结构:**
```json
[
  {
    "order": 1,
    "tool": "inventory_check_stock",
    "condition": "always",
    "enabled": true,
    "params": {}
  },
  {
    "order": 2,
    "tool": "inventory_reserve_stock",
    "condition": "step1.result.hasStock == true",
    "enabled": true
  },
  {
    "order": 3,
    "tool": "production_plan_create",
    "condition": "step1.result.hasStock == false",
    "enabled": true
  }
]
```

### 3.2 Layer B: 业务逻辑外化

#### factory_validation_rules

| 列 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL PK | |
| factory_id | VARCHAR(50) NOT NULL | |
| module_code | VARCHAR(64) NOT NULL | "sales_order" |
| rule_code | VARCHAR(64) NOT NULL | "DRAFT_ONLY_EDIT" |
| operation | VARCHAR(32) | "CREATE" / "UPDATE" / "DELETE" / "STATUS_CHANGE" |
| condition | TEXT NOT NULL | "status != 'DRAFT'" |
| error_message | TEXT NOT NULL | "只有草稿状态可以编辑" |
| enabled | BOOLEAN DEFAULT true | |
| severity | VARCHAR(16) DEFAULT 'BLOCK' | BLOCK / WARN / INFO |
| sort_order | INTEGER DEFAULT 0 | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(factory_id, module_code, rule_code)

#### factory_default_values

| 列 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL PK | |
| factory_id | VARCHAR(50) NOT NULL | |
| module_code | VARCHAR(64) NOT NULL | |
| field_code | VARCHAR(64) NOT NULL | "yieldRate" |
| default_value | JSONB NOT NULL | 95 |
| condition | TEXT | 可选: "materialCategory == 'RAW'" |
| description | TEXT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(factory_id, module_code, field_code) — 无 condition 时
INDEX(factory_id, module_code)

#### factory_formulas

| 列 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL PK | |
| factory_id | VARCHAR(50) NOT NULL | |
| module_code | VARCHAR(64) NOT NULL | |
| formula_code | VARCHAR(64) NOT NULL | "LINE_AMOUNT" |
| expression | TEXT NOT NULL | "quantity * unitPrice * (1 - discountRate)" |
| variables | JSONB | 变量类型声明 |
| result_type | VARCHAR(20) | DECIMAL / INTEGER / BOOLEAN |
| precision | INTEGER DEFAULT 2 | |
| description | TEXT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(factory_id, module_code, formula_code)

#### factory_scheduler_configs

| 列 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL PK | |
| factory_id | VARCHAR(50) NOT NULL | |
| task_code | VARCHAR(64) NOT NULL | "ACTIVE_LEARNING_DAILY" |
| cron_expression | VARCHAR(50) NOT NULL | "0 0 2 * * ?" |
| enabled | BOOLEAN DEFAULT true | |
| tool_or_method | VARCHAR(100) | 执行的 Tool name 或 method reference |
| params | JSONB DEFAULT '{}' | |
| description | TEXT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(factory_id, task_code)

---

## 4. 执行引擎

### 4.1 TriggerChainExecutor

替代硬编码 `@EventListener`。现有 SupplyChainOrchestrator 的 5 个 listener 改为:

```java
@Component
public class ConfigurableTriggerChainExecutor {

    @Autowired private FactoryTriggerChainRepository triggerChainRepo;
    @Autowired private ToolRegistry toolRegistry;

    /**
     * 所有 @EventListener 统一入口
     * event 包含 factoryId → 查 factory_trigger_chains → 按 steps 顺序执行 Tool
     */
    @EventListener
    public void onBusinessEvent(ApplicationEvent event) {
        String factoryId = extractFactoryId(event);
        String eventType = event.getClass().getSimpleName();

        List<FactoryTriggerChain> chains = triggerChainRepo
            .findByFactoryIdAndEventTypeAndEnabledTrue(factoryId, eventType);

        // 如果没有工厂级配置，走全局默认链 (factoryId=null)
        if (chains.isEmpty()) {
            chains = triggerChainRepo
                .findByFactoryIdAndEventTypeAndEnabledTrue(null, eventType);
        }

        for (FactoryTriggerChain chain : chains) {
            executeChain(chain, factoryId, event);
        }
    }

    private void executeChain(FactoryTriggerChain chain, String factoryId, ApplicationEvent event) {
        Map<String, Object> context = buildContext(event);
        List<StepConfig> steps = parseSteps(chain.getSteps());

        for (StepConfig step : steps) {
            if (!step.enabled) continue;
            if (!evaluateCondition(step.condition, context)) continue;

            ToolExecutor tool = toolRegistry.getExecutor(step.tool).orElse(null);
            if (tool == null) { log.warn("Tool not found: {}", step.tool); continue; }

            try {
                Map<String, Object> result = tool.execute(factoryId, step.params, context);
                context.put("step" + step.order, result);
            } catch (Exception e) {
                if ("STOP".equals(chain.getErrorStrategy())) throw e;
                log.error("Trigger chain step failed: {}", step.tool, e);
            }
        }
    }
}
```

**迁移方式**: 现有 SupplyChainOrchestrator 的 5 个 @EventListener → 拆为 5 条 factory_trigger_chains 全局默认记录。原代码保留为 fallback（factory_trigger_chains 无记录时执行原逻辑）。

### 4.2 ValidationRuleEvaluator

替代硬编码 `if (...) throw new BusinessException(...)`。

```java
@Component
public class ValidationRuleEvaluator {

    @Autowired private FactoryValidationRuleRepository ruleRepo;

    /**
     * 在 Service 方法中调用，替代硬编码校验
     * factoryConfigService 已有基础，此处扩展为规则表驱动
     */
    public void validate(String factoryId, String moduleCode, String operation,
                         Map<String, Object> context) {
        List<FactoryValidationRule> rules = ruleRepo
            .findByFactoryIdAndModuleCodeAndOperationAndEnabledTrue(
                factoryId, moduleCode, operation);

        // 无工厂规则时查全局默认
        if (rules.isEmpty()) {
            rules = ruleRepo.findByFactoryIdAndModuleCodeAndOperationAndEnabledTrue(
                null, moduleCode, operation);
        }

        for (FactoryValidationRule rule : rules) {
            if (evaluateCondition(rule.getCondition(), context)) {
                switch (rule.getSeverity()) {
                    case "BLOCK" -> throw new BusinessException(rule.getErrorMessage());
                    case "WARN" -> log.warn("Validation warning: {}", rule.getErrorMessage());
                    case "INFO" -> log.info("Validation info: {}", rule.getErrorMessage());
                }
            }
        }
    }
}
```

### 4.3 DefaultValueResolver

扩展 Phase 1 的 `FactoryConfigService.getFieldDefault()`。

```java
public Object resolveDefault(String factoryId, String moduleCode, String fieldCode,
                              Map<String, Object> context) {
    // 1. 查 factory_default_values (带条件匹配)
    List<FactoryDefaultValue> defaults = defaultValueRepo
        .findByFactoryIdAndModuleCodeAndFieldCode(factoryId, moduleCode, fieldCode);

    for (FactoryDefaultValue dv : defaults) {
        if (dv.getCondition() == null || evaluateCondition(dv.getCondition(), context)) {
            return dv.getDefaultValue();
        }
    }

    // 2. 查 module_schema 的 field defaultValue (Phase 1 已有)
    return factoryConfigService.getFieldDefault(factoryId, moduleCode, fieldCode);
}
```

### 4.4 FormulaEngine

简单表达式引擎，支持四则运算 + 变量替换。

```java
public BigDecimal evaluate(String factoryId, String moduleCode, String formulaCode,
                            Map<String, Object> variables) {
    FactoryFormula formula = formulaRepo
        .findByFactoryIdAndModuleCodeAndFormulaCode(factoryId, moduleCode, formulaCode)
        .orElseGet(() -> formulaRepo
            .findByFactoryIdAndModuleCodeAndFormulaCode(null, moduleCode, formulaCode)
            .orElse(null));

    if (formula == null) return null;

    // 简单表达式求值: "quantity * unitPrice * (1 - discountRate)"
    return ExpressionEvaluator.eval(formula.getExpression(), variables, formula.getPrecision());
}
```

### 4.5 DynamicScheduler

运行时加载 factory_scheduler_configs，替代 @Scheduled 硬编码。

```java
@Component
public class DynamicSchedulerService {

    @Autowired private FactorySchedulerConfigRepository schedulerRepo;
    @Autowired private TaskScheduler taskScheduler;
    private Map<String, ScheduledFuture<?>> activeTasks = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadSchedules() {
        List<FactorySchedulerConfig> configs = schedulerRepo.findByEnabledTrue();
        for (FactorySchedulerConfig config : configs) {
            scheduleTask(config);
        }
    }

    public void scheduleTask(FactorySchedulerConfig config) {
        String key = config.getFactoryId() + ":" + config.getTaskCode();
        // Cancel existing
        ScheduledFuture<?> existing = activeTasks.get(key);
        if (existing != null) existing.cancel(false);

        // Schedule new
        ScheduledFuture<?> future = taskScheduler.schedule(
            () -> executeTask(config),
            new CronTrigger(config.getCronExpression())
        );
        activeTasks.put(key, future);
    }

    /** Canvas 修改 cron 后调用，热更新不重启 */
    public void reloadSchedule(String factoryId, String taskCode) {
        FactorySchedulerConfig config = schedulerRepo
            .findByFactoryIdAndTaskCode(factoryId, taskCode).orElse(null);
        if (config != null && config.getEnabled()) {
            scheduleTask(config);
        } else {
            cancelTask(factoryId, taskCode);
        }
    }
}
```

---

## 5. ToolRegistry / SkillRegistry 扩展

### 5.1 ToolRegistry 新增方法

```java
// 新增: per-factory 过滤
public List<ToolDefinition> getToolsForFactory(String factoryId) {
    List<ToolDefinition> allTools = getAllToolDefinitions();
    List<FactoryToolConfig> configs = factoryToolConfigRepo.findByFactoryId(factoryId);

    if (configs.isEmpty()) return allTools; // 无工厂配置 = 全部可用

    Map<String, FactoryToolConfig> configMap = configs.stream()
        .collect(Collectors.toMap(FactoryToolConfig::getToolName, c -> c));

    return allTools.stream()
        .filter(t -> {
            FactoryToolConfig fc = configMap.get(t.getName());
            return fc == null || fc.getEnabled(); // 未配置 = 默认启用
        })
        .collect(Collectors.toList());
}
```

### 5.2 SkillRegistry 新增方法

```java
public SkillDefinition getSkillForFactory(String factoryId, String skillName) {
    SkillDefinition base = getSkill(skillName);
    if (base == null) return null;

    FactorySkillConfig config = factorySkillConfigRepo
        .findByFactoryIdAndSkillName(factoryId, skillName).orElse(null);

    if (config == null) return base;
    if (!config.getEnabled()) return null; // 工厂禁用

    // 合并: base DAG + factory custom DAG
    if (config.getCustomDag() != null) {
        base = base.withOverriddenDAG(config.getCustomDag());
    }
    return base;
}
```

---

## 6. AI Configuration Agent — 3 种模式

(延续 V1 spec Section 6 设计，此处补充与 Layer A/B 的集成)

### 6.1 Autopilot Mode

新增能力:
- 自动配置 factory_trigger_chains (根据行业模板)
- 自动配置 factory_tool_configs (禁用不相关的 Tool 类别)
- 自动配置 factory_scheduler_configs (调整定时任务时间)

### 6.2 Plan Mode

新增 diff 类型:
- TRIGGER_CHAIN_CHANGE: 触发链步骤变更
- TOOL_TOGGLE: 工具开关变更
- VALIDATION_RULE_CHANGE: 校验规则变更
- DEFAULT_VALUE_CHANGE: 默认值变更

### 6.3 Action Mode

新增实时提示:
- 禁用 Tool 时提示: "该工具被 2 个 Skill 引用，禁用后这些 Skill 将受影响"
- 修改触发链时提示: "移除自动排产步骤后，需要手动创建生产计划"
- 修改校验规则时提示: "关闭重复产品校验后，同一订单可能出现相同产品"

---

## 7. Canvas UI 组件

### 7.1 V1 保留 (11 个组件)

CanvasEditor / ModuleTree / FieldConfigPanel / FieldPropertyPanel / WorkflowDesigner / PermissionMatrix / SchemaPreview / AIChatPanel / ConfigDiffViewer / TemplateSelector / VersionHistory

### 7.2 V2 新增 (3 个组件)

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| `TriggerChainDesigner.vue` | `views/platform/canvas-editor/components/TriggerChainDesigner.vue` | 触发链可视化编辑: Event→步骤列表(拖拽排序) + 每步的 Tool 选择 + 条件编辑 + 开关 |
| `ValidationRulePanel.vue` | `views/platform/canvas-editor/components/ValidationRulePanel.vue` | 校验规则列表: 开关 + 条件编辑 + 严重级别 + 错误消息自定义 |
| `ToolSkillMatrix.vue` | `views/platform/canvas-editor/components/ToolSkillMatrix.vue` | 工具/技能开关矩阵: 按领域分组 + 搜索 + 批量开关 + Skill DAG 预览 |

### 7.3 布局 (6 tab)

左侧: ModuleTree (拖拽排序模块, 开关启用/禁用)
中央: 6 个 tab
  - 📋 字段配置 — FieldConfigPanel (拖拽字段排序 + 显隐/必填/标签)
  - 🔄 流程设计 — WorkflowDesigner (SVG 状态机节点 + 箭头 + 条件)
  - 🛡️ 权限矩阵 — PermissionMatrix (角色 × 字段, edit/view/hidden)
  - 🔗 触发链 — TriggerChainDesigner (Event→Tool 步骤编排)
  - 📐 校验规则 — ValidationRulePanel (规则开关 + 条件 + 严重级别)
  - 🔧 工具/技能 — ToolSkillMatrix (348 Tool + 16 Skill 开关)
右侧: AIChatPanel (3 模式: Autopilot / Plan Mode / Action Mode)
底部: ConfigDiffViewer + 变更记录 + AI 建议 + SchemaPreview

---

## 8. 实施计划

### Phase 2a: Layer A — Tool/Skill 工厂级 (Week 4-5, 2 周)
- 3 张新表 + migration
- ToolRegistry.getToolsForFactory() + SkillRegistry.getSkillsForFactory()
- factory_trigger_chains + TriggerChainExecutor
- 迁移 SupplyChainOrchestrator 5 条链为默认 trigger_chain 记录
- 6 个 AI Tool (V1 spec Section 6.2)

### Phase 2b: Layer B — 业务逻辑外化 (Week 6-8, 3 周)
- 4 张新表 + migration
- ValidationRuleEvaluator + 迁移 ~344 条校验规则到 DB
- DefaultValueResolver + 迁移 ~960 个默认值
- FormulaEngine + 迁移 8 个计算公式
- DynamicScheduler + 迁移 55 个定时任务

### Phase 2c: Canvas UI (Week 9-12, 4 周)
- 11 个 V1 组件 + 3 个 V2 新组件
- CanvasEditor 主框架 + ModuleTree (拖拽)
- FieldConfigPanel + WorkflowDesigner (SVG) + PermissionMatrix
- TriggerChainDesigner + ValidationRulePanel + ToolSkillMatrix
- AIChatPanel (3 模式) + ConfigDiffViewer

### Phase 2d: 全模块 Schema (Week 13-14, 2 周)
- 为剩余 ~13 个模块创建 module_schemas
- 行业模板 (食品加工/烘焙/餐饮/水产)
- E2E 验证: 从零配置一个新工厂

---

## 9. 验收标准

1. **新工厂配置**: 从 Canvas 创建新工厂配置 → 选行业模板 → 调整 → 发布 → 工厂可正常使用 (< 30 分钟)
2. **触发链配置**: 禁用"财务审批后自动排产"→ 发布 → 财务审批后不再自动建排产计划
3. **校验规则配置**: 关闭"同一订单不能重复产品"校验 → 发布 → 可以添加重复产品
4. **Tool 开关**: 禁用工厂 A 的 scheduling_* 工具 → AI 助手不再提供排程功能
5. **默认值配置**: 工厂 A 保质期=90天, 工厂 B=180天 → 各自创建成品批次时自动应用
6. **公式配置**: 修改行金额公式为含税计算 → 新订单自动按新公式
7. **定时任务**: 修改 cron 为早上 8 点 → 不重启即生效
8. **AI Autopilot**: "新建一个烘焙工厂" → 自动完成模块/字段/流程/工具配置
9. **AI Plan Mode**: "简化六扇门配置" → 展示 diff → 用户逐项审核 → 批量应用
10. **AI Action Mode**: 手动关闭字段 → AI 实时提示关联影响

---

## 10. 风险

| 风险 | 缓解 |
|------|------|
| 迁移 344 条校验规则耗时 | 分批迁移: 先迁移 8 个核心 Service, 其余后续 |
| 触发链替代 @EventListener 可能丢失边界情况 | 保留原 @EventListener 作为 fallback, 双跑 2 周后下线 |
| 表达式引擎注入风险 | condition/expression 字段用白名单语法, 不支持任意 Java |
| DynamicScheduler 内存泄漏 | ScheduledFuture 统一管理, cancel + remove |
| 68 个 enum 不能运行时新增 | 明确: Canvas 控制启用/禁用, 新增状态仍需代码 + 部署 |
