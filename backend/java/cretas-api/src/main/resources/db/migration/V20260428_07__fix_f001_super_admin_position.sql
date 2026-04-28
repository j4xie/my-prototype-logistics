-- V20260428_07: 修正 F001 工厂超级管理员账号 position 配置错误
--
-- 背景: F001 工厂内有 3 个语义为"工厂最高权限"的账号, 但其中 2 个 position 配错:
--   - LSM0001 (张权)         position=factory_super_admin ✅ (正确)
--   - factory_admin1 (F001工厂主管)  position="主管"  ❌ (无效, fallback 到 unactivated → 全模块 deny)
--   - admin (工厂超管)         position=NULL    ❌ (无效, fallback 到 unactivated → 全模块 deny)
--
-- 用户报告 (微信反馈, 2026-04-28): 张权使用 admin/factory_admin1 登录时
--   "管理员权限账号里面仓储模块被移除了" — 实际是因 position 字段配错导致角色降级.
--
-- 修复: 将 F001 上语义明确为"工厂超管/工厂主管"的两个账号 position 矫正为 factory_super_admin,
-- 让"最高权限账户拥有所有职能权限" (用户原话).
--
-- 影响范围: 仅 F001 上 2 行 update, 跨工厂查询确认其他工厂无类似情况.
-- 安全性: 仅修正基于 full_name 语义已经明确的"工厂级管理员"账号, 不动职能管理员
-- (hr_admin / production_mgr / 等保持原 position 不变, 各司其职).

UPDATE users
SET position = 'factory_super_admin',
    updated_at = NOW()
WHERE factory_id = 'F001'
  AND is_active = true
  AND username IN ('factory_admin1', 'admin')
  AND full_name IN ('F001工厂主管', '工厂超管')
  AND (position IS NULL OR position NOT IN (
      'factory_super_admin', 'platform_admin', 'department_admin', 'hr_admin',
      'production_manager', 'warehouse_manager', 'equipment_admin', 'finance_manager',
      'quality_manager', 'workshop_supervisor', 'quality_inspector', 'operator',
      'warehouse_worker', 'viewer', 'dispatcher', 'group_leader', 'team_leader',
      'permission_admin', 'restaurant_manager', 'sales_manager', 'procurement_manager'
  ));
