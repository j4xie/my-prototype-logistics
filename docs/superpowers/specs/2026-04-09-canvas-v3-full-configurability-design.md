# Canvas V3 — 全配置化设计 (PARTIAL → YES)

**日期**: 2026-04-09
**状态**: Approved
**前置**: Canvas V2 (7 tables + 5 engines + 14 Vue components, E2E 20/20 PASS, 已部署 prod)
**目标**: 将六扇门客户需求中 14 个 PARTIAL 项全部变为完全可配 (YES)

---

## 1. 背景

Canvas V2 实现了模块开关、字段显隐、校验规则、定时任务、触发链、公式计算等 6 维配置能力。但对照六扇门客户 38 项需求，仍有 14 项为 PARTIAL（部分可配），原因是 V2 只能操作已有实体字段，无法：

1. 动态新增数据库列
2. 创建子表
3. 按用户（而非角色）控制权限
4. 配置附件上传字段
5. 配置字段条件显隐/联动计算
6. 执行聚合公式 (GROUP_BY + SUM)
7. 结构化定义 Tab 布局

---

## 2. 架构总览

```
Canvas V3 架构层次
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Layer 4 (NEW)   动态 Schema 层
                ├─ DynamicFieldService    — 动态列读写 (NativeQuery)
                ├─ DynamicTableService    — 子表生命周期
                ├─ DDLExecutor            — ALTER TABLE 安全执行
                └─ DDLMigrationLog        — DDL 变更审计

Layer 3 (V2)    引擎层 (扩展)
                ├─ FormulaEngine          + AggregateFormulaExecutor
                ├─ DefaultValueResolver   (不变)
                ├─ ValidationRuleEvaluator (不变)
                ├─ TriggerChainExecutor   (不变)
                ├─ DynamicSchedulerService (不变)
                └─ SpelConditionEvaluator (不变)

Layer 2 (V2)    配置层 (扩展)
                ├─ ModuleSchema.fieldSchema  + type=attachment/sub_table
                ├─ EffectiveField            + visibleWhen/computedWhen/source
                ├─ FactoryModuleConfig       + permissionSchema userId 维度
                └─ FactoryConfiguration      + pendingDDL 列表

Layer 1 (V2)    API 层 (扩展)
                ├─ TriggerChainController    (不变)
                ├─ BusinessRuleController    (不变)
                ├─ CanvasAIController        + 6 新 AI Tools
                ├─ DynamicFieldController    (NEW)
                └─ ConfigPublishService      + DDL 执行步骤
```

### 发布流程 (V3)

```
Draft → Review → Approve → Publish
                              ├─ 1. DDLExecutor.executePendingDDL() — 新增列/子表
                              ├─ 2. Archive 旧版本 + 设置新版本 PUBLISHED
                              └─ 3. DynamicFieldService.refreshCache()
                              (DDL 失败 → 回滚整个发布，保持 APPROVED)
```

---

## 3. 扩展一：动态字段 (True DDL)

### 3.1 设计决策

- **方案**: ALTER TABLE ADD COLUMN（PostgreSQL 加 nullable 列瞬时完成，不锁表）
- **执行时机**: 随 Canvas 发布批量执行（Draft→Publish 流程）
- **读写方式**: 双轨制 — JPA Entity 处理硬编码字段，NativeQuery 处理动态字段
- **列名规范**: 所有动态列加 `cf_` 前缀，避免与 JPA 列冲突

### 3.2 新增实体: CanvasDynamicField

```sql
CREATE TABLE canvas_dynamic_field (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id      VARCHAR(50),          -- NULL = 全局模板
    module_code     VARCHAR(50) NOT NULL,  -- 如 sales_order
    field_code      VARCHAR(100) NOT NULL, -- 如 customer_level
    field_type      VARCHAR(20) NOT NULL,  -- TEXT/NUMBER/DECIMAL/SELECT/DATE/ATTACHMENT/SUB_TABLE
    label           VARCHAR(200) NOT NULL,
    config          JSONB DEFAULT '{}',    -- 类型相关配置
    visible_when    VARCHAR(500),          -- SpEL 条件
    computed_when   VARCHAR(500),          -- SpEL 计算
    sort_order      INT DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'PENDING_DDL', -- PENDING_DDL/ACTIVE/DISABLED
    column_name     VARCHAR(100),          -- 实际数据库列名: cf_{field_code}
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, module_code, field_code)
);
```

**config JSONB 结构** (按 field_type):

