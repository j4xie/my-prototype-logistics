/**
 * 权限组件导出索引
 */

export {
  PermissionGuard,
  PlatformGuard,
  FactoryGuard,
  RoleGuard,
  DepartmentGuard,
  CompositeGuard,
  AccessDenied
} from './PermissionGuard';

// 导出 PermissionProvider 相关
export { default as PermissionProvider, usePermissionContext, PermissionCheck } from './PermissionProvider';

// 导出 RouteGuard
export { default as RouteGuard } from './RouteGuard';

// 导出 PermissionAwareNavigation 相关
export { default as PermissionAwareNavigation, PermissionBadge } from './PermissionAwareNavigation';

// 默认导出主组件
export { default } from './PermissionGuard';
