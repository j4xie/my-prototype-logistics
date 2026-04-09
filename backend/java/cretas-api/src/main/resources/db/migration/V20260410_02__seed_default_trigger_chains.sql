-- V20260410_02__seed_default_trigger_chains.sql
-- Seed global default trigger chains from SupplyChainOrchestrator logic

-- Chain 1: SO Finance Approved → inventory check → reserve/plan
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'SO_FINANCE_APPROVED', 'SalesOrderFinanceApprovedEvent', true,
'[{"order":1,"tool":"inventory_check_stock","condition":"always","enabled":true,"params":{}},{"order":2,"tool":"inventory_reserve_stock","condition":"step1.success == true","enabled":true,"params":{}},{"order":3,"tool":"production_plan_create","condition":"step1.success == false","enabled":true,"params":{"source":"SO_AUTO"}},{"order":4,"tool":"purchase_suggestion_create","condition":"step1.success == false","enabled":true,"params":{}}]'::jsonb,
'CONTINUE', '销售订单财务审批后: 检查库存→预留/自动排产+采购建议')
ON CONFLICT (factory_id, chain_code) DO NOTHING;

-- Chain 2: Batch Completed → consume materials → create FG → create QI
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'BATCH_COMPLETED', 'BatchCompletedEvent', true,
'[{"order":1,"tool":"material_batch_consume","condition":"always","enabled":true,"params":{"mode":"auto"}},{"order":2,"tool":"finished_goods_create","condition":"always","enabled":true,"params":{}},{"order":3,"tool":"quality_inspection_create","condition":"always","enabled":true,"params":{"status":"PENDING"}}]'::jsonb,
'CONTINUE', '生产批次完成: 自动扣料→建成品批次→建质检任务')
ON CONFLICT (factory_id, chain_code) DO NOTHING;

-- Chain 3: Material Received → recheck PP availability
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'MATERIAL_RECEIVED', 'MaterialReceivedEvent', true,
'[{"order":1,"tool":"production_plan_recheck_material","condition":"always","enabled":true,"params":{}}]'::jsonb,
'CONTINUE', '原料到货: 重新检查排产计划物料齐套')
ON CONFLICT (factory_id, chain_code) DO NOTHING;

-- Chain 4: SO Confirmed → log only (actual orchestration on finance approval)
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'SO_CONFIRMED', 'SalesOrderConfirmedEvent', true,
'[]'::jsonb,
'CONTINUE', '销售订单确认: 仅记录日志 (等待财务审批后触发编排)')
ON CONFLICT (factory_id, chain_code) DO NOTHING;