| field_type | config 内容 |
|------------|------------|
| TEXT | `{maxLength: 500}` |
| NUMBER | `{min, max}` |
| DECIMAL | `{precision: 4, min, max}` |
| SELECT | `{options: [{value, label}]}` |
| DATE | `{}` |
| ATTACHMENT | `{maxSize: 10485760, accept: ".pdf,.jpg", maxCount: 5}` |
| SUB_TABLE | `{columns: [{code, label, type, required, options}]}` |

### 3.3 新增实体: CanvasDDLLog

```sql
CREATE TABLE canvas_ddl_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id      VARCHAR(50),
    config_version  INT,
    ddl_statement   TEXT NOT NULL,
    target_table    VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'PENDING', -- PENDING/EXECUTED/FAILED/ROLLED_BACK
    executed_at     TIMESTAMP,
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### 3.4 DDLExecutor

```java
@Service
public class DDLExecutor {

    // 发布时批量执行
    void executePendingDDL(String factoryId, int configVersion) {
        List<CanvasDynamicField> pending = repo.findByStatusAndFactoryId(PENDING_DDL, factoryId);
        for (CanvasDynamicField field : pending) {
            String ddl = generateDDL(field);
            CanvasDDLLog log = saveDDLLog(factoryId, configVersion, ddl, PENDING);
            try {
                jdbcTemplate.execute(ddl);
                field.setStatus(ACTIVE);
                log.setStatus(EXECUTED);
            } catch (Exception e) {
                log.setStatus(FAILED);
                log.setErrorMessage(e.getMessage());
                throw new BusinessException("DDL 执行失败: " + e.getMessage());
            }
        }
    }

    // 类型映射
    // TEXT       → VARCHAR(500)
    // NUMBER     → INTEGER
    // DECIMAL    → NUMERIC(18,4)
    // SELECT     → VARCHAR(100)
    // DATE       → TIMESTAMP
    // ATTACHMENT → VARCHAR(1000)  (存 OSS URL)
    // SUB_TABLE  → CREATE TABLE {module}_{field}_items (
    //                id UUID PRIMARY KEY, parent_id UUID NOT NULL,
    //                {columns...}, created_at TIMESTAMP DEFAULT NOW()
    //              )
}
```

### 3.5 DynamicFieldService — 双轨读写

```java
@Service
public class DynamicFieldService {

    // 读: 获取某条记录的所有动态字段值
    Map<String, Object> getDynamicFields(String tableName, String recordId);

    // 写: 更新某条记录的动态字段
    void setDynamicFields(String tableName, String recordId, Map<String, Object> fields);

    // 缓存: module_code → List<CanvasDynamicField> (ACTIVE 状态)
    void refreshCache();
    List<CanvasDynamicField> getActiveFields(String factoryId, String moduleCode);
}
```

### 3.6 DynamicFieldAspect — 零侵入注入

```java
@Aspect
public class DynamicFieldAspect {

    // 拦截返回 BaseEntity 子类的 GET 接口
    // 自动追加 customFields: Map<String, Object>
    @AfterReturning(pointcut = "...", returning = "result")
    void injectDynamicFields(Object result);

    // 拦截 POST/PUT 接口
    // 从 request body 的 customFields 提取，写入动态列
    @Before("...")
    void extractDynamicFields(JoinPoint jp);
}
```

**现有 17 个模块 Controller 零改动。**

---

## 4. 扩展二：子表

### 4.1 创建方式

Canvas 定义 `field_type=SUB_TABLE` 的动态字段时，`config.columns` 描述子表列定义。发布时 DDLExecutor 创建真实子表：

```sql
-- 示例: sales_order 的 payment_records 子表
CREATE TABLE sales_order_payment_records_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL,  -- 关联主表 sales_orders.id
    cf_amount NUMERIC(18,4),
    cf_payment_date TIMESTAMP,
    cf_receipt_url VARCHAR(1000),
    cf_remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_parent ON sales_order_payment_records_items(parent_id);
```

### 4.2 DynamicTableService

```java
@Service
public class DynamicTableService {

    List<Map<String, Object>> getRows(String subTableName, String parentId);
    Map<String, Object> addRow(String subTableName, String parentId, Map<String, Object> row);
    void updateRow(String subTableName, String rowId, Map<String, Object> row);
    void deleteRow(String subTableName, String rowId);
}
```

### 4.3 子表 API

```
GET    /api/mobile/{factoryId}/{moduleCode}/{recordId}/sub-table/{fieldCode}
POST   /api/mobile/{factoryId}/{moduleCode}/{recordId}/sub-table/{fieldCode}
PUT    /api/mobile/{factoryId}/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}
DELETE /api/mobile/{factoryId}/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}
```

---

## 5. 扩展三：用户级权限

### 5.1 现状

`UserMenuPermission` 已有 `userId + menuCode + grantType(GRANT/REVOKE)`，但 `getEffectiveConfig` 只按 roleCode 过滤。

### 5.2 变更

```java
// V2
getEffectiveConfig(String factoryId, String moduleCode, String roleCode)

