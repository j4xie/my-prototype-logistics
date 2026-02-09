-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_15_10__add_form_templates.sql
-- Conversion date: 2026-01-26 18:48:36
-- ============================================

-- =====================================================
-- 表单模板添加脚本
-- 添加 20 个系统级表单模板
-- 版本: V2026_01_15_10
-- =====================================================

-- =====================================================
-- 1. 产品模板 (PRODUCT_TYPE) - 5个
-- =====================================================

-- 1.1 生鲜产品
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '生鲜产品',
  'PRODUCT_TYPE',
  '{"type":"object","properties":{"name":{"type":"string","title":"产品名称","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入产品名称"},"x-validator":[{"required":true,"message":"请输入产品名称"}]},"category":{"type":"string","title":"分类","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["蔬菜","水果","肉类","禽蛋"],"x-component-props":{"placeholder":"选择分类"}},"origin":{"type":"string","title":"产地","x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入产地"}},"shelfLife":{"type":"number","title":"保鲜期(天)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":1,"max":365}},"storageTemp":{"type":"string","title":"储存温度","x-decorator":"FormItem","x-component":"Select","enum":["常温","冷藏(0-4°C)","冷冻(-18°C以下)"]},"unit":{"type":"string","title":"计量单位","x-decorator":"FormItem","x-component":"Select","enum":["千克","斤","个","箱"]}}}',
  '适用于新鲜蔬果、肉类等生鲜产品',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 1.2 海鲜产品
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '海鲜产品',
  'PRODUCT_TYPE',
  '{"type":"object","properties":{"name":{"type":"string","title":"产品名称","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入产品名称"},"x-validator":[{"required":true,"message":"请输入产品名称"}]},"category":{"type":"string","title":"分类","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["鱼类","虾类","蟹类","贝类","其他海产"],"x-component-props":{"placeholder":"选择分类"}},"catchDate":{"type":"string","title":"捕捞日期","x-decorator":"FormItem","x-component":"DatePicker","x-component-props":{"placeholder":"选择捕捞日期"}},"sourceType":{"type":"string","title":"来源类型","x-decorator":"FormItem","x-component":"Select","enum":["野生捕捞","人工养殖"]},"storageTemp":{"type":"string","title":"储存温度","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["冷藏(0-4°C)","冷冻(-18°C以下)","活鲜暂养"]},"unit":{"type":"string","title":"计量单位","x-decorator":"FormItem","x-component":"Select","enum":["千克","斤","条","只"]}}}',
  '适用于鱼虾蟹贝等海鲜产品',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 1.3 加工食品
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '加工食品',
  'PRODUCT_TYPE',
  '{"type":"object","properties":{"name":{"type":"string","title":"产品名称","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入产品名称"},"x-validator":[{"required":true,"message":"请输入产品名称"}]},"category":{"type":"string","title":"分类","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["罐头","调味品","干货","腌制品","熟食"],"x-component-props":{"placeholder":"选择分类"}},"shelfLife":{"type":"number","title":"保质期(月)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":1,"max":36}},"ingredients":{"type":"string","title":"配料表","x-decorator":"FormItem","x-component":"Input.TextArea","x-component-props":{"placeholder":"输入配料表","rows":3}},"processMethod":{"type":"string","title":"加工工艺","x-decorator":"FormItem","x-component":"Select","enum":["热加工","冷加工","发酵","腌制","干燥"]},"storageTemp":{"type":"string","title":"储存条件","x-decorator":"FormItem","x-component":"Select","enum":["常温阴凉","冷藏","冷冻"]}}}',
  '适用于罐头、调味品等加工食品',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 1.4 冷冻产品
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '冷冻产品',
  'PRODUCT_TYPE',
  '{"type":"object","properties":{"name":{"type":"string","title":"产品名称","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入产品名称"},"x-validator":[{"required":true,"message":"请输入产品名称"}]},"category":{"type":"string","title":"分类","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["速冻水饺","速冻汤圆","冷冻肉类","冷冻蔬菜","冷冻海鲜"],"x-component-props":{"placeholder":"选择分类"}},"freezeDate":{"type":"string","title":"冷冻日期","x-decorator":"FormItem","x-component":"DatePicker","x-component-props":{"placeholder":"选择冷冻日期"}},"shelfLife":{"type":"number","title":"保质期(月)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":1,"max":24}},"storageTemp":{"type":"string","title":"储存温度","required":true,"x-decorator":"FormItem","x-component":"Input","default":"-18°C以下"},"thawingNote":{"type":"string","title":"解冻须知","x-decorator":"FormItem","x-component":"Input.TextArea","x-component-props":{"placeholder":"输入解冻注意事项","rows":2}}}}',
  '适用于速冻食品等冷冻产品',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 1.5 有机产品
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '有机产品',
  'PRODUCT_TYPE',
  '{"type":"object","properties":{"name":{"type":"string","title":"产品名称","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入产品名称"},"x-validator":[{"required":true,"message":"请输入产品名称"}]},"category":{"type":"string","title":"分类","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["有机蔬菜","有机水果","有机谷物","有机禽蛋","有机肉类"],"x-component-props":{"placeholder":"选择分类"}},"certNumber":{"type":"string","title":"有机认证号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入有机认证编号"}},"certOrg":{"type":"string","title":"认证机构","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入认证机构名称"}},"certExpiry":{"type":"string","title":"认证有效期","x-decorator":"FormItem","x-component":"DatePicker","x-component-props":{"placeholder":"选择认证到期日期"}},"origin":{"type":"string","title":"产地","x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入产地"}}}}',
  '适用于有机认证食品',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- =====================================================
