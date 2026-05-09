# C-6: Canvas Reactive Default Framework

**版本**: 1.0
**日期**: 2026-05-09
**作者**: Architect (AI subagent — `feature-dev:code-architect`)
**状态**: Draft — 待 Phase B 实施前 reviewer 确认

---

## 1. Executive Summary

### 1.1 问题陈述

Cretas Canvas 双轨渲染系统（`renderingMode: 'LEGACY' | 'DYNAMIC' | 'DUAL'`）当前缺乏通用的"选 reference 字段 → 派生其他字段值"机制。这是一个反复出现的需求模式：销售单/采购单选物料后自动计算箱数（P1-2）、识别抄码品标签（P1-3）、销售单选产品后默认单价为 BOM 合算成本（P1-4），以及未来的选客户→默认账期、选供应商→默认仓库等。每次需求都需要在 LEGACY Vue 组件里写一次专用 `watch` + API 调用，无法被 Canvas DYNAMIC 轨道复用，造成重复实现和维护负担。

### 1.2 解决方案

C-6 在 Canvas schema 层引入 `projectFields` 配置：`ReferenceSelector` 选中 entity 后，除了 emit 当前的 `valueField` id，还把 schema 声明的额外 entity 字段写回 `formData` 或 `row`（以 `_` 前缀的私有 shadow 字段形式），然后 `computed` 表达式通过 `spelEvaluator.ts` 的 `evaluateSpelValue` 函数读取这些 shadow 字段自动计算派生值，`visibleWhen` 也能读取 shadow 字段控制条件显示。对于 line items 场景，`LineItemsEditor` 中行内的 reference cell 选中后，同样将 shadow 字段写回到该行 `row` 对象，让行内 `computed` 字段立即重算。后端 entity GET 端点需要在响应中暴露 `projectFields` 引用的字段（含包装层级换算系数）。

### 1.3 工作量与 ETA

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| Phase A | ReferenceSelector + LineItemsEditor 前端实现 | 1 天 |
| Phase B | 后端端点扩展（material-types/{id} 合并包装数据） | 0.5 天 |
| Phase C | Schema migration (purchase_order + sales_order) | 0.5 天 |
| Phase D | 测试 + DUAL 回归 | 0.5 天 |

**总计 ETA: 2-3 天**。前置条件：Phase B Canvas 框架已在生产稳定运行（当前状态满足）。

---

## 2. 现状审计

### 2.1 LineItemsEditor — toy parser 限制

`web-admin/src/views/modules/components/LineItemsEditor.vue:79-93`：

```typescript
props.itemSchema.fields
  .filter((f) => f.computed)
  .forEach((f) => {
    try {
      // 简单乘法: "quantity * unitPrice"
      const parts = f.computed!.split('*').map((p) => p.trim())
      if (parts.length === 2) {
        const a = Number(row[parts[0]]) || 0
        const b = Number(row[parts[1]]) || 0
        row[f.code] = Math.round(a * b * 100) / 100
      }
    } catch {
      // ignore
    }
  })
```

toy parser 硬编码 `split('*')`：只支持形如 `"a * b"` 的两操作数乘法。`"quantity / level1PerLevel2"`（除法）、`"a + b * c"`（混合）、带 null-guard 的表达式均无法处理。P1-2 的箱数计算公式是除法，**当前根本无法通过 schema 驱动实现**。

### 2.2 ReferenceSelector — 只返回 id + label

`web-admin/src/views/modules/components/ReferenceSelector.vue:71-74`：

```typescript
options.value = list.map((item: Record<string, unknown>) => ({
  label: String(item[props.config.displayField] || ''),
  value: String(item[props.config.valueField]),
}))
```

搜索结果构建 `options` 时，仅保留 `displayField`（label）和 `valueField`（value），entity 的其他字段（如 `level1PerLevel2`、`specification`、`unitPrice`）全部丢弃。

`web-admin/src/views/modules/components/ReferenceSelector.vue:106-108`：

```typescript
function handleChange(val: string | number | null) {
  emit('update:modelValue', val)
}
```

`handleChange` 只 emit value（所选 id），没有任何机制将 entity 其他字段传递给父组件或写回 formData。

`fetchById`（line 143-187）在 edit 模式确实会拉取完整 entity，但拉回数据后只用 `displayField` + `valueField` 组装 option label，同样丢弃了其他字段（line 169-175）。

### 2.3 SchemaFormRenderer — computedWhen 不下沉到 line items

`web-admin/src/views/modules/components/SchemaFormRenderer.vue:155-165`：

```typescript
const computedValues = computed(() => {
  const result: Record<string, unknown> = {}
  if (!config.value) return result
  for (const field of config.value.fields) {
    if (field.computedWhen) {
      result[field.code] = evaluateSpelValue(field.computedWhen, formData.value)
    }
  }
  return result
})
```

`computedWhen` 仅在顶层 `fields` 循环中处理，上下文是整个 `formData.value`。`line_items` 类型字段的每一 `row` 是独立的 `Record<string, unknown>`，SchemaFormRenderer 没有把 `row` 上下文传给内部的计算逻辑。`LineItemsEditor` 接受的 `itemSchema.fields` 中的 `computed`，只走 toy parser，无法访问 `formData` 或任何 shadow 字段。

`web-admin/src/views/modules/components/SchemaFormRenderer.vue:360-365`：

```typescript
<LineItemsEditor
  v-else-if="field.type === 'line_items'"
  v-model="(formData[field.code] as Record<string, unknown>[])"
  :item-schema="(field.extra?.itemSchema as any)"
  :disabled="isReadonly(field)"
/>
```

`LineItemsEditor` 接收 `item-schema` 和 `v-model`，没有 `formData` 引用，没有跨字段回调。

### 2.4 ReferenceConfig 类型 — 无 projectFields

`web-admin/src/types/config.ts:121-128`：

```typescript
export interface ReferenceConfig {
  entity: string
  displayField: string
  valueField: string
  searchFields?: string[]
  filter?: Record<string, unknown>
  apiEndpoint: string
}
```

`projectFields` 字段缺失。同文件 `ItemSchemaField`（line 132-142）的 `computed?: string` 存在，但没有 `referenceConfig` 定义。

### 2.5 现状限制汇总

| 限制 | 影响 |
|------|------|
| L1: LineItemsEditor toy parser 只支持 `a*b` 乘法 | P1-2 箱数（除法）、混合表达式无法 schema 驱动 |
| L2: ReferenceSelector 只传 value（id），丢弃 entity 其他字段 | 选物料后 level1PerLevel2 无处取得 |
| L3: computedWhen 仅顶层 form，不下沉到 line items row | 行级派生值依赖行内 reference 字段无法实现 |
| L4: 无跨 reference 的通用 "select X → derive Y" 机制 | 每个需求都必须在 LEGACY 组件写一次专用 watch |