// V3
getEffectiveConfig(String factoryId, String moduleCode, String roleCode, String userId)
```

**权限合并优先级**: 用户 REVOKE > 用户 GRANT > 角色权限 > 模块默认

### 5.3 Canvas UI

"人员权限"面板: 选用户 → 配字段可见/只读/隐藏。配置保存到 `UserMenuPermission`，`menuCode` 格式扩展为 `{moduleCode}:{fieldCode}:{permission}`。

---

## 6. 扩展四：文件上传字段

### 6.1 字段类型

`field_type=ATTACHMENT`，数据库列存 OSS URL（VARCHAR(1000)）。

### 6.2 config

```json
{
  "maxSize": 10485760,
  "accept": ".pdf,.jpg,.png",
  "maxCount": 5
}
```

多文件时存 JSON 数组: `["https://oss/a.pdf", "https://oss/b.jpg"]`

### 6.3 上传流程

复用现有阿里云 OSS（`cretas-media` bucket，账号 B），上传接口复用或扩展现有 `/api/mobile/{factoryId}/upload`。

---

## 7. 扩展五：条件联动渲染

### 7.1 EffectiveField 新字段

```java
String visibleWhen;   // "status == 'SHIPPED'" — 前端控制显隐
String computedWhen;  // "shippedQty > 0 ? shippedAmount : orderAmount" — 前端动态计算
String source;        // "jpa" | "dynamic" — 前端区分来源
```

### 7.2 前端执行

`visibleWhen` 和 `computedWhen` 表达式由前端解析执行（简化版 SpEL → JavaScript 表达式转换），响应实时交互。复杂表达式可回调后端 `/evaluate` 接口。

---

## 8. 扩展六：聚合公式

### 8.1 AggregateFormulaExecutor

```java
@Component
public class AggregateFormulaExecutor {

