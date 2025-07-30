/**
 * 权限管理 Hook
 * 统一的权限检查和管理逻辑
 * 使用新的权限结构，与 authStore 保持一致
 */

import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { 
  PermissionChecker, 
  ModuleAccessState,
  MODULE_PERMISSIONS,
  FEATURE_PERMISSIONS,
  USER_ROLES,
  DEPARTMENTS,
  type UserPermissions,
  type ModulePermission,
  type UserRole,
  type Department
} from '@/types/permissions';
import type { User } from '@/types/state';

// 角色信息接口
interface RoleInfo {
  name: string;
  isDeveloper: boolean;
  isPlatformAdmin: boolean;
  isSuperAdmin: boolean;
  isPermissionAdmin: boolean;
  isDepartmentAdmin: boolean;
  level: number;
}

// Hook 返回值接口
interface PermissionResult {
  // 权限检查方法
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasModuleAccess: (module: string) => boolean;
  hasFeaturePermission: (feature: string) => boolean;
  
  // 业务权限检查
  canAccessDepartment: (department: string) => boolean;
  canManageUser: (targetUser: User) => boolean;
  hasRoleLevel: (requiredLevel: number) => boolean;
  
  // 用户信息获取
  getUserPermissions: () => UserPermissions | null;
  getUserRole: () => UserRole | null;
  getUserType: () => 'platform_admin' | 'factory_user' | null;
  getModuleAccessState: () => ModuleAccessState;
  
  // 兼容性方法（向后兼容）
  isAuthenticated: boolean;
  roleLevel: number;
  canAccessFarming: boolean;
  canAccessProcessing: boolean;
  canAccessLogistics: boolean;
  canAccessTrace: boolean;
  canAccessAdmin: boolean;
  canAccessPlatform: boolean;
  
  // 状态信息
  roleInfo: RoleInfo | null;
  isLoading: boolean;
}

/**
 * 判断用户类型
 */
const getUserType = (user: User | null): 'platform_admin' | 'factory_user' | null => {
  if (!user?.permissions) return null;
  
  // 检查是否为平台管理员
  if (user.permissions.role === 'PLATFORM_ADMIN') {
    return 'platform_admin';
  }
  
  // 其他都是工厂用户
  return 'factory_user';
};

/**
 * 获取用户角色
 */
const getUserRole = (user: User | null): UserRole | null => {
  if (!user?.permissions) return null;
  return user.permissions.role;
};

/**
 * 检查用户是否可以管理目标用户
 */
const canManageUser = (user: User | null, targetUser: User): boolean => {
  if (!user?.permissions || !targetUser?.permissions) return false;

  const userRole = user.permissions.role;
  const userLevel = user.permissions.roleLevel;
  const targetLevel = targetUser.permissions.roleLevel;

  // 开发者拥有最高权限，可以管理所有用户
  if (userRole === 'DEVELOPER') {
    return true;
  }

  // 平台管理员可以管理所有用户（除了开发者）
  if (userRole === 'PLATFORM_ADMIN') {
    return targetUser.permissions.role !== 'DEVELOPER';
  }

  // 工厂超级管理员可以管理工厂内所有用户（除了平台管理员和开发者）
  if (userRole === 'SUPER_ADMIN') {
    return targetUser.permissions.role !== 'PLATFORM_ADMIN' && 
           targetUser.permissions.role !== 'DEVELOPER';
  }

  // 权限管理员可以管理非超级管理员用户（除了开发者）
  if (userRole === 'PERMISSION_ADMIN') {
    return !['PLATFORM_ADMIN', 'SUPER_ADMIN', 'DEVELOPER'].includes(targetUser.permissions.role);
  }

  // 部门管理员可以管理本部门的普通用户
  if (userRole === 'DEPARTMENT_ADMIN') {
    return (
      targetUser.permissions.role === 'USER' &&
      user.permissions.department === targetUser.permissions.department
    );
  }

  // 普通用户不能管理其他用户
  return false;
};

/**
 * 检查部门访问权限
 */
