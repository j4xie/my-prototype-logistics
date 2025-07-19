/**
 * 权限管理 Hook
 * 提供模块级权限验证和用户界面控制
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  UserPermissions,
  ModuleAccessState,
  ModulePermission,
  PermissionChecker,
  MODULE_PERMISSIONS,
  FEATURE_PERMISSIONS,
  USER_ROLES
} from '@/types/permissions';

/**
 * 模块访问权限 Hook
 */
export function useModuleAccess() {
  const { user, isAuthenticated } = useAuthStore();

  const moduleAccess = useMemo<ModuleAccessState>(() => {
    if (!isAuthenticated || !user?.permissions) {
      return {
        farming: false,
        processing: false,
        logistics: false,
        admin: false,
        platform: false
      };
    }

    return PermissionChecker.getModuleAccessState(user.permissions);
  }, [isAuthenticated, user?.permissions]);

  const hasModuleAccess = (module: ModulePermission): boolean => {
    if (!isAuthenticated || !user?.permissions) return false;
    return PermissionChecker.hasModuleAccess(user.permissions, module);
  };

  return {
    moduleAccess,
    hasModuleAccess,
    canAccessFarming: moduleAccess.farming,
    canAccessProcessing: moduleAccess.processing,
    canAccessLogistics: moduleAccess.logistics,
    canAccessAdmin: moduleAccess.admin,
    canAccessPlatform: moduleAccess.platform
  };
}

/**
 * 功能权限 Hook
 */
export function useFeatureAccess() {
  const { user, isAuthenticated } = useAuthStore();

  const hasFeaturePermission = (feature: string): boolean => {
    if (!isAuthenticated || !user?.permissions) return false;
    return PermissionChecker.hasFeaturePermission(user.permissions, feature);
  };

  const permissions = useMemo(() => {
    if (!isAuthenticated || !user?.permissions) {
      return {
        canManageAllUsers: false,
        canManageOwnDeptUsers: false,
        canManageAllWhitelist: false,
        canManageOwnDeptWhitelist: false,
        canViewAllStats: false,
        canViewOwnDeptStats: false
      };
    }

    return {
      canManageAllUsers: hasFeaturePermission(FEATURE_PERMISSIONS.USER_MANAGE_ALL),
      canManageOwnDeptUsers: hasFeaturePermission(FEATURE_PERMISSIONS.USER_MANAGE_OWN_DEPT),
      canManageAllWhitelist: hasFeaturePermission(FEATURE_PERMISSIONS.WHITELIST_MANAGE_ALL),
      canManageOwnDeptWhitelist: hasFeaturePermission(FEATURE_PERMISSIONS.WHITELIST_MANAGE_OWN_DEPT),
      canViewAllStats: hasFeaturePermission(FEATURE_PERMISSIONS.STATS_VIEW_ALL),
      canViewOwnDeptStats: hasFeaturePermission(FEATURE_PERMISSIONS.STATS_VIEW_OWN_DEPT)
    };
  }, [isAuthenticated, user?.permissions]);

  return {
    ...permissions,
    hasFeaturePermission
  };
}

/**
 * 用户角色 Hook
 */
