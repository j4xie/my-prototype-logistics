# Sub-1 设计：销售订单 + 客户管理 表单修复 + Canvas UI 强化 + 客户模块 DYNAMIC 迁移

**Date**: 2026-04-23
**Author**: Steve + Claude (brainstorming, audited by superpowers:code-reviewer)
**Status**: Ready for plan
**Scope**: docx P1/P2 客户需求 5 项 (sales order 3 + customer 2) + Canvas 引擎扩展 + Canvas UI 编辑能力强化 + customer 模块 DYNAMIC 化
**Branch**: `e2e/v1-framework`
**Total estimate**: 8-10 person-days, 3 PRs
**Deploy gate**: test-first per `.claude/rules/server-operations.md`

---

## 1. Problem statement

Apr 22 张权 docx 反馈 5 项 web-admin bug + 3 个深层架构 gap (audit 揭示)：

### 1.1 客户需求 (docx)
| # | 模块 | 需求 |
|---|---|---|
| P1.1 | 销售订单 | 合同号字段 disabled + 占位"保存后自动生成"（后端已自动生成，纯 UI 修） |
| P1.2 | 销售订单 | 业务员字段从手填改为员工下拉 (与人事模块互联) |
| P1.3 | 销售订单 | 订单明细产品列实现模糊搜索下拉 (当前显示"无数据") |
| P2.1 | 客户管理 | 联系人/联系电话/收货地址 三字段去必填 (有些客户没指定联系人) |
| P2.2 | 客户管理 | 状态字段需可在编辑表单中切换 (当前表单缺该字段) |

### 1.2 Audit 揭示的架构 gap (`superpowers:code-reviewer` 审计 2026-04-23)
| # | 问题 | 位置 |
|---|---|---|
| C1 | `FactoryConfigServiceImpl.buildEffectiveFields` whitelist 12 keys 没有 `autoGenerate`，schema 标志被剥离不到前端 | `backend/.../FactoryConfigServiceImpl.java:1122-1134` |
| C2 | DYNAMIC 引擎 schema.code 1:1 映射 entity field，schema rename 会破坏后端 Jackson | `backend/.../SalesServiceImpl.java:137`，`CreateSalesOrderRequest.java:35` |
| C3 | `/users/search` 端点 `@NotBlank` 拒绝空 keyword + 无 role filter | `backend/.../UserController.java:241-250` |
| C4 | `/product-types/active` 不支持 keyword/page/size 参数；改用 `/product-types/search` | `backend/.../ProductTypeController.java:183-188` |
| H1 🚨 | Canvas FieldConfigPanel.saveChanges() **从未真正写入 DB**，只 ElMessage.success — 整个 Canvas UI 是个未通电的壳 | `web-admin/.../FieldConfigPanel.vue:96-99` |
| H2 | 递归 FieldPropertyDrawer 嵌套保存的 dirty bubble 路径未定义 | 设计层 |
| H3 | DynamicModulePage 缺 customers/list.vue 已有的搜索/扩展字段卡片/状态徽章/dialog 模式 | `web-admin/.../DynamicModulePage.vue` vs `customers/list.vue` |
| H4 | 测试环境 10011 当前停（cretas-test.log 显示 SpringApplicationShutdownHook） | 运维 |
| M1 | salesperson 双字段反范式 name 应取快照还是 live JOIN 未明确 | 设计 |
| M2 | Phase C 上前 A 必须把 customer 也加入 module_schemas，避免规则空窗 | 时序 |
| M3 | autoGenerate 字段在 edit mode 是否仍 disabled 未明确 | 设计 |
| M4 | autoGenerate 字段在 list/table 列显示是否被错误隐藏 | 验证项 |

---

## 2. Goals & Non-goals

### Goals
- 修复 docx 5 项客户需求
- 修复 audit 揭示的所有 critical + high gap (C1-C4 + H1-H4)
- 让 Canvas UI 能完整编辑：autoGenerate / referenceConfig / 子表字段
- customer 模块从静态 Vue form 迁移到 DYNAMIC 引擎
- 保留 LEGACY 回滚能力 (CanvasAwareWrapper 切 mode 即可)