### 2.6 后端现状 — material-types/{id} 不含包装数据

`backend/java/cretas-api/src/main/java/com/cretas/aims/dto/material/RawMaterialTypeDTO.java:23-64`：
`RawMaterialTypeDTO` 字段包括：`id, factoryId, code, name, category, unit, storageType, shelfLifeDays, minStock, maxStock, isActive, notes, createdBy, createdAt, updatedAt, factoryName, createdByName, totalBatches, currentStock, totalValue, movingAvgPrice`。**不包含** `level1PerLevel2`、`level2Unit`、`specification` 等包装层级字段。

`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialPackagingHierarchy.java:57-59`：
包装换算系数 `level1PerLevel2 BigDecimal` 存储在独立的 `material_packaging_hierarchy` 表，通过 `MaterialPackagingHierarchyController.java:45-51` 的 `GET /material-packaging/by-material/{materialTypeId}` 端点单独获取。

C-6 需要 material-types/{id} 响应中合并包装数据，或前端在 projectFields 写回阶段额外发起请求。见 §3.2 两种方案比较。

### 2.7 LEGACY 现状 — 专用 watch 实现

LEGACY 采购订单（`web-admin/src/views/procurement/orders/list.vue:45-58`）：
手写 `packagingCache`，选原料后调用 `ensurePackagingLoaded` 拉取 `/material-packaging/by-material/{id}`，然后 `getUnitOptionsForItem` 根据缓存数据动态返回单位选项。Phase A (commit `cc031c377`) 已在此 LEGACY 路径加上箱数自动算 + 抄码品识别 — C-6 是 DYNAMIC 等价实现。

LEGACY 销售订单（`web-admin/src/views/sales/orders/list.vue:298-313`）：
`onProductSelect` 函数在选产品时读取 `products` 列表里预加载的 `boxConversionCoefficient` 字段，调用 `calcBox` 直接写回 `item.boxQuantity`。注意：这里用的是 `boxConversionCoefficient`（product-types 表字段），而不是 `MaterialPackagingHierarchy.level1PerLevel2`（原料包装表字段）。**两者来源不同，C-6 DYNAMIC 轨道需要明确以哪个为准**（见 §8 风险 R3）。

TODO: 确认 P1-2 的箱数计算，销售单应使用 product-types 的 `boxConversionCoefficient`，还是 material-packaging 的 `level1PerLevel2`？两者含义不同（前者是成品包装，后者是原料包装），audio/veteran_9.txt 需 reviewer 二次确认。

---

## 3. 提议架构 — C-6

### 3.1 核心设计

**三个相互配合的变化：**

**变化 A：ReferenceSelector 加 `projectFields` 配置**

选中 entity 后，除了 emit `valueField` id，还把 entity 中声明的额外字段写入父组件通过新 emit `project` 传递的回调（或用 `update:projectedFields` event）。在 line items 场景中，`LineItemsEditor` 接管这个回调，将字段写入 `row` 对象（用 `_` 前缀区分，避免与业务字段冲突）。

**变化 B：LineItemsEditor `updateField` 改用 `evaluateSpelValue`**

将 toy parser（`split('*')`）替换为复用 `spelEvaluator.ts:evaluateSpelValue`，让 `computed` 支持完整的 SpEL-to-JS 表达式（包括除法、条件、函数调用）。

**变化 C：Schema 声明 shadow 字段和 computed 表达式**

在 `itemFields` 里的 reference 字段上增加 `projectFields` 配置，在下游派生字段上使用 `computed: "quantity / _level1PerLevel2"` 或 `visibleWhen: "_specification != null && _specification.includes('抄码')"` 的表达式。

### 3.2 数据流时序图

```
用户在 line items 行内选物料
  │
  ▼
ReferenceSelector.search() / fetchById()
  │  拉取完整 entity（API 调用）
  │  response: { id, name, unit, level1PerLevel2, specification, ... }
  ▼
handleChange(val)
  │  emit('update:modelValue', val)          ← 现有行为，保持不变
  │  emit('project', { _level1PerLevel2: entity.level1PerLevel2,
  │                    _specification:   entity.specification })
  ▼
LineItemsEditor.updateField(rowIndex, 'materialTypeId', val)
  │  row[fieldCode] = val
  │  接收 projectedFields → 写入 row:
  │    row['_level1PerLevel2'] = entity.level1PerLevel2
  │    row['_specification']   = entity.specification
  ▼
computed 字段重算（evaluateSpelValue 替换 toy parser）
  │  boxQuantity.computed = "quantity / _level1PerLevel2"
  │    → evaluateSpelValue("quantity / _level1PerLevel2", row)
  │    → row['boxQuantity'] = row.quantity / row._level1PerLevel2
  │
  │  抄码_tag.visibleWhen = "_specification != null"
  │    → evaluateSpelBoolean("_specification != null", row)
  │    → true/false → 控制单元格显示
  ▼
emit('update:modelValue', updated rows)
```

顶层 `formData` 场景（非 line items）数据流类似，但 shadow 字段写入 `formData.value`，`computedWhen` 在 `SchemaFormRenderer.computedValues` computed 属性中自动重算。

### 3.3 Schema 示例

以 purchase_order `items.materialTypeId` 为例：

```json
{
  "code": "materialTypeId",
  "type": "reference",
  "label": "物料",
  "required": true,
  "referenceConfig": {
    "entity": "materialType",
    "displayField": "name",
    "valueField": "id",
    "apiEndpoint": "/api/mobile/{factoryId}/raw-material-types",
    "projectFields": {
      "level1PerLevel2": "_level1PerLevel2",
      "specification":   "_specification"
    }
  }
}
```

注：`apiEndpoint` 使用 `/raw-material-types`（真实路径），不是 `/material-types`（V20260409_03 seed 中存在的错误路径，`ReferenceDataController.java:321` 注释已指出此问题）。

派生字段 `boxQuantity`：

```json
{
  "code": "boxQuantity",
  "label": "箱数",
  "type": "decimal",
  "required": false,
  "precision": 2,
  "computed": "quantity > 0 && _level1PerLevel2 != null && _level1PerLevel2 > 0 ? quantity / _level1PerLevel2 : null"
}
```

条件可见字段 `_chaoMaLabel`（抄码品标签，P1-3）：

```json
{
  "code": "_chaoMaLabel",
  "label": "抄码品",
  "type": "string",
  "readonly": true,
  "defaultValue": "抄码品",
  "visibleWhen": "_specification != null && _specification.includes('抄码')"
}
```

完整 P1-2/P1-3 schema 草稿详见 §5 SQL migration。

