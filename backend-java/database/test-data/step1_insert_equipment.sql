-- 为3个工厂添加设备相关数据（分步执行版）
-- 先插入设备，验证后再插入其他数据

USE cretas;

-- ===== 步骤1: 插入F002和F003的设备 =====
-- 注意：如果已经执行过，这步会报错（重复插入），可以跳过

INSERT INTO equipment (factory_id, code, name, category, model, manufacturer, purchase_date, purchase_price, status, location, is_active, created_at, updated_at) VALUES
-- F002的设备
('F002', 'EQ-F002-001', '速冻设备', '冷冻', '型号SF-200', '冷链设备公司', '2024-03-15', 250000.00, 'IDLE', 'B区2号车间', 1, NOW(), NOW()),
('F002', 'EQ-F002-002', '真空包装机', '包装', '型号VP-150', '包装机械厂', '2024-04-20', 180000.00, 'IDLE', 'B区包装车间', 1, NOW(), NOW()),
('F002', 'EQ-F002-003', '切割设备', '加工', '型号CT-300', '食品机械公司', '2024-05-10', 320000.00, 'IDLE', 'B区加工车间', 1, NOW(), NOW()),

-- F003的设备
('F003', 'EQ-F003-001', '冷藏库设备', '冷藏', '型号CR-500', '制冷设备厂', '2024-02-01', 450000.00, 'IDLE', 'C区冷藏室', 1, NOW(), NOW()),
('F003', 'EQ-F003-002', '分拣设备', '分拣', '型号ST-100', '自动化设备公司', '2024-03-25', 280000.00, 'IDLE', 'C区分拣车间', 1, NOW(), NOW()),
('F003', 'EQ-F003-003', '清洗设备', '清洗', '型号WS-200', '食品设备公司', '2024-04-15', 150000.00, 'IDLE', 'C区清洗车间', 1, NOW(), NOW());

-- ===== 步骤2: 验证设备已插入并查看ID =====
SELECT '=== 所有工厂的设备 ===' AS Info;
SELECT id, factory_id, code, name, category 
FROM equipment 
WHERE factory_id IN ('F001', 'F002', 'F003')
ORDER BY factory_id, id;


