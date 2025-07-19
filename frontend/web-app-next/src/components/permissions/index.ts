/**
 * 权限控制组件集合
 * 提供统一的权限检查和路由保护功能
 */

export { default as RouteGuard } from './RouteGuard';
export { default as PermissionProvider } from './PermissionProvider';
export { default as PermissionAwareNavigation } from './PermissionAwareNavigation';

export {
  usePermissionContext,
  withPermission,
  PermissionCheck
} from './PermissionProvider';

export {
  PermissionBadge
} from './PermissionAwareNavigation';

// 权限相关类型
export type {
  RouteGuardProps,
  PermissionCheckProps,
  PermissionContextType
} from './PermissionProvider';

// 权限配置常量
export const PERMISSION_LEVELS = {
  PLATFORM_ADMIN: 0,
  SUPER_ADMIN: 5,
  PERMISSION_ADMIN: 10,
  DEPARTMENT_ADMIN: 20,
  REGULAR_USER: 50
} as const;

export const MODULE_NAMES = {
  farming: '农业管理',
  processing: '生产加工',
  logistics: '物流配送',
  admin: '系统管理',
  platform: '平台管理'
} as const;

export const ROUTE_PERMISSIONS = {
  '/farming': { module: 'farming', level: 50 },
  '/processing': { module: 'processing', level: 50 },
  '/logistics': { module: 'logistics', level: 50 },
  '/admin': { module: 'admin', level: 10 },
  '/platform': { module: 'platform', level: 0 }
} as const;