### 3.4 接口契约改动

#### 3.4.1 TypeScript 类型扩展

**`web-admin/src/types/config.ts:121-128`** — `ReferenceConfig` 加 `projectFields`：

```typescript
export interface ReferenceConfig {
  entity: string
  displayField: string
  valueField: string
  searchFields?: string[]
  filter?: Record<string, unknown>
  apiEndpoint: string
  /** C-6: 选中 entity 后写回 shadow 字段的映射: entity 字段名 → row shadow 字段名 */
  projectFields?: Record<string, string>
}
```

**`web-admin/src/types/config.ts:132-142`** — `ItemSchemaField` 加 `referenceConfig`（当前缺失）：

```typescript
export interface ItemSchemaField {
  code: string
  type: FieldType
  label: string
  required: boolean
  min?: number
  max?: number
  precision?: number
  options?: FieldOption[]
  computed?: string
  visibleWhen?: string
  defaultValue?: unknown
  referenceConfig?: ReferenceConfig   // ← C-6 新增，与顶层 field 对齐
}
```

**`web-admin/src/views/modules/components/LineItemsEditor.vue:16-35`** — `ItemField.referenceConfig` 加 `projectFields`（当前 `ItemField.referenceConfig` 无此字段）：

```typescript
interface ItemField {
  // ... 现有字段不变 ...
  referenceConfig?: {
    entity: string
    displayField: string
    valueField: string
    apiEndpoint: string
    projectFields?: Record<string, string>   // ← C-6 新增
  }
}
```

#### 3.4.2 ReferenceSelector props/emits 扩展

**`web-admin/src/views/modules/components/ReferenceSelector.vue`** 新增：

```typescript
// props: config 类型使用扩展后的 ReferenceConfig（含 projectFields）
// emits 新增:
'project': [fields: Record<string, unknown>]
// 选中 entity 后，将 projectFields 映射的 entity 字段值 emit 给父组件
```

**实现要点（spec amendment per code-reviewer audit, May 9 2026）：**

1. **Parallel `Map<value, entity>` 缓存**（**不**augment options[i]._entity）：
   ```typescript
   const optionEntities = ref<Map<string, Record<string, unknown>>>(new Map())
   ```
   - `search()` 时 rebuild map（保留当前 `modelValue` 对应 entry 防 watch 触发不必要的 fetch）
   - `fetchById()` 拉到 entity 后 `optionEntities.set(value, entity)`
   - 取舍：option 大对象不进 v-for diff，更轻

2. **`fetchToken` 并发竞争防御**：
   ```typescript
   let fetchToken = 0
   async function fetchById(id) {
     const myToken = ++fetchToken
     // ... fetch ...
     if (myToken !== fetchToken) return  // stale, abandon
   }
   ```
   防止用户连续切 modelValue 时旧响应覆盖新选择。

3. **`SHADOW_KEY_RE` 校验**（详见 §3.4.4）

4. **emit 时机汇总**：
   - `handleChange(val)` 用户主动选 → emit('update:modelValue') + emit('project')
   - `fetchById(id)` 完成后（edit 模式 init）→ emit('project')
   - `watch(modelValue)` cache-hit 路径 → emit('project') 同步从 cache 读
   - `watch(modelValue)` value 变 null（clearable）→ emit('project', {shadowKey:null,...})

#### 3.4.3 后端端点扩展需求

**选项 1（推荐）：** `GET /raw-material-types/{id}` 响应合并包装层级数据。修改 `RawMaterialTypeController.java:108-116` 的 `getMaterialTypeById`，在 `RawMaterialTypeDTO` 里嵌套 `packagingInfo`（或直接展平 `level1PerLevel2`、`level2Unit` 等字段）。好处：一次 API 调用完成，不增加请求数。

**选项 2：** 前端在 `projectFields` 写回时额外发起 `GET /material-packaging/by-material/{id}` 请求。好处：不改后端，缺点：多一次 RTT，CANVAS 表单每次选料都多一个请求。

**当前采购单 LEGACY 已使用选项 2**（`procurement/orders/list.vue:49-58`），但 C-6 推荐选项 1，让 entity GET 端点成为 one-stop-shop。

**⛔ 强制 (spec amendment per reviewer audit)**：选项 1 后端响应 **MUST be flat** — `projectFields` 的 entityKey 是 entity 字段顶层 key，不支持 lodash-style nested path。即返回 `{ id, name, level1PerLevel2: 10, level2Unit: '箱', ... }`，**禁止** `{ id, name, packagingInfo: { level1PerLevel2: 10 } }` 嵌套结构（会让 schema 作者无法引用）。如果 entity 数据来自多张表 join，后端在 DTO 层做 flatten。

需要扩展的端点列表（实施阶段确认）：
- `GET /api/mobile/{factoryId}/raw-material-types/{id}` — 扁平合并 `level1PerLevel2, level2Unit, level2PerLevel3, level3Unit, specification`（如 entity 有此字段）
- `GET /api/mobile/{factoryId}/product-types/{id}` 或 finished-goods equivalent — 确认 `boxConversionCoefficient, unitPrice` 是否已经在响应中（sales LEGACY 已能从 products 列表里取到这些字段）

#### 3.4.4 Shadow key validation (spec amendment per reviewer audit)

`projectFields` 的 value（写回的 shadow key）来自 DB-driven `module_schemas`。Admin 可以配置任意字符串。`{...row, shadowKey: value}` spread 在 V8 上：

- `shadowKey === '__proto__'` → 真的会改 row 的 prototype
- `shadowKey === 'constructor'` → 改 row.constructor，影响 `instanceof`
- 数字 / 包含 `.`、空格、特殊字符 → 破坏 Vue reactivity tracking

**强制 regex**:
```typescript
const SHADOW_KEY_RE = /^_[a-zA-Z][a-zA-Z0-9_]*$/
```

- 必须 `_` 前缀（与 Task 6 SchemaFormRenderer.handleSubmit 的 `payload[k].startsWith('_')` 过滤约定一致）
- 后续仅 alphanumeric + underscore
- 不匹配 → `console.error` 跳过该字段（**不抛**，避免单字段配错破坏整个 form）

ReferenceSelector + LineItemsEditor 在 emit/写入路径都要校验。Backend `module_schemas` save 时也应在 service 层校验（Phase B Task 8 候选）。

TODO: 确认 RawMaterialType entity 是否有 `specification` 字段。当前 `RawMaterialTypeDTO.java` 没有此字段，`RawMaterialType.java` 实体也未找到此字段。P1-3 的"抄码品"判断究竟基于哪个字段？需要 reviewer 在 audio/veteran_9.txt 中再确认，或检查 `MaterialSpecConfig.java`。