### Non-goals
- RN App `FAManagementScreen` 加仓库管理入口（独立 ticket，下一轮 brainstorm）
- web-admin 5 个新建仓库子页（入库/出库/库位/温控/预警 — 独立 Sub-2，3-5 天）
- 后端 RBAC 加固 inventory/warehouse/sales controller（独立安全 ticket）
- DYNAMIC 化其他模块 (purchase_order / production_plan 等 — 客户没要求)

---

## 3. Architecture overview

### 3.1 当前状态 (流向图)
```
sales_order (DYNAMIC mode):
  module_schemas.field_schema [23 fields, has orderNumber.autoGenerate:true]
    → FactoryConfigServiceImpl.buildEffectiveFields [whitelist 12 keys, DROPS autoGenerate] ← C1
    → EffectiveField [extra missing autoGenerate]
    → SchemaFormRenderer [isReadonly() ignores autoGenerate] ← A.2 fix
    → 渲染：required input, 用户能填，保存时后端覆盖 → confusing UX

customer (LEGACY mode):
  customers/list.vue static form [hardcoded formRules with required] ← A.7 fix
    → API /api/mobile/{factoryId}/customers
    → Customer entity [fields nullable already]

Canvas Editor:
  FieldConfigPanel.editField → FieldPropertyDrawer [partial UI]
  FieldConfigPanel.saveChanges → ElMessage.success ← H1, **DOES NOT WRITE DB**
```

### 3.2 目标状态
```
sales_order (DYNAMIC):
  module_schemas with proper schema (salesperson reference, items.productTypeId apiEndpoint)
    → buildEffectiveFields [whitelist + autoGenerate + ref children] ← A.1 fix
    → EffectiveField [full extra]
    → SchemaFormRenderer [honor autoGenerate, render disabled+placeholder] ← A.2 fix
    → ReferenceSelector [skip empty initial fetch] ← A.8 fix
    → 渲染：合同号灰色不填; 业务员员工下拉; 产品远程搜索

customer (DYNAMIC):
  module_schemas seed + factory_module_configs F001/F006 rendering_mode=DYNAMIC ← C.1, C.2
  customers/list.vue → <CanvasAwareWrapper module-code="customer"> ← C.3
    → DynamicModulePage with search/extended/status/dialog parity ← C.0
    → 静态 form 作 LEGACY fallback (slot)

Canvas Editor:
  FieldConfigPanel.saveChanges → PUT /config/modules/{moduleCode} (REAL persistence) ← B.0
  FieldPropertyDrawer extends:
    autoGenerate toggle ← B.1
    referenceConfig editor ← B.2
    Sub-table recursive editor with explicit dirty bubble ← B.3
  AIChatPanel prompt enhancement ← B.4
```

---

## 4. Phase A — 基础修复 (3-4 days, PR1)

### A.0 前置：重启 test 10011
```bash
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart.sh test"
# 等 90s, 验证 ss -tln | grep 10011
```

### A.1 后端 whitelist 扩展
**文件**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java:1122-1134`

当前 whitelist 12 keys: `(待 plan 阶段精确读取列表)`. 新增：
- `autoGenerate` (Phase A 必需)
- referenceConfig 已是 whitelist key（schema 顶层），其 children 透传 — **无需额外改**
- searchFields 在 referenceConfig 内部，自动透传

**单元测试**: `FactoryConfigServiceImplTest.buildEffectiveFields_includesAutoGenerate`

### A.2 渲染器扩展
**文件**: `web-admin/src/views/modules/components/SchemaFormRenderer.vue:92-94`

```ts
function isReadonly(field: EffectiveField): boolean {
  if (props.mode === 'view') return true
  if (field.readonly || field.extra?.computed) return true
  // M3 决策：autoGenerate 字段在 create + edit 模式都禁改 (快照语义, 配 M1)
  if (field.extra?.autoGenerate && props.mode !== 'view') return true
  return false
}
```

Template `:placeholder` 加：
```html
:placeholder="field.extra?.autoGenerate && mode === 'create' ? '保存后自动生成' : (field.placeholder || '请输入')"
```

### A.3 module_schemas SQL UPDATE — sales_order
**操作**: 单次 SQL，修改 `module_schemas.field_schema` JSONB

**变更点 3 处**:
1. `orderNumber`: 移除 `required:true`（与 autoGenerate 矛盾，前端校验失效）— 保留 `autoGenerate:true` ✓
2. `salesperson`: **保留 code 不改** (per audit C2 fix b)；type `string`→`reference`；新加：
   ```json
   "referenceConfig": {
     "entity": "user",
     "valueField": "id",
     "displayField": "fullName",
     "apiEndpoint": "/api/mobile/{factoryId}/users/search",
     "searchFields": ["fullName", "username"]
   }
   ```
3. `items.itemSchema.fields[productTypeId].referenceConfig`: 加 `apiEndpoint: "/api/mobile/{factoryId}/product-types/search"`

**风险点**: 此修改影响**所有工厂**（canonical schema），不只 F001/F006。需 grep 现有 F001 sales_order 数据看是否有依赖手填业务员的旧记录（A.4 处理）。

### A.4 后端 Service 双值识别
**文件**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java`

