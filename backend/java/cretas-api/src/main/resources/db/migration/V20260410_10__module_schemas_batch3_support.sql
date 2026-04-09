-- V20260410_10__module_schemas_batch3_support.sql
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
