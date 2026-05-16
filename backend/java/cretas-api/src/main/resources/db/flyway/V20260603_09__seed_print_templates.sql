-- =====================================================
-- C-PRT-EDITOR-1 (Sprint 3 Track-J) — seed print templates
--
-- Inserts 6 system-level default print templates (factory_id IS NULL means
-- available to all factories per FormTemplate.java:51) so customers can
-- 'print straight out of the box' before designing custom layouts in
-- PrintTemplateEditor.vue.
--
-- Storage shape: schemaJson is the Formily envelope
-- {type:"object", properties:{_printSchema:<PrintTemplateSchema>}} so the
-- existing FormTemplateServiceImpl.validateSchemaJson() (Day 1 §3.2 plan)
-- accepts it unchanged.
--
-- Also adds 1 ai_intent_configs row to bind the user prompt
-- "帮我设计 X 单 PDF 模板" → print_template_create_from_ai Tool.
--
-- @since 2026-05-16 (Day 8)
-- =====================================================

-- ---- 1. PRINT_SALES_ORDER ----------------------------
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  gen_random_uuid(), NULL, '销售单-默认', 'PRINT_SALES_ORDER',
  '{"type":"object","properties":{"_printSchema":{"version":1,"canvas":{"width":595,"height":842,"orientation":"portrait","marginTop":40,"marginBottom":40,"marginLeft":50,"marginRight":50},"elements":[
    {"id":"el_title","type":"text","x":200,"y":60,"text":"销售订单","fontSize":22,"bold":true,"align":"center","width":200,"color":"#1f2937"},
    {"id":"el_factory","type":"field","x":50,"y":110,"binding":"{{factoryName}}","fontSize":10,"color":"#6b7280"},
    {"id":"el_orderNo","type":"field","x":50,"y":150,"binding":"订单号: {{order.orderNumber}}","fontSize":14,"bold":true},
    {"id":"el_date","type":"field","x":350,"y":150,"binding":"日期: {{format.date(order.orderDate, ''YYYY-MM-DD'')}}","fontSize":12},
    {"id":"el_customer","type":"field","x":50,"y":180,"binding":"客户: {{order.customerName}}","fontSize":12},
    {"id":"el_salesperson","type":"field","x":350,"y":180,"binding":"销售员: {{order.salesperson}}","fontSize":12},
    {"id":"el_total","type":"field","x":50,"y":215,"binding":"合计: {{format.currency(order.totalAmount)}}","fontSize":14,"bold":true,"color":"#dc2626"},
    {"id":"el_qr","type":"qr","x":480,"y":60,"size":70,"content":"SO:{{order.orderNumber}}"},
    {"id":"el_items","type":"table","x":50,"y":260,"width":495,"binding":"{{order.items}}","rowHeight":24,"headerBg":"#f3f4f6","headerFontSize":11,"bodyFontSize":10,"columns":[
      {"header":"物料","binding":"{{item.materialName}}","width":200,"align":"left"},
      {"header":"数量","binding":"{{item.quantity}}","width":80,"align":"right","format":"qty"},
      {"header":"单位","binding":"{{item.unit}}","width":60,"align":"center"},
      {"header":"单价","binding":"{{item.unitPrice}}","width":80,"align":"right","format":"currency"},
      {"header":"小计","binding":"{{item.subtotal}}","width":75,"align":"right","format":"currency"}
    ]},
    {"id":"el_remark","type":"field","x":50,"y":680,"binding":"备注: {{order.remark}}","fontSize":10,"color":"#6b7280","emptyText":"-"},
    {"id":"el_stamp","type":"stamp","x":420,"y":720,"size":90,"stampId":"default","opacity":0.7}
  ]}}}',
  '默认销售单 PDF 模板, 含 logo / 订单信息 / 物料 table / 二维码 / 印章 — 客户可在 PrintTemplateEditor 中复制改造',
  1, true, 'SYSTEM', NOW(), NOW()
);