### 3.5 SpEL 表达式范围确认

`web-admin/src/utils/spelEvaluator.ts:44-72`：`evaluateSpel` 通过 `new Function(...keys, 'return (' + jsExpr + ')')` 将表达式放入 JS 运行时执行。

**支持**（JavaScript 原生）：
- 算术：`+`, `-`, `*`, `/`, `%`（除法 `/` 原生支持，toy parser 不支持但 `evaluateSpelValue` 支持）
- 比较：`==`, `!=`, `>`, `<`, `>=`, `<=`（通过 SpEL-to-JS 映射 + 原生）
- 逻辑：`&&`, `||`, `!`（通过 `and/or/not` 映射）
- 三元：`condition ? a : b`（原生）
- 字符串方法：`.includes()`, `.startsWith()` 等（原生 JS String 方法）
- 时间函数：`now(), addHours(), addDays(), daysBetween()`（line 20-42 注入）
- 属性访问：`row.field` 或直接 `fieldCode`（通过 Function 参数展开）

**不支持**：
- SpEL 原生的 null-safe operator `?.`（无替换规则，直接访问 null 属性会抛 TypeError，被 catch 吞掉返回 true — 对 `visibleWhen` 是安全行为，对 `computed` 会静默返回 `true` 而非 `null`）
- Java SpEL `matches` 正则操作符（无替换）
- `instanceof`（无替换）
- SpEL collection projection `![...]` / selection `?[...]`

**重要差异 — 后端 `SpelConditionEvaluator.java`**：

`backend/java/cretas-api/src/main/java/com/cretas/aims/engine/SpelConditionEvaluator.java:35-46`：后端使用 Spring `SpelExpressionParser` + `SimpleEvaluationContext`，属于完整 Spring SpEL。前端 `spelEvaluator.ts` 是通过正则替换模拟的子集。

| 后端支持 | 前端支持 | 注意 |
|---------|---------|-----|
| `null` 字面量 | `null` | 一致 |
| `?.` null-safe | 不支持 | 前端需用 `field != null && field.xxx` |
| `T(Math).max(a,b)` | 不支持（被 `isExpressionUnsafe` 拦截） | C-6 不需要 |
| 算术 `/` | 支持 | 一致 |
| `#variableName` | `#` prefix 被 strip（line 60） | C-6 shadow 字段用 `_` 前缀，不用 `#` |

**C-6 表达式设计约定**：
1. Shadow 字段使用 `_` 前缀（如 `_level1PerLevel2`），不使用 `#` 前缀，避免 `spelEvaluator.ts:60` 的 `#` strip 规则把前缀吃掉。
2. null-guard 用显式三元：`_level1PerLevel2 != null && _level1PerLevel2 > 0 ? quantity / _level1PerLevel2 : null`
3. 字符串包含判断：`_specification != null && _specification.includes('抄码')`（前端 JS String.includes 支持，后端 SpEL String.contains 方法也支持）

### 3.6 DefaultValueResolver 架构关系

`backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DefaultValueResolver.java:21-31`：当前后端 `DefaultValueResolver` 处理的是"字段静态默认值"（从 `factory_default_values` 表读取，支持 SpEL condition 匹配），与 C-6 的"动态 reference 派生值"不同。

C-6 的派生值计算发生在**前端客户端**：`ReferenceSelector` 选中后写 shadow 字段 → `evaluateSpelValue` 实时计算。提交时，`SchemaFormRenderer.handleSubmit`（line 188-214）已有 `computedWhen` 值写回 payload 的逻辑，同样机制可用于 shadow 字段过滤（shadow 字段 `_` 前缀不提交）。

后端 `DefaultValueResolver` **不需要改动**，C-6 是纯前端 reactive 机制。

---

## 4. 实施阶段

### Task 1: ReferenceSelector — 实现 projectFields 写回

**文件**: `web-admin/src/views/modules/components/ReferenceSelector.vue`

**spec amendment (per reviewer audit, May 9 2026)**：原 Task 1 拆分为 4 个子任务以覆盖完整 emit 时机和并发/校验边界。

#### Task 1a: 数据结构 + 同步 emit 路径（handleChange）

1. 新增 `optionEntities = ref<Map<string, Record<string, unknown>>>(new Map())` parallel cache（**不**augment `options[i]._entity` — 见 §3.4.2 取舍）
2. 新增常量 `SHADOW_KEY_RE = /^_[a-zA-Z][a-zA-Z0-9_]*$/`（§3.4.4）
3. 新增 helper `emitProjectFields(val)`：
   - `!props.config.projectFields` → noop
   - `shadowKey` 不匹配 SHADOW_KEY_RE → console.error 跳过
   - `!val`（clear）→ 所有 shadow key 写 null
   - cache miss → shadow 写 null
4. `search()` 在 options.value 赋值后，rebuild `optionEntities`：
   ```typescript
   const newEntities = new Map()
   for (const item of list) newEntities.set(String(item[valueField]), item)
   if (props.modelValue) {
     const cur = optionEntities.value.get(String(props.modelValue))
     if (cur && !newEntities.has(...)) newEntities.set(..., cur)  // 保留 current
   }
   optionEntities.value = newEntities
   ```
5. `handleChange(val)` 末尾 `emitProjectFields(val)`

#### Task 1b: 异步 emit 路径（fetchById）+ 并发竞争防御

1. 模块顶部 `let fetchToken = 0`
2. `fetchById(id)` 入口 `const myToken = ++fetchToken`
3. await 后立即 `if (myToken !== fetchToken) return`（C2 reviewer fix）
4. 拉到 entity 后 `optionEntities.value.set(realValue, item)`（M2 reviewer fix）
5. 接 `emitProjectFields(realValue)`（Task 7 折叠：edit 模式 init）

#### Task 1c: watch cache-hit 路径（C1 reviewer fix）

```typescript
watch(() => props.modelValue, (val) => {
  if (!val) { emitProjectFields(null); return }  // I2 clear
  if (options.value.find(o => o.value === val)) {
    emitProjectFields(val)  // C1 cache hit — 旧逻辑只触发 fetchById,不在 cache hit 时 emit
  } else {
    fetchById(val)
  }
})
```

#### Task 1d: legacy non-ASCII PK 兼容（M1 reviewer fix）

`fetchById` 在 `if (!looksLikeId(id))` 早返之前，先 `if (optionEntities.has(id)) emitProjectFields(id)` — 防止 legacy 实体 (e.g. `张三` 作 PK) 在 watch 路径下 shadow 字段永空。

**新增 emit signature**:
```typescript
const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  'project': [fields: Record<string, unknown>]
}>()
```

**预估**: ~100 行（含注释 + 4 子任务），实测 +101/-4。