export function useUserRole() {
  const { user, isAuthenticated } = useAuthStore();

  const role = useMemo(() => {
    if (!isAuthenticated || !user?.permissions) return null;
    return user.permissions.role;
  }, [isAuthenticated, user?.permissions]);

  const roleLevel = useMemo(() => {
    if (!isAuthenticated || !user?.permissions) return 999;
    return user.permissions.roleLevel;
  }, [isAuthenticated, user?.permissions]);

  const department = useMemo(() => {
    if (!isAuthenticated || !user?.permissions) return null;
    return user.permissions.department;
  }, [isAuthenticated, user?.permissions]);

  const roleInfo = useMemo(() => {
    if (!role) return null;

    const roleDisplayNames = {
      'PLATFORM_ADMIN': '平台管理员',
      'SUPER_ADMIN': '工厂超级管理员',
      'PERMISSION_ADMIN': '权限管理员',
      'DEPARTMENT_ADMIN': '部门管理员',
      'USER': '普通员工'
    };

    const departmentDisplayNames = {
      'FARMING': '养殖部门',
      'PROCESSING': '生产部门',
      'LOGISTICS': '物流部门',
      'QUALITY': '质检部门',
      'MANAGEMENT': '管理部门',
      'ADMIN': '系统管理'
    };

    return {
      role,
      roleLevel,
      department,
      roleDisplayName: roleDisplayNames[role] || '未知角色',
      departmentDisplayName: department ? departmentDisplayNames[department] : null,
      isPlatformAdmin: role === 'PLATFORM_ADMIN',
      isSuperAdmin: role === 'SUPER_ADMIN',
      isPermissionAdmin: role === 'PERMISSION_ADMIN',
      isDepartmentAdmin: role === 'DEPARTMENT_ADMIN',
      isRegularUser: role === 'USER'
    };
  }, [role, roleLevel, department]);

  const hasRoleLevel = (requiredLevel: number): boolean => {
    return roleLevel <= requiredLevel;
  };

  return {
    role,
    roleLevel,
    department,
    roleInfo,
    hasRoleLevel,
    isAuthenticated: isAuthenticated && !!user
  };
}

/**
 * 综合权限 Hook
 */
export function usePermissions() {
  const moduleAccess = useModuleAccess();
  const featureAccess = useFeatureAccess();
  const userRole = useUserRole();

  return {
    ...moduleAccess,
    ...featureAccess,
    ...userRole
  };
}

/**
 * 页面权限守卫 Hook
 */
export function usePageGuard(requiredModule?: ModulePermission, requiredFeature?: string) {
  const { hasModuleAccess, hasFeaturePermission, isAuthenticated } = usePermissions();

  const canAccess = useMemo(() => {
    if (!isAuthenticated) return false;
    
    // 检查模块权限
    if (requiredModule && !hasModuleAccess(requiredModule)) {
      return false;
    }
    
    // 检查功能权限
    if (requiredFeature && !hasFeaturePermission(requiredFeature)) {
      return false;
    }
    
    return true;
  }, [isAuthenticated, requiredModule, requiredFeature, hasModuleAccess, hasFeaturePermission]);

  return {
    canAccess,
    isAuthenticated,
    needsLogin: !isAuthenticated,
    needsPermission: isAuthenticated && !canAccess
  };
}

/**
 * 模块状态计算 Hook
 */
export function useModuleStates() {
  const { moduleAccess } = useModuleAccess();

  const moduleStates = useMemo(() => {
    return {
      farming: {
        accessible: moduleAccess.farming,
        className: moduleAccess.farming ? 'text-blue-600' : 'text-gray-400',
        disabled: !moduleAccess.farming,
        tooltip: moduleAccess.farming ? '' : '请联系管理员获取养殖模块权限'
      },
      processing: {
        accessible: moduleAccess.processing,
        className: moduleAccess.processing ? 'text-green-600' : 'text-gray-400',
        disabled: !moduleAccess.processing,
        tooltip: moduleAccess.processing ? '' : '请联系管理员获取生产模块权限'
      },
      logistics: {
        accessible: moduleAccess.logistics,
        className: moduleAccess.logistics ? 'text-purple-600' : 'text-gray-400',
        disabled: !moduleAccess.logistics,
        tooltip: moduleAccess.logistics ? '' : '请联系管理员获取物流模块权限'
      },
      admin: {
        accessible: moduleAccess.admin,
        className: moduleAccess.admin ? 'text-red-600' : 'text-gray-400',
        disabled: !moduleAccess.admin,
        tooltip: moduleAccess.admin ? '' : '请联系管理员获取管理模块权限'
      },
      platform: {
        accessible: moduleAccess.platform,
        className: moduleAccess.platform ? 'text-indigo-600' : 'text-gray-400',
        disabled: !moduleAccess.platform,
        tooltip: moduleAccess.platform ? '' : '仅限平台管理员访问'
      }
    };
  }, [moduleAccess]);

  return moduleStates;
}