`create()` + `update()` 收到 salesperson 字段时：
```java
String spInput = request.getSalesperson();
if (spInput != null && spInput.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")) {
  // UUID 格式 → lookup user
  User user = userRepository.findByIdAndFactoryId(spInput, factoryId)
    .orElseThrow(() -> new ResourceNotFoundException("业务员不存在"));
  order.setSalespersonId(spInput);
  order.setSalesperson(user.getFullName());  // 快照 (M1)
} else if (spInput != null) {
  // 普通字符串 → 老路径
  order.setSalesperson(spInput);
  order.setSalespersonId(null);
}
```

**DTO 不动** (`CreateSalesOrderRequest.salesperson` 仍是 String) — 服务端区分 UUID vs 普通字符串。

### A.5 DB 双字段迁移
**Flyway migration**: `backend/java/cretas-api/src/main/resources/db/migration/V2026_04_23_001__add_sales_order_salesperson_id.sql`

```sql
ALTER TABLE sales_orders
ADD COLUMN salesperson_id VARCHAR(191) NULL;
CREATE INDEX idx_so_salesperson_id ON sales_orders(salesperson_id) WHERE salesperson_id IS NOT NULL;
-- 不加 FK constraint 避免 cross-factory user_id 引用问题；service 层校验
```

**Entity**: `SalesOrder.java:117-118` 后加：
```java
/** 业务员 user_id (新数据) */
@Column(name = "salesperson_id", length = 191)
private String salespersonId;
```

**M1 决策**: salesperson 字段作快照（snapshot at save time），不随 user.fullName 改变。
- 优点：审计 / 法务 / 历史记录不被改写
- 缺点：员工改名后老订单仍显示旧名（可接受）
- 文档化在订单详情 tooltip "业务员名称为下单时记录的快照"

### A.6 后端端点修复
**文件 1**: `UserController.java:241-250`
```java
@GetMapping("/search")
public ApiResponse<List<UserSearchDto>> searchUsers(
    @PathVariable String factoryId,
    @RequestParam(required = false) String keyword,  // 移除 @NotBlank
    @RequestParam(required = false) String role,    // 新加 role 过滤
    @RequestParam(defaultValue = "50") int size
) { /* ... */ }
```

**文件 2**: `ProductTypeController.java:208`
- `/product-types/search?keyword=` 已有，schema 直接用，无需改后端

### A.7 Vue 静态 form 修复 — customers/list.vue
**改动 1** — 移除三字段 required (`L103-110`):
```ts
const formRules = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
  phone: [
    { pattern: /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/, message: '请输入正确的手机号或座机号', trigger: 'blur' },
  ],  // 保留格式校验，移除 required
};
```

**改动 2** — 加 status 字段 (`L90-100, L288 form, L164 payload`):
```ts
const defaultForm = { ..., status: 'ACTIVE' };  // 新增

// form template 加：
<el-form-item label="状态" prop="status">
  <el-select v-model="formData.status" :disabled="isViewMode" style="width:100%">
    <el-option label="合作中" value="ACTIVE" />
    <el-option label="已停用" value="INACTIVE" />
  </el-select>
</el-form-item>

// handleSubmit payload 加 status: formData.status
```

