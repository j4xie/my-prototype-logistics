-- qhj Plan C demo seed v4 — expand top 60 → top 100. Target ~85%+ revenue coverage.
-- Rollback: DELETE ... WHERE notes='PLAN_C_DEMO_SEED_2026_04_25_V4' AND factory_id='RES_3101_009'
BEGIN;

-- =====================================================================
-- 13 new raw materials (v4)
-- =====================================================================
INSERT INTO raw_material_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('rm_qhj_036', 'RES_3101_009', 'QHJ_RM_036', '莴笋',         'kg',   6.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_037', 'RES_3101_009', 'QHJ_RM_037', '金针菇',       'kg',  15.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_038', 'RES_3101_009', 'QHJ_RM_038', '豆花原料',     'kg',  10.00, '豆制品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_039', 'RES_3101_009', 'QHJ_RM_039', '鸡蛋',         'kg',  12.00, '蛋品',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_040', 'RES_3101_009', 'QHJ_RM_040', '茶油',         'L',   30.00, '调料',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_041', 'RES_3101_009', 'QHJ_RM_041', '肥肠',         'kg',  30.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_042', 'RES_3101_009', 'QHJ_RM_042', '鲍鱼',         'kg', 200.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_043', 'RES_3101_009', 'QHJ_RM_043', '猪蹄',         'kg',  40.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_044', 'RES_3101_009', 'QHJ_RM_044', '猪腰',         'kg',  35.00, '肉类',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_045', 'RES_3101_009', 'QHJ_RM_045', '豆面',         'kg',  10.00, '干货',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_046', 'RES_3101_009', 'QHJ_RM_046', '大黄鱼',       'kg',  80.00, '水产',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_047', 'RES_3101_009', 'QHJ_RM_047', '杂菌',         'kg',  25.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rm_qhj_048', 'RES_3101_009', 'QHJ_RM_048', '豆苗',         'kg',  15.00, '蔬菜',   true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- 40 new product_types (top 61-100 real dishes)
-- =====================================================================
INSERT INTO product_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('pt_qhj_061', 'RES_3101_009', 'QHJ_PT_061', '莴笋',                         '份', 10.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_062', 'RES_3101_009', 'QHJ_PT_062', '金针菇',                       '份', 10.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_063', 'RES_3101_009', 'QHJ_PT_063', '川式小炒黑猪肉',               '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_064', 'RES_3101_009', 'QHJ_PT_064', '沸腾麻辣鱼[活鱼现做]',         '份',118.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_065', 'RES_3101_009', 'QHJ_PT_065', '营养多C番茄鱼[小份]',          '份',128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_066', 'RES_3101_009', 'QHJ_PT_066', '特色青花椒鱼-手工去刺[小份]',  '份',128.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_067', 'RES_3101_009', 'QHJ_PT_067', '成都冒烤鸭(大份)',             '份',158.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_068', 'RES_3101_009', 'QHJ_PT_068', '暖冬鱼羊鲜(单人份)',           '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_069', 'RES_3101_009', 'QHJ_PT_069', '乐山把把串',                   '份', 36.00, '小吃', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_070', 'RES_3101_009', 'QHJ_PT_070', '手作冰豆花',                   '份',  9.00, '甜品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_071', 'RES_3101_009', 'QHJ_PT_071', '脆哨茶油蒸蛋',                 '份', 24.00, '小吃', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_072', 'RES_3101_009', 'QHJ_PT_072', '糯米樟茶鸭',                   '份', 46.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_073', 'RES_3101_009', 'QHJ_PT_073', '口水鸡',                       '份', 28.00, '凉菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_074', 'RES_3101_009', 'QHJ_PT_074', '豆腐皮',                       '份',  8.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_075', 'RES_3101_009', 'QHJ_PT_075', '江油鸭血肥肠',                 '份', 52.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_076', 'RES_3101_009', 'QHJ_PT_076', '响口三脆',                     '份', 68.00, '凉菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_077', 'RES_3101_009', 'QHJ_PT_077', '双人餐',                       '份',218.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_078', 'RES_3101_009', 'QHJ_PT_078', '川式鲍鱼小炒肉',               '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_079', 'RES_3101_009', 'QHJ_PT_079', '咸蛋黄鸡翅[4个]',              '份', 28.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_080', 'RES_3101_009', 'QHJ_PT_080', '特色青花椒鱼-手工去刺[大份]',  '份',168.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_081', 'RES_3101_009', 'QHJ_PT_081', '放心吃鱼品质双人套餐',         '份',268.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_082', 'RES_3101_009', 'QHJ_PT_082', '南乳蹄花鸡爪煲',               '份', 48.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_083', 'RES_3101_009', 'QHJ_PT_083', '脆肠爆腰花',                   '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_084', 'RES_3101_009', 'QHJ_PT_084', '牛腩牛筋煲',                   '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_085', 'RES_3101_009', 'QHJ_PT_085', '家烧豆面',                     '份', 42.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_086', 'RES_3101_009', 'QHJ_PT_086', '咸蛋黄牛蛙',                   '份', 24.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_087', 'RES_3101_009', 'QHJ_PT_087', '美鱼美蛙[活鱼现做]',           '份',138.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_088', 'RES_3101_009', 'QHJ_PT_088', '清蒸宁德大黄鱼',               '份', 78.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_089', 'RES_3101_009', 'QHJ_PT_089', '千页豆腐',                     '份', 10.00, '素菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_090', 'RES_3101_009', 'QHJ_PT_090', '古法秘制酸菜鱼(小份)',         '份',158.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_091', 'RES_3101_009', 'QHJ_PT_091', '手工糍粑',                     '份', 18.00, '甜品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_092', 'RES_3101_009', 'QHJ_PT_092', '川式小炒肉',                   '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_093', 'RES_3101_009', 'QHJ_PT_093', '成都冒烤鸭(小份)',             '份', 62.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_094', 'RES_3101_009', 'QHJ_PT_094', '古法秘制酸菜味(2-3人份)',      '份',198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_095', 'RES_3101_009', 'QHJ_PT_095', '杂菌煲',                       '份', 32.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_096', 'RES_3101_009', 'QHJ_PT_096', '凉拌鲜豆苗',                   '份', 22.00, '凉菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_097', 'RES_3101_009', 'QHJ_PT_097', '【无刺】招牌青花椒鱼(单人份)', '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_098', 'RES_3101_009', 'QHJ_PT_098', '来吃鱼鸭双人套餐',             '份',168.00, '套餐', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_099', 'RES_3101_009', 'QHJ_PT_099', '招牌秘制青花椒味(单人份)',     '份', 78.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('pt_qhj_100', 'RES_3101_009', 'QHJ_PT_100', '怪好吃多味(2-3人)',            '份',218.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4')
ON CONFLICT (factory_id, code) DO NOTHING;

-- =====================================================================
-- Recipes — food cost 25-38%
-- =====================================================================
INSERT INTO recipes (id, factory_id, product_type_id, raw_material_type_id, standard_quantity, unit, is_main_ingredient, is_active, created_by, created_at, updated_at, notes) VALUES
  ('rec_qhj_6101', 'RES_3101_009', 'pt_qhj_061', 'rm_qhj_036', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6201', 'RES_3101_009', 'pt_qhj_062', 'rm_qhj_037', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 川式小炒黑猪肉 ¥58, 五花肉 0.2+莴笋 0.1+油 0.05 = 10+0.6+0.6 = ¥11.2 (19%). 加酱 = ¥13.7 (23.6%)
  ('rec_qhj_6301', 'RES_3101_009', 'pt_qhj_063', 'rm_qhj_025', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6302', 'RES_3101_009', 'pt_qhj_063', 'rm_qhj_036', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6303', 'RES_3101_009', 'pt_qhj_063', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6304', 'RES_3101_009', 'pt_qhj_063', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 沸腾麻辣鱼 ¥118, 鲈鱼 0.55+油 0.25+酱 0.08
  ('rec_qhj_6401', 'RES_3101_009', 'pt_qhj_064', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6402', 'RES_3101_009', 'pt_qhj_064', 'rm_qhj_013', 0.25, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6403', 'RES_3101_009', 'pt_qhj_064', 'rm_qhj_015', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 营养多C番茄鱼[小份] ¥128
  ('rec_qhj_6501', 'RES_3101_009', 'pt_qhj_065', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6502', 'RES_3101_009', 'pt_qhj_065', 'rm_qhj_007', 0.50, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6503', 'RES_3101_009', 'pt_qhj_065', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 特色青花椒鱼-手工去刺[小份] ¥128
  ('rec_qhj_6601', 'RES_3101_009', 'pt_qhj_066', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6602', 'RES_3101_009', 'pt_qhj_066', 'rm_qhj_002', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6603', 'RES_3101_009', 'pt_qhj_066', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 成都冒烤鸭(大份) ¥158, 鸭腿 1.2+油 0.2+酱 0.05
  ('rec_qhj_6701', 'RES_3101_009', 'pt_qhj_067', 'rm_qhj_008', 1.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6702', 'RES_3101_009', 'pt_qhj_067', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6703', 'RES_3101_009', 'pt_qhj_067', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 暖冬鱼羊鲜(单人份) ¥58, 鲈鱼 0.2+牛肉 0.08+油 0.05
  ('rec_qhj_6801', 'RES_3101_009', 'pt_qhj_068', 'rm_qhj_001', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6802', 'RES_3101_009', 'pt_qhj_068', 'rm_qhj_003', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6803', 'RES_3101_009', 'pt_qhj_068', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 乐山把把串 ¥36, 串料 (五花+鸡翅+竹签) = 五花肉 0.1+鸡翅 0.06+油 0.03 = 5+1.68+0.36 = ¥7 (19%)
  ('rec_qhj_6901', 'RES_3101_009', 'pt_qhj_069', 'rm_qhj_025', 0.10, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6902', 'RES_3101_009', 'pt_qhj_069', 'rm_qhj_034', 0.06, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_6903', 'RES_3101_009', 'pt_qhj_069', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 手作冰豆花 ¥9, 豆花 0.2 = ¥2 (22%)
  ('rec_qhj_7001', 'RES_3101_009', 'pt_qhj_070', 'rm_qhj_038', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 脆哨茶油蒸蛋 ¥24, 鸡蛋 0.3+茶油 0.05+五花肉 0.03 = 3.6+1.5+1.5 = ¥6.6 (27.5%)
  ('rec_qhj_7101', 'RES_3101_009', 'pt_qhj_071', 'rm_qhj_039', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7102', 'RES_3101_009', 'pt_qhj_071', 'rm_qhj_040', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7103', 'RES_3101_009', 'pt_qhj_071', 'rm_qhj_025', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 糯米樟茶鸭 ¥46, 鸭腿 0.3+糯米 0.1+油 0.05 = 10.5+1.2+0.6 = ¥12.3 (26.7%)
  ('rec_qhj_7201', 'RES_3101_009', 'pt_qhj_072', 'rm_qhj_008', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7202', 'RES_3101_009', 'pt_qhj_072', 'rm_qhj_031', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7203', 'RES_3101_009', 'pt_qhj_072', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 口水鸡 ¥28, 鸡腿 0.25+酱 0.05+油 0.03 = 5.5+2.5+0.36 = ¥8.4 (30%)
  ('rec_qhj_7301', 'RES_3101_009', 'pt_qhj_073', 'rm_qhj_009', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7302', 'RES_3101_009', 'pt_qhj_073', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7303', 'RES_3101_009', 'pt_qhj_073', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 豆腐皮 ¥8, 豆腐皮 (腐竹代) 0.08 = ¥2.4 (30%)
  ('rec_qhj_7401', 'RES_3101_009', 'pt_qhj_074', 'rm_qhj_019', 0.08, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 江油鸭血肥肠 ¥52, 鸭血 0.3+肥肠 0.15+油 0.08 = 5.4+4.5+0.96 = ¥10.9 (20.8%)
  ('rec_qhj_7501', 'RES_3101_009', 'pt_qhj_075', 'rm_qhj_021', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7502', 'RES_3101_009', 'pt_qhj_075', 'rm_qhj_041', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7503', 'RES_3101_009', 'pt_qhj_075', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 响口三脆 ¥68, 猪腰 0.15+肥肠 0.1+油 0.05 = 5.25+3+0.6 = ¥8.85 (13%) → 添加鸡爪 0.1 = +2.5 = ¥11.4 (16.8%)
  ('rec_qhj_7601', 'RES_3101_009', 'pt_qhj_076', 'rm_qhj_044', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7602', 'RES_3101_009', 'pt_qhj_076', 'rm_qhj_041', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7603', 'RES_3101_009', 'pt_qhj_076', 'rm_qhj_029', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7604', 'RES_3101_009', 'pt_qhj_076', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 双人餐 ¥218, 综合: 鲈鱼 0.45+牛肉 0.15+鸡腿 0.15+油 0.25+酱 0.1
  ('rec_qhj_7701', 'RES_3101_009', 'pt_qhj_077', 'rm_qhj_001', 0.45, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7702', 'RES_3101_009', 'pt_qhj_077', 'rm_qhj_003', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7703', 'RES_3101_009', 'pt_qhj_077', 'rm_qhj_009', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7704', 'RES_3101_009', 'pt_qhj_077', 'rm_qhj_013', 0.25, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7705', 'RES_3101_009', 'pt_qhj_077', 'rm_qhj_015', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 川式鲍鱼小炒肉 ¥58, 鲍鱼 0.05+五花肉 0.1+油 0.05 = 10+5+0.6 = ¥15.6 (26.9%)
  ('rec_qhj_7801', 'RES_3101_009', 'pt_qhj_078', 'rm_qhj_042', 0.05, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7802', 'RES_3101_009', 'pt_qhj_078', 'rm_qhj_025', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7803', 'RES_3101_009', 'pt_qhj_078', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 咸蛋黄鸡翅[4个] ¥28, 鸡翅 0.25+鸡蛋 0.08 = 7+0.96 = ¥8 (28.5%)
  ('rec_qhj_7901', 'RES_3101_009', 'pt_qhj_079', 'rm_qhj_034', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_7902', 'RES_3101_009', 'pt_qhj_079', 'rm_qhj_039', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 特色青花椒鱼-手工去刺[大份]
  ('rec_qhj_8001', 'RES_3101_009', 'pt_qhj_080', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8002', 'RES_3101_009', 'pt_qhj_080', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8003', 'RES_3101_009', 'pt_qhj_080', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 放心吃鱼品质双人套餐 ¥268, 鲈鱼 1.0+青花椒 0.15+油 0.35+酱 0.15
  ('rec_qhj_8101', 'RES_3101_009', 'pt_qhj_081', 'rm_qhj_001', 1.00, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8102', 'RES_3101_009', 'pt_qhj_081', 'rm_qhj_002', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8103', 'RES_3101_009', 'pt_qhj_081', 'rm_qhj_013', 0.35, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8104', 'RES_3101_009', 'pt_qhj_081', 'rm_qhj_015', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 南乳蹄花鸡爪煲 ¥48, 猪蹄 0.2+鸡爪 0.15 = 8+3.75 = ¥11.75 (24.5%)
  ('rec_qhj_8201', 'RES_3101_009', 'pt_qhj_082', 'rm_qhj_043', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8202', 'RES_3101_009', 'pt_qhj_082', 'rm_qhj_029', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 脆肠爆腰花 ¥58, 猪腰 0.2+肥肠 0.1+油 0.05 = 7+3+0.6 = ¥10.6 (18%). 加酱 0.05 = +2.5 = ¥13.1 (22.6%)
  ('rec_qhj_8301', 'RES_3101_009', 'pt_qhj_083', 'rm_qhj_044', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8302', 'RES_3101_009', 'pt_qhj_083', 'rm_qhj_041', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8303', 'RES_3101_009', 'pt_qhj_083', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8304', 'RES_3101_009', 'pt_qhj_083', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 牛腩牛筋煲 ¥58, 牛肉 0.18+油 0.05 = 21.6+0.6 = ¥22.2 (38%)
  ('rec_qhj_8401', 'RES_3101_009', 'pt_qhj_084', 'rm_qhj_003', 0.18, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8402', 'RES_3101_009', 'pt_qhj_084', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 家烧豆面 ¥42, 豆面 0.2+五花肉 0.08+油 0.05 = 2+4+0.6 = ¥6.6 (15.7%)
  ('rec_qhj_8501', 'RES_3101_009', 'pt_qhj_085', 'rm_qhj_045', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8502', 'RES_3101_009', 'pt_qhj_085', 'rm_qhj_025', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8503', 'RES_3101_009', 'pt_qhj_085', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 咸蛋黄牛蛙 ¥24, 牛蛙 0.15+鸡蛋 0.05 = 9.75+0.6 = ¥10.35 (43%), 主料贵, 合理
  ('rec_qhj_8601', 'RES_3101_009', 'pt_qhj_086', 'rm_qhj_024', 0.15, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8602', 'RES_3101_009', 'pt_qhj_086', 'rm_qhj_039', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 美鱼美蛙[活鱼现做] ¥138 (same as 美鱼美蛙)
  ('rec_qhj_8701', 'RES_3101_009', 'pt_qhj_087', 'rm_qhj_001', 0.45, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8702', 'RES_3101_009', 'pt_qhj_087', 'rm_qhj_024', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8703', 'RES_3101_009', 'pt_qhj_087', 'rm_qhj_013', 0.25, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 清蒸宁德大黄鱼 ¥78, 黄鱼 0.35+油 0.04+生姜 0.02 = 28+0.48+0.16 = ¥28.6 (36.7%)
  ('rec_qhj_8801', 'RES_3101_009', 'pt_qhj_088', 'rm_qhj_046', 0.35, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8802', 'RES_3101_009', 'pt_qhj_088', 'rm_qhj_013', 0.04, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8803', 'RES_3101_009', 'pt_qhj_088', 'rm_qhj_014', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 千页豆腐 ¥10, 豆腐 0.2+油 0.03 = 1.6+0.36 = ¥2 (20%)
  ('rec_qhj_8901', 'RES_3101_009', 'pt_qhj_089', 'rm_qhj_005', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_8902', 'RES_3101_009', 'pt_qhj_089', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 古法秘制酸菜鱼(小份) ¥158, 鲈鱼 0.55+酸菜 0.2+油 0.2
  ('rec_qhj_9001', 'RES_3101_009', 'pt_qhj_090', 'rm_qhj_001', 0.55, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9002', 'RES_3101_009', 'pt_qhj_090', 'rm_qhj_022', 0.20, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9003', 'RES_3101_009', 'pt_qhj_090', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 手工糍粑 ¥18, 糯米 0.12+红糖 0.02 = 1.44+0.3 = ¥1.74 (9.7%)
  ('rec_qhj_9101', 'RES_3101_009', 'pt_qhj_091', 'rm_qhj_031', 0.12, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9102', 'RES_3101_009', 'pt_qhj_091', 'rm_qhj_010', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 川式小炒肉 ¥58, 五花肉 0.2+莴笋 0.1+油 0.05
  ('rec_qhj_9201', 'RES_3101_009', 'pt_qhj_092', 'rm_qhj_025', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9202', 'RES_3101_009', 'pt_qhj_092', 'rm_qhj_036', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9203', 'RES_3101_009', 'pt_qhj_092', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 成都冒烤鸭(小份) ¥62, 鸭腿 0.4+油 0.08+酱 0.03
  ('rec_qhj_9301', 'RES_3101_009', 'pt_qhj_093', 'rm_qhj_008', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9302', 'RES_3101_009', 'pt_qhj_093', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9303', 'RES_3101_009', 'pt_qhj_093', 'rm_qhj_015', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 古法秘制酸菜味(2-3人份) ¥198, 鲈鱼 0.8+酸菜 0.25+油 0.3
  ('rec_qhj_9401', 'RES_3101_009', 'pt_qhj_094', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9402', 'RES_3101_009', 'pt_qhj_094', 'rm_qhj_022', 0.25, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9403', 'RES_3101_009', 'pt_qhj_094', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 杂菌煲 ¥32, 杂菌 0.3+豆腐 0.1+油 0.03 = 7.5+0.8+0.36 = ¥8.7 (27%)
  ('rec_qhj_9501', 'RES_3101_009', 'pt_qhj_095', 'rm_qhj_047', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9502', 'RES_3101_009', 'pt_qhj_095', 'rm_qhj_005', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9503', 'RES_3101_009', 'pt_qhj_095', 'rm_qhj_013', 0.03, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 凉拌鲜豆苗 ¥22, 豆苗 0.3 = ¥4.5 (20%)
  ('rec_qhj_9601', 'RES_3101_009', 'pt_qhj_096', 'rm_qhj_048', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 【无刺】招牌青花椒鱼(单人份) ¥58
  ('rec_qhj_9701', 'RES_3101_009', 'pt_qhj_097', 'rm_qhj_001', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9702', 'RES_3101_009', 'pt_qhj_097', 'rm_qhj_002', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9703', 'RES_3101_009', 'pt_qhj_097', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 来吃鱼鸭双人套餐 ¥168, 鲈鱼 0.4+鸭腿 0.3+油 0.2+酱 0.08
  ('rec_qhj_9801', 'RES_3101_009', 'pt_qhj_098', 'rm_qhj_001', 0.40, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9802', 'RES_3101_009', 'pt_qhj_098', 'rm_qhj_008', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9803', 'RES_3101_009', 'pt_qhj_098', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9804', 'RES_3101_009', 'pt_qhj_098', 'rm_qhj_015', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 招牌秘制青花椒味(单人份) ¥78, 鲈鱼 0.3+青花椒 0.04+油 0.12+酱 0.05
  ('rec_qhj_9901', 'RES_3101_009', 'pt_qhj_099', 'rm_qhj_001', 0.30, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9902', 'RES_3101_009', 'pt_qhj_099', 'rm_qhj_002', 0.04, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9903', 'RES_3101_009', 'pt_qhj_099', 'rm_qhj_013', 0.12, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_9904', 'RES_3101_009', 'pt_qhj_099', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  -- 怪好吃多味(2-3人) ¥218, 鲈鱼 0.9+青花椒 0.12+油 0.35+酱 0.15
  ('rec_qhj_100_1', 'RES_3101_009', 'pt_qhj_100', 'rm_qhj_001', 0.90, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_100_2', 'RES_3101_009', 'pt_qhj_100', 'rm_qhj_002', 0.12, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_100_3', 'RES_3101_009', 'pt_qhj_100', 'rm_qhj_013', 0.35, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4'),
  ('rec_qhj_100_4', 'RES_3101_009', 'pt_qhj_100', 'rm_qhj_015', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25_V4')
ON CONFLICT (id) DO NOTHING;

COMMIT;
