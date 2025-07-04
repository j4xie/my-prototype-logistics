// 认证状态管理 - 重点模块
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthState, User, AuthToken, Permission, LoginCredentials, RegisterRequest } from '../types/auth';
import { logger } from '../platform/logger';
import { getCoreConfig } from '../core';

interface AuthActions {
  // 登录相关
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  register: (data: RegisterRequest) => Promise<void>;
  
  // Token管理
  refreshToken: () => Promise<void>;
  setToken: (token: AuthToken) => void;
  clearToken: () => void;
  
  // 用户信息
  setUser: (user: User) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  
  // 权限管理
  setPermissions: (permissions: Permission[]) => void;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (role: string) => boolean;
  
  // 错误处理
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      user: null,
      token: null,
      permissions: [],
      loading: false,
      error: null,

      // 登录
      login: async (credentials: LoginCredentials) => {
        try {
          set({ loading: true, error: null });
          logger.info('Starting login process');

          const config = getCoreConfig();
          const response = await fetch(`${config.apiBaseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
          });

          if (!response.ok) {
            throw new Error('登录失败');
          }

          const data = await response.json();
          
          if (data.success) {
            const { user, token, permissions } = data.data;
            
            set({
              isAuthenticated: true,
              user,
              token,
              permissions,
              loading: false,
              error: null
            });
            
            logger.info('Login successful', { userId: user.id });
          } else {
            throw new Error(data.message || '登录失败');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '登录失败';
          set({ loading: false, error: errorMessage });
          logger.error('Login failed:', error);
          throw error;
        }
      },

      // 注册
      register: async (data: RegisterRequest) => {
        try {
          set({ loading: true, error: null });
          logger.info('Starting registration process');

          if (data.password !== data.confirmPassword) {
            throw new Error('密码不一致');
          }

          const config = getCoreConfig();
          const response = await fetch(`${config.apiBaseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          if (!response.ok) {
            throw new Error('注册失败');
          }

          const result = await response.json();
          
          if (result.success) {
            set({ loading: false, error: null });
            logger.info('Registration successful');
          } else {
            throw new Error(result.message || '注册失败');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '注册失败';
          set({ loading: false, error: errorMessage });
          logger.error('Registration failed:', error);
          throw error;
        }
      },

      // 登出
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          permissions: [],
          error: null
        });
        logger.info('User logged out');
      },

      // Token刷新
      refreshToken: async () => {
        try {
          const { token } = get();
          if (!token?.refreshToken) {
            throw new Error('No refresh token available');
          }

          const config = getCoreConfig();
          const response = await fetch(`${config.apiBaseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken })
          });

          if (!response.ok) {
            throw new Error('Token refresh failed');
          }

          const data = await response.json();
          
          if (data.success) {
            set({ token: data.data.token });
            logger.info('Token refreshed successfully');
          } else {
            throw new Error(data.message || 'Token refresh failed');
          }
        } catch (error) {
          logger.error('Token refresh failed:', error);
          // Token刷新失败，清除认证状态
          get().logout();
          throw error;
        }
      },

      // 更新用户资料
      updateProfile: async (data: Partial<User>) => {
        try {
          set({ loading: true, error: null });
          
          const config = getCoreConfig();
          const { token } = get();
          
          const response = await fetch(`${config.apiBaseUrl}/api/users/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token?.accessToken}`
            },
            body: JSON.stringify(data)
          });

          if (!response.ok) {
            throw new Error('更新资料失败');
          }

          const result = await response.json();
          
          if (result.success) {
            set({ 
              user: { ...get().user!, ...result.data },
              loading: false,
              error: null
            });
            logger.info('Profile updated successfully');
          } else {
            throw new Error(result.message || '更新资料失败');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '更新资料失败';
          set({ loading: false, error: errorMessage });
          logger.error('Profile update failed:', error);
          throw error;
        }
      },

      // 权限检查
      hasPermission: (resource: string, action: string) => {
        const { permissions } = get();
        return permissions.some(p => 
          p.resource === resource && p.action === action
        );
      },

      // 角色检查
      hasRole: (role: string) => {
        const { user } = get();
        return user?.role === role;
      },

      // 辅助方法
      setToken: (token: AuthToken) => set({ token }),
      clearToken: () => set({ token: null }),
      setUser: (user: User) => set({ user }),
      setPermissions: (permissions: Permission[]) => set({ permissions }),
      setError: (error: string | null) => set({ error }),
      clearError: () => set({ error: null }),
      setLoading: (loading: boolean) => set({ loading })
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        try {
          const config = getCoreConfig();
          return config.storage;
        } catch {
          // 如果core未初始化，使用内存存储
          return {
            getItem: (name: string) => Promise.resolve(null),
            setItem: (name: string, value: string) => Promise.resolve(),
            removeItem: (name: string) => Promise.resolve()
          };
        }
      }),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        permissions: state.permissions
      })
    }
  )
);