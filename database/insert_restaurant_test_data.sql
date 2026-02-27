-- ============================================================================
-- Restaurant F002 补充测试数据
-- 目标: 支撑 18 个餐饮意图的全链路 E2E 测试
-- 运行: PGPASSWORD=cretas123 psql -U cretas_user -d cretas_prod_db -h localhost -f insert_restaurant_test_data.sql
-- ============================================================================

-- ── 1. 补充近期 & 今日销售订单 (支撑 DAILY_REVENUE, REVENUE_TREND, ORDER_STATISTICS, PEAK_HOURS_ANALYSIS) ──

-- 今日订单 (多时段, 支撑 PEAK_HOURS_ANALYSIS)
INSERT INTO sales_orders (id, factory_id, order_number, customer_id, order_date, total_amount, status, created_by, created_at, updated_at)
VALUES
  ('F002-SO-T01', 'F002', 'R20260227-001', 'F002-CUS-001', CURRENT_DATE, 286.00, 'COMPLETED', 1325, CURRENT_DATE + interval '11 hours 15 minutes', NOW()),
  ('F002-SO-T02', 'F002', 'R20260227-002', 'F002-CUS-001', CURRENT_DATE, 168.00, 'COMPLETED', 1325, CURRENT_DATE + interval '11 hours 42 minutes', NOW()),
  ('F002-SO-T03', 'F002', 'R20260227-003', 'F002-CUS-002', CURRENT_DATE, 352.00, 'COMPLETED', 1325, CURRENT_DATE + interval '12 hours 10 minutes', NOW()),
  ('F002-SO-T04', 'F002', 'R20260227-004', 'F002-CUS-002', CURRENT_DATE, 198.00, 'COMPLETED', 1325, CURRENT_DATE + interval '12 hours 35 minutes', NOW()),
  ('F002-SO-T05', 'F002', 'R20260227-005', 'F002-CUS-003', CURRENT_DATE, 456.00, 'COMPLETED', 1325, CURRENT_DATE + interval '13 hours 05 minutes', NOW()),
  ('F002-SO-T06', 'F002', 'R20260227-006', 'F002-CUS-001', CURRENT_DATE, 128.00, 'PROCESSING', 1325, CURRENT_DATE + interval '17 hours 30 minutes', NOW()),
  ('F002-SO-T07', 'F002', 'R20260227-007', 'F002-CUS-002', CURRENT_DATE, 520.00, 'COMPLETED', 1325, CURRENT_DATE + interval '18 hours 15 minutes', NOW()),
  ('F002-SO-T08', 'F002', 'R20260227-008', 'F002-CUS-003', CURRENT_DATE, 388.00, 'COMPLETED', 1325, CURRENT_DATE + interval '18 hours 50 minutes', NOW()),
  ('F002-SO-T09', 'F002', 'R20260227-009', 'F002-CUS-001', CURRENT_DATE, 246.00, 'COMPLETED', 1325, CURRENT_DATE + interval '19 hours 20 minutes', NOW()),
  ('F002-SO-T10', 'F002', 'R20260227-010', 'F002-CUS-002', CURRENT_DATE, 312.00, 'COMPLETED', 1325, CURRENT_DATE + interval '19 hours 55 minutes', NOW())
ON CONFLICT (id) DO NOTHING;

