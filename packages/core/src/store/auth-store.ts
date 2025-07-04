/**
 * 认证状态管理Store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { BaseStore, BaseState, BaseActions, StoreConfig } from './base-store';
import { IStorageAdapter } from '../utils/storage-adapter';
import { logger } from '../utils/logger';
import {
  User,
  AuthState,
  LoginCredentials,
  RegisterRequest,
  PasswordUpdateRequest,
  UserPreferences,
  AuthResponse,
  Permission,
  UserRole
} from '../types/auth';

/**
 * 认证状态接口（继承基础状态）
 */
export interface AuthStoreState extends BaseState {
  // 认证状态
  isAuthenticated: boolean;
  isInitialized: boolean;
  
  // 用户信息
  user: User | null;
  
  // 令牌信息
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  
  // 权限信息
  permissions: Permission[];
  features: string[];
  
  // 设备信息
  deviceId: string | null;
  sessionId: string | null;
}

/**
 * 认证操作接口
 */
export interface AuthStoreActions extends BaseActions {
  // 认证操作
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  
  // 用户管理
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  changePassword: (request: PasswordUpdateRequest) => Promise<void>;
  
  // 权限检查
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (role: string) => boolean;
  hasFeature: (feature: string) => boolean;
  
  // 状态管理
  setUser: (user: User | null) => void;
  setTokens: (token: string, refreshToken: string, expiresIn: number) => void;
  setPermissions: (permissions: Permission[]) => void;
  setFeatures: (features: string[]) => void;
  setDeviceId: (deviceId: string) => void;
  setSessionId: (sessionId: string) => void;
  
  // 初始化
  initialize: () => Promise<void>;
  checkTokenExpiry: () => boolean;
  
  // 会话管理
  extendSession: () => void;
  invalidateSession: () => void;
}

/**
 * 完整的认证Store状态类型
 */
export type AuthStoreType = AuthStoreState & AuthStoreActions;

/**
 * 认证Store类
 */
export class AuthStore extends BaseStore<AuthStoreType> {
  private authApi?: any; // 认证API接口，由外部注入

  constructor(config: StoreConfig, authApi?: any) {
    const initialState: AuthStoreState = {
      // 基础状态
      loading: false,
      error: null,
      lastUpdated: null,
      
      // 认证状态
      isAuthenticated: false,
      isInitialized: false,
      
      // 用户信息
      user: null,
      
      // 令牌信息
      token: null,
      refreshToken: null,
      tokenExpiresAt: null,
      
      // 权限信息
      permissions: [],
      features: [],
      
      // 设备信息
      deviceId: null,
      sessionId: null,
    };

    super(config, initialState);
    this.authApi = authApi;
  }

  /**
   * 创建Store实例
   */
  getStore() {
    if (this.store) {
      return this.store;
    }

    const middleware = [];

    // 开发工具中间件
    if (this.config.debug) {
      middleware.push(this.createDevtoolsMiddleware());
    }

    // 持久化中间件
    if (this.config.persist && this.config.storage) {
      middleware.push(
        persist(
          (set, get, api) => this.createStoreConfig(set, get, api),
          {
            name: `${this.config.name}-auth`,
            storage: {
              getItem: async (key: string) => {
                const data = await this.config.storage!.getData(key);
                return data ? JSON.stringify(data) : null;
              },
              setItem: async (key: string, value: string) => {
                await this.config.storage!.setData(key, JSON.parse(value));
              },
              removeItem: async (key: string) => {
                await this.config.storage!.removeItem(key);
              },
            },
            partialize: (state) => ({
              isAuthenticated: state.isAuthenticated,
              user: state.user,
              token: state.token,
              refreshToken: state.refreshToken,
              tokenExpiresAt: state.tokenExpiresAt,
              permissions: state.permissions,
              features: state.features,
              deviceId: state.deviceId,
              sessionId: state.sessionId,
            }),
            version: this.config.version || 1,
          }
        )
      );
    }

    // 创建Store
    this.store = create<AuthStoreType>()(
      // @ts-ignore
      devtools(
        middleware.length > 0
          ? middleware.reduce((acc, middleware) => middleware(acc), (set, get, api) => this.createStoreConfig(set, get, api))
          : (set, get, api) => this.createStoreConfig(set, get, api),
        {
          name: this.config.name,
          enabled: this.config.debug,
        }
      )
    );

    return this.store;
  }