**改动 3** — handleEdit / handleView 也读 status：
```ts
status: row.status || 'ACTIVE',
```

### A.8 前端引擎调优
**文件 1** - `ReferenceSelector.vue:78-82` 跳过空初始 fetch：
```ts
onMounted(() => {
  // C3 fix: 不发起 search('') 避免 backend @NotBlank 拒绝；用户输入时再触发
  // search('')  // 删除
})
```
（如果用户体验需要预加载，加 `props.config.preload = true` 显式开启）

**文件 2** - `SchemaTableRenderer` (M4 验证)：autoGenerate 字段在 list/table 列**正常显示**（已写入数据，不应隐藏）。读 `field.listVisible !== false` 即可，autoGenerate 不影响 list 显示。

---

## 5. Phase B — Canvas UI 持久化 + 扩展 (3 days, PR2)

### B.0 持久化通路 🚨 [BLOCKER for B.1-B.4]
**文件**: `web-admin/src/views/platform/canvas-editor/components/FieldConfigPanel.vue:91-99`

当前: `saveChanges()` 只 ElMessage.success — 整个 Canvas UI 没接入 DB。

实现：
```ts
async function saveChanges() {
  if (!moduleCode.value || !factoryId.value) return
  if (dirtyFields.value.size === 0) {
    ElMessage.info('无待保存改动')
    return
  }
  saving.value = true
  try {
    // 构建 fieldConfig override：仅推送 dirty fields
    const fieldConfig = {} as Record<string, unknown>
    for (const code of dirtyFields.value) {
      const f = fields.value.find(x => x.code === code)
      if (f) fieldConfig[code] = serializeFieldOverride(f)  // 提取需 override 的属性
    }
    const res = await put(
      `/${factoryId.value}/config/modules/${moduleCode.value}`,
      { fieldConfig }
    )
    if (res.success) {
      ElMessage.success('保存成功')
      dirtyFields.value.clear()
      // 重新加载 effective config
      await reloadConfig()
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e: any) {
    ElMessage.error(`保存失败: ${e?.message || e}`)
  } finally {
    saving.value = false
  }
}
```

**端点验证**: `ConfigController.java:152` `PUT /api/mobile/{factoryId}/config/modules/{moduleCode}` 已存在（plan 阶段验证 payload 格式）。

### B.1 autoGenerate toggle
**文件**: `FieldPropertyDrawer.vue` 加块：
```html
<el-form-item v-if="form.type === 'string'" label="保存时自动生成">
  <el-switch v-model="form.autoGenerate" />
  <div class="hint">开启后此字段在创建表单中显示为只读占位"保存后自动生成"</div>
</el-form-item>
```
绑定到 `field.extra.autoGenerate`。

### B.2 referenceConfig 编辑器
**文件**: `FieldPropertyDrawer.vue` 加块（仅 `type === 'reference'` 显示）：
```html
<template v-if="form.type === 'reference'">
  <el-divider>引用配置</el-divider>
  <el-form-item label="实体">
    <el-input v-model="form.referenceConfig.entity" placeholder="如 user / customer / product" />
  </el-form-item>
  <el-form-item label="API 路径">
    <el-input v-model="form.referenceConfig.apiEndpoint" placeholder="如 /api/mobile/{factoryId}/users/search" />
  </el-form-item>
  <el-form-item label="显示字段">
    <el-input v-model="form.referenceConfig.displayField" placeholder="如 fullName / name" />
  </el-form-item>
  <el-form-item label="值字段">
    <el-input v-model="form.referenceConfig.valueField" placeholder="如 id" />
  </el-form-item>
  <el-form-item label="搜索字段">
    <el-select v-model="form.referenceConfig.searchFields" multiple filterable allow-create>
      <el-option label="fullName" value="fullName" />
      ...
    </el-select>
  </el-form-item>
</template>
```

### B.3 子表递归编辑器
**文件**: `FieldPropertyDrawer.vue` 加块（仅 `type === 'line_items'` 显示）：
```html
<el-form-item v-if="form.type === 'line_items'" label="子表字段">
  <el-button type="primary" plain @click="openSubTableEditor">编辑子表字段</el-button>
  <div class="hint">{{ form.itemSchema?.fields?.length || 0 }} 个子字段</div>
</el-form-item>
```