const canAccessDepartment = (user: User | null, department: string): boolean => {
  if (!user?.permissions) return false;

  const userRole = user.permissions.role;
  const userDepartment = user.permissions.department;

  // 开发者、平台管理员和工厂超级管理员可以访问所有部门
  if (['DEVELOPER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
    return true;
  }

  // 权限管理员可以访问所有部门（用于用户管理）
  if (userRole === 'PERMISSION_ADMIN') {
    return true;
  }

  // 部门管理员和普通用户只能访问自己的部门
  if (userDepartment) {
    return userDepartment.toLowerCase() === department.toLowerCase();
  }

  // 如果没有部门信息，默认允许访问（向后兼容）
  return true;
};

/**
 * 检查用户是否为开发者
 */
const isDeveloper = (user: User | null): boolean => {
  return user?.permissions?.role === 'DEVELOPER';
};

/**
 * 权限管理 Hook
 */
export function usePermissions(): PermissionResult {
  const { user, loading } = useAuthStore();

  // 缓存用户权限对象
  const userPermissions = useMemo(() => {
    return user?.permissions || null;
  }, [user?.permissions]);

  // 基础权限检查方法
  const hasPermission = useCallback((permission: string): boolean => {
    if (!userPermissions) return false;

    // 开发者绕过所有权限检查
    if (isDeveloper(user)) return true;

    // 检查模块权限
    const moduleKey = permission as keyof typeof MODULE_PERMISSIONS;
    if (MODULE_PERMISSIONS[moduleKey]) {
      return PermissionChecker.hasModuleAccess(userPermissions, moduleKey);
    }

    // 检查功能权限
    return PermissionChecker.hasFeaturePermission(userPermissions, permission);
  }, [userPermissions, user]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  }, [hasPermission]);

  const hasModuleAccess = useCallback((module: string): boolean => {
    if (!userPermissions) return false;
    
    // 开发者绕过所有权限检查
    if (isDeveloper(user)) return true;
    
    const moduleKey = module.toUpperCase() + '_ACCESS' as keyof typeof MODULE_PERMISSIONS;
    if (MODULE_PERMISSIONS[moduleKey]) {
      return PermissionChecker.hasModuleAccess(userPermissions, moduleKey);
    }
    
    return false;
  }, [userPermissions, user]);

  const hasFeaturePermission = useCallback((feature: string): boolean => {
    if (!userPermissions) return false;
    
    // 开发者绕过所有权限检查
    if (isDeveloper(user)) return true;
    
    return PermissionChecker.hasFeaturePermission(userPermissions, feature);
  }, [userPermissions, user]);

  const hasRoleLevel = useCallback((requiredLevel: number): boolean => {
    if (!userPermissions) return false;
    
    // 开发者拥有最高权限级别（-1），总是满足要求
    if (isDeveloper(user)) return true;
    
    return PermissionChecker.hasRoleLevel(userPermissions, requiredLevel);
  }, [userPermissions, user]);

  // 业务权限检查方法
  const canAccessDepartmentCallback = useCallback((department: string): boolean => {
    return canAccessDepartment(user, department);
  }, [user]);

  const canManageUserCallback = useCallback((targetUser: User): boolean => {
    return canManageUser(user, targetUser);
  }, [user]);

  // 信息获取方法
  const getUserPermissionsCallback = useCallback((): UserPermissions | null => {
    return userPermissions;
  }, [userPermissions]);

  const getUserRoleCallback = useCallback((): UserRole | null => {
    return getUserRole(user);
  }, [user]);

  const getUserTypeCallback = useCallback((): 'platform_admin' | 'factory_user' | null => {
    return getUserType(user);
  }, [user]);

  const getModuleAccessState = useCallback((): ModuleAccessState => {
    if (!userPermissions) {
      return {
        farming: false,
        processing: false,
        logistics: false,
        admin: false,
        platform: false
      };
    }
    
    return PermissionChecker.getModuleAccessState(userPermissions);
  }, [userPermissions]);

  // 计算角色信息
  const roleInfo = useMemo((): RoleInfo | null => {
    if (!user?.permissions) return null;

    const role = user.permissions.role;
    const level = user.permissions.roleLevel;

    // 角色显示名称映射
    const roleDisplayNames: Record<UserRole, string> = {
      'DEVELOPER': '系统开发者',
      'PLATFORM_ADMIN': '平台管理员',
      'SUPER_ADMIN': '工厂超级管理员', 
      'PERMISSION_ADMIN': '权限管理员',
      'DEPARTMENT_ADMIN': '部门管理员',
      'USER': '普通员工'
    };

    return {
      name: roleDisplayNames[role] || '未知角色',
      isDeveloper: role === 'DEVELOPER',
      isPlatformAdmin: role === 'PLATFORM_ADMIN',
      isSuperAdmin: role === 'SUPER_ADMIN',
      isPermissionAdmin: role === 'PERMISSION_ADMIN',
      isDepartmentAdmin: role === 'DEPARTMENT_ADMIN',
      level
    };
  }, [user?.permissions]);

  // 兼容性属性计算
  const moduleAccess = useMemo(() => {
    if (!userPermissions) {
      return {
        canAccessFarming: false,
        canAccessProcessing: false,
        canAccessLogistics: false,
        canAccessTrace: false,
        canAccessAdmin: false,
        canAccessPlatform: false
      };
    }
    
    const moduleState = PermissionChecker.getModuleAccessState(userPermissions);
    return {
      canAccessFarming: moduleState.farming,
      canAccessProcessing: moduleState.processing,
      canAccessLogistics: moduleState.logistics,
      canAccessTrace: moduleState.trace,
      canAccessAdmin: moduleState.admin,
      canAccessPlatform: moduleState.platform
    };
  }, [userPermissions]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    hasFeaturePermission,
    hasRoleLevel,
    canAccessDepartment: canAccessDepartmentCallback,
    canManageUser: canManageUserCallback,
    getUserPermissions: getUserPermissionsCallback,
    getUserRole: getUserRoleCallback,
    getUserType: getUserTypeCallback,
    getModuleAccessState,
    
    // 兼容性属性
    isAuthenticated: !!user,
    roleLevel: userPermissions?.roleLevel || 999,
    ...moduleAccess,
    
    roleInfo,
    isLoading: loading
  };
}

