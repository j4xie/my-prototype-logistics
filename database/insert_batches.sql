-- Insert production batches directly
INSERT INTO production_batches (factory_id, batch_number, product_type_id, product_name, quantity, unit, planned_quantity, actual_quantity, good_quantity, defect_quantity,
  material_cost, labor_cost, equipment_cost, other_cost, total_cost, unit_cost, yield_rate, efficiency,
  status, quality_status, start_time, end_time, supervisor_id, supervisor_name, worker_count, work_duration_minutes, created_by, created_at, updated_at)
VALUES
  ('F001', 'PB-20260106-001', 'PT-F001-001', '带鱼段精品A', 500.00, 'kg', 500.00, 485.00, 472.00, 13.00, 9215.00, 3250.00, 1550.00, 850.00, 14865.00, 31.49, 97.32, 92.50, 'COMPLETED', 'QUALIFIED', '2026-01-06 08:00:00', '2026-01-06 17:30:00', 1, '工厂主管', 8, 570, 1, '2026-01-06 08:00:00', '2026-01-06 17:30:00'),
  ('F001', 'PB-20260107-001', 'PT-F001-002', '黄鱼片标准', 300.00, 'kg', 300.00, 288.00, 280.00, 8.00, 7920.00, 2100.00, 980.00, 520.00, 11520.00, 41.14, 97.22, 91.80, 'COMPLETED', 'QUALIFIED', '2026-01-07 08:00:00', '2026-01-07 16:00:00', 1, '工厂主管', 6, 480, 1, '2026-01-07 08:00:00', '2026-01-07 16:00:00'),
  ('F001', 'PB-20260108-001', 'PT-F001-003', '墨鱼圈裹粉', 400.00, 'kg', 400.00, 392.00, 385.00, 7.00, 7056.00, 2800.00, 1320.00, 680.00, 11856.00, 30.79, 98.21, 94.00, 'COMPLETED', 'QUALIFIED', '2026-01-08 08:00:00', '2026-01-08 17:00:00', 1, '工厂主管', 7, 540, 1, '2026-01-08 08:00:00', '2026-01-08 17:00:00'),
  ('F001', 'PB-20260109-001', 'PT-F001-004', '大虾仁精选', 200.00, 'kg', 200.00, 190.00, 186.00, 4.00, 6840.00, 1400.00, 680.00, 380.00, 9300.00, 50.00, 97.89, 90.50, 'COMPLETED', 'QUALIFIED', '2026-01-09 08:00:00', '2026-01-09 15:30:00', 1, '工厂主管', 5, 450, 1, '2026-01-09 08:00:00', '2026-01-09 15:30:00'),
  ('F001', 'PB-20260110-001', 'PT-F001-001', '带鱼段标准B', 600.00, 'kg', 600.00, 582.00, 568.00, 14.00, 10764.00, 3900.00, 1860.00, 1020.00, 17544.00, 30.89, 97.59, 93.00, 'COMPLETED', 'QUALIFIED', '2026-01-10 08:00:00', '2026-01-10 18:00:00', 1, '工厂主管', 9, 600, 1, '2026-01-10 08:00:00', '2026-01-10 18:00:00'),
  ('F001', 'PB-20260113-001', 'PT-F001-002', '黄鱼片出口级', 350.00, 'kg', 350.00, 336.00, 328.00, 8.00, 9408.00, 2450.00, 1120.00, 630.00, 13608.00, 41.49, 97.62, 92.00, 'COMPLETED', 'QUALIFIED', '2026-01-13 08:00:00', '2026-01-13 17:00:00', 1, '工厂主管', 7, 540, 1, '2026-01-13 08:00:00', '2026-01-13 17:00:00'),
  ('F001', 'PB-20260114-001', 'PT-F001-003', '墨鱼圈小包装', 250.00, 'kg', 250.00, 243.00, 238.00, 5.00, 4374.00, 1750.00, 825.00, 425.00, 7374.00, 30.98, 97.94, 93.20, 'COMPLETED', 'QUALIFIED', '2026-01-14 08:00:00', '2026-01-14 16:00:00', 1, '工厂主管', 5, 480, 1, '2026-01-14 08:00:00', '2026-01-14 16:00:00'),
  ('F001', 'PB-20260115-001', 'PT-F001-001', '带鱼段C', 550.00, 'kg', 550.00, 530.00, 518.00, 12.00, 9805.00, 3575.00, 1705.00, 935.00, 16020.00, 30.93, 97.74, 92.70, 'COMPLETED', 'QUALIFIED', '2026-01-15 08:00:00', '2026-01-15 17:30:00', 1, '工厂主管', 8, 570, 1, '2026-01-15 08:00:00', '2026-01-15 17:30:00'),
  ('F001', 'PB-20260116-001', 'PT-F001-004', '虾仁甄选', 180.00, 'kg', 180.00, 172.00, 168.00, 4.00, 6192.00, 1260.00, 610.00, 340.00, 8402.00, 50.01, 97.67, 91.00, 'COMPLETED', 'QUALIFIED', '2026-01-16 08:00:00', '2026-01-16 15:00:00', 1, '工厂主管', 5, 420, 1, '2026-01-16 08:00:00', '2026-01-16 15:00:00'),
  ('F001', 'PB-20260117-001', 'PT-F001-002', '黄鱼片家庭装', 280.00, 'kg', 280.00, 270.00, 264.00, 6.00, 7560.00, 1960.00, 910.00, 480.00, 10910.00, 41.33, 97.78, 92.50, 'COMPLETED', 'QUALIFIED', '2026-01-17 08:00:00', '2026-01-17 16:30:00', 1, '工厂主管', 6, 510, 1, '2026-01-17 08:00:00', '2026-01-17 16:30:00'),
  ('F001', 'PB-20260120-001', 'PT-F001-001', '带鱼段促销版', 700.00, 'kg', 700.00, 672.00, 648.00, 24.00, 13440.00, 4900.00, 2380.00, 1280.00, 22000.00, 33.95, 96.43, 88.50, 'COMPLETED', 'NEEDS_REVIEW', '2026-01-20 07:30:00', '2026-01-20 19:00:00', 1, '工厂主管', 10, 690, 1, '2026-01-20 07:30:00', '2026-01-20 19:00:00'),
  ('F001', 'PB-20260121-001', 'PT-F001-003', '墨鱼圈大包', 450.00, 'kg', 450.00, 441.00, 432.00, 9.00, 7938.00, 3150.00, 1485.00, 765.00, 13338.00, 30.88, 97.96, 94.20, 'COMPLETED', 'QUALIFIED', '2026-01-21 08:00:00', '2026-01-21 17:30:00', 1, '工厂主管', 8, 570, 1, '2026-01-21 08:00:00', '2026-01-21 17:30:00'),
  ('F001', 'PB-20260122-001', 'PT-F001-004', '虾仁高端线', 150.00, 'kg', 150.00, 140.00, 135.00, 5.00, 5600.00, 1050.00, 520.00, 310.00, 7480.00, 55.41, 96.43, 87.50, 'COMPLETED', 'NEEDS_REVIEW', '2026-01-22 08:00:00', '2026-01-22 15:00:00', 1, '工厂主管', 4, 420, 1, '2026-01-22 08:00:00', '2026-01-22 15:00:00'),
  ('F001', 'PB-20260127-001', 'PT-F001-001', '带鱼段春节特供', 800.00, 'kg', 800.00, 780.00, 764.00, 16.00, 14820.00, 5200.00, 2480.00, 1360.00, 23860.00, 31.23, 97.95, 93.50, 'COMPLETED', 'QUALIFIED', '2026-01-27 07:00:00', '2026-01-27 19:30:00', 1, '工厂主管', 12, 750, 1, '2026-01-27 07:00:00', '2026-01-27 19:30:00'),
  ('F001', 'PB-20260128-001', 'PT-F001-002', '黄鱼片节日装', 400.00, 'kg', 400.00, 388.00, 380.00, 8.00, 10852.00, 2800.00, 1300.00, 700.00, 15652.00, 41.19, 97.94, 93.00, 'COMPLETED', 'QUALIFIED', '2026-01-28 08:00:00', '2026-01-28 17:00:00', 1, '工厂主管', 7, 540, 1, '2026-01-28 08:00:00', '2026-01-28 17:00:00'),
  ('F001', 'PB-20260203-001', 'PT-F001-001', '带鱼段经典', 450.00, 'kg', 450.00, 438.00, 428.00, 10.00, 8103.00, 2925.00, 1395.00, 765.00, 13188.00, 30.81, 97.72, 93.80, 'COMPLETED', 'QUALIFIED', '2026-02-03 08:00:00', '2026-02-03 17:00:00', 1, '工厂主管', 7, 540, 1, '2026-02-03 08:00:00', '2026-02-03 17:00:00'),
  ('F001', 'PB-20260204-001', 'PT-F001-002', '黄鱼片超值', 320.00, 'kg', 320.00, 310.00, 304.00, 6.00, 8680.00, 2240.00, 1040.00, 560.00, 12520.00, 41.18, 98.06, 93.50, 'COMPLETED', 'QUALIFIED', '2026-02-04 08:00:00', '2026-02-04 16:30:00', 1, '工厂主管', 6, 510, 1, '2026-02-04 08:00:00', '2026-02-04 16:30:00'),
  ('F001', 'PB-20260205-001', 'PT-F001-003', '墨鱼圈新品', 350.00, 'kg', 350.00, 340.00, 334.00, 6.00, 6120.00, 2450.00, 1155.00, 595.00, 10320.00, 30.90, 98.24, 94.50, 'COMPLETED', 'QUALIFIED', '2026-02-05 08:00:00', '2026-02-05 17:00:00', 1, '工厂主管', 6, 540, 1, '2026-02-05 08:00:00', '2026-02-05 17:00:00'),
  ('F001', 'PB-20260206-001', 'PT-F001-004', '虾仁精品', 220.00, 'kg', 220.00, 210.00, 205.00, 5.00, 7560.00, 1540.00, 748.00, 418.00, 10266.00, 50.08, 97.62, 91.50, 'COMPLETED', 'QUALIFIED', '2026-02-06 08:00:00', '2026-02-06 15:30:00', 1, '工厂主管', 5, 450, 1, '2026-02-06 08:00:00', '2026-02-06 15:30:00'),
  ('F001', 'PB-20260207-001', 'PT-F001-001', '带鱼段精加工', 520.00, 'kg', 520.00, 505.00, 494.00, 11.00, 9595.00, 3380.00, 1612.00, 884.00, 15471.00, 31.32, 97.82, 93.20, 'COMPLETED', 'QUALIFIED', '2026-02-07 08:00:00', '2026-02-07 17:30:00', 1, '工厂主管', 8, 570, 1, '2026-02-07 08:00:00', '2026-02-07 17:30:00'),
  ('F001', 'PB-20260208-001', 'PT-F001-002', '黄鱼片新批次', 380.00, 'kg', 380.00, 200.00, 196.00, 4.00, 5600.00, 1400.00, 650.00, 350.00, 8000.00, 40.82, 98.00, 0.00, 'PRODUCING', NULL, '2026-02-08 08:00:00', NULL, 1, '工厂主管', 7, NULL, 1, '2026-02-08 08:00:00', '2026-02-08 12:00:00'),
  ('F001', 'PB-20260209-001', 'PT-F001-003', '墨鱼圈急单', 300.00, 'kg', 300.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 'PLANNED', NULL, NULL, NULL, 1, '工厂主管', 0, NULL, 1, '2026-02-09 06:00:00', '2026-02-09 06:00:00');

