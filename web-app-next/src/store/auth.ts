/**
 * @module AuthStore
 * @description 食品溯源系统 - 认证状态管理 (Phase-3)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthState } from '@/types';

interface AuthActions {
  login: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

/**
 * 认证状态管理Store
 * 使用Zustand + 持久化存储
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      loading: false,
      error: null,

      // Actions
      login: (user: User, token: string, refreshToken?: string) => {
        set({
          isAuthenticated: true,
          user,
          token,
          refreshToken,
          loading: false,
          error: null,
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          loading: false,
          error: null,
        });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData },
          });
        }
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      },

      setError: (error: string | null) => {
        set({ error, loading: false });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // 只持久化必要的字段
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

// 选择器函数 - 用于组件中获取特定状态
export const useAuth = () => {
  const {
    isAuthenticated,
    user,
    token,
    loading,
    error,
    login,
    logout,
    updateUser,
    setLoading,
    setError,
    clearError,
  } = useAuthStore();

  return {
    isAuthenticated,
    user,
    token,
    loading,
    error,
    login,
    logout,
    updateUser,
    setLoading,
    setError,
    clearError,
  };
};

// 权限检查函数
export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;
    
    return user.permissions.some(
      (permission) =>
        permission.resource === resource && permission.action === action
    );
  };

  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  return {
    hasPermission,
    hasRole,
    hasAnyRole,
  };
}; 