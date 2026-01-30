--
-- PostgreSQL Database Conversion
-- Source: mall_center.sql (MySQL)
-- Target: PostgreSQL
-- Date: 2026-01-28
-- Tables: 41
--

-- ============================================================
-- 触发器函数：用于实现 ON UPDATE CURRENT_TIMESTAMP
-- ============================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. gen_table - 代码生成业务表
-- ============================================================
DROP TABLE IF EXISTS gen_table CASCADE;
CREATE TABLE gen_table (
  table_id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(200) DEFAULT '',
  table_comment VARCHAR(500) DEFAULT '',
  sub_table_name VARCHAR(64) DEFAULT NULL,
  sub_table_fk_name VARCHAR(64) DEFAULT NULL,
  class_name VARCHAR(100) DEFAULT '',
  tpl_category VARCHAR(200) DEFAULT 'crud',
  tpl_web_type VARCHAR(30) DEFAULT '',
  package_name VARCHAR(100) DEFAULT NULL,
  module_name VARCHAR(30) DEFAULT NULL,
  business_name VARCHAR(30) DEFAULT NULL,
  function_name VARCHAR(50) DEFAULT NULL,
  function_author VARCHAR(50) DEFAULT NULL,
  gen_type CHAR(1) DEFAULT '0',
  gen_path VARCHAR(200) DEFAULT '/',
  options VARCHAR(1000) DEFAULT NULL,
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE gen_table IS '代码生成业务表';
COMMENT ON COLUMN gen_table.table_id IS '编号';
COMMENT ON COLUMN gen_table.table_name IS '表名称';
COMMENT ON COLUMN gen_table.table_comment IS '表描述';
COMMENT ON COLUMN gen_table.sub_table_name IS '关联子表的表名';
COMMENT ON COLUMN gen_table.sub_table_fk_name IS '子表关联的外键名';
COMMENT ON COLUMN gen_table.class_name IS '实体类名称';
COMMENT ON COLUMN gen_table.tpl_category IS '使用的模板（crud单表操作 tree树表操作）';
COMMENT ON COLUMN gen_table.tpl_web_type IS '前端模板类型（element-ui模版 element-plus模版）';
COMMENT ON COLUMN gen_table.package_name IS '生成包路径';
COMMENT ON COLUMN gen_table.module_name IS '生成模块名';
COMMENT ON COLUMN gen_table.business_name IS '生成业务名';
COMMENT ON COLUMN gen_table.function_name IS '生成功能名';
COMMENT ON COLUMN gen_table.function_author IS '生成功能作者';
COMMENT ON COLUMN gen_table.gen_type IS '生成代码方式（0zip压缩包 1自定义路径）';
COMMENT ON COLUMN gen_table.gen_path IS '生成路径（不填默认项目路径）';
COMMENT ON COLUMN gen_table.options IS '其它生成选项';
COMMENT ON COLUMN gen_table.create_by IS '创建者';
COMMENT ON COLUMN gen_table.create_time IS '创建时间';
COMMENT ON COLUMN gen_table.update_by IS '更新者';
COMMENT ON COLUMN gen_table.update_time IS '更新时间';
COMMENT ON COLUMN gen_table.remark IS '备注';

-- ============================================================
-- 2. gen_table_column - 代码生成业务表字段
-- ============================================================
DROP TABLE IF EXISTS gen_table_column CASCADE;
CREATE TABLE gen_table_column (
  column_id BIGSERIAL PRIMARY KEY,
  table_id BIGINT DEFAULT NULL,
  column_name VARCHAR(200) DEFAULT NULL,
  column_comment VARCHAR(500) DEFAULT NULL,
  column_type VARCHAR(100) DEFAULT NULL,
  java_type VARCHAR(500) DEFAULT NULL,
  java_field VARCHAR(200) DEFAULT NULL,
  is_pk CHAR(1) DEFAULT NULL,
  is_increment CHAR(1) DEFAULT NULL,
  is_required CHAR(1) DEFAULT NULL,
  is_insert CHAR(1) DEFAULT NULL,
  is_edit CHAR(1) DEFAULT NULL,
  is_list CHAR(1) DEFAULT NULL,
  is_query CHAR(1) DEFAULT NULL,
  query_type VARCHAR(200) DEFAULT 'EQ',
  html_type VARCHAR(200) DEFAULT NULL,
  dict_type VARCHAR(200) DEFAULT '',
  sort INTEGER DEFAULT NULL,
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE gen_table_column IS '代码生成业务表字段';
COMMENT ON COLUMN gen_table_column.column_id IS '编号';
COMMENT ON COLUMN gen_table_column.table_id IS '归属表编号';
COMMENT ON COLUMN gen_table_column.column_name IS '列名称';
COMMENT ON COLUMN gen_table_column.column_comment IS '列描述';
COMMENT ON COLUMN gen_table_column.column_type IS '列类型';
COMMENT ON COLUMN gen_table_column.java_type IS 'JAVA类型';
COMMENT ON COLUMN gen_table_column.java_field IS 'JAVA字段名';
COMMENT ON COLUMN gen_table_column.is_pk IS '是否主键（1是）';
COMMENT ON COLUMN gen_table_column.is_increment IS '是否自增（1是）';
COMMENT ON COLUMN gen_table_column.is_required IS '是否必填（1是）';
COMMENT ON COLUMN gen_table_column.is_insert IS '是否为插入字段（1是）';
COMMENT ON COLUMN gen_table_column.is_edit IS '是否编辑字段（1是）';
COMMENT ON COLUMN gen_table_column.is_list IS '是否列表字段（1是）';
COMMENT ON COLUMN gen_table_column.is_query IS '是否查询字段（1是）';
COMMENT ON COLUMN gen_table_column.query_type IS '查询方式（等于、不等于、大于、小于、范围）';
COMMENT ON COLUMN gen_table_column.html_type IS '显示类型（文本框、文本域、下拉框、复选框、单选框、日期控件）';
COMMENT ON COLUMN gen_table_column.dict_type IS '字典类型';
COMMENT ON COLUMN gen_table_column.sort IS '排序';
COMMENT ON COLUMN gen_table_column.create_by IS '创建者';
COMMENT ON COLUMN gen_table_column.create_time IS '创建时间';
COMMENT ON COLUMN gen_table_column.update_by IS '更新者';
COMMENT ON COLUMN gen_table_column.update_time IS '更新时间';

-- ============================================================
-- 3. goods_category - 分类表
-- ============================================================
DROP TABLE IF EXISTS goods_category CASCADE;
CREATE TABLE goods_category (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  enable CHAR(2) NOT NULL,
  parent_id VARCHAR(32) DEFAULT NULL,
  name VARCHAR(16) DEFAULT NULL,
  description VARCHAR(255) DEFAULT NULL,
  pic_url VARCHAR(255) DEFAULT NULL,
  sort SMALLINT DEFAULT NULL,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  del_flag CHAR(2) DEFAULT '0'
);

COMMENT ON TABLE goods_category IS '分类表';
COMMENT ON COLUMN goods_category.id IS 'PK';
COMMENT ON COLUMN goods_category.enable IS '（1：开启；0：关闭）';
COMMENT ON COLUMN goods_category.parent_id IS '父分类编号';
COMMENT ON COLUMN goods_category.name IS '名称';
COMMENT ON COLUMN goods_category.description IS '描述';
COMMENT ON COLUMN goods_category.pic_url IS '图片';
COMMENT ON COLUMN goods_category.sort IS '排序';
COMMENT ON COLUMN goods_category.create_time IS '创建时间';
COMMENT ON COLUMN goods_category.update_time IS '最后更新时间';
COMMENT ON COLUMN goods_category.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';

-- 食品分类数据 (1个根分类 + 14个二级分类)
INSERT INTO goods_category (id, enable, parent_id, name, description, pic_url, sort, create_time, update_time, del_flag)
VALUES ('ROOT', '1', '0', '全部商品', '根分类', '', 0, NOW(), NOW(), '0');
INSERT INTO goods_category (id, enable, parent_id, name, description, pic_url, sort, create_time, update_time, del_flag)
VALUES
    ('CAT001', '1', 'ROOT', '丸滑产品', '丸滑产品类', '', 1, NOW(), NOW(), '0'),
    ('CAT002', '1', 'ROOT', '家禽蛋副', '家禽蛋副类', '', 2, NOW(), NOW(), '0'),
    ('CAT003', '1', 'ROOT', '小吃点心', '小吃点心类', '', 3, NOW(), NOW(), '0'),
    ('CAT004', '1', 'ROOT', '水发产品', '水发产品类', '', 4, NOW(), NOW(), '0'),
    ('CAT005', '1', 'ROOT', '海鲜水产', '海鲜水产类', '', 5, NOW(), NOW(), '0'),
    ('CAT006', '1', 'ROOT', '牛羊肉类', '牛羊肉类', '', 6, NOW(), NOW(), '0'),
    ('CAT007', '1', 'ROOT', '猪肉猪副', '猪肉猪副类', '', 7, NOW(), NOW(), '0'),
    ('CAT008', '1', 'ROOT', '米面制品', '米面制品类', '', 8, NOW(), NOW(), '0'),
    ('CAT009', '1', 'ROOT', '肉肠罐头', '肉肠罐头类', '', 9, NOW(), NOW(), '0'),
    ('CAT010', '1', 'ROOT', '蔬菜菌菇', '蔬菜菌菇类', '', 10, NOW(), NOW(), '0'),
    ('CAT011', '1', 'ROOT', '蘸料底料', '蘸料底料类', '', 11, NOW(), NOW(), '0'),
    ('CAT012', '1', 'ROOT', '调理肉类', '调理肉类', '', 12, NOW(), NOW(), '0'),
    ('CAT013', '1', 'ROOT', '豆制品类', '豆制品类', '', 13, NOW(), NOW(), '0'),
    ('CAT014', '1', 'ROOT', '饮料甜品', '饮料甜品类', '', 14, NOW(), NOW(), '0');

-- ============================================================
-- 4. goods_spu - 商品表
-- ============================================================
DROP TABLE IF EXISTS goods_spu CASCADE;
CREATE TABLE goods_spu (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  spu_code VARCHAR(32) DEFAULT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  sell_point VARCHAR(500) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  category_first VARCHAR(32) NOT NULL,
  category_second VARCHAR(32) DEFAULT NULL,
  pic_urls VARCHAR(1024) NOT NULL DEFAULT '',
  shelf CHAR(2) NOT NULL DEFAULT '0',
  sort INTEGER NOT NULL DEFAULT 0,
  sales_price DECIMAL(10,2) DEFAULT NULL,
  market_price DECIMAL(10,2) DEFAULT NULL,
  cost_price DECIMAL(10,2) DEFAULT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  sale_num INTEGER DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  del_flag CHAR(2) NOT NULL DEFAULT '0',
  version INTEGER DEFAULT 0,
  merchant_id BIGINT DEFAULT NULL
);

COMMENT ON TABLE goods_spu IS '商品表';
COMMENT ON COLUMN goods_spu.id IS 'PK';
COMMENT ON COLUMN goods_spu.spu_code IS 'spu编码';
COMMENT ON COLUMN goods_spu.name IS 'spu名字';
COMMENT ON COLUMN goods_spu.sell_point IS '卖点';
COMMENT ON COLUMN goods_spu.description IS '描述';
COMMENT ON COLUMN goods_spu.category_first IS '一级分类ID';
COMMENT ON COLUMN goods_spu.category_second IS '二级分类ID';
COMMENT ON COLUMN goods_spu.pic_urls IS '商品图片';
COMMENT ON COLUMN goods_spu.shelf IS '是否上架（1是 0否）';
COMMENT ON COLUMN goods_spu.sort IS '排序字段';
COMMENT ON COLUMN goods_spu.sales_price IS '销售价格';
COMMENT ON COLUMN goods_spu.market_price IS '市场价';
COMMENT ON COLUMN goods_spu.cost_price IS '成本价';
COMMENT ON COLUMN goods_spu.stock IS '库存';
COMMENT ON COLUMN goods_spu.sale_num IS '销量';
COMMENT ON COLUMN goods_spu.create_time IS '创建时间';
COMMENT ON COLUMN goods_spu.update_time IS '最后更新时间';
COMMENT ON COLUMN goods_spu.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN goods_spu.version IS '版本号';
COMMENT ON COLUMN goods_spu.merchant_id IS '商户ID';

CREATE TRIGGER goods_spu_update_time BEFORE UPDATE ON goods_spu
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ----------------------------
-- 食品商品数据 (161 products from 03_products.sql)
-- ----------------------------
INSERT INTO goods_spu (id, spu_code, name, sell_point, description, category_first, category_second, pic_urls, shelf, sort, sales_price, market_price, cost_price, stock, sale_num, create_time, del_flag)
VALUES
('16a8f094f66141439063620763ccd518', 'SPU0001', '泰祥波浪卷日式关东煮大包/40g/个*50个/包*4包/箱', '冷冻-18度 | 供应商: 泰祥', '40g/个*50个/包*4包/箱', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 1, 196.00, 196.00, 170.00, 999, 0, NOW(), '0'),
('323d5fb737c04ed49a672c66cc8048cc', 'SPU0002', '泰祥香肠竹轮卷日式关东煮大包/30g/个*20个/包*20包/箱', '冷冻-18度 | 供应商: 泰祥', '30g*20*20', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 2, 588.00, 588.00, 492.00, 999, 0, NOW(), '0'),
('9a8e8a7c0e90495e8c57deb15a95c6aa', 'SPU0003', '泰祥蟹肉竹轮串日式关东煮大包/40g/个*10个/包*20包/箱', '冷冻-18度 | 供应商: 泰祥', '40G*10*20', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 3, 298.00, 318.00, 248.00, 999, 0, NOW(), '0'),
('4e0ee8133e574cd0909d3ad9d1413b80', 'SPU0004', '泰祥蔬菜鱼糜饼日式关东煮大包/25g/个*30个/包*6包/箱', '冷冻-18度 | 供应商: 泰祥', '25*30*6', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 4, 135.00, 147.00, 103.50, 999, 0, NOW(), '0'),
('799f316ed8f046b1bd5779f90c15df41', 'SPU0005', '泰祥竹轮日式关东煮大包/30g/个*20个/包*10包/箱', '冷冻-18度 | 供应商: 泰祥', '30G*20*10', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 5, 158.00, 181.11, 129.00, 999, 0, NOW(), '0'),
('02a41cfd623c49b1b5370fdf37834838', 'SPU0006', '泰祥黑椒牛肉粒', '冷冻-18度 | 供应商: 泰祥', '500g×20袋', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 6, 550.00, 560.00, 470.00, 999, 0, NOW(), '0'),
('c7e64d67bb0f4804bd942b15caaac04e', 'SPU0007', '泰祥小炒黄牛肉200g×50袋/箱', '冷冻-18度 | 供应商: 泰祥', '200g×50袋', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 7, 550.00, 560.00, 450.00, 999, 0, NOW(), '0'),
('39b0849ea16645b0baf9e4c2c839a5ec', 'SPU0008', '泰祥卤味耙牛肉180g×60袋/箱', '冷冻-18度 | 供应商: 泰祥', '180*60', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 8, 780.00, 800.00, 630.00, 999, 0, NOW(), '0'),
('664f2dd97d3742ccb00e53709debbfe9', 'SPU0009', '泰祥胸口油120g×50袋/箱', '冷冻-18度 | 供应商: 泰祥', '120*50', 'ROOT', 'CAT006', '/uploads/products/default.png', '1', 9, 808.00, 825.00, 710.00, 999, 0, NOW(), '0'),
('04041ce154e7408f92d28a3979b54074', 'SPU0010', '泰祥日式粘粉猪排100g/片*10片/袋*5袋/箱', '冷冻-18度 | 供应商: 泰祥', '100*10*5', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 10, 175.00, 186.20, 155.00, 999, 0, NOW(), '0'),
('5ce8b53b21674046ae06c3c63f8493ee', 'SPU0011', '泰祥小里脊猪排60g*20*5袋/箱', '冷冻-18度 | 供应商: 泰祥', '60*20*5', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 11, 228.00, 228.00, 210.00, 999, 0, NOW(), '0'),
('d7c65cd121f54baab2813811145ea3ce', 'SPU0012', '泰祥粘粉鳕鱼排31g/个*10个/包*20包/箱', '冷冻-18度 | 供应商: 泰祥', '31*10*20', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 12, 138.00, 353.00, 128.00, 999, 0, NOW(), '0'),
('2f02ada256014dc081457bdf05476a4b', 'SPU0013', '泰祥冻章鱼小丸子25g/个*40个/包*10包/箱', '冷冻-18度 | 供应商: 泰祥', '25*40*10', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 13, 210.00, 350.00, 170.00, 999, 0, NOW(), '0'),
('20fc91463f53432ca7ec555b72ad7c9c', 'SPU0014', '泰祥蔬菜土豆饼/60g/个*10片/袋*10袋/箱', '冷冻-18度 | 供应商: 泰祥', '60*10*10', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 14, 98.00, 108.00, 80.00, 999, 0, NOW(), '0'),
('d5d966bf0c1040c8bd30bdd8bc7121ab', 'SPU0015', '泰祥牛肉土豆饼/60g/个*10片/袋*10袋/箱', '冷冻-18度 | 供应商: 泰祥', '60*10*10', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 15, 108.00, 134.30, 87.00, 999, 0, NOW(), '0'),
('08ad8a9d8c854d4cadfe1b7a766403df', 'SPU0016', '隆尚大芋圆/1kg*14包/箱(综合;单色）', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '1kg*14包', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 16, 268.00, 308.00, 210.00, 999, 0, NOW(), '0'),
('3825b3ba77ad41a08a5b4e9673e75fcd', 'SPU0017', '隆尚小芋圆/800g*16包/箱(综合;单色）', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '800g*16包', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 17, 256.00, 320.00, 200.00, 999, 0, NOW(), '0'),
('8cb42ec7899141bab8052aa5d2340722', 'SPU0018', '光阳优级皮蛋360枚纸箱装(5#45-55）', '常温储存 | 供应商: 光阳蛋业', '360枚*1件', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 18, 360.00, 1069.00, 270.00, 999, 0, NOW(), '0'),
('dd00ca03b16f4d2bb81858a4a1fbc2ac', 'SPU0019', '光阳二级散装皮蛋300枚（装60克以上）', '常温储存 | 供应商: 光阳蛋业', '300枚*1件', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 19, 240.00, 598.50, 180.00, 999, 0, NOW(), '0'),
('445324cf0c5a4a5e9cbf3c275e279162', 'SPU0020', '光阳熟咸蛋100枚装（65g）', '常温储存 | 供应商: 光阳蛋业', '100×1箱', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 20, 198.00, 374.00, 145.00, 999, 0, NOW(), '0'),
('74b83edd64944d5f8ce9b137634a9a6f', 'SPU0021', '光阳带汁卤蛋/850g*12枚/袋*12袋/件', '常温储存 | 供应商: 光阳蛋业', '12×12袋', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 21, 185.00, 280.00, 136.80, 999, 0, NOW(), '0'),
('a92ce44cba054c2c97e4e3900c12653d', 'SPU0022', '光阳茶叶蛋8枚装(沥干物≥440g)/8枚*12袋', '常温储存 | 供应商: 光阳蛋业', '8枚*12袋', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 22, 128.00, 226.80, 96.00, 999, 0, NOW(), '0'),
('f6cda82cdb634b768ab9034673badfe3', 'SPU0023', '光阳2型红心咸蛋黄真空装12枚/156g/袋*80袋/件', '常温储存 | 供应商: 光阳蛋业', '12枚*80袋', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 23, 1219.00, 1286.40, 912.00, 999, 0, NOW(), '0'),
('c30a0e138e224a6fb6217f6d874c23d4', 'SPU0024', '光阳咸蛋黄30枚/390g/袋*16袋/件', '常温储存 | 供应商: 光阳蛋业', '30枚*16袋', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 24, 609.00, 643.20, 456.00, 999, 0, NOW(), '0'),
('fa377e4784164d078a1041c2b05c614e', 'SPU0025', '恩沁2.2cm机制小方冰/5kg/袋', '冷冻-18度 | 供应商: 上海恩沁食品有限公司', '约2.2cm 5公斤/袋', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 25, 11.00, 20.00, 6.00, 999, 0, NOW(), '0'),
('00a8e17de90f4363bbaad164f42bd49b', 'SPU0026', '恩沁5cm方冰高透冰30颗/袋/3kg', '冷冻-18度 | 供应商: 上海恩沁食品有限公司', '(长&宽&高) 5.0cm/30 颗/袋/3kg', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 26, 38.50, 75.00, 22.50, 999, 0, NOW(), '0'),
('25637eb00c0f4cf185aaf724fcc92d6e', 'SPU0027', '恩沁6cm高透亮冰球10颗/袋/1公斤', '冷冻-18度 | 供应商: 上海恩沁食品有限公司', '直径 6.0cm/10 颗/袋/1 公斤', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 27, 23.00, 40.00, 12.00, 999, 0, NOW(), '0'),
('5603403ee8bb491e81054b07bf4030ee', 'SPU0028', '恩沁去棱角多功能摇冰无规则3.5-4.3cm/3公斤/袋', '冷冻-18度 | 供应商: 上海恩沁食品有限公司', '无规则 3.5-4.3cm 间/3 公斤/袋', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 28, 15.00, 25.00, 7.50, 999, 0, NOW(), '0'),
('81031722608c43f0b0618d6bfe361ca7', 'SPU0029', '恩沁条冰4.0*4.0*12cm/18条/袋/3公斤', '冷冻-18度 | 供应商: 上海恩沁食品有限公司', '条冰 4.0*4.0*12cm/长 12.cm，宽&厚 4cm,
18 条/袋/3 公斤', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 29, 27.00, 50.00, 15.00, 999, 0, NOW(), '0'),
('f7b2ca4b047148f6b420de96ac20b885', 'SPU0030', '恩沁颗粒碎冰1cm以内颗粒状4KG/袋', '冷冻-18度 | 供应商: 上海恩沁食品有限公司', '1cm 以内颗粒状 4KG/袋', 'ROOT', 'CAT014', '/uploads/products/default.png', '1', 30, 15.00, 25.00, 7.50, 999, 0, NOW(), '0'),
('e807bb6503dd4304afbcec6bdf56b08b', 'SPU0031', '美宁火腿猪肉罐头(大颗粒)340g/罐/24罐/箱', '冷冻-18度 | 供应商: 张总', '340g/罐/24罐/箱', 'ROOT', 'CAT009', '/uploads/products/default.png', '1', 31, 258.00, 285.00, 228.00, 999, 0, NOW(), '0'),
('ee31a806eee14102bad4c4743f0a9326', 'SPU0032', '美宁云腿午餐肉(肉粒多)340g/罐/24罐/箱', '冷冻-18度 | 供应商: 张总', '340g/罐/24罐/箱', 'ROOT', 'CAT009', '/uploads/products/default.png', '1', 32, 230.00, 252.00, 195.00, 999, 0, NOW(), '0'),
('d9e8955d6cd1410190cf7bf65641532f', 'SPU0033', '美宁火锅午餐肉(耐煮烫)340g/罐/24罐/箱', '冷冻-18度 | 供应商: 张总', '340g/罐/24罐/箱', 'ROOT', 'CAT009', '/uploads/products/default.png', '1', 33, 195.00, 225.00, 171.00, 999, 0, NOW(), '0'),
('a67d36ec189344a49555ebbfd90fff2f', 'SPU0034', '美宁牛肉午餐肉罐头(大颗粒)340g/罐/24罐/箱', '冷冻-18度 | 供应商: 张总', '340g/罐/24罐/箱', 'ROOT', 'CAT009', '/uploads/products/default.png', '1', 34, 245.00, 260.00, 192.00, 999, 0, NOW(), '0'),
('9983de55e32d4b03b082b2a0e73e5b88', 'SPU0035', '涛阳锁鲜鹅肠500g*20包免清洗火锅食材商用麻辣烫烧烤串串鲜冻爽脆鹅肠', '冷冻-18度 | 供应商: 张总', '500g*20包', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 35, 575.00, 595.00, 536.00, 999, 0, NOW(), '0'),
('4d8b33b4993a4ac78fae4cbc6c40232d', 'SPU0036', '派派乐锁鲜鸭肠500g*20袋 鲜冻生鸭肠免处理重庆火锅麻辣烫', '冷冻-18度 | 供应商: 张总', '500g*20袋', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 36, 258.00, 320.00, 225.00, 999, 0, NOW(), '0'),
('a5f3e5d9f1ee4ad0b296a0e03161ef04', 'SPU0037', '卓燚猪黄喉商用批发新鲜重庆火锅烧烤食材/净重4.5斤/袋', '冷藏储存 | 供应商: 张总', '4.5斤/袋', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 37, 135.00, 135.00, 112.50, 999, 0, NOW(), '0'),
('52006d6daeed42bd93bc3e35886d8bc7', 'SPU0038', '卓燚牛黄喉商用批发新鲜重庆火锅烧烤食材/净重4.5斤/袋', '冷藏储存 | 供应商: 张总', '4.5斤/袋', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 38, 110.00, 110.00, 94.50, 999, 0, NOW(), '0'),
('9f236fe54cd2429a8ba9717e8865736b', 'SPU0039', '龙厨3系双椒牛肉50包*150g火锅冒菜嫩牛肉片水煮肉片串串冷冻食材', '冷冻-18度 | 供应商: 张总', '50包*150g', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 39, 435.00, 435.00, 400.00, 999, 0, NOW(), '0'),
('8c264b7abf49455d919107cb67df4959', 'SPU0040', '龙厨3系嫩滑牛肉50包*150g火锅冒菜嫩牛肉片水煮肉片串串冷冻食材', '冷冻-18度 | 供应商: 张总', '50包*150g', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 40, 435.00, 435.00, 400.00, 999, 0, NOW(), '0'),
('c82762133af44efe81a875cc2ead1f20', 'SPU0041', '龙厨3系麻辣牛肉50包*150g火锅冒菜嫩牛肉片水煮肉片串串冷冻食材', '冷冻-18度 | 供应商: 张总', '50包*150g', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 41, 435.00, 435.00, 400.00, 999, 0, NOW(), '0'),
('4d1d3b8ef5404459a4f76bdf11308801', 'SPU0042', '龙厨现切吊龙重庆火锅豆捞自助鲜牛肉火锅食材/150克*50包/箱', '冷冻-18度 | 供应商: 张总', '50包*150g', 'ROOT', 'CAT006', '/uploads/products/default.png', '1', 42, 590.00, 580.00, 530.00, 999, 0, NOW(), '0'),
('ada7c331c3314e6fbafa26811ba518a7', 'SPU0043', '卓燚黑千层黑毛肚新鲜冷冻牛杂牛肚火锅食材/4.5斤（可定制）', '冷冻-18度 | 供应商: 张总', '4.5斤/袋', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 43, 95.00, 98.00, 77.50, 999, 0, NOW(), '0'),
('869fbaacad5b402a944fe8d33a12da56', 'SPU0044', '卓燚蒸汽水煮千层肚白毛肚新鲜冷冻牛杂牛肚火锅食材/4.5斤（可定制）', '冷冻-18度 | 供应商: 张总', '4.5斤/袋', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 44, 125.00, 128.00, 96.00, 999, 0, NOW(), '0'),
('966c92d36af546d79704c57ef25fae2a', 'SPU0045', '卓燚优质水牛大叶片毛肚新鲜毛肚水牛牛百叶毛肚火锅食材/4.5斤（可定制）', '冷藏储存 | 供应商: 张总', '4.5斤/袋', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 45, 155.00, 155.00, 144.00, 999, 0, NOW(), '0'),
('dfa27cfa15a24c6ba7c3688b8d78666c', 'SPU0046', '卓燚无底板大叶片黄牛毛肚新鲜净重4.5斤牛百叶鲜毛肚火锅食材', '冷藏储存 | 供应商: 张总', '4.5斤/袋', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 46, 139.00, 140.00, 121.50, 999, 0, NOW(), '0'),
('030425a1d4ae45c0bc8a2adcc073f56c', 'SPU0047', '松茸复合菌500g/包', '常温储存 | 供应商: 菌菇合作', '500g/包', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 47, 95.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('468085f05c5e4ff3984abceed5defd49', 'SPU0048', '脆脆菇150g/包*50包/件', '常温储存 | 供应商: 菌菇合作', '150g/包*50包/件', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 48, 350.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('dbc231d3c17c4d619afcc2ed4254069f', 'SPU0049', '菌汤包100g/包*150包/件', '常温储存 | 供应商: 菌菇合作', '100g/包*150包/件', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 49, 1275.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('2c665042d92d43fabdfffd6e2799b55e', 'SPU0050', '松茸鲜130g/罐*36罐/件', '常温储存 | 供应商: 菌菇合作', '130g/罐*36罐/件', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 50, 396.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('623f531c59da4a399185e7572f82805d', 'SPU0051', '牛肝菌酱220g/罐*12罐/件', '常温储存 | 供应商: 菌菇合作', '220g/罐*12罐/件', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 51, 144.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('3b0582b83fe842d8a69438a936ca5542', 'SPU0052', '干货竹荪毛重500g/条', '冷藏储存 | 供应商: 菌菇合作', '500g/条', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 52, 48.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('fc3076e84d7d43df966c818a2f6e1c68', 'SPU0053', '干货鹿茸菇10斤/件', '冷藏储存 | 供应商: 菌菇合作', '10斤/件', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 53, 300.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('fde592bfaa884ef496c5da2affb05008', 'SPU0054', '干货羊肚菌5-7cm/500g/包', '冷藏储存 | 供应商: 菌菇合作', '5-7cm/500g/包', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 54, 300.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('a3bf2d033c7f40819a8f8147d6a12798', 'SPU0055', '鲜品鸡枞菌30斤/件', '冷藏储存 | 供应商: 菌菇合作', '30斤/件', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 55, 540.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('a2e91cda77ef456d8669e8ea02499d64', 'SPU0056', '冻品野生松茸5-7cm/500g/包', '冷冻-18度 | 供应商: 菌菇合作', '5-7cm/500g/包', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 56, 90.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('9b848fff9af64b5ca05cd5028b1bbf7a', 'SPU0057', '冻品黑松露2-3cm/500g/包', '冷冻-18度 | 供应商: 菌菇合作', '2-3cm/500g/包', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 57, 130.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('c5a2d11033444d30999284273f260910', 'SPU0058', '冷冻野生松露片2-3cm/100g/包', '冷冻-18度 | 供应商: 菌菇合作', '2-3cm/100g/包', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 58, 20.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('76a808dc10af419ab70cd3eb488ec65f', 'SPU0059', '甜心甘蓝（萌甘宝）/斤', '冷藏储存 | 供应商: 峰哥发的', '斤', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 59, 8.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('040c00a986fb461c80f082227077e209', 'SPU0060', '红菠菜/斤', '冷藏储存 | 供应商: 峰哥发的', '斤', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 60, 12.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('4dbc9e0e5c5e48f08333a1833f1a1208', 'SPU0061', '板蓝根青菜精品/斤', '冷藏储存 | 供应商: 峰哥发的', '斤', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 61, 12.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('482bf85273ed4fb199366417db4c6a81', 'SPU0062', '老佰姓米中贵族/黑龙江五常/10公斤/袋', '常温储存 | 供应商: 老佰姓', '10公斤/袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 62, 96.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('7a02a371d2ab466d933d7226c6e90461', 'SPU0063', '老佰姓鸿运当头/黑龙江五常/10公斤/袋', '常温储存 | 供应商: 老佰姓', '10公斤/袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 63, 86.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('c99861c1a86a4e139d2228eb9262dad4', 'SPU0064', '老佰姓橙心如意/黑龙江五常/10公斤/袋', '常温储存 | 供应商: 老佰姓', '10公斤/袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 64, 76.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('a078ca38f25144999a9f6c0c21c5d637', 'SPU0065', '老佰姓绿树常青/黑龙江五常/10公斤/袋', '常温储存 | 供应商: 老佰姓', '10公斤/袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 65, 72.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('587de3ac907e49bd9695db2d8ad9c2cf', 'SPU0066', '老佰姓灰常好/黑龙江五常/10公斤/袋', '常温储存 | 供应商: 老佰姓', '10公斤/袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 66, 64.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('60dccfe8ba394ee8859bccf21debe080', 'SPU0067', '老佰姓2号/黑龙江五常/10公斤/袋', '常温储存 | 供应商: 老佰姓', '10公斤/袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 67, 58.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('f0493572a03048f7bc901e0dd4776471', 'SPU0068', '老佰姓1号/黑龙江五常/10公斤/袋', '常温储存 | 供应商: 老佰姓', '10公斤/袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 68, 64.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('ad3e0efa04d8402490c11780464574b8', 'SPU0069', '德沣盐田香虾整箱31/35/斤30条/300克/盒*10盒/箱', '冷冻-18度 | 供应商: 不知道叫什么', '31/35/斤30条/300克/盒*10盒/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 69, 158.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('03e5acbb242e481d9075568ff00976d2', 'SPU0070', '德沣盐田香虾整箱21/25/斤30条/300克/盒*10盒/箱', '冷冻-18度 | 供应商: 不知道叫什么', '21/25/斤30条/300克/盒*10盒/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 70, 182.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('22447ee5afec4afb83d88bc3c96d1be2', 'SPU0071', '广东黑棕鹅整只6-8斤/只', '冷冻-18度 | 供应商: 不知道叫什么', '6-8斤/只', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 71, 16.50, 0.00, 0.00, 999, 0, NOW(), '0'),
('e8651a12b7f24c2b87f5026136858a72', 'SPU0072', '广东乳鸽整只6两-7两/只', '冷冻-18度 | 供应商: 不知道叫什么', '6两-7两/只', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 72, 19.00, 0.00, 0.00, 999, 0, NOW(), '0'),
('776691c609c04d188a9b7fb149d79dd3', 'SPU0073', '大别山老母鸡冷冻整只2.6-3斤/只', '冷冻-18度 | 供应商: 不知道叫什么', '2.6-3斤/只', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 73, 11.20, 0.00, 0.00, 999, 0, NOW(), '0'),
('5119913841054c4784e1d7a438ff4411', 'SPU0074', '江西土麻鸭新鲜冷冻整只2.6-3斤/只', '冷冻-18度 | 供应商: 不知道叫什么', '2.6-3斤/只', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 74, 12.80, 0.00, 0.00, 999, 0, NOW(), '0'),
('dbcb6e60f8d949a1b941b178b7a3f9f6', 'SPU0075', '正宗温氏清远鸡黄油鸡冰鲜速冻白切走地鸡黄皮花胶鸡整2.8-3.6斤/只', '冷冻-18度 | 供应商: 不知道叫什么', '2.8-3.6斤/只', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 75, 9.60, 0.00, 0.00, 999, 0, NOW(), '0'),
('d526dbab86094329ad5315c3f85bdc90', 'SPU0076', '海吉港95大颗粒虾滑整箱500g*20包/箱', '冷冻-18度 | 供应商: 张总', '500g*20包', 'ROOT', 'CAT001', '/uploads/products/default.png', '1', 76, 600.00, 600.00, 550.00, 999, 0, NOW(), '0'),
('d3f87e765f1e45b198f44c26e294f68d', 'SPU0077', '虎皮凤爪1公斤/包*10包/箱', '冷冻-18度 | 供应商: 张总', '1公斤*10包/箱', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 77, 350.00, 350.00, 290.00, 999, 0, NOW(), '0'),
('12039559ee6c4442921a1a906f44d570', 'SPU0078', '泡泡豆干2.5斤/包*10包/箱', '冷冻-18度 | 供应商: 张总', '2.5斤/包*10包/箱', 'ROOT', 'CAT013', '/uploads/products/default.png', '1', 78, 245.00, 245.00, 205.00, 999, 0, NOW(), '0'),
('e480bcf3b178498d972f23dcfb0e0b44', 'SPU0079', '越汇小郡肝500克/包*10包/箱', '冷冻-18度 | 供应商: 张总', '500克/包*10包/箱', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 79, 185.00, 185.00, 155.00, 999, 0, NOW(), '0'),
('6489f96414c44a44a69d80a48c275506', 'SPU0080', '吉食道笋片500克/包*20包/箱', '常温储存 | 供应商: 张总', '500克/包*20包/箱', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 80, 135.00, 135.00, 105.00, 999, 0, NOW(), '0'),
('13d26632229c46b2a5286104048eb4de', 'SPU0081', '贡菜4公斤/件', '冷冻-18度 | 供应商: 张总', '4公斤/件', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 81, 330.00, 320.00, 295.00, 999, 0, NOW(), '0'),
('cbee7bf529a94c92afb92e68adbe7a1c', 'SPU0082', '黄龙火锅川粉宽粉240克/袋*50袋/箱', '常温储存 | 供应商: 张总', '240克/袋*50袋', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 82, 120.00, 120.00, 88.00, 999, 0, NOW(), '0'),
('cb8b337a958c4f0ab5daae96e66e9177', 'SPU0083', '潮汕牛筋丸500克/包*20包/箱', '冷冻-18度 | 供应商: 张总', '500克/包*20包/箱', 'ROOT', 'CAT001', '/uploads/products/default.png', '1', 83, 275.00, 275.00, 245.00, 999, 0, NOW(), '0'),
('36f712b5075346f68c70f94c124e3beb', 'SPU0084', '无骨干冰鸭掌净重9斤/箱', '冷冻-18度 | 供应商: 张总', '净重9斤/箱', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 84, 175.00, 175.00, 140.00, 999, 0, NOW(), '0'),
('13824dfb422344109d2e0a428f9beaff', 'SPU0085', '无骨干冰鸡爪净重9斤/箱', '冷冻-18度 | 供应商: 张总', '净重9斤/箱', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 85, 180.00, 180.00, 148.00, 999, 0, NOW(), '0'),
('d15a302da8df49ec9ff9c8137112f6ad', 'SPU0086', '李传芳黑豆花400克/盒*32盒/箱', '冷藏储存 | 供应商: 张总', '400克/盒*32盒/箱', 'ROOT', 'CAT013', '/uploads/products/default.png', '1', 86, 190.00, 190.00, 165.00, 999, 0, NOW(), '0'),
('e94fecc28a8140659fed3481dca8c45a', 'SPU0087', '盛华V型蟹柳1公斤/包*10包/箱', '冷冻-18度 | 供应商: 张总', '1公斤/包*10包/箱', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 87, 310.00, 310.00, 285.00, 999, 0, NOW(), '0'),
('9f5727a9c9c64545bf9c7decd8191c7e', 'SPU0088', '响铃卷120克/盒*32盒/箱', '常温储存 | 供应商: 张总', '120克/盒*32盒/箱', 'ROOT', 'CAT013', '/uploads/products/default.png', '1', 88, 185.00, 185.00, 150.00, 999, 0, NOW(), '0'),
('11eccae7ee514cbcaf7c0dbe3803c067', 'SPU0089', '源信免浆黑鱼片250克/盒*25盒/箱', '冷冻-18度 | 供应商: 张总', '250克/盒*25盒/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 89, 165.00, 165.00, 145.00, 999, 0, NOW(), '0'),
('3cdc15abc5a2440e88499a50c1e21979', 'SPU0090', '美好小酥肉1000克/包*10包/箱', '冷冻-18度 | 供应商: 张总', '1000克/包*10包/箱', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 90, 370.00, 370.00, 340.00, 999, 0, NOW(), '0'),
('1ef24b86e24e4330b0e580886536412b', 'SPU0091', '胖娃娃红糖糍粑220克/包*20包/箱', '冷冻-18度 | 供应商: 张总', '220克/包*20包/箱', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 91, 115.00, 115.00, 78.00, 999, 0, NOW(), '0'),
('b6414a84ec704d84a3e72647942f3b77', 'SPU0092', '鲜冻鸭血500克/包*20包/箱', '冷冻-18度 | 供应商: 张总', '500克/包*20包/箱', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 92, 185.00, 185.00, 150.00, 999, 0, NOW(), '0'),
('e5fe9ce327a34908b8709035fa6964d4', 'SPU0093', '霞浦海带苗500克/包*10包/箱', '冷冻-18度 | 供应商: 张总', '500克/包*10包/箱', 'ROOT', 'CAT010', '/uploads/products/default.png', '1', 93, 90.00, 90.00, 78.00, 999, 0, NOW(), '0'),
('60b1c6adfd4f4f458c4ec2db23352a75', 'SPU0094', '美鑫小凤仙老火锅底料500克/包*28包/箱', '常温储存 | 供应商: 张总', '500克/包*28包/箱', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 94, 390.00, 420.00, 350.00, 999, 0, NOW(), '0'),
('f05a3685436c40138b79973f92e76db0', 'SPU0095', '小凤鲜阳光番茄火锅底料250克/包*50包/箱', '常温储存 | 供应商: 张总', '250克/包*50包/箱', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 95, 350.00, 375.00, 300.00, 999, 0, NOW(), '0'),
('474f0099d97d46c496fb01845528e011', 'SPU0096', '小凤鲜原味菌汤复合调味料500克/包*28包/箱', '常温储存 | 供应商: 张总', '500克/包*28包/箱', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 96, 385.00, 392.00, 350.00, 999, 0, NOW(), '0'),
('d0793e7e80f54f98a689f814ce2c4ded', 'SPU0097', '老羊头清真肥牛方砖1号3.57公斤/条*7条/件', '冷冻-18度 | 供应商: 张总', '3.57公斤/条*7条/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 97, 1180.00, 1200.00, 1050.00, 999, 0, NOW(), '0'),
('5f7759be6cf74f609aa2fc2d9cce0718', 'SPU0098', '老羊头清真肥羊卷整条2.5公斤/条*10条/件', '冷冻-18度 | 供应商: 张总', '2.5公斤/条*10条/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 98, 1280.00, 1390.00, 1000.00, 999, 0, NOW(), '0'),
('5076fa796bfc4c73bb8c2f5b4e175df6', 'SPU0099', '越汇真有乌鸡卷2.5公斤/根*6根/件', '冷冻-18度 | 供应商: 张总', '2.5公斤/根*6根/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 99, 230.00, 245.00, 190.00, 999, 0, NOW(), '0'),
('acfbe1707b664e15b4a698ff2ca90424', 'SPU0100', '安井撒尿肉丸2.5公斤/包*4包/件', '冷冻-18度 | 供应商: 张总', '2.5公斤/包*4包/件', 'ROOT', 'CAT001', '/uploads/products/default.png', '1', 100, 215.00, 225.00, 185.00, 999, 0, NOW(), '0'),
('1d17b5df1fd5470b859e0414345d8fdb', 'SPU0101', '海欣鱼籽福袋2.5公斤/包*4包/件', '冷冻-18度 | 供应商: 张总', '2.5公斤/包*4包/件', 'ROOT', 'CAT001', '/uploads/products/default.png', '1', 101, 370.00, 380.00, 340.00, 999, 0, NOW(), '0'),
('03dd40e295064a2c8b6c689d2bd8553c', 'SPU0102', '安井鱼豆腐2.5公斤/包*4包/件', '冷冻-18度 | 供应商: 张总', '2.5公斤/包*4包/件', 'ROOT', 'CAT001', '/uploads/products/default.png', '1', 102, 148.00, 158.00, 122.00, 999, 0, NOW(), '0'),
('e59f389a432d46059305fc00c3cce631', 'SPU0103', '海欣火锅鱿鱼须180克/包*20包/箱', '冷冻-18度 | 供应商: 张总', '180克/包*20包/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 103, 280.00, 300.00, 233.00, 999, 0, NOW(), '0'),
('2fd8f3e0015843b7a1b57765e9ff70d8', 'SPU0104', '东北原浆冻豆腐2.5公斤/包*4包/件', '冷冻-18度 | 供应商: 张总', '2.5公斤/包*4包/件', 'ROOT', 'CAT013', '/uploads/products/default.png', '1', 104, 90.00, 95.00, 75.00, 999, 0, NOW(), '0'),
('c0034a601b0246abbeea1e19b5a0af0f', 'SPU0105', '精益鲜冻腐竹108克/包*50包/箱', '冷冻-18度 | 供应商: 张总', '108克/包*50包/箱', 'ROOT', 'CAT013', '/uploads/products/default.png', '1', 105, 235.00, 255.00, 185.00, 999, 0, NOW(), '0'),
('3b18f3963ee544af8c7159aa9e3eb875', 'SPU0106', '三全茴香小油条240克/包*16包/箱', '冷冻-18度 | 供应商: 张总', '240克/包*16包/箱', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 106, 120.00, 125.00, 100.00, 999, 0, NOW(), '0'),
('eab4e2f557f64bc2b8f918e6fd5f348c', 'SPU0107', '李家芝麻官火锅芝麻酱2.5公斤/包*8包/箱', '常温储存 | 供应商: 张总', '2.5公斤/包*8包/箱', 'ROOT', 'CAT011', '/uploads/products/default.png', '1', 107, 380.00, 405.00, 320.00, 999, 0, NOW(), '0'),
('03890b6a7ce24f648ddc9eb9fcd352cf', 'SPU0108', '皇家杜老爷蝴蝶面1公斤/包*6包/箱', '冷冻-18度 | 供应商: 张总', '1公斤/包*6包/箱', 'ROOT', 'CAT008', '/uploads/products/default.png', '1', 108, 125.00, 135.00, 100.00, 999, 0, NOW(), '0'),
('23ec2243682c4e8989ca67c50e552357', 'SPU0109', '美好包浆豆腐340克/包*28包/箱', '冷冻-18度 | 供应商: 张总', '340克/包*28包/箱', 'ROOT', 'CAT013', '/uploads/products/default.png', '1', 109, 209.00, 230.00, 185.00, 999, 0, NOW(), '0'),
('cd6c47d8ffd54a96b4a74d7f033fa433', 'SPU0110', '纯极鱼恋花（虾仁）180克/包*24包/箱', '冷冻-18度 | 供应商: 张总', '180克/包*24包/箱', 'ROOT', 'CAT001', '/uploads/products/default.png', '1', 110, 350.00, 360.00, 310.00, 999, 0, NOW(), '0'),
('040578d2b89f48b6add3bc06dd364317', 'SPU0111', '尚品好蔡饭堂豉汁蒸排骨2.5公斤/包*4包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '2.5公斤/包*4包/件', 'ROOT', 'CAT007', '/uploads/products/default.png', '1', 111, 270.00, 270.00, 220.00, 999, 0, NOW(), '0'),
('c8486891e9544912a7e5de307178ce45', 'SPU0112', '尚品好蔡和味牛腩500克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '500克/包*20包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 112, 650.00, 650.00, 620.00, 999, 0, NOW(), '0'),
('ac42f978d1db4ba9a60d5b75e13878cd', 'SPU0113', '尚品好蔡黑椒T骨猪扒1公斤/包*10包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '1公斤/包*10包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 113, 320.00, 338.00, 280.00, 999, 0, NOW(), '0'),
('0abb4c31994d4378b8dde563cfb2ea4b', 'SPU0114', '尚品好蔡黄金脆皮骨400克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '400克/包*20包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 114, 230.00, 290.00, 215.00, 999, 0, NOW(), '0'),
('949b22c63e864dcfa572972840da7851', 'SPU0115', '尚品好蔡精品小炒牛肉225克/包*40包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '225克/包*40包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 115, 550.00, 538.00, 520.00, 999, 0, NOW(), '0'),
('2c23d88567a843e6a2b059ac71fe6168', 'SPU0116', '尚品好蔡粒粒蒜香骨400克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '400克/包*20包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 116, 260.00, 275.00, 230.00, 999, 0, NOW(), '0'),
('3c3c35a5014847cc9532f09af61fddea', 'SPU0117', '尚品好蔡麻辣火锅牛排150克/包*50包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '150克/包*50包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 117, 620.00, 675.00, 590.00, 999, 0, NOW(), '0'),
('e68e44bf1da348c3a04ba347a1ec195a', 'SPU0118', '尚品好蔡蜜汁叉烧1公斤/包*10包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '1公斤/包*10包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 118, 650.00, 675.00, 600.00, 999, 0, NOW(), '0'),
('71b4c5b913c244d0b74705aa068c7511', 'SPU0119', '尚品好蔡牛柳300克/包*30包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '300克/包*30包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 119, 520.00, 530.00, 490.00, 999, 0, NOW(), '0'),
('074a1316bddd474e99aae4da9fdbfe29', 'SPU0120', '尚品好蔡小炒牛肉260克/包*40包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '260克/包*40包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 120, 440.00, 445.00, 400.00, 999, 0, NOW(), '0'),
('2b35650ac5de4557bfec2411eedd2008', 'SPU0121', '尚品好蔡爽滑猪肉片500克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '500克/包*20包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 121, 260.00, 273.00, 220.00, 999, 0, NOW(), '0'),
('176ae993928c40a1ba06c471749cbb0e', 'SPU0122', '尚品好蔡蒜香小骨500克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '500克/包*20包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 122, 450.00, 524.00, 400.00, 999, 0, NOW(), '0'),
('14da2466d4564d33a9451dc57526916e', 'SPU0123', '尚品好蔡蒜香小排400克/包*25包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '400克/包*25包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 123, 270.00, 300.00, 255.00, 999, 0, NOW(), '0'),
('1ca0791694d54ce1809390a21b2eaab7', 'SPU0124', '尚品好蔡潮汕咸蛋黄卷200克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '200克/包*20包/件', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 124, 280.00, 315.00, 260.00, 999, 0, NOW(), '0'),
('12153ef487d74a828ff3427993c2413b', 'SPU0125', '尚品好蔡小炒鸡杂248克/包*40包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '248克/包*40包/件', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 125, 280.00, 300.00, 260.00, 999, 0, NOW(), '0'),
('0983c22903d943c08b9ebe7f7b90c97e', 'SPU0126', '尚品好蔡原味火锅牛排150克/包*50包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '150克/包*50包/件', 'ROOT', 'CAT006', '/uploads/products/default.png', '1', 126, 620.00, 675.00, 590.00, 999, 0, NOW(), '0'),
('593dcca10a2e4c16aaba78d65628696d', 'SPU0127', '尚品好蔡原味牛肉粒1公斤/包*10包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '1公斤/包*10包/件', 'ROOT', 'CAT006', '/uploads/products/default.png', '1', 127, 365.00, 580.00, 340.00, 999, 0, NOW(), '0'),
('34c4e30227314d169a7198d117b31776', 'SPU0128', '尚品好蔡原味牛肉片500克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '500克/包*20包/件', 'ROOT', 'CAT006', '/uploads/products/default.png', '1', 128, 560.00, 545.00, 530.00, 999, 0, NOW(), '0'),
('18c5b451c272491686428554e203c745', 'SPU0129', '长喜厨房嫩滑牛肉片500克/包*20包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '500克/包*20包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 129, 490.00, 495.00, 470.00, 999, 0, NOW(), '0'),
('7271eb745df9492894bf41fe7247bf09', 'SPU0130', '尚品好蔡蒜香猪肋皇（10支装）750克/包*12包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '750克/包*12包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 130, 540.00, 580.00, 480.00, 999, 0, NOW(), '0'),
('5aa51809e58d404e83847bfd79355169', 'SPU0131', '尚品好蔡猪肉胶（三钻）2.5公斤/包*4包/件', '冷冻-18度 | 供应商: 广州尚好菜食品有限公司', '2.5公斤/包*4包/件', 'ROOT', 'CAT012', '/uploads/products/default.png', '1', 131, 185.00, 195.00, 160.00, 999, 0, NOW(), '0'),
('bdd49d5060e9457bb9d5cf377ad53b1b', 'SPU0132', '忠意调理鲜鸭肠(8成)500克/包*20包/箱', '冷藏储存 | 供应商: 忠意产品', '500克/包*20包/箱', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 132, 260.00, 0.00, 182.00, 999, 0, NOW(), '0'),
('8e8478b9fd9340448dd9ddfb24a367b0', 'SPU0133', '忠意活力鲜鹅肠(7成)200克/包*50包/箱', '冷藏储存 | 供应商: 忠意产品', '200克/包*50包/箱', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 133, 450.00, 0.00, 395.00, 999, 0, NOW(), '0'),
('9cb64f64a7ba47be9dc5acb6bb87a652', 'SPU0134', '忠意调理鸭肠(7成)500克/包*20包/箱', '冷藏储存 | 供应商: 忠意产品', '500克/包*20包/箱', 'ROOT', 'CAT004', '/uploads/products/default.png', '1', 134, 240.00, 0.00, 170.00, 999, 0, NOW(), '0'),
('7290fd32246d406ab6c50640f09913a1', 'SPU0135', '忠意锁鲜鸭胗花(8成)500克/包*20包/箱', '冷冻-18度 | 供应商: 忠意产品', '500克/包*20包/箱', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 135, 360.00, 0.00, 262.00, 999, 0, NOW(), '0'),
('5ab6b824db4b4f659cb23edc342398e2', 'SPU0136', '忠意去骨鸭掌(8成)500克/包*20包/箱', '冷冻-18度 | 供应商: 忠意产品', '500克/包*20包/箱', 'ROOT', 'CAT002', '/uploads/products/default.png', '1', 136, 540.00, 0.00, 462.00, 999, 0, NOW(), '0'),
('02290323f9a448e2922346eacda50f21', 'SPU0137', '流沙黄金麻球荠菜馅15*30克/包*20包/箱', '冷冻-18度 | 供应商: 云南流沙黄金麻球', '15*30克/包*20包/箱', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 137, 294.00, 0.00, 240.00, 999, 0, NOW(), '0'),
('fd74295e4a7b452ea8161312ffc2e045', 'SPU0138', '流沙黄金麻球咸蛋黄15*30克/包*20包/箱', '冷冻-18度 | 供应商: 云南流沙黄金麻球', '15*30克/包*20包/箱', 'ROOT', 'CAT003', '/uploads/products/default.png', '1', 138, 294.00, 0.00, 291.00, 999, 0, NOW(), '0'),
('c245e8d4cfaf484f8a0a97ddfb77ff00', 'SPU0139', '湄公大厨8成欧标鱼柳10公斤/箱', '冷冻-18度 | 供应商: 欧泰贡', '10公斤/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 139, 188.00, 0.00, 165.00, 999, 0, NOW(), '0'),
('da85b822ed264904a7d28eea9705374c', 'SPU0140', '湄公大厨9成欧标鱼柳10公斤/箱', '冷冻-18度 | 供应商: 欧泰贡', '10公斤/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 140, 208.00, 0.00, 185.00, 999, 0, NOW(), '0'),
('085ccd76965549f79ecceb855a328400', 'SPU0141', '湄公大厨脆口鱼杂350g*25/箱', '冷冻-18度 | 供应商: 欧泰贡', '350g*25/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 141, 375.00, 0.00, 335.00, 999, 0, NOW(), '0'),
('b8bc40662c2c4290b73980cd2e48ed36', 'SPU0142', '湄公大厨波波脆鱼肚8成兔耳250g*40/箱', '冷冻-18度 | 供应商: 欧泰贡', '250g*40/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 142, 285.00, 0.00, 255.00, 999, 0, NOW(), '0'),
('fa92d5e543634a5ba2e3d7ac84aa9bec', 'SPU0143', '湄公大厨波波脆鱼肚8成开片250g*40/箱', '冷冻-18度 | 供应商: 欧泰贡', '250g*40/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 143, 265.00, 0.00, 235.00, 999, 0, NOW(), '0'),
('d7e1c6a4ec62485da5105b20353e894e', 'SPU0144', '湄公大厨波波脆鱼肚10成开片250g*25/箱', '冷冻-18度 | 供应商: 欧泰贡', '250g*25/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 144, 250.00, 0.00, 200.00, 999, 0, NOW(), '0'),
('0d10d1f7b9784297bccb6a36ad6c865b', 'SPU0145', '湄公大厨波波脆鱼肚10成兔耳250g*25/箱', '冷冻-18度 | 供应商: 欧泰贡', '250g*25/箱', 'ROOT', 'CAT005', '/uploads/products/default.png', '1', 145, 250.00, 0.00, 205.00, 999, 0, NOW(), '0'),
('ad95dc5eb91d47e7b3dd9ade2a0afe94', 'SPU_OFF0146', '隆尚香芋弧形片/2.5kg*8包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '2.5kg*8包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 146, 420.00, 516.00, 320.00, 999, 0, NOW(), '0'),
('0612055b51e043c59a211a084baae9b7', 'SPU_OFF0147', '隆尚香芋丁/5kg*3包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '5kg*3包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 147, 270.00, 360.00, 210.00, 999, 0, NOW(), '0'),
('47e75fdd676f4da99a353a6ce33dadcd', 'SPU_OFF0148', '隆尚香芋条/1.5kg*10包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '1.5kg*10包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 148, 270.00, 312.00, 210.00, 999, 0, NOW(), '0'),
('b4de036a93f840d0a4a335de5c6c8256', 'SPU_OFF0149', '隆尚香芋扇形/2.5kg*6包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '2.5kg*6包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 149, 390.00, 390.00, 320.00, 999, 0, NOW(), '0'),
('867eb2b76de34e8ba6ed28f23a068d2a', 'SPU_OFF0150', '隆尚原味芋泥/1kg*16包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '1kg*16包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 150, 329.00, 329.00, 256.00, 999, 0, NOW(), '0'),
('49fbea542122487f942fea41db1b2691', 'SPU_OFF0151', '隆尚调味芋泥/1kg*16包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '1kg*16包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 151, 328.00, 355.00, 256.00, 999, 0, NOW(), '0'),
('335baa73c0ad4f04afbe8e0864f9593b', 'SPU_OFF0152', '隆尚原味紫薯泥/1kg*16包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '1kg*16包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 152, 350.00, 431.00, 256.00, 999, 0, NOW(), '0'),
('ac3a9b797815483a98aefd5eb82928df', 'SPU_OFF0153', '隆尚原味米麻薯/1kg*16包/箱', '冷冻-18度 | 供应商: 上海隆赢食品科技开发有限公司', '1kg*16包', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 153, 345.00, 400.00, 256.00, 999, 0, NOW(), '0'),
('b9e71632b050426d8f733e7e11f6bbd9', 'SPU_OFF0154', '莓的微笑（奶油草莓冰淇淋）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '120克/袋*40袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 154, 650.00, 937.00, 400.00, 999, 0, NOW(), '0'),
('db339b25f63e461eac2c35b439dfef8f', 'SPU_OFF0155', '金色年华（奶油金桔冰淇淋）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '130克/袋*40袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 155, 650.00, 966.00, 400.00, 999, 0, NOW(), '0'),
('9dcf710ba74945038f8f980e48effe60', 'SPU_OFF0156', '果堡（椰子冰淇淋）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '1个/袋*60袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 156, 980.00, 1456.00, 600.00, 999, 0, NOW(), '0'),
('c7342f6146984e9f807c9c34e40740d5', 'SPU_OFF0157', '果堡（组合型菠萝雪泥）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '1个/袋*40袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 157, 650.00, 966.00, 340.00, 999, 0, NOW(), '0'),
('af4d7f264364401494fcdf2ef4ac7d9b', 'SPU_OFF0158', '果堡（组合型南瓜雪泥）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '1个/袋*40袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 158, 650.00, 946.00, 400.00, 999, 0, NOW(), '0'),
('c890872f8b9f4b3db46206b1ab49f794', 'SPU_OFF0159', '果堡（组合型芒果雪泥）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '1个/袋*70袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 159, 1100.00, 1699.00, 630.00, 999, 0, NOW(), '0'),
('ff9124efd7304ed5a97fcc35929de85c', 'SPU_OFF0160', '果堡（组合型蜜桃雪泥）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '1个/袋*50袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 160, 750.00, 1208.00, 425.00, 999, 0, NOW(), '0'),
('ba279d2dc5ed45fc918b7de6ed988b60', 'SPU_OFF0161', '果堡（组合型柠檬雪泥）', '冷冻-18度 | 供应商: 上海新成格林尔食品启东有限公司', '1个/袋*70袋/箱', 'ROOT', 'CAT014', '/uploads/products/default.png', '0', 161, 1100.00, 1703.00, 630.00, 999, 0, NOW(), '0');

-- 共导入 161 条商品
SELECT COUNT(*) AS spu_count, '商品导入完成' AS status FROM goods_spu;

-- ============================================================
-- 5. order_info - 订单
-- ============================================================
DROP TABLE IF EXISTS order_info CASCADE;
CREATE TABLE order_info (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  del_flag CHAR(2) NOT NULL DEFAULT '0',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(32) NOT NULL,
  order_no VARCHAR(50) NOT NULL,
  payment_way CHAR(2) NOT NULL,
  is_pay CHAR(2) NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  status CHAR(2) DEFAULT NULL,
  freight_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sales_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_time TIMESTAMP DEFAULT NULL,
  delivery_time TIMESTAMP DEFAULT NULL,
  receiver_time TIMESTAMP DEFAULT NULL,
  closing_time TIMESTAMP DEFAULT NULL,
  user_message VARCHAR(100) DEFAULT NULL,
  transaction_id VARCHAR(32) DEFAULT NULL,
  logistics_id VARCHAR(32) DEFAULT NULL,
  remark VARCHAR(255) DEFAULT NULL,
  CONSTRAINT uk_order_no UNIQUE (order_no)
);

COMMENT ON TABLE order_info IS '订单';
COMMENT ON COLUMN order_info.id IS 'PK';
COMMENT ON COLUMN order_info.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN order_info.create_time IS '创建时间';
COMMENT ON COLUMN order_info.update_time IS '最后更新时间';
COMMENT ON COLUMN order_info.user_id IS '用户id';
COMMENT ON COLUMN order_info.order_no IS '订单单号';
COMMENT ON COLUMN order_info.payment_way IS '支付方式1、货到付款；2、在线支付';
COMMENT ON COLUMN order_info.is_pay IS '是否支付0、未支付 1、已支付';
COMMENT ON COLUMN order_info.name IS '订单名';
COMMENT ON COLUMN order_info.status IS '订单状态1、待发货 2、待收货 3、确认收货/已完成 5、已关闭';
COMMENT ON COLUMN order_info.freight_price IS '运费金额';
COMMENT ON COLUMN order_info.sales_price IS '销售金额';
COMMENT ON COLUMN order_info.payment_price IS '支付金额（销售金额+运费金额）';
COMMENT ON COLUMN order_info.payment_time IS '付款时间';
COMMENT ON COLUMN order_info.delivery_time IS '发货时间';
COMMENT ON COLUMN order_info.receiver_time IS '收货时间';
COMMENT ON COLUMN order_info.closing_time IS '成交时间';
COMMENT ON COLUMN order_info.user_message IS '买家留言';
COMMENT ON COLUMN order_info.transaction_id IS '支付交易ID';
COMMENT ON COLUMN order_info.logistics_id IS '物流id';
COMMENT ON COLUMN order_info.remark IS '备注';

CREATE TRIGGER order_info_update_time BEFORE UPDATE ON order_info
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- 6. order_item - 订单详情
-- ============================================================
DROP TABLE IF EXISTS order_item CASCADE;
CREATE TABLE order_item (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  del_flag CHAR(2) NOT NULL DEFAULT '0',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  order_id VARCHAR(32) NOT NULL,
  spu_id VARCHAR(32) DEFAULT NULL,
  spu_name VARCHAR(200) DEFAULT NULL,
  pic_url VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL,
  sales_price DECIMAL(10,2) NOT NULL,
  freight_price DECIMAL(10,2) DEFAULT 0.00,
  payment_price DECIMAL(10,2) DEFAULT 0.00,
  remark VARCHAR(250) DEFAULT NULL,
  status CHAR(2) DEFAULT '0',
  is_refund CHAR(2) DEFAULT '0'
);

COMMENT ON TABLE order_item IS '订单详情';
COMMENT ON COLUMN order_item.id IS 'PK';
COMMENT ON COLUMN order_item.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN order_item.create_time IS '创建时间';
COMMENT ON COLUMN order_item.update_time IS '最后更新时间';
COMMENT ON COLUMN order_item.order_id IS '订单编号';
COMMENT ON COLUMN order_item.spu_id IS '商品Id';
COMMENT ON COLUMN order_item.spu_name IS '商品名';
COMMENT ON COLUMN order_item.pic_url IS '图片';
COMMENT ON COLUMN order_item.quantity IS '商品数量';
COMMENT ON COLUMN order_item.sales_price IS '购买单价';
COMMENT ON COLUMN order_item.freight_price IS '运费金额';
COMMENT ON COLUMN order_item.payment_price IS '支付金额（购买单价*商品数量+运费金额）';
COMMENT ON COLUMN order_item.remark IS '备注';
COMMENT ON COLUMN order_item.status IS '状态0：正常；1：退款中；2:拒绝退款；3：同意退款';
COMMENT ON COLUMN order_item.is_refund IS '是否退款0:否 1：是';

CREATE TRIGGER order_item_update_time BEFORE UPDATE ON order_item
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- 7. order_logistics - 订单物流表
-- ============================================================
DROP TABLE IF EXISTS order_logistics CASCADE;
CREATE TABLE order_logistics (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  del_flag CHAR(2) NOT NULL DEFAULT '0',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  postal_code VARCHAR(10) DEFAULT NULL,
  user_name VARCHAR(50) NOT NULL,
  tel_num VARCHAR(20) NOT NULL,
  address VARCHAR(255) NOT NULL,
  logistics CHAR(20) DEFAULT NULL,
  logistics_no VARCHAR(30) DEFAULT NULL,
  status CHAR(2) DEFAULT NULL,
  is_check CHAR(2) DEFAULT NULL,
  message VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE order_logistics IS '订单物流表';
COMMENT ON COLUMN order_logistics.id IS 'PK';
COMMENT ON COLUMN order_logistics.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN order_logistics.create_time IS '创建时间';
COMMENT ON COLUMN order_logistics.update_time IS '最后更新时间';
COMMENT ON COLUMN order_logistics.postal_code IS '邮编';
COMMENT ON COLUMN order_logistics.user_name IS '收货人名字';
COMMENT ON COLUMN order_logistics.tel_num IS '电话号码';
COMMENT ON COLUMN order_logistics.address IS '详细地址';
COMMENT ON COLUMN order_logistics.logistics IS '物流商家';
COMMENT ON COLUMN order_logistics.logistics_no IS '物流单号';
COMMENT ON COLUMN order_logistics.status IS '快递单当前状态';
COMMENT ON COLUMN order_logistics.is_check IS '签收标记（0：未签收；1：已签收）';
COMMENT ON COLUMN order_logistics.message IS '相关信息';

CREATE TRIGGER order_logistics_update_time BEFORE UPDATE ON order_logistics
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- 8-18. Quartz 调度表
-- ============================================================

-- 8. qrtz_job_details - 任务详细信息表 (先创建，被其他表引用)
DROP TABLE IF EXISTS qrtz_job_details CASCADE;
CREATE TABLE qrtz_job_details (
  sched_name VARCHAR(120) NOT NULL,
  job_name VARCHAR(200) NOT NULL,
  job_group VARCHAR(200) NOT NULL,
  description VARCHAR(250) DEFAULT NULL,
  job_class_name VARCHAR(250) NOT NULL,
  is_durable VARCHAR(1) NOT NULL,
  is_nonconcurrent VARCHAR(1) NOT NULL,
  is_update_data VARCHAR(1) NOT NULL,
  requests_recovery VARCHAR(1) NOT NULL,
  job_data BYTEA,
  PRIMARY KEY (sched_name, job_name, job_group)
);

COMMENT ON TABLE qrtz_job_details IS '任务详细信息表';
COMMENT ON COLUMN qrtz_job_details.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_job_details.job_name IS '任务名称';
COMMENT ON COLUMN qrtz_job_details.job_group IS '任务组名';
COMMENT ON COLUMN qrtz_job_details.description IS '相关介绍';
COMMENT ON COLUMN qrtz_job_details.job_class_name IS '执行任务类名称';
COMMENT ON COLUMN qrtz_job_details.is_durable IS '是否持久化';
COMMENT ON COLUMN qrtz_job_details.is_nonconcurrent IS '是否并发';
COMMENT ON COLUMN qrtz_job_details.is_update_data IS '是否更新数据';
COMMENT ON COLUMN qrtz_job_details.requests_recovery IS '是否接受恢复执行';
COMMENT ON COLUMN qrtz_job_details.job_data IS '存放持久化job对象';

-- 9. qrtz_triggers - 触发器详细信息表
DROP TABLE IF EXISTS qrtz_triggers CASCADE;
CREATE TABLE qrtz_triggers (
  sched_name VARCHAR(120) NOT NULL,
  trigger_name VARCHAR(200) NOT NULL,
  trigger_group VARCHAR(200) NOT NULL,
  job_name VARCHAR(200) NOT NULL,
  job_group VARCHAR(200) NOT NULL,
  description VARCHAR(250) DEFAULT NULL,
  next_fire_time BIGINT DEFAULT NULL,
  prev_fire_time BIGINT DEFAULT NULL,
  priority INTEGER DEFAULT NULL,
  trigger_state VARCHAR(16) NOT NULL,
  trigger_type VARCHAR(8) NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT DEFAULT NULL,
  calendar_name VARCHAR(200) DEFAULT NULL,
  misfire_instr SMALLINT DEFAULT NULL,
  job_data BYTEA,
  PRIMARY KEY (sched_name, trigger_name, trigger_group),
  CONSTRAINT qrtz_triggers_ibfk_1 FOREIGN KEY (sched_name, job_name, job_group)
    REFERENCES qrtz_job_details (sched_name, job_name, job_group) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX idx_qrtz_triggers_job ON qrtz_triggers (sched_name, job_name, job_group);

COMMENT ON TABLE qrtz_triggers IS '触发器详细信息表';
COMMENT ON COLUMN qrtz_triggers.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_triggers.trigger_name IS '触发器的名字';
COMMENT ON COLUMN qrtz_triggers.trigger_group IS '触发器所属组的名字';
COMMENT ON COLUMN qrtz_triggers.job_name IS 'qrtz_job_details表job_name的外键';
COMMENT ON COLUMN qrtz_triggers.job_group IS 'qrtz_job_details表job_group的外键';
COMMENT ON COLUMN qrtz_triggers.description IS '相关介绍';
COMMENT ON COLUMN qrtz_triggers.next_fire_time IS '上一次触发时间（毫秒）';
COMMENT ON COLUMN qrtz_triggers.prev_fire_time IS '下一次触发时间（默认为-1表示不触发）';
COMMENT ON COLUMN qrtz_triggers.priority IS '优先级';
COMMENT ON COLUMN qrtz_triggers.trigger_state IS '触发器状态';
COMMENT ON COLUMN qrtz_triggers.trigger_type IS '触发器的类型';
COMMENT ON COLUMN qrtz_triggers.start_time IS '开始时间';
COMMENT ON COLUMN qrtz_triggers.end_time IS '结束时间';
COMMENT ON COLUMN qrtz_triggers.calendar_name IS '日程表名称';
COMMENT ON COLUMN qrtz_triggers.misfire_instr IS '补偿执行的策略';
COMMENT ON COLUMN qrtz_triggers.job_data IS '存放持久化job对象';

-- 10. qrtz_blob_triggers - Blob类型的触发器表
DROP TABLE IF EXISTS qrtz_blob_triggers CASCADE;
CREATE TABLE qrtz_blob_triggers (
  sched_name VARCHAR(120) NOT NULL,
  trigger_name VARCHAR(200) NOT NULL,
  trigger_group VARCHAR(200) NOT NULL,
  blob_data BYTEA,
  PRIMARY KEY (sched_name, trigger_name, trigger_group),
  CONSTRAINT qrtz_blob_triggers_ibfk_1 FOREIGN KEY (sched_name, trigger_name, trigger_group)
    REFERENCES qrtz_triggers (sched_name, trigger_name, trigger_group) ON DELETE RESTRICT ON UPDATE RESTRICT
);

COMMENT ON TABLE qrtz_blob_triggers IS 'Blob类型的触发器表';
COMMENT ON COLUMN qrtz_blob_triggers.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_blob_triggers.trigger_name IS 'qrtz_triggers表trigger_name的外键';
COMMENT ON COLUMN qrtz_blob_triggers.trigger_group IS 'qrtz_triggers表trigger_group的外键';
COMMENT ON COLUMN qrtz_blob_triggers.blob_data IS '存放持久化Trigger对象';

-- 11. qrtz_calendars - 日历信息表
DROP TABLE IF EXISTS qrtz_calendars CASCADE;
CREATE TABLE qrtz_calendars (
  sched_name VARCHAR(120) NOT NULL,
  calendar_name VARCHAR(200) NOT NULL,
  calendar BYTEA NOT NULL,
  PRIMARY KEY (sched_name, calendar_name)
);

COMMENT ON TABLE qrtz_calendars IS '日历信息表';
COMMENT ON COLUMN qrtz_calendars.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_calendars.calendar_name IS '日历名称';
COMMENT ON COLUMN qrtz_calendars.calendar IS '存放持久化calendar对象';

-- 12. qrtz_cron_triggers - Cron类型的触发器表
DROP TABLE IF EXISTS qrtz_cron_triggers CASCADE;
CREATE TABLE qrtz_cron_triggers (
  sched_name VARCHAR(120) NOT NULL,
  trigger_name VARCHAR(200) NOT NULL,
  trigger_group VARCHAR(200) NOT NULL,
  cron_expression VARCHAR(200) NOT NULL,
  time_zone_id VARCHAR(80) DEFAULT NULL,
  PRIMARY KEY (sched_name, trigger_name, trigger_group),
  CONSTRAINT qrtz_cron_triggers_ibfk_1 FOREIGN KEY (sched_name, trigger_name, trigger_group)
    REFERENCES qrtz_triggers (sched_name, trigger_name, trigger_group) ON DELETE RESTRICT ON UPDATE RESTRICT
);

COMMENT ON TABLE qrtz_cron_triggers IS 'Cron类型的触发器表';
COMMENT ON COLUMN qrtz_cron_triggers.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_cron_triggers.trigger_name IS 'qrtz_triggers表trigger_name的外键';
COMMENT ON COLUMN qrtz_cron_triggers.trigger_group IS 'qrtz_triggers表trigger_group的外键';
COMMENT ON COLUMN qrtz_cron_triggers.cron_expression IS 'cron表达式';
COMMENT ON COLUMN qrtz_cron_triggers.time_zone_id IS '时区';

-- 13. qrtz_fired_triggers - 已触发的触发器表
DROP TABLE IF EXISTS qrtz_fired_triggers CASCADE;
CREATE TABLE qrtz_fired_triggers (
  sched_name VARCHAR(120) NOT NULL,
  entry_id VARCHAR(95) NOT NULL,
  trigger_name VARCHAR(200) NOT NULL,
  trigger_group VARCHAR(200) NOT NULL,
  instance_name VARCHAR(200) NOT NULL,
  fired_time BIGINT NOT NULL,
  sched_time BIGINT NOT NULL,
  priority INTEGER NOT NULL,
  state VARCHAR(16) NOT NULL,
  job_name VARCHAR(200) DEFAULT NULL,
  job_group VARCHAR(200) DEFAULT NULL,
  is_nonconcurrent VARCHAR(1) DEFAULT NULL,
  requests_recovery VARCHAR(1) DEFAULT NULL,
  PRIMARY KEY (sched_name, entry_id)
);

COMMENT ON TABLE qrtz_fired_triggers IS '已触发的触发器表';
COMMENT ON COLUMN qrtz_fired_triggers.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_fired_triggers.entry_id IS '调度器实例id';
COMMENT ON COLUMN qrtz_fired_triggers.trigger_name IS 'qrtz_triggers表trigger_name的外键';
COMMENT ON COLUMN qrtz_fired_triggers.trigger_group IS 'qrtz_triggers表trigger_group的外键';
COMMENT ON COLUMN qrtz_fired_triggers.instance_name IS '调度器实例名';
COMMENT ON COLUMN qrtz_fired_triggers.fired_time IS '触发的时间';
COMMENT ON COLUMN qrtz_fired_triggers.sched_time IS '定时器制定的时间';
COMMENT ON COLUMN qrtz_fired_triggers.priority IS '优先级';
COMMENT ON COLUMN qrtz_fired_triggers.state IS '状态';
COMMENT ON COLUMN qrtz_fired_triggers.job_name IS '任务名称';
COMMENT ON COLUMN qrtz_fired_triggers.job_group IS '任务组名';
COMMENT ON COLUMN qrtz_fired_triggers.is_nonconcurrent IS '是否并发';
COMMENT ON COLUMN qrtz_fired_triggers.requests_recovery IS '是否接受恢复执行';

-- 14. qrtz_locks - 存储的悲观锁信息表
DROP TABLE IF EXISTS qrtz_locks CASCADE;
CREATE TABLE qrtz_locks (
  sched_name VARCHAR(120) NOT NULL,
  lock_name VARCHAR(40) NOT NULL,
  PRIMARY KEY (sched_name, lock_name)
);

COMMENT ON TABLE qrtz_locks IS '存储的悲观锁信息表';
COMMENT ON COLUMN qrtz_locks.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_locks.lock_name IS '悲观锁名称';

-- 15. qrtz_paused_trigger_grps - 暂停的触发器表
DROP TABLE IF EXISTS qrtz_paused_trigger_grps CASCADE;
CREATE TABLE qrtz_paused_trigger_grps (
  sched_name VARCHAR(120) NOT NULL,
  trigger_group VARCHAR(200) NOT NULL,
  PRIMARY KEY (sched_name, trigger_group)
);

COMMENT ON TABLE qrtz_paused_trigger_grps IS '暂停的触发器表';
COMMENT ON COLUMN qrtz_paused_trigger_grps.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_paused_trigger_grps.trigger_group IS 'qrtz_triggers表trigger_group的外键';

-- 16. qrtz_scheduler_state - 调度器状态表
DROP TABLE IF EXISTS qrtz_scheduler_state CASCADE;
CREATE TABLE qrtz_scheduler_state (
  sched_name VARCHAR(120) NOT NULL,
  instance_name VARCHAR(200) NOT NULL,
  last_checkin_time BIGINT NOT NULL,
  checkin_interval BIGINT NOT NULL,
  PRIMARY KEY (sched_name, instance_name)
);

COMMENT ON TABLE qrtz_scheduler_state IS '调度器状态表';
COMMENT ON COLUMN qrtz_scheduler_state.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_scheduler_state.instance_name IS '实例名称';
COMMENT ON COLUMN qrtz_scheduler_state.last_checkin_time IS '上次检查时间';
COMMENT ON COLUMN qrtz_scheduler_state.checkin_interval IS '检查间隔时间';

-- 17. qrtz_simple_triggers - 简单触发器的信息表
DROP TABLE IF EXISTS qrtz_simple_triggers CASCADE;
CREATE TABLE qrtz_simple_triggers (
  sched_name VARCHAR(120) NOT NULL,
  trigger_name VARCHAR(200) NOT NULL,
  trigger_group VARCHAR(200) NOT NULL,
  repeat_count BIGINT NOT NULL,
  repeat_interval BIGINT NOT NULL,
  times_triggered BIGINT NOT NULL,
  PRIMARY KEY (sched_name, trigger_name, trigger_group),
  CONSTRAINT qrtz_simple_triggers_ibfk_1 FOREIGN KEY (sched_name, trigger_name, trigger_group)
    REFERENCES qrtz_triggers (sched_name, trigger_name, trigger_group) ON DELETE RESTRICT ON UPDATE RESTRICT
);

COMMENT ON TABLE qrtz_simple_triggers IS '简单触发器的信息表';
COMMENT ON COLUMN qrtz_simple_triggers.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_simple_triggers.trigger_name IS 'qrtz_triggers表trigger_name的外键';
COMMENT ON COLUMN qrtz_simple_triggers.trigger_group IS 'qrtz_triggers表trigger_group的外键';
COMMENT ON COLUMN qrtz_simple_triggers.repeat_count IS '重复的次数统计';
COMMENT ON COLUMN qrtz_simple_triggers.repeat_interval IS '重复的间隔时间';
COMMENT ON COLUMN qrtz_simple_triggers.times_triggered IS '已经触发的次数';

-- 18. qrtz_simprop_triggers - 同步机制的行锁表
DROP TABLE IF EXISTS qrtz_simprop_triggers CASCADE;
CREATE TABLE qrtz_simprop_triggers (
  sched_name VARCHAR(120) NOT NULL,
  trigger_name VARCHAR(200) NOT NULL,
  trigger_group VARCHAR(200) NOT NULL,
  str_prop_1 VARCHAR(512) DEFAULT NULL,
  str_prop_2 VARCHAR(512) DEFAULT NULL,
  str_prop_3 VARCHAR(512) DEFAULT NULL,
  int_prop_1 INTEGER DEFAULT NULL,
  int_prop_2 INTEGER DEFAULT NULL,
  long_prop_1 BIGINT DEFAULT NULL,
  long_prop_2 BIGINT DEFAULT NULL,
  dec_prop_1 DECIMAL(13,4) DEFAULT NULL,
  dec_prop_2 DECIMAL(13,4) DEFAULT NULL,
  bool_prop_1 VARCHAR(1) DEFAULT NULL,
  bool_prop_2 VARCHAR(1) DEFAULT NULL,
  PRIMARY KEY (sched_name, trigger_name, trigger_group),
  CONSTRAINT qrtz_simprop_triggers_ibfk_1 FOREIGN KEY (sched_name, trigger_name, trigger_group)
    REFERENCES qrtz_triggers (sched_name, trigger_name, trigger_group) ON DELETE RESTRICT ON UPDATE RESTRICT
);

COMMENT ON TABLE qrtz_simprop_triggers IS '同步机制的行锁表';
COMMENT ON COLUMN qrtz_simprop_triggers.sched_name IS '调度名称';
COMMENT ON COLUMN qrtz_simprop_triggers.trigger_name IS 'qrtz_triggers表trigger_name的外键';
COMMENT ON COLUMN qrtz_simprop_triggers.trigger_group IS 'qrtz_triggers表trigger_group的外键';
COMMENT ON COLUMN qrtz_simprop_triggers.str_prop_1 IS 'String类型的trigger的第一个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.str_prop_2 IS 'String类型的trigger的第二个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.str_prop_3 IS 'String类型的trigger的第三个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.int_prop_1 IS 'int类型的trigger的第一个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.int_prop_2 IS 'int类型的trigger的第二个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.long_prop_1 IS 'long类型的trigger的第一个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.long_prop_2 IS 'long类型的trigger的第二个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.dec_prop_1 IS 'decimal类型的trigger的第一个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.dec_prop_2 IS 'decimal类型的trigger的第二个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.bool_prop_1 IS 'Boolean类型的trigger的第一个参数';
COMMENT ON COLUMN qrtz_simprop_triggers.bool_prop_2 IS 'Boolean类型的trigger的第二个参数';

-- ============================================================
-- 19. shopping_cart - 购物车
-- ============================================================
DROP TABLE IF EXISTS shopping_cart CASCADE;
CREATE TABLE shopping_cart (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  del_flag CHAR(2) NOT NULL DEFAULT '0',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(32) NOT NULL,
  spu_id VARCHAR(32) NOT NULL,
  quantity INTEGER NOT NULL,
  spu_name VARCHAR(200) DEFAULT NULL,
  add_price DECIMAL(10,2) DEFAULT NULL,
  pic_url VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE shopping_cart IS '购物车';
COMMENT ON COLUMN shopping_cart.id IS 'PK';
COMMENT ON COLUMN shopping_cart.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN shopping_cart.create_time IS '创建时间';
COMMENT ON COLUMN shopping_cart.update_time IS '最后更新时间';
COMMENT ON COLUMN shopping_cart.user_id IS '用户编号';
COMMENT ON COLUMN shopping_cart.spu_id IS '商品SPU';
COMMENT ON COLUMN shopping_cart.quantity IS '数量';
COMMENT ON COLUMN shopping_cart.spu_name IS '加入时的spu名字';
COMMENT ON COLUMN shopping_cart.add_price IS '加入时价格';
COMMENT ON COLUMN shopping_cart.pic_url IS '图片';

CREATE TRIGGER shopping_cart_update_time BEFORE UPDATE ON shopping_cart
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- 20. sys_config - 参数配置表
-- ============================================================
DROP TABLE IF EXISTS sys_config CASCADE;
CREATE TABLE sys_config (
  config_id SERIAL PRIMARY KEY,
  config_name VARCHAR(100) DEFAULT '',
  config_key VARCHAR(100) DEFAULT '',
  config_value VARCHAR(500) DEFAULT '',
  config_type CHAR(1) DEFAULT 'N',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE sys_config IS '参数配置表';
COMMENT ON COLUMN sys_config.config_id IS '参数主键';
COMMENT ON COLUMN sys_config.config_name IS '参数名称';
COMMENT ON COLUMN sys_config.config_key IS '参数键名';
COMMENT ON COLUMN sys_config.config_value IS '参数键值';
COMMENT ON COLUMN sys_config.config_type IS '系统内置（Y是 N否）';
COMMENT ON COLUMN sys_config.create_by IS '创建者';
COMMENT ON COLUMN sys_config.create_time IS '创建时间';
COMMENT ON COLUMN sys_config.update_by IS '更新者';
COMMENT ON COLUMN sys_config.update_time IS '更新时间';
COMMENT ON COLUMN sys_config.remark IS '备注';

INSERT INTO sys_config VALUES (1, '主框架页-默认皮肤样式名称', 'sys.index.skinName', 'skin-blue', 'Y', 'admin', '2024-09-11 09:31:32', '', null, '蓝色 skin-blue、绿色 skin-green、紫色 skin-purple、红色 skin-red、黄色 skin-yellow');
INSERT INTO sys_config VALUES (2, '用户管理-账号初始密码', 'sys.user.initPassword', '123456', 'Y', 'admin', '2024-09-11 09:31:32', '', null, '初始化密码 123456');
INSERT INTO sys_config VALUES (3, '主框架页-侧边栏主题', 'sys.index.sideTheme', 'theme-dark', 'Y', 'admin', '2024-09-11 09:31:32', '', null, '深色主题theme-dark，浅色主题theme-light');
INSERT INTO sys_config VALUES (4, '账号自助-验证码开关', 'sys.account.captchaEnabled', 'true', 'Y', 'admin', '2024-09-11 09:31:32', '', null, '是否开启验证码功能（true开启，false关闭）');
INSERT INTO sys_config VALUES (5, '账号自助-是否开启用户注册功能', 'sys.account.registerUser', 'false', 'Y', 'admin', '2024-09-11 09:31:32', '', null, '是否开启注册用户功能（true开启，false关闭）');
INSERT INTO sys_config VALUES (6, '用户登录-黑名单列表', 'sys.login.blackIPList', '', 'Y', 'admin', '2024-09-11 09:31:32', '', null, '设置登录IP黑名单限制，多个匹配项以;分隔，支持匹配（*通配、网段）');
SELECT setval('sys_config_config_id_seq', 100);

-- ============================================================
-- 21. sys_dept - 部门表
-- ============================================================
DROP TABLE IF EXISTS sys_dept CASCADE;
CREATE TABLE sys_dept (
  dept_id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT DEFAULT 0,
  ancestors VARCHAR(50) DEFAULT '',
  dept_name VARCHAR(30) DEFAULT '',
  order_num INTEGER DEFAULT 0,
  leader VARCHAR(20) DEFAULT NULL,
  phone VARCHAR(11) DEFAULT NULL,
  email VARCHAR(50) DEFAULT NULL,
  status CHAR(1) DEFAULT '0',
  del_flag CHAR(1) DEFAULT '0',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE sys_dept IS '部门表';
COMMENT ON COLUMN sys_dept.dept_id IS '部门id';
COMMENT ON COLUMN sys_dept.parent_id IS '父部门id';
COMMENT ON COLUMN sys_dept.ancestors IS '祖级列表';
COMMENT ON COLUMN sys_dept.dept_name IS '部门名称';
COMMENT ON COLUMN sys_dept.order_num IS '显示顺序';
COMMENT ON COLUMN sys_dept.leader IS '负责人';
COMMENT ON COLUMN sys_dept.phone IS '联系电话';
COMMENT ON COLUMN sys_dept.email IS '邮箱';
COMMENT ON COLUMN sys_dept.status IS '部门状态（0正常 1停用）';
COMMENT ON COLUMN sys_dept.del_flag IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN sys_dept.create_by IS '创建者';
COMMENT ON COLUMN sys_dept.create_time IS '创建时间';
COMMENT ON COLUMN sys_dept.update_by IS '更新者';
COMMENT ON COLUMN sys_dept.update_time IS '更新时间';

INSERT INTO sys_dept VALUES (100, 0, '0', '若依科技', 0, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (101, 100, '0,100', '深圳总公司', 1, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (102, 100, '0,100', '长沙分公司', 2, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (103, 101, '0,100,101', '研发部门', 1, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (104, 101, '0,100,101', '市场部门', 2, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (105, 101, '0,100,101', '测试部门', 3, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (106, 101, '0,100,101', '财务部门', 4, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (107, 101, '0,100,101', '运维部门', 5, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (108, 102, '0,100,102', '市场部门', 1, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
INSERT INTO sys_dept VALUES (109, 102, '0,100,102', '财务部门', 2, '若依', '15888888888', 'ry@qq.com', '0', '0', 'admin', '2024-09-11 09:31:30', '', null);
SELECT setval('sys_dept_dept_id_seq', 200);

-- ============================================================
-- 22. sys_dict_data - 字典数据表
-- ============================================================
DROP TABLE IF EXISTS sys_dict_data CASCADE;
CREATE TABLE sys_dict_data (
  dict_code BIGSERIAL PRIMARY KEY,
  dict_sort INTEGER DEFAULT 0,
  dict_label VARCHAR(100) DEFAULT '',
  dict_value VARCHAR(100) DEFAULT '',
  dict_type VARCHAR(100) DEFAULT '',
  css_class VARCHAR(100) DEFAULT NULL,
  list_class VARCHAR(100) DEFAULT NULL,
  is_default CHAR(1) DEFAULT 'N',
  status CHAR(1) DEFAULT '0',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE sys_dict_data IS '字典数据表';
COMMENT ON COLUMN sys_dict_data.dict_code IS '字典编码';
COMMENT ON COLUMN sys_dict_data.dict_sort IS '字典排序';
COMMENT ON COLUMN sys_dict_data.dict_label IS '字典标签';
COMMENT ON COLUMN sys_dict_data.dict_value IS '字典键值';
COMMENT ON COLUMN sys_dict_data.dict_type IS '字典类型';
COMMENT ON COLUMN sys_dict_data.css_class IS '样式属性（其他样式扩展）';
COMMENT ON COLUMN sys_dict_data.list_class IS '表格回显样式';
COMMENT ON COLUMN sys_dict_data.is_default IS '是否默认（Y是 N否）';
COMMENT ON COLUMN sys_dict_data.status IS '状态（0正常 1停用）';
COMMENT ON COLUMN sys_dict_data.create_by IS '创建者';
COMMENT ON COLUMN sys_dict_data.create_time IS '创建时间';
COMMENT ON COLUMN sys_dict_data.update_by IS '更新者';
COMMENT ON COLUMN sys_dict_data.update_time IS '更新时间';
COMMENT ON COLUMN sys_dict_data.remark IS '备注';

INSERT INTO sys_dict_data VALUES (1, 1, '男', '0', 'sys_user_sex', '', '', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '性别男');
INSERT INTO sys_dict_data VALUES (2, 2, '女', '1', 'sys_user_sex', '', '', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '性别女');
INSERT INTO sys_dict_data VALUES (3, 3, '未知', '2', 'sys_user_sex', '', '', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '性别未知');
INSERT INTO sys_dict_data VALUES (4, 1, '显示', '0', 'sys_show_hide', '', 'primary', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '显示菜单');
INSERT INTO sys_dict_data VALUES (5, 2, '隐藏', '1', 'sys_show_hide', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '隐藏菜单');
INSERT INTO sys_dict_data VALUES (6, 1, '正常', '0', 'sys_normal_disable', '', 'primary', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '正常状态');
INSERT INTO sys_dict_data VALUES (7, 2, '停用', '1', 'sys_normal_disable', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '停用状态');
INSERT INTO sys_dict_data VALUES (8, 1, '正常', '0', 'sys_job_status', '', 'primary', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '正常状态');
INSERT INTO sys_dict_data VALUES (9, 2, '暂停', '1', 'sys_job_status', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '停用状态');
INSERT INTO sys_dict_data VALUES (10, 1, '默认', 'DEFAULT', 'sys_job_group', '', '', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '默认分组');
INSERT INTO sys_dict_data VALUES (11, 2, '系统', 'SYSTEM', 'sys_job_group', '', '', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '系统分组');
INSERT INTO sys_dict_data VALUES (12, 1, '是', 'Y', 'sys_yes_no', '', 'primary', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '系统默认是');
INSERT INTO sys_dict_data VALUES (13, 2, '否', 'N', 'sys_yes_no', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '系统默认否');
INSERT INTO sys_dict_data VALUES (14, 1, '通知', '1', 'sys_notice_type', '', 'warning', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '通知');
INSERT INTO sys_dict_data VALUES (15, 2, '公告', '2', 'sys_notice_type', '', 'success', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '公告');
INSERT INTO sys_dict_data VALUES (16, 1, '正常', '0', 'sys_notice_status', '', 'primary', 'Y', '0', 'admin', '2024-09-11 09:31:32', '', null, '正常状态');
INSERT INTO sys_dict_data VALUES (17, 2, '关闭', '1', 'sys_notice_status', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '关闭状态');
INSERT INTO sys_dict_data VALUES (18, 99, '其他', '0', 'sys_oper_type', '', 'info', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '其他操作');
INSERT INTO sys_dict_data VALUES (19, 1, '新增', '1', 'sys_oper_type', '', 'info', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '新增操作');
INSERT INTO sys_dict_data VALUES (20, 2, '修改', '2', 'sys_oper_type', '', 'info', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '修改操作');
INSERT INTO sys_dict_data VALUES (21, 3, '删除', '3', 'sys_oper_type', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '删除操作');
INSERT INTO sys_dict_data VALUES (22, 4, '授权', '4', 'sys_oper_type', '', 'primary', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '授权操作');
INSERT INTO sys_dict_data VALUES (23, 5, '导出', '5', 'sys_oper_type', '', 'warning', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '导出操作');
INSERT INTO sys_dict_data VALUES (24, 6, '导入', '6', 'sys_oper_type', '', 'warning', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '导入操作');
INSERT INTO sys_dict_data VALUES (25, 7, '强退', '7', 'sys_oper_type', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '强退操作');
INSERT INTO sys_dict_data VALUES (26, 8, '生成代码', '8', 'sys_oper_type', '', 'warning', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '生成操作');
INSERT INTO sys_dict_data VALUES (27, 9, '清空数据', '9', 'sys_oper_type', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '清空操作');
INSERT INTO sys_dict_data VALUES (28, 1, '成功', '0', 'sys_common_status', '', 'primary', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '正常状态');
INSERT INTO sys_dict_data VALUES (29, 2, '失败', '1', 'sys_common_status', '', 'danger', 'N', '0', 'admin', '2024-09-11 09:31:32', '', null, '停用状态');
SELECT setval('sys_dict_data_dict_code_seq', 100);

-- ============================================================
-- 23. sys_dict_type - 字典类型表
-- ============================================================
DROP TABLE IF EXISTS sys_dict_type CASCADE;
CREATE TABLE sys_dict_type (
  dict_id BIGSERIAL PRIMARY KEY,
  dict_name VARCHAR(100) DEFAULT '',
  dict_type VARCHAR(100) DEFAULT '',
  status CHAR(1) DEFAULT '0',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL,
  CONSTRAINT uk_dict_type UNIQUE (dict_type)
);

COMMENT ON TABLE sys_dict_type IS '字典类型表';
COMMENT ON COLUMN sys_dict_type.dict_id IS '字典主键';
COMMENT ON COLUMN sys_dict_type.dict_name IS '字典名称';
COMMENT ON COLUMN sys_dict_type.dict_type IS '字典类型';
COMMENT ON COLUMN sys_dict_type.status IS '状态（0正常 1停用）';
COMMENT ON COLUMN sys_dict_type.create_by IS '创建者';
COMMENT ON COLUMN sys_dict_type.create_time IS '创建时间';
COMMENT ON COLUMN sys_dict_type.update_by IS '更新者';
COMMENT ON COLUMN sys_dict_type.update_time IS '更新时间';
COMMENT ON COLUMN sys_dict_type.remark IS '备注';

INSERT INTO sys_dict_type VALUES (1, '用户性别', 'sys_user_sex', '0', 'admin', '2024-09-11 09:31:32', '', null, '用户性别列表');
INSERT INTO sys_dict_type VALUES (2, '菜单状态', 'sys_show_hide', '0', 'admin', '2024-09-11 09:31:32', '', null, '菜单状态列表');
INSERT INTO sys_dict_type VALUES (3, '系统开关', 'sys_normal_disable', '0', 'admin', '2024-09-11 09:31:32', '', null, '系统开关列表');
INSERT INTO sys_dict_type VALUES (4, '任务状态', 'sys_job_status', '0', 'admin', '2024-09-11 09:31:32', '', null, '任务状态列表');
INSERT INTO sys_dict_type VALUES (5, '任务分组', 'sys_job_group', '0', 'admin', '2024-09-11 09:31:32', '', null, '任务分组列表');
INSERT INTO sys_dict_type VALUES (6, '系统是否', 'sys_yes_no', '0', 'admin', '2024-09-11 09:31:32', '', null, '系统是否列表');
INSERT INTO sys_dict_type VALUES (7, '通知类型', 'sys_notice_type', '0', 'admin', '2024-09-11 09:31:32', '', null, '通知类型列表');
INSERT INTO sys_dict_type VALUES (8, '通知状态', 'sys_notice_status', '0', 'admin', '2024-09-11 09:31:32', '', null, '通知状态列表');
INSERT INTO sys_dict_type VALUES (9, '操作类型', 'sys_oper_type', '0', 'admin', '2024-09-11 09:31:32', '', null, '操作类型列表');
INSERT INTO sys_dict_type VALUES (10, '系统状态', 'sys_common_status', '0', 'admin', '2024-09-11 09:31:32', '', null, '登录状态列表');
SELECT setval('sys_dict_type_dict_id_seq', 100);

-- ============================================================
-- 24. sys_job - 定时任务调度表
-- ============================================================
DROP TABLE IF EXISTS sys_job CASCADE;
CREATE TABLE sys_job (
  job_id BIGSERIAL,
  job_name VARCHAR(64) NOT NULL DEFAULT '',
  job_group VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  invoke_target VARCHAR(500) NOT NULL,
  cron_expression VARCHAR(255) DEFAULT '',
  misfire_policy VARCHAR(20) DEFAULT '3',
  concurrent CHAR(1) DEFAULT '1',
  status CHAR(1) DEFAULT '0',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT '',
  PRIMARY KEY (job_id, job_name, job_group)
);

COMMENT ON TABLE sys_job IS '定时任务调度表';
COMMENT ON COLUMN sys_job.job_id IS '任务ID';
COMMENT ON COLUMN sys_job.job_name IS '任务名称';
COMMENT ON COLUMN sys_job.job_group IS '任务组名';
COMMENT ON COLUMN sys_job.invoke_target IS '调用目标字符串';
COMMENT ON COLUMN sys_job.cron_expression IS 'cron执行表达式';
COMMENT ON COLUMN sys_job.misfire_policy IS '计划执行错误策略（1立即执行 2执行一次 3放弃执行）';
COMMENT ON COLUMN sys_job.concurrent IS '是否并发执行（0允许 1禁止）';
COMMENT ON COLUMN sys_job.status IS '状态（0正常 1暂停）';
COMMENT ON COLUMN sys_job.create_by IS '创建者';
COMMENT ON COLUMN sys_job.create_time IS '创建时间';
COMMENT ON COLUMN sys_job.update_by IS '更新者';
COMMENT ON COLUMN sys_job.update_time IS '更新时间';
COMMENT ON COLUMN sys_job.remark IS '备注信息';

INSERT INTO sys_job VALUES (1, '系统默认（无参）', 'DEFAULT', 'ryTask.ryNoParams', '0/10 * * * * ?', '3', '1', '1', 'admin', '2024-09-11 09:31:32', '', null, '');
INSERT INTO sys_job VALUES (2, '系统默认（有参）', 'DEFAULT', 'ryTask.ryParams(''ry'')', '0/15 * * * * ?', '3', '1', '1', 'admin', '2024-09-11 09:31:32', '', null, '');
INSERT INTO sys_job VALUES (3, '系统默认（多参）', 'DEFAULT', 'ryTask.ryMultipleParams(''ry'', true, 2000L, 316.50D, 100)', '0/20 * * * * ?', '3', '1', '1', 'admin', '2024-09-11 09:31:32', '', null, '');
SELECT setval('sys_job_job_id_seq', 100);

-- ============================================================
-- 25. sys_job_log - 定时任务调度日志表
-- ============================================================
DROP TABLE IF EXISTS sys_job_log CASCADE;
CREATE TABLE sys_job_log (
  job_log_id BIGSERIAL PRIMARY KEY,
  job_name VARCHAR(64) NOT NULL,
  job_group VARCHAR(64) NOT NULL,
  invoke_target VARCHAR(500) NOT NULL,
  job_message VARCHAR(500) DEFAULT NULL,
  status CHAR(1) DEFAULT '0',
  exception_info VARCHAR(2000) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE sys_job_log IS '定时任务调度日志表';
COMMENT ON COLUMN sys_job_log.job_log_id IS '任务日志ID';
COMMENT ON COLUMN sys_job_log.job_name IS '任务名称';
COMMENT ON COLUMN sys_job_log.job_group IS '任务组名';
COMMENT ON COLUMN sys_job_log.invoke_target IS '调用目标字符串';
COMMENT ON COLUMN sys_job_log.job_message IS '日志信息';
COMMENT ON COLUMN sys_job_log.status IS '执行状态（0正常 1失败）';
COMMENT ON COLUMN sys_job_log.exception_info IS '异常信息';
COMMENT ON COLUMN sys_job_log.create_time IS '创建时间';

-- ============================================================
-- 26. sys_logininfor - 系统访问记录
-- ============================================================
DROP TABLE IF EXISTS sys_logininfor CASCADE;
CREATE TABLE sys_logininfor (
  info_id BIGSERIAL PRIMARY KEY,
  user_name VARCHAR(50) DEFAULT '',
  ipaddr VARCHAR(128) DEFAULT '',
  login_location VARCHAR(255) DEFAULT '',
  browser VARCHAR(50) DEFAULT '',
  os VARCHAR(50) DEFAULT '',
  status CHAR(1) DEFAULT '0',
  msg VARCHAR(255) DEFAULT '',
  login_time TIMESTAMP DEFAULT NULL
);

CREATE INDEX idx_sys_logininfor_s ON sys_logininfor (status);
CREATE INDEX idx_sys_logininfor_lt ON sys_logininfor (login_time);

COMMENT ON TABLE sys_logininfor IS '系统访问记录';
COMMENT ON COLUMN sys_logininfor.info_id IS '访问ID';
COMMENT ON COLUMN sys_logininfor.user_name IS '用户账号';
COMMENT ON COLUMN sys_logininfor.ipaddr IS '登录IP地址';
COMMENT ON COLUMN sys_logininfor.login_location IS '登录地点';
COMMENT ON COLUMN sys_logininfor.browser IS '浏览器类型';
COMMENT ON COLUMN sys_logininfor.os IS '操作系统';
COMMENT ON COLUMN sys_logininfor.status IS '登录状态（0成功 1失败）';
COMMENT ON COLUMN sys_logininfor.msg IS '提示消息';
COMMENT ON COLUMN sys_logininfor.login_time IS '访问时间';

SELECT setval('sys_logininfor_info_id_seq', 200);

-- ============================================================
-- 27. sys_menu - 菜单权限表
-- ============================================================
DROP TABLE IF EXISTS sys_menu CASCADE;
CREATE TABLE sys_menu (
  menu_id BIGSERIAL PRIMARY KEY,
  menu_name VARCHAR(50) NOT NULL,
  parent_id BIGINT DEFAULT 0,
  order_num INTEGER DEFAULT 0,
  path VARCHAR(200) DEFAULT '',
  component VARCHAR(255) DEFAULT NULL,
  query VARCHAR(255) DEFAULT NULL,
  route_name VARCHAR(50) DEFAULT '',
  is_frame INTEGER DEFAULT 1,
  is_cache INTEGER DEFAULT 0,
  menu_type CHAR(1) DEFAULT '',
  visible CHAR(1) DEFAULT '0',
  status CHAR(1) DEFAULT '0',
  perms VARCHAR(100) DEFAULT NULL,
  icon VARCHAR(100) DEFAULT '#',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT ''
);

COMMENT ON TABLE sys_menu IS '菜单权限表';
COMMENT ON COLUMN sys_menu.menu_id IS '菜单ID';
COMMENT ON COLUMN sys_menu.menu_name IS '菜单名称';
COMMENT ON COLUMN sys_menu.parent_id IS '父菜单ID';
COMMENT ON COLUMN sys_menu.order_num IS '显示顺序';
COMMENT ON COLUMN sys_menu.path IS '路由地址';
COMMENT ON COLUMN sys_menu.component IS '组件路径';
COMMENT ON COLUMN sys_menu.query IS '路由参数';
COMMENT ON COLUMN sys_menu.route_name IS '路由名称';
COMMENT ON COLUMN sys_menu.is_frame IS '是否为外链（0是 1否）';
COMMENT ON COLUMN sys_menu.is_cache IS '是否缓存（0缓存 1不缓存）';
COMMENT ON COLUMN sys_menu.menu_type IS '菜单类型（M目录 C菜单 F按钮）';
COMMENT ON COLUMN sys_menu.visible IS '菜单状态（0显示 1隐藏）';
COMMENT ON COLUMN sys_menu.status IS '菜单状态（0正常 1停用）';
COMMENT ON COLUMN sys_menu.perms IS '权限标识';
COMMENT ON COLUMN sys_menu.icon IS '菜单图标';
COMMENT ON COLUMN sys_menu.create_by IS '创建者';
COMMENT ON COLUMN sys_menu.create_time IS '创建时间';
COMMENT ON COLUMN sys_menu.update_by IS '更新者';
COMMENT ON COLUMN sys_menu.update_time IS '更新时间';
COMMENT ON COLUMN sys_menu.remark IS '备注';

SELECT setval('sys_menu_menu_id_seq', 2100);

-- ============================================================
-- 28. sys_notice - 通知公告表
-- ============================================================
DROP TABLE IF EXISTS sys_notice CASCADE;
CREATE TABLE sys_notice (
  notice_id SERIAL PRIMARY KEY,
  notice_title VARCHAR(50) NOT NULL,
  notice_type CHAR(1) NOT NULL,
  notice_content BYTEA,
  status CHAR(1) DEFAULT '0',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(255) DEFAULT NULL
);

COMMENT ON TABLE sys_notice IS '通知公告表';
COMMENT ON COLUMN sys_notice.notice_id IS '公告ID';
COMMENT ON COLUMN sys_notice.notice_title IS '公告标题';
COMMENT ON COLUMN sys_notice.notice_type IS '公告类型（1通知 2公告）';
COMMENT ON COLUMN sys_notice.notice_content IS '公告内容';
COMMENT ON COLUMN sys_notice.status IS '公告状态（0正常 1关闭）';
COMMENT ON COLUMN sys_notice.create_by IS '创建者';
COMMENT ON COLUMN sys_notice.create_time IS '创建时间';
COMMENT ON COLUMN sys_notice.update_by IS '更新者';
COMMENT ON COLUMN sys_notice.update_time IS '更新时间';
COMMENT ON COLUMN sys_notice.remark IS '备注';

INSERT INTO sys_notice VALUES (1, '温馨提醒：2018-07-01 若依新版本发布啦', '2', E'\\xe696b0e78988e69cace58685e5aeb9'::bytea, '0', 'admin', '2024-09-11 09:31:32', '', null, '管理员');
INSERT INTO sys_notice VALUES (2, '维护通知：2018-07-01 若依系统凌晨维护', '1', E'\\xe7bbb4e68aa4e58685e5aeb9'::bytea, '0', 'admin', '2024-09-11 09:31:32', '', null, '管理员');
SELECT setval('sys_notice_notice_id_seq', 10);

-- ============================================================
-- 29. sys_oper_log - 操作日志记录
-- ============================================================
DROP TABLE IF EXISTS sys_oper_log CASCADE;
CREATE TABLE sys_oper_log (
  oper_id BIGSERIAL PRIMARY KEY,
  title VARCHAR(50) DEFAULT '',
  business_type INTEGER DEFAULT 0,
  method VARCHAR(200) DEFAULT '',
  request_method VARCHAR(10) DEFAULT '',
  operator_type INTEGER DEFAULT 0,
  oper_name VARCHAR(50) DEFAULT '',
  dept_name VARCHAR(50) DEFAULT '',
  oper_url VARCHAR(255) DEFAULT '',
  oper_ip VARCHAR(128) DEFAULT '',
  oper_location VARCHAR(255) DEFAULT '',
  oper_param VARCHAR(2000) DEFAULT '',
  json_result VARCHAR(2000) DEFAULT '',
  status INTEGER DEFAULT 0,
  error_msg VARCHAR(2000) DEFAULT '',
  oper_time TIMESTAMP DEFAULT NULL,
  cost_time BIGINT DEFAULT 0
);

CREATE INDEX idx_sys_oper_log_bt ON sys_oper_log (business_type);
CREATE INDEX idx_sys_oper_log_s ON sys_oper_log (status);
CREATE INDEX idx_sys_oper_log_ot ON sys_oper_log (oper_time);

COMMENT ON TABLE sys_oper_log IS '操作日志记录';
COMMENT ON COLUMN sys_oper_log.oper_id IS '日志主键';
COMMENT ON COLUMN sys_oper_log.title IS '模块标题';
COMMENT ON COLUMN sys_oper_log.business_type IS '业务类型（0其它 1新增 2修改 3删除）';
COMMENT ON COLUMN sys_oper_log.method IS '方法名称';
COMMENT ON COLUMN sys_oper_log.request_method IS '请求方式';
COMMENT ON COLUMN sys_oper_log.operator_type IS '操作类别（0其它 1后台用户 2手机端用户）';
COMMENT ON COLUMN sys_oper_log.oper_name IS '操作人员';
COMMENT ON COLUMN sys_oper_log.dept_name IS '部门名称';
COMMENT ON COLUMN sys_oper_log.oper_url IS '请求URL';
COMMENT ON COLUMN sys_oper_log.oper_ip IS '主机地址';
COMMENT ON COLUMN sys_oper_log.oper_location IS '操作地点';
COMMENT ON COLUMN sys_oper_log.oper_param IS '请求参数';
COMMENT ON COLUMN sys_oper_log.json_result IS '返回参数';
COMMENT ON COLUMN sys_oper_log.status IS '操作状态（0正常 1异常）';
COMMENT ON COLUMN sys_oper_log.error_msg IS '错误消息';
COMMENT ON COLUMN sys_oper_log.oper_time IS '操作时间';
COMMENT ON COLUMN sys_oper_log.cost_time IS '消耗时间';

SELECT setval('sys_oper_log_oper_id_seq', 200);

-- ============================================================
-- 30. sys_post - 岗位信息表
-- ============================================================
DROP TABLE IF EXISTS sys_post CASCADE;
CREATE TABLE sys_post (
  post_id BIGSERIAL PRIMARY KEY,
  post_code VARCHAR(64) NOT NULL,
  post_name VARCHAR(50) NOT NULL,
  post_sort INTEGER NOT NULL,
  status CHAR(1) NOT NULL,
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE sys_post IS '岗位信息表';
COMMENT ON COLUMN sys_post.post_id IS '岗位ID';
COMMENT ON COLUMN sys_post.post_code IS '岗位编码';
COMMENT ON COLUMN sys_post.post_name IS '岗位名称';
COMMENT ON COLUMN sys_post.post_sort IS '显示顺序';
COMMENT ON COLUMN sys_post.status IS '状态（0正常 1停用）';
COMMENT ON COLUMN sys_post.create_by IS '创建者';
COMMENT ON COLUMN sys_post.create_time IS '创建时间';
COMMENT ON COLUMN sys_post.update_by IS '更新者';
COMMENT ON COLUMN sys_post.update_time IS '更新时间';
COMMENT ON COLUMN sys_post.remark IS '备注';

INSERT INTO sys_post VALUES (1, 'ceo', '董事长', 1, '0', 'admin', '2024-09-11 09:31:31', '', null, '');
INSERT INTO sys_post VALUES (2, 'se', '项目经理', 2, '0', 'admin', '2024-09-11 09:31:31', '', null, '');
INSERT INTO sys_post VALUES (3, 'hr', '人力资源', 3, '0', 'admin', '2024-09-11 09:31:31', '', null, '');
INSERT INTO sys_post VALUES (4, 'user', '普通员工', 4, '0', 'admin', '2024-09-11 09:31:31', '', null, '');
SELECT setval('sys_post_post_id_seq', 10);

-- ============================================================
-- 31. sys_role - 角色信息表
-- ============================================================
DROP TABLE IF EXISTS sys_role CASCADE;
CREATE TABLE sys_role (
  role_id BIGSERIAL PRIMARY KEY,
  role_name VARCHAR(30) NOT NULL,
  role_key VARCHAR(100) NOT NULL,
  role_sort INTEGER NOT NULL,
  data_scope CHAR(1) DEFAULT '1',
  menu_check_strictly BOOLEAN DEFAULT TRUE,
  dept_check_strictly BOOLEAN DEFAULT TRUE,
  status CHAR(1) NOT NULL,
  del_flag CHAR(1) DEFAULT '0',
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE sys_role IS '角色信息表';
COMMENT ON COLUMN sys_role.role_id IS '角色ID';
COMMENT ON COLUMN sys_role.role_name IS '角色名称';
COMMENT ON COLUMN sys_role.role_key IS '角色权限字符串';
COMMENT ON COLUMN sys_role.role_sort IS '显示顺序';
COMMENT ON COLUMN sys_role.data_scope IS '数据范围（1：全部数据权限 2：自定数据权限 3：本部门数据权限 4：本部门及以下数据权限）';
COMMENT ON COLUMN sys_role.menu_check_strictly IS '菜单树选择项是否关联显示';
COMMENT ON COLUMN sys_role.dept_check_strictly IS '部门树选择项是否关联显示';
COMMENT ON COLUMN sys_role.status IS '角色状态（0正常 1停用）';
COMMENT ON COLUMN sys_role.del_flag IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN sys_role.create_by IS '创建者';
COMMENT ON COLUMN sys_role.create_time IS '创建时间';
COMMENT ON COLUMN sys_role.update_by IS '更新者';
COMMENT ON COLUMN sys_role.update_time IS '更新时间';
COMMENT ON COLUMN sys_role.remark IS '备注';

INSERT INTO sys_role VALUES (1, '超级管理员', 'admin', 1, '1', true, true, '0', '0', 'admin', '2024-09-11 09:31:31', '', null, '超级管理员');
INSERT INTO sys_role VALUES (2, '普通角色', 'common', 2, '2', true, true, '0', '0', 'admin', '2024-09-11 09:31:31', '', null, '普通角色');
SELECT setval('sys_role_role_id_seq', 100);

-- ============================================================
-- 32. sys_role_dept - 角色和部门关联表
-- ============================================================
DROP TABLE IF EXISTS sys_role_dept CASCADE;
CREATE TABLE sys_role_dept (
  role_id BIGINT NOT NULL,
  dept_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, dept_id)
);

COMMENT ON TABLE sys_role_dept IS '角色和部门关联表';
COMMENT ON COLUMN sys_role_dept.role_id IS '角色ID';
COMMENT ON COLUMN sys_role_dept.dept_id IS '部门ID';

INSERT INTO sys_role_dept VALUES (2, 100);
INSERT INTO sys_role_dept VALUES (2, 101);
INSERT INTO sys_role_dept VALUES (2, 105);

-- ============================================================
-- 33. sys_role_menu - 角色和菜单关联表
-- ============================================================
DROP TABLE IF EXISTS sys_role_menu CASCADE;
CREATE TABLE sys_role_menu (
  role_id BIGINT NOT NULL,
  menu_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, menu_id)
);

COMMENT ON TABLE sys_role_menu IS '角色和菜单关联表';
COMMENT ON COLUMN sys_role_menu.role_id IS '角色ID';
COMMENT ON COLUMN sys_role_menu.menu_id IS '菜单ID';

-- ============================================================
-- 34. sys_user - 用户信息表
-- ============================================================
DROP TABLE IF EXISTS sys_user CASCADE;
CREATE TABLE sys_user (
  user_id BIGSERIAL PRIMARY KEY,
  dept_id BIGINT DEFAULT NULL,
  user_name VARCHAR(30) NOT NULL,
  nick_name VARCHAR(30) NOT NULL,
  user_type VARCHAR(2) DEFAULT '00',
  email VARCHAR(50) DEFAULT '',
  phonenumber VARCHAR(11) DEFAULT '',
  sex CHAR(1) DEFAULT '0',
  avatar VARCHAR(100) DEFAULT '',
  password VARCHAR(100) DEFAULT '',
  status CHAR(1) DEFAULT '0',
  del_flag CHAR(1) DEFAULT '0',
  login_ip VARCHAR(128) DEFAULT '',
  login_date TIMESTAMP DEFAULT NULL,
  create_by VARCHAR(64) DEFAULT '',
  create_time TIMESTAMP DEFAULT NULL,
  update_by VARCHAR(64) DEFAULT '',
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL
);

COMMENT ON TABLE sys_user IS '用户信息表';
COMMENT ON COLUMN sys_user.user_id IS '用户ID';
COMMENT ON COLUMN sys_user.dept_id IS '部门ID';
COMMENT ON COLUMN sys_user.user_name IS '用户账号';
COMMENT ON COLUMN sys_user.nick_name IS '用户昵称';
COMMENT ON COLUMN sys_user.user_type IS '用户类型（00系统用户）';
COMMENT ON COLUMN sys_user.email IS '用户邮箱';
COMMENT ON COLUMN sys_user.phonenumber IS '手机号码';
COMMENT ON COLUMN sys_user.sex IS '用户性别（0男 1女 2未知）';
COMMENT ON COLUMN sys_user.avatar IS '头像地址';
COMMENT ON COLUMN sys_user.password IS '密码';
COMMENT ON COLUMN sys_user.status IS '帐号状态（0正常 1停用）';
COMMENT ON COLUMN sys_user.del_flag IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN sys_user.login_ip IS '最后登录IP';
COMMENT ON COLUMN sys_user.login_date IS '最后登录时间';
COMMENT ON COLUMN sys_user.create_by IS '创建者';
COMMENT ON COLUMN sys_user.create_time IS '创建时间';
COMMENT ON COLUMN sys_user.update_by IS '更新者';
COMMENT ON COLUMN sys_user.update_time IS '更新时间';
COMMENT ON COLUMN sys_user.remark IS '备注';

INSERT INTO sys_user VALUES (1, 103, 'admin', '若依', '00', 'ry@163.com', '15888888888', '1', '', '$2a$10$5xHoUZhD8r9WvwRHb.IN/evATLicjSuRZAHx2ONPPAdjgRw8UgvIy', '0', '0', '127.0.0.1', '2025-12-24 15:01:52', 'admin', '2024-09-11 09:31:31', '', '2025-12-24 15:01:52', '管理员');
INSERT INTO sys_user VALUES (2, 105, 'ry', '若依', '00', 'ry@qq.com', '15666666666', '1', '', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', '127.0.0.1', '2024-09-11 09:31:31', 'admin', '2024-09-11 09:31:31', '', null, '测试员');
SELECT setval('sys_user_user_id_seq', 100);

-- ============================================================
-- 35. sys_user_post - 用户与岗位关联表
-- ============================================================
DROP TABLE IF EXISTS sys_user_post CASCADE;
CREATE TABLE sys_user_post (
  user_id BIGINT NOT NULL,
  post_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

COMMENT ON TABLE sys_user_post IS '用户与岗位关联表';
COMMENT ON COLUMN sys_user_post.user_id IS '用户ID';
COMMENT ON COLUMN sys_user_post.post_id IS '岗位ID';

INSERT INTO sys_user_post VALUES (1, 1);
INSERT INTO sys_user_post VALUES (2, 2);

-- ============================================================
-- 36. sys_user_role - 用户和角色关联表
-- ============================================================
DROP TABLE IF EXISTS sys_user_role CASCADE;
CREATE TABLE sys_user_role (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE sys_user_role IS '用户和角色关联表';
COMMENT ON COLUMN sys_user_role.user_id IS '用户ID';
COMMENT ON COLUMN sys_user_role.role_id IS '角色ID';

INSERT INTO sys_user_role VALUES (1, 1);
INSERT INTO sys_user_role VALUES (2, 2);

-- ============================================================
-- 37. user_address - 用户地址
-- ============================================================
DROP TABLE IF EXISTS user_address CASCADE;
CREATE TABLE user_address (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  del_flag CHAR(2) NOT NULL DEFAULT '0',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(32) NOT NULL,
  user_name VARCHAR(50) DEFAULT NULL,
  postal_code VARCHAR(50) DEFAULT NULL,
  province_name VARCHAR(50) DEFAULT NULL,
  city_name VARCHAR(50) DEFAULT NULL,
  county_name VARCHAR(50) DEFAULT NULL,
  detail_info VARCHAR(50) DEFAULT NULL,
  tel_num VARCHAR(50) DEFAULT NULL,
  is_default CHAR(2) DEFAULT NULL
);

COMMENT ON TABLE user_address IS '用户地址';
COMMENT ON COLUMN user_address.id IS 'PK';
COMMENT ON COLUMN user_address.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN user_address.create_time IS '创建时间';
COMMENT ON COLUMN user_address.update_time IS '最后更新时间';
COMMENT ON COLUMN user_address.user_id IS '用户编号';
COMMENT ON COLUMN user_address.user_name IS '收货人名字';
COMMENT ON COLUMN user_address.postal_code IS '邮编';
COMMENT ON COLUMN user_address.province_name IS '省名';
COMMENT ON COLUMN user_address.city_name IS '市名';
COMMENT ON COLUMN user_address.county_name IS '区名';
COMMENT ON COLUMN user_address.detail_info IS '详情地址';
COMMENT ON COLUMN user_address.tel_num IS '电话号码';
COMMENT ON COLUMN user_address.is_default IS '是否默认 1是0否';

CREATE TRIGGER user_address_update_time BEFORE UPDATE ON user_address
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

INSERT INTO user_address VALUES ('1354441894547988481', '0', '2021-01-27 22:51:26', '2021-01-27 22:51:26', '1352168072700571649', '张三', null, '广东省', '广州市', '海珠区', '新港中路397号', '18602513214', '1');
INSERT INTO user_address VALUES ('1354474056307511297', '0', '2021-01-28 00:59:14', '2021-01-28 00:59:14', '1354473059078176770', '张三', null, '广东省', '广州市', '海珠区', '新港中路397号', '18563265321', '1');
INSERT INTO user_address VALUES ('1355417330850476033', '0', '2021-01-30 15:27:29', '2021-01-30 15:27:29', '1355406809988345857', '张三', null, '北京市', '北京市', '东城区', '大冲地铁口', '15580802543', '1');

-- ============================================================
-- 38. wx_auto_reply - 微信自动回复
-- ============================================================
DROP TABLE IF EXISTS wx_auto_reply CASCADE;
CREATE TABLE wx_auto_reply (
  id VARCHAR(32) NOT NULL DEFAULT '' PRIMARY KEY,
  create_id VARCHAR(32) DEFAULT NULL,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_id VARCHAR(32) DEFAULT NULL,
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(100) DEFAULT NULL,
  del_flag CHAR(2) DEFAULT '0',
  type CHAR(2) DEFAULT NULL,
  req_key VARCHAR(64) DEFAULT NULL,
  req_type CHAR(10) DEFAULT NULL,
  rep_type CHAR(10) DEFAULT NULL,
  rep_mate CHAR(10) DEFAULT NULL,
  rep_content TEXT,
  rep_media_id VARCHAR(64) DEFAULT NULL,
  rep_name VARCHAR(100) DEFAULT NULL,
  rep_desc VARCHAR(200) DEFAULT NULL,
  rep_url VARCHAR(500) DEFAULT NULL,
  rep_hq_url VARCHAR(500) DEFAULT NULL,
  rep_thumb_media_id VARCHAR(64) DEFAULT NULL,
  rep_thumb_url VARCHAR(500) DEFAULT NULL,
  content TEXT
);

COMMENT ON TABLE wx_auto_reply IS '微信自动回复';
COMMENT ON COLUMN wx_auto_reply.id IS '主键';
COMMENT ON COLUMN wx_auto_reply.create_id IS '创建者';
COMMENT ON COLUMN wx_auto_reply.create_time IS '创建时间';
COMMENT ON COLUMN wx_auto_reply.update_id IS '更新者';
COMMENT ON COLUMN wx_auto_reply.update_time IS '更新时间';
COMMENT ON COLUMN wx_auto_reply.remark IS '备注';
COMMENT ON COLUMN wx_auto_reply.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN wx_auto_reply.type IS '类型（1、关注时回复；2、消息回复；3、关键词回复）';
COMMENT ON COLUMN wx_auto_reply.req_key IS '关键词';
COMMENT ON COLUMN wx_auto_reply.req_type IS '请求消息类型';
COMMENT ON COLUMN wx_auto_reply.rep_type IS '回复消息类型';
COMMENT ON COLUMN wx_auto_reply.rep_mate IS '回复类型文本匹配类型（1、全匹配，2、半匹配）';
COMMENT ON COLUMN wx_auto_reply.rep_content IS '回复类型文本保存文字';
COMMENT ON COLUMN wx_auto_reply.rep_media_id IS '回复类型imge、voice、news、video的mediaID或音乐缩略图的媒体id';
COMMENT ON COLUMN wx_auto_reply.rep_name IS '回复的素材名、视频和音乐的标题';
COMMENT ON COLUMN wx_auto_reply.rep_desc IS '视频和音乐的描述';
COMMENT ON COLUMN wx_auto_reply.rep_url IS '链接';
COMMENT ON COLUMN wx_auto_reply.rep_hq_url IS '高质量链接';
COMMENT ON COLUMN wx_auto_reply.rep_thumb_media_id IS '缩略图的媒体id';
COMMENT ON COLUMN wx_auto_reply.rep_thumb_url IS '缩略图url';
COMMENT ON COLUMN wx_auto_reply.content IS '图文消息的内容';

-- ============================================================
-- 39. wx_menu - 自定义菜单表
-- ============================================================
DROP TABLE IF EXISTS wx_menu CASCADE;
CREATE TABLE wx_menu (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  del_flag CHAR(2) DEFAULT '0',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT NULL,
  sort INTEGER DEFAULT 1,
  parent_id VARCHAR(32) DEFAULT NULL,
  type CHAR(20) DEFAULT NULL,
  name VARCHAR(20) DEFAULT NULL,
  url VARCHAR(500) DEFAULT NULL,
  ma_app_id VARCHAR(32) DEFAULT NULL,
  ma_page_path VARCHAR(100) DEFAULT NULL,
  rep_type CHAR(10) DEFAULT NULL,
  rep_content TEXT,
  rep_media_id VARCHAR(64) DEFAULT NULL,
  rep_name VARCHAR(100) DEFAULT NULL,
  rep_desc VARCHAR(200) DEFAULT NULL,
  rep_url VARCHAR(500) DEFAULT NULL,
  rep_hq_url VARCHAR(500) DEFAULT NULL,
  rep_thumb_media_id VARCHAR(64) DEFAULT NULL,
  rep_thumb_url VARCHAR(500) DEFAULT NULL,
  content TEXT
);

COMMENT ON TABLE wx_menu IS '自定义菜单表';
COMMENT ON COLUMN wx_menu.id IS '菜单ID';
COMMENT ON COLUMN wx_menu.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN wx_menu.create_time IS '创建时间';
COMMENT ON COLUMN wx_menu.update_time IS '更新时间';
COMMENT ON COLUMN wx_menu.sort IS '排序值';
COMMENT ON COLUMN wx_menu.parent_id IS '父菜单ID';
COMMENT ON COLUMN wx_menu.type IS '菜单类型';
COMMENT ON COLUMN wx_menu.name IS '菜单名';
COMMENT ON COLUMN wx_menu.url IS 'view、miniprogram保存链接';
COMMENT ON COLUMN wx_menu.ma_app_id IS '小程序的appid';
COMMENT ON COLUMN wx_menu.ma_page_path IS '小程序的页面路径';
COMMENT ON COLUMN wx_menu.rep_type IS '回复消息类型';
COMMENT ON COLUMN wx_menu.rep_content IS 'Text:保存文字';
COMMENT ON COLUMN wx_menu.rep_media_id IS 'imge、voice、news、video：mediaID';
COMMENT ON COLUMN wx_menu.rep_name IS '素材名、视频和音乐的标题';
COMMENT ON COLUMN wx_menu.rep_desc IS '视频和音乐的描述';
COMMENT ON COLUMN wx_menu.rep_url IS '链接';
COMMENT ON COLUMN wx_menu.rep_hq_url IS '高质量链接';
COMMENT ON COLUMN wx_menu.rep_thumb_media_id IS '缩略图的媒体id';
COMMENT ON COLUMN wx_menu.rep_thumb_url IS '缩略图url';
COMMENT ON COLUMN wx_menu.content IS '图文消息的内容';

-- ============================================================
-- 40. wx_msg - 微信消息
-- ============================================================
DROP TABLE IF EXISTS wx_msg CASCADE;
CREATE TABLE wx_msg (
  id VARCHAR(32) NOT NULL DEFAULT '' PRIMARY KEY,
  create_id VARCHAR(32) DEFAULT NULL,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_id VARCHAR(32) DEFAULT NULL,
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(100) DEFAULT NULL,
  del_flag CHAR(2) DEFAULT '0',
  app_name VARCHAR(50) DEFAULT NULL,
  app_logo VARCHAR(500) DEFAULT NULL,
  wx_user_id VARCHAR(32) NOT NULL,
  nick_name VARCHAR(200) DEFAULT NULL,
  headimg_url VARCHAR(1000) DEFAULT NULL,
  type CHAR(2) DEFAULT NULL,
  rep_type CHAR(20) DEFAULT NULL,
  rep_event CHAR(20) DEFAULT NULL,
  rep_content TEXT,
  rep_media_id VARCHAR(64) DEFAULT NULL,
  rep_name VARCHAR(100) DEFAULT NULL,
  rep_desc VARCHAR(200) DEFAULT NULL,
  rep_url VARCHAR(500) DEFAULT NULL,
  rep_hq_url VARCHAR(500) DEFAULT NULL,
  content TEXT,
  rep_thumb_media_id VARCHAR(64) DEFAULT NULL,
  rep_thumb_url VARCHAR(500) DEFAULT NULL,
  rep_location_x DOUBLE PRECISION DEFAULT NULL,
  rep_location_y DOUBLE PRECISION DEFAULT NULL,
  rep_scale DOUBLE PRECISION DEFAULT NULL,
  read_flag CHAR(2) DEFAULT '1'
);

COMMENT ON TABLE wx_msg IS '微信消息';
COMMENT ON COLUMN wx_msg.id IS '主键';
COMMENT ON COLUMN wx_msg.create_id IS '创建者';
COMMENT ON COLUMN wx_msg.create_time IS '创建时间';
COMMENT ON COLUMN wx_msg.update_id IS '更新者';
COMMENT ON COLUMN wx_msg.update_time IS '更新时间';
COMMENT ON COLUMN wx_msg.remark IS '备注';
COMMENT ON COLUMN wx_msg.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN wx_msg.app_name IS '公众号名称';
COMMENT ON COLUMN wx_msg.app_logo IS '公众号logo';
COMMENT ON COLUMN wx_msg.wx_user_id IS '微信用户ID';
COMMENT ON COLUMN wx_msg.nick_name IS '微信用户昵称';
COMMENT ON COLUMN wx_msg.headimg_url IS '微信用户头像';
COMMENT ON COLUMN wx_msg.type IS '消息分类（1、用户发给公众号；2、公众号发给用户；）';
COMMENT ON COLUMN wx_msg.rep_type IS '消息类型';
COMMENT ON COLUMN wx_msg.rep_event IS '事件类型';
COMMENT ON COLUMN wx_msg.rep_content IS '回复类型文本保存文字、地理位置信息';
COMMENT ON COLUMN wx_msg.rep_media_id IS '回复类型imge、voice、news、video的mediaID或音乐缩略图的媒体id';
COMMENT ON COLUMN wx_msg.rep_name IS '回复的素材名、视频和音乐的标题';
COMMENT ON COLUMN wx_msg.rep_desc IS '视频和音乐的描述';
COMMENT ON COLUMN wx_msg.rep_url IS '链接';
COMMENT ON COLUMN wx_msg.rep_hq_url IS '高质量链接';
COMMENT ON COLUMN wx_msg.content IS '图文消息的内容';
COMMENT ON COLUMN wx_msg.rep_thumb_media_id IS '缩略图的媒体id';
COMMENT ON COLUMN wx_msg.rep_thumb_url IS '缩略图url';
COMMENT ON COLUMN wx_msg.rep_location_x IS '地理位置维度';
COMMENT ON COLUMN wx_msg.rep_location_y IS '地理位置经度';
COMMENT ON COLUMN wx_msg.rep_scale IS '地图缩放大小';
COMMENT ON COLUMN wx_msg.read_flag IS '已读标记（1：是；0：否）';

-- ============================================================
-- 41. wx_user - 微信用户
-- ============================================================
DROP TABLE IF EXISTS wx_user CASCADE;
CREATE TABLE wx_user (
  id VARCHAR(32) NOT NULL DEFAULT '' PRIMARY KEY,
  create_id VARCHAR(32) DEFAULT NULL,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_id VARCHAR(32) DEFAULT NULL,
  update_time TIMESTAMP DEFAULT NULL,
  remark VARCHAR(100) DEFAULT NULL,
  del_flag CHAR(2) DEFAULT '0',
  app_type CHAR(2) DEFAULT NULL,
  subscribe CHAR(2) DEFAULT NULL,
  subscribe_scene VARCHAR(50) DEFAULT NULL,
  subscribe_time TIMESTAMP DEFAULT NULL,
  subscribe_num INTEGER DEFAULT NULL,
  cancel_subscribe_time TIMESTAMP DEFAULT NULL,
  open_id VARCHAR(64) NOT NULL,
  nick_name VARCHAR(200) DEFAULT NULL,
  sex CHAR(2) DEFAULT NULL,
  city VARCHAR(64) DEFAULT NULL,
  country VARCHAR(64) DEFAULT NULL,
  province VARCHAR(64) DEFAULT NULL,
  phone VARCHAR(15) DEFAULT NULL,
  language VARCHAR(64) DEFAULT NULL,
  headimg_url VARCHAR(1000) DEFAULT NULL,
  union_id VARCHAR(64) DEFAULT NULL,
  group_id VARCHAR(64) DEFAULT NULL,
  tagid_list VARCHAR(64) DEFAULT NULL,
  qr_scene_str VARCHAR(64) DEFAULT NULL,
  latitude DOUBLE PRECISION DEFAULT NULL,
  longitude DOUBLE PRECISION DEFAULT NULL,
  precision DOUBLE PRECISION DEFAULT NULL,
  session_key VARCHAR(200) DEFAULT NULL,
  CONSTRAINT uk_openid UNIQUE (open_id)
);

COMMENT ON TABLE wx_user IS '微信用户';
COMMENT ON COLUMN wx_user.id IS '主键';
COMMENT ON COLUMN wx_user.create_id IS '创建者';
COMMENT ON COLUMN wx_user.create_time IS '创建时间';
COMMENT ON COLUMN wx_user.update_id IS '更新者';
COMMENT ON COLUMN wx_user.update_time IS '更新时间';
COMMENT ON COLUMN wx_user.remark IS '用户备注';
COMMENT ON COLUMN wx_user.del_flag IS '逻辑删除标记（0：显示；1：隐藏）';
COMMENT ON COLUMN wx_user.app_type IS '应用类型(1:小程序，2:公众号)';
COMMENT ON COLUMN wx_user.subscribe IS '是否订阅（1：是；0：否；2：网页授权用户）';
COMMENT ON COLUMN wx_user.subscribe_scene IS '返回用户关注的渠道来源';
COMMENT ON COLUMN wx_user.subscribe_time IS '关注时间';
COMMENT ON COLUMN wx_user.subscribe_num IS '关注次数';
COMMENT ON COLUMN wx_user.cancel_subscribe_time IS '取消关注时间';
COMMENT ON COLUMN wx_user.open_id IS '用户标识';
COMMENT ON COLUMN wx_user.nick_name IS '昵称';
COMMENT ON COLUMN wx_user.sex IS '性别（1：男，2：女，0：未知）';
COMMENT ON COLUMN wx_user.city IS '所在城市';
COMMENT ON COLUMN wx_user.country IS '所在国家';
COMMENT ON COLUMN wx_user.province IS '所在省份';
COMMENT ON COLUMN wx_user.phone IS '手机号码';
COMMENT ON COLUMN wx_user.language IS '用户语言';
COMMENT ON COLUMN wx_user.headimg_url IS '头像';
COMMENT ON COLUMN wx_user.union_id IS 'union_id';
COMMENT ON COLUMN wx_user.group_id IS '用户组';
COMMENT ON COLUMN wx_user.tagid_list IS '标签列表';
COMMENT ON COLUMN wx_user.qr_scene_str IS '二维码扫码场景';
COMMENT ON COLUMN wx_user.latitude IS '地理位置纬度';
COMMENT ON COLUMN wx_user.longitude IS '地理位置经度';
COMMENT ON COLUMN wx_user.precision IS '地理位置精度';
COMMENT ON COLUMN wx_user.session_key IS '会话密钥';

-- ============================================================
-- 转换完成
-- 总计: 41 张表
-- ============================================================
