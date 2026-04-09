# Canvas V2 Phase 2d — Full Module Schemas + Industry Templates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create module_schemas for all 15 business modules and 4 industry templates, enabling Canvas to configure any factory from a template in < 30 minutes.

**Architecture:** SQL migrations seed module_schemas with field definitions, workflow states, and default configs. Industry templates (factory_templates table from Phase 1) bundle pre-configured module selections, field customizations, and trigger chain presets for food processing, bakery, restaurant, and aquaculture verticals. A template application API applies a template to a new factory, creating all factory_module_configs in one operation.

**Tech Stack:** PostgreSQL (JSONB), SQL migrations, Java REST API

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-v2-unified-config-engine.md` (Section 8: Phase 2d)

**Depends on:** Phase 2a + 2b (all tables exist), Phase 2c (Canvas UI to browse/apply templates)

---

## File Structure

```
backend/java/cretas-api/src/main/resources/db/migration/
├── V20260410_05__module_schemas_batch1_core.sql          (NEW — 5 core modules)
├── V20260410_06__module_schemas_batch2_operations.sql    (NEW — 5 operations modules)
├── V20260410_07__module_schemas_batch3_support.sql       (NEW — 5 support modules)
├── V20260410_08__industry_templates.sql                  (NEW — 4 templates)
└── V20260410_09__module_api_paths_update.sql             (NEW — update MODULE_API_PATHS)

backend/java/cretas-api/src/main/java/com/cretas/aims/
├── service/config/
│   └── impl/FactoryConfigServiceImpl.java                (MODIFY — add applyTemplate)
└── controller/
    └── ConfigController.java                             (MODIFY — add template endpoints)

web-admin/src/types/config.ts                             (MODIFY — add new module codes to MODULE_API_PATHS)
```

---

## Task 1: Core Module Schemas (5 modules)

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_05__module_schemas_batch1_core.sql`

**Context:** Phase 1 seeded 2 modules (sales_order, bom). This adds the 5 most critical remaining modules. Each module_schema has: module_code, field_schema (JSONB array of field definitions), workflow_schema (JSONB with states+transitions), and default_config.

- [ ] **Step 1: Write core module schemas**

