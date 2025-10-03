import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPermissions, User } from '../types/auth';
import { CORE_ROLE_PERMISSIONS, FULL_ROLE_PERMISSIONS } from '../constants/permissions';
import { getUserRole } from '../utils/roleMapping';

interface PermissionState {
  // 状态
  permissions: UserPermissions | null;
  isLoading: boolean;
  lastUpdated: number | null;
  
  // Actions
  setPermissions: (permissions: UserPermissions | null) => void;
  setLoading: (loading: boolean) => void;
  refreshPermissions: (user: User | null) => void;
  clearPermissions: () => void;
  
  // Permission Checkers
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasModuleAccess: (module: string) => boolean;
  canAccessData: (level: 'all' | 'factory' | 'department' | 'own') => boolean;
  
  // Advanced Checkers
  canManageUsers: () => boolean;
  canViewAdminPanel: () => boolean;
  canAccessDeveloperTools: () => boolean;
  isPlatformUser: () => boolean;
  isFactoryUser: () => boolean;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      // 初始状态
      permissions: null,
      isLoading: false,
      lastUpdated: null,

      // Actions
      setPermissions: (permissions) =>
        set({
          permissions,
          lastUpdated: Date.now(),
        }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      refreshPermissions: (user) => {
        if (!user) {
          set({
            permissions: null,
            lastUpdated: Date.now(),
          });
          return;
        }

        const userRole = getUserRole(user);
        if (!userRole) {
          console.warn('无法获取用户角色');
          return;
        }

        // 首先尝试从完整权限配置获取，如果没有则从核心权限配置获取
        const rolePermissions = FULL_ROLE_PERMISSIONS[userRole] || CORE_ROLE_PERMISSIONS[userRole];
        
        if (!rolePermissions) {
          console.warn(`未找到角色 ${userRole} 的权限配置`);
          return;
        }

        // 如果是部门管理员或操作员，需要设置具体的部门信息
        const finalPermissions = { ...rolePermissions };
        if (user.userType === 'factory' && 'factoryUser' in user && user.factoryUser.department) {
          finalPermissions.departments = [user.factoryUser.department];
        }

        set({
          permissions: finalPermissions,
          lastUpdated: Date.now(),
        });
      },

      clearPermissions: () =>
        set({
          permissions: null,
          lastUpdated: null,
        }),

      // Permission Checkers
      hasPermission: (permission) => {
        const { permissions } = get();
        if (!permissions) return false;
        
        return permissions.features.includes(permission);
      },

      hasRole: (role) => {
        const { permissions } = get();
        if (!permissions) return false;
        
        return permissions.role === role;
      },

      hasAnyRole: (roles) => {
        const { permissions } = get();
        if (!permissions) return false;
        
        return roles.includes(permissions.role);
      },

      hasModuleAccess: (module) => {
        const { permissions } = get();
        if (!permissions) return false;
        
        return !!permissions.modules[module as keyof typeof permissions.modules];
      },

      canAccessData: (level) => {
        const { permissions } = get();
        if (!permissions) return false;

        // 系统开发者可以访问所有级别
        if (permissions.role === 'system_developer') return true;

        // 平台管理员可以访问all级别
        if (permissions.userType === 'platform' && level === 'all') return true;

        // 工厂用户根据级别判断
        if (permissions.userType === 'factory') {
          switch (level) {
            case 'all':
              return permissions.level <= 0; // 只有超级管理员级别
            case 'factory':
              return permissions.level <= 10; // 部门管理员及以上
            case 'department':
              return permissions.level <= 30; // 操作员及以上
            case 'own':
              return true; // 所有用户都可以访问自己的数据
            default:
              return false;
          }
        }

        return false;
      },

      // Advanced Checkers
      canManageUsers: () => {
        const { hasPermission } = get();
        return hasPermission('user_manage_all') || 
               hasPermission('user_manage_factory') || 
               hasPermission('user_manage_department');
      },

      canViewAdminPanel: () => {
        const { hasModuleAccess } = get();
        return hasModuleAccess('admin_access') || hasModuleAccess('platform_access');
      },

      canAccessDeveloperTools: () => {
        const { hasPermission } = get();
        return hasPermission('developer_tools') || hasPermission('debug_access');
      },

      isPlatformUser: () => {
        const { permissions } = get();
        return permissions?.userType === 'platform';
      },

      isFactoryUser: () => {
        const { permissions } = get();
        return permissions?.userType === 'factory';
      },
    }),
    {
      name: 'permission-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        permissions: state.permissions,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);