**完成态**：见 commit `c5c32566d6` (feat/canvas-c6-impl branch).

**单元测试要求**:
- 选中有 level1PerLevel2=10 的物料 → emit project 含 `{ _level1PerLevel2: 10 }`
- config 无 projectFields → 不 emit project（向后兼容）
- value clearable cleared → emit project 中 shadow key 全为 null（I2）
- shadowKey="__proto__" → console.error，不写入 projected
- 并发 fetchById：早开始的响应晚回 → 被 token 拦截，不覆盖新 cache（C2）
- watch cache-hit 路径 → 同步 emit project（C1）
- looksLikeId false 但 cache hit → 仍 emit project（M1）

**新增 emit**:
```typescript
const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  'project': [fields: Record<string, unknown>]
}>()
```

**预估**: ~35 行改动（保留现有逻辑，追加 project emit）

**单元测试要求**:
- 选中有 level1PerLevel2=10 的物料 → emit project 含 `{ _level1PerLevel2: 10 }`
- config 无 projectFields → 不 emit project（向后兼容）
- fetchById 404 → project emit 空对象（不报错）
- projectFields value 为 null（entity 字段无值）→ emit `{ _fieldName: null }`

**风险**: `handleChange` 是 `@change` 事件同步触发，`fetchById` 是异步。两条路径的时序：search 时 entity 在 options 里完整，可同步提取；fetchById（edit 模式初始化）是异步，此时 handleChange 不触发，但 `watch(modelValue)` 触发的 fetchById 完成后需要 emit project（因为 edit 模式要渲染 computed 初值）。**实施时需要处理 edit 模式 fetchById 完成后的 project emit**。

### Task 2: LineItemsEditor — 接收 project emit，写入 row shadow 字段

**文件**: `web-admin/src/views/modules/components/LineItemsEditor.vue`

**改动点**:

1. `ItemField` interface（line 16-35）的 `referenceConfig` 加 `projectFields?: Record<string, string>`
2. template 中 `ReferenceSelector`（line 138-144）加监听 `@project` 事件：
   ```typescript
   @project="(projected) => onReferenceProject($index, field, projected)"
   ```
3. 新增 `onReferenceProject` 函数：
   ```typescript
   function onReferenceProject(rowIndex: number, field: ItemField, projected: Record<string, unknown>) {
     if (!field.referenceConfig?.projectFields) return
     const shadowPatch: Record<string, unknown> = {}
     for (const [entityKey, shadowKey] of Object.entries(field.referenceConfig.projectFields)) {
       shadowPatch[shadowKey] = projected[entityKey] ?? null
     }
     // 写 shadow 字段后触发 computed 重算（借用 updateField 中的 computed 逻辑）
     const updated = rows.value.map((r, i) =>
       i === rowIndex ? { ...r, ...shadowPatch } : r
     )
     // 重算 computed 字段
     const row = updated[rowIndex]
     recomputeRow(row)
     emit('update:modelValue', updated)
   }
   ```
4. 将 `updateField`（line 75-95）中的 computed 重算逻辑抽取为独立函数 `recomputeRow(row)` 供两处复用

**预估**: ~45 行改动

**单元测试要求**:
- 选物料后 project emit → row 含 `_level1PerLevel2` shadow 字段
- boxQuantity computed 立即重算
- 其他行不受影响（rowIndex 隔离）
- project emit 空对象 → shadow 字段写 null，computed 输出 null（不 NaN）

**风险**: shadow 字段以 `_` 前缀，提交时需要确保不被发到后端（见 Task 6）。

### Task 3: LineItemsEditor — toy parser 替换为 evaluateSpelValue

**文件**: `web-admin/src/views/modules/components/LineItemsEditor.vue`

**改动点**:

当前 line 12 已 import `evaluateSpelBoolean`，追加 import `evaluateSpelValue`。将 `updateField`/`recomputeRow` 中的 toy parser（line 80-93）替换为：

```typescript
props.itemSchema.fields
  .filter((f) => f.computed)
  .forEach((f) => {
    try {
      const result = evaluateSpelValue(f.computed!, row as Record<string, unknown>)
      row[f.code] = result == null ? null : Math.round(Number(result) * 100) / 100
    } catch {
      // ignore — keep existing value
    }
  })
```

注意：`evaluateSpelValue` 返回 `unknown`，需要 Number() 转换，且 null-result 不 round（否则 `Math.round(null * 100) / 100 = 0`，会覆盖掉"无值"状态）。

**向后兼容**: toy parser 只处理 `a*b`；`evaluateSpelValue` 对 `"quantity * unitPrice"` 同样输出正确结果（JS 原生乘法），已有 `lineAmount` computed 不受影响。

**预估**: ~5 行改动（替换 toy parser 块）

**单元测试要求**:
- `"quantity * unitPrice"` → 同 toy parser 结果
- `"quantity / _level1PerLevel2"` → 正确除法结果
- `"quantity > 0 && _level1PerLevel2 > 0 ? quantity / _level1PerLevel2 : null"` → null-guard 生效
- `_level1PerLevel2 = null` → 整体表达式返回 null → `row[boxQuantity] = null`（不是 0 或 NaN）

**风险**: `evaluateSpelValue` 内部 catch 时返回 `true`（`spelEvaluator.ts:69`），对 `computedWhen` 可以接受（显示），对 `computed` 数值字段返回 `true` 会被 `Number(true) = 1` 写入字段。应在 `recomputeRow` 中额外判断：`if (typeof result === 'boolean') return` 跳过布尔结果写入数值字段。

TODO: 确认 `spelEvaluator.ts:67-70` 的 catch 返回 `true` 是否需要修改，或在调用层过滤。

### Task 4: SchemaFormRenderer — 顶层 reference 字段 projectFields 写回 formData

**文件**: `web-admin/src/views/modules/components/SchemaFormRenderer.vue`

**改动点**:

1. `ReferenceSelector`（line 343-349）加 `@project` 监听：
   ```typescript
   @project="(projected) => onTopLevelProject(field, projected)"
   ```
2. 新增 `onTopLevelProject`：
   ```typescript
   function onTopLevelProject(field: EffectiveField, projected: Record<string, unknown>) {
     const refConfig = field.extra?.referenceConfig as ReferenceConfig | undefined
     if (!refConfig?.projectFields) return
     for (const [entityKey, shadowKey] of Object.entries(refConfig.projectFields)) {
       formData.value[shadowKey] = projected[entityKey] ?? null
     }
     // computedWhen 是 computed property，自动响应 formData 变化，无需手动触发
   }
   ```
3. `handleSubmit`（line 172-214）中 payload 构建时过滤 `_` 前缀的 shadow 字段：
   ```typescript
   for (const [k, v] of Object.entries(payload)) {
     if (k.startsWith('_')) continue  // C-6 shadow 字段不提交
     // ... 原有 source === 'dynamic' 分支逻辑
   }
   ```

