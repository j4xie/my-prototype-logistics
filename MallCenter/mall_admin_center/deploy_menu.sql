-- MallCenter 自定义菜单配置 SQL
-- 执行方式: mysql -u root -p joolun < deploy_menu.sql
-- 或在 MySQL 命令行中直接粘贴执行

-- 1. 商户管理 (一级菜单)
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms, icon)
VALUES (2000, '商户管理', 0, 3, 'merchant', NULL, 'M', '0', '0', '', 'peoples');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2001, '商户列表', 2000, 1, 'list', 'mall/merchant/index', 'C', '0', '0', 'mall:merchant:list');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2002, '状态管理', 2000, 2, 'status', 'mall/merchant/status-management', 'C', '0', '0', 'mall:merchant:status');

-- 2. 溯源管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms, icon)
VALUES (2010, '溯源管理', 0, 4, 'traceability', NULL, 'M', '0', '0', '', 'tree');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2011, '批次管理', 2010, 1, 'batch-list', 'mall/traceability/index', 'C', '0', '0', 'mall:traceability:list');

-- 3. 广告系统
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms, icon)
VALUES (2020, '广告系统', 0, 5, 'advertisement', NULL, 'M', '0', '0', '', 'guide');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2021, '广告列表', 2020, 1, 'list', 'mall/advertisement/index', 'C', '0', '0', 'mall:advertisement:list');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2022, '广告位配置', 2020, 2, 'slots', 'mall/advertisement/slots', 'C', '0', '0', 'mall:advertisement:slots');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2023, '精选商品', 2020, 3, 'featured', 'mall/advertisement/featured', 'C', '0', '0', 'mall:advertisement:featured');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2024, '排名配置', 2020, 4, 'ranking', 'mall/advertisement/ranking', 'C', '0', '0', 'mall:advertisement:ranking');

-- 4. 内容审核
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms, icon)
VALUES (2030, '内容审核', 0, 6, 'content-review', NULL, 'M', '0', '0', '', 'eye-open');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2031, '审核队列', 2030, 1, 'queue', 'mall/content-review/queue', 'C', '0', '0', 'mall:content:review');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2032, 'Banner管理', 2030, 2, 'banner', 'mall/content-review/banner', 'C', '0', '0', 'mall:content:review');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2033, '审核策略', 2030, 3, 'strategy', 'mall/content-review/strategy', 'C', '0', '0', 'mall:content:review');

-- 5. AI知识库
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms, icon)
VALUES (2040, 'AI知识库', 0, 7, 'ai-knowledge', NULL, 'M', '0', '0', '', 'education');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2041, '知识库管理', 2040, 1, 'index', 'mall/ai-knowledge/index', 'C', '0', '0', 'mall:ai:knowledge');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2042, '文档上传', 2040, 2, 'upload', 'mall/ai-knowledge/upload', 'C', '0', '0', 'mall:ai:knowledge');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2043, '分类管理', 2040, 3, 'category', 'mall/ai-knowledge/category', 'C', '0', '0', 'mall:ai:knowledge');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2044, 'QA配对', 2040, 4, 'qa-pairs', 'mall/ai-knowledge/qa-pairs', 'C', '0', '0', 'mall:ai:knowledge');

-- 6. 推荐管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms, icon)
VALUES (2050, '推荐管理', 0, 8, 'referral', NULL, 'M', '0', '0', '', 'share');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2051, '推荐列表', 2050, 1, 'index', 'mall/referral/index', 'C', '0', '0', 'mall:referral:list');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms)
VALUES (2052, '奖励配置', 2050, 2, 'config', 'mall/referral/reward-config', 'C', '0', '0', 'mall:referral:config');

-- 验证插入结果
SELECT menu_id, menu_name, parent_id, path, component FROM sys_menu WHERE menu_id >= 2000 ORDER BY menu_id;