-- Quality inspections for new batches
DO $$
DECLARE
  v_batch RECORD; v_pass_count NUMERIC; v_fail_count NUMERIC; v_sample NUMERIC;
BEGIN
  FOR v_batch IN SELECT id, batch_number, actual_quantity, created_at FROM production_batches WHERE factory_id='F001' AND batch_number LIKE 'PB-20260%' AND status='COMPLETED'
  LOOP
    v_sample := GREATEST(v_batch.actual_quantity * 0.1, 20);
    v_pass_count := v_sample * (0.90 + random() * 0.09);
    v_fail_count := v_sample - v_pass_count;
    INSERT INTO quality_inspections (id, factory_id, production_batch_id, inspection_date, sample_size, pass_count, fail_count, pass_rate, result, inspector_id, notes, created_at, updated_at)
    VALUES (gen_random_uuid()::varchar, 'F001', v_batch.id, v_batch.created_at::date, v_sample, v_pass_count, v_fail_count, (v_pass_count/v_sample*100)::numeric(5,2), CASE WHEN (v_pass_count/v_sample)>0.95 THEN 'PASS' ELSE 'FAIL' END, 1, v_batch.batch_number, v_batch.created_at+interval '8 hours', v_batch.created_at+interval '8 hours');
  END LOOP;