-- 2. 质检模板 (QUALITY_CHECK) - 5个
-- =====================================================

-- 2.1 基础质检
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '基础质检',
  'QUALITY_CHECK',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"扫码或输入批次号"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"appearance":{"type":"string","title":"外观检查","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["正常","轻微异常","明显异常"],"x-component-props":{"placeholder":"选择外观状态"}},"smell":{"type":"string","title":"气味检查","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["正常","轻微异味","明显异味"]},"color":{"type":"string","title":"颜色检查","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["正常","偏淡","偏深","异常"]},"result":{"type":"string","title":"检验结果","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["合格","不合格","待复检"]},"remark":{"type":"string","title":"备注","x-decorator":"FormItem","x-component":"Input.TextArea","x-component-props":{"placeholder":"输入检验备注","rows":2}}}}',
  '适用于通用产品质检',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 2.2 生鲜质检
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '生鲜质检',
  'QUALITY_CHECK',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"扫码或输入批次号"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"freshness":{"type":"string","title":"新鲜度","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["优","良","中","差"],"x-component-props":{"placeholder":"评估新鲜度"}},"moisture":{"type":"number","title":"水分含量(%)","x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0,"max":100,"precision":1}},"pestCheck":{"type":"string","title":"虫害检查","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["无虫害","轻微虫害","严重虫害"]},"bruiseCheck":{"type":"string","title":"损伤检查","x-decorator":"FormItem","x-component":"Select","enum":["无损伤","轻微损伤","严重损伤"]},"result":{"type":"string","title":"检验结果","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["合格","不合格","降级处理"]}}}',
  '适用于生鲜产品质检',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 2.3 海鲜质检
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '海鲜质检',
  'QUALITY_CHECK',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"扫码或输入批次号"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"liveliness":{"type":"string","title":"鲜活度","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["活蹦乱跳","活力一般","濒死","死亡"],"x-component-props":{"placeholder":"评估鲜活度"}},"smellLevel":{"type":"string","title":"腥味等级","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["正常鲜腥","轻微异味","明显臭味"]},"parasiteCheck":{"type":"string","title":"寄生虫检查","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["未发现","发现少量","发现大量"]},"shellIntegrity":{"type":"string","title":"外壳完整性","x-decorator":"FormItem","x-component":"Select","enum":["完整","轻微破损","严重破损"]},"result":{"type":"string","title":"检验结果","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["合格","不合格","需加工处理"]}}}',
  '适用于海鲜产品质检',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 2.4 微生物检测
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '微生物检测',
  'QUALITY_CHECK',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"扫码或输入批次号"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"sampleId":{"type":"string","title":"样品编号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入样品编号"}},"coliformCount":{"type":"number","title":"大肠杆菌(CFU/g)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"salmonellaResult":{"type":"string","title":"沙门氏菌","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["未检出","检出"]},"totalBacteriaCount":{"type":"number","title":"菌落总数(CFU/g)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"moldCount":{"type":"number","title":"霉菌(CFU/g)","x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"result":{"type":"string","title":"检验结果","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["合格","不合格"]}}}',
  '适用于细菌微生物检测',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 2.5 理化检测
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '理化检测',
  'QUALITY_CHECK',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"扫码或输入批次号"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"sampleId":{"type":"string","title":"样品编号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入样品编号"}},"phValue":{"type":"number","title":"pH值","x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0,"max":14,"precision":2}},"pesticideResidue":{"type":"string","title":"农药残留","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["未检出","低于限量","超标"]},"heavyMetal":{"type":"string","title":"重金属检测","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["未检出","低于限量","超标"]},"additivesCheck":{"type":"string","title":"添加剂检测","x-decorator":"FormItem","x-component":"Select","enum":["合规","超标"]},"result":{"type":"string","title":"检验结果","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["合格","不合格"]}}}',
  '适用于化学指标检测',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- =====================================================
-- 3. 原料录入模板 (MATERIAL_BATCH) - 5个
-- =====================================================