-- ---- 2. PRINT_PURCHASE_ORDER -------------------------
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  gen_random_uuid(), NULL, '采购单-默认', 'PRINT_PURCHASE_ORDER',
  '{"type":"object","properties":{"_printSchema":{"version":1,"canvas":{"width":595,"height":842,"orientation":"portrait"},"elements":[
    {"id":"el_title","type":"text","x":200,"y":60,"text":"采购订单","fontSize":22,"bold":true,"align":"center","width":200},
    {"id":"el_factory","type":"field","x":50,"y":110,"binding":"{{factoryName}}","fontSize":10,"color":"#6b7280"},
    {"id":"el_orderNo","type":"field","x":50,"y":150,"binding":"采购单号: {{order.orderNumber}}","fontSize":14,"bold":true},
    {"id":"el_supplier","type":"field","x":50,"y":180,"binding":"供应商: {{order.supplierName}}","fontSize":12},
    {"id":"el_date","type":"field","x":350,"y":180,"binding":"日期: {{format.date(order.orderDate)}}","fontSize":12},
    {"id":"el_expected","type":"field","x":50,"y":210,"binding":"期望到货: {{format.date(order.expectedDeliveryDate)}}","fontSize":12},
    {"id":"el_total","type":"field","x":50,"y":240,"binding":"合计: {{format.currency(order.totalAmount)}}","fontSize":14,"bold":true,"color":"#dc2626"},
    {"id":"el_qr","type":"qr","x":480,"y":60,"size":70,"content":"{{order.qrPayload}}"},
    {"id":"el_items","type":"table","x":50,"y":280,"width":495,"binding":"{{order.items}}","rowHeight":24,"headerBg":"#f3f4f6","headerFontSize":11,"bodyFontSize":10,"columns":[
      {"header":"原料","binding":"{{item.materialName}}","width":160,"align":"left"},
      {"header":"规格","binding":"{{item.spec}}","width":100,"align":"left"},
      {"header":"数量","binding":"{{item.quantity}}","width":80,"align":"right","format":"qty"},
      {"header":"单位","binding":"{{item.unit}}","width":60,"align":"center"},
      {"header":"单价","binding":"{{item.unitPrice}}","width":95,"align":"right","format":"currency"}
    ]},
    {"id":"el_recv","type":"text","x":50,"y":700,"text":"仓管员收货确认: ____________________","fontSize":10},
    {"id":"el_deliv","type":"text","x":50,"y":725,"text":"送货员签名: ____________________","fontSize":10},
    {"id":"el_stamp","type":"stamp","x":420,"y":720,"size":90,"stampId":"default","opacity":0.7}
  ]}}}',
  '默认采购单 PDF 模板, 含二维码 (仓管员扫码入库) + 收货签字行',
  1, true, 'SYSTEM', NOW(), NOW()
);

-- ---- 3. PRINT_QUOTATION ------------------------------
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  gen_random_uuid(), NULL, '报价单-默认', 'PRINT_QUOTATION',
  '{"type":"object","properties":{"_printSchema":{"version":1,"canvas":{"width":595,"height":842,"orientation":"portrait"},"elements":[
    {"id":"el_title","type":"text","x":200,"y":60,"text":"报价单","fontSize":22,"bold":true,"align":"center","width":200},
    {"id":"el_factory","type":"field","x":50,"y":110,"binding":"{{factoryName}}","fontSize":10,"color":"#6b7280"},
    {"id":"el_qnum","type":"field","x":50,"y":150,"binding":"报价编号: {{quotation.quotationNumber}}","fontSize":14,"bold":true},
    {"id":"el_qdate","type":"field","x":350,"y":150,"binding":"日期: {{format.date(quotation.quotationDate)}}","fontSize":12},
    {"id":"el_customer","type":"field","x":50,"y":180,"binding":"客户: {{quotation.customerName}}","fontSize":12},
    {"id":"el_valid","type":"field","x":350,"y":180,"binding":"有效期至: {{format.date(quotation.validUntil)}}","fontSize":12},
    {"id":"el_sales","type":"field","x":50,"y":210,"binding":"销售员: {{quotation.salesperson}}","fontSize":12},
    {"id":"el_total","type":"field","x":50,"y":240,"binding":"报价合计: {{format.currency(quotation.totalAmount)}}","fontSize":14,"bold":true,"color":"#dc2626"},
    {"id":"el_items","type":"table","x":50,"y":280,"width":495,"binding":"{{quotation.items}}","rowHeight":24,"headerBg":"#f3f4f6","headerFontSize":11,"bodyFontSize":10,"columns":[
      {"header":"产品","binding":"{{item.materialName}}","width":200,"align":"left"},
      {"header":"数量","binding":"{{item.quantity}}","width":80,"align":"right","format":"qty"},
      {"header":"单位","binding":"{{item.unit}}","width":60,"align":"center"},
      {"header":"单价","binding":"{{item.unitPrice}}","width":80,"align":"right","format":"currency"},
      {"header":"小计","binding":"{{item.subtotal}}","width":75,"align":"right","format":"currency"}
    ]},
    {"id":"el_note","type":"text","x":50,"y":700,"text":"报价条款: 含税价, 7 个工作日内有效, 大宗可议","fontSize":9,"color":"#6b7280"},
    {"id":"el_stamp","type":"stamp","x":420,"y":720,"size":90,"stampId":"default","opacity":0.7}
  ]}}}',
  '默认报价单 PDF 模板',
  1, true, 'SYSTEM', NOW(), NOW()
);