END $$;

-- Material consumptions for new batches
DO $$
DECLARE v_batch RECORD; v_mb_id VARCHAR;
BEGIN
  SELECT id INTO v_mb_id FROM material_batches WHERE factory_id='F001' LIMIT 1;
  IF v_mb_id IS NOT NULL THEN
    FOR v_batch IN SELECT id, material_cost, quantity, created_at FROM production_batches WHERE factory_id='F001' AND batch_number LIKE 'PB-20260%' AND status='COMPLETED' AND material_cost>0
    LOOP
      INSERT INTO material_consumptions (factory_id, batch_id, production_batch_id, quantity, unit_price, total_cost, consumption_time, recorded_by, created_at, updated_at)
      VALUES ('F001', v_mb_id, v_batch.id, v_batch.quantity*1.15, (v_batch.material_cost/(v_batch.quantity*1.15))::numeric(10,2), v_batch.material_cost, v_batch.created_at+interval '2 hours', 1, v_batch.created_at+interval '2 hours', v_batch.created_at+interval '2 hours');
    END LOOP;
  END IF;
END $$;

-- Processing stages for new batches
DO $$
DECLARE
  v_batch RECORD; v_idx INT;
  v_names TEXT[] := ARRAY['原料准备','解冻处理','分拣清洗','切割加工','调味腌制','速冻','包装','质检入库'];
  v_types TEXT[] := ARRAY['PREPARATION','THAWING','SORTING','CUTTING','SEASONING','FREEZING','PACKAGING','INSPECTION'];
