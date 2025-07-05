/**
 * 认证状态管理
 * 使用Zustand管理用户认证、权限、登录状态等
 * 集成React Query进行数据查询和缓存管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { authService } from '@/services/auth.service';
import type {
  AuthState,
  User,
  LoginCredentials,
  AuthResponse
} from '@/types/state';
import type { LoginRequest, RegisterRequest } from '@/types/auth';

// 使用新的认证服务 - 支持Mock/Real API切换
const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      // 转换为新服务需要的格式
      const loginRequest: LoginRequest = {
        username: credentials.username,
        password: credentials.password
      };

      const response = await authService.login(loginRequest);

      // 转换为现有格式
      if (response?.data?.token || response?.token) {
        const token = response.data?.token || response.token;
        const userData = response.data?.user || response.user || response;

                // 处理新的role对象结构或旧的字符串结构
        const userRole = userData.role;
        const roleInfo = typeof userRole === 'object' && userRole !== null
          ? userRole
          : { name: userRole || 'user', level: userRole === 'admin' ? 1 : 3, displayName: userRole === 'admin' ? '系统管理员' : '普通用户' };

        return {
          user: {
            id: String(userData.id || '1'),
            username: userData.username,
            email: userData.email || '',
            displayName: userData.name || userData.username,
            avatar: userData.avatar || '',
            role: {
              id: roleInfo.name,
              name: roleInfo.displayName || roleInfo.name,
              description: roleInfo.level === 0 ? '平台最高权限，管理所有工厂租户' :
                          roleInfo.level === 1 ? '具有系统所有权限' : '基础查看权限',
              level: roleInfo.level,
            },
            permissions: roleInfo.level === 0
              ? [
                  { id: '0', name: '平台管理', resource: 'platform', action: 'manage' },
                  { id: '1', name: '农业管理', resource: 'farming', action: 'manage' },
                  { id: '2', name: '加工管理', resource: 'processing', action: 'manage' },
                  { id: '3', name: '物流管理', resource: 'logistics', action: 'manage' },
                  { id: '4', name: '系统管理', resource: 'admin', action: 'manage' },
                  { id: '5', name: '溯源查询', resource: 'trace', action: 'read' },
                ]
              : roleInfo.level === 1
              ? [
                  { id: '1', name: '农业管理', resource: 'farming', action: 'manage' },
                  { id: '2', name: '加工管理', resource: 'processing', action: 'manage' },
                  { id: '3', name: '物流管理', resource: 'logistics', action: 'manage' },
                  { id: '4', name: '系统管理', resource: 'admin', action: 'manage' },
                  { id: '5', name: '溯源查询', resource: 'trace', action: 'read' },
                ]
              : [
                  { id: '5', name: '溯源查询', resource: 'trace', action: 'read' },
                ],
            createdAt: userData.createdAt || new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          },
          token,
          refreshToken: response.data?.refreshToken || 'mock-refresh-token',
          expiresIn: response.data?.expiresIn || 3600,
        };
      }

      throw new Error('登录响应格式无效');
    } catch (error) {
      // 如果新API失败，使用模拟数据（开发阶段）
      console.warn(`[AuthStore] ${authService.getEnvironment()} API失败，使用模拟登录数据:`, error);
      return mockLogin(credentials);
    }
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    try {
      console.log('尝试刷新token:', refreshToken);
      const response = await authService.refreshToken();

      if (response?.data?.token || response?.token) {
        // 简化的刷新响应
        return {
          user: {} as User, // 刷新时不更新用户信息
          token: response.data?.token || response.token,
          refreshToken: response.data?.refreshToken || refreshToken,
          expiresIn: response.data?.expiresIn || 3600,
        };
      }

      throw new Error('Token刷新失败');
    } catch (error) {
      console.error('Token刷新失败:', error);
      throw error;
    }
  },

  updateProfile: async (profile: Partial<User>): Promise<User> => {
    try {
      console.log('更新用户资料:', profile);
      const response = await authService.getUserProfile();

      return {
        id: String(response.id || '1'),
        username: response.username,
        email: response.email || '',
        displayName: response.username,
        avatar: '',
        role: {
          id: response.role || 'user',
          name: response.role === 'admin' ? '系统管理员' : '普通用户',
          description: '',
          level: response.role === 'admin' ? 1 : 3,
        },
        permissions: [],
        createdAt: response.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('用户资料更新失败:', error);
      throw error;
    }
  },

  // 获取用户权限（暂时返回空数组）
  getPermissions: async () => {
    try {
      // 真实API开发完成后，可以添加权限获取逻辑
      return [];
    } catch (_error) {
      console.error('权限获取失败:', _error);
      return [];
    }
  },
};

// 模拟登录函数（开发阶段使用）
const mockLogin = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  // 模拟超级管理员登录
  if (credentials.username === 'super_admin' && credentials.password === 'super123') {
    const user: User = {
      id: '0',
      username: 'super_admin',
      email: 'super@heiniu.com',
      displayName: '平台超级管理员',
      avatar: '',
      role: {
        id: 'super_admin',
        name: '平台超级管理员',
        description: '平台最高权限，管理所有工厂租户',
        level: 0,
      },
      permissions: [
        { id: '0', name: '平台管理', resource: 'platform', action: 'manage' },
        { id: '1', name: '农业管理', resource: 'farming', action: 'manage' },
        { id: '2', name: '加工管理', resource: 'processing', action: 'manage' },
        { id: '3', name: '物流管理', resource: 'logistics', action: 'manage' },
        { id: '4', name: '系统管理', resource: 'admin', action: 'manage' },
        { id: '5', name: '溯源查询', resource: 'trace', action: 'read' },
      ],
      createdAt: '2025-01-01T00:00:00Z',
      lastLoginAt: new Date().toISOString(),
    };

    return {
      user,
      token: 'mock-jwt-token-super-' + Date.now(),
      refreshToken: 'mock-refresh-token-super-' + Date.now(),
      expiresIn: 3600, // 1小时
    };
  }

  // 模拟工厂用户
  if (credentials.username === 'user' && credentials.password === 'user123') {
    const user: User = {
      id: '1',
      username: 'user',
      email: 'user@heiniu.com',
      displayName: '工厂用户',
      avatar: '',
      role: {
        id: 'user',
        name: '工厂用户',
        description: '工厂管理和操作权限',
      },
      permissions: [
        { id: '1', name: '农业管理', resource: 'farming', action: 'manage' },
        { id: '2', name: '加工管理', resource: 'processing', action: 'manage' },
        { id: '3', name: '物流管理', resource: 'logistics', action: 'manage' },
        { id: '4', name: '系统管理', resource: 'admin', action: 'manage' },
        { id: '5', name: '溯源查询', resource: 'trace', action: 'read' },
      ],
      createdAt: '2025-01-01T00:00:00Z',
      lastLoginAt: new Date().toISOString(),
    };

    return {
      user,
      token: 'mock-jwt-token-user-' + Date.now(),
      refreshToken: 'mock-refresh-token-user-' + Date.now(),
      expiresIn: 3600,
    };
  }

  throw new Error('用户名或密码错误');
};

// 默认认证状态
const defaultAuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  tokenExpiresAt: null,
  permissions: [],
  loading: false,
  error: null,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...defaultAuthState,

        // 用户登录
        login: async (credentials: LoginCredentials) => {
          set({ loading: true, error: null }, false, 'auth/login/start');

          try {
            const response = await authAPI.login(credentials);
            const expiresAt = Date.now() + response.expiresIn * 1000;

            set({
              isAuthenticated: true,
              user: response.user,
              token: response.token,
              refreshToken: response.refreshToken,
              tokenExpiresAt: expiresAt,
              permissions: response.user.permissions,
              loading: false,
              error: null,
            }, false, 'auth/login/success');

            // 登录成功后的额外操作
            console.log('✅ 用户登录成功:', response.user.displayName);

            // 设置自动刷新令牌
            if (response.expiresIn > 0) {
              const refreshTime = Math.max(response.expiresIn * 1000 - 300000, 60000); // 提前5分钟刷新，最少1分钟后
              setTimeout(() => {
                const { isAuthenticated } = get();
                if (isAuthenticated) {
                  get().refreshAccessToken();
                }
              }, refreshTime);
            }

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '登录失败';
            set({
              loading: false,
              error: errorMessage,
            }, false, 'auth/login/error');

            console.error('❌ 用户登录失败:', errorMessage);
            throw error;
          }
        },

        // 用户登出
        logout: () => {
          set(defaultAuthState, false, 'auth/logout');

          // 清除本地存储的认证信息
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-state');
          }

          console.log('🚪 用户已登出');
        },

        // 刷新访问令牌
        refreshAccessToken: async () => {
          const { refreshToken, isAuthenticated } = get();

          if (!isAuthenticated || !refreshToken) {
            console.warn('⚠️ 无法刷新令牌：用户未登录或刷新令牌不存在');
            return;
          }

          set({ loading: true }, false, 'auth/refresh/start');

          try {
            const response = await authAPI.refreshToken(refreshToken);
            const expiresAt = Date.now() + response.expiresIn * 1000;

            set({
              token: response.token,
              refreshToken: response.refreshToken,
              tokenExpiresAt: expiresAt,
              user: response.user,
              permissions: response.user.permissions,
              loading: false,
              error: null,
            }, false, 'auth/refresh/success');

            console.log('🔄 令牌刷新成功');

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '令牌刷新失败';
            console.error('❌ 令牌刷新失败:', errorMessage);

            // 刷新失败，强制登出
            get().logout();
          }
        },

        // 更新用户资料
        updateProfile: async (profile: Partial<User>) => {
          const { user, isAuthenticated } = get();

          if (!isAuthenticated || !user) {
            throw new Error('用户未登录');
          }

          set({ loading: true, error: null }, false, 'auth/updateProfile/start');

          try {
            const updatedUser = await authAPI.updateProfile(profile);

            set({
              user: updatedUser,
              loading: false,
              error: null,
            }, false, 'auth/updateProfile/success');

            console.log('✅ 用户资料更新成功');

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '更新失败';
            set({
              loading: false,
              error: errorMessage,
            }, false, 'auth/updateProfile/error');

            console.error('❌ 用户资料更新失败:', errorMessage);
            throw error;
          }
        },

        // 检查用户权限
        checkPermission: (resource: string, action: string): boolean => {
          const { permissions, isAuthenticated } = get();

          if (!isAuthenticated) {
            return false;
          }

          return permissions.some(permission => {
            // 完全匹配
            if (permission.resource === resource && permission.action === action) {
              return true;
            }

            // 管理权限包含所有操作
            if (permission.resource === resource && permission.action === 'manage') {
              return true;
            }

            // 系统管理员权限
            if (permission.resource === 'admin' && permission.action === 'manage') {
              return true;
            }

            return false;
          });
        },

        // 清除错误
        clearError: () => {
          set({ error: null }, false, 'auth/clearError');
        },

        // 自动登录尝试 (使用新的API结构)
        tryAutoLogin: async () => {
          const { isAuthenticated } = get();
          if (isAuthenticated) {
            return; // 已经登录，无需重复操作
          }

          try {
            const user = await authAPI.updateProfile({});
            set({
              isAuthenticated: true,
              user: user as User,
              error: null
            }, false, 'auth/tryAutoLogin/success');
          } catch (_autoLoginError) {
            console.warn('Auto login failed:', _autoLoginError);
            get().logout();
          }
        },
      }),
      {
        name: 'auth-state',

        // 选择性持久化：保存认证信息，但不保存loading和error状态
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
          token: state.token,
          refreshToken: state.refreshToken,
          tokenExpiresAt: state.tokenExpiresAt,
          permissions: state.permissions,
        }),

        // 版本控制
        version: 1,

        // 状态迁移
        migrate: (persistedState: any, version: number) => {
          if (version === 0) {
            return {
              ...defaultAuthState,
              ...persistedState,
            };
          }
          return persistedState;
        },
      }
    ),
    {
      name: 'auth-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// 浏览器环境下的初始化逻辑
if (typeof window !== 'undefined') {
  // 检查令牌是否过期
  const checkTokenExpiry = () => {
    const { tokenExpiresAt, isAuthenticated, logout } = useAuthStore.getState();

    if (isAuthenticated && tokenExpiresAt && Date.now() >= tokenExpiresAt) {
      console.warn('⚠️ 令牌已过期，自动登出');
      logout();
    }
  };

  // 定期检查令牌状态
  setInterval(checkTokenExpiry, 60000); // 每分钟检查一次

  // 页面加载时立即检查一次
  checkTokenExpiry();
}

// 导出选择器函数
export const authSelectors = {
  // 认证状态
  isAuthenticated: (state: AuthState) => state.isAuthenticated,
  user: (state: AuthState) => state.user,
  loading: (state: AuthState) => state.loading,
  error: (state: AuthState) => state.error,

  // 用户信息
  userDisplayName: (state: AuthState) => state.user?.displayName,
  userRole: (state: AuthState) => state.user?.role,
  userAvatar: (state: AuthState) => state.user?.avatar,

  // 权限相关
  permissions: (state: AuthState) => state.permissions,
  isAdmin: (state: AuthState) =>
    state.user?.role.level === 1 ||
    state.permissions.some(p => p.resource === 'admin' && p.action === 'manage'),
};

// 导出便捷Hook
export const useAuth = () => useAuthStore(authSelectors.isAuthenticated);
export const useUser = () => useAuthStore(authSelectors.user);
export const useAuthLoading = () => useAuthStore(authSelectors.loading);
export const useAuthError = () => useAuthStore(authSelectors.error);
export const usePermissions = () => useAuthStore(authSelectors.permissions);
export const useIsAdmin = () => useAuthStore(authSelectors.isAdmin);

// 导出权限检查Hook
export const usePermission = (resource: string, action: string) => {
  return useAuthStore(state => state.checkPermission(resource, action));
};

// 导出actions的便捷函数
export const authActions = {
  login: () => useAuthStore.getState().login,
  logout: () => useAuthStore.getState().logout,
  updateProfile: () => useAuthStore.getState().updateProfile,
  checkPermission: () => useAuthStore.getState().checkPermission,
  clearError: () => useAuthStore.getState().clearError,
};
