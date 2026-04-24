-- qhj Plan C demo seed v5 — expand top 100 → top 136, target 90% revenue coverage.
-- Rollback: DELETE ... WHERE notes='PLAN_C_DEMO_SEED_2026_04_25_V5' AND factory_id='RES_3101_009'
BEGIN;

-- =====================================================================
-- 5 new raw materials (v5) — min addition, most dishes reuse existing
-- =====================================================================
INSERT INTO raw_material_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('rm_qhj_049', 'RES_3101_009', 'QHJ_RM_049', '年糕',       'kg', 12.00, '主食',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rm_qhj_050', 'RES_3101_009', 'QHJ_RM_050', '皮蛋',       'kg', 25.00, '蛋品',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rm_qhj_051', 'RES_3101_009', 'QHJ_RM_051', '土豆粉',     'kg', 15.00, '干货',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rm_qhj_052', 'RES_3101_009', 'QHJ_RM_052', '牛奶',       'L',  15.00, '饮品原料', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rm_qhj_053', 'RES_3101_009', 'QHJ_RM_053', '柠檬',       'kg', 10.00, '水果',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- 36 new product_types (top 101-136)
-- =====================================================================
INSERT INTO product_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('pt_qhj_101', 'RES_3101_009', 'QHJ_PT_101', '来吃鱼鸭约惠双人套餐',         '份',168.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_102', 'RES_3101_009', 'QHJ_PT_102', '古法秘制酸菜鱼[小份]',         '份',128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_103', 'RES_3101_009', 'QHJ_PT_103', '年糕',                         '份',  8.00, '主食', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_104', 'RES_3101_009', 'QHJ_PT_104', '营养多C番茄鱼[小份手工去刺]',  '份',148.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_105', 'RES_3101_009', 'QHJ_PT_105', '营养多C番茄鱼[小份活鱼现做]',  '份',128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_106', 'RES_3101_009', 'QHJ_PT_106', '大碗冰粉',                     '份', 12.00, '甜品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_107', 'RES_3101_009', 'QHJ_PT_107', '【无刺】招牌青花椒味(小份)',   '份',158.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_108', 'RES_3101_009', 'QHJ_PT_108', '鲜浓酱香味(2-3人)',            '份',198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_109', 'RES_3101_009', 'QHJ_PT_109', '大家都这样组合配菜',           '份', 32.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_110', 'RES_3101_009', 'QHJ_PT_110', '招牌青花椒味多人专享套餐',     '份',268.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_111', 'RES_3101_009', 'QHJ_PT_111', '【无刺】招牌青花椒味(2-3人份)','份',198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_112', 'RES_3101_009', 'QHJ_PT_112', '烧椒皮蛋',                     '份', 18.00, '凉菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_113', 'RES_3101_009', 'QHJ_PT_113', '双味包浆豆腐',                 '份', 28.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_114', 'RES_3101_009', 'QHJ_PT_114', '青笋片',                       '份', 10.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_115', 'RES_3101_009', 'QHJ_PT_115', '营养多C番茄鱼[大份]',          '份',168.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_116', 'RES_3101_009', 'QHJ_PT_116', '卤炸牛肉串',                   '份', 28.00, '小吃', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_117', 'RES_3101_009', 'QHJ_PT_117', '泡椒跳跳蛙',                   '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_118', 'RES_3101_009', 'QHJ_PT_118', '招牌特色青花椒鱼(2-3人份)',    '份',198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_119', 'RES_3101_009', 'QHJ_PT_119', '香煎鲜虾饼',                   '份', 28.00, '小吃', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_120', 'RES_3101_009', 'QHJ_PT_120', '陈皮山楂饮',                   '份',  8.00, '饮品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_121', 'RES_3101_009', 'QHJ_PT_121', '爆香冒烤鱼(单人份)',           '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_122', 'RES_3101_009', 'QHJ_PT_122', '香辣牛蛙',                     '份', 48.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_123', 'RES_3101_009', 'QHJ_PT_123', '豆汤菌菇煲',                   '份', 32.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_124', 'RES_3101_009', 'QHJ_PT_124', '小份手工冰粉',                 '份', 12.00, '甜品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_125', 'RES_3101_009', 'QHJ_PT_125', '龙眼牛乳冰',                   '份', 16.00, '饮品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_126', 'RES_3101_009', 'QHJ_PT_126', '土豆粉',                       '份', 10.00, '主食', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_127', 'RES_3101_009', 'QHJ_PT_127', '鲜浓酱香味(1-2人)',            '份',128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_128', 'RES_3101_009', 'QHJ_PT_128', '甄选优惠家庭套餐',             '份',298.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_129', 'RES_3101_009', 'QHJ_PT_129', '招牌特色青花椒鱼(小份)',       '份',128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_130', 'RES_3101_009', 'QHJ_PT_130', '成都冒烤鸭可乐单人套餐',       '份', 68.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_131', 'RES_3101_009', 'QHJ_PT_131', '古法秘制酸菜鱼[大份]',         '份',168.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_132', 'RES_3101_009', 'QHJ_PT_132', '江油肥肠',                     '份', 38.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_133', 'RES_3101_009', 'QHJ_PT_133', '营养多C番茄鱼[小份小心鱼刺]',  '份',128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_134', 'RES_3101_009', 'QHJ_PT_134', '干锅无刺黑鱼配时蔬套餐',       '份',138.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_135', 'RES_3101_009', 'QHJ_PT_135', '青提牛乳冰',                   '份', 16.00, '饮品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('pt_qhj_136', 'RES_3101_009', 'QHJ_PT_136', '营养多C番茄鱼[大份手工去刺]',  '份',188.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- Recipes
-- =====================================================================
INSERT INTO recipes (id, factory_id, product_type_id, raw_material_type_id, standard_quantity, unit, is_main_ingredient, is_active, created_by, created_at, updated_at, notes) VALUES
  -- 来吃鱼鸭约惠双人套餐 ¥168
  ('rec_qhj_1011', 'RES_3101_009', 'pt_qhj_101', 'rm_qhj_001', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1012', 'RES_3101_009', 'pt_qhj_101', 'rm_qhj_008', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1013', 'RES_3101_009', 'pt_qhj_101', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 古法秘制酸菜鱼[小份] ¥128
  ('rec_qhj_1021', 'RES_3101_009', 'pt_qhj_102', 'rm_qhj_001', 0.45, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1022', 'RES_3101_009', 'pt_qhj_102', 'rm_qhj_022', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1023', 'RES_3101_009', 'pt_qhj_102', 'rm_qhj_013', 0.15, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 年糕 ¥8, 年糕 0.1 = ¥1.2 (15%)
  ('rec_qhj_1031', 'RES_3101_009', 'pt_qhj_103', 'rm_qhj_049', 0.10, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 营养多C番茄鱼[小份手工去刺] ¥148
  ('rec_qhj_1041', 'RES_3101_009', 'pt_qhj_104', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1042', 'RES_3101_009', 'pt_qhj_104', 'rm_qhj_007', 0.50, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1043', 'RES_3101_009', 'pt_qhj_104', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 营养多C番茄鱼[小份活鱼现做] ¥128
  ('rec_qhj_1051', 'RES_3101_009', 'pt_qhj_105', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1052', 'RES_3101_009', 'pt_qhj_105', 'rm_qhj_007', 0.50, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1053', 'RES_3101_009', 'pt_qhj_105', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 大碗冰粉 ¥12
  ('rec_qhj_1061', 'RES_3101_009', 'pt_qhj_106', 'rm_qhj_011', 0.06, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1062', 'RES_3101_009', 'pt_qhj_106', 'rm_qhj_010', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 【无刺】招牌青花椒味(小份) ¥158
  ('rec_qhj_1071', 'RES_3101_009', 'pt_qhj_107', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1072', 'RES_3101_009', 'pt_qhj_107', 'rm_qhj_002', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1073', 'RES_3101_009', 'pt_qhj_107', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 鲜浓酱香味(2-3人) ¥198
  ('rec_qhj_1081', 'RES_3101_009', 'pt_qhj_108', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1082', 'RES_3101_009', 'pt_qhj_108', 'rm_qhj_015', 0.20, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1083', 'RES_3101_009', 'pt_qhj_108', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 大家都这样组合配菜 ¥32, 综合杂菜: 豆腐 0.1+莴笋 0.1+菌菇 0.1+油 0.05
  ('rec_qhj_1091', 'RES_3101_009', 'pt_qhj_109', 'rm_qhj_005', 0.10, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1092', 'RES_3101_009', 'pt_qhj_109', 'rm_qhj_036', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1093', 'RES_3101_009', 'pt_qhj_109', 'rm_qhj_047', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_1094', 'RES_3101_009', 'pt_qhj_109', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 招牌青花椒味多人专享套餐 ¥268
  ('rec_qhj_110_1', 'RES_3101_009', 'pt_qhj_110', 'rm_qhj_001', 1.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_110_2', 'RES_3101_009', 'pt_qhj_110', 'rm_qhj_002', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_110_3', 'RES_3101_009', 'pt_qhj_110', 'rm_qhj_013', 0.40, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 【无刺】招牌青花椒味(2-3人份) ¥198
  ('rec_qhj_111_1', 'RES_3101_009', 'pt_qhj_111', 'rm_qhj_001', 0.90, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_111_2', 'RES_3101_009', 'pt_qhj_111', 'rm_qhj_002', 0.12, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_111_3', 'RES_3101_009', 'pt_qhj_111', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 烧椒皮蛋 ¥18, 皮蛋 0.2+生姜 0.01 = 5+0.08 = ¥5 (28%)
  ('rec_qhj_112_1', 'RES_3101_009', 'pt_qhj_112', 'rm_qhj_050', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_112_2', 'RES_3101_009', 'pt_qhj_112', 'rm_qhj_014', 0.01, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 双味包浆豆腐 ¥28, 豆腐 0.25+五花肉 0.05+油 0.03
  ('rec_qhj_113_1', 'RES_3101_009', 'pt_qhj_113', 'rm_qhj_005', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_113_2', 'RES_3101_009', 'pt_qhj_113', 'rm_qhj_025', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_113_3', 'RES_3101_009', 'pt_qhj_113', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 青笋片 ¥10, 莴笋 0.35 = ¥2.1 (21%)
  ('rec_qhj_114_1', 'RES_3101_009', 'pt_qhj_114', 'rm_qhj_036', 0.35, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 营养多C番茄鱼[大份] ¥168
  ('rec_qhj_115_1', 'RES_3101_009', 'pt_qhj_115', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_115_2', 'RES_3101_009', 'pt_qhj_115', 'rm_qhj_007', 0.80, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_115_3', 'RES_3101_009', 'pt_qhj_115', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 卤炸牛肉串 ¥28, 牛肉 0.08+油 0.03 = 9.6+0.36 = ¥10 (35.7%)
  ('rec_qhj_116_1', 'RES_3101_009', 'pt_qhj_116', 'rm_qhj_003', 0.08, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_116_2', 'RES_3101_009', 'pt_qhj_116', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 泡椒跳跳蛙 ¥58, 牛蛙 0.3+油 0.08
  ('rec_qhj_117_1', 'RES_3101_009', 'pt_qhj_117', 'rm_qhj_024', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_117_2', 'RES_3101_009', 'pt_qhj_117', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 招牌特色青花椒鱼(2-3人份) ¥198
  ('rec_qhj_118_1', 'RES_3101_009', 'pt_qhj_118', 'rm_qhj_001', 0.85, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_118_2', 'RES_3101_009', 'pt_qhj_118', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_118_3', 'RES_3101_009', 'pt_qhj_118', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 香煎鲜虾饼 ¥28, 虾仁 0.06+豆面 0.05 = 7.2+0.5 = ¥7.7 (27.5%)
  ('rec_qhj_119_1', 'RES_3101_009', 'pt_qhj_119', 'rm_qhj_035', 0.06, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_119_2', 'RES_3101_009', 'pt_qhj_119', 'rm_qhj_045', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 陈皮山楂饮 ¥8, 红糖 0.03+柠檬 0.02 = 0.45+0.2 = ¥0.65 (8%)
  ('rec_qhj_120_1', 'RES_3101_009', 'pt_qhj_120', 'rm_qhj_010', 0.03, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_120_2', 'RES_3101_009', 'pt_qhj_120', 'rm_qhj_053', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 爆香冒烤鱼(单人份) ¥58
  ('rec_qhj_121_1', 'RES_3101_009', 'pt_qhj_121', 'rm_qhj_001', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_121_2', 'RES_3101_009', 'pt_qhj_121', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 香辣牛蛙 ¥48, 牛蛙 0.25+油 0.06 = 16.25+0.72 = ¥17 (35.4%)
  ('rec_qhj_122_1', 'RES_3101_009', 'pt_qhj_122', 'rm_qhj_024', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_122_2', 'RES_3101_009', 'pt_qhj_122', 'rm_qhj_013', 0.06, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 豆汤菌菇煲 ¥32, 杂菌 0.25+豆腐 0.15+油 0.03
  ('rec_qhj_123_1', 'RES_3101_009', 'pt_qhj_123', 'rm_qhj_047', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_123_2', 'RES_3101_009', 'pt_qhj_123', 'rm_qhj_005', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_123_3', 'RES_3101_009', 'pt_qhj_123', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 小份手工冰粉 ¥12
  ('rec_qhj_124_1', 'RES_3101_009', 'pt_qhj_124', 'rm_qhj_011', 0.05, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_124_2', 'RES_3101_009', 'pt_qhj_124', 'rm_qhj_010', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 龙眼牛乳冰 ¥16, 牛奶 0.2+冰粉原料 0.03 = 3+0.84 = ¥3.8 (24%)
  ('rec_qhj_125_1', 'RES_3101_009', 'pt_qhj_125', 'rm_qhj_052', 0.20, 'L',  true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_125_2', 'RES_3101_009', 'pt_qhj_125', 'rm_qhj_011', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 土豆粉 ¥10, 土豆粉 0.15 = ¥2.25 (22.5%)
  ('rec_qhj_126_1', 'RES_3101_009', 'pt_qhj_126', 'rm_qhj_051', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 鲜浓酱香味(1-2人) ¥128
  ('rec_qhj_127_1', 'RES_3101_009', 'pt_qhj_127', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_127_2', 'RES_3101_009', 'pt_qhj_127', 'rm_qhj_015', 0.12, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_127_3', 'RES_3101_009', 'pt_qhj_127', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 甄选优惠家庭套餐 ¥298, 综合鲈鱼 1.2+鸭腿 0.3+鸡腿 0.3+油 0.4+酱 0.15
  ('rec_qhj_128_1', 'RES_3101_009', 'pt_qhj_128', 'rm_qhj_001', 1.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_128_2', 'RES_3101_009', 'pt_qhj_128', 'rm_qhj_008', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_128_3', 'RES_3101_009', 'pt_qhj_128', 'rm_qhj_009', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_128_4', 'RES_3101_009', 'pt_qhj_128', 'rm_qhj_013', 0.40, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_128_5', 'RES_3101_009', 'pt_qhj_128', 'rm_qhj_015', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 招牌特色青花椒鱼(小份) ¥128
  ('rec_qhj_129_1', 'RES_3101_009', 'pt_qhj_129', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_129_2', 'RES_3101_009', 'pt_qhj_129', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_129_3', 'RES_3101_009', 'pt_qhj_129', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 成都冒烤鸭可乐单人套餐 ¥68
  ('rec_qhj_130_1', 'RES_3101_009', 'pt_qhj_130', 'rm_qhj_008', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_130_2', 'RES_3101_009', 'pt_qhj_130', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 古法秘制酸菜鱼[大份] ¥168
  ('rec_qhj_131_1', 'RES_3101_009', 'pt_qhj_131', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_131_2', 'RES_3101_009', 'pt_qhj_131', 'rm_qhj_022', 0.25, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_131_3', 'RES_3101_009', 'pt_qhj_131', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 江油肥肠 ¥38, 肥肠 0.25+油 0.05 = 7.5+0.6 = ¥8.1 (21.3%)
  ('rec_qhj_132_1', 'RES_3101_009', 'pt_qhj_132', 'rm_qhj_041', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_132_2', 'RES_3101_009', 'pt_qhj_132', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 营养多C番茄鱼[小份小心鱼刺] ¥128
  ('rec_qhj_133_1', 'RES_3101_009', 'pt_qhj_133', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_133_2', 'RES_3101_009', 'pt_qhj_133', 'rm_qhj_007', 0.50, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_133_3', 'RES_3101_009', 'pt_qhj_133', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 干锅无刺黑鱼配时蔬套餐 ¥138
  ('rec_qhj_134_1', 'RES_3101_009', 'pt_qhj_134', 'rm_qhj_030', 0.5, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_134_2', 'RES_3101_009', 'pt_qhj_134', 'rm_qhj_020', 0.2, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_134_3', 'RES_3101_009', 'pt_qhj_134', 'rm_qhj_013', 0.15, 'L', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 青提牛乳冰 ¥16
  ('rec_qhj_135_1', 'RES_3101_009', 'pt_qhj_135', 'rm_qhj_052', 0.20, 'L',  true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_135_2', 'RES_3101_009', 'pt_qhj_135', 'rm_qhj_011', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  -- 营养多C番茄鱼[大份手工去刺] ¥188
  ('rec_qhj_136_1', 'RES_3101_009', 'pt_qhj_136', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_136_2', 'RES_3101_009', 'pt_qhj_136', 'rm_qhj_007', 0.80, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5'),
  ('rec_qhj_136_3', 'RES_3101_009', 'pt_qhj_136', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V5')
ON CONFLICT (id) DO NOTHING;

COMMIT;
