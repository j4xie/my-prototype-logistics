-- Seed unit_of_measurements (PG-converted from V2025_12_31_5).
--
-- 起源: 历史 V2025_12_31_5__unit_of_measurements.sql (MySQL syntax) 在 db/migration/,
-- 已被 Flyway baseline-version=20260416.99 跳过, 因此 PG 环境 unit_of_measurements 表
-- 一直 0 rows. 现象: web-admin / mobile 单位下拉为空, /system-config/units 返空.
-- (chat 3 PR #120 13-item smoke checklist /units row=0 finding)
--
-- 修复: 用 PG-friendly syntax 重新 seed 28 行系统内置单位 (6 WEIGHT + 3 VOLUME + 8 COUNT + 3 LENGTH + 2 TEMP + 4 TIME + 2 RATIO) (factory_id='*' 全局).
-- - UUID() (MySQL) → gen_random_uuid() (PG)
-- - INSERT IGNORE 等价 → ON CONFLICT (factory_id, unit_code) DO NOTHING
-- - created_at/updated_at NOT NULL 无 DEFAULT → 显式 NOW()
--
-- 验证: SELECT count(*) FROM unit_of_measurements WHERE factory_id='*' → 28
-- /api/mobile/{factoryId}/system-config/units 返 28 个 unit_code

INSERT INTO unit_of_measurements (id, factory_id, unit_code, unit_name, unit_symbol, base_unit, conversion_factor, category, decimal_places, is_base_unit, is_active, is_system, sort_order, created_at, updated_at)
VALUES
    -- 重量类 (基础单位: kg)
    (gen_random_uuid()::text, '*', 'kg',         '公斤',   'kg',  'kg',      1.000000, 'WEIGHT',      2, true,  true, true, 1, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'g',          '克',     'g',   'kg',      0.001000, 'WEIGHT',      0, false, true, true, 2, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'mg',         '毫克',   'mg',  'kg',      0.000001, 'WEIGHT',      0, false, true, true, 3, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'ton',        '吨',     't',   'kg',   1000.000000, 'WEIGHT',      3, false, true, true, 4, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'jin',        '斤',     '斤',  'kg',      0.500000, 'WEIGHT',      2, false, true, true, 5, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'liang',      '两',     '两',  'kg',      0.050000, 'WEIGHT',      2, false, true, true, 6, NOW(), NOW()),
    -- 体积类 (基础单位: L)
    (gen_random_uuid()::text, '*', 'L',          '升',     'L',   'L',       1.000000, 'VOLUME',      2, true,  true, true, 1, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'mL',         '毫升',   'mL',  'L',       0.001000, 'VOLUME',      0, false, true, true, 2, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'm3',         '立方米', 'm³',  'L',    1000.000000, 'VOLUME',      3, false, true, true, 3, NOW(), NOW()),
    -- 数量类 (基础单位: pcs)
    (gen_random_uuid()::text, '*', 'pcs',        '件',     '件',  'pcs',     1.000000, 'COUNT',       0, true,  true, true, 1, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'box',        '箱',     '箱',  'pcs',     1.000000, 'COUNT',       0, false, true, true, 2, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'bag',        '袋',     '袋',  'pcs',     1.000000, 'COUNT',       0, false, true, true, 3, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'pack',       '包',     '包',  'pcs',     1.000000, 'COUNT',       0, false, true, true, 4, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'bottle',     '瓶',     '瓶',  'pcs',     1.000000, 'COUNT',       0, false, true, true, 5, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'can',        '罐',     '罐',  'pcs',     1.000000, 'COUNT',       0, false, true, true, 6, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'tray',       '托盘',   '托',  'pcs',     1.000000, 'COUNT',       0, false, true, true, 7, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'plate',      '板',     '板',  'pcs',     1.000000, 'COUNT',       0, false, true, true, 8, NOW(), NOW()),
    -- 长度类 (基础单位: m)
    (gen_random_uuid()::text, '*', 'm',          '米',     'm',   'm',       1.000000, 'LENGTH',      2, true,  true, true, 1, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'cm',         '厘米',   'cm',  'm',       0.010000, 'LENGTH',      1, false, true, true, 2, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'mm',         '毫米',   'mm',  'm',       0.001000, 'LENGTH',      0, false, true, true, 3, NOW(), NOW()),
    -- 温度类 (基础单位: celsius)
    (gen_random_uuid()::text, '*', 'celsius',    '摄氏度', '℃',   'celsius', 1.000000, 'TEMPERATURE', 1, true,  true, true, 1, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'fahrenheit', '华氏度', '℉',   'celsius', 1.000000, 'TEMPERATURE', 1, false, true, true, 2, NOW(), NOW()),
    -- 时间类 (基础单位: minute)
    (gen_random_uuid()::text, '*', 'minute',     '分钟',   'min', 'minute',  1.000000, 'TIME',        0, true,  true, true, 1, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'hour',       '小时',   'h',   'minute', 60.000000, 'TIME',        1, false, true, true, 2, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'day',        '天',     'd',   'minute',1440.000000, 'TIME',        0, false, true, true, 3, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'second',     '秒',     's',   'minute',  0.016667, 'TIME',        0, false, true, true, 4, NOW(), NOW()),
    -- 百分比类 (基础单位: percent)
    (gen_random_uuid()::text, '*', 'percent',    '百分比', '%',   'percent', 1.000000, 'RATIO',       2, true,  true, true, 1, NOW(), NOW()),
    (gen_random_uuid()::text, '*', 'permille',   '千分比', '‰',   'percent', 0.100000, 'RATIO',       3, false, true, true, 2, NOW(), NOW())
ON CONFLICT (factory_id, unit_code) DO NOTHING;