**预估**: ~25 行改动

**单元测试要求**:
- 顶层 reference 选中后 shadow 字段出现在 formData
- computedWhen 引用 shadow 字段时自动重算
- submit payload 不含 `_` 前缀字段

**风险**: `computedValues` 是 Vue `computed()`，会响应 `formData.value` 的变化自动重算，无需额外触发。shadow 字段写入 `formData.value` 后 `computedWhen` 值立即更新。

### Task 5: Schema migration — purchase_order items boxQuantity

**文件**: 新增 `V20260520_01__canvas_c6_purchase_order_reactive_defaults.sql`

见 §5 SQL 草稿。

**预估**: ~30 行 SQL

**风险**: `module_schemas` 的 `field_schema` 是 `jsonb`，`jsonb_set` 不支持数组内元素的 deep path 定位（`jsonb_set` path 是 key-based，不支持 `#>'{items,0,...}'` 这种数组下标写法）。应使用 `||` 运算符替换整个 `field_schema`，或用 PostgreSQL 的 `jsonb_array_elements` + `jsonb_agg` 模式重建。见 §5 注意事项。

### Task 6: 提交过滤 — shadow 字段 `_` 前缀不发送后端

**文件**: `web-admin/src/views/modules/components/SchemaFormRenderer.vue`（已在 Task 4 包含）

**LineItemsEditor** 侧：`LineItemsEditor` emit 的 rows 是完整 row 对象（含 shadow 字段），会被上层 `formData['items']` 原样包含。`handleSubmit` 中对 `items` 数组的每个 row 也需要过滤 `_` 前缀字段。

```typescript
// handleSubmit 中 payload 构建后，过滤 line_items 内 shadow 字段
for (const field of config.value.fields) {
  if (field.type === 'line_items' && Array.isArray(payload[field.code])) {
    payload[field.code] = (payload[field.code] as Record<string, unknown>[])
      .map(row => Object.fromEntries(
        Object.entries(row).filter(([k]) => !k.startsWith('_'))
      ))
  }
}
```

**预估**: ~12 行追加

### Task 7: edit 模式 — 初始化时 shadow 字段填充

edit 模式下，`formData` 从 `initialData` 初始化（`SchemaFormRenderer.initFormData`），此时 reference 字段已有值（id），但 shadow 字段 `_level1PerLevel2` 为空。`computedWhen`/`computed` 依赖 shadow 字段，edit 打开时显示的派生值会是 null/空。

**解决方案**：`onMounted` 后遍历 reference 类型字段，若有初始值则触发一次 `fetchById`，完成后 emit project，写回 shadow 字段。这复用 `ReferenceSelector` 的 `watch(modelValue)` 机制（line 197-202），只需确保 `fetchById` 完成后触发 `project` emit。

Task 1 实施时需覆盖此路径。

**预估**: 在 Task 1 中包含，+10 行

---

## 5. Schema Migration SQL 草稿

```sql
-- V20260520_01__canvas_c6_purchase_order_reactive_defaults.sql
-- C-6 Reactive Default: purchase_order items 加 boxQuantity 列 + projectFields

-- 注意: jsonb 数组内 itemFields 的修改不能用简单 jsonb_set path,
-- 需要用 jsonb_array_elements + jsonb_agg 重建数组.
-- 以下使用 field_schema 整体替换方式 (SAFE for ON CONFLICT schemas).

UPDATE module_schemas
SET field_schema = field_schema || jsonb_build_object(
  'items', jsonb_build_object(
    'code', 'items',
    'label', '采购明细',
    'type', 'line_items',
    'formVisible', true,
    'sortOrder', 10,
    'itemFields', (
      SELECT jsonb_agg(
        CASE
          -- materialTypeId: 加 projectFields
          WHEN (elem->>'fieldCode') = 'materialTypeId'
          THEN elem || jsonb_build_object(
            'referenceConfig', jsonb_build_object(
              'entity', 'materialType',
              'displayField', 'name',
              'valueField', 'id',
              'apiEndpoint', '/api/mobile/{factoryId}/raw-material-types',
              'projectFields', jsonb_build_object(
                'level1PerLevel2', '_level1PerLevel2',
                'level2Unit', '_level2Unit'
              )
            )
          )
          ELSE elem
        END
      )
      FROM jsonb_array_elements(
        (SELECT field_schema->'items'->'itemFields'
         FROM module_schemas WHERE module_code = 'purchase_order')
      ) AS elem
    )
    -- 追加 boxQuantity itemField
    || jsonb_build_array(jsonb_build_object(
      'fieldCode', 'boxQuantity',
      'label', '箱数',
      'type', 'decimal',
      'required', false,
      'precision', 2,
      'computed', 'quantity > 0 && _level1PerLevel2 != null && _level1PerLevel2 > 0 ? quantity / _level1PerLevel2 : null',
      'readOnly', true
    ))
  )
)
WHERE module_code = 'purchase_order';
```

**注意事项**:

1. 上述 SQL 草稿逻辑展示意图，实际执行前需验证 `field_schema->'items'->'itemFields'` path 是否与当前 V20260410_08 seed 的真实结构一致（seed 用的是 `itemFields` key，line 16 确认）。

2. `V20260410_08__module_schemas_batch1_core.sql:16` 的 purchase_order field_schema 是数组格式（`[{...}, {...}]`），而不是 V20260409_02 的对象格式（`{"fields": [...]}`）。两个 module 的 field_schema 格式不统一。Migration SQL 需针对具体格式编写。

3. sales_order 的 boxQuantity 已经存在于 `V20260409_02__seed_sales_order_bom_schema.sql:9`（`"code":"boxQuantity","label":"下单箱数","type":"decimal"` 在顶层 fields，不在 items 里），但该字段当前是手动填写，不是 computed。C-6 migration 需要给 sales_order 的 items 内 productTypeId 加 `projectFields`，让 boxQuantity 变为 computed。

TODO: 实施阶段需先 `SELECT field_schema FROM module_schemas WHERE module_code IN ('purchase_order', 'sales_order')` 检查当前 prod 实际 JSON 结构再写 migration。

---

## 6. LEGACY 兼容

### 6.1 两轨并行期间无冲突

`web-admin/src/types/config.ts:17`：`renderingMode: 'LEGACY' | 'DYNAMIC' | 'DUAL'`。