-- ---- 4. PRINT_PRODUCTION_TASK (no monetary fields) ----
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  gen_random_uuid(), NULL, '生产任务单-默认', 'PRINT_PRODUCTION_TASK',
  '{"type":"object","properties":{"_printSchema":{"version":1,"canvas":{"width":595,"height":842,"orientation":"portrait"},"elements":[
    {"id":"el_title","type":"text","x":200,"y":60,"text":"生产任务单","fontSize":22,"bold":true,"align":"center","width":200},
    {"id":"el_factory","type":"field","x":50,"y":110,"binding":"{{factoryName}}","fontSize":10,"color":"#6b7280"},
    {"id":"el_tnum","type":"field","x":50,"y":150,"binding":"任务号: {{task.taskNumber}}","fontSize":14,"bold":true},
    {"id":"el_product","type":"field","x":50,"y":180,"binding":"产品: {{task.productName}}","fontSize":12},
    {"id":"el_qty","type":"field","x":350,"y":180,"binding":"计划数量: {{task.plannedQuantity}} {{task.unit}}","fontSize":12,"bold":true},
    {"id":"el_workshop","type":"field","x":50,"y":210,"binding":"车间: {{task.workshopName}}","fontSize":12},
    {"id":"el_supervisor","type":"field","x":350,"y":210,"binding":"负责人: {{task.supervisor}}","fontSize":12},
    {"id":"el_start","type":"field","x":50,"y":240,"binding":"开始日期: {{format.date(task.startDate)}}","fontSize":12},
    {"id":"el_end","type":"field","x":350,"y":240,"binding":"结束日期: {{format.date(task.endDate)}}","fontSize":12},
    {"id":"el_processes","type":"table","x":50,"y":290,"width":495,"binding":"{{task.processes}}","rowHeight":24,"headerBg":"#f3f4f6","headerFontSize":11,"bodyFontSize":10,"columns":[
      {"header":"工序","binding":"{{item.name}}","width":200,"align":"left"},
      {"header":"负责工位","binding":"{{item.station}}","width":150,"align":"center"},
      {"header":"计划耗时","binding":"{{item.plannedHours}}","width":145,"align":"right"}
    ]},
    {"id":"el_check","type":"text","x":50,"y":700,"text":"主管签字: ___________________  车间主任签字: ___________________","fontSize":10}
  ]}}}',
  '默认生产任务单 PDF 模板 (不含金额字段, 无需价格脱敏)',
  1, true, 'SYSTEM', NOW(), NOW()
);

-- ---- 5. PRINT_MATERIAL_REQUISITION (no monetary fields) ----
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  gen_random_uuid(), NULL, '领料单-默认', 'PRINT_MATERIAL_REQUISITION',
  '{"type":"object","properties":{"_printSchema":{"version":1,"canvas":{"width":595,"height":842,"orientation":"portrait"},"elements":[
    {"id":"el_title","type":"text","x":200,"y":60,"text":"领料单","fontSize":22,"bold":true,"align":"center","width":200},
    {"id":"el_factory","type":"field","x":50,"y":110,"binding":"{{factoryName}}","fontSize":10,"color":"#6b7280"},
    {"id":"el_rnum","type":"field","x":50,"y":150,"binding":"领料单号: {{requisition.requisitionNumber}}","fontSize":14,"bold":true},
    {"id":"el_product","type":"field","x":50,"y":180,"binding":"产品: {{requisition.productName}}","fontSize":12},
    {"id":"el_workshop","type":"field","x":350,"y":180,"binding":"车间: {{requisition.workshop}}","fontSize":12},
    {"id":"el_requester","type":"field","x":50,"y":210,"binding":"领料人: {{requisition.requester}}","fontSize":12},
    {"id":"el_date","type":"field","x":350,"y":210,"binding":"申请日期: {{format.date(requisition.requestDate)}}","fontSize":12},
    {"id":"el_items","type":"table","x":50,"y":260,"width":495,"binding":"{{requisition.items}}","rowHeight":24,"headerBg":"#f3f4f6","headerFontSize":11,"bodyFontSize":10,"columns":[
      {"header":"原料","binding":"{{item.materialName}}","width":200,"align":"left"},
      {"header":"规格","binding":"{{item.spec}}","width":120,"align":"left"},
      {"header":"申请数量","binding":"{{item.quantity}}","width":100,"align":"right","format":"qty"},
      {"header":"单位","binding":"{{item.unit}}","width":75,"align":"center"}
    ]},
    {"id":"el_check","type":"text","x":50,"y":700,"text":"仓管员发放签字: ___________________  领料人签字: ___________________","fontSize":10}
  ]}}}',
  '默认领料单 PDF 模板 (不含金额字段, 无需价格脱敏)',
  1, true, 'SYSTEM', NOW(), NOW()
);

