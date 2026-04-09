-- V20260410_08__module_schemas_batch1_core.sql
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
