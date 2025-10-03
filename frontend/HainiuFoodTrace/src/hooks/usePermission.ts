import { useEffect } from 'react';
import { AuthService } from '../services/auth/authService';
import { 
  User, 
  UserRole, 
  UserPermissions, 
  USER_ROLES,
  PLATFORM_ROLES,
  FACTORY_ROLES
} from '../types/auth';
import { getUserRole, isPlatformUser, isFactoryUser } from '../utils/roleMapping';
import { 
  CORE_ROLE_PERMISSIONS, 
  FULL_ROLE_PERMISSIONS, 
  ROLE_LEVELS,
  ROLE_DATA_ACCESS,
  DataAccessLevel 
} from '../constants/permissions';
import { useAuthStore } from '../store/authStore';
import { usePermissionStore } from '../store/permissionStore';
import { 
  usePermissions, 
  type EnhancedPermissionCheckResult,
  type DataAccessOptions,
  type PermissionCheckOptions
} from './usePermissions';

interface UsePermissionReturn {
  user: User | null;
  permissions: UserPermissions | null;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasModuleAccess: (module: string) => boolean;
  canManageUser: (targetUserId: string) => boolean;
  canAccessData: (dataLevel: DataAccessLevel) => boolean;
  getUserDataAccessLevel: () => DataAccessLevel;
  isHigherRole: (compareRole: UserRole) => boolean;
  refreshPermissions: () => Promise<void>;
  
  // 增强权限检查功能
  checkEnhancedPermissions: (options: {
    permissions?: string[];
    roles?: UserRole[];
    modules?: string[];
    department?: string;
    minimumLevel?: number;
    dataAccess?: DataAccessOptions;
  }, checkOptions?: PermissionCheckOptions) => Promise<EnhancedPermissionCheckResult>;
  
  // 快速权限检查
  hasMinimumLevel: (level: number) => boolean;
  hasDepartmentAccess: (department: string) => boolean;
  hasDataAccess: (options: DataAccessOptions) => boolean;
  getUserLevel: () => number;
  getUserDepartments: () => string[];
  
  // 缓存管理
  clearPermissionCache: () => void;
  getPermissionCacheStats: () => {
    totalEntries: number;
    hitRate: number;
    averageAge: number;
  };
}

/**
 * 权限管理Hook (使用Zustand stores + 增强权限系统)
 * 提供完整的权限检查和管理功能
 */