-- 今日订单明细 (菜品销量分布) - id uses sequence
INSERT INTO sales_order_items (sales_order_id, product_type_id, product_name, quantity, unit, unit_price, created_at, updated_at)
VALUES
  -- 午市订单
  ('F002-SO-T01', 'F002-PT-001', '宫保鸡丁', 3, '份', 38.00, NOW(), NOW()),
  ('F002-SO-T01', 'F002-PT-009', '蛋炒饭', 4, '份', 18.00, NOW(), NOW()),
  ('F002-SO-T01', 'F002-PT-012', '酸辣汤', 3, '份', 22.00, NOW(), NOW()),
  ('F002-SO-T02', 'F002-PT-003', '红烧肉', 2, '份', 48.00, NOW(), NOW()),
  ('F002-SO-T02', 'F002-PT-006', '凉拌黄瓜', 4, '份', 12.00, NOW(), NOW()),
  ('F002-SO-T02', 'F002-PT-009', '蛋炒饭', 2, '份', 18.00, NOW(), NOW()),
  ('F002-SO-T03', 'F002-PT-005', '糖醋排骨', 3, '份', 48.00, NOW(), NOW()),
  ('F002-SO-T03', 'F002-PT-001', '宫保鸡丁', 4, '份', 38.00, NOW(), NOW()),
  ('F002-SO-T03', 'F002-PT-011', '小笼包', 3, '份', 28.00, NOW(), NOW()),
  ('F002-SO-T04', 'F002-PT-002', '麻婆豆腐', 3, '份', 28.00, NOW(), NOW()),
  ('F002-SO-T04', 'F002-PT-009', '蛋炒饭', 3, '份', 18.00, NOW(), NOW()),
  ('F002-SO-T04', 'F002-PT-014', '芒果布丁', 3, '份', 18.00, NOW(), NOW()),
  ('F002-SO-T05', 'F002-PT-003', '红烧肉', 5, '份', 48.00, NOW(), NOW()),
  ('F002-SO-T05', 'F002-PT-004', '鱼香肉丝', 4, '份', 32.00, NOW(), NOW()),
  ('F002-SO-T05', 'F002-PT-010', '扬州炒饭', 3, '份', 22.00, NOW(), NOW()),
  -- 晚市订单
  ('F002-SO-T06', 'F002-PT-006', '凉拌黄瓜', 2, '份', 12.00, NOW(), NOW()),
  ('F002-SO-T06', 'F002-PT-008', '皮蛋豆腐', 3, '份', 18.00, NOW(), NOW()),
  ('F002-SO-T06', 'F002-PT-015', '红豆沙', 2, '份', 14.00, NOW(), NOW()),
  ('F002-SO-T07', 'F002-PT-001', '宫保鸡丁', 5, '份', 38.00, NOW(), NOW()),
  ('F002-SO-T07', 'F002-PT-005', '糖醋排骨', 4, '份', 48.00, NOW(), NOW()),
  ('F002-SO-T07', 'F002-PT-013', '西湖牛肉羹', 3, '份', 26.00, NOW(), NOW()),
  ('F002-SO-T08', 'F002-PT-003', '红烧肉', 4, '份', 48.00, NOW(), NOW()),
  ('F002-SO-T08', 'F002-PT-002', '麻婆豆腐', 3, '份', 28.00, NOW(), NOW()),
  ('F002-SO-T08', 'F002-PT-007', '口水鸡', 3, '份', 28.00, NOW(), NOW()),
  ('F002-SO-T09', 'F002-PT-004', '鱼香肉丝', 3, '份', 32.00, NOW(), NOW()),
  ('F002-SO-T09', 'F002-PT-009', '蛋炒饭', 5, '份', 18.00, NOW(), NOW()),
  ('F002-SO-T09', 'F002-PT-012', '酸辣汤', 3, '份', 22.00, NOW(), NOW()),
  ('F002-SO-T10', 'F002-PT-001', '宫保鸡丁', 3, '份', 38.00, NOW(), NOW()),
  ('F002-SO-T10', 'F002-PT-005', '糖醋排骨', 2, '份', 48.00, NOW(), NOW()),
  ('F002-SO-T10', 'F002-PT-011', '小笼包', 4, '份', 28.00, NOW(), NOW());

-- 近7天补充订单 (支撑 REVENUE_TREND)
INSERT INTO sales_orders (id, factory_id, order_number, customer_id, order_date, total_amount, status, created_by, created_at, updated_at)
VALUES
  ('F002-SO-W01', 'F002', 'R20260226-001', 'F002-CUS-001', CURRENT_DATE - 1, 1850.00, 'COMPLETED', 1325, (CURRENT_DATE - 1) + interval '12 hours', NOW()),
  ('F002-SO-W02', 'F002', 'R20260226-002', 'F002-CUS-002', CURRENT_DATE - 1, 2200.00, 'COMPLETED', 1325, (CURRENT_DATE - 1) + interval '18 hours', NOW()),
  ('F002-SO-W03', 'F002', 'R20260225-001', 'F002-CUS-001', CURRENT_DATE - 2, 1680.00, 'COMPLETED', 1325, (CURRENT_DATE - 2) + interval '12 hours', NOW()),
  ('F002-SO-W04', 'F002', 'R20260225-002', 'F002-CUS-003', CURRENT_DATE - 2, 2450.00, 'COMPLETED', 1325, (CURRENT_DATE - 2) + interval '19 hours', NOW()),
  ('F002-SO-W05', 'F002', 'R20260224-001', 'F002-CUS-002', CURRENT_DATE - 3, 1920.00, 'COMPLETED', 1325, (CURRENT_DATE - 3) + interval '12 hours', NOW()),
  ('F002-SO-W06', 'F002', 'R20260224-002', 'F002-CUS-001', CURRENT_DATE - 3, 2100.00, 'COMPLETED', 1325, (CURRENT_DATE - 3) + interval '18 hours', NOW()),
  ('F002-SO-W07', 'F002', 'R20260223-001', 'F002-CUS-003', CURRENT_DATE - 4, 1560.00, 'COMPLETED', 1325, (CURRENT_DATE - 4) + interval '12 hours', NOW()),
  ('F002-SO-W08', 'F002', 'R20260223-002', 'F002-CUS-001', CURRENT_DATE - 4, 1980.00, 'COMPLETED', 1325, (CURRENT_DATE - 4) + interval '18 hours', NOW()),
  ('F002-SO-W09', 'F002', 'R20260222-001', 'F002-CUS-002', CURRENT_DATE - 5, 2080.00, 'COMPLETED', 1325, (CURRENT_DATE - 5) + interval '12 hours', NOW()),
  ('F002-SO-W10', 'F002', 'R20260222-002', 'F002-CUS-003', CURRENT_DATE - 5, 2350.00, 'COMPLETED', 1325, (CURRENT_DATE - 5) + interval '19 hours', NOW()),
  ('F002-SO-W11', 'F002', 'R20260221-001', 'F002-CUS-001', CURRENT_DATE - 6, 1750.00, 'COMPLETED', 1325, (CURRENT_DATE - 6) + interval '11 hours', NOW()),
  ('F002-SO-W12', 'F002', 'R20260221-002', 'F002-CUS-002', CURRENT_DATE - 6, 2600.00, 'COMPLETED', 1325, (CURRENT_DATE - 6) + interval '19 hours', NOW())