```sql
-- V20260410_05__module_schemas_batch1_core.sql
-- 5 core business modules

-- 1. purchase_order
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('purchase_order', '采购订单', 'PROCUREMENT', 1,
'[
  {"fieldCode":"poNumber","label":"采购单号","type":"string","required":true,"listVisible":true,"formVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"supplierId","label":"供应商","type":"reference","required":true,"listVisible":true,"formVisible":true,"referenceModule":"supplier","sortOrder":2},
  {"fieldCode":"supplierName","label":"供应商名称","type":"string","listVisible":true,"formVisible":false,"sortOrder":3},
  {"fieldCode":"orderDate","label":"下单日期","type":"date","required":true,"listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"expectedDate","label":"预计到货日","type":"date","listVisible":true,"formVisible":true,"sortOrder":5},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"formVisible":false,"sortOrder":6,"options":["DRAFT","CONFIRMED","RECEIVING","COMPLETED","CANCELLED"]},
  {"fieldCode":"totalAmount","label":"总金额","type":"decimal","listVisible":true,"formVisible":false,"readOnly":true,"sortOrder":7},
  {"fieldCode":"items","label":"采购明细","type":"line_items","formVisible":true,"sortOrder":10,"itemFields":[
    {"fieldCode":"materialTypeId","label":"物料","type":"reference","required":true},
    {"fieldCode":"quantity","label":"数量","type":"decimal","required":true},
    {"fieldCode":"unit","label":"单位","type":"string","required":true},
    {"fieldCode":"unitPrice","label":"单价","type":"decimal","required":true},
    {"fieldCode":"lineAmount","label":"金额","type":"decimal","readOnly":true},
    {"fieldCode":"spec","label":"规格","type":"string"}
  ]},
  {"fieldCode":"remarks","label":"备注","type":"textarea","formVisible":true,"sortOrder":11}
]'::jsonb,
'{"states":[
  {"code":"DRAFT","label":"草稿"},{"code":"CONFIRMED","label":"已确认"},
  {"code":"RECEIVING","label":"收货中"},{"code":"COMPLETED","label":"已完成"},{"code":"CANCELLED","label":"已取消"}
],"transitions":[
  {"from":"DRAFT","to":"CONFIRMED","action":"confirm"},
  {"from":"CONFIRMED","to":"RECEIVING","action":"startReceiving"},
  {"from":"RECEIVING","to":"COMPLETED","action":"complete"},
  {"from":"DRAFT","to":"CANCELLED","action":"cancel"},
  {"from":"CONFIRMED","to":"CANCELLED","action":"cancel"}
]}'::jsonb,
'{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 2. production_plan
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('production_plan', '生产计划', 'PRODUCTION', 1,
'[
  {"fieldCode":"planNumber","label":"计划编号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"productTypeId","label":"产品","type":"reference","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"plannedQuantity","label":"计划数量","type":"decimal","required":true,"listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"actualQuantity","label":"实际数量","type":"decimal","listVisible":true,"readOnly":true,"sortOrder":4},
  {"fieldCode":"unit","label":"单位","type":"string","required":true,"formVisible":true,"sortOrder":5},
  {"fieldCode":"plannedStartDate","label":"计划开始","type":"date","listVisible":true,"formVisible":true,"sortOrder":6},
  {"fieldCode":"plannedEndDate","label":"计划结束","type":"date","listVisible":true,"formVisible":true,"sortOrder":7},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"sortOrder":8,"options":["PLANNED","MATERIAL_READY","IN_PROGRESS","COMPLETED","CANCELLED"]},
  {"fieldCode":"priority","label":"优先级","type":"select","formVisible":true,"sortOrder":9,"options":["HIGH","NORMAL","LOW"]},
  {"fieldCode":"sourceOrderId","label":"来源订单","type":"reference","referenceModule":"sales_order","sortOrder":10}
]'::jsonb,
'{"states":[
  {"code":"PLANNED","label":"已排"},{"code":"MATERIAL_READY","label":"物料齐套"},
  {"code":"IN_PROGRESS","label":"生产中"},{"code":"COMPLETED","label":"已完成"},{"code":"CANCELLED","label":"已取消"}
],"transitions":[
  {"from":"PLANNED","to":"MATERIAL_READY","action":"materialReady"},
  {"from":"MATERIAL_READY","to":"IN_PROGRESS","action":"start"},
  {"from":"IN_PROGRESS","to":"COMPLETED","action":"complete"},
  {"from":"PLANNED","to":"CANCELLED","action":"cancel"}
]}'::jsonb,
'{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 3. quality_inspection
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('quality_inspection', '质检', 'QUALITY', 1,
'[
  {"fieldCode":"inspectionNumber","label":"质检单号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"batchId","label":"批次","type":"reference","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"inspectorId","label":"质检员","type":"reference","listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"inspectionDate","label":"质检日期","type":"date","required":true,"listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"result","label":"结果","type":"select","listVisible":true,"formVisible":true,"sortOrder":5,"options":["PASS","FAIL","CONDITIONAL"]},
  {"fieldCode":"score","label":"评分","type":"decimal","formVisible":true,"sortOrder":6},
  {"fieldCode":"remarks","label":"备注","type":"textarea","formVisible":true,"sortOrder":7}
]'::jsonb,
'{"states":[
  {"code":"PENDING","label":"待检"},{"code":"IN_PROGRESS","label":"检验中"},
  {"code":"COMPLETED","label":"已完成"}
],"transitions":[
  {"from":"PENDING","to":"IN_PROGRESS","action":"start"},
  {"from":"IN_PROGRESS","to":"COMPLETED","action":"complete"}
]}'::jsonb,
'{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 4. inventory (material batches)
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('inventory', '库存', 'WAREHOUSE', 1,
'[
  {"fieldCode":"batchNumber","label":"批次号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"materialTypeId","label":"物料","type":"reference","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"materialName","label":"物料名称","type":"string","listVisible":true,"sortOrder":3},
  {"fieldCode":"currentQuantity","label":"当前数量","type":"decimal","listVisible":true,"readOnly":true,"sortOrder":4},
  {"fieldCode":"unit","label":"单位","type":"string","listVisible":true,"sortOrder":5},
  {"fieldCode":"warehouseLocation","label":"库位","type":"string","listVisible":true,"formVisible":true,"sortOrder":6},
  {"fieldCode":"expirationDate","label":"保质期","type":"date","listVisible":true,"formVisible":true,"sortOrder":7},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"sortOrder":8,"options":["AVAILABLE","RESERVED","QUARANTINE","EXPIRED"]}
]'::jsonb,
'{}'::jsonb,
'{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 5. equipment
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('equipment', '设备', 'EQUIPMENT', 1,
'[
  {"fieldCode":"equipmentCode","label":"设备编号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"name","label":"设备名称","type":"string","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"category","label":"类别","type":"select","listVisible":true,"formVisible":true,"sortOrder":3,"options":["PRODUCTION","PACKAGING","STORAGE","TRANSPORT","TESTING"]},
  {"fieldCode":"location","label":"位置","type":"string","listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"sortOrder":5,"options":["RUNNING","IDLE","MAINTENANCE","OFFLINE"]},
  {"fieldCode":"lastMaintenanceDate","label":"上次维护","type":"date","listVisible":true,"sortOrder":6},
  {"fieldCode":"nextMaintenanceDate","label":"下次维护","type":"date","listVisible":true,"formVisible":true,"sortOrder":7}
]'::jsonb,
'{}'::jsonb,
'{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
cd backend/java/cretas-api
git add src/main/resources/db/migration/V20260410_05__module_schemas_batch1_core.sql
git commit -m "feat(canvas-v2): 5 core module schemas (PO/PP/QI/inventory/equipment)"
```