    // 解析: "GROUP_BY(items, 'taxRate', SUM('amount'))"
    // 执行: SELECT tax_rate, SUM(amount) FROM sales_order_items WHERE order_id = ? GROUP BY tax_rate
    // 返回: [{taxRate: "9%", amount: 2500}, {taxRate: "13%", amount: 800}]
    List<Map<String, Object>> execute(String expression, Map<String, Object> context);
}
```

### 8.2 FormulaEngine 路由

```java
Object evaluate(String factoryId, String moduleCode, String formulaCode, Map<String, Object> variables) {
    FactoryFormula formula = lookup(factoryId, moduleCode, formulaCode);
    if ("AGGREGATE".equals(formula.getResultType())) {
        return aggregateExecutor.execute(formula.getExpression(), variables);
    }
    return spelEvaluator.evaluateFormula(formula.getExpression(), variables, formula.getPrecisionVal());
}
```

### 8.3 支持的聚合函数

`GROUP_BY`, `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`

---

## 9. 扩展七：Tab 布局模板

### 9.1 layoutConfig 结构化

```json
{
  "tabs": [
    {"code": "basic", "label": "基本信息", "fieldCodes": ["customerName", "orderDate", "cf_customer_level"]},
    {"code": "invoice", "label": "开票记录", "type": "sub_table", "fieldCode": "invoice_records"},
    {"code": "payment", "label": "收款记录", "type": "sub_table", "fieldCode": "payment_records"},
    {"code": "shipping", "label": "出库记录", "type": "ref_table", "refModule": "sales_delivery"}
  ],
  "defaultTab": "basic"
}
```

### 9.2 Tab 类型

| type | 含义 | 数据来源 |
|------|------|---------|
| (默认) | 字段分组 | fieldCodes 指定的字段 |
| sub_table | Canvas 动态子表 | DynamicTableService |
| ref_table | 关联模块记录列表 | 关联模块 API |

---

## 10. 新增 AI Tools (6 个)

| Tool | 功能 | 示例指令 |
|------|------|---------|
| `canvas_add_field` | 添加动态字段 | "给销售订单加一个客户等级字段" |
| `canvas_add_sub_table` | 添加子表 | "给研发样品加追踪记录子表" |
| `canvas_set_visibility` | 设置条件显隐 | "出库后才显示实际金额" |
| `canvas_set_formula` | 设置聚合公式 | "按税率分组汇总金额" |
| `canvas_set_user_permission` | 设置人员权限 | "张权只能看销售订单" |
| `canvas_add_attachment_field` | 添加附件字段 | "发票记录加 PDF 上传" |

V2 (6) + V3 (6) = **12 个 Canvas AI Tools**。

---

## 11. DynamicFieldController API

```
POST   /api/mobile/{factoryId}/config/v2/dynamic-fields          — 新增动态字段
GET    /api/mobile/{factoryId}/config/v2/dynamic-fields           — 查询动态字段列表
PUT    /api/mobile/{factoryId}/config/v2/dynamic-fields/{code}    — 修改字段配置
DELETE /api/mobile/{factoryId}/config/v2/dynamic-fields/{code}    — 标记 DISABLED
GET    /api/mobile/{factoryId}/config/v2/ddl-log                  — DDL 执行历史
```

---

## 12. PARTIAL 需求覆盖验证

| # | 需求 | V3 解决方案 | 扩展 |
|---|------|-----------|------|
| P0-3a | 税率分组 SUM | AggregateFormulaExecutor GROUP_BY | 聚合公式 |
| P0-3b | 金额随出库联动 | computedWhen SpEL | 条件渲染 |
| P0-3c | 发票 PDF 上传 | type=attachment + OSS | 文件上传 |
| P0-3d | 多次付款记录 | type=sub_table 子表 | 子表 |
| P0-6 | 指定人员授权 | getEffectiveConfig + userId | 用户权限 |
| P0-9 | 3 个状态字段 | canvas_add_field + DDL | 动态字段 |
| P0-11 | SO 4 tab 业务中心 | layoutConfig.tabs 结构化 | Tab 布局 |
| P0-13 | PC 批次强制 | canvas_add_field + DDL | 动态字段 |
| P1-4 | 双仓体系 | canvas_add_field SELECT | 动态字段 |
| P1-7 | 合同附件 | type=attachment | 文件上传 |
| P1-8 | 研发样品追踪 | type=sub_table 子表 | 子表 |
| P1-9 | BOM 变更痕迹 | type=sub_table 子表 | 子表 |
| B3 | 字段联动显隐 | visibleWhen SpEL | 条件渲染 |
| P0-3a+ | 按仓库/工序统计 | AggregateFormulaExecutor | 聚合公式 |

**14/14 全覆盖。**

---

## 13. 新增代码量估算

| 组件 | 文件数 | 估算行数 |
|------|--------|---------|
| DDLExecutor + CanvasDDLLog 实体 | 2 | ~200 |
| DynamicFieldService | 1 | ~250 |
| DynamicTableService | 1 | ~200 |
| CanvasDynamicField 实体 + Repository | 2 | ~120 |
| DynamicFieldController | 1 | ~150 |
| DynamicFieldAspect | 1 | ~120 |
| AggregateFormulaExecutor | 1 | ~150 |
| 6 个新 AI Tools | 6 | ~600 |
| getEffectiveConfig 扩展 | 修改 | ~80 |
| ConfigPublishService 扩展 | 修改 | ~60 |
| FormulaEngine 路由扩展 | 修改 | ~30 |
| SQL 迁移 (2 新表 + seed) | 2 | ~100 |
| **合计** | **~18 文件** | **~2060 行** |

---

## 14. V4a — DynamicFormRenderer（配置驱动渲染）

### 14.1 现状

已有基础设施：
- `web-admin/src/views/modules/components/SchemaFormRenderer.vue` — 已实现 schema 驱动渲染，支持 10+ 字段类型、字段分组、条件显隐、只读模式
- `web-admin/src/views/modules/DynamicModulePage.vue` — 通用路由 `/modules/:moduleCode`
- 26 个 Canvas 编辑器组件已就位

### 14.2 需要扩展

在 `SchemaFormRenderer` 基础上扩展，不重写：

| 能力 | 现有 | V4a 补齐 |
|------|------|---------|
| 基础字段类型 | string/text/decimal/integer/boolean/date/select | + attachment/sub_table |
| 动态字段 | 不支持 | source=dynamic 的字段自动混入，CRUD 走 DynamicFieldService |
| 条件显隐 | dependsOn 简单逻辑 | visibleWhen SpEL 表达式（前端执行） |
| 动态计算 | 不支持 | computedWhen SpEL 表达式（前端执行） |
| 子表渲染 | line_items 固定结构 | type=sub_table 动态列定义，可编辑 el-table |
| 附件上传 | 不支持 | type=attachment，el-upload + OSS |
| Tab 布局 | 无结构 | layoutConfig.tabs 驱动 el-tabs 渲染 |
| 用户权限 | 角色级 | userId 级字段权限过滤 |

### 14.3 SpEL → JavaScript 转换

前端需要一个轻量 SpEL 解析器执行 `visibleWhen`/`computedWhen`：

```typescript
// spelEvaluator.ts
// 支持: ==, !=, >, <, >=, <=, &&, ||, !, 三元运算符, 属性访问
// 输入: "status == 'SHIPPED' && amount > 0"
// 上下文: { status: 'SHIPPED', amount: 3300 }
// 输出: true
function evaluateSpel(expression: string, context: Record<string, any>): any;
```

### 14.4 客户演示路径页面替换（6 页）

优先替换六扇门核心演示路径的硬编码页面为 DynamicModulePage：
1. 销售订单 (sales_order) — 含 4 tab
2. 研发样品 (rd_sample)
3. BOM (bom) — 含原辅料 3 tab
4. 生产计划 (production_plan)
5. 物料需求单 (material_requisition)
6. 发票记录 (invoice_record)

其余 43 页保持硬编码，后续按需迁移。

---

## 15. V4b — PageEditor（拖拽编辑器）

### 15.1 技术选型

- `@vue-flow/core` ^1.48.2 — 已安装，用于流程图/连线
- `vuedraggable` (vue-draggable-next) — 新增，字段拖拽排序
- Canvas 编辑器已有 26 个组件 — 在此基础上扩展

### 15.2 PageEditor 组件架构

```
canvas-editor/
├─ index.vue                     (已有，扩展)
├─ PageEditor.vue                (NEW — 主编辑器)
│   ├─ FieldPalette.vue          (NEW — 左侧字段类型面板，拖拽源)
│   ├─ FormCanvas.vue            (NEW — 中间画布，拖拽目标)
│   ├─ FieldPropertyDrawer.vue   (已有，扩展 — 右侧属性面板)
│   └─ PreviewPanel.vue          (NEW — 实时预览)
├─ TabLayoutEditor.vue           (NEW — Tab 拖拽编排)
└─ composables/
    └─ usePageEditor.ts          (NEW — 编辑器状态管理)
