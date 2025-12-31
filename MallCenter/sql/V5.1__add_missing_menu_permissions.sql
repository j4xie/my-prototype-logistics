-- =====================================================
-- V5.1 添加缺失的菜单权限数据
-- 补充 广告管理、溯源管理、商户管理 的菜单配置
-- 与后端 @ss.hasPermi 注解100%匹配
-- =====================================================

-- ==============================
-- 1. 广告管理菜单及权限
-- ==============================

-- 主菜单: 广告管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3050, '广告管理', 0, 70, 'advertisement', null, 1, 0, 'M', '0', '0', '', 'guide', 'admin', NOW(), '广告管理目录')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 广告列表
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3051, '广告列表', 3050, 1, 'index', 'mall/advertisement/index', 1, 0, 'C', '0', '0', 'mall:advertisement:index', 'list', 'admin', NOW(), '广告列表管理页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 广告位管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3052, '广告位管理', 3050, 2, 'slots', 'mall/advertisement/slots', 1, 0, 'C', '0', '0', 'mall:advertisement:index', 'component', 'admin', NOW(), '广告位管理页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 精选推荐
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3053, '精选推荐', 3050, 3, 'featured', 'mall/advertisement/featured', 1, 0, 'C', '0', '0', 'mall:advertisement:edit', 'star', 'admin', NOW(), '精选推荐配置页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 排行榜
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3054, '排行榜', 3050, 4, 'ranking', 'mall/advertisement/ranking', 1, 0, 'C', '0', '0', 'mall:advertisement:index', 'chart', 'admin', NOW(), '排行榜管理页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子权限按钮
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3055, '广告查询', 3051, 1, '', null, 1, 0, 'F', '0', '0', 'mall:advertisement:get', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3056, '广告新增', 3051, 2, '', null, 1, 0, 'F', '0', '0', 'mall:advertisement:add', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3057, '广告编辑', 3051, 3, '', null, 1, 0, 'F', '0', '0', 'mall:advertisement:edit', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3058, '广告删除', 3051, 4, '', null, 1, 0, 'F', '0', '0', 'mall:advertisement:del', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ==============================
-- 2. 溯源管理菜单及权限
-- ==============================

-- 主菜单: 溯源管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3060, '溯源管理', 0, 65, 'traceability', null, 1, 0, 'M', '0', '0', '', 'tree-table', 'admin', NOW(), '溯源管理目录')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 批次列表
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3061, '批次列表', 3060, 1, 'index', 'mall/traceability/index', 1, 0, 'C', '0', '0', 'mall:traceability:index', 'list', 'admin', NOW(), '溯源批次列表页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 创建批次
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3062, '创建批次', 3060, 2, 'create', 'mall/traceability/create', 1, 0, 'C', '0', '0', 'mall:traceability:add', 'edit', 'admin', NOW(), '创建溯源批次页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子权限按钮
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3063, '批次查询', 3061, 1, '', null, 1, 0, 'F', '0', '0', 'mall:traceability:get', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3064, '批次新增', 3061, 2, '', null, 1, 0, 'F', '0', '0', 'mall:traceability:add', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3065, '批次编辑', 3061, 3, '', null, 1, 0, 'F', '0', '0', 'mall:traceability:edit', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3066, '批次删除', 3061, 4, '', null, 1, 0, 'F', '0', '0', 'mall:traceability:del', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ==============================
-- 3. 商户管理菜单及权限
-- ==============================

-- 主菜单: 商户管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3070, '商户管理', 0, 60, 'merchant', null, 1, 0, 'M', '0', '0', '', 'peoples', 'admin', NOW(), '商户管理目录')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 商户列表
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3071, '商户列表', 3070, 1, 'index', 'mall/merchant/index', 1, 0, 'C', '0', '0', 'mall:merchant:index', 'list', 'admin', NOW(), '商户列表管理页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 商户审核
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3072, '商户审核', 3070, 2, 'review', 'mall/merchant/status-management', 1, 0, 'C', '0', '0', 'mall:merchant:review', 'checkbox', 'admin', NOW(), '商户审核页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子权限按钮
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3073, '商户查询', 3071, 1, '', null, 1, 0, 'F', '0', '0', 'mall:merchant:get', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3074, '商户编辑', 3071, 2, '', null, 1, 0, 'F', '0', '0', 'mall:merchant:edit', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3075, '商户审核', 3071, 3, '', null, 1, 0, 'F', '0', '0', 'mall:merchant:review', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3076, '商户删除', 3071, 4, '', null, 1, 0, 'F', '0', '0', 'mall:merchant:del', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ==============================
-- 4. 给管理员角色授权 (role_id = 1)
-- ==============================

-- 广告管理权限
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3050);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3051);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3052);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3053);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3054);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3055);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3056);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3057);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3058);

-- 溯源管理权限
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3060);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3061);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3062);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3063);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3064);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3065);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3066);

-- 商户管理权限
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3070);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3071);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3072);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3073);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3074);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3075);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3076);

-- ==============================
-- 权限标识汇总 (与后端 @ss.hasPermi 一一对应)
-- ==============================
-- 广告管理:
--   mall:advertisement:index - 列表查询
--   mall:advertisement:get   - 详情查询
--   mall:advertisement:add   - 新增
--   mall:advertisement:edit  - 编辑
--   mall:advertisement:del   - 删除
--
-- 溯源管理:
--   mall:traceability:index  - 列表查询
--   mall:traceability:get    - 详情查询
--   mall:traceability:add    - 新增
--   mall:traceability:edit   - 编辑
--   mall:traceability:del    - 删除
--
-- 商户管理:
--   mall:merchant:index      - 列表查询
--   mall:merchant:get        - 详情查询
--   mall:merchant:edit       - 编辑
--   mall:merchant:review     - 审核
--   mall:merchant:del        - 删除
