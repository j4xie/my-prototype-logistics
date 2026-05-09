# C-6 Sales Order DYNAMIC Migration — Recommendation & Plan

**版本**: 1.0
**日期**: 2026-05-09
**作者**: ops worktree (organizer dispatch)
**状态**: Draft — Recommendation clear, ship-ready
**相关**:
- 主 spec: `docs/superpowers/specs/2026-05-09-canvas-c6-reactive-default-framework.md` (§5 注 #3 / §8 R3 / §10 前置依赖)
- PR #198 deferred portion (purchase_order shipped, sales_order deferred for data source decision)
- PR #173 I-3 已记录 limitation (F001 SO=DYNAMIC invisible to customer for P1-2 + P1-3)

---

## 1. Background

PR #198 已 ship Canvas C-6 Phase B Task 5 的 purchase_order 部分 (V20260509_01__canvas_c6_purchase_order_reactive_defaults.sql + RawMaterialTypeDTO enrich + RawMaterialTypeServiceImpl.getMaterialTypeById LEFT JOIN material_packaging_hierarchy)。**sales_order DYNAMIC 部分 deferred**, 因 spec §8 R3 留有 open question:

> sales_order 的 P1-2 箱数自动算应该用 `product_types.boxConversionCoefficient` (成品包装) 还是 `material_packaging_hierarchy.level1PerLevel2` (原料包装)? 两者含义不同, 需要 reviewer 二次确认。

客户影响 (per PR #173 I-3):
- F001 sales_order = DYNAMIC mode → 客户在 F001 SO 上 **看不到** P1-2 (箱数自动算) + P1-3 (抄码品识别)
- F002/F003/RES_3101_009 等 sales_order = LEGACY → 看得到 (走 sales/orders/list.vue:298-313 硬编码路径)
- T6.4 cascade 完成后 (Phase 2A 100%), F001 是核心客户工厂 → 优先解锁

---

## 2. Decision: 选 `boxConversionCoefficient`

### 2.1 推荐数据源

**`product_types.box_conversion_coefficient` (BigDecimal, precision=10, scale=4)**

来自 `ProductType` entity (`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ProductType.java:190-192`):

```java
/** 箱规转换系数 (如 10kg/箱 则系数为10) */
@Column(name = "box_conversion_coefficient", precision = 10, scale = 4)
private java.math.BigDecimal boxConversionCoefficient;
```

### 2.2 选 `boxConversionCoefficient` 不选 `level1PerLevel2` 的理由

**Reason 1 (semantic, decisive)**: sales_order 卖**成品** (finished products / SKU)。`product_types` 表存成品定义, `box_conversion_coefficient` 是"成品包装系数"。`material_packaging_hierarchy` 存的是**原料**包装层级, 跟成品销售毫无关系。把原料包装系数用到销售单上, 业务语义错误。

**Reason 2 (LEGACY 一致)**: `web-admin/src/views/sales/orders/list.vue:325-334` 已经有 `calcBox` 函数, 读 `p.boxConversionCoefficient`:

```typescript
function calcBox(item: Record<string, unknown>) {
  if (isAbacaItem(item)) {
    item.boxQuantity = null;
    return;
  }
  const p = products.value.find((x: Record<string, unknown>) => x.id === item.productTypeId);
  if (p?.boxConversionCoefficient && Number(p.boxConversionCoefficient) > 0 && Number(item.quantity) > 0) {
    item.boxQuantity = Math.round((Number(item.quantity) / Number(p.boxConversionCoefficient)) * 100) / 100;
  }
}
```

LEGACY 的 P1-2 是 PR #173 commit `8c6bca8a9` 给客户音频 (veteran_9.txt) 落地的。DYNAMIC 同源同源选同一个数据源, 跨双轨语义一致。

**Reason 3 (V20260409_02 spec)**: sales_order 的顶层 `boxQuantity` 字段 (V20260409_02:9, 当前 prod 在 `field_schema -> fields -> 15`) 标 label "下单箱数", 含义是"卖几箱"。`box_conversion_coefficient` (10kg/箱) 提供 quantity ÷ coefficient → 箱数, 语义 perfect fit.

**Reason 4 (purchase_order 用 level1PerLevel2 不可复用)**: PR #198 的 purchase_order 选 `level1PerLevel2` 是因为采购买原料, 原料包装层级信息在 `material_packaging_hierarchy` 上, 跟 raw_material_type 一对多关系, 是其原始领域。sales_order 用产品 (productTypeId), `material_packaging_hierarchy` 不挂 product_types, **拓扑上无法 reuse**。

### 2.3 abaca (抄码品) 识别

LEGACY `isAbacaItem(item)` (line 321-323) 读 `item.specification`。后端 `ReferenceDataController.findProducts` (line 290-318) + `getProduct` (line 207-226) 已经返 `specification` 字段, 不需要新增字段。DYNAMIC 直接 reuse — 在 schema 加 `_specification` shadow + `visibleWhen` / 行内 tag 即可。

但是: PR #173 LEGACY 实现里 abaca 标签是 inline `<el-input>` 加文字 tag, **DYNAMIC LineItemsEditor 没有 tag 渲染机制**。这部分暂时 **scope-out** 本次 migration, 仅交付 P1-2 (boxQuantity 自动算) DYNAMIC 部分。P1-3 DYNAMIC 适配是独立 frontend feature work (~0.5 day), 留 follow-up issue。

scope 决定:
- ✅ P1-2 DYNAMIC: 选产品 → row._boxConversionCoefficient + row._specification → boxQuantity computed (含 abaca null-guard)
- 🔄 P1-3 abaca tag DYNAMIC 渲染: deferred (LineItemsEditor 加 tag rendering)

P1-2 computed expression 已经做 abaca null-guard:
```
quantity > 0 && _boxConversionCoefficient != null && _boxConversionCoefficient > 0 && (_specification == null || !_specification.includes('抄码')) ? quantity / _boxConversionCoefficient : null
```

抄码品 → boxQuantity 自动 = null (跟 LEGACY `calcBox` 抄码 → null 行为一致)。

---

## 3. Risk Analysis

### R-1: 数据覆盖率极低

通过 prod DB 实测:

```sql
-- product_types.box_conversion_coefficient 覆盖率
SELECT COUNT(*) total, COUNT(box_conversion_coefficient) populated FROM product_types WHERE deleted_at IS NULL;
-- → 260 / 0  (0% populated across ALL factories)
```

```sql
-- 现有 sales_orders.box_quantity (顶层手填) 覆盖率
SELECT factory_id, COUNT(*) sos, COUNT(NULLIF(box_quantity,0)) populated FROM sales_orders ...;
-- → 全部 factory 0% populated
```

**Impact**:
- LEGACY P1-2 已经 silently fail 中 (calcBox 找不到 boxConversionCoefficient → 不写 item.boxQuantity)
- 客户 F001/F002 跑 P1-2 都没真正生效, 只是没 throw
- DYNAMIC migration 不会让事情变差 — 同一个空数据源, 输出 boxQuantity = null
- **本质是数据治理问题**, 不是 migration 阻塞

**Mitigation**:
- Migration ship 后, 文档化建议客户在 system/products/index.vue 维护页面填 boxConversionCoefficient
- F001 14 个产品 + F002 18 个产品 → 几分钟人工填完
- Computed 表达式有 null-guard → 数据空时 boxQuantity 是 null (不显示, 不 NaN)

### R-2: 需要后端 API 改动 (BLOCKING prerequisite)

ProductTypeDTO **不含** `boxConversionCoefficient` (verified `ProductTypeDTO.java:26-156`). `ReferenceDataController.getProduct` (line 207-226) + `findProducts` (line 289-318) 返的 LinkedHashMap **不含** `boxConversionCoefficient`. 必须先加 backend dep, 否则 frontend ReferenceSelector projectFields 拿到 undefined → boxQuantity = null。

**两个 option**:

**Option B (推荐, 影响小)**: 改 `ReferenceDataController` 在 `findProducts` + `getProduct` Map 里加 `boxConversionCoefficient` 字段:

```java
// findProducts (line 305-315)
.map(p -> {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", p.getId());
    m.put("name", p.getName());
    m.put("code", p.getCode());
    m.put("specification", p.getSpecification());
    m.put("unit", p.getUnit());
    m.put("unitPrice", p.getUnitPrice());
    m.put("boxConversionCoefficient", p.getBoxConversionCoefficient());  // ← NEW
    return m;
})

// getProduct (line 215-222)
m.put("boxConversionCoefficient", p.getBoxConversionCoefficient());  // ← NEW
```

非破坏性, schema 不动 apiEndpoint, frontend 无侧路影响。

**Option A (不推荐)**: 给 ProductTypeDTO 加 `boxConversionCoefficient` 字段 + ProductTypeServiceImpl.convertToDTO 写入 + 改 sales_order schema apiEndpoint 从 `/reference-data/products` 改为 `/product-types`. 影响 7 处 convertToDTO 调用站点 + schema 改动 + 重新 review DTO 边界。Option B 同等效果但风险小。

→ **本 migration 走 Option B**.

### R-3: V20260409_02 schema 格式跟 V20260410_08 不一致

V20260409_02 (sales_order) 用 `{"fields":[...]}` + `itemSchema.fields[].code`, V20260410_08 (purchase_order) 用 `[{...}]` + `itemFields[].fieldCode`. V20260509_01 (purchase_order migration) 的 SQL 不能直接 reuse, **必须**写适合 sales_order 格式的新 SQL。

**Mitigation**:
- 本次 migration SQL (V20260510_01) 用 `jsonb_array_elements + jsonb_agg` 重建 `field_schema -> fields[8] -> itemSchema -> fields` (注意 path `fields` 不是 `itemFields`, key `code` 不是 `fieldCode`)
- Pre-flight DO block 验证当前 prod 实际结构匹配
- Post-verify DO block 确认 migration 落地

### R-4: 顶层 boxQuantity vs 行级 boxQuantity 共存

V20260409_02:9 已有顶层 `boxQuantity` (manual 填), 我们要加行级 boxQuantity (自动算)。两者并存 OK:
- 顶层: 用户手动填总箱数 (e.g. "整单 50 箱"), 跟 line items 内独立
- 行级: 每行自动按 quantity ÷ coefficient 算 (e.g. "10kg / 10kg/箱 = 1 箱")

可选优化: 把顶层 boxQuantity 改 computed `SUM(items[].boxQuantity)` 让两者关联。**本次不做** — 出 scope, 留 follow-up 投票:
- 客户要不要"自动汇总" → 决定要不要做
- 改顶层 computed 涉及 SchemaFormRenderer.computedValues 的 SUM 行为 → 需独立 review

### R-5: F001 现有 SO data 不会被破坏

prod F001 sales_orders.box_quantity 全 0 (verified)。Migration 只改 module_schemas (schema 元数据), 不动 sales_orders (业务数据)。Schema 改动是声明式: 现有订单 edit / list 显示的 box_quantity 是 stored value (顶层), 不会因 schema 加行级 boxQuantity 改变。

### R-6: P1-3 abaca DYNAMIC 渲染缺位

LineItemsEditor 没有 tag-style cell render 机制, 所以 DYNAMIC schema 加 abaca 标识只能体现在 boxQuantity = null + 用户手动看 specification 字段。**这跟 PR #173 I-3 描述的 limitation 一致, 不是 regression**。Follow-up frontend work scope:
- LineItemsEditor 支持 `cellRenderer: 'tag'` field type (~ 0.5 day)
- 或者用 abaca 显式 column 显示 ✓/✗ icon

不阻塞本 migration ship。

---

## 4. Implementation Plan

### 4.1 Files to change

```
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ReferenceDataController.java
  → findProducts + getProduct: add boxConversionCoefficient to Map (Option B)

backend/java/cretas-api/src/main/resources/db/flyway/
  V20260510_01__canvas_c6_sales_order_reactive_defaults.sql  (NEW)
  → jsonb_array_elements + jsonb_agg 重建 sales_order items.itemSchema.fields
    - productTypeId.referenceConfig 加 projectFields { boxConversionCoefficient: '_boxConversionCoefficient', specification: '_specification' }
    - itemSchema.fields 追加 boxQuantity computed 字段 (含 abaca null-guard)
```

不动:
- ProductTypeDTO (Option A 拒绝)
- web-admin frontend (Phase B PR #176 + PR #198 已 ship 通用机制)
- 顶层 sales_order.boxQuantity (留手填 semantic 不变)

### 4.2 SQL outline

```sql
-- V20260510_01__canvas_c6_sales_order_reactive_defaults.sql
-- C-6 Canvas Reactive Default: sales_order items 加 reactive defaults
-- 2026-05-09: Phase B Task 5 follow-up (PR #198 deferred portion)
--
-- 不像 purchase_order (V20260509_01 用 [{...}] 数组 + itemFields[fieldCode]),
-- sales_order 是 V20260409_02 格式: {"fields":[...]} + items.itemSchema.fields[code].
-- field_schema -> fields[8] (items, 0-indexed) -> itemSchema -> fields.

-- Pre-flight: verify schema shape
DO $$
DECLARE
  has_items BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM module_schemas, jsonb_array_elements(field_schema->'fields') WITH ORDINALITY AS arr(elem, idx)
    WHERE module_code = 'sales_order'
      AND elem->>'code' = 'items'
  ) INTO has_items;
  IF NOT has_items THEN
    RAISE EXCEPTION 'sales_order schema 缺 items field, V20260409_02 seed 未应用或被改';
  END IF;
END $$;

-- Rebuild items.itemSchema.fields with C-6 enhancements
UPDATE module_schemas
SET field_schema = jsonb_set(
  field_schema,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN field->>'code' = 'items'
        THEN jsonb_set(
          field,
          '{itemSchema,fields}',
          (
            SELECT jsonb_agg(
              CASE
                -- productTypeId: 注入 projectFields
                WHEN itemfield->>'code' = 'productTypeId'
                THEN itemfield || jsonb_build_object(
                  'referenceConfig',
                  COALESCE(itemfield->'referenceConfig', '{}'::jsonb) || jsonb_build_object(
                    'projectFields', jsonb_build_object(
                      'boxConversionCoefficient', '_boxConversionCoefficient',
                      'specification', '_specification'
                    )
                  )
                )
                ELSE itemfield
              END
            )
            FROM jsonb_array_elements(field->'itemSchema'->'fields') AS itemfield
          )
          -- 追加 boxQuantity itemField (含 abaca null-guard)
          || CASE
               WHEN EXISTS (
                 SELECT 1 FROM jsonb_array_elements(field->'itemSchema'->'fields') AS x
                 WHERE x->>'code' = 'boxQuantity'
               )
               THEN '[]'::jsonb
               ELSE jsonb_build_array(jsonb_build_object(
                 'code', 'boxQuantity',
                 'label', '箱数',
                 'type', 'decimal',
                 'required', false,
                 'precision', 2,
                 'computed', 'quantity > 0 && _boxConversionCoefficient != null && _boxConversionCoefficient > 0 && (_specification == null || !_specification.includes(''抄码'')) ? quantity / _boxConversionCoefficient : null',
                 'readonly', true
               ))
             END
        )
        ELSE field
      END
    )
    FROM jsonb_array_elements(field_schema->'fields') AS field
  )
)
WHERE module_code = 'sales_order';

-- Post-verify
DO $$
DECLARE
  has_project_fields BOOLEAN;
  has_box_quantity BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM module_schemas,
         jsonb_array_elements(field_schema->'fields') AS f,
         jsonb_array_elements(f->'itemSchema'->'fields') AS itf
    WHERE module_code = 'sales_order'
      AND f->>'code' = 'items'
      AND itf->>'code' = 'productTypeId'
      AND itf->'referenceConfig'->'projectFields' ? 'boxConversionCoefficient'
  ) INTO has_project_fields;

  SELECT EXISTS (
    SELECT 1
    FROM module_schemas,
         jsonb_array_elements(field_schema->'fields') AS f,
         jsonb_array_elements(f->'itemSchema'->'fields') AS itf
    WHERE module_code = 'sales_order'
      AND f->>'code' = 'items'
      AND itf->>'code' = 'boxQuantity'
      AND itf->>'computed' IS NOT NULL
  ) INTO has_box_quantity;

  IF NOT has_project_fields THEN
    RAISE EXCEPTION 'C-6 sales_order migration verify failed: productTypeId.referenceConfig.projectFields.boxConversionCoefficient not found';
  END IF;
  IF NOT has_box_quantity THEN
    RAISE EXCEPTION 'C-6 sales_order migration verify failed: items.itemSchema.fields[boxQuantity].computed not found';
  END IF;
END $$;
```

### 4.3 Backend dep change

`ReferenceDataController.java` line 215-222 (getProduct) + line 305-315 (findProducts), Map 加:

```java
m.put("boxConversionCoefficient", p.getBoxConversionCoefficient());
```

注意 `BigDecimal` Jackson 输出 number 形式 (`{"boxConversionCoefficient": 10.0000}`); frontend `Number(...)` 兼容。当字段为 null 时 Jackson 默认 emit `"boxConversionCoefficient": null` (Jackson Map 序列化保留 null entries; 跟 LEGACY `p?.boxConversionCoefficient` undefined-check 兼容)。

---

## 5. Test Plan

### 5.1 Backend
- [ ] `mvn -pl backend/java/cretas-api compile` PASS
- [ ] Local Flyway apply V20260510_01 在 dev DB → post-verify DO blocks PASS
- [ ] Test env: deploy backend → curl `/api/mobile/F001/reference-data/products/{id}` 含 `boxConversionCoefficient` 字段 (null when product 没填值)

### 5.2 Frontend (无需改动 — Phase B PR #176 + PR #198 已 ship 通用机制)
- [ ] F001 sales_order create page (DYNAMIC mode) → 选产品 → row._boxConversionCoefficient + row._specification 写入
- [ ] 产品 boxConversionCoefficient = 10, quantity = 50 → boxQuantity 自动 = 5
- [ ] 产品 boxConversionCoefficient = null (绝大多数 prod 数据) → boxQuantity = null (不显示)
- [ ] 产品 specification = '抄码' → boxQuantity = null (abaca null-guard 生效)
- [ ] Submit → payload.items[i] 不含 `_boxConversionCoefficient` / `_specification` (Task 6 filter 已 ship in PR #176)

### 5.3 Schema migration verify
```sql
-- Apply 后 sanity check
SELECT field_schema->'fields'->8->'itemSchema'->'fields' FROM module_schemas WHERE module_code='sales_order';
-- 应看到 productTypeId.referenceConfig.projectFields, 末尾追加 boxQuantity
```

### 5.4 Cross-mode regression
- [ ] F002/F003 (LEGACY) sales_order: P1-2 行为不受影响 (LEGACY 走 sales/orders/list.vue, 不读 module_schemas)
- [ ] F001 sales_order edit (DYNAMIC, existing 订单): box_quantity 顶层字段仍可见 + manual 编辑 (顶层 schema 没改)

---

## 6. Rollback Plan

如果 V20260510_01 部署后发现问题:

```sql
-- Restore sales_order schema (V20260409_02 + V20260410_* 累积状态)
-- 直接 inverse migration:
UPDATE module_schemas
SET field_schema = jsonb_set(
  field_schema,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN field->>'code' = 'items'
        THEN jsonb_set(
          field,
          '{itemSchema,fields}',
          (
            SELECT jsonb_agg(
              CASE
                WHEN itemfield->>'code' = 'productTypeId'
                THEN itemfield || jsonb_build_object(
                  'referenceConfig',
                  (itemfield->'referenceConfig') - 'projectFields'
                )
                ELSE itemfield
              END
            )
            FROM jsonb_array_elements(field->'itemSchema'->'fields') AS itemfield
            WHERE itemfield->>'code' != 'boxQuantity'  -- 移除追加的 boxQuantity
          )
        )
        ELSE field
      END
    )
    FROM jsonb_array_elements(field_schema->'fields') AS field
  )
)
WHERE module_code = 'sales_order';
```

Rollback 是 idempotent SQL, 不需要 backup.

Backend `ReferenceDataController.java` 改动是 nullable Map entry, 可独立回滚 (revert commit + redeploy)。

---

## 7. Open Questions

无 BLOCKING 问题。Recommendation 清晰, 可 ship。

下面是 follow-up scope 的小 question, 不阻塞本 PR:

1. **顶层 boxQuantity 是否改 computed `SUM(items[].boxQuantity)`?** — 投票题, scope 之外
2. **P1-3 abaca tag rendering 何时上 DYNAMIC?** — 独立 feature work, ~0.5 day, 等 LineItemsEditor 加 cellRenderer 后做
3. **数据治理**: 是否给客户提示在 system/products 维护页面填 boxConversionCoefficient? — 文档/培训问题, 不是技术问题

---

## 8. Customer Impact

PR ship + backend deploy 之后:
- F001 sales_order DYNAMIC mode 用户 (e.g. 客户 SmartBI 演示账号) 创建/编辑 SO 时:
  - 选产品 → row._boxConversionCoefficient + row._specification 自动写入
  - quantity 输入 → boxQuantity 自动算 (前提: 产品填了 boxConversionCoefficient)
  - 抄码品 → boxQuantity 自动 null (LEGACY 一致)
- LEGACY (F002/F003/RES_3101_009) 行为完全不变
- F001 用户需要先在 system/products 给 14 个 SKU 各填 boxConversionCoefficient (否则 boxQuantity 一直 null) — 这是数据治理的活儿, 不是 bug

---

## 9. Phase 2A T6.4 alignment

T6.4 cascade 完成后 (2026-05-09 06:34 CST), 75/75 factories on Python SmartBI。本 migration 不影响 Phase 2A — 它只动 Java 侧 module_schemas。Python SmartBI 不读 module_schemas, 走自己 sales_data。

但本 migration 会让 F001 `customer touch surface 增厚` (P1-2 在 SO 上可见), 可视为 Phase 2A close 后的 customer-experience polish。

---

## 10. Successor / Follow-up Issues

1. **P1-3 abaca tag rendering DYNAMIC**: LineItemsEditor 加 `cellRenderer: 'tag'` 字段类型, 让 schema 配
   `{ code: '_specification', cellRenderer: { type: 'tag', condition: '_specification.includes(\\'抄码\\')', label: '抄码品' } }`
   预估 0.5 day frontend work。

2. **顶层 boxQuantity = SUM(items[].boxQuantity)**: 待客户决定语义后做, ~0.25 day。

3. **数据治理**: 客户培训 / wiki 文档 / 自动 reminder, 让客户填 boxConversionCoefficient. 非技术任务。

4. **Frontend product creation form 加 boxConversionCoefficient input**: `web-admin/src/views/system/products/index.vue` 已有此字段 (line 26, 69), 但 list.vue 没显示 — 用户难发现。考虑加到 list 列 / 创建表单显眼位置。