export const usePermission = (): UsePermissionReturn => {
  // 使用Zustand stores
  const { user, isLoading: authLoading } = useAuthStore();
  const { 
    permissions, 
    isLoading: permissionLoading,
    refreshPermissions: refreshPermStore,
    hasPermission,
    hasRole: storeHasRole,
    hasAnyRole: storeHasAnyRole,
    hasModuleAccess,
    canAccessData: storeCanAccessData,
  } = usePermissionStore();

  // 使用增强权限系统
  const {
    checkPermissions: enhancedCheckPermissions,
    hasMinimumLevel: enhancedHasMinimumLevel,
    hasDepartmentAccess: enhancedHasDepartmentAccess,
    hasDataAccess: enhancedHasDataAccess,
    getUserLevel: enhancedGetUserLevel,
    getUserDepartments: enhancedGetUserDepartments,
    clearCache: enhancedClearCache,
    getCacheStats: enhancedGetCacheStats,
    refreshPermissions: enhancedRefreshPermissions,
    isLoading: enhancedIsLoading
  } = usePermissions();

  const isLoading = authLoading || permissionLoading || enhancedIsLoading;

  // 当用户信息变化时，更新权限
  useEffect(() => {
    refreshPermStore(user);
  }, [user, refreshPermStore]);

  // 刷新权限数据
  const refreshPermissions = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      refreshPermStore(currentUser);
      await enhancedRefreshPermissions();
    } catch (error) {
      console.error('刷新权限失败:', error);
    }
  };

  // 使用store中的权限检查函数（添加系统开发者特权）
  const hasPermissionEnhanced = (permission: string): boolean => {
    // 系统开发者拥有所有权限
    const userRole = user ? getUserRole(user) : null;
    if (userRole === USER_ROLES.DEVELOPER) return true;
    
    return hasPermission(permission);
  };

  // 使用store中的角色检查函数
  const hasRoleEnhanced = (role: UserRole): boolean => {
    if (!user) return false;
    const userRole = getUserRole(user);
    return userRole === role;
  };

  // 使用store中的多角色检查函数
  const hasAnyRoleEnhanced = (roles: UserRole[]): boolean => {
    if (!user) return false;
    const userRole = getUserRole(user);
    return roles.includes(userRole);
  };

  // 使用store中的模块访问检查函数（添加系统开发者特权）
  const hasModuleAccessEnhanced = (module: string): boolean => {
    // 系统开发者拥有所有模块权限
    const userRole = user ? getUserRole(user) : null;
    if (userRole === USER_ROLES.DEVELOPER) return true;
    
    return hasModuleAccess(module);
  };

  // 检查是否可以管理指定用户
  const canManageUser = (targetUserId: string): boolean => {
    if (!user || !permissions) return false;
    
    // 系统开发者可以管理所有用户
    const userRole = getUserRole(user);
    if (userRole === USER_ROLES.DEVELOPER) return true;
    
    // 平台超级管理员可以管理所有用户
    if (userRole === USER_ROLES.PLATFORM_ADMIN && hasPermissionEnhanced('user_manage_all')) {
      return true;
    }
    
    // 工厂超级管理员可以管理工厂内用户
    if (userRole === USER_ROLES.FACTORY_SUPER_ADMIN && hasPermissionEnhanced('user_manage_factory')) {
      // 这里需要额外的逻辑来检查目标用户是否属于同一工厂
      return true;
    }
    
    // 部门管理员可以管理部门内用户
    if (userRole === USER_ROLES.DEPARTMENT_ADMIN && hasPermissionEnhanced('user_manage_department')) {
      // 这里需要额外的逻辑来检查目标用户是否属于同一部门
      return true;
    }
    
    return false;
  };

  // 检查数据访问权限（使用store函数但添加系统开发者特权）
  const canAccessDataEnhanced = (dataLevel: DataAccessLevel): boolean => {
    if (!user) return false;
    
    // 系统开发者可以访问所有数据
    const userRole = getUserRole(user);
    if (userRole === USER_ROLES.DEVELOPER) return true;
    
    return storeCanAccessData(dataLevel);
  };

  // 获取用户数据访问级别
  const getUserDataAccessLevel = (): DataAccessLevel => {
    if (!user) return 'own';
    const userRole = getUserRole(user);
    return ROLE_DATA_ACCESS[userRole] || 'own';
  };

  // 检查是否比指定角色权限更高
  const isHigherRole = (compareRole: UserRole): boolean => {
    if (!user) return false;
    
    const userRole = getUserRole(user);
    const userLevel = ROLE_LEVELS[userRole];
    const compareLevel = ROLE_LEVELS[compareRole];
    
    // 数字越小权限越高
    return userLevel < compareLevel;
  };

  return {
    user,
    permissions,
    isLoading,
    hasPermission: hasPermissionEnhanced,
    hasRole: hasRoleEnhanced,
    hasAnyRole: hasAnyRoleEnhanced,
    hasModuleAccess: hasModuleAccessEnhanced,
    canManageUser,
    canAccessData: canAccessDataEnhanced,
    getUserDataAccessLevel,
    isHigherRole,
    refreshPermissions,
    
    // 增强权限检查功能
    checkEnhancedPermissions: enhancedCheckPermissions,
    
    // 快速权限检查 (优先使用增强版本)
    hasMinimumLevel: enhancedHasMinimumLevel,
    hasDepartmentAccess: enhancedHasDepartmentAccess,
    hasDataAccess: enhancedHasDataAccess,
    getUserLevel: enhancedGetUserLevel,
    getUserDepartments: enhancedGetUserDepartments,
    
    // 缓存管理
    clearPermissionCache: enhancedClearCache,
    getPermissionCacheStats: enhancedGetCacheStats
  };
};