-- 3.1 标准原料入库
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '标准原料入库',
  'MATERIAL_BATCH',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成或手动输入"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"materialType":{"type":"string","title":"原料类型","required":true,"x-decorator":"FormItem","x-component":"Select","x-component-props":{"placeholder":"选择原料类型"}},"supplier":{"type":"string","title":"供应商","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入供应商名称"}},"quantity":{"type":"number","title":"数量","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0,"precision":2}},"unit":{"type":"string","title":"单位","x-decorator":"FormItem","x-component":"Select","enum":["千克","吨","箱","件"]},"receiveDate":{"type":"string","title":"入库日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker","x-component-props":{"placeholder":"选择入库日期"}}}}',
  '适用于通用原料入库',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 3.2 冷链原料入库
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '冷链原料入库',
  'MATERIAL_BATCH',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成或手动输入"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"materialType":{"type":"string","title":"原料类型","required":true,"x-decorator":"FormItem","x-component":"Select","x-component-props":{"placeholder":"选择原料类型"}},"supplier":{"type":"string","title":"供应商","required":true,"x-decorator":"FormItem","x-component":"Input"},"quantity":{"type":"number","title":"数量","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"arrivalTemp":{"type":"number","title":"到货温度(°C)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":-50,"max":50,"precision":1}},"transportDuration":{"type":"number","title":"运输时长(小时)","x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"coldChainIntact":{"type":"string","title":"冷链完整性","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["完整","有断链风险","已断链"]},"receiveDate":{"type":"string","title":"入库日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于需要温控的冷链原料',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 3.3 进口原料入库
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '进口原料入库',
  'MATERIAL_BATCH',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成或手动输入"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"materialType":{"type":"string","title":"原料类型","required":true,"x-decorator":"FormItem","x-component":"Select","x-component-props":{"placeholder":"选择原料类型"}},"originCountry":{"type":"string","title":"原产国","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入原产国"}},"customsNumber":{"type":"string","title":"报关单号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入海关报关单号"}},"quarantineCert":{"type":"string","title":"检疫证号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入检疫证书编号"}},"quantity":{"type":"number","title":"数量","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"receiveDate":{"type":"string","title":"入库日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于进口原料入库',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 3.4 散装原料入库
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '散装原料入库',
  'MATERIAL_BATCH',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成或手动输入"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"materialType":{"type":"string","title":"原料类型","required":true,"x-decorator":"FormItem","x-component":"Select","x-component-props":{"placeholder":"选择原料类型"}},"supplier":{"type":"string","title":"供应商","required":true,"x-decorator":"FormItem","x-component":"Input"},"grossWeight":{"type":"number","title":"毛重(kg)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0,"precision":2}},"tareWeight":{"type":"number","title":"皮重(kg)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0,"precision":2}},"netWeight":{"type":"number","title":"净重(kg)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0,"precision":2}},"moistureRate":{"type":"number","title":"水分率(%)","x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0,"max":100,"precision":1}},"receiveDate":{"type":"string","title":"入库日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于散装称重原料',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 3.5 包装原料入库
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '包装原料入库',
  'MATERIAL_BATCH',
  '{"type":"object","properties":{"batchNumber":{"type":"string","title":"批次号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成或手动输入"},"x-validator":[{"required":true,"message":"请输入批次号"}]},"materialType":{"type":"string","title":"原料类型","required":true,"x-decorator":"FormItem","x-component":"Select","x-component-props":{"placeholder":"选择原料类型"}},"supplier":{"type":"string","title":"供应商","required":true,"x-decorator":"FormItem","x-component":"Input"},"packageSpec":{"type":"string","title":"包装规格","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"如: 500g/袋, 1kg/盒"}},"quantityPerBox":{"type":"number","title":"每箱数量","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":1}},"boxCount":{"type":"number","title":"箱数","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"packageIntact":{"type":"string","title":"包装完好性","required":true,"x-decorator":"FormItem","x-component":"Select","enum":["完好","轻微破损","严重破损"]},"receiveDate":{"type":"string","title":"入库日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于预包装原料',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- =====================================================
-- 4. 出货记录模板 (SHIPMENT) - 5个
-- =====================================================

-- 4.1 标准出货
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '标准出货',
  'SHIPMENT',
  '{"type":"object","properties":{"shipmentNumber":{"type":"string","title":"出货单号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成"},"x-validator":[{"required":true,"message":"请输入出货单号"}]},"customer":{"type":"string","title":"客户名称","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入客户名称"}},"productType":{"type":"string","title":"产品类型","required":true,"x-decorator":"FormItem","x-component":"Select","x-component-props":{"placeholder":"选择产品类型"}},"quantity":{"type":"number","title":"数量","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"unit":{"type":"string","title":"单位","x-decorator":"FormItem","x-component":"Select","enum":["千克","箱","件","托盘"]},"shipDate":{"type":"string","title":"发货日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"},"trackingNumber":{"type":"string","title":"运单号","x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入物流运单号"}}}}',
  '适用于通用出货',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 4.2 冷链出货
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '冷链出货',
  'SHIPMENT',
  '{"type":"object","properties":{"shipmentNumber":{"type":"string","title":"出货单号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成"},"x-validator":[{"required":true,"message":"请输入出货单号"}]},"customer":{"type":"string","title":"客户名称","required":true,"x-decorator":"FormItem","x-component":"Input"},"productType":{"type":"string","title":"产品类型","required":true,"x-decorator":"FormItem","x-component":"Select"},"quantity":{"type":"number","title":"数量","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"outboundTemp":{"type":"number","title":"出库温度(°C)","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":-50,"max":50,"precision":1}},"expectedArrivalTemp":{"type":"number","title":"预计到达温度(°C)","x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":-50,"max":50,"precision":1}},"coldChainVehicle":{"type":"string","title":"冷链车牌号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入冷链车牌号"}},"shipDate":{"type":"string","title":"发货日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于冷链配送出货',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 4.3 批发出货
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '批发出货',
  'SHIPMENT',
  '{"type":"object","properties":{"shipmentNumber":{"type":"string","title":"出货单号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成"},"x-validator":[{"required":true,"message":"请输入出货单号"}]},"customer":{"type":"string","title":"批发商","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入批发商名称"}},"orderQuantity":{"type":"number","title":"订单数量","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"palletCount":{"type":"number","title":"托盘数","required":true,"x-decorator":"FormItem","x-component":"NumberPicker","x-component-props":{"min":0}},"loadingTime":{"type":"string","title":"装车时间","required":true,"x-decorator":"FormItem","x-component":"DatePicker","x-component-props":{"showTime":true}},"vehiclePlate":{"type":"string","title":"车牌号","x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入运输车辆车牌号"}},"driverPhone":{"type":"string","title":"司机电话","x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入司机联系电话"}},"shipDate":{"type":"string","title":"发货日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于大宗批发出货',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 4.4 零售出货
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '零售出货',
  'SHIPMENT',
  '{"type":"object","properties":{"shipmentNumber":{"type":"string","title":"出货单号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成"},"x-validator":[{"required":true,"message":"请输入出货单号"}]},"storeName":{"type":"string","title":"门店名称","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入门店名称"}},"storeAddress":{"type":"string","title":"门店地址","x-decorator":"FormItem","x-component":"Input.TextArea","x-component-props":{"placeholder":"输入门店地址","rows":2}},"skuDetails":{"type":"string","title":"SKU明细","required":true,"x-decorator":"FormItem","x-component":"Input.TextArea","x-component-props":{"placeholder":"输入SKU明细，每行一个","rows":3}},"expectedArrival":{"type":"string","title":"预计到达时间","x-decorator":"FormItem","x-component":"DatePicker","x-component-props":{"showTime":true}},"contactPerson":{"type":"string","title":"收货联系人","x-decorator":"FormItem","x-component":"Input"},"contactPhone":{"type":"string","title":"联系电话","x-decorator":"FormItem","x-component":"Input"},"shipDate":{"type":"string","title":"发货日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于小批量零售配送',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);