/**
 * 权限检查的快捷方法
 */
export function usePermissionCheck(permission: string) {
  const { hasPermission, isLoading } = usePermissions();
  return { hasPermission: hasPermission(permission), isLoading };
}

/**
 * 多权限检查的快捷方法
 */
export function useMultiPermissionCheck(permissions: string[], requireAll = false) {
  const { hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();
  
  const hasPermission = requireAll 
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);
    
  return { hasPermission, isLoading };
}

/**
 * 部门访问检查的快捷方法
 */
export function useDepartmentAccess(department: string) {
  const { canAccessDepartment, isLoading } = usePermissions();
  return { canAccess: canAccessDepartment(department), isLoading };
}

/**
 * 模块访问检查的快捷方法
 */
export function useModuleAccess(module: string) {
  const { hasModuleAccess, isLoading } = usePermissions();
  return { hasAccess: hasModuleAccess(module), isLoading };
}

/**
 * 功能权限检查的快捷方法
 */
export function useFeaturePermission(feature: string) {
  const { hasFeaturePermission, isLoading } = usePermissions();
  return { hasPermission: hasFeaturePermission(feature), isLoading };
}

/**
 * 模块状态管理 Hook
 */
export function useModuleStates() {
  const { getModuleAccessState, getUserRole, getUserType } = usePermissions();
  
  const moduleStates = useMemo(() => {
    const accessState = getModuleAccessState();
    const userType = getUserType();
    const userRole = getUserRole();
    
    // 生成模块状态信息
    const getModuleState = (module: keyof ModuleAccessState) => {
      const accessible = accessState[module];
      
      // 模块配置
      const moduleConfig = {
        farming: {
          name: '农业生产管理',
          color: 'text-green-600',
          needPermission: '需要养殖部门权限'
        },
        processing: {
          name: '加工生产管理', 
          color: 'text-blue-600',
          needPermission: '需要生产部门权限'
        },
        logistics: {
          name: '物流配送管理',
          color: 'text-orange-600', 
          needPermission: '需要物流部门权限'
        },
        trace: {
          name: '产品溯源查询',
          color: 'text-purple-600',
          needPermission: '所有用户都可访问'
        },
        admin: {
          name: '系统管理',
          color: 'text-red-600',
          needPermission: '需要管理员权限'
        },
        platform: {
          name: '平台管理',
          color: 'text-indigo-600',
          needPermission: '仅限平台管理员'
        }
      };
      
      const config = moduleConfig[module];
      
      return {
        accessible,
        tooltip: accessible ? config.name : config.needPermission,
        className: accessible ? config.color : 'text-gray-400'
      };
    };
    
    return {
      farming: getModuleState('farming'),
      processing: getModuleState('processing'),
      logistics: getModuleState('logistics'),
      trace: getModuleState('trace'),
      admin: getModuleState('admin'),
      platform: getModuleState('platform'),
      profile: {
        accessible: true,
        tooltip: '个人资料管理',
        className: 'text-teal-600'
      }
    };
  }, [getModuleAccessState, getUserRole, getUserType]);
  
  return moduleStates;
}

export default usePermissions;