  /**
   * 创建Store配置
   */
  private createStoreConfig(set: any, get: any, api: any): AuthStoreType {
    const baseActions = this.createBaseActions(set, get);

    return {
      ...this.getInitialState(),
      ...baseActions,

      // 认证操作
      login: async (credentials: LoginCredentials) => {
        return this.handleAsyncOperation(
          async () => {
            if (!this.authApi) {
              throw new Error('Auth API not configured');
            }

            const response: AuthResponse = await this.authApi.login(credentials);
            
            // 更新状态
            const expiresAt = Date.now() + response.expiresIn * 1000;
            
            set({
              isAuthenticated: true,
              user: response.user,
              token: response.token,
              refreshToken: response.refreshToken,
              tokenExpiresAt: expiresAt,
              permissions: response.user.permissions || [],
              features: response.features || [],
            }, false, 'auth/login/success');

            // 生成或更新设备ID和会话ID
            this.updateDeviceAndSession(set);

            logger.info('User logged in successfully', 'AuthStore', {
              userId: response.user.id,
              username: response.user.username,
            });

            // 设置自动令牌刷新
            this.scheduleTokenRefresh(response.expiresIn);
          },
          {
            context: 'login',
            successCallback: () => {
              // 登录成功后的额外操作
              get().updateTimestamp();
            },
          }
        );
      },

      logout: async () => {
        return this.handleAsyncOperation(
          async () => {
            if (this.authApi && this.authApi.logout) {
              await this.authApi.logout();
            }

            // 清除所有认证状态
            set({
              isAuthenticated: false,
              user: null,
              token: null,
              refreshToken: null,
              tokenExpiresAt: null,
              permissions: [],
              features: [],
              sessionId: null,
            }, false, 'auth/logout');

            logger.info('User logged out', 'AuthStore');
          },
          {
            context: 'logout',
          }
        );
      },

      register: async (request: RegisterRequest) => {
        return this.handleAsyncOperation(
          async () => {
            if (!this.authApi) {
              throw new Error('Auth API not configured');
            }

            const response: AuthResponse = await this.authApi.register(request);
            
            // 注册成功后自动登录
            const expiresAt = Date.now() + response.expiresIn * 1000;
            
            set({
              isAuthenticated: true,
              user: response.user,
              token: response.token,
              refreshToken: response.refreshToken,
              tokenExpiresAt: expiresAt,
              permissions: response.user.permissions || [],
              features: response.features || [],
            }, false, 'auth/register/success');

            logger.info('User registered successfully', 'AuthStore', {
              userId: response.user.id,
              username: response.user.username,
            });
          },
          {
            context: 'register',
          }
        );
      },

      refreshAccessToken: async () => {
        return this.handleAsyncOperation(
          async () => {
            const { refreshToken: currentRefreshToken, isAuthenticated } = get();
            
            if (!isAuthenticated || !currentRefreshToken) {
              throw new Error('No valid refresh token available');
            }

            if (!this.authApi) {
              throw new Error('Auth API not configured');
            }

            const response = await this.authApi.refreshToken(currentRefreshToken);
            const expiresAt = Date.now() + response.expiresIn * 1000;

            set({
              token: response.token,
              refreshToken: response.refreshToken || currentRefreshToken,
              tokenExpiresAt: expiresAt,
            }, false, 'auth/refreshToken/success');

            logger.info('Token refreshed successfully', 'AuthStore');

            // 重新安排下次刷新
            this.scheduleTokenRefresh(response.expiresIn);
          },
          {
            context: 'refreshToken',
            errorCallback: (error) => {
              // 刷新失败，强制登出
              logger.error('Token refresh failed, forcing logout', 'AuthStore', error);
              get().logout();
            },
          }
        );
      },

      updateProfile: async (updates: Partial<User>) => {
        return this.handleAsyncOperation(
          async () => {
            if (!this.authApi) {
              throw new Error('Auth API not configured');
            }

            const updatedUser = await this.authApi.updateProfile(updates);
            
            set((state: AuthStoreType) => ({
              user: state.user ? { ...state.user, ...updatedUser } : updatedUser,
            }), false, 'auth/updateProfile/success');

            logger.info('Profile updated successfully', 'AuthStore');
          },
          {
            context: 'updateProfile',
          }
        );
      },

      updatePreferences: async (preferences: Partial<UserPreferences>) => {
        return this.handleAsyncOperation(
          async () => {
            const { user } = get();
            if (!user) {
              throw new Error('No user logged in');
            }

            // 更新本地状态
            const updatedPreferences = { ...user.preferences, ...preferences };
            
            set((state: AuthStoreType) => ({
              user: state.user ? {
                ...state.user,
                preferences: updatedPreferences,
              } : null,
            }), false, 'auth/updatePreferences/success');

            // 如果有API，同步到服务器
            if (this.authApi && this.authApi.updatePreferences) {
              await this.authApi.updatePreferences(preferences);
            }

            logger.info('Preferences updated successfully', 'AuthStore');
          },
          {
            context: 'updatePreferences',
          }
        );
      },

      changePassword: async (request: PasswordUpdateRequest) => {
        return this.handleAsyncOperation(
          async () => {
            if (!this.authApi) {
              throw new Error('Auth API not configured');
            }

            await this.authApi.changePassword(request);
            
            logger.info('Password changed successfully', 'AuthStore');
          },
          {
            context: 'changePassword',
          }
        );
      },

      // 权限检查
      hasPermission: (resource: string, action: string): boolean => {
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

      hasRole: (role: string): boolean => {
        const { user, isAuthenticated } = get();
        return isAuthenticated && user?.role.id === role;
      },

      hasFeature: (feature: string): boolean => {
        const { features, isAuthenticated } = get();
        return isAuthenticated && features.includes(feature);
      },

      // 状态管理
      setUser: (user: User | null) => {
        set({ user }, false, 'auth/setUser');
      },

      setTokens: (token: string, refreshToken: string, expiresIn: number) => {
        const expiresAt = Date.now() + expiresIn * 1000;
        set({
          token,
          refreshToken,
          tokenExpiresAt: expiresAt,
        }, false, 'auth/setTokens');
      },

      setPermissions: (permissions: Permission[]) => {
        set({ permissions }, false, 'auth/setPermissions');
      },

      setFeatures: (features: string[]) => {
        set({ features }, false, 'auth/setFeatures');
      },

      setDeviceId: (deviceId: string) => {
        set({ deviceId }, false, 'auth/setDeviceId');
      },

      setSessionId: (sessionId: string) => {
        set({ sessionId }, false, 'auth/setSessionId');
      },

      // 初始化
      initialize: async () => {
        return this.handleAsyncOperation(
          async () => {
            const { token, isAuthenticated } = get();
            
            if (isAuthenticated && token) {
              // 检查令牌是否过期
              if (get().checkTokenExpiry()) {
                // 尝试刷新令牌
                await get().refreshAccessToken();
              }
              
              // 获取最新用户信息
              if (this.authApi && this.authApi.getCurrentUser) {
                try {
                  const user = await this.authApi.getCurrentUser();
                  set({ user }, false, 'auth/initialize/updateUser');
                } catch (error) {
                  logger.warn('Failed to get current user during initialization', 'AuthStore', error);
                }
              }
            }

            set({ isInitialized: true }, false, 'auth/initialize/complete');
          },
          {
            context: 'initialize',
          }
        );
      },

      checkTokenExpiry: (): boolean => {
        const { tokenExpiresAt } = get();
        if (!tokenExpiresAt) return false;
        
        // 提前5分钟检查过期
        const fiveMinutes = 5 * 60 * 1000;
        return Date.now() >= (tokenExpiresAt - fiveMinutes);
      },

      // 会话管理
      extendSession: () => {
        const { tokenExpiresAt } = get();
        if (tokenExpiresAt) {
          // 延长30分钟
          const extended = tokenExpiresAt + 30 * 60 * 1000;
          set({ tokenExpiresAt: extended }, false, 'auth/extendSession');
        }
      },

      invalidateSession: () => {
        set({
          sessionId: null,
          tokenExpiresAt: 0,
        }, false, 'auth/invalidateSession');
      },
    };
  }

  /**
   * 更新设备和会话信息
   */
  private updateDeviceAndSession(set: any) {
    const deviceId = this.generateDeviceId();
    const sessionId = this.generateSessionId();
    
    set({
      deviceId,
      sessionId,
    }, false, 'auth/updateDeviceAndSession');
  }

  /**
   * 生成设备ID
   */
  private generateDeviceId(): string {
    // 简单的设备ID生成，实际项目中可能需要更复杂的逻辑
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 安排令牌刷新
   */
  private scheduleTokenRefresh(expiresIn: number) {
    // 提前5分钟刷新令牌
    const refreshTime = Math.max(expiresIn * 1000 - 5 * 60 * 1000, 60 * 1000);
    
    setTimeout(() => {
      const store = this.getStore();
      const { isAuthenticated } = store.getState();
      
      if (isAuthenticated) {
        store.getState().refreshAccessToken();
      }
    }, refreshTime);
  }

  /**
   * 设置认证API
   */
  setAuthApi(authApi: any) {
    this.authApi = authApi;
  }
}

/**
 * 创建认证Store实例
 */
export function createAuthStore(
  config: Partial<StoreConfig> = {},
  authApi?: any,
  storage?: IStorageAdapter
): AuthStore {
  const storeConfig: StoreConfig = {
    name: 'auth-store',
    version: 1,
    persist: true,
    debug: process.env.NODE_ENV === 'development',
    storage,
    ...config,
  };

  return new AuthStore(storeConfig, authApi);
}

// 默认导出
export default AuthStore;