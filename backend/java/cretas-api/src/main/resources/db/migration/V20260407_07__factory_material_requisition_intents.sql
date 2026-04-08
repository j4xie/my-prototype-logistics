-- P0-5 Factory Material Requisition AI Intent bindings (W2-3b)
-- 3 tools: factory_material_requisition_generate/query_pending/close
-- 客户原话锚点: 会议 3124-3252s

INSERT INTO ai_intent_config (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level)
VALUES
  (gen_random_uuid(), 'FACTORY_MR_GENERATE', '生成物料需求单', 'DATA_OPERATION',
   'factory_material_requisition_generate',
   '["生成备料单","按BOM备料","排产备料","物料需求单","生成物料需求单","按计划备料","按生产计划生成备料单"]',
   true, 'MEDIUM'),
  (gen_random_uuid(), 'FACTORY_MR_QUERY_PENDING', '待备料查询', 'DATA_QUERY',
   'factory_material_requisition_query_pending',
   '["待备料","今天要备的料","物料需求单列表","备料中","备料单查询","有哪些要备的料","查看物料需求单"]',
   true, 'LOW'),
  (gen_random_uuid(), 'FACTORY_MR_CLOSE', '物料需求单关单', 'DATA_OPERATION',
   'factory_material_requisition_close',
   '["关闭MR","物料需求单关单","生产退料","关单物料需求单","备料单关单","生产完退料"]',
   true, 'MEDIUM')
ON CONFLICT DO NOTHING;
