/**
 * 权限管理 Hook
 * 统一的权限检查和管理逻辑
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';

// 权限配置（与后端保持一致）
const PLATFORM_PERMISSIONS = {
  'platform_super_admin': [
    'create_factory',
    'delete_factory', 
    'manage_all_factories',
    'view_factory_details',
    'factory_activation_control',
    'platform_settings',
    'system_monitoring',
    'platform_backup',
    'manage_platform_admins',
    'view_platform_analytics',
    'export_platform_data',
    'cross_factory_reports',
    'system_maintenance',
    'global_notifications',
    'audit_all_logs'
  ],
  'platform_operator': [
    'view_factories',
    'view_factory_status',
    'view_platform_analytics',
    'basic_support',
    'view_support_tickets',
    'factory_health_check'
  ]
};

const FACTORY_PERMISSIONS = {
  'factory_super_admin': [
    'manage_factory_users',
    'create_users',
    'delete_users',
    'activate_users',
    'assign_roles',
    'factory_settings',
    'manage_all_departments',
    'factory_backup',
    'factory_configuration',
    'view_all_factory_data',
    'export_factory_data',
    'delete_factory_data',
    'view_factory_reports',
    'create_custom_reports',
    'schedule_reports',
    'manage_whitelist',
    'audit_factory_logs',
    'factory_notifications'
  ],
  'permission_admin': [
    'activate_users',
    'assign_roles',
    'manage_permissions',
    'audit_permissions',
    'manage_whitelist',
    'add_whitelist_users',
    'remove_whitelist_users',
    'whitelist_bulk_operations',
    'review_user_applications',
    'approve_user_registrations',
    'reject_user_applications',
    'view_user_reports',
    'view_permission_reports',
    'export_user_data',
    'view_user_logs',
    'permission_change_logs'
  ],
  'department_admin': [
    'manage_department_users',
    'activate_department_users',
    'assign_department_roles',
    'department_data_management',
    'view_department_data',
    'edit_department_data',
    'export_department_data',
    'view_department_reports',
    'create_department_reports',
    'department_settings',
    'department_notifications'
  ],
  'operator': [
    'data_entry',
    'edit_own_records',
    'basic_query',
    'view_department_data',
    'view_own_records',
    'create_records',
    'update_records',
    'upload_files'
  ],
  'viewer': [
    'read_authorized_data',
    'view_assigned_records',
    'basic_search',
    'export_authorized_data'
  ]
};

interface User {
  id: number;
  username: string;
  role?: {
    name: string;
  };
  roleCode?: string;
  department?: string;
  factoryId?: string;
  type?: 'platform_admin' | 'factory_user';
}

interface PermissionResult {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canAccessDepartment: (department: string) => boolean;
  canManageUser: (targetUser: User) => boolean;
  getUserPermissions: () => string[];
  getUserRole: () => string;
  getUserType: () => 'platform_admin' | 'factory_user' | null;
  isLoading: boolean;
}

export function usePermissions(): PermissionResult {
  const { user, loading } = useAuthStore();

  const permissions = useMemo(() => {
    if (!user) return [];

    const userType = getUserType(user);
    const userRole = getUserRole(user);

    if (userType === 'platform_admin') {
      return PLATFORM_PERMISSIONS[userRole as keyof typeof PLATFORM_PERMISSIONS] || [];
    } else if (userType === 'factory_user') {
      return FACTORY_PERMISSIONS[userRole as keyof typeof FACTORY_PERMISSIONS] || [];
    }

    return [];
  }, [user]);

  const getUserType = (user: User): 'platform_admin' | 'factory_user' | null => {
    if (!user) return null;
    
    // 检查是否为平台管理员
    if (user.username === 'platform_admin' || 
        user.role?.name === 'PLATFORM_ADMIN' ||
        user.username === 'super_admin') {
      return 'platform_admin';
    }
    
    // 其他都是工厂用户
    return 'factory_user';
  };

  const getUserRole = (user: User): string => {
    if (!user) return '';
    
    const userType = getUserType(user);
    
    if (userType === 'platform_admin') {
      if (user.username === 'platform_admin' || user.username === 'super_admin') {
        return 'platform_super_admin';
      }
      return 'platform_operator';
    }
    
    // 工厂用户角色映射
    return user.roleCode || user.role?.name || 'viewer';
  };

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.every(permission => hasPermission(permission));
  };

  const canAccessDepartment = (department: string): boolean => {
    if (!user) return false;

    const userType = getUserType(user);
    const userRole = getUserRole(user);

    // 平台管理员可以访问所有部门
    if (userType === 'platform_admin') {
      return true;
    }

    // 工厂超级管理员可以访问所有部门
    if (userRole === 'factory_super_admin') {
      return true;
    }

    // 权限管理员可以访问所有部门（用于用户管理）
    if (userRole === 'permission_admin') {
      return true;
    }

    // 部门管理员、操作员、查看者只能访问自己的部门
    return user.department === department;
  };

  const canManageUser = (targetUser: User): boolean => {
    if (!user || !targetUser) return false;

    const userType = getUserType(user);
    const userRole = getUserRole(user);
    const targetUserType = getUserType(targetUser);
    const targetUserRole = getUserRole(targetUser);

    // 平台管理员可以管理所有用户
    if (userType === 'platform_admin' && userRole === 'platform_super_admin') {
      return true;
    }

    // 不能跨工厂管理
    if (user.factoryId !== targetUser.factoryId) {
      return false;
    }

    // 工厂超级管理员可以管理工厂内所有用户
    if (userRole === 'factory_super_admin') {
      return true;
    }

    // 权限管理员可以管理非超级管理员用户
    if (userRole === 'permission_admin') {
      return targetUserRole !== 'factory_super_admin';
    }

    // 部门管理员可以管理本部门的操作员和查看者
    if (userRole === 'department_admin') {
      return user.department === targetUser.department && 
             ['operator', 'viewer'].includes(targetUserRole);
    }

    return false;
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessDepartment,
    canManageUser,
    getUserPermissions: () => permissions,
    getUserRole: () => getUserRole(user),
    getUserType: () => getUserType(user),
    isLoading: loading
  };
}

// 权限检查的快捷方法
export function usePermissionCheck(permission: string) {
  const { hasPermission, isLoading } = usePermissions();
  return { hasPermission: hasPermission(permission), isLoading };
}

// 多权限检查的快捷方法
export function useMultiPermissionCheck(permissions: string[], requireAll = false) {
  const { hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();
  
  const hasPermission = requireAll 
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);
    
  return { hasPermission, isLoading };
}

// 部门访问检查的快捷方法
export function useDepartmentAccess(department: string) {
  const { canAccessDepartment, isLoading } = usePermissions();
  return { canAccess: canAccessDepartment(department), isLoading };
}

export default usePermissions;