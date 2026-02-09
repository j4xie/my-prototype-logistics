-- 检查 factory_equipment 表的数据
USE cretas;

SELECT '=== factory_equipment 表数据 ===' AS Info;
SELECT * FROM factory_equipment ORDER BY id;

SELECT '=== equipment 表数据 ===' AS Info;
SELECT id, factory_id, code, name, category FROM equipment ORDER BY id;


