import { User, FACTORY_ROLES, PLATFORM_ROLES, FactoryRole } from '../types/auth';

/**
 * 权限检查工具函数
 * 用于统一管理屏幕的权限验证逻辑
 */

/**
 * 获取用户的标准化角色代码
 * 处理position字段的映射（如 proc_admin → department_admin）
 */
export function getRoleCode(user: User | null | undefined): string {
  if (!user) return 'viewer';

  // 平台管理员
  if (user.userType === 'platform') {
    return user.platformUser?.role || PLATFORM_ROLES.PLATFORM_ADMIN;
  }

  // 工厂用户
  const rawRole = user.factoryUser?.role;
  const position = user.factoryUser?.position;

  // 角色映射：将position值（如proc_admin）映射到实际角色代码
  // 注意：'proc_admin'只会出现在position字段中，不会出现在role字段中
  if (rawRole === 'department_admin' || position === 'proc_admin') {
    return FACTORY_ROLES.DEPARTMENT_ADMIN;
  }

  return rawRole || FACTORY_ROLES.VIEWER;
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
  return roleCode === FACTORY_ROLES.FACTORY_SUPER_ADMIN;
}

/**
 * 检查用户是否为权限管理员
 */
export function isPermissionAdmin(user: User | null | undefined): boolean {
  if (!user || user.userType !== 'factory') return false;
  const roleCode = getRoleCode(user);
  return roleCode === FACTORY_ROLES.PERMISSION_ADMIN;
}

/**
 * 检查用户是否为部门管理员
 */
export function isDepartmentAdmin(user: User | null | undefined): boolean {
  if (!user || user.userType !== 'factory') return false;
  const roleCode = getRoleCode(user);
  return roleCode === FACTORY_ROLES.DEPARTMENT_ADMIN;
}

/**
 * 检查用户是否可以管理基础数据（产品类型、工作类型、原材料类型等）
 * 权限：平台管理员、工厂超管、权限管理员、部门管理员
 */
export function canManageBasicData(user: User | null | undefined): boolean {
  if (!user) return false;

  return (
    isPlatformAdmin(user) ||
    isSuperAdmin(user) ||
    isPermissionAdmin(user) ||
    isDepartmentAdmin(user)
  );
}

/**
 * 检查用户是否可以管理用户
 * 权限：平台管理员、工厂超管
 */
export function canManageUsers(user: User | null | undefined): boolean {
  if (!user) return false;

  return isPlatformAdmin(user) || isSuperAdmin(user);
}

/**
 * 检查用户是否可以管理部门
 * 权限：平台管理员、工厂超管、权限管理员
 */
export function canManageDepartments(user: User | null | undefined): boolean {
  if (!user) return false;

  return isPlatformAdmin(user) || isSuperAdmin(user) || isPermissionAdmin(user);
}

/**
 * 检查用户是否可以管理权限
 * 权限：平台管理员、工厂超管
 */
export function canManagePermissions(user: User | null | undefined): boolean {
  if (!user) return false;

  return isPlatformAdmin(user) || isSuperAdmin(user);
}

/**
 * 检查用户是否可以查看报表
 * 权限：平台管理员、工厂超管、权限管理员、部门管理员
 */
export function canViewReports(user: User | null | undefined): boolean {
  if (!user) return false;

  return (
    isPlatformAdmin(user) ||
    isSuperAdmin(user) ||
    isPermissionAdmin(user) ||
    isDepartmentAdmin(user)
  );
}

/**
 * 获取工厂ID（如果是工厂用户）
 */
export function getFactoryId(user: User | null | undefined): string | undefined {
  if (!user || user.userType !== 'factory') return undefined;
  return user.factoryUser?.factoryId;
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

  switch (roleCode) {
    case FACTORY_ROLES.FACTORY_SUPER_ADMIN:
      return '工厂超级管理员';
    case FACTORY_ROLES.PERMISSION_ADMIN:
      return '权限管理员';
    case FACTORY_ROLES.DEPARTMENT_ADMIN:
      return '部门管理员';
    case FACTORY_ROLES.OPERATOR:
      return '操作员';
    case FACTORY_ROLES.VIEWER:
      return '查看者';
    case FACTORY_ROLES.UNACTIVATED:
      return '未激活用户';
    default:
      return '未知角色';
  }
}

/**
 * 权限日志记录辅助函数
 * 用于调试权限问题
 */
export function getPermissionDebugInfo(user: User | null | undefined) {
  if (!user) {
    return {
      userType: 'none',
      roleCode: 'viewer',
      permissions: {
        canManageBasicData: false,
        canManageUsers: false,
        canManageDepartments: false,
        canManagePermissions: false,
        canViewReports: false,
      },
    };
  }

  return {
    userType: user.userType,
    roleCode: getRoleCode(user),
    roleName: getRoleName(user),
    factoryId: getFactoryId(user),
    rawRole: user.userType === 'factory' ? user.factoryUser?.role : user.platformUser?.role,
    position: user.userType === 'factory' ? user.factoryUser?.position : undefined,
    permissions: {
      canManageBasicData: canManageBasicData(user),
      canManageUsers: canManageUsers(user),
      canManageDepartments: canManageDepartments(user),
      canManagePermissions: canManagePermissions(user),
      canViewReports: canViewReports(user),
    },
  };
}