- **LEGACY 轨道**（`renderingMode: 'LEGACY'`）：直接渲染 `sales/orders/list.vue`、`procurement/orders/list.vue` 等硬编码组件，C-6 的 `projectFields` schema 变化对其无影响。LEGACY 组件的 `onProductSelect`（sales, line 298-313）和 `packagingCache`（procurement, line 45-58）继续工作。
- **DYNAMIC 轨道**（`renderingMode: 'DYNAMIC'`）：通过 `SchemaFormRenderer` → `LineItemsEditor` → `ReferenceSelector` 渲染，C-6 变化只影响此路径。
- **DUAL 轨道**：两套同时渲染用于比对，C-6 给 DYNAMIC 侧加 reactive defaults，LEGACY 侧行为不变，DUAL 期间可以验证两侧结果一致。

### 6.2 LEGACY 已实现 P1-2/P1-3 的等价物（Phase A）

LEGACY sales 的 `calcBox`（line 309-313）用 `p.boxConversionCoefficient`，LEGACY procurement 的 `packagingCache`（line 45-58）用 `/material-packaging/by-material/{id}` 的 `level1PerLevel2`。Phase A commit `cc031c377` 在两文件加上抄码品识别和箱数自动算 — 是 LEGACY 路径完整实现。两者数据来源不同（见 §2.7 注记），C-6 DYNAMIC 轨道统一用 `/raw-material-types/{id}` 合并响应，以 `level1PerLevel2` 为准（采购）/ `boxConversionCoefficient` 为准（销售，需 reviewer 确认）。

### 6.3 LEGACY 专用字段不引入 DYNAMIC schema

LEGACY sales 的 `specification` 字段（`list.vue:301`）来自 product-types 的 `specification`，写入行内的 `item.specification`。C-6 P1-3 的 `_specification` shadow 字段读取来源不同（raw-material-types），不要混用同一字段名。

---

## 7. 测试策略

### 7.1 单元测试（Vitest / Jest）

| 组件 | 测试场景 |
|------|---------|
| `spelEvaluator.ts` | 新增：除法 `"a / b"`、null-guard 三元、`.includes()` 字符串方法 |
| `ReferenceSelector` | project emit 含正确 entity 字段；config 无 projectFields 时不 emit |
| `LineItemsEditor` | Task 2 + Task 3 列出的全部场景；shadow 字段写入 row；computed 除法结果；null-guard 结果为 null |
| `SchemaFormRenderer` | submit payload 不含 `_` 前缀；line_items row 过滤 shadow 字段 |

目标：新增 ~25 个单元测试用例。

### 7.2 端到端测试（Playwright / 手测）

**场景 A — 采购单 P1-2 箱数自动算**:
1. 进入 DYNAMIC 轨道采购单创建
2. 选一个有 `level1PerLevel2=10` 的物料，填写 quantity=50
3. 验证 boxQuantity 自动显示 5

**场景 B — 采购单 P1-3 抄码品标签**:
1. 选一个 `specification` 含"抄码"的物料
2. 验证行内"抄码品"标签出现
3. 选普通物料 → 标签消失

**场景 C — edit 模式初始值**:
1. 打开已有采购单 edit 模式
2. 验证 boxQuantity 有正确初始值（不为 null/空）
3. 修改 quantity → boxQuantity 实时更新

**场景 D — DUAL 回归**:
1. `renderingMode: 'DUAL'` 下，LEGACY 侧和 DYNAMIC 侧的 boxQuantity 值一致

### 7.3 Schema migration 验证

```sql
-- 部署前 dry-run
SELECT field_schema->'items'->'itemFields' FROM module_schemas WHERE module_code = 'purchase_order';
-- 部署后验证
SELECT field_schema->'items'->'itemFields' FROM module_schemas WHERE module_code = 'purchase_order';
-- 确认 materialTypeId 含 projectFields, boxQuantity 含 computed 表达式
```

---

## 8. 风险与回滚

### R1: projectFields key 与现有字段名冲突

**描述**: 若 row 已有 `_level1PerLevel2` 业务字段（不太可能，但需排除），shadow 字段会覆盖。

**缓解**: `_` 前缀约定。在 Task 2 实施时，`onReferenceProject` 写入前检查 `itemSchema.fields` 中是否有同名字段，若有则 warn 并跳过。

**回滚**: `projectFields` 是 opt-in，老 schema 无此配置时整个机制不触发，向后完全兼容。

### R2: 前端 spelEvaluator.ts 与后端 SpelConditionEvaluator 差异

**已知差异**（见 §3.5）：
- 前端不支持 SpEL `?.` null-safe operator → C-6 表达式用显式 null-check
- 前端 catch 返回 `true`，对数值字段有歧义 → Task 3 加 boolean-result 过滤

**C-6 表达式范围**限于简单算术 + null-guard + `.includes()` 字符串检查，不触碰两者差异边界。

**缓解**: C-6 schema 中的 `computed` 表达式一律在前端 `spelEvaluator.ts` 运行（非后端 SpEL），不存在前后端不一致的实际路径。后端 `SpelConditionEvaluator` 用于 `validation_schema` 规则，与 C-6 computed 字段无交叉。

### R3: LEGACY boxConversionCoefficient vs DYNAMIC level1PerLevel2 数据不一致

**描述**: sales LEGACY 用 `product-types.boxConversionCoefficient`（成品包装），procurement LEGACY 用 `material-packaging.level1PerLevel2`（原料包装）。两者含义不同，C-6 DYNAMIC 需要明确 sales 和 procurement 各自的数据来源。

**缓解**: P1-2 来自 audio/veteran_9.txt，含义需 reviewer 二次确认，本 spec 暂定 procurement 用 `level1PerLevel2`（与 LEGACY 一致），sales 用 `boxConversionCoefficient`（需要 product-types/{id} 端点暴露此字段）。

**回滚**: schema migration 用 `ON CONFLICT DO NOTHING`，可以回退 SQL（`UPDATE module_schemas SET field_schema = <original>`）恢复旧 schema。

### R4: edit 模式 fetchById 触发 project emit 导致闪烁

**描述**: edit 模式打开时，`ReferenceSelector` 的 `onMounted → fetchById` 完成后 emit project，shadow 字段写入，computed 重算，页面短暂从"空"→"有值"。

**缓解**: computed 字段标记 `readOnly: true`，用户不可手动编辑，闪烁无业务影响。若 UX 要求，可在 `SchemaFormRenderer.initFormData` 时并行发起 projectFields 的预填充请求。

### R5: V20260410_08 与 V20260409_02 field_schema 格式不统一

**描述**: 两种 seed 格式（array-of-fields vs object-with-fields-key）导致 jsonb migration 逻辑不同。

**缓解**: 实施前先读取 prod 实际值（见 §5 TODO），针对真实格式编写 SQL，而不是依赖 seed 文件格式。

### R6: 并发 fetchById 竞争（spec amendment per reviewer audit）

