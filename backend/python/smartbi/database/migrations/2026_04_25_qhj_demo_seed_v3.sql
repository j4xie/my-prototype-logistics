-- qhj Plan C demo seed v3 — expand top 35 → top 60 dishes.
-- Target: ~75% revenue coverage.
-- Rollback: DELETE ... WHERE notes='PLAN_C_DEMO_SEED_2026_04_25_V3' AND factory_id='RES_3101_009'
BEGIN;

-- =====================================================================
-- 10 new raw materials (v3)
-- =====================================================================
INSERT INTO raw_material_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('rm_qhj_026', 'RES_3101_009', 'QHJ_RM_026', '竹笋',         'kg',  20.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_027', 'RES_3101_009', 'QHJ_RM_027', '生菜',         'kg',   5.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_028', 'RES_3101_009', 'QHJ_RM_028', '娃娃菜',       'kg',   8.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_029', 'RES_3101_009', 'QHJ_RM_029', '鸡爪',         'kg',  25.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_030', 'RES_3101_009', 'QHJ_RM_030', '黑鱼',         'kg',  50.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_031', 'RES_3101_009', 'QHJ_RM_031', '糯米',         'kg',  12.00, '主食',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_032', 'RES_3101_009', 'QHJ_RM_032', '蕨根粉',       'kg',  35.00, '干货',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_033', 'RES_3101_009', 'QHJ_RM_033', '小管鱿鱼',     'kg',  55.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_034', 'RES_3101_009', 'QHJ_RM_034', '鸡翅',         'kg',  28.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rm_qhj_035', 'RES_3101_009', 'QHJ_RM_035', '虾仁',         'kg', 120.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- 25 new product_types (top 36-60 real dishes)
-- =====================================================================
INSERT INTO product_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('pt_qhj_036', 'RES_3101_009', 'QHJ_PT_036', '剁椒跳跳蛙',                           '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_037', 'RES_3101_009', 'QHJ_PT_037', '爆香麻辣水煮鱼(单人份)',               '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_038', 'RES_3101_009', 'QHJ_PT_038', '鸡汁纸片笋',                           '份', 32.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_039', 'RES_3101_009', 'QHJ_PT_039', '白灼生菜',                             '份', 20.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_040', 'RES_3101_009', 'QHJ_PT_040', '肉沫包浆豆腐煲',                       '份', 32.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_041', 'RES_3101_009', 'QHJ_PT_041', '宫爆超大虾球',                         '份', 68.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_042', 'RES_3101_009', 'QHJ_PT_042', '招牌秘制青花椒味(1-2人)',              '份',198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_043', 'RES_3101_009', 'QHJ_PT_043', '美鱼美蛙',                             '份',148.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_044', 'RES_3101_009', 'QHJ_PT_044', '娃娃菜',                               '份',  8.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_045', 'RES_3101_009', 'QHJ_PT_045', '峨边脆笋',                             '份', 12.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_046', 'RES_3101_009', 'QHJ_PT_046', '山城小酥肉',                           '份', 26.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_047', 'RES_3101_009', 'QHJ_PT_047', '麻辣干锅鱼片[黑鱼]',                   '份',108.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_048', 'RES_3101_009', 'QHJ_PT_048', '营养多C番茄味(2-3人份)',               '份',198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_049', 'RES_3101_009', 'QHJ_PT_049', '柠檬手舂无骨鸡爪',                     '份', 32.00, '凉菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_050', 'RES_3101_009', 'QHJ_PT_050', '金汤肥牛酸菜鱼(单人份)',               '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_051', 'RES_3101_009', 'QHJ_PT_051', '招牌青花椒鱼(微麻微辣)[大份小心鱼刺]', '份',168.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_052', 'RES_3101_009', 'QHJ_PT_052', '营养多C番茄味(小份)',                  '份',158.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_053', 'RES_3101_009', 'QHJ_PT_053', '红糖夹心糍粑',                         '份', 20.00, '甜品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_054', 'RES_3101_009', 'QHJ_PT_054', '酸辣蕨根粉',                           '份', 14.00, '凉菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_055', 'RES_3101_009', 'QHJ_PT_055', '金牌蒜蓉粉丝虾仁',                     '份', 48.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_056', 'RES_3101_009', 'QHJ_PT_056', '铜锅霸道牛蛙虾',                       '份', 98.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_057', 'RES_3101_009', 'QHJ_PT_057', '咸蛋黄鸡翅',                           '份', 22.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_058', 'RES_3101_009', 'QHJ_PT_058', '金汤肥牛酸菜鱼',                       '份',148.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_059', 'RES_3101_009', 'QHJ_PT_059', '鱼羊鲜',                               '份', 88.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('pt_qhj_060', 'RES_3101_009', 'QHJ_PT_060', '手钓东山小管',                         '份', 68.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- Recipes — food cost ratio 25-38%
-- =====================================================================
INSERT INTO recipes (id, factory_id, product_type_id, raw_material_type_id, standard_quantity, unit, is_main_ingredient, is_active, created_by, created_at, updated_at, notes) VALUES
  -- 剁椒跳跳蛙 ¥58, 牛蛙 0.3+油 0.08+酱 0.05 = 19.5+0.96+2.5 = ¥23 (39.7%)
  ('rec_qhj_3601', 'RES_3101_009', 'pt_qhj_036', 'rm_qhj_024', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_3602', 'RES_3101_009', 'pt_qhj_036', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_3603', 'RES_3101_009', 'pt_qhj_036', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 爆香麻辣水煮鱼(单人份) ¥58, 鲈鱼 0.28+油 0.12+酱 0.05 = 12.6+1.44+2.5 = ¥16.5 (28.5%)
  ('rec_qhj_3701', 'RES_3101_009', 'pt_qhj_037', 'rm_qhj_001', 0.28, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_3702', 'RES_3101_009', 'pt_qhj_037', 'rm_qhj_013', 0.12, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_3703', 'RES_3101_009', 'pt_qhj_037', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 鸡汁纸片笋 ¥32, 竹笋 0.3+鸡腿 0.05+油 0.05 = 6+1.1+0.6 = ¥7.7 (24%)
  ('rec_qhj_3801', 'RES_3101_009', 'pt_qhj_038', 'rm_qhj_026', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_3802', 'RES_3101_009', 'pt_qhj_038', 'rm_qhj_009', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_3803', 'RES_3101_009', 'pt_qhj_038', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 白灼生菜 ¥20, 生菜 0.4+油 0.03 = 2+0.36 = ¥2.4 (12%)
  ('rec_qhj_3901', 'RES_3101_009', 'pt_qhj_039', 'rm_qhj_027', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_3902', 'RES_3101_009', 'pt_qhj_039', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 肉沫包浆豆腐煲 ¥32, 豆腐 0.3+五花肉 0.1+油 0.05 = 2.4+5+0.6 = ¥8 (25%)
  ('rec_qhj_4001', 'RES_3101_009', 'pt_qhj_040', 'rm_qhj_005', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4002', 'RES_3101_009', 'pt_qhj_040', 'rm_qhj_025', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4003', 'RES_3101_009', 'pt_qhj_040', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 宫爆超大虾球 ¥68, 虾仁 0.15+油 0.08+酱 0.03 = 18+0.96+1.5 = ¥20.5 (30%)
  ('rec_qhj_4101', 'RES_3101_009', 'pt_qhj_041', 'rm_qhj_035', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4102', 'RES_3101_009', 'pt_qhj_041', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4103', 'RES_3101_009', 'pt_qhj_041', 'rm_qhj_015', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 招牌秘制青花椒味(1-2人) ¥198, 鲈鱼 0.8+青花椒 0.1+油 0.3+酱 0.15
  ('rec_qhj_4201', 'RES_3101_009', 'pt_qhj_042', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4202', 'RES_3101_009', 'pt_qhj_042', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4203', 'RES_3101_009', 'pt_qhj_042', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4204', 'RES_3101_009', 'pt_qhj_042', 'rm_qhj_015', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 美鱼美蛙 ¥148, 鲈鱼 0.45+牛蛙 0.3+油 0.25+青花椒 0.06
  ('rec_qhj_4301', 'RES_3101_009', 'pt_qhj_043', 'rm_qhj_001', 0.45, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4302', 'RES_3101_009', 'pt_qhj_043', 'rm_qhj_024', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4303', 'RES_3101_009', 'pt_qhj_043', 'rm_qhj_013', 0.25, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4304', 'RES_3101_009', 'pt_qhj_043', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 娃娃菜 ¥8, 娃娃菜 0.15 = ¥1.2 (15%)
  ('rec_qhj_4401', 'RES_3101_009', 'pt_qhj_044', 'rm_qhj_028', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 峨边脆笋 ¥12, 竹笋 0.15 = ¥3 (25%)
  ('rec_qhj_4501', 'RES_3101_009', 'pt_qhj_045', 'rm_qhj_026', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 山城小酥肉 ¥26, 五花肉 0.12+油 0.05 = 6+0.6 = ¥6.6 (25%)
  ('rec_qhj_4601', 'RES_3101_009', 'pt_qhj_046', 'rm_qhj_025', 0.12, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4602', 'RES_3101_009', 'pt_qhj_046', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 麻辣干锅鱼片[黑鱼] ¥108, 黑鱼 0.55+油 0.15+酱 0.08 = 27.5+1.8+4 = ¥33 (30.5%)
  ('rec_qhj_4701', 'RES_3101_009', 'pt_qhj_047', 'rm_qhj_030', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4702', 'RES_3101_009', 'pt_qhj_047', 'rm_qhj_013', 0.15, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4703', 'RES_3101_009', 'pt_qhj_047', 'rm_qhj_015', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 营养多C番茄味(2-3人份) ¥198, 鲈鱼 0.85+番茄 1.0+油 0.3
  ('rec_qhj_4801', 'RES_3101_009', 'pt_qhj_048', 'rm_qhj_001', 0.85, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4802', 'RES_3101_009', 'pt_qhj_048', 'rm_qhj_007', 1.00, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_4803', 'RES_3101_009', 'pt_qhj_048', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 柠檬手舂无骨鸡爪 ¥32, 鸡爪 0.25 = ¥6.25 (19.5%)
  ('rec_qhj_4901', 'RES_3101_009', 'pt_qhj_049', 'rm_qhj_029', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 金汤肥牛酸菜鱼(单人份) ¥58, 鲈鱼 0.2+牛肉 0.1+酸菜 0.1+油 0.08
  ('rec_qhj_5001', 'RES_3101_009', 'pt_qhj_050', 'rm_qhj_001', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5002', 'RES_3101_009', 'pt_qhj_050', 'rm_qhj_003', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5003', 'RES_3101_009', 'pt_qhj_050', 'rm_qhj_022', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5004', 'RES_3101_009', 'pt_qhj_050', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 招牌青花椒鱼[大份小心鱼刺] ¥168
  ('rec_qhj_5101', 'RES_3101_009', 'pt_qhj_051', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5102', 'RES_3101_009', 'pt_qhj_051', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5103', 'RES_3101_009', 'pt_qhj_051', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 营养多C番茄味(小份) ¥158, 鲈鱼 0.55+番茄 0.6+油 0.2
  ('rec_qhj_5201', 'RES_3101_009', 'pt_qhj_052', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5202', 'RES_3101_009', 'pt_qhj_052', 'rm_qhj_007', 0.60, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5203', 'RES_3101_009', 'pt_qhj_052', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 红糖夹心糍粑 ¥20, 糯米 0.15+红糖 0.03 = 1.8+0.45 = ¥2.3 (11.5%)
  ('rec_qhj_5301', 'RES_3101_009', 'pt_qhj_053', 'rm_qhj_031', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5302', 'RES_3101_009', 'pt_qhj_053', 'rm_qhj_010', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 酸辣蕨根粉 ¥14, 蕨根粉 0.1 = ¥3.5 (25%)
  ('rec_qhj_5401', 'RES_3101_009', 'pt_qhj_054', 'rm_qhj_032', 0.10, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 金牌蒜蓉粉丝虾仁 ¥48, 虾仁 0.1+生姜 0.02+油 0.05 = 12+0.16+0.6 = ¥12.8 (26.7%)
  ('rec_qhj_5501', 'RES_3101_009', 'pt_qhj_055', 'rm_qhj_035', 0.10, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5502', 'RES_3101_009', 'pt_qhj_055', 'rm_qhj_014', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5503', 'RES_3101_009', 'pt_qhj_055', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 铜锅霸道牛蛙虾 ¥98, 牛蛙 0.3+罗氏虾 0.15+油 0.1 = 19.5+13.5+1.2 = ¥34.2 (35%)
  ('rec_qhj_5601', 'RES_3101_009', 'pt_qhj_056', 'rm_qhj_024', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5602', 'RES_3101_009', 'pt_qhj_056', 'rm_qhj_016', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5603', 'RES_3101_009', 'pt_qhj_056', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 咸蛋黄鸡翅 ¥22, 鸡翅 0.2+油 0.04 = 5.6+0.48 = ¥6.1 (27.7%)
  ('rec_qhj_5701', 'RES_3101_009', 'pt_qhj_057', 'rm_qhj_034', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5702', 'RES_3101_009', 'pt_qhj_057', 'rm_qhj_013', 0.04, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 金汤肥牛酸菜鱼 ¥148, 鲈鱼 0.5+牛肉 0.25+酸菜 0.2+油 0.2
  ('rec_qhj_5801', 'RES_3101_009', 'pt_qhj_058', 'rm_qhj_001', 0.50, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5802', 'RES_3101_009', 'pt_qhj_058', 'rm_qhj_003', 0.25, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5803', 'RES_3101_009', 'pt_qhj_058', 'rm_qhj_022', 0.20, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5804', 'RES_3101_009', 'pt_qhj_058', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 鱼羊鲜 ¥88, 鲈鱼 0.3+牛肉 0.15+油 0.1 = 13.5+18+1.2 = ¥32.7 (37%)
  ('rec_qhj_5901', 'RES_3101_009', 'pt_qhj_059', 'rm_qhj_001', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5902', 'RES_3101_009', 'pt_qhj_059', 'rm_qhj_003', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_5903', 'RES_3101_009', 'pt_qhj_059', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),

  -- 手钓东山小管 ¥68, 小管鱿鱼 0.35+油 0.08 = 19.25+0.96 = ¥20.2 (29.7%)
  ('rec_qhj_6001', 'RES_3101_009', 'pt_qhj_060', 'rm_qhj_033', 0.35, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3'),
  ('rec_qhj_6002', 'RES_3101_009', 'pt_qhj_060', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V3')
ON CONFLICT (id) DO NOTHING;

COMMIT;