-- 4.5 出口出货
INSERT INTO form_templates (id, factory_id, name, entity_type, schema_json, description, version, is_active, source, created_at, updated_at)
VALUES (
  UUID(),
  NULL,
  '出口出货',
  'SHIPMENT',
  '{"type":"object","properties":{"shipmentNumber":{"type":"string","title":"出货单号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"系统自动生成"},"x-validator":[{"required":true,"message":"请输入出货单号"}]},"customer":{"type":"string","title":"国外客户","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入国外客户名称"}},"destinationCountry":{"type":"string","title":"目的国","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入目的国家"}},"containerNumber":{"type":"string","title":"集装箱号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入集装箱编号"}},"customsDeclaration":{"type":"string","title":"报关单号","required":true,"x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入出口报关单号"}},"vesselSchedule":{"type":"string","title":"船期","x-decorator":"FormItem","x-component":"DatePicker","x-component-props":{"placeholder":"选择船期"}},"portOfLoading":{"type":"string","title":"装货港","x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入装货港口"}},"portOfDestination":{"type":"string","title":"目的港","x-decorator":"FormItem","x-component":"Input","x-component-props":{"placeholder":"输入目的港口"}},"shipDate":{"type":"string","title":"发货日期","required":true,"x-decorator":"FormItem","x-component":"DatePicker"}}}',
  '适用于跨境出口出货',
  1,
  true,
  'SYSTEM',
  NOW(),
  NOW()
);
