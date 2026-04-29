-- qhj Plan C demo seed v2 — expand from top 10 to top 30+ dishes covering ~60% revenue.
-- Rollback: DELETE ... WHERE notes='PLAN_C_DEMO_SEED_2026_04_25_V2' AND factory_id='RES_3101_009'
BEGIN;

-- =====================================================================
-- 10 new raw materials (v2)
-- =====================================================================
INSERT INTO raw_material_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('rm_qhj_016', 'RES_3101_009', 'QHJ_RM_016', '罗氏虾',       'kg',  90.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_017', 'RES_3101_009', 'QHJ_RM_017', '排骨',         'kg',  55.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_018', 'RES_3101_009', 'QHJ_RM_018', '凤梨',         'kg',  12.00, '水果',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_019', 'RES_3101_009', 'QHJ_RM_019', '腐竹',         'kg',  30.00, '豆制品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_020', 'RES_3101_009', 'QHJ_RM_020', '杭白菜',       'kg',   6.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_021', 'RES_3101_009', 'QHJ_RM_021', '鸭血',         'kg',  18.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_022', 'RES_3101_009', 'QHJ_RM_022', '酸菜',         'kg',  15.00, '腌制',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_023', 'RES_3101_009', 'QHJ_RM_023', '花甲',         'kg',  40.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_024', 'RES_3101_009', 'QHJ_RM_024', '牛蛙',         'kg',  65.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rm_qhj_025', 'RES_3101_009', 'QHJ_RM_025', '五花肉',       'kg',  50.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- 25 new product_types (dishes) — top un-seeded real dishes
-- =====================================================================
INSERT INTO product_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('pt_qhj_011', 'RES_3101_009', 'QHJ_PT_011', '招牌青花椒鱼(微麻微辣)[小份]',         '份', 128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_012', 'RES_3101_009', 'QHJ_PT_012', '营养多C番茄味(单人份)',                '份',  58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_013', 'RES_3101_009', 'QHJ_PT_013', '招牌青花椒鱼(微麻微辣)[大份]',         '份', 168.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_014', 'RES_3101_009', 'QHJ_PT_014', '招牌青花椒鱼(微麻微辣)[小份活鱼现做]', '份', 128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_015', 'RES_3101_009', 'QHJ_PT_015', '特色青花椒鱼[活鱼现做]',               '份', 108.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_016', 'RES_3101_009', 'QHJ_PT_016', '招牌青花椒鱼(微麻微辣)[大份活鱼现做]', '份', 168.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_017', 'RES_3101_009', 'QHJ_PT_017', '铜锅焖牛肋条',                         '份',  78.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_018', 'RES_3101_009', 'QHJ_PT_018', '招牌青花椒鱼(微麻微辣)[小份小心鱼刺]', '份', 128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_019', 'RES_3101_009', 'QHJ_PT_019', '油爆罗氏虾',                           '份',  78.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_020', 'RES_3101_009', 'QHJ_PT_020', '凤梨排骨',                             '份',  58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_021', 'RES_3101_009', 'QHJ_PT_021', '鲜腐竹杭白菜',                         '份',  28.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_022', 'RES_3101_009', 'QHJ_PT_022', '古法秘制酸菜味(单人份)',               '份',  58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_023', 'RES_3101_009', 'QHJ_PT_023', '招牌青花椒鱼(微麻微辣)[小份手工去刺]', '份', 152.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_024', 'RES_3101_009', 'QHJ_PT_024', '金牌毛血旺',                           '份',  68.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_025', 'RES_3101_009', 'QHJ_PT_025', '乌蒙山干锅牛肉',                       '份', 138.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_026', 'RES_3101_009', 'QHJ_PT_026', '五彩小炒',                             '份',  32.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_027', 'RES_3101_009', 'QHJ_PT_027', '招牌秘制青花椒味(2-3人)',              '份', 218.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_028', 'RES_3101_009', 'QHJ_PT_028', '米饭(单人份)',                         '份',  10.00, '主食', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_029', 'RES_3101_009', 'QHJ_PT_029', '酸菜吊龙炒饭',                         '份',  32.00, '主食', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_030', 'RES_3101_009', 'QHJ_PT_030', '美鱼美蛙(2-3人份)',                    '份', 188.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_031', 'RES_3101_009', 'QHJ_PT_031', '摇滚小酥肉',                           '份',  22.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_032', 'RES_3101_009', 'QHJ_PT_032', '特色青花椒鱼[活鱼手工去刺]',           '份', 128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_033', 'RES_3101_009', 'QHJ_PT_033', '青小米椒花甲',                         '份',  38.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_034', 'RES_3101_009', 'QHJ_PT_034', '招牌青花椒鱼(微麻微辣)[大份手工去刺]', '份', 192.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('pt_qhj_035', 'RES_3101_009', 'QHJ_PT_035', '招牌青花椒鱼(2-3人份)',                '份', 198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- Recipes — each dish 2-4 ingredients at realistic food cost 30-40%
-- =====================================================================
-- 青花椒鱼系列 (鲈鱼为主, 量按份量缩放) — food cost ~30-35%
INSERT INTO recipes (id, factory_id, product_type_id, raw_material_type_id, standard_quantity, unit, is_main_ingredient, is_active, created_by, created_at, updated_at, notes) VALUES
  -- 招牌青花椒鱼(微麻微辣)[小份] ¥128, 鲈鱼 0.55+青花椒 0.06+油 0.2+酱 0.1 = ¥24.75+4.8+2.4+5 = ¥37 (29%)
  ('rec_qhj_1101', 'RES_3101_009', 'pt_qhj_011', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1102', 'RES_3101_009', 'pt_qhj_011', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1103', 'RES_3101_009', 'pt_qhj_011', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1104', 'RES_3101_009', 'pt_qhj_011', 'rm_qhj_015', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 营养多C番茄味(单人份) ¥58, 鲈鱼 0.25+番茄 0.3+油 0.1 = 11.25+3+1.2 = ¥15.5 (27%)
  ('rec_qhj_1201', 'RES_3101_009', 'pt_qhj_012', 'rm_qhj_001', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1202', 'RES_3101_009', 'pt_qhj_012', 'rm_qhj_007', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1203', 'RES_3101_009', 'pt_qhj_012', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌青花椒鱼(微麻微辣)[大份] ¥168, 鲈鱼 0.8+青花椒 0.1+油 0.3+酱 0.15
  ('rec_qhj_1301', 'RES_3101_009', 'pt_qhj_013', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1302', 'RES_3101_009', 'pt_qhj_013', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1303', 'RES_3101_009', 'pt_qhj_013', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1304', 'RES_3101_009', 'pt_qhj_013', 'rm_qhj_015', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌青花椒鱼[小份活鱼] ¥128, same as 小份
  ('rec_qhj_1401', 'RES_3101_009', 'pt_qhj_014', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1402', 'RES_3101_009', 'pt_qhj_014', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1403', 'RES_3101_009', 'pt_qhj_014', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 特色青花椒鱼[活鱼现做] ¥108
  ('rec_qhj_1501', 'RES_3101_009', 'pt_qhj_015', 'rm_qhj_001', 0.50, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1502', 'RES_3101_009', 'pt_qhj_015', 'rm_qhj_002', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1503', 'RES_3101_009', 'pt_qhj_015', 'rm_qhj_013', 0.15, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌青花椒鱼[大份活鱼]
  ('rec_qhj_1601', 'RES_3101_009', 'pt_qhj_016', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1602', 'RES_3101_009', 'pt_qhj_016', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1603', 'RES_3101_009', 'pt_qhj_016', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 铜锅焖牛肋条 ¥78, 牛肉 0.2+生姜 0.02+油 0.1
  ('rec_qhj_1701', 'RES_3101_009', 'pt_qhj_017', 'rm_qhj_003', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1702', 'RES_3101_009', 'pt_qhj_017', 'rm_qhj_014', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1703', 'RES_3101_009', 'pt_qhj_017', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌青花椒鱼[小份小心鱼刺]
  ('rec_qhj_1801', 'RES_3101_009', 'pt_qhj_018', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1802', 'RES_3101_009', 'pt_qhj_018', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1803', 'RES_3101_009', 'pt_qhj_018', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 油爆罗氏虾 ¥78, 罗氏虾 0.25+油 0.1+生姜 0.02 = ¥22.5+1.2+0.16 = ¥23.9 (30.6%)
  ('rec_qhj_1901', 'RES_3101_009', 'pt_qhj_019', 'rm_qhj_016', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1902', 'RES_3101_009', 'pt_qhj_019', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_1903', 'RES_3101_009', 'pt_qhj_019', 'rm_qhj_014', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 凤梨排骨 ¥58, 排骨 0.3+凤梨 0.15+油 0.08 = ¥16.5+1.8+0.96 = ¥19.3 (33%)
  ('rec_qhj_2001', 'RES_3101_009', 'pt_qhj_020', 'rm_qhj_017', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2002', 'RES_3101_009', 'pt_qhj_020', 'rm_qhj_018', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2003', 'RES_3101_009', 'pt_qhj_020', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 鲜腐竹杭白菜 ¥28, 腐竹 0.15+杭白菜 0.3+油 0.05 = ¥4.5+1.8+0.6 = ¥6.9 (24.6%)
  ('rec_qhj_2101', 'RES_3101_009', 'pt_qhj_021', 'rm_qhj_019', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2102', 'RES_3101_009', 'pt_qhj_021', 'rm_qhj_020', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2103', 'RES_3101_009', 'pt_qhj_021', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 古法秘制酸菜味(单人份) ¥58, 鲈鱼 0.25+酸菜 0.15+油 0.1 = 11.25+2.25+1.2 = ¥14.7 (25%)
  ('rec_qhj_2201', 'RES_3101_009', 'pt_qhj_022', 'rm_qhj_001', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2202', 'RES_3101_009', 'pt_qhj_022', 'rm_qhj_022', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2203', 'RES_3101_009', 'pt_qhj_022', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌青花椒鱼[小份手工去刺] ¥152 (稍贵因为手工)
  ('rec_qhj_2301', 'RES_3101_009', 'pt_qhj_023', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2302', 'RES_3101_009', 'pt_qhj_023', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2303', 'RES_3101_009', 'pt_qhj_023', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 金牌毛血旺 ¥68, 鸭血 0.2+豆腐 0.1+五花肉 0.05+油 0.1 = 3.6+0.8+2.5+1.2 = ¥8.1 (11.9%)
  --   → 增加更多料: 鸭血 0.4 + 豆腐 0.2 + 五花肉 0.1 + 酱 0.08 + 油 0.15 = 7.2+1.6+5+4+1.8 = ¥19.6 (28.8%)
  ('rec_qhj_2401', 'RES_3101_009', 'pt_qhj_024', 'rm_qhj_021', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2402', 'RES_3101_009', 'pt_qhj_024', 'rm_qhj_005', 0.20, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2403', 'RES_3101_009', 'pt_qhj_024', 'rm_qhj_025', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2404', 'RES_3101_009', 'pt_qhj_024', 'rm_qhj_015', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2405', 'RES_3101_009', 'pt_qhj_024', 'rm_qhj_013', 0.15, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 乌蒙山干锅牛肉 ¥138, 牛肉 0.4+酱 0.05+油 0.2 = 48+2.5+2.4 = ¥52.9 (38.3%)
  ('rec_qhj_2501', 'RES_3101_009', 'pt_qhj_025', 'rm_qhj_003', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2502', 'RES_3101_009', 'pt_qhj_025', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2503', 'RES_3101_009', 'pt_qhj_025', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 五彩小炒 ¥32, 杭白菜 0.2+豆腐 0.1+油 0.08 = 1.2+0.8+0.96 = ¥3 (9.4%) 太低
  --   → 实际还有多种料, 调到: 杭白菜 0.2+豆腐 0.15+五花肉 0.08+油 0.08 = 1.2+1.2+4+0.96 = ¥7.4 (23%)
  ('rec_qhj_2601', 'RES_3101_009', 'pt_qhj_026', 'rm_qhj_020', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2602', 'RES_3101_009', 'pt_qhj_026', 'rm_qhj_005', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2603', 'RES_3101_009', 'pt_qhj_026', 'rm_qhj_025', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2604', 'RES_3101_009', 'pt_qhj_026', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌秘制青花椒味(2-3人) ¥218, 大份 same formula
  ('rec_qhj_2701', 'RES_3101_009', 'pt_qhj_027', 'rm_qhj_001', 0.90, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2702', 'RES_3101_009', 'pt_qhj_027', 'rm_qhj_002', 0.12, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2703', 'RES_3101_009', 'pt_qhj_027', 'rm_qhj_013', 0.35, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2704', 'RES_3101_009', 'pt_qhj_027', 'rm_qhj_015', 0.18, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 米饭(单人份) ¥10, 大米 0.2 = ¥1.2 (12%)
  ('rec_qhj_2801', 'RES_3101_009', 'pt_qhj_028', 'rm_qhj_004', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 酸菜吊龙炒饭 ¥32, 大米 0.15+酸菜 0.08+牛肉 0.05+油 0.05 = 0.9+1.2+6+0.6 = ¥8.7 (27%)
  ('rec_qhj_2901', 'RES_3101_009', 'pt_qhj_029', 'rm_qhj_004', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2902', 'RES_3101_009', 'pt_qhj_029', 'rm_qhj_022', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2903', 'RES_3101_009', 'pt_qhj_029', 'rm_qhj_003', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_2904', 'RES_3101_009', 'pt_qhj_029', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 美鱼美蛙(2-3人份) ¥188, 鲈鱼 0.6+牛蛙 0.4+青花椒 0.08+油 0.3 = 27+26+6.4+3.6 = ¥63 (33.5%)
  ('rec_qhj_3001', 'RES_3101_009', 'pt_qhj_030', 'rm_qhj_001', 0.60, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3002', 'RES_3101_009', 'pt_qhj_030', 'rm_qhj_024', 0.40, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3003', 'RES_3101_009', 'pt_qhj_030', 'rm_qhj_002', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3004', 'RES_3101_009', 'pt_qhj_030', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 摇滚小酥肉 ¥22, 五花肉 0.1+油 0.05 = 5+0.6 = ¥5.6 (25%)
  ('rec_qhj_3101', 'RES_3101_009', 'pt_qhj_031', 'rm_qhj_025', 0.10, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3102', 'RES_3101_009', 'pt_qhj_031', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 特色青花椒鱼[活鱼手工去刺] ¥128
  ('rec_qhj_3201', 'RES_3101_009', 'pt_qhj_032', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3202', 'RES_3101_009', 'pt_qhj_032', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3203', 'RES_3101_009', 'pt_qhj_032', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 青小米椒花甲 ¥38, 花甲 0.3+生姜 0.02+油 0.08 = 12+0.16+0.96 = ¥13.1 (34.5%)
  ('rec_qhj_3301', 'RES_3101_009', 'pt_qhj_033', 'rm_qhj_023', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3302', 'RES_3101_009', 'pt_qhj_033', 'rm_qhj_014', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3303', 'RES_3101_009', 'pt_qhj_033', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌青花椒鱼[大份手工去刺] ¥192
  ('rec_qhj_3401', 'RES_3101_009', 'pt_qhj_034', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3402', 'RES_3101_009', 'pt_qhj_034', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3403', 'RES_3101_009', 'pt_qhj_034', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),

  -- 招牌青花椒鱼(2-3人份) ¥198
  ('rec_qhj_3501', 'RES_3101_009', 'pt_qhj_035', 'rm_qhj_001', 0.85, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3502', 'RES_3101_009', 'pt_qhj_035', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3503', 'RES_3101_009', 'pt_qhj_035', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2'),
  ('rec_qhj_3504', 'RES_3101_009', 'pt_qhj_035', 'rm_qhj_015', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V2')
ON CONFLICT (id) DO NOTHING;

COMMIT;