ON CONFLICT (id) DO NOTHING;

-- 近7天订单明细
INSERT INTO sales_order_items (sales_order_id, product_type_id, product_name, quantity, unit, unit_price, created_at, updated_at)
VALUES
  ('F002-SO-W01', 'F002-PT-001', '宫保鸡丁', 15, '份', 38.00, NOW(), NOW()),
  ('F002-SO-W01', 'F002-PT-003', '红烧肉', 12, '份', 48.00, NOW(), NOW()),
  ('F002-SO-W01', 'F002-PT-009', '蛋炒饭', 20, '份', 18.00, NOW(), NOW()),
  ('F002-SO-W02', 'F002-PT-005', '糖醋排骨', 15, '份', 48.00, NOW(), NOW()),
  ('F002-SO-W02', 'F002-PT-004', '鱼香肉丝', 18, '份', 32.00, NOW(), NOW()),
  ('F002-SO-W02', 'F002-PT-002', '麻婆豆腐', 12, '份', 28.00, NOW(), NOW()),
  ('F002-SO-W03', 'F002-PT-001', '宫保鸡丁', 10, '份', 38.00, NOW(), NOW()),
  ('F002-SO-W03', 'F002-PT-011', '小笼包', 15, '份', 28.00, NOW(), NOW()),
  ('F002-SO-W04', 'F002-PT-003', '红烧肉', 20, '份', 48.00, NOW(), NOW()),
  ('F002-SO-W04', 'F002-PT-010', '扬州炒饭', 15, '份', 22.00, NOW(), NOW()),
  ('F002-SO-W05', 'F002-PT-005', '糖醋排骨', 12, '份', 48.00, NOW(), NOW()),
  ('F002-SO-W05', 'F002-PT-006', '凉拌黄瓜', 20, '份', 12.00, NOW(), NOW()),
  ('F002-SO-W06', 'F002-PT-001', '宫保鸡丁', 18, '份', 38.00, NOW(), NOW()),
  ('F002-SO-W06', 'F002-PT-012', '酸辣汤', 15, '份', 22.00, NOW(), NOW()),
  ('F002-SO-W07', 'F002-PT-003', '红烧肉', 10, '份', 48.00, NOW(), NOW()),
  ('F002-SO-W07', 'F002-PT-002', '麻婆豆腐', 15, '份', 28.00, NOW(), NOW()),
  ('F002-SO-W08', 'F002-PT-004', '鱼香肉丝', 14, '份', 32.00, NOW(), NOW()),
  ('F002-SO-W08', 'F002-PT-013', '西湖牛肉羹', 15, '份', 26.00, NOW(), NOW()),
  ('F002-SO-W09', 'F002-PT-001', '宫保鸡丁', 20, '份', 38.00, NOW(), NOW()),
  ('F002-SO-W09', 'F002-PT-005', '糖醋排骨', 10, '份', 48.00, NOW(), NOW()),
  ('F002-SO-W10', 'F002-PT-003', '红烧肉', 18, '份', 48.00, NOW(), NOW()),
  ('F002-SO-W10', 'F002-PT-007', '口水鸡', 15, '份', 28.00, NOW(), NOW()),
  ('F002-SO-W11', 'F002-PT-009', '蛋炒饭', 25, '份', 18.00, NOW(), NOW()),
  ('F002-SO-W11', 'F002-PT-011', '小笼包', 20, '份', 28.00, NOW(), NOW()),
  ('F002-SO-W12', 'F002-PT-001', '宫保鸡丁', 25, '份', 38.00, NOW(), NOW()),
  ('F002-SO-W12', 'F002-PT-005', '糖醋排骨', 18, '份', 48.00, NOW(), NOW());

