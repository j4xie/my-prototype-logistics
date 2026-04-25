# Canvas reference field apiEndpoint backlog

**生成日期**: 2026-04-25
**起因**: depth-first-e2e Rule 8 same-cause sweep, after fixing `sales_order.salesperson/customerId/items.productTypeId`
**Sweep query**:
```sql
WITH all_refs AS (
  SELECT module_code, f->>'code' AS field_code, f->'referenceConfig'->>'apiEndpoint' AS endpoint
  FROM module_schemas, jsonb_array_elements(field_schema->'fields') f
  WHERE f->>'type' = 'reference'
  UNION ALL
  SELECT module_code, f->>'fieldCode' AS field_code, f->'referenceConfig'->>'apiEndpoint' AS endpoint
  FROM module_schemas, jsonb_array_elements(field_schema) f
  WHERE jsonb_typeof(field_schema) = 'array' AND f->>'type' = 'reference'
  UNION ALL
  SELECT module_code, (f->>'code')||'.'||(itm->>'code'), itm->'referenceConfig'->>'apiEndpoint'
  FROM module_schemas,
       jsonb_array_elements(field_schema->'fields') f,
       jsonb_array_elements(f->'itemSchema'->'fields') itm
  WHERE itm->>'type' = 'reference'
)
SELECT * FROM all_refs WHERE endpoint IS NULL OR endpoint = '';
```

## Vulnerable matrix

### Tier 1 — Active vulnerable in DYNAMIC mode (immediate ship)

无 — 已修 (commits `026527d5a` + `9b05b470b`).

### Tier 2 — Time-bomb: hidden field in DYNAMIC, ships when admin configures visible

| module | field | endpoint | failure mode | status |
|--------|-------|----------|--------------|--------|
| sales_order | quoteId | ~~`/operational-quotes` (claimed "404 no controller")~~ → **FIXED V20260425_04**: re-pointed to `/quotes` (`OperationalQuoteController` exists, verified HTTP 200 + GET-by-id). Server-side keyword search not yet implemented (next round). | RESOLVED Apr 25 R3 |

**R3 audit correction (Apr 25)**: original Tier 2 entry mis-classified this as "no controller, requires 3-day build". Reality: controller exists at `/api/mobile/{factoryId}/quotes` since `OperationalQuoteController.java`. Fix was a 5-min schema-path UPDATE migration (V20260425_04).

### Tier 3 — Time-bomb: top-level-array shape, all LEGACY mode

```
finance_ap.purchaseOrderId
finance_ap.supplierId
finance_ar.customerId
finance_ar.salesOrderId
inbound.materialTypeId
inbound.purchaseOrderId
inventory.materialTypeId
outbound.productTypeId
outbound.salesOrderId
production_plan.productTypeId
production_plan.sourceOrderId
production_report.batchId
production_report.workerId
purchase_order.supplierId
quality_inspection.batchId
quality_inspection.inspectorId
traceability.productBatchId
```

**Failure mode**: 当任何工厂的任何上述模块 flip 为 DYNAMIC mode (`factory_module_configs.rendering_mode='DYNAMIC'`), `SchemaFormRenderer` 立刻渲染 `el-input` 而非 `ReferenceSelector` (因为 PO/customer 等 schema 是 top-level array 形式, `field_schema.getOrDefault("fields", List.of())` 返回空 list, **整个表单为空**)。

**Action**:
- **Step A** (defensive, 1 day): 加 Java 适配层 — `buildEffectiveFields` 检查 `jsonb_typeof(field_schema)`, 如是 array 则直接当作 `field_schema.fields` 用. 这样 PO/customer 也能 DYNAMIC 渲染.
- **Step B** (1 day per module): 对每个 flip-to-DYNAMIC 候选模块, 写 migration 给所有 reference 字段补 `apiEndpoint`, 指向 `/api/mobile/{factoryId}/reference-data/{entity}` (复用 `ReferenceDataController`, 必要时扩展新 entity 端点).

**Hard rule**: 任何 PR 把模块 flip 到 DYNAMIC 之前, 必须先跑 sweep 确认该模块所有 reference 字段都有有效 apiEndpoint.

### Tier 4 — bom schema fix (forward-compat only — current UI bypasses canvas)

| module | field | endpoint | status |
|--------|-------|----------|--------|
| bom | materialTypeId | ~~`/material-types` (404)~~ → `/reference-data/materials` | FIXED V20260425_03 |
| bom | productTypeId | ~~`/finished-goods/product-types` (404)~~ → `/reference-data/products` | FIXED V20260425_03 |