BEGIN
  FOR v_batch IN SELECT id, start_time FROM production_batches WHERE factory_id='F001' AND batch_number LIKE 'PB-20260%' AND status='COMPLETED' AND start_time IS NOT NULL LIMIT 10
  LOOP
    FOR v_idx IN 1..8 LOOP
      INSERT INTO processing_stage_records (factory_id, production_batch_id, stage_name, stage_type, stage_order, start_time, end_time, operator_id, operator_name, input_weight, output_weight, loss_rate, pass_rate, worker_count, duration_minutes, created_at, updated_at)
      VALUES ('F001', v_batch.id, v_names[v_idx], v_types[v_idx], v_idx, v_batch.start_time+(v_idx-1)*interval '1 hour', v_batch.start_time+v_idx*interval '1 hour', 1, 'factory_admin1', 500.0-(v_idx*5), 500.0-(v_idx*8), (v_idx*0.6)::numeric(5,2), (98-v_idx*0.3)::numeric(5,2), 3+(v_idx%3), 60, v_batch.start_time+(v_idx-1)*interval '1 hour', v_batch.start_time+v_idx*interval '1 hour');
    END LOOP;
  END LOOP;
END $$;

-- Equipment alerts
DO $$
DECLARE v_equip RECORD;
BEGIN
  FOR v_equip IN SELECT id, equipment_name FROM factory_equipment WHERE factory_id='F001' LIMIT 8
  LOOP
    INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, message, status, triggered_at, created_at, updated_at)
    VALUES ('F001', v_equip.id, (ARRAY['TEMPERATURE_HIGH','MAINTENANCE_DUE','PERFORMANCE_LOW'])[1+(random()*2)::int], (ARRAY['WARNING','CRITICAL','INFO'])[1+(random()*2)::int], v_equip.equipment_name, (ARRAY['ACTIVE','ACKNOWLEDGED','RESOLVED'])[1+(random()*2)::int], NOW()-((random()*7)::int)*interval '1 day', NOW()-((random()*7)::int)*interval '1 day', NOW());
  END LOOP;
END $$;

