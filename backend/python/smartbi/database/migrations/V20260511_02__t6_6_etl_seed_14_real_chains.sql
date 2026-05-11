-- V20260511_02__t6_6_etl_seed_14_real_chains.sql
--
-- T6.6 Phase B Sub-ETL-3b — seed restaurant_chain_catalog with 14 real-data chains.
--
-- Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §1.4 + §2.4
-- Q1 amendment: docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md §4.3
-- Sign-off: Q-ETL-3 (factory_id naming per Q1 §4.3 verbatim;
--           R_HUOGUO_GENERIC_REAL kept separate from R_SHANGMA_HG_REAL;
--           _HG suffix retained on hot-pot chains) per spec §10.
--
-- Idempotent via ON CONFLICT (factory_id) DO NOTHING — re-runnable.
-- Rollback: DELETE FROM restaurant_chain_catalog WHERE source_kind = 'REAL';
--
-- Depends on: V20260511_01__t6_6_etl_chain_catalog.sql (table + chk_chain_source_kind
-- + PRIMARY KEY constraint). Sorted filename order guarantees V_01 applies first.
--
-- Special case — 青花椒: R_QINGHUAJIAO_REAL (this row) is the real Excel-import
-- factory and is INTENTIONALLY DISTINCT from existing RES_3101_009
-- (Apr-25 qhj demo seed, synthetic top-136 menu — 2026_04_25_qhj_demo_seed_v5.sql).
-- Both factory_ids coexist in smartbi_prod_db as isolated tenants per Q1 §4.3 footnote.

INSERT INTO restaurant_chain_catalog (factory_id, chain_name_zh, chain_name_roman, cuisine, source_kind, source_root_path, notes)
VALUES
  ('R_ILTEATRO_REAL',       'IL TEATRO 西餐', 'ILTEATRO',       'Western',  'REAL', 'IL TEATRO（西餐厅）2月_商品销量报表.xls', 'T6.6 Phase B real-DB import'),
  ('R_SHANGMA_HG_REAL',     '上马火锅',        'SHANGMA_HG',     'HotPot',   'REAL', '上马火锅（火锅）2月商品销量报表.xls',       'T6.6 Phase B real-DB import'),
  ('R_JINCHUAN_HG_REAL',    '锦川火锅',        'JINCHUAN_HG',    'HotPot',   'REAL', '锦川火锅5个月/',                            'T6.6 Phase B real-DB import (5-month series)'),
  ('R_XIMAXIANG_REAL',      '唏嘛香 牛肉面',   'XIMAXIANG',      'Noodles',  'REAL', '唏嘛香（牛肉面）2月销量报表.xls',           'T6.6 Phase B real-DB import'),
  ('R_YUJIUJING_REAL',      '御九井 日料',     'YUJIUJING',      'Japanese', 'REAL', '御九井（日料）2月_商品销量报表.xls',         'T6.6 Phase B real-DB import'),
  ('R_YONGHE_REAL',         '永和豆浆',        'YONGHE',         'FastFood', 'REAL', '永和豆浆（快餐）2月_商品销量报表.xls',       'T6.6 Phase B real-DB import'),
  ('R_XINBASHU_REAL',       '鑫巴蜀',          'XINBASHU',       'Sichuan',  'REAL', '鑫巴蜀5个月/',                              'T6.6 Phase B real-DB import (5-month series)'),
  ('R_QINGHUAJIAO_REAL',    '青花椒',          'QINGHUAJIAO',    'Sichuan',  'REAL', '青花椒/ + 青花椒25年/',                     'T6.6 Phase B real-DB import; distinct from RES_3101_009 demo seed'),
  ('R_DONGMENKOU_REAL',     '东门口',          'DONGMENKOU',     'Local',    'REAL', '东门口2月*.csv + 东门口25年/',               'T6.6 Phase B real-DB import (CSV + 2025 history)'),
  ('R_HONGDEJI_REAL',       '鸿德记',          'HONGDEJI',       NULL,       'REAL', '鸿德记5个月/',                              'T6.6 Phase B real-DB import (5-month series)'),
  ('R_JINRINIUSHI_REAL',    '今日牛事',        'JINRINIUSHI',    'Beef',     'REAL', '今日牛事5个月/',                            'T6.6 Phase B real-DB import (5-month series)'),
  ('R_YOUZIYOUWEI_REAL',    '有滋有味',        'YOUZIYOUWEI',    NULL,       'REAL', '有滋有味5个月/',                            'T6.6 Phase B real-DB import (5-month series)'),
  ('R_LINJIAYAN_REAL',      '邻家宴',          'LINJIAYAN',      NULL,       'REAL', '邻家宴5个月/',                              'T6.6 Phase B real-DB import (5-month series)'),
  ('R_HUOGUO_GENERIC_REAL', '火锅 (generic)',  'HUOGUO_GENERIC', 'HotPot',   'REAL', '火锅2月利润表.xls',                         'T6.6 Phase B real-DB import; kept separate from R_SHANGMA_HG_REAL per Q-ETL-3 sign-off (generic 利润表 vs sales-report distinction)')
ON CONFLICT (factory_id) DO NOTHING;
