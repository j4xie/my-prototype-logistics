-- Apr 8 session 新功能 AI 意图绑定
-- 对应功能: P0-12/13/14/15/17 + B8 + C4 + G1
-- 说明: tool_name 暂设 NULL, LLM fallback 通过 keywords 匹配; B8 预留 tool 名以便后续接入

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level, created_at, updated_at)
VALUES
  -- P0-12 生产计划关联销售订单行
  (gen_random_uuid(), 'PLAN_FROM_SALES_ORDER_ITEM', '按销售订单行建生产计划', 'DATA_OPERATION',
   NULL,
   '["按销售订单行建计划","按订单产品排产","选SO产品下计划","关联销售订单产品","订单行生产任务"]',
   true, 'MEDIUM', NOW(), NOW()),

  -- P0-13 发货批次强制
  (gen_random_uuid(), 'SALES_DELIVERY_BATCH_ALLOCATE', '发货批次分配', 'DATA_OPERATION',
   NULL,
   '["分配发货批次","发货选批次","批次分配","同产品多批次出库","SKU批次拆分"]',
   true, 'MEDIUM', NOW(), NOW()),

  -- P0-14 BOM 三分类
  (gen_random_uuid(), 'BOM_CATEGORY_FILTER', 'BOM 按原辅料包材筛选', 'DATA_QUERY',
   NULL,
   '["BOM原料","BOM辅料","BOM包材","查原料BOM","原辅料包材分组","3块BOM"]',
   true, 'LOW', NOW(), NOW()),

  -- P0-15 报工模式
  (gen_random_uuid(), 'WORK_REPORT_MODE_QUERY', '报工模式查询', 'DATA_QUERY',
   NULL,
   '["报工模式","按工序报工","按批次报工","按人头报工","mode_1","mode_2","mode_3"]',
   true, 'LOW', NOW(), NOW()),

  -- P0-17 盘盈入库
  (gen_random_uuid(), 'INVENTORY_GAIN_INBOUND', '盘盈入库', 'DATA_OPERATION',
   NULL,
   '["盘盈入库","盘点盘盈","多出来的库存","库存盘盈"]',
   true, 'MEDIUM', NOW(), NOW()),

  -- P0-17 赠品入库
  (gen_random_uuid(), 'FREE_GIFT_INBOUND', '赠品入库', 'DATA_OPERATION',
   NULL,
   '["赠品入库","货赠入库","供应商送的","免费赠送"]',
   true, 'MEDIUM', NOW(), NOW()),

  -- B8 生产进度看板
  (gen_random_uuid(), 'PRODUCTION_PROGRESS_DASHBOARD', '生产进度看板查询', 'DATA_QUERY',
   'production_progress_dashboard',
   '["生产进度","数字看板","打屏","当天生产进度","看板","工序进度"]',
   true, 'LOW', NOW(), NOW()),

  -- C4 周转耗材
  (gen_random_uuid(), 'REUSABLE_CONTAINER_QUERY', '周转耗材查询', 'DATA_QUERY',
   NULL,
   '["周转框","周转耗材","客户租用框","周转筐","容器管理","在用多少框"]',
   true, 'LOW', NOW(), NOW()),

  (gen_random_uuid(), 'REUSABLE_CONTAINER_SHIP_OUT', '周转框发出', 'DATA_OPERATION',
   NULL,
   '["发出周转框","周转框发客户","随货带框","框跟货走"]',
   true, 'MEDIUM', NOW(), NOW()),

  (gen_random_uuid(), 'REUSABLE_CONTAINER_RETURN', '周转框归还', 'DATA_OPERATION',
   NULL,
   '["周转框归还","客户还框","框回来了","回收周转框"]',
   true, 'MEDIUM', NOW(), NOW()),

  (gen_random_uuid(), 'REUSABLE_CONTAINER_LOSS', '周转框丢失赔偿', 'DATA_OPERATION',
   NULL,
   '["周转框丢了","客户赔钱","框报损","赔偿周转框"]',
   true, 'MEDIUM', NOW(), NOW()),

  -- G1 税率分组开票
  (gen_random_uuid(), 'TAX_GROUP_INVOICE', '税率分组开票', 'DATA_OPERATION',
   NULL,
   '["税率分组开票","9个点13个点","原料加工费开票","分税率开票","一键生成多张发票"]',
   true, 'MEDIUM', NOW(), NOW())

ON CONFLICT (intent_code) DO NOTHING;
