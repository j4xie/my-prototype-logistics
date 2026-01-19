/**
 * 权限检查工具函数
 * 与后端 PermissionServiceImpl 和移动端 permissionHelper.ts 保持同步
 */
import { User, ROLE_METADATA, isPlatformUser, isFactoryUser } from '@/types/auth';

/**
 * 权限矩阵 - 与后端完全一致
 * 格式: role -> module -> permission_type (none/read/write/read_write)
 */
const PERMISSION_MATRIX: Record<string, Record<string, string>> = {
  factory_super_admin: {
    dashboard: 'read_write', production: 'read_write', warehouse: 'read_write',
    quality: 'read_write', procurement: 'read_write', sales: 'read_write',
    hr: 'read_write', equipment: 'read_write', finance: 'read_write', system: 'read_write',
    analytics: 'read_write'  // SmartBI 完整权限
  },
  production_manager: {
    dashboard: 'read_write', production: 'read_write', warehouse: 'read',
    quality: 'read', procurement: 'read', hr: 'read', equipment: 'read', system: 'read',
    analytics: 'read_write'  // SmartBI 完整权限 (已重命名为 dispatcher)
  },
  dispatcher: {
    dashboard: 'read_write', production: 'read_write', warehouse: 'read',
    quality: 'read', procurement: 'read', sales: 'read', hr: 'read', equipment: 'read',
    finance: 'read', system: 'read', analytics: 'read_write', scheduling: 'read_write'
  },
  quality_manager: { dashboard: 'read', production: 'read', quality: 'read_write' },
  workshop_supervisor: {
    dashboard: 'read', production: 'read_write', warehouse: 'read',
    quality: 'write', hr: 'read', equipment: 'read'
  },
  quality_inspector: { dashboard: 'read', production: 'read', quality: 'write' },
  operator: { dashboard: 'read', production: 'write' },
  warehouse_manager: { dashboard: 'read_write', warehouse: 'read_write', production: 'read' },
  warehouse_worker: { dashboard: 'read', warehouse: 'write' },
  hr_admin: { dashboard: 'read', hr: 'read_write' },
  equipment_admin: { dashboard: 'read', equipment: 'read_write' },
  procurement_manager: { dashboard: 'read', procurement: 'read_write', warehouse: 'read' },
  sales_manager: {
    dashboard: 'read', sales: 'read_write', warehouse: 'read',
    analytics: 'read'  // SmartBI 只读访问
  },
  finance_manager: {
    dashboard: 'read', finance: 'read_write',
    production: 'read', procurement: 'read', sales: 'read',
    analytics: 'read'  // SmartBI 只读访问
  },
  viewer: {
    dashboard: 'read', production: 'read', warehouse: 'read', quality: 'read',
    procurement: 'read', sales: 'read', hr: 'read', equipment: 'read',
    analytics: 'read'  // SmartBI 只读访问
  },
  // 向后兼容
  permission_admin: {
    dashboard: 'read_write', production: 'read_write', warehouse: 'read_write',
    quality: 'read_write', procurement: 'read_write', sales: 'read_write',
    hr: 'read_write', equipment: 'read_write', finance: 'read_write', system: 'read_write',
    analytics: 'read_write'
  },
  department_admin: {
    dashboard: 'read_write', production: 'read_write', warehouse: 'read',
    quality: 'read', procurement: 'read', hr: 'read', equipment: 'read', system: 'read',
    analytics: 'read_write'
  }
};

/**
 * 获取用户角色代码
 */
export function getRoleCode(user: User | null | undefined): string {
  if (!user) return 'viewer';

  if (isPlatformUser(user)) {
    return user.platformUser?.role || 'platform_admin';
  }

  if (isFactoryUser(user)) {
    return user.factoryUser?.role || 'viewer';
  }

  return 'viewer';
}

/**
 * 获取角色等级
 */
export function getRoleLevel(roleCode: string): number {
  return ROLE_METADATA[roleCode]?.level ?? 99;
}

/**
 * 获取用户等级
 */
export function getUserLevel(user: User | null | undefined): number {
  if (!user) return 99;
  const roleCode = getRoleCode(user);
  return getRoleLevel(roleCode);
}

/**
 * 检查用户是否为平台管理员
 */
export function isPlatformAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.userType === 'platform';
}

/**
 * 检查用户是否为工厂超级管理员
 */
export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user || user.userType !== 'factory') return false;
  const roleCode = getRoleCode(user);
  return roleCode === 'factory_super_admin';
}