-- ---- 6. PRINT_WEIGHING_SLIP (F006 食品行业刚需 ⭐) ----
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  gen_random_uuid(), NULL, '称重单-默认', 'PRINT_WEIGHING_SLIP',
  '{"type":"object","properties":{"_printSchema":{"version":1,"canvas":{"width":595,"height":842,"orientation":"portrait"},"elements":[
    {"id":"el_title","type":"text","x":200,"y":50,"text":"称重单","fontSize":22,"bold":true,"align":"center","width":200},
    {"id":"el_factory","type":"field","x":50,"y":95,"binding":"{{factoryName}}","fontSize":10,"color":"#6b7280"},
    {"id":"el_slipNum","type":"field","x":50,"y":130,"binding":"称重单号: {{slip.slipNumber}}","fontSize":14,"bold":true},
    {"id":"el_product","type":"field","x":50,"y":155,"binding":"产品: {{slip.productName}}","fontSize":11},
    {"id":"el_partner","type":"field","x":50,"y":175,"binding":"客户/供应商: {{slip.partnerName}}","fontSize":11},
    {"id":"el_date","type":"field","x":50,"y":195,"binding":"过磅日期: {{format.date(slip.weighDate)}}","fontSize":11},
    {"id":"el_operator","type":"field","x":50,"y":215,"binding":"操作员: {{slip.operator}}","fontSize":11},
    {"id":"el_totals","type":"field","x":50,"y":250,"binding":"总毛重: {{format.qty(slip.grossWeight)}} kg  |  总皮重: {{format.qty(slip.tareWeight)}} kg  |  总净重: {{format.qty(slip.netWeight)}} kg","fontSize":12,"bold":true,"color":"#dc2626"},
    {"id":"el_items","type":"table","x":50,"y":295,"width":495,"binding":"{{slip.items}}","rowHeight":22,"headerBg":"#f3f4f6","headerFontSize":10,"bodyFontSize":9,"columns":[
      {"header":"箱号","binding":"{{item.boxNo}}","width":80,"align":"center"},
      {"header":"毛重(kg)","binding":"{{item.grossWeight}}","width":130,"align":"right","format":"qty"},
      {"header":"皮重(kg)","binding":"{{item.tareWeight}}","width":130,"align":"right","format":"qty"},
      {"header":"净重(kg)","binding":"{{item.netWeight}}","width":155,"align":"right","format":"qty"}
    ]},
    {"id":"el_barcode","type":"barcode","x":50,"y":700,"width":200,"height":50,"content":"{{slip.slipNumber}}","format":"CODE128"},
    {"id":"el_stamp","type":"stamp","x":420,"y":700,"size":90,"stampId":"default","opacity":0.7}
  ]}}}',
  '默认称重单 PDF 模板 — F006 卤制品食品行业刚需场景, 表格行数动态 (每箱独立称重明细), 含 CODE128 条码',
  1, true, 'SYSTEM', NOW(), NOW()
);

-- ---- AI intent binding ------------------------------
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(), 'PRINT_TEMPLATE_CREATE_FROM_AI', '生成打印模板', 'PRINT', 'print_template_create_from_ai', 'LOW',
  '["生成打印模板","设计打印模板","设计PDF模板","生成销售单PDF","生成采购单PDF","设计报价单","设计生产任务单","设计领料单","设计称重单","帮我设计打印模板","帮我做个PDF","AI生成模板"]',
  'AI 生成 schema-driven 打印模板 — 用户描述布局需求, AI 输出 schema_json 并保存为可编辑的 FormTemplate (PRINT_* entityType)',
  85, true, NOW(), NOW()
)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'print_template_create_from_ai', is_active = true;
