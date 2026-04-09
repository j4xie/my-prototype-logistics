-- V20260410_09__module_schemas_batch2_operations.sql
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