**描述**: 用户连续切 modelValue → 多个 `fetchById` 并发 → 旧响应可能晚于新响应到达 → `options.value` / `optionEntities` 被旧 entity 覆盖 → modelValue=B 但 shadow 字段是 A → computed 算错 → **submit payload 含错误数据**（不仅是 UX flicker，是数据正确性）。

**缓解**: `fetchToken` 模式（Task 1b）。每次 fetchById 入口 `const myToken = ++fetchToken`，await 后 `if (myToken !== fetchToken) return`。

### R7: Prototype pollution via DB-driven shadowKey（spec amendment）

**描述**: Admin 配置 `projectFields: {"name": "__proto__"}` → spread `{...row, __proto__: poison}` 在 V8 真的改 row 的 prototype → 后续 `row.toString()`/`hasOwnProperty()` 等被攻击者控制 → JSON 序列化把污染传到后端。

**缓解**: SHADOW_KEY_RE 校验（§3.4.4）+ 强制 `_` 前缀。后端 `module_schemas` save 时也应校验（Phase B follow-up Task 8）。

### R8: Clearable=true 清空时 shadow 字段留 stale（spec amendment）

**描述**: `<el-select clearable>` 用户点 X → `update:modelValue=null`，但 watch 旧逻辑只在 `val && !options.find` 时 fetchById → null 路径不 emit project → shadow 字段保留前一次值 → computed 仍在用旧 `_level1PerLevel2` 算 → boxQuantity 错。

**缓解**: watch 加 null 分支 `emitProjectFields(null)`（Task 1c），`emitProjectFields(null)` 把所有 shadowKey 写 null（Task 1a）。computed 表达式有 null-guard 三元才能正确返 null。

---

## 9. P1-4 在 C-6 下的设计 Fit（非 Phase B 范围）

P1-4 需求：销售单选产品 → 单价 `unitPrice` 默认值 = BOM 合算成本。

在 C-6 框架下实现思路：

1. `product-types/{id}` 响应加入 `bomCalculatedCost` 字段（需要后端 BOM 成本汇总计算，属于新后端逻辑）
2. items 内 `productTypeId` referenceConfig 加：
   ```json
   "projectFields": { "bomCalculatedCost": "_bomCost" }
   ```
3. `unitPrice` 字段加：
   ```json
   "computed": "_bomCost != null && (unitPrice == null || unitPrice == 0) ? _bomCost : unitPrice"
   ```
   （仅在用户未手动填写时应用默认值）

**后端依赖**：需新增 BOM 成本汇总接口或在 `product-types/{id}` 响应中包含 `bomCalculatedCost`，这是独立的后端工作，预估 1-2 天。C-6 框架建好后，P1-4 的前端部分仅需 schema migration，~0.5 天。

TODO: P1-4 BOM 成本汇总是否已有后端接口？检查 `BomController` 或 `ProductTypeController` 是否返回 cost 聚合字段。

---

## 10. 时间线与依赖

```
Day 1 AM  Task 0: 类型扩展 (config.ts, ReferenceSelector props)
Day 1 AM  Task 3: spelEvaluator / LineItemsEditor toy parser 替换 (无外部依赖)
Day 1 PM  Task 1: ReferenceSelector projectFields + fetchById project emit
Day 1 PM  Task 2: LineItemsEditor onReferenceProject + shadow 字段写入

Day 2 AM  Task 4: SchemaFormRenderer 顶层 project 写回 + submit 过滤
Day 2 AM  Task 7: edit 模式初始化 shadow 字段填充
Day 2 AM  Backend: raw-material-types/{id} 合并包装数据 (并行，如选 Option 1)

Day 2 PM  Task 5: purchase_order schema migration SQL (待后端扩展完成后可测)
Day 2 PM  Task 6: submit shadow 过滤（LineItems 侧）

Day 3    测试 + DUAL 回归 + reviewer 确认
```

**前置依赖**:

| 依赖 | 阻塞 Task | 状态 |
|------|---------|------|
| raw-material-types/{id} 返回 level1PerLevel2 | Task 5 schema + 端到端测 | 待开发（Option 1）或前端双请求（Option 2） |
| reviewer 确认 P1-3 specification 字段来源 | Task 5 sales_order schema | 待确认 |
| reviewer 确认 P1-2 sales 用 boxConversionCoefficient vs level1PerLevel2 | Task 5 sales_order schema | 待确认（见 §8 R3） |
| DUAL 模式测试环境 | Day 3 回归 | 现有环境满足 |

---

## 附录：关键文件索引

| 文件 | 相关行 | C-6 改动 |
|------|--------|---------|
| `web-admin/src/utils/spelEvaluator.ts` | 44-80 | 新增单测，不改源码 |
| `web-admin/src/types/config.ts` | 121-128, 132-142 | Task 0: 扩展 ReferenceConfig + ItemSchemaField |
| `web-admin/src/views/modules/components/ReferenceSelector.vue` | 106-108, 143-187, 71-74 | Task 1: project emit + fetchById shadow 提取 |
| `web-admin/src/views/modules/components/LineItemsEditor.vue` | 79-93, 16-35, 138-144 | Task 2+3: onReferenceProject + evaluateSpelValue |
| `web-admin/src/views/modules/components/SchemaFormRenderer.vue` | 155-165, 343-349, 188-214, 360-365 | Task 4+6: 顶层 project + submit 过滤 |
| `backend/.../engine/DefaultValueResolver.java` | 21-31 | 不改动 |
| `backend/.../engine/SpelConditionEvaluator.java` | 35-73 | 不改动 |
| `backend/.../entity/MaterialPackagingHierarchy.java` | 57-59 | 数据来源确认 |
| `backend/.../dto/material/RawMaterialTypeDTO.java` | 23-64 | Task backend: 加 level1PerLevel2 字段 |
| `backend/.../controller/MaterialPackagingHierarchyController.java` | 45-51 | Option 2 前端直接调用 |
| `backend/.../controller/RawMaterialTypeController.java` | 108-116 | Option 1 扩展此端点 |
| `backend/.../resources/db/migration/V20260409_02__seed_sales_order_bom_schema.sql` | 8-9 | 参照 sales_order field_schema 格式 |
| `backend/.../resources/db/migration/V20260410_08__module_schemas_batch1_core.sql` | 16-23 | 参照 purchase_order itemFields 格式 |
| `web-admin/src/views/sales/orders/list.vue` | 298-313 | LEGACY 参照实现（Phase A `cc031c377` 已加 isAbacaItem + 抄码品 tag） |
| `web-admin/src/views/procurement/orders/list.vue` | 45-58 | LEGACY 参照实现（Phase A `cc031c377` 已加 recalcBoxQuantity + 抄码品 tag） |