`openSubTableEditor()` 弹 dialog 列出 itemSchema.fields，每行有"编辑"按钮 → 打开**新的** FieldPropertyDrawer (递归)。

**Dirty bubble 路径** (H2 fix)：
```
子 FieldPropertyDrawer save:
  1. 读子 form 状态
  2. 找父字段：parentField.extra.itemSchema.fields[idx]
  3. 写回：parentField.extra.itemSchema.fields[idx] = serializedSubField (immutable update)
  4. 关闭子 drawer
父 dialog onSave:
  1. 写回 parentField 完整状态
  2. emit('field-changed', parentField.code)  → FieldConfigPanel 加入 dirtyFields
顶层 saveChanges (B.0)：
  正常发请求，parent field 包含完整 itemSchema
```

**风险**: Vue 嵌套 dialog z-index / 状态隔离 — plan 阶段 spike。

### B.4 AIChatPanel prompt 增强
**文件**: `AIChatPanel.vue`

Prompt 加示例，让 AI 能从自然语言生成正确 schema JSON。
（详细 prompt 在 plan 阶段编写，需结合 LLM provider）

---

## 6. Phase C — Customer DYNAMIC 迁移 (2-3 days, PR3)

### C.0 DynamicModulePage 功能对齐 🚨 [BLOCKER for C.3]
**文件**: `web-admin/src/views/modules/DynamicModulePage.vue`

需补功能（参照 customers/list.vue）：
- **搜索框** slot 或固定渲染（top of list view），keyword 传给 GET 请求 params
- **扩展字段卡片** — 复用 `DynamicEntityForm` 组件渲染分组
- **状态徽章** — list 列渲染时按 field.type=select 自动 el-tag
- **dialog 模式区分** — view/edit/add 三种 mode 透传到 SchemaFormRenderer

### C.1 customer module_schemas seed
**Flyway**: `V2026_04_23_002__seed_customer_module_schema.sql`
```sql
INSERT INTO module_schemas (module_code, module_name, module_category, field_schema, default_config, is_active)
VALUES (
  'customer',
  '客户管理',
  'crm',
  '{ "fields": [...] }'::jsonb,  -- 复用 customers/list.vue 当前字段
  '{}'::jsonb,
  true
);
```

字段定义复用 `customers/list.vue` 的 `defaultForm` (P2.1 + P2.2 已生效)：
- name (required:true)
- contactPerson (required:false)
- phone (required:false, pattern 校验)
- shippingAddress (required:false)
- email
- type / industry
- status (type:select, options: ACTIVE/INACTIVE)
- 扩展字段 (creditLimit / bankInfo / 等等 — group:extended)

### C.2 factory_module_configs DYNAMIC 化
```sql
INSERT INTO factory_module_configs (factory_id, module_code, config_version, enabled, rendering_mode, ...)
VALUES
  ('F001', 'customer', 1, true, 'DYNAMIC', ...),
  ('F006', 'customer', 1, true, 'DYNAMIC', ...);
```

### C.3 替换 Vue 入口
**文件**: `customers/list.vue`

```vue
<template>
  <CanvasAwareWrapper module-code="customer">
    <!-- 原静态 form 作 LEGACY fallback -->
    <div class="customer-list">
      ...原内容...
    </div>
  </CanvasAwareWrapper>
</template>
```

CanvasAwareWrapper 会按 rendering_mode 决定：DYNAMIC → 渲染 DynamicModulePage；LEGACY → 渲染 slot (静态)。

### C.4 LEGACY fallback 验证
- 临时 SQL: `UPDATE factory_module_configs SET rendering_mode='LEGACY' WHERE factory_id='F001' AND module_code='customer'`
- 刷新页面 → 应回到原静态 form
- 反向：UPDATE 改回 'DYNAMIC' → DynamicModulePage 接管

### C.5 Customer 端点参数对齐
DynamicModulePage 调 `GET /{factoryId}/customers?keyword=&page=&size=` — 验证 backend `CustomerController` 接受 keyword 参数。如不支持需补。