/**
 * 检查用户是否为管理层 (Level <= 10)
 */
export function isManager(user: User | null | undefined): boolean {
  if (!user) return false;
  const level = getUserLevel(user);
  return level <= 10;
}

/**
 * 检查用户是否有指定模块的权限
 * @param user 用户对象
 * @param module 模块名称 (dashboard, production, warehouse, quality, etc.)
 * @param action 动作类型 (read, write)
 */
export function hasModulePermission(
  user: User | null | undefined,
  module: string,
  action: 'read' | 'write' = 'read'
): boolean {
  if (!user) return false;

  // 平台管理员拥有所有权限
  if (isPlatformAdmin(user)) return true;

  const roleCode = getRoleCode(user);
  const rolePerms = PERMISSION_MATRIX[roleCode];

  if (!rolePerms) return false;

  const permType = rolePerms[module];
  if (!permType || permType === 'none') return false;

  if (action === 'read') {
    return permType.includes('read');
  }
  if (action === 'write') {
    return permType.includes('write');
  }

  return false;
}

/**
 * 检查用户是否可以访问指定模块
 */
export function canAccessModule(user: User | null | undefined, module: string): boolean {
  return hasModulePermission(user, module, 'read') || hasModulePermission(user, module, 'write');
}

/**
 * 获取用户可访问的模块列表
 */
export function getAccessibleModules(user: User | null | undefined): string[] {
  if (!user) return [];

  if (isPlatformAdmin(user)) {
    return ['dashboard', 'production', 'warehouse', 'quality', 'procurement',
            'sales', 'hr', 'equipment', 'finance', 'system', 'analytics'];
  }

  const roleCode = getRoleCode(user);
  const rolePerms = PERMISSION_MATRIX[roleCode];

  if (!rolePerms) return [];

  return Object.entries(rolePerms)
    .filter(([, permType]) => permType && permType !== 'none')
    .map(([module]) => module);
}

/**
 * 检查用户是否可以管理基础数据
 */
export function canManageBasicData(user: User | null | undefined): boolean {
  if (!user) return false;
  return isPlatformAdmin(user) || isSuperAdmin(user) || isManager(user);
}

/**
 * 检查用户是否可以管理用户
 */
export function canManageUsers(user: User | null | undefined): boolean {
  if (!user) return false;
  const roleCode = getRoleCode(user);
  return isPlatformAdmin(user) || isSuperAdmin(user) || roleCode === 'hr_admin';
}

/**
 * 检查用户是否可以管理部门
 */
export function canManageDepartments(user: User | null | undefined): boolean {
  if (!user) return false;
  return isPlatformAdmin(user) || isSuperAdmin(user);
}

/**
 * 检查用户是否可以查看报表
 */
export function canViewReports(user: User | null | undefined): boolean {
  if (!user) return false;
  return isPlatformAdmin(user) || isSuperAdmin(user) || isManager(user);
}

/**
 * 获取用户角色的中文名称
 */
export function getRoleName(user: User | null | undefined): string {
  if (!user) return '访客';

  if (user.userType === 'platform') {
    return '平台管理员';
  }

  const roleCode = getRoleCode(user);
  const metadata = ROLE_METADATA[roleCode];

  return metadata?.displayName || '未知角色';
}

/**
 * 获取工厂ID
 */
export function getFactoryId(user: User | null | undefined): string | undefined {
  if (!user || user.userType !== 'factory') return undefined;
  return user.factoryUser?.factoryId;
}

/**
 * 检查用户是否可以访问 SmartBI 模块
 * SmartBI 访问权限: 有 analytics/sales/finance 任一读权限即可
 */
export function canAccessSmartBI(user: User | null | undefined): boolean {
  if (!user) return false;

  // 平台管理员拥有所有权限
  if (isPlatformAdmin(user)) return true;

  // 检查 analytics、sales、finance 任一模块的读权限
  return hasModulePermission(user, 'analytics', 'read') ||
         hasModulePermission(user, 'sales', 'read') ||
         hasModulePermission(user, 'finance', 'read');
}

/**
 * 检查用户是否有 SmartBI 写权限 (上传数据等)
 */
export function canWriteSmartBI(user: User | null | undefined): boolean {
  if (!user) return false;

  // 平台管理员拥有所有权限
  if (isPlatformAdmin(user)) return true;

  // 只有 analytics 模块的写权限才能上传数据
  return hasModulePermission(user, 'analytics', 'write');
}
