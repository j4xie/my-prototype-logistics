-- Demo seed for qhj_prod (RES_3101_009) to visualize Plan C dashboards.
-- All rows tagged notes 'PLAN_C_DEMO_SEED_2026_04_25' for easy rollback:
--   DELETE FROM recipes WHERE notes='PLAN_C_DEMO_SEED_2026_04_25' AND factory_id='RES_3101_009';
--   DELETE FROM wastage_records WHERE notes='PLAN_C_DEMO_SEED_2026_04_25' AND factory_id='RES_3101_009';
--   DELETE FROM factory_material_requisition_items WHERE requisition_id IN
--     (SELECT id FROM factory_material_requisitions WHERE notes='PLAN_C_DEMO_SEED_2026_04_25' AND factory_id='RES_3101_009');
--   DELETE FROM factory_material_requisitions WHERE notes='PLAN_C_DEMO_SEED_2026_04_25' AND factory_id='RES_3101_009';
--   DELETE FROM product_types WHERE notes='PLAN_C_DEMO_SEED_2026_04_25' AND factory_id='RES_3101_009';
--   DELETE FROM raw_material_types WHERE notes='PLAN_C_DEMO_SEED_2026_04_25' AND factory_id='RES_3101_009';
--
-- Source: top 10 qhj dishes by revenue from Gold fact_pos_item.
-- Food cost ratios tuned to realistic 川菜 margins: proteins 35-40%, sides 25-30%, beverages 15-20%.

BEGIN;

-- ==========================================================================
-- 1. Raw materials (食材) — 15 common 川菜 ingredients with prices (元/kg or 元/单位)
-- ==========================================================================
INSERT INTO raw_material_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('rm_qhj_001', 'RES_3101_009', 'QHJ_RM_001', '鲈鱼', 'kg', 45.00, '水产', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_002', 'RES_3101_009', 'QHJ_RM_002', '青花椒', 'kg', 80.00, '调料', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_003', 'RES_3101_009', 'QHJ_RM_003', '牛肉(吊龙)', 'kg', 120.00, '肉类', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_004', 'RES_3101_009', 'QHJ_RM_004', '大米', 'kg', 6.00, '主食', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_005', 'RES_3101_009', 'QHJ_RM_005', '豆腐', 'kg', 8.00, '豆制品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_006', 'RES_3101_009', 'QHJ_RM_006', '牛骨髓', 'kg', 60.00, '肉类', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_007', 'RES_3101_009', 'QHJ_RM_007', '番茄', 'kg', 10.00, '蔬菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_008', 'RES_3101_009', 'QHJ_RM_008', '鸭腿', 'kg', 35.00, '肉类', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_009', 'RES_3101_009', 'QHJ_RM_009', '鸡腿', 'kg', 22.00, '肉类', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_010', 'RES_3101_009', 'QHJ_RM_010', '红糖', 'kg', 15.00, '调料', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_011', 'RES_3101_009', 'QHJ_RM_011', '冰粉原料', 'kg', 28.00, '干货', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_012', 'RES_3101_009', 'QHJ_RM_012', '打包盒(一次性)', '个', 0.80, '耗材', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_013', 'RES_3101_009', 'QHJ_RM_013', '食用油', 'L', 12.00, '调料', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_014', 'RES_3101_009', 'QHJ_RM_014', '生姜', 'kg', 8.00, '蔬菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rm_qhj_015', 'RES_3101_009', 'QHJ_RM_015', '酱料(秘制)', 'kg', 50.00, '调料', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25')
ON CONFLICT (factory_id, code) DO NOTHING;

