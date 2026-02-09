/**
 * Dashboard 组件导出
 * 根据用户角色加载不同的 Dashboard 组件
 */

export { default as DashboardAdmin } from './DashboardAdmin.vue';
export { default as DashboardHR } from './DashboardHR.vue';
export { default as DashboardProduction } from './DashboardProduction.vue';
export { default as DashboardWarehouse } from './DashboardWarehouse.vue';
export { default as DashboardFinance } from './DashboardFinance.vue';
export { default as DashboardDefault } from './DashboardDefault.vue';

/**
 * 角色到 Dashboard 组件的映射
 * 参考原型文档: docs/prd/prototype/index.html - 14角色权限矩阵
 */
export const ROLE_DASHBOARD_MAP: Record<string, string> = {
  // Level 0 - 平台管理员
  super_admin: 'DashboardAdmin',

  // Level 10 - 工厂高级管理
  factory_super_admin: 'DashboardAdmin',

  // Level 20 - 调度员
  dispatcher: 'DashboardProduction',

  // Level 20 - 部门经理
  production_manager: 'DashboardProduction',
  quality_manager: 'DashboardDefault',          // 质量经理使用通用版
  warehouse_manager: 'DashboardWarehouse',
  procurement_manager: 'DashboardDefault',      // 采购经理使用通用版
  sales_manager: 'DashboardDefault',            // 销售经理使用通用版
  hr_admin: 'DashboardHR',
  equipment_admin: 'DashboardDefault',          // 设备经理使用通用版
  finance_manager: 'DashboardFinance',

  // Level 20 - 车间主管
  workshop_supervisor: 'DashboardProduction',

  // Level 30 - 一线员工 (Mobile专属，不应该登录Web)
  // operator: 'BLOCKED',
  // quality_inspector: 'BLOCKED',
  // warehouse_worker: 'BLOCKED',

  // Level 50 - 只读用户
  viewer: 'DashboardDefault',

  // 默认
  default: 'DashboardDefault'
};

/**
 * 根据角色获取对应的 Dashboard 组件名称
 */
export function getDashboardComponent(role: string): string {
  return ROLE_DASHBOARD_MAP[role] || ROLE_DASHBOARD_MAP['default'];
}
