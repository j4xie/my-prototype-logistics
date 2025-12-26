-- 添加测试数据 SQL
-- 数据库: creats-test
-- 日期: 2025-12-26

-- ============================================
-- 1. 设备维护记录 (equipment_maintenance)
-- ============================================
INSERT INTO equipment_maintenance (equipment_id, maintenance_type, maintenance_date, start_time, end_time, description, cost, performed_by, next_maintenance_date, notes, created_at, updated_at) VALUES
(6, 'routine', '2025-12-01', '2025-12-01 08:00:00', '2025-12-01 10:00:00', '速冻隧道机常规保养', 500.00, '张维修', '2026-02-01', '更换润滑油，检查制冷系统', NOW(), NOW()),
(6, 'repair', '2025-12-15', '2025-12-15 14:00:00', '2025-12-15 17:30:00', '压缩机故障维修', 2500.00, '李技术', '2026-01-15', '更换压缩机密封件', NOW(), NOW()),
(7, 'routine', '2025-12-10', '2025-12-10 09:00:00', '2025-12-10 11:00:00', '真空包装机常规保养', 300.00, '张维修', '2026-02-10', '清洁真空泵，更换密封条', NOW(), NOW()),
(8, 'overhaul', '2025-11-20', '2025-11-20 08:00:00', '2025-11-21 18:00:00', '切片机大修', 5000.00, '王工程师', '2026-05-20', '更换刀片组，调整传动系统', NOW(), NOW());

-- ============================================
-- 2. 设备告警 (equipment_alerts)
-- ============================================
INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at, created_at, updated_at) VALUES
('F001', 6, '维护提醒', 'WARNING', 'ACTIVE', '速冻隧道机即将到达维护周期', '设备运行时长已达2500小时，建议进行例行维护', '2025-12-26 08:00:00', NOW(), NOW()),
('F001', 7, '温度异常', 'CRITICAL', 'ACKNOWLEDGED', '真空包装机温度超过警戒值', '当前温度: 45°C, 警戒值: 40°C', '2025-12-25 14:30:00', NOW(), NOW()),
('F001', 8, '运行异常', 'INFO', 'RESOLVED', '切片机振动频率异常', '振动频率偏高，已调整皮带张力', '2025-12-20 10:15:00', NOW(), NOW()),
('F001', 6, '保修即将到期', 'WARNING', 'ACTIVE', '速冻隧道机保修期即将结束', '保修截止日期: 2026-01-15，建议续保或安排检查', '2025-12-26 09:00:00', NOW(), NOW());

-- ============================================
-- 3. 出货记录 (shipment_records)
-- ============================================
INSERT INTO shipment_records (id, factory_id, shipment_number, customer_id, order_number, product_name, quantity, unit, unit_price, total_amount, shipment_date, delivery_address, logistics_company, tracking_number, status, recorded_by, notes, created_at, updated_at) VALUES
(UUID(), 'F001', 'SH-2025-001', 'CUS-F001-001', 'ORD-YH-001', '带鱼段精品', 200.00, 'kg', 35.00, 7000.00, '2025-12-20', '上海市浦东新区永辉超市配送中心', '顺丰冷链', 'SF1234567890', 'delivered', 1, '按时送达', NOW(), NOW()),
(UUID(), 'F001', 'SH-2025-002', 'CUS-F001-002', 'ORD-HM-001', '黄鱼片鲜切', 150.00, 'kg', 45.00, 6750.00, '2025-12-22', '上海市静安区盒马鲜生中央仓库', '京东冷链', 'JD9876543210', 'shipped', 1, '在途中', NOW(), NOW()),
(UUID(), 'F001', 'SH-2025-003', 'CUS-F001-003', 'ORD-DR-001', '墨鱼圈即食', 100.00, 'kg', 55.00, 5500.00, '2025-12-25', '上海市闵行区大润发物流园', '中通冷链', 'ZT1122334455', 'pending', 1, '待发货', NOW(), NOW()),
(UUID(), 'F001', 'SH-2025-004', 'CUS-F001-001', 'ORD-YH-002', '鱿鱼须麻辣', 80.00, 'kg', 60.00, 4800.00, '2025-12-26', '上海市浦东新区永辉超市配送中心', '顺丰冷链', NULL, 'pending', 1, '今日发货', NOW(), NOW());

-- ============================================
-- 4. 质检记录 (quality_inspections)
-- ============================================
-- 注意: production_batch_id 需要是已存在的生产批次ID
INSERT INTO quality_inspections (id, factory_id, production_batch_id, inspector_id, inspection_date,
  sample_size, pass_count, fail_count, pass_rate, result, notes, created_at, updated_at) VALUES
(UUID(), 'F001', 1, 1, '2025-12-20', 100.00, 95.00, 5.00, 95.00, 'PASS', '质量合格，符合标准', NOW(), NOW()),
(UUID(), 'F001', 2, 1, '2025-12-22', 100.00, 88.00, 12.00, 88.00, 'CONDITIONAL', '部分产品需返工处理', NOW(), NOW()),
(UUID(), 'F001', 3, 1, '2025-12-24', 100.00, 75.00, 25.00, 75.00, 'FAIL', '不合格率过高，需整改', NOW(), NOW()),
(UUID(), 'F001', 4, 1, '2025-12-25', 100.00, 98.00, 2.00, 98.00, 'PASS', '优秀批次', NOW(), NOW()),
(UUID(), 'F001', 5, 1, '2025-12-26', 100.00, 92.00, 8.00, 92.00, 'PASS', '正常批次', NOW(), NOW());

-- ============================================
-- 5. 考勤历史补充数据
-- ============================================
INSERT INTO time_clock_records (factory_id, user_id, clock_in, clock_out, work_date, work_duration_minutes, status, notes, created_at, updated_at) VALUES
('F001', 1, '2025-12-25 08:05:00', '2025-12-25 17:30:00', '2025-12-25', 565, 'completed', '正常出勤', NOW(), NOW()),
('F001', 1, '2025-12-24 08:10:00', '2025-12-24 17:45:00', '2025-12-24', 575, 'completed', '正常出勤', NOW(), NOW()),
('F001', 1, '2025-12-23 08:00:00', '2025-12-23 18:00:00', '2025-12-23', 600, 'completed', '加班', NOW(), NOW());

SELECT '测试数据添加完成!' AS result;