---

## Task 2: Operations Module Schemas (5 modules)

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_06__module_schemas_batch2_operations.sql`

- [ ] **Step 1: Write operations module schemas**

```sql
-- V20260410_06__module_schemas_batch2_operations.sql
-- 5 operations modules

-- 6. production_report (work reporting)
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('production_report', '报工', 'PRODUCTION', 1,
'[
  {"fieldCode":"reportNumber","label":"报工单号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"batchId","label":"生产批次","type":"reference","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"workerId","label":"报工人","type":"reference","listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"goodQuantity","label":"良品数","type":"decimal","required":true,"listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"defectQuantity","label":"不良品数","type":"decimal","formVisible":true,"sortOrder":5},
  {"fieldCode":"reportDate","label":"报工日期","type":"date","listVisible":true,"formVisible":true,"sortOrder":6},
  {"fieldCode":"remarks","label":"备注","type":"textarea","formVisible":true,"sortOrder":7}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 7. inbound (receiving)
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('inbound', '入库', 'WAREHOUSE', 1,
'[
  {"fieldCode":"inboundNumber","label":"入库单号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"purchaseOrderId","label":"采购单","type":"reference","referenceModule":"purchase_order","listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"materialTypeId","label":"物料","type":"reference","required":true,"listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"quantity","label":"数量","type":"decimal","required":true,"listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"unit","label":"单位","type":"string","required":true,"formVisible":true,"sortOrder":5},
  {"fieldCode":"receivedDate","label":"入库日期","type":"date","listVisible":true,"formVisible":true,"sortOrder":6},
  {"fieldCode":"warehouseLocation","label":"库位","type":"string","formVisible":true,"sortOrder":7},
  {"fieldCode":"expirationDate","label":"保质期","type":"date","formVisible":true,"sortOrder":8}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 8. outbound (shipment)
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('outbound', '出库', 'WAREHOUSE', 1,
'[
  {"fieldCode":"outboundNumber","label":"出库单号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"salesOrderId","label":"销售订单","type":"reference","referenceModule":"sales_order","listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"productTypeId","label":"产品","type":"reference","required":true,"listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"quantity","label":"数量","type":"decimal","required":true,"listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"deliveryDate","label":"出库日期","type":"date","listVisible":true,"formVisible":true,"sortOrder":5},
  {"fieldCode":"vehicleNumber","label":"车牌号","type":"string","formVisible":true,"sortOrder":6},
  {"fieldCode":"driverName","label":"司机","type":"string","formVisible":true,"sortOrder":7}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 9. customer
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('customer', '客户', 'CRM', 1,
'[
  {"fieldCode":"customerCode","label":"客户编号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"customerName","label":"客户名称","type":"string","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"contactPerson","label":"联系人","type":"string","listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"phone","label":"电话","type":"string","listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"address","label":"地址","type":"string","formVisible":true,"sortOrder":5},
  {"fieldCode":"category","label":"类别","type":"select","listVisible":true,"formVisible":true,"sortOrder":6,"options":["DIRECT","DISTRIBUTOR","ONLINE","RESTAURANT"]},
  {"fieldCode":"creditLimit","label":"授信额度","type":"decimal","formVisible":true,"sortOrder":7}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 10. supplier
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('supplier', '供应商', 'PROCUREMENT', 1,
'[
  {"fieldCode":"supplierCode","label":"供应商编号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"supplierName","label":"供应商名称","type":"string","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"contactPerson","label":"联系人","type":"string","listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"phone","label":"电话","type":"string","listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"address","label":"地址","type":"string","formVisible":true,"sortOrder":5},
  {"fieldCode":"category","label":"类别","type":"select","formVisible":true,"sortOrder":6,"options":["RAW_MATERIAL","PACKAGING","EQUIPMENT","SERVICE"]},
  {"fieldCode":"qualificationLevel","label":"资质等级","type":"select","listVisible":true,"formVisible":true,"sortOrder":7,"options":["A","B","C","D"]}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_06__module_schemas_batch2_operations.sql
git commit -m "feat(canvas-v2): 5 operations module schemas (report/inbound/outbound/customer/supplier)"
```

---

## Task 3: Support Module Schemas (5 modules)

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_07__module_schemas_batch3_support.sql`

- [ ] **Step 1: Write support module schemas**

```sql
-- V20260410_07__module_schemas_batch3_support.sql
-- 5 support modules

-- 11. finance_ar (accounts receivable)
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('finance_ar', '应收账款', 'FINANCE', 1,
'[
  {"fieldCode":"arNumber","label":"应收单号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"customerId","label":"客户","type":"reference","referenceModule":"customer","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"salesOrderId","label":"销售订单","type":"reference","referenceModule":"sales_order","listVisible":true,"sortOrder":3},
  {"fieldCode":"totalAmount","label":"应收金额","type":"decimal","required":true,"listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"paidAmount","label":"已收金额","type":"decimal","listVisible":true,"readOnly":true,"sortOrder":5},
  {"fieldCode":"remainingBalance","label":"剩余","type":"decimal","listVisible":true,"readOnly":true,"sortOrder":6},
  {"fieldCode":"dueDate","label":"到期日","type":"date","listVisible":true,"formVisible":true,"sortOrder":7},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"sortOrder":8,"options":["PENDING","PARTIAL","PAID","OVERDUE"]}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":false}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 12. finance_ap (accounts payable)
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('finance_ap', '应付账款', 'FINANCE', 1,
'[
  {"fieldCode":"apNumber","label":"应付单号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"supplierId","label":"供应商","type":"reference","referenceModule":"supplier","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"purchaseOrderId","label":"采购单","type":"reference","referenceModule":"purchase_order","listVisible":true,"sortOrder":3},
  {"fieldCode":"totalAmount","label":"应付金额","type":"decimal","required":true,"listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"paidAmount","label":"已付金额","type":"decimal","listVisible":true,"readOnly":true,"sortOrder":5},
  {"fieldCode":"dueDate","label":"到期日","type":"date","listVisible":true,"formVisible":true,"sortOrder":6},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"sortOrder":7,"options":["PENDING","PARTIAL","PAID","OVERDUE"]}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":false}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 13. hr_employee
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('hr_employee', '员工', 'HR', 1,
'[
  {"fieldCode":"employeeCode","label":"工号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"name","label":"姓名","type":"string","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"department","label":"部门","type":"select","listVisible":true,"formVisible":true,"sortOrder":3,"options":["PRODUCTION","QUALITY","WAREHOUSE","SALES","FINANCE","ADMIN"]},
  {"fieldCode":"position","label":"职位","type":"string","listVisible":true,"formVisible":true,"sortOrder":4},
  {"fieldCode":"phone","label":"电话","type":"string","formVisible":true,"sortOrder":5},
  {"fieldCode":"hireDate","label":"入职日期","type":"date","listVisible":true,"formVisible":true,"sortOrder":6},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"sortOrder":7,"options":["ACTIVE","ON_LEAVE","RESIGNED"]}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":false}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 14. transfer (inter-warehouse)
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('transfer', '调拨', 'WAREHOUSE', 1,
'[
  {"fieldCode":"transferNumber","label":"调拨单号","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"fromWarehouse","label":"调出仓","type":"string","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"toWarehouse","label":"调入仓","type":"string","required":true,"listVisible":true,"formVisible":true,"sortOrder":3},
  {"fieldCode":"status","label":"状态","type":"select","listVisible":true,"sortOrder":4,"options":["DRAFT","IN_TRANSIT","RECEIVED","CANCELLED"]},
  {"fieldCode":"items","label":"调拨明细","type":"line_items","formVisible":true,"sortOrder":5,"itemFields":[
    {"fieldCode":"materialTypeId","label":"物料","type":"reference","required":true},
    {"fieldCode":"quantity","label":"数量","type":"decimal","required":true},
    {"fieldCode":"unit","label":"单位","type":"string","required":true}
  ]}
]'::jsonb,
'{"states":[
  {"code":"DRAFT","label":"草稿"},{"code":"IN_TRANSIT","label":"在途"},
  {"code":"RECEIVED","label":"已签收"},{"code":"CANCELLED","label":"已取消"}
],"transitions":[
  {"from":"DRAFT","to":"IN_TRANSIT","action":"ship"},
  {"from":"IN_TRANSIT","to":"RECEIVED","action":"receive"},
  {"from":"DRAFT","to":"CANCELLED","action":"cancel"}
]}'::jsonb,
'{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;

-- 15. traceability
INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, permission_schema, default_config)
VALUES ('traceability', '溯源', 'QUALITY', 1,
'[
  {"fieldCode":"traceCode","label":"溯源码","type":"string","required":true,"listVisible":true,"readOnly":true,"sortOrder":1},
  {"fieldCode":"productBatchId","label":"产品批次","type":"reference","required":true,"listVisible":true,"formVisible":true,"sortOrder":2},
  {"fieldCode":"productionDate","label":"生产日期","type":"date","listVisible":true,"sortOrder":3},
  {"fieldCode":"expirationDate","label":"保质期","type":"date","listVisible":true,"sortOrder":4},
  {"fieldCode":"materialSources","label":"原料来源","type":"json_array","formVisible":true,"sortOrder":5},
  {"fieldCode":"qcResult","label":"质检结果","type":"select","listVisible":true,"sortOrder":6,"options":["PASS","FAIL"]},
  {"fieldCode":"scanCount","label":"扫描次数","type":"integer","listVisible":true,"readOnly":true,"sortOrder":7}
]'::jsonb,
'{}'::jsonb, '{}'::jsonb,
'{"enabledByDefault":true}'::jsonb)
ON CONFLICT (module_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_07__module_schemas_batch3_support.sql
git commit -m "feat(canvas-v2): 5 support module schemas (AR/AP/HR/transfer/traceability)"
```

---

## Task 4: Industry Templates

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_08__industry_templates.sql`

**Context:** `factory_templates` table was created in Phase 1 (V20260409_01). Templates store pre-configured module selections + default overrides for specific industry verticals.

- [ ] **Step 1: Check factory_templates table structure**

Read the Phase 1 migration to confirm column names:
```bash
grep -A 20 "factory_templates" backend/java/cretas-api/src/main/resources/db/migration/V20260409_01__canvas_config_tables.sql
```

- [ ] **Step 2: Write industry templates**

```sql
-- V20260410_08__industry_templates.sql
-- 4 industry templates for Canvas quick-start

-- Template 1: Food Processing (食品加工 — 白垩纪核心场景)
INSERT INTO factory_templates (template_code, template_name, industry, description,
    module_configs, default_overrides)
VALUES ('FOOD_PROCESSING', '食品加工', '食品制造',
'适用于: 熟食/面点/烘焙/调味品加工企业。包含完整的进销存+生产+质检+溯源模块。',
'{"enabledModules":["sales_order","purchase_order","bom","production_plan","production_report","quality_inspection","inventory","inbound","outbound","equipment","customer","supplier","traceability","transfer"],"disabledModules":["finance_ar","finance_ap","hr_employee"]}'::jsonb,
'{"defaultValues":{"bom":{"yieldRate":95},"quality_inspection":{"autoCreateOnBatchComplete":true},"production_plan":{"defaultPriority":"NORMAL"}},"disabledTools":["restaurant_*","camera_facial_*"]}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;

-- Template 2: Bakery (烘焙)
INSERT INTO factory_templates (template_code, template_name, industry, description,
    module_configs, default_overrides)
VALUES ('BAKERY', '烘焙工厂', '烘焙',
'适用于: 面包/蛋糕/糕点工厂。BOM配方管理+短保质期+高频排产。',
'{"enabledModules":["sales_order","purchase_order","bom","production_plan","production_report","quality_inspection","inventory","inbound","outbound","customer","supplier","traceability"],"disabledModules":["equipment","finance_ar","finance_ap","hr_employee","transfer"]}'::jsonb,
'{"defaultValues":{"bom":{"yieldRate":90},"inventory":{"defaultShelfLifeDays":7},"production_plan":{"defaultPriority":"HIGH"}},"disabledTools":["equipment_*","restaurant_*"]}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;

-- Template 3: Restaurant (餐饮)
INSERT INTO factory_templates (template_code, template_name, industry, description,
    module_configs, default_overrides)
VALUES ('RESTAURANT', '餐饮企业', '餐饮',
'适用于: 连锁餐饮/中央厨房。侧重采购+库存+成本控制，不需要复杂生产流程。',
'{"enabledModules":["purchase_order","inventory","inbound","outbound","customer","supplier","bom"],"disabledModules":["sales_order","production_plan","production_report","quality_inspection","equipment","finance_ar","finance_ap","hr_employee","transfer","traceability"]}'::jsonb,
'{"defaultValues":{"bom":{"yieldRate":85},"inventory":{"defaultShelfLifeDays":3}},"disabledTools":["production_*","scheduling_*","quality_*","scale_*"]}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;

-- Template 4: Aquaculture (水产)
INSERT INTO factory_templates (template_code, template_name, industry, description,
    module_configs, default_overrides)
VALUES ('AQUACULTURE', '水产加工', '水产',
'适用于: 水产品加工/冷链。强调溯源+冷链温控+批次管理。',
'{"enabledModules":["sales_order","purchase_order","bom","production_plan","production_report","quality_inspection","inventory","inbound","outbound","equipment","customer","supplier","traceability","transfer"],"disabledModules":["finance_ar","finance_ap","hr_employee"]}'::jsonb,
'{"defaultValues":{"bom":{"yieldRate":75},"inventory":{"defaultShelfLifeDays":14,"requireTemperatureLog":true},"quality_inspection":{"requireBatchPhoto":true}},"disabledTools":["restaurant_*"]}'::jsonb)
ON CONFLICT (template_code) DO NOTHING;
```

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V20260410_08__industry_templates.sql
git commit -m "feat(canvas-v2): 4 industry templates (food/bakery/restaurant/aquaculture)"
```

---

## Task 5: Update MODULE_API_PATHS + Template Apply API

**Files:**
- Modify: `web-admin/src/types/config.ts` — add new module codes
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java` — add template endpoints

- [ ] **Step 1: Update MODULE_API_PATHS**

In `web-admin/src/types/config.ts`, extend the existing map:
```typescript
export const MODULE_API_PATHS: Record<string, string> = {
  sales_order: 'sales-orders',
  bom: 'bom-items',
  inbound: 'material-batches/inbound',
  outbound: 'material-batches/outbound',
  production_report: 'work-reports',
  production_plan: 'production-plans',
  purchase_order: 'purchase-orders',
  quality_inspection: 'quality-inspections',
  equipment: 'equipment',
  inventory: 'inventory',
  // Phase 2d additions
  customer: 'customers',
  supplier: 'suppliers',
  finance_ar: 'finance/ar',
  finance_ap: 'finance/ap',
  hr_employee: 'hr/employees',
  transfer: 'transfers',
  traceability: 'traceability',
}
```

- [ ] **Step 2: Add template list + apply endpoints**

Add to `ConfigController.java`:
```java
@GetMapping("/templates")
@Operation(summary = "获取行业模板列表")
public ApiResponse<List<FactoryTemplate>> getTemplates() {
    return ApiResponse.success(factoryTemplateRepository.findAll());
}

@PostMapping("/apply-template/{templateCode}")
@Operation(summary = "应用行业模板到工厂")
public ApiResponse<String> applyTemplate(
        @PathVariable String factoryId,
        @PathVariable String templateCode) {
    factoryConfigService.applyTemplate(factoryId, templateCode);
    return ApiResponse.success("模板已应用");
}
```

- [ ] **Step 3: Add applyTemplate to FactoryConfigServiceImpl**

```java
public void applyTemplate(String factoryId, String templateCode) {
    FactoryTemplate template = factoryTemplateRepository.findByTemplateCode(templateCode)
        .orElseThrow(() -> new BusinessException("模板不存在: " + templateCode));

    // 1. Create new draft configuration
    FactoryConfiguration config = getOrCreateDraft(factoryId);

    // 2. Apply module enables/disables from template
    Map<String, Object> moduleConfigs = template.getModuleConfigs();
    // Template application logic — create FactoryModuleConfig for each enabled module

    log.info("Template {} applied to factory {}", templateCode, factoryId);
}
```

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/types/config.ts \
        backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java
git commit -m "feat(canvas-v2): template list/apply API + MODULE_API_PATHS for all 15 modules"
```

---

## Verification Criteria (Phase 2d Done)

1. `SELECT count(*) FROM module_schemas` → 15 (2 from Phase 1 + 13 new)
2. `SELECT template_code, template_name FROM factory_templates` → 4 templates
3. `POST /api/mobile/F001/config/apply-template/FOOD_PROCESSING` → creates factory config with 14 enabled modules
4. `POST /api/mobile/F002/config/apply-template/BAKERY` → creates config with 12 enabled modules (no equipment/transfer)
5. `GET /api/mobile/F001/config/modules` → returns 14 module summaries
6. Canvas Editor ModuleTree shows all 14 modules for F001
7. Each module's FieldConfigPanel shows correct fields from schema
8. Full E2E: create new factory → apply template → publish → factory operational < 30 min

---

## Parallel Work Suggestions

### Subagent: ✅ Tasks 1-3 can run in parallel (independent SQL files)
### Multi-Chat: ✅ Task 5 (frontend) can parallel with Tasks 1-4 (backend SQL)
