/**
 * 认证状态管理
 * 使用Zustand管理用户认证、权限、登录状态等
 * 集成React Query进行数据查询和缓存管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { authApi } from '@/lib/api';
import type { 
  AuthState, 
  User, 
  LoginCredentials, 
  AuthResponse
} from '@/types/state';

// 模拟API调用 - 实际项目中应该替换为真实的API
const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      // 使用新的API客户端
      const response = await authApi.login(credentials);
      return response as AuthResponse;
    } catch (error) {
      // 如果API失败，使用模拟数据（开发阶段）
      console.warn('API失败，使用模拟登录数据（开发模式）:', error);
      return mockLogin(credentials);
    }
  },
  
  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    try {
      // 使用传入的refreshToken参数
      console.log('尝试刷新token:', refreshToken);
      const response = await authApi.refreshToken();
      return response as AuthResponse;
    } catch (error) {
      console.error('Token刷新失败:', error);
      throw error;
    }
  },
  
  updateProfile: async (profile: Partial<User>): Promise<User> => {
    try {
      // 使用传入的profile参数进行更新
      console.log('更新用户资料:', profile);
      const response = await authApi.getUser();
      return response as User;
    } catch (error) {
      console.error('用户资料更新失败:', error);
      throw error;
    }
  },

  // 获取用户权限
  getPermissions: async () => {
    try {
      return await authApi.getPermissions();
    } catch (_error) {
      console.error('权限获取失败:', _error);
      throw _error;
    }
  },
};

// 模拟登录函数（开发阶段使用）
const mockLogin = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // 模拟登录验证
  if (credentials.username === 'admin' && credentials.password === 'admin123') {
    const user: User = {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      displayName: '系统管理员',
      avatar: '',
      role: {
        id: 'admin',
        name: '系统管理员',
        description: '具有系统所有权限',
        level: 1,
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
      token: 'mock-jwt-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
      expiresIn: 3600, // 1小时
    };
  }
  
  // 模拟普通用户
  if (credentials.username === 'user' && credentials.password === 'user123') {
    const user: User = {
      id: '2',
      username: 'user',
      email: 'user@example.com',
      displayName: '普通用户',
      avatar: '',
      role: {
        id: 'user',
        name: '普通用户',
        description: '基础查看权限',
        level: 3,
      },
      permissions: [
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

        // 自动登录尝试 (使用已有的API结构)
        tryAutoLogin: async () => {
          const { isAuthenticated } = get();
          if (isAuthenticated) {
            return; // 已经登录，无需重复操作
          }
          
          try {
            const user = await authApi.getUser();
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