---

## 7. Testing strategy

### 7.1 Unit / Integration tests

| Phase | Test |
|---|---|
| A.1 | `FactoryConfigServiceImplTest`: `buildEffectiveFields` 输入含 autoGenerate 的 schema → `EffectiveField.extra.autoGenerate === true` |
| A.2 | `SchemaFormRenderer.spec.ts`: render with autoGenerate field in 'create' mode → `disabled === true`, no required validation triggered |
| A.4 | `SalesServiceImplTest.create_withSalespersonUuid`: salesperson="<uuid>" → user lookup → both salesperson_id + salesperson(name) written |
| A.4 | `SalesServiceImplTest.create_withSalespersonString`: salesperson="张三" → only salesperson written, salesperson_id=null |
| A.6 | `UserControllerTest.searchUsers_emptyKeyword`: empty keyword → 200 with paginated all users |
| A.6 | `UserControllerTest.searchUsers_withRole`: role=salesperson → only filtered |
| A.7 | `customers/list.vue` test: submit with empty contactPerson → 200 success, no validation error; status field in payload |
| B.0 | `FieldConfigPanelTest.saveChanges`: dirty fields → PUT request with correct payload; success message; dirtyFields cleared |
| B.3 | `FieldPropertyDrawerTest.subTableSave`: edit nested field → parent dirty marked, top-level save includes itemSchema |
| C.0 | `DynamicModulePageTest`: render with module having search/extended/status — all visible |

### 7.2 E2E acceptance (手工)

| Phase | 验证步骤 |
|---|---|
| A | 用 `f006_admin / 123456` 在 web-admin test 创建 SO：合同号灰色不填、placeholder 显示；业务员下拉显示 F006 销售员；产品列输入"猪肉"远程搜索返回结果；保存后回看 orderNumber=`SO-yyyyMMdd-NNNN` 自动生成 |
| A | 编辑 F001 老 SO（业务员是"张三"字符串）：业务员字段显示"张三"原文 readonly fallback |
| A | 客户管理新增："联系人/电话/收货地址" 都不填可提交成功；状态下拉切到"已停用"保存后列表显示 |
| B | 用 `factory_super_admin` 进 Canvas Editor → 销售订单 → 业务员字段 → 改 type=reference → 设 apiEndpoint → 保存 → 重新打开抽屉确认配置回显；DB 中 factory_module_configs.field_config 含此 override |
| B | 编辑 sales_order items 字段 → 点"编辑子表字段" → 弹 dialog → 编辑 productTypeId → 改 displayField → 保存 → 关闭 → 顶层保存 → DB 中 itemSchema.fields[productTypeId].displayField 更新 |
| C | F001/F006 客户列表通过 DynamicModulePage 渲染：搜索关键字"上海"过滤；扩展字段卡片可见；状态徽章正常；编辑 dialog 全字段 |
| C | 临时 UPDATE rendering_mode=LEGACY → 客户页回到静态 form（验证 fallback） |

### 7.3 Regression checks
- 其他 DYNAMIC 模块（purchase_order / production_plan）schema 不动，验证 form 渲染无回归
- F002 / R001 / RES_3101_* 等 RESTAURANT 工厂 sales_order 操作正常（受 schema 改动 canonical 影响）
- 老 SO 详情页面显示业务员"张三"字符串 readonly，不报错
- ReferenceSelector 在其他已用 reference 字段（如 customerId）功能正常（A.8 跳空 fetch 后）

---

## 8. Deployment plan

| PR | Phase | Test deploy | Customer verify | Prod deploy |
|---|---|---|---|---|
| **PR1** | A (3-4d) | 完成后立即部 test 10011 + 8084 | 客户跑 E2E §7.2 A 块 1-2 天 | 客户 ack 后部 prod blue→green |
| **PR2** | B (3d) | 部 test 10011 | **内部 dev** 用 Canvas Editor 配 1 个新字段验证（无客户介入） | 内部 verify 后部 prod |
| **PR3** | C (2-3d) | 部 test 10011 | 客户深度验证 customer 列表/编辑/搜索/扩展字段 / 兼容老数据 | 客户 ack 后部 prod，**保留 LEGACY 紧急回滚 SQL** |