-- ── 2. 补充临期食材批次 (支撑 INGREDIENT_EXPIRY_ALERT) ──

INSERT INTO material_batches (id, factory_id, batch_number, material_type_id, receipt_quantity, used_quantity, reserved_quantity, quantity_unit, expire_date, status, storage_location, created_by, inbound_date, created_at, updated_at)
VALUES
  -- 3天后过期
  ('F002-MB-E01', 'F002', 'EXPR-001', (SELECT id FROM raw_material_types WHERE factory_id='F002' AND name='鸡胸肉' LIMIT 1),
   15.00, 5.00, 0, 'kg', CURRENT_DATE + 3, 'AVAILABLE', '冷藏库A', 1325, CURRENT_DATE - 10, NOW(), NOW()),
  -- 5天后过期
  ('F002-MB-E02', 'F002', 'EXPR-002', (SELECT id FROM raw_material_types WHERE factory_id='F002' AND name='鲜奶' LIMIT 1),
   8.00, 2.00, 0, 'L', CURRENT_DATE + 5, 'AVAILABLE', '冷藏库B', 1325, CURRENT_DATE - 5, NOW(), NOW()),
  -- 2天后过期
  ('F002-MB-E03', 'F002', 'EXPR-003', (SELECT id FROM raw_material_types WHERE factory_id='F002' AND name='豆腐' LIMIT 1),
   10.00, 3.00, 0, 'kg', CURRENT_DATE + 2, 'AVAILABLE', '冷藏库A', 1325, CURRENT_DATE - 7, NOW(), NOW()),
  -- 1天后过期 (紧急)
  ('F002-MB-E04', 'F002', 'EXPR-004', (SELECT id FROM raw_material_types WHERE factory_id='F002' AND name='黄瓜' LIMIT 1),
   12.00, 1.00, 0, 'kg', CURRENT_DATE + 1, 'AVAILABLE', '蔬菜区', 1325, CURRENT_DATE - 4, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 3. 补充低库存食材 (支撑 INGREDIENT_LOW_STOCK) ──
-- 猪里脊已经是低库存 (receipt=15, used=13.5, remaining=1.5, min=3)
-- 再添加一条低库存
INSERT INTO material_batches (id, factory_id, batch_number, material_type_id, receipt_quantity, used_quantity, reserved_quantity, quantity_unit, expire_date, status, storage_location, created_by, inbound_date, created_at, updated_at)
VALUES
  ('F002-MB-L01', 'F002', 'LOW-001', (SELECT id FROM raw_material_types WHERE factory_id='F002' AND name='排骨' LIMIT 1),
   10.00, 9.50, 0, 'kg', CURRENT_DATE + 30, 'AVAILABLE', '冷冻库', 1325, CURRENT_DATE - 15, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 4. 验证数据 ──
DO $$
DECLARE
  v_orders bigint;
  v_items bigint;
  v_batches bigint;
  v_expiring bigint;
  v_today_orders bigint;
BEGIN
  SELECT COUNT(*) INTO v_orders FROM sales_orders WHERE factory_id = 'F002';
  SELECT COUNT(*) INTO v_items FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.factory_id = 'F002';
  SELECT COUNT(*) INTO v_batches FROM material_batches WHERE factory_id = 'F002';
  SELECT COUNT(*) INTO v_expiring FROM material_batches WHERE factory_id = 'F002' AND expire_date IS NOT NULL AND expire_date BETWEEN NOW() AND NOW() + interval '7 days';
  SELECT COUNT(*) INTO v_today_orders FROM sales_orders WHERE factory_id = 'F002' AND order_date = CURRENT_DATE;

  RAISE NOTICE '=== F002 数据验证 ===';
  RAISE NOTICE '销售订单: % (目标 ≥ 27)', v_orders;
  RAISE NOTICE '订单明细: % (目标 ≥ 70)', v_items;
  RAISE NOTICE '食材批次: % (目标 ≥ 15)', v_batches;
  RAISE NOTICE '临期批次(7天内): % (目标 ≥ 3)', v_expiring;
  RAISE NOTICE '今日订单: % (目标 ≥ 10)', v_today_orders;
END $$;
