-- =====================================================
-- V5.0 添加菜单权限数据
-- 对齐 mall:xxx:yyy 权限标识风格
-- 与后端 @ss.hasPermi 注解100%匹配
-- =====================================================

-- 注意: 以下SQL需要根据实际项目的sys_menu表结构调整
-- 假设菜单表结构符合标准的RuoYi框架

-- ==============================
-- 1. AI知识库菜单及权限
-- ==============================

-- 主菜单: AI知识库 (假设商城管理的menu_id为某个值，这里使用变量方式)
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3001, 'AI知识库', 0, 80, 'ai-knowledge', null, 1, 0, 'M', '0', '0', '', 'documentation', 'admin', NOW(), 'AI知识库管理目录')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 知识库管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3010, '知识库管理', 3001, 1, 'index', 'mall/ai-knowledge/index', 1, 0, 'C', '0', '0', 'mall:ai:knowledge:get', 'list', 'admin', NOW(), '知识库管理页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子权限按钮
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3011, '知识库查询', 3010, 1, '', null, 1, 0, 'F', '0', '0', 'mall:ai:knowledge:get', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3012, '知识库新增', 3010, 2, '', null, 1, 0, 'F', '0', '0', 'mall:ai:knowledge:add', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3013, '知识库编辑', 3010, 3, '', null, 1, 0, 'F', '0', '0', 'mall:ai:knowledge:edit', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3014, '知识库删除', 3010, 4, '', null, 1, 0, 'F', '0', '0', 'mall:ai:knowledge:del', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ==============================
-- 2. 推荐管理菜单及权限
-- ==============================

-- 主菜单: 推荐管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3002, '推荐管理', 0, 85, 'referral', null, 1, 0, 'M', '0', '0', '', 'peoples', 'admin', NOW(), '推荐系统管理目录')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 推荐记录
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3020, '推荐记录', 3002, 1, 'index', 'mall/referral/index', 1, 0, 'C', '0', '0', 'mall:referral:get', 'list', 'admin', NOW(), '推荐记录管理页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 奖励配置
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3021, '奖励配置', 3002, 2, 'reward-config', 'mall/referral/reward-config', 1, 0, 'C', '0', '0', 'mall:referral:edit', 'edit', 'admin', NOW(), '推荐奖励配置页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子权限按钮
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3022, '推荐查询', 3020, 1, '', null, 1, 0, 'F', '0', '0', 'mall:referral:get', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3023, '推荐新增', 3020, 2, '', null, 1, 0, 'F', '0', '0', 'mall:referral:add', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3024, '推荐编辑', 3020, 3, '', null, 1, 0, 'F', '0', '0', 'mall:referral:edit', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ==============================
-- 3. 内容审核菜单及权限
-- ==============================

-- 主菜单: 内容审核
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3003, '内容审核', 0, 90, 'content-review', null, 1, 0, 'M', '0', '0', '', 'validCode', 'admin', NOW(), '内容审核管理目录')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 审核队列
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3030, '审核队列', 3003, 1, 'queue', 'mall/content-review/queue', 1, 0, 'C', '0', '0', 'mall:review:get', 'list', 'admin', NOW(), '内容审核队列页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子菜单: 审核策略
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3031, '审核策略', 3003, 2, 'strategy', 'mall/content-review/strategy', 1, 0, 'C', '0', '0', 'mall:review:edit', 'tool', 'admin', NOW(), '审核策略配置页面')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 子权限按钮
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3032, '审核查询', 3030, 1, '', null, 1, 0, 'F', '0', '0', 'mall:review:get', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3033, '审核提交', 3030, 2, '', null, 1, 0, 'F', '0', '0', 'mall:review:add', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3034, '审核编辑', 3030, 3, '', null, 1, 0, 'F', '0', '0', 'mall:review:edit', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3035, '执行审核', 3030, 4, '', null, 1, 0, 'F', '0', '0', 'mall:review:audit', '#', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ==============================
-- 4. 商户状态管理权限 (补充)
-- ==============================

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark)
VALUES (3040, '商户状态管理', 0, 75, 'merchant-status', 'mall/merchant/status-management', 1, 0, 'C', '1', '0', 'mall:merchant:status', 'peoples', 'admin', NOW(), '商户状态批量管理')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ==============================
-- 5. 给管理员角色授权 (role_id = 1)
-- ==============================

-- 授权所有新增的菜单给管理员角色
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3001);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3010);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3011);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3012);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3013);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3014);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3002);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3020);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3021);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3022);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3023);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3024);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3003);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3030);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3031);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3032);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3033);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3034);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3035);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 3040);

-- ==============================
-- 权限标识汇总 (与后端 @ss.hasPermi 一一对应)
-- ==============================
-- AI知识库:
--   mall:ai:knowledge:get   - 查询
--   mall:ai:knowledge:add   - 新增
--   mall:ai:knowledge:edit  - 编辑
--   mall:ai:knowledge:del   - 删除
--
-- 推荐系统:
--   mall:referral:get   - 查询
--   mall:referral:add   - 新增
--   mall:referral:edit  - 编辑
--
-- 内容审核:
--   mall:review:get    - 查询
--   mall:review:add    - 提交
--   mall:review:edit   - 编辑
--   mall:review:audit  - 审核操作
--
-- 商户管理:
--   mall:merchant:status - 商户状态管理