**回滚方案**:
- PR1: PR revert + Flyway down 脚本（DROP COLUMN salesperson_id）+ schema_version 标 invalid (实际很难真正回滚，需小心)
- PR2: PR revert（纯前端，无 DB / API 改动），整个 PR 回滚不影响数据
- PR3: SQL `UPDATE factory_module_configs SET rendering_mode='LEGACY' WHERE module_code='customer'` → 立即回到静态 form

---

## 9. Open questions (resolved during brainstorming)

- ~~Canvas 能否实现这些需求？~~ → Phase 1 引擎可（A.1+A.2），Phase 2 UI 可（B.0-B.3），客户模块 Phase 3 可（C.0-C.3）
- ~~salesperson 旧数据迁移~~ → 选项 3：双字段过渡，新订单写 salesperson_id + 快照 name，老订单原文显示
- ~~子表编辑器实现~~ → 选项 A：递归 FieldPropertyDrawer 图形化（vs Monaco JSON）
- ~~scope~~ → α：A+B+C 全做
- ~~salesperson name 快照 vs live~~ → 快照 (M1 决策, 审计友好)
- ~~autoGenerate edit mode~~ → 也 disabled (M3 决策, 同 M1 快照语义)

---

## 10. References

- 客户原始反馈：`系统修改意见.docx` + WeChat 截图
- 上游 spec: `docs/superpowers/specs/2026-04-22-warehouse-menu-permission-diagnosis-design.md`
- Audit: 本会话 `superpowers:code-reviewer` 输出
- 关键代码：
  - `web-admin/src/views/modules/components/SchemaFormRenderer.vue:92-94`
  - `web-admin/src/views/modules/components/ReferenceSelector.vue:48-82`
  - `web-admin/src/views/modules/DynamicModulePage.vue`
  - `web-admin/src/views/platform/canvas-editor/components/FieldConfigPanel.vue:96-99` 🚨
  - `web-admin/src/views/platform/canvas-editor/components/FieldPropertyDrawer.vue`
  - `web-admin/src/views/sales/customers/list.vue:103-110, 90-100, 288, 164`
  - `backend/.../FactoryConfigServiceImpl.java:1122-1134` 🚨
  - `backend/.../SalesServiceImpl.java:126-145`
  - `backend/.../SalesOrder.java:117-118`
  - `backend/.../UserController.java:241-250`
  - `backend/.../ProductTypeController.java:208`
- 部署规则: `.claude/rules/server-operations.md`

---

## 11. Acceptance criteria

- [ ] PR1 ship to prod, 客户 ack docx 5 项全部修复
- [ ] PR2 ship to prod, 内部 dev 在 Canvas Editor 中能完成"业务员从 string 改为 reference"操作并持久化
- [ ] PR3 ship to prod, customer 模块 DYNAMIC 渲染，客户验证无功能丢失
- [ ] 所有 unit + integration test pass
- [ ] regression: 其他 DYNAMIC 模块 + 餐饮工厂 + 老 SO 详情 全部无回归
- [ ] LEGACY fallback 验证: SQL 切回 → 静态 form 恢复
- [ ] 文档: spec final § 10.6 lessons + 部署 runbook

---

## 12. Risks & mitigations

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| schema canonical 修改影响所有工厂 | High | 餐饮工厂订单页可能受影响 | A.3 改完先 test 部署，跑 F006 + F002 + R001 三类工厂 sales_order regression |
| Canvas 嵌套 drawer Vue 状态混乱 | Medium | B.3 子表编辑保存出错 | plan 阶段 spike 1h 验证可行性，写 unit test 覆盖 dirty bubble |
| DynamicModulePage 功能对齐做不完 | Medium | C.0 持续返工 | C.0 单独子 PR (PR3a)，对齐 review 通过再做 C.1-C.3 |
| Flyway migration 部署失败 | Low | 后端启动失败 | A.5 migration 单独验证 syntax，down 脚本就绪 |
| 老 SO 业务员显示异常 | Low | UX 退化 | A.4 + ReferenceSelector fallback 逻辑加 unit test |