-- Sales data
INSERT INTO smart_bi_sales_data (factory_id, customer_name, customer_type, product_name, product_category, order_date, quantity, unit_price, amount, cost, profit, gross_margin, region, province, city, salesperson_name, department, created_at, updated_at)
VALUES
  ('F001', '上海永辉超市', '商超', '带鱼段精品A', '冷冻海鲜', '2026-01-06', 200.00, 45.0000, 9000.00, 6300.00, 2700.00, 0.3000, '华东', '上海', '上海市', '张经理', '华东销售部', NOW(), NOW()),
  ('F001', '杭州联华超市', '商超', '黄鱼片标准', '冷冻海鲜', '2026-01-08', 150.00, 55.0000, 8250.00, 5775.00, 2475.00, 0.3000, '华东', '浙江', '杭州市', '李经理', '华东销售部', NOW(), NOW()),
  ('F001', '北京物美超市', '商超', '墨鱼圈裹粉', '冷冻海鲜', '2026-01-10', 180.00, 42.0000, 7560.00, 5544.00, 2016.00, 0.2667, '华北', '北京', '北京市', '王经理', '华北销售部', NOW(), NOW()),
  ('F001', '深圳华润万家', '商超', '大虾仁精选', '冷冻海鲜', '2026-01-13', 100.00, 68.0000, 6800.00, 5000.00, 1800.00, 0.2647, '华南', '广东', '深圳市', '赵经理', '华南销售部', NOW(), NOW()),
  ('F001', '成都伊藤洋华堂', '商超', '带鱼段经典', '冷冻海鲜', '2026-01-15', 250.00, 44.0000, 11000.00, 7700.00, 3300.00, 0.3000, '西南', '四川', '成都市', '刘经理', '西南销售部', NOW(), NOW()),
  ('F001', '上海盒马鲜生', '新零售', '虾仁精品', '冷冻海鲜', '2026-01-22', 120.00, 72.0000, 8640.00, 6000.00, 2640.00, 0.3056, '华东', '上海', '上海市', '张经理', '华东销售部', NOW(), NOW()),
  ('F001', '天猫旗舰店', '电商', '带鱼段组合装', '冷冻海鲜', '2026-01-25', 300.00, 42.0000, 12600.00, 9300.00, 3300.00, 0.2619, '全国', NULL, NULL, '孙主管', '电商部', NOW(), NOW()),
  ('F001', '上海永辉超市', '商超', '带鱼段精品A', '冷冻海鲜', '2026-02-03', 210.00, 45.0000, 9450.00, 6615.00, 2835.00, 0.3000, '华东', '上海', '上海市', '张经理', '华东销售部', NOW(), NOW()),
  ('F001', '北京物美超市', '商超', '墨鱼圈新品', '冷冻海鲜', '2026-02-06', 190.00, 43.0000, 8170.00, 5986.00, 2184.00, 0.2673, '华北', '北京', '北京市', '王经理', '华北销售部', NOW(), NOW()),
  ('F001', '上海盒马鲜生', '新零售', '虾仁精品', '冷冻海鲜', '2026-02-08', 130.00, 72.0000, 9360.00, 6500.00, 2860.00, 0.3056, '华东', '上海', '上海市', '张经理', '华东销售部', NOW(), NOW());

-- Final counts
SELECT 'Total batches:' AS m, COUNT(*) AS c FROM production_batches WHERE factory_id='F001';
SELECT 'Jan-Feb 2026 batches:' AS m, COUNT(*) AS c FROM production_batches WHERE factory_id='F001' AND created_at >= '2026-01-01';
SELECT 'Quality inspections:' AS m, COUNT(*) AS c FROM quality_inspections WHERE factory_id='F001';
SELECT 'Material consumptions:' AS m, COUNT(*) AS c FROM material_consumptions WHERE factory_id='F001';
SELECT 'Processing stages:' AS m, COUNT(*) AS c FROM processing_stage_records WHERE factory_id='F001';
SELECT 'Sales data (recent):' AS m, COUNT(*) AS c FROM smart_bi_sales_data WHERE factory_id='F001' AND order_date >= '2026-01-01';
SELECT 'Equipment alerts (recent):' AS m, COUNT(*) AS c FROM equipment_alerts WHERE factory_id='F001' AND created_at >= '2026-02-01';