**R3 audit (Apr 25 2026) clarification**: `factory_module_configs` shows F001/bom is DYNAMIC mode, but the actual UI route (`/production/bom`) loads `views/production/bom-unified/index.vue` which **does NOT use `CanvasAwareWrapper`** and never reads the schema-driven `referenceConfig`. So V20260425_03 is **forward-compatible only** — it makes bom correct IF the page is later migrated to use `CanvasAwareWrapper`/`SchemaFormRenderer`, but does not affect any current user-facing screen.

The new `/reference-data/materials` endpoint + GET-by-id IS however available for any other caller (e.g., AI tools, future Canvas pages). Not wasted code — just narrower live impact than originally framed.

## Rule 8 verdict summary

- **Fixed in this round**: 3 (salesperson/customerId/items.productTypeId)
- **Active vulnerable remaining**: 0
- **Time-bombs scheduled**: 20 (1 + 17 + 2), tracked in this doc + R{N+1} backlog
- **Same-cause anti-pattern documented**: schema-defined `referenceConfig` 缺 `apiEndpoint` → ReferenceSelector silently 0 options, 用户感知为"功能坏了但无报错"

## Critical #4 (deferred): salesperson fullName-as-value uniqueness collision

**Reviewer finding (Apr 25 2026)**: `sales_orders.salesperson` stores `fullName` string.
Two employees with identical fullName → indistinguishable for KPI/commission attribution.

**Audit Apr 25 2026 confirms NOT hypothetical** — F001 prod has actual collisions:
```sql
SELECT full_name, COUNT(*) FROM users WHERE factory_id='F001' GROUP BY full_name HAVING COUNT(*)>1;
-- "" (empty) → 6 rows
-- "test"     → 3 rows
```

**Concrete spec for next round**:

### Files to modify

| File | Change |
|------|--------|
| `entity/inventory/SalesOrder.java` | already has `salesperson_id` column (V20260423_01). Wire it into constructor. |
| `dto/inventory/CreateSalesOrderRequest.java` | add `salespersonId: String` field (already accepted by request body schema for the schema-form path) |
| `dto/inventory/UpdateSalesOrderRequest.java` | same field |
| `service/inventory/impl/SalesServiceImpl.java#createSalesOrder` | when `salespersonId != null`: lookup `userRepository.findById(salespersonId)`, snapshot `fullName` into `salesperson` column, write `salespersonId` into FK column. When `salespersonId == null`: legacy path (snapshot fullName from request) |
| `module_schemas` (V20260426_xx migration) | switch sales_order.salesperson `valueField` from `'fullName'` to `'id'`, keep `displayField='fullName'` |
| `LineItemsEditor.vue` | (no change — line items don't have salesperson) |
| `SchemaFormRenderer.vue` | (no change — already passes valueField correctly) |

### Migration order
1. Add `salespersonId` to DTOs (backwards-compat: optional field) — ship + observe traffic
2. Switch schema valueField — observe new orders write both columns
3. Backfill historical: `UPDATE sales_orders SET salesperson_id = (SELECT u.id FROM users u WHERE u.factory_id = sales_orders.factory_id AND u.full_name = sales_orders.salesperson AND <pick latest if collision>)`. Collisions get NULL — manual review by sales manager.

### Acceptance test
```js
async function L4_deep_salesperson_id_collision() {
  // Setup: create 2 users named "test" in F001
  // Create SO via DYNAMIC form, pick "test" — observe which one was picked (by id)
  // SQL: SELECT salesperson, salesperson_id FROM sales_orders WHERE id=<just-created>
  // EXPECT: salesperson_id is the ID of the user actually selected (deterministic)
  // Currently: salesperson_id is NULL, salesperson="test" (ambiguous)
}
```

### Estimated effort: 3-4 hours (incl. test) — 1 round-worth of work, not "next round" deferral.

## Defense-in-depth recommendation

应该在 `SchemaFormRenderer.vue` 或 `ReferenceSelector.vue` 加 dev-mode 警告: 当 `field.type='reference'` 但 `referenceConfig.apiEndpoint` 缺失/无效时, console.warn + 渲染一个红色 placeholder "字段配置错误: 缺 apiEndpoint", 而不是静默 el-input 兜底. 这样下次有人加新 reference 字段忘了 endpoint 会立即被发现.
