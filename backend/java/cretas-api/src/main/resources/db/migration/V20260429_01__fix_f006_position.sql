-- V20260429_01: 修正 F006 (六膳门食品科技) 16 个用户的 position 字段配置错误
--
-- 背景: 张权 (微信反馈 2026-04-29) 报告"基础数据已新建但采购订单下拉看不到选项".
-- 调查发现 F006 的 16 个用户 position 字段全部为 NULL/空, 导致权限 fallback
-- 到 unactivated 角色 → 全模块 deny → 所有 dropdown API 返回 403/空.
--
-- 修复: 按 username 命名约定推断角色, 矫正 position 字段.
-- 命名约定 f006_<role-suffix> 已经在 username 里编码了角色信息, 这里只是把它
-- 复刻到 position 字段以激活权限.
--
-- 影响: 仅 F006 工厂的 16 行 update. F001 / F002 / 其他 FOOD_* 工厂也有类似
-- 问题但用户优先级是 F006 (张权当前使用), 其他工厂留 backlog.
--
-- 安全性: 所有 username 都以 f006_ 前缀标识本工厂, role 后缀语义明确无歧义.
-- 即使再次执行也幂等 (条件 position IS NULL OR position='').

UPDATE users SET position='factory_super_admin', updated_at=NOW() WHERE factory_id='F006' AND username='f006_admin' AND (position IS NULL OR position='');
UPDATE users SET position='workshop_supervisor', updated_at=NOW() WHERE factory_id='F006' AND username='f006_workshop' AND (position IS NULL OR position='');
UPDATE users SET position='operator', updated_at=NOW() WHERE factory_id='F006' AND username='f006_worker1' AND (position IS NULL OR position='');
UPDATE users SET position='finance_manager', updated_at=NOW() WHERE factory_id='F006' AND username='f006_finance_mgr' AND (position IS NULL OR position='');
UPDATE users SET position='production_manager', updated_at=NOW() WHERE factory_id='F006' AND username='f006_production_mgr' AND (position IS NULL OR position='');
UPDATE users SET position='procurement_manager', updated_at=NOW() WHERE factory_id='F006' AND username='f006_procurement_mgr' AND (position IS NULL OR position='');
UPDATE users SET position='warehouse_manager', updated_at=NOW() WHERE factory_id='F006' AND username='f006_warehouse_mgr' AND (position IS NULL OR position='');
UPDATE users SET position='warehouse_worker', updated_at=NOW() WHERE factory_id='F006' AND username='f006_warehouse_worker' AND (position IS NULL OR position='');
UPDATE users SET position='sales_manager', updated_at=NOW() WHERE factory_id='F006' AND username='f006_sales_mgr' AND (position IS NULL OR position='');
UPDATE users SET position='quality_manager', updated_at=NOW() WHERE factory_id='F006' AND username='f006_quality_mgr' AND (position IS NULL OR position='');
UPDATE users SET position='quality_inspector', updated_at=NOW() WHERE factory_id='F006' AND username='f006_quality_insp' AND (position IS NULL OR position='');
UPDATE users SET position='equipment_admin', updated_at=NOW() WHERE factory_id='F006' AND username='f006_equipment_admin' AND (position IS NULL OR position='');
UPDATE users SET position='hr_admin', updated_at=NOW() WHERE factory_id='F006' AND username='f006_hr_admin' AND (position IS NULL OR position='');
UPDATE users SET position='viewer', updated_at=NOW() WHERE factory_id='F006' AND username='f006_viewer' AND (position IS NULL OR position='');
UPDATE users SET position='dispatcher', updated_at=NOW() WHERE factory_id='F006' AND username='f006_dispatcher' AND (position IS NULL OR position='');
UPDATE users SET position='department_admin', updated_at=NOW() WHERE factory_id='F006' AND username='f006_dept_admin' AND (position IS NULL OR position='');
