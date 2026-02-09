-- 调试查询：检查设备是否存在
USE cretas;

-- 检查F002的设备
SELECT '=== F002设备检查 ===' AS Info;
SELECT id, factory_id, code, name, category 
FROM equipment 
WHERE factory_id = 'F002' 
ORDER BY code;

-- 检查F003的设备
SELECT '=== F003设备检查 ===' AS Info;
SELECT id, factory_id, code, name, category 
FROM equipment 
WHERE factory_id = 'F003' 
ORDER BY code;

-- 测试子查询
SELECT '=== 测试子查询 ===' AS Info;
SELECT 
    'EQ-F002-001' AS code,
    (SELECT id FROM equipment WHERE code = 'EQ-F002-001' AND factory_id = 'F002' LIMIT 1) AS equipment_id;