-- ==========================================================================
-- 2. Product types (菜品) — top 10 qhj real dishes
-- ==========================================================================
INSERT INTO product_types (id, factory_id, code, name, unit, unit_price, category, is_active, created_by, created_at, updated_at, notes) VALUES
  ('pt_qhj_001', 'RES_3101_009', 'QHJ_PT_001', '招牌青花椒味(单人份)', '份', 58.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_002', 'RES_3101_009', 'QHJ_PT_002', '招牌青花椒鱼可乐单人套餐', '份', 62.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_003', 'RES_3101_009', 'QHJ_PT_003', '米饭', '份', 10.00, '主食', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_004', 'RES_3101_009', 'QHJ_PT_004', '招牌青花椒味(2-3人份)', '份', 198.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_005', 'RES_3101_009', 'QHJ_PT_005', '招牌青花椒味(小份)', '份', 158.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_006', 'RES_3101_009', 'QHJ_PT_006', '小炒现切吊龙', '份', 68.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_007', 'RES_3101_009', 'QHJ_PT_007', '经典红糖冰粉', '份', 18.00, '饮品', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_008', 'RES_3101_009', 'QHJ_PT_008', '成都冒烤鸭(单人份)', '份', 78.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_009', 'RES_3101_009', 'QHJ_PT_009', '古法盐焗鸡', '份', 88.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('pt_qhj_010', 'RES_3101_009', 'QHJ_PT_010', '牛骨髓麻婆豆腐', '份', 48.00, '主菜', true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25')
ON CONFLICT (factory_id, code) DO NOTHING;

-- ==========================================================================
-- 3. Recipes (配方) — 2-4 ingredients per dish, targeted 30-40% food cost
--    Cost 算式: qty * unit_price of raw material
-- ==========================================================================
-- 招牌青花椒味(单人份) ¥58, 食材成本 ¥20 (34.5%): 鲈鱼 0.25kg + 青花椒 0.03kg + 食用油 0.1L + 酱料 0.05kg
INSERT INTO recipes (id, factory_id, product_type_id, raw_material_type_id, standard_quantity, unit, is_main_ingredient, is_active, created_by, created_at, updated_at, notes) VALUES
  ('rec_qhj_0101', 'RES_3101_009', 'pt_qhj_001', 'rm_qhj_001', 0.25, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0102', 'RES_3101_009', 'pt_qhj_001', 'rm_qhj_002', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0103', 'RES_3101_009', 'pt_qhj_001', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0104', 'RES_3101_009', 'pt_qhj_001', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 招牌青花椒鱼可乐单人套餐 ¥62, 食材 ¥22 (35%): 鲈鱼 0.28kg + 青花椒 0.03kg + 食用油 0.1L
  ('rec_qhj_0201', 'RES_3101_009', 'pt_qhj_002', 'rm_qhj_001', 0.28, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0202', 'RES_3101_009', 'pt_qhj_002', 'rm_qhj_002', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0203', 'RES_3101_009', 'pt_qhj_002', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 米饭 ¥10, 食材 ¥2.4 (24%): 大米 0.2kg + 打包盒 1.5
  ('rec_qhj_0301', 'RES_3101_009', 'pt_qhj_003', 'rm_qhj_004', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0302', 'RES_3101_009', 'pt_qhj_003', 'rm_qhj_012', 1.50, '个', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 招牌青花椒味(2-3人份) ¥198, 食材 ¥66 (33%): 鲈鱼 0.8kg + 青花椒 0.1kg + 食用油 0.3L + 酱料 0.15kg
  ('rec_qhj_0401', 'RES_3101_009', 'pt_qhj_004', 'rm_qhj_001', 0.80, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0402', 'RES_3101_009', 'pt_qhj_004', 'rm_qhj_002', 0.10, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0403', 'RES_3101_009', 'pt_qhj_004', 'rm_qhj_013', 0.30, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0404', 'RES_3101_009', 'pt_qhj_004', 'rm_qhj_015', 0.15, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 招牌青花椒味(小份) ¥158, 食材 ¥50 (31.6%): 鲈鱼 0.6kg + 青花椒 0.08kg + 食用油 0.2L
  ('rec_qhj_0501', 'RES_3101_009', 'pt_qhj_005', 'rm_qhj_001', 0.60, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0502', 'RES_3101_009', 'pt_qhj_005', 'rm_qhj_002', 0.08, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0503', 'RES_3101_009', 'pt_qhj_005', 'rm_qhj_013', 0.20, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 小炒现切吊龙 ¥68, 食材 ¥26 (38%): 牛肉 0.2kg + 食用油 0.08L + 生姜 0.02kg
  ('rec_qhj_0601', 'RES_3101_009', 'pt_qhj_006', 'rm_qhj_003', 0.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0602', 'RES_3101_009', 'pt_qhj_006', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0603', 'RES_3101_009', 'pt_qhj_006', 'rm_qhj_014', 0.02, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 经典红糖冰粉 ¥18, 食材 ¥3.5 (19%): 红糖 0.05kg + 冰粉原料 0.08kg
  ('rec_qhj_0701', 'RES_3101_009', 'pt_qhj_007', 'rm_qhj_011', 0.08, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0702', 'RES_3101_009', 'pt_qhj_007', 'rm_qhj_010', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 成都冒烤鸭(单人份) ¥78, 食材 ¥28 (36%): 鸭腿 0.5kg + 食用油 0.1L + 酱料 0.03kg
  ('rec_qhj_0801', 'RES_3101_009', 'pt_qhj_008', 'rm_qhj_008', 0.50, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0802', 'RES_3101_009', 'pt_qhj_008', 'rm_qhj_013', 0.10, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0803', 'RES_3101_009', 'pt_qhj_008', 'rm_qhj_015', 0.03, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 古法盐焗鸡 ¥88, 食材 ¥30 (34%): 鸡腿 1.2kg + 食用油 0.05L + 生姜 0.05kg
  ('rec_qhj_0901', 'RES_3101_009', 'pt_qhj_009', 'rm_qhj_009', 1.20, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0902', 'RES_3101_009', 'pt_qhj_009', 'rm_qhj_013', 0.05, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_0903', 'RES_3101_009', 'pt_qhj_009', 'rm_qhj_014', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),

-- 牛骨髓麻婆豆腐 ¥48, 食材 ¥16 (33%): 牛骨髓 0.1kg + 豆腐 0.3kg + 食用油 0.08L + 酱料 0.05kg
  ('rec_qhj_1001', 'RES_3101_009', 'pt_qhj_010', 'rm_qhj_006', 0.10, 'kg', true,  true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_1002', 'RES_3101_009', 'pt_qhj_010', 'rm_qhj_005', 0.30, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_1003', 'RES_3101_009', 'pt_qhj_010', 'rm_qhj_013', 0.08, 'L',  false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('rec_qhj_1004', 'RES_3101_009', 'pt_qhj_010', 'rm_qhj_015', 0.05, 'kg', false, true, 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25')
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 4. Wastage records (损耗单) — 6 records, recent 30 days, types: EXPIRED / DAMAGED / OTHER
-- ==========================================================================
INSERT INTO wastage_records (id, factory_id, wastage_number, wastage_date, type, status, raw_material_type_id, quantity, unit, estimated_cost, reason, reported_by, created_at, updated_at, notes) VALUES
  ('was_qhj_001', 'RES_3101_009', 'W-DEMO-001', CURRENT_DATE - 2,  'EXPIRED', 'APPROVED', 'rm_qhj_001', 3.5,  'kg', 157.50, '鲈鱼过冷藏期 3 天', 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('was_qhj_002', 'RES_3101_009', 'W-DEMO-002', CURRENT_DATE - 5,  'DAMAGED', 'APPROVED', 'rm_qhj_005', 2.0,  'kg', 16.00,  '豆腐运输破损', 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('was_qhj_003', 'RES_3101_009', 'W-DEMO-003', CURRENT_DATE - 7,  'EXPIRED', 'APPROVED', 'rm_qhj_007', 5.0,  'kg', 50.00,  '番茄储存过期', 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('was_qhj_004', 'RES_3101_009', 'W-DEMO-004', CURRENT_DATE - 12, 'EXPIRED', 'APPROVED', 'rm_qhj_001', 2.8,  'kg', 126.00, '鲈鱼备货过量', 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('was_qhj_005', 'RES_3101_009', 'W-DEMO-005', CURRENT_DATE - 18, 'OTHER',   'APPROVED', 'rm_qhj_008', 1.5,  'kg', 52.50,  '鸭腿烹饪试菜报废', 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25'),
  ('was_qhj_006', 'RES_3101_009', 'W-DEMO-006', CURRENT_DATE - 25, 'DAMAGED', 'APPROVED', 'rm_qhj_003', 0.8,  'kg', 96.00,  '牛肉解冻时间过长', 1550, NOW(), NOW(), 'PLAN_C_DEMO_SEED_2026_04_25')
ON CONFLICT (id) DO NOTHING;

COMMIT;
