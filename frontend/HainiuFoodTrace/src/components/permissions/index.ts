/**
 * 权限系统组件导出模块
 * 统一导出所有权限相关的UI组件
 */

// 角色选择器
export { default as RoleSelector, USER_ROLE_CONFIG } from './RoleSelector';
export type { EnhancedUserRole } from './RoleSelector';

// 权限设置面板
export { default as PermissionSettingsPanel, PERMISSION_GROUPS } from './PermissionSettingsPanel';
export type { Permission, PermissionGroup } from './PermissionSettingsPanel';

// 部门权限管理器
export { 
  default as DepartmentPermissionManager, 
  DEPARTMENTS, 
  INHERITANCE_RULES 
} from './DepartmentPermissionManager';
export type { 
  Department, 
  DepartmentPermission, 
  PermissionInheritanceRule 
} from './DepartmentPermissionManager';

// 用户权限显示
export { default as UserPermissionDisplay } from './UserPermissionDisplay';
export type { 
  UserPermissionData, 
  PermissionAnalytics 
} from './UserPermissionDisplay';

// 重新导出 EnhancedPermissionGuard（来自auth模块）
export { default as EnhancedPermissionGuard } from '../auth/EnhancedPermissionGuard';