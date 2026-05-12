# 仓管角色 (warehouse_manager) Price 字段隔离 Audit

**Date**: 2026-05-12
**Branch**: ops-warehouse-rbac-price-audit
**Auditor**: organizer-side audit per 六扇门 May 7 transcript callout
**Verdict**: **🔴 RED — No price isolation at any layer (backend DTO, API response, UI columns)**

---

## 1. Background / Trigger

May 7 customer transcript (六扇门第三次 part 2, PR #400 reference):

> 客户原话: "仓管员看的入库界面不应该有价格" — 采购人下单看价格, 仓管入库不接触价格.

This audit verifies whether `warehouse_manager` (仓管) role sees `unitPrice` / `totalAmount` /
`totalPrice` / `totalValue` on:

- 采购订单 (PurchaseOrder) 列表 / 详情
- 收货记录 (PurchaseReceiveRecord) 列表 / 详情
- 物料批次 (MaterialBatch) 列表 / 详情

**Scope**: Web-Admin Vue UI + Java backend REST API. RN Mobile audit deferred.

---

## 2. Role Hierarchy

### 2.1 FactoryUserRole.java

`warehouse_manager` is Level 10 (manager-tier), department=`warehouse`, separate from
`warehouse_worker` (Level 30, 一线员工). The 仓管 the customer means likely maps to
`warehouse_manager` (主管) and/or `warehouse_worker` (仓库员) depending on factory org chart.

Source: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/enums/FactoryUserRole.java:71`

### 2.2 Permission matrix (backend + frontend mirror)

`PermissionServiceImpl.java:163-173` defines `warehouse_manager`:

```java
warehouseManagerPerms.put("warehouse", "read_write");
warehouseManagerPerms.put("inventory", "read_write");
warehouseManagerPerms.put("procurement", "read");      // ← READS procurement
warehouseManagerPerms.put("sales", "read");
warehouseManagerPerms.put("production", "read");
warehouseManagerPerms.put("scheduling", "read");
warehouseManagerPerms.put("report", "read");
warehouseManagerPerms.put("dashboard", "read_write");
```

Frontend `web-admin/src/store/modules/permission.ts:98-101` mirrors:

```typescript
warehouse_manager: {
  dashboard: 'r', production: 'r', warehouse: 'rw', quality: '-',
  procurement: 'r', sales: 'r', hr: '-', equipment: '-',
  ...
}
```

**Conclusion**: `warehouse_manager` has read access to procurement module at module-level.
No field-level granularity exists.

---

## 3. Backend Layer Audit

### 3.1 Controller @RequirePermission gates

`PurchaseController.java` (`/api/mobile/{factoryId}/purchase/*`) endpoints relevant to warehouse:

| Endpoint | Method | @RequirePermission | warehouse_manager allowed? |
|---|---|---|---|
| `/orders` | GET (list) | `{"procurement:read_write","procurement:read"}` | ✅ Yes (read) |
| `/orders/{id}` | GET (detail) | `{"procurement:read_write","procurement:read"}` | ✅ Yes (read) |
| `/receives` | GET (list) | `{"procurement:read_write","procurement:read"}` | ✅ Yes (read) |
| `/receives/{id}` | GET (detail) | `{"procurement:read_write","procurement:read"}` | ✅ Yes (read) |
| `/receives` | POST (create) | `{"procurement:read_write","inventory:write"}` | ✅ Yes (inventory:rw → inventory:write) |
| `/receives/{id}/confirm` | POST | `{"procurement:read_write","inventory:write"}` | ✅ Yes (inventory:rw) |

`MaterialBatchController.java`:

| Endpoint | Method | @RequirePermission | warehouse_manager allowed? |
|---|---|---|---|
| `/material-batches` | GET (list) | (none — open to any auth) | ✅ Yes |
| `/material-batches/{id}` | GET (detail) | (none) | ✅ Yes |

**Finding B1**: All read endpoints accept `procurement:read` — `warehouse_manager` passes
the gate.

### 3.2 DTO field exposure — NO role-based stripping

Searched for `@JsonIgnore`, `@JsonView`, `JsonFilter`, response advice, RBAC field filter:

```bash
grep -rn "RbacResponseFilter|stripFields|filterByRole|FieldFilter" \
    backend/java/cretas-api/src/main/java/com/cretas/aims
# → No matches
```

`@JsonIgnore` is used only on lazy-load entity relations (factory, supplier, user), NOT
on price fields. Confirmed entities expose:

| Entity | Price field | Annotation |
|---|---|---|
| `PurchaseOrder.java:89-93` | `totalAmount`, `taxAmount` | none — serialized |
| `PurchaseOrderItem.java:58-59` | `unitPrice` | none — serialized |
| `PurchaseReceiveRecord.java:84-85` | `totalAmount` | none — serialized |
| `PurchaseReceiveItem.java` | `unitPrice` | none — serialized |
| `MaterialBatch.java:108-109` | `unitPrice` + derived `totalPrice`, `totalValue` | none — serialized |
| `dto/material/MaterialBatchDTO.java:93-99` | `totalValue`, `unitPrice`, `totalPrice` | none — serialized |

**Finding B2**: Zero global response advice, zero per-controller field filter, zero per-role
DTO variant. All callers see same JSON shape regardless of role.

### 3.3 Live test — f006_warehouse_mgr token

Login (via 139 nginx gateway):

```bash
curl -sk --resolve api.cretaceousfuture.com:443:139.196.165.140 \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"f006_warehouse_mgr","password":"123456"}' \
  https://api.cretaceousfuture.com/api/mobile/auth/unified-login
```

Response: `success:true`, `role:"warehouse_manager"`, `factoryId:"F006"`,
`permissions:["warehouse:*"]`. Token obtained.

**GET /api/mobile/F006/purchase/orders** (3 records):

Sample row:
```json
{
  "orderNumber": "PO-20260507-0003",
  "supplierName": "北京飞熊",
  "totalAmount": 5600.00,        // ← EXPOSED
  "taxAmount": 0.00,
  "items": [{
    "materialName": "冻猪蹄",
    "quantity": 200.0000,
    "unitPrice": 28.0000,        // ← EXPOSED
    "lineAmount": 5600.00,       // ← EXPOSED
    "lineAmountWithTax": 5600.00 // ← EXPOSED
  }]
}
```

**GET /api/mobile/F006/purchase/receives** (2 records):

```json
{
  "receiveNumber": "RCV-20260507-4505",
  "totalAmount": 1400.00,        // ← EXPOSED
  "items": [{
    "materialName": "冻猪蹄",
    "receivedQuantity": 50.0000,
    "unitPrice": 28.0000         // ← EXPOSED
  }]
}
```

**GET /api/mobile/F006/material-batches** (2 records):

```json
{
  "batchNumber": "MT-20260507-7640",
  "totalValue": 1400.0000,       // ← EXPOSED
  "unitPrice": 28.00,            // ← EXPOSED
  "totalPrice": 1400.0000        // ← EXPOSED
}
```

**Finding B3 (LIVE CONFIRMED)**: warehouse_manager sees full price fields in all three
endpoints. Customer concern is real.

---

## 4. UI Layer Audit

### 4.1 `web-admin/src/views/procurement/orders/detail.vue`

Price columns rendered (line numbers in current file):

| Line | UI element | Role gate? |
|---|---|---|
| 233 | `<el-descriptions-item label="总金额">{{ formatAmount(order.totalAmount) }}</el-descriptions-item>` | **No** |
| 234 | `税额` (taxAmount) | **No** |
| 250-252 | `<el-table-column prop="unitPrice" label="单价">` | **No** |
| 256-258 | 行小计 (`row.quantity * row.unitPrice`) | **No** |
| 261-298 | 三价对比分析 collapsible panel (BOM 标准价 / 移动均价 / 当前采购价 / 偏差) | **No** |
| 312-313 | `收货记录` 列表 `totalAmount` column | **No** |
| 333-334 | 创建收货单 dialog `unitPrice` column | **No** |

Searched for any `v-if=role|v-if=permission|hasPermission|canSee|v-permission`:

```bash
grep -n "v-if.*role|v-if.*permission|hasPermission|canSee|v-permission" detail.vue
# → No matches
```

**Finding U1**: Zero role-conditionals. All price columns render for ANY user who reaches
the page.

### 4.2 `web-admin/src/views/procurement/receives/list.vue`

Same pattern — `unitPrice` field bound in form / table without role gate (lines 152, 167,
376-378, 421). Zero v-if conditionals.

### 4.3 `web-admin/src/views/warehouse/materials/list.vue`

`unitPrice` + `movingAvgPrice` used to compute `totalValue` and prefill form (lines
170-177). Hint to user when missing. Zero role gating.

### 4.4 Permission store (`store/modules/permission.ts`)

Permission system is module-level (`'rw' | 'r' | 'w' | '-'`) — no notion of field-level
read masks. UI guards exist at *router-level* (page accessibility) only.

---

## 5. Router-level access (sanity check)

Per frontend permission matrix, `warehouse_manager` has `procurement: 'r'` → router lets
them navigate to `/procurement/orders/*` AND `/procurement/receives/*` pages. They reach
detail.vue, list.vue without any extra check.

---

## 6. Verdict

### 6.1 Per-page verdict

| Page | Backend exposure | UI gating | Per-page verdict |
|---|---|---|---|
| `/procurement/orders/list` | totalAmount exposed | none | 🔴 RED |
| `/procurement/orders/detail` | totalAmount + unitPrice + line totals + 三价对比 | none | 🔴 RED |
| `/procurement/receives/list` | totalAmount + unitPrice | none | 🔴 RED |
| `/warehouse/materials/list` | unitPrice + totalValue + totalPrice | none | 🔴 RED |

### 6.2 Overall

**🔴 RED — Customer concern is fully valid. NO price isolation exists at any layer.**

- Backend DTOs/entities expose unitPrice + totalAmount + totalPrice + totalValue + lineAmount
- API responses return identical JSON regardless of role
- UI columns render unconditionally — no v-if=role gate
- Permission system has only module-level granularity, no field-level masks
- Live test with `f006_warehouse_mgr` token confirms full price visibility

---

## 7. Recommended Fix (DO NOT auto-implement — Steve decides scope)

### Option A: UI-only (lightweight, ~2 days dev)

Add `v-if="canSeePrice"` to all price columns in 4 files. Compute `canSeePrice` via
permission store (e.g., `userRole !== 'warehouse_manager' && userRole !== 'warehouse_worker'`,
or new explicit module `procurement_price:read`).

Pros: fast, no API change. Cons: API still leaks price — savvy user can curl token
directly (real concern given audit trigger).

### Option B: Backend + UI (recommended for true isolation, ~1 week dev)

1. Add `@RequirePermission` field-filter aspect / response advice (custom `@JsonView` or
   `ObjectMapper` post-processor) on PurchaseController, MaterialBatchController endpoints
2. Strip `unitPrice`, `totalAmount`, `taxAmount`, `lineAmount`, `lineAmountWithTax`,
   `totalPrice`, `totalValue` when `userRole IN (warehouse_manager, warehouse_worker)`
3. UI v-if='canSeePrice' for column visibility (defense-in-depth + UX clarity)
4. Add tests: f006_warehouse_mgr token cannot see price; f001_admin can
5. Document new permission: `procurement_price:read` (or extend existing matrix with
   field-level overrides on PermissionMatrix)

### Option C: Skip / re-discuss with customer

Maybe 六扇门 only wants UI hidden (price still in DB / API for traceability backend audit),
or wants only specific roles isolated. Confirm with customer before any code change.

### Effort estimate

- Option A: ~1-2 days (4 .vue files × ~30 min + test)
- Option B: ~5-7 days (Java response advice + tests + 4 .vue files + e2e verify per role)
- Option C: 0 days code, ~30 min customer call

---

## 8. Follow-up Issues to File (Steve discretion)

- [ ] Audit RN App (`frontend/CretasFoodTrace`) same price screens — likely same gap
- [ ] Audit other "should not see price" scenarios for 质检员 / 操作员 / 餐饮 service staff
- [ ] Consider extending PermissionService to field-level masking (long-term)
- [ ] PR #414 (receives/list.vue just modified) — re-evaluate if price column should be in
  default render or behind role gate

---

## 9. Evidence Artifacts

- Backend role definition: `entity/enums/FactoryUserRole.java:71`
- Backend permission matrix: `service/impl/PermissionServiceImpl.java:163-173`
- Backend controller gates: `controller/inventory/PurchaseController.java:56-274`,
  `controller/MaterialBatchController.java:228-991`
- Entity price fields: `entity/inventory/PurchaseOrder.java:89-90`,
  `entity/inventory/PurchaseOrderItem.java:58-59`, `entity/MaterialBatch.java:108-109`,
  `dto/material/MaterialBatchDTO.java:93-99`
- UI no-gate: `web-admin/src/views/procurement/orders/detail.vue:233,250-258,261-298,312-313,333-334`
- Live API responses tested 2026-05-12 12:04 CST via `f006_warehouse_mgr` token
  (factoryId=F006, permissions=["warehouse:*"])

---

## 10. Audit Scope Caveats

- Audit limited to Web-Admin Vue UI. RN App not tested.
- Live test used F006 (六腾门) data. F001 / F002 etc. assumed identical schema.
- `procurement_manager` and `factory_super_admin` audit confirmed (legit to see price).
  Other adjacent roles (`sales_manager`, `dispatcher`, `finance_manager`) not specifically
  tested but inherit module-level matrix.