```

### 15.3 FieldPalette（字段类型面板）

左侧面板展示可拖入的字段类型：

```
基础字段          扩展字段          布局
─────────       ─────────       ─────────
📝 文本          📎 附件           ── 分割线
🔢 数字          📋 子表           📑 Tab 分组
💰 金额          🔗 关联引用       📦 折叠面板
📅 日期          📊 聚合公式
☑️ 开关
🔽 下拉选择
```

拖入画布后自动生成 `CanvasDynamicField` 配置。

### 15.4 FormCanvas（画布）

- 显示当前模块所有字段（JPA + 动态），按 layoutConfig 排列
- 支持拖拽排序（vuedraggable）
- 点击字段 → 右侧 FieldPropertyDrawer 显示属性
- 支持拖拽到不同 Tab/分组

### 15.5 PreviewPanel（实时预览）

- 复用 SchemaFormRenderer 渲染当前配置
- 切换预览模式：桌面 / 移动端
- 切换角色/用户预览权限效果

### 15.6 交互流程

```
1. 管理员进入 Canvas → 选模块 → 进入 PageEditor
2. 左侧拖字段到画布 → 自动创建动态字段定义 (PENDING_DDL)
3. 点击字段 → 右侧配属性 (label/type/visibleWhen/required...)
4. 拖拽 Tab → 配 Tab 内容
5. 右上预览 → 切换角色查看效果
6. 保存 Draft → 提交审核 → 发布 (执行 DDL)
```

---

## 16. 更新后的代码量估算

| 阶段 | 组件 | 文件数 | 估算行数 |
|------|------|--------|---------|
| **V3 后端** | DDL + Dynamic + Aggregate + AI Tools | ~18 | ~2060 |
| **V4a 渲染** | SchemaFormRenderer 扩展 + SpEL 解析 + 6 页迁移 | ~12 | ~1500 |
| **V4b 编辑器** | PageEditor + FieldPalette + FormCanvas + Preview + TabLayout | ~8 | ~2000 |
| **合计** | | **~38 文件** | **~5560 行** |

---

## 17. 不在本次范围内

- 49 页 el-form 全站迁移（只做 6 页演示路径）
- RN App 端 schemaJson 渲染 (P3-7)
- Formily 引入 (P3-11)
- 3 种报工模式 (P3-9)
- 钉钉集成 (P3-10)
