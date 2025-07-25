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
import type { UserPermissions, ModulePermission } from '@/types/permissions';
import { generateUserPermissions, USER_ROLES, DEPARTMENTS, MODULE_PERMISSIONS, PermissionChecker } from '@/types/permissions';
import { PreviewModeManager, type PreviewUser } from '@/utils/previewMode';

/**
 * 处理用户数据 - 统一处理真实API和Mock API的用户数据
 */
async function processUserData(
  userData: any, 
  token: string, 
  refreshToken?: string, 
  expiresIn?: number
): Promise<AuthResponse> {
  // 处理新的模块级权限结构
  const userRole = userData.roleCode || userData.role?.name || userData.role;
  const department = userData.department;
  
  // 确定用户角色
  let mappedRole: keyof typeof USER_ROLES;
  if (typeof userRole === 'string') {
    // 映射旧角色到新角色
    switch (userRole) {
      case 'platform_admin':
      case 'PLATFORM_ADMIN':
        mappedRole = 'PLATFORM_ADMIN';
        break;
      case 'super_admin':
      case 'SUPER_ADMIN':
        mappedRole = 'SUPER_ADMIN';
        break;
      case 'permission_admin':
      case 'PERMISSION_ADMIN':
        mappedRole = 'PERMISSION_ADMIN';
        break;
      case 'department_admin':
      case 'DEPARTMENT_ADMIN':
        mappedRole = 'DEPARTMENT_ADMIN';
        break;
      case 'admin':
        mappedRole = 'SUPER_ADMIN';
        break;
      default:
        mappedRole = 'USER';
    }
  } else {
    mappedRole = 'USER';
  }

  // 映射部门
  let mappedDepartment: keyof typeof DEPARTMENTS | undefined;
  if (department && typeof department === 'string') {
    const departmentMap: Record<string, keyof typeof DEPARTMENTS> = {
      'farming': 'FARMING',
      'processing': 'PROCESSING', 
      'logistics': 'LOGISTICS',
      'quality': 'QUALITY',
      'management': 'MANAGEMENT',
      'admin': 'ADMIN'
    };
    mappedDepartment = departmentMap[department];
  }

  // 生成新的权限结构
  console.log(`[AuthStore] 生成权限: role=${mappedRole}, department=${mappedDepartment}`);
  const newPermissions = generateUserPermissions(mappedRole, mappedDepartment);

  // 生成兼容的旧权限结构
  const legacyPermissions = [];
  if (newPermissions.modules.farming_access) {
    legacyPermissions.push({ id: '1', name: '养殖管理', resource: 'farming', action: 'manage' });
  }
  if (newPermissions.modules.processing_access) {
    legacyPermissions.push({ id: '2', name: '生产管理', resource: 'processing', action: 'manage' });
  }
  if (newPermissions.modules.logistics_access) {
    legacyPermissions.push({ id: '3', name: '物流管理', resource: 'logistics', action: 'manage' });
  }
  if (newPermissions.modules.admin_access) {
    legacyPermissions.push({ id: '4', name: '系统管理', resource: 'admin', action: 'manage' });
  }
  if (newPermissions.modules.platform_access) {
    legacyPermissions.push({ id: '0', name: '平台管理', resource: 'platform', action: 'manage' });
  }

  const roleDisplayNames = {
    'PLATFORM_ADMIN': '平台管理员',
    'SUPER_ADMIN': '工厂超级管理员',
    'PERMISSION_ADMIN': '权限管理员',
    'DEPARTMENT_ADMIN': '部门管理员',
    'USER': '普通员工'
  };

  return {
    user: {
      id: String(userData.id || '1'),
      username: userData.username,
      email: userData.email || '',
      displayName: userData.fullName || userData.name || userData.username,
      avatar: userData.avatar || '',
      role: {
        id: mappedRole,
        name: roleDisplayNames[mappedRole],
        description: `角色级别: ${newPermissions.roleLevel}`,
        level: newPermissions.roleLevel,
      },
      permissions: newPermissions,
      legacyPermissions,
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    },
    token,
    refreshToken: refreshToken || 'mock-refresh-token',
    expiresIn: expiresIn || 3600,
  };
}

/**
 * 将预览用户转换为AuthResponse格式
 */
function convertPreviewUserToAuthResponse(previewUser: PreviewUser): AuthResponse {
  return {
    user: {
      id: previewUser.id,
      username: previewUser.username,
      email: previewUser.email,
      displayName: previewUser.displayName,
      avatar: '',
      role: previewUser.role,
      permissions: previewUser.permissions,
      legacyPermissions: previewUser.legacyPermissions,
      createdAt: previewUser.createdAt,
      lastLoginAt: previewUser.lastLoginAt,
    },
    token: 'preview_mode_token_' + Date.now(),
    refreshToken: 'preview_mode_refresh_token_' + Date.now(),
    expiresIn: 8 * 60 * 60, // 8小时
  };
}

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
      console.log('[AuthStore] 登录响应:', response);

      // 处理真实API响应格式 {success: true, data: {user: {...}, token: '...'}}
      if (response?.success && response?.data) {
        const { user: userData, token, refreshToken, expiresIn } = response.data;
        console.log('[AuthStore] 真实API登录成功:', userData);
        
        return await processUserData(userData, token, refreshToken, expiresIn);
      }
      
      // 处理Mock API响应格式 {user: {...}, token: '...', sessionId: '...'}
      if (response?.user && response?.token) {
        const { user: userData, token, refreshToken, expiresIn } = response;
        console.log('[AuthStore] Mock API登录成功:', userData);
        
        return await processUserData(userData, token, refreshToken, expiresIn);
      }
      
      // 兼容旧格式
      if (response?.data?.token || response?.token) {
        const token = response.data?.token || response.token;
        const userData = response.data?.user || response.user || response;
        
        return await processUserData(userData, token);
      }

      throw new Error('登录响应格式无效');
    } catch (error) {
      console.error('[AuthStore] 登录失败:', error);
      // 不再退回到Mock API，直接抛出错误
      throw error;
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
        permissions: generateUserPermissions('USER'),
        legacyPermissions: [],
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
    const permissions = generateUserPermissions('PLATFORM_ADMIN');
    const legacyPermissions = [
      { id: '0', name: '平台管理', resource: 'platform', action: 'manage' },
      { id: '1', name: '农业管理', resource: 'farming', action: 'manage' },
      { id: '2', name: '加工管理', resource: 'processing', action: 'manage' },
      { id: '3', name: '物流管理', resource: 'logistics', action: 'manage' },
      { id: '4', name: '系统管理', resource: 'admin', action: 'manage' },
      { id: '5', name: '溯源查询', resource: 'trace', action: 'read' },
    ];

    const user: User = {
      id: '0',
      username: 'super_admin',
      email: 'super@heiniu.com',
      displayName: '平台超级管理员',
      avatar: '',
      role: {
        id: 'platform_admin',
        name: '平台超级管理员',
        description: '平台最高权限，管理所有工厂租户',
        level: 0,
      },
      permissions,
      legacyPermissions,
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
    const permissions = generateUserPermissions('SUPER_ADMIN');
    const legacyPermissions = [
      { id: '1', name: '农业管理', resource: 'farming', action: 'manage' },
      { id: '2', name: '加工管理', resource: 'processing', action: 'manage' },
      { id: '3', name: '物流管理', resource: 'logistics', action: 'manage' },
      { id: '4', name: '系统管理', resource: 'admin', action: 'manage' },
      { id: '5', name: '溯源查询', resource: 'trace', action: 'read' },
    ];

    const user: User = {
      id: '1',
      username: 'user',
      email: 'user@heiniu.com',
      displayName: '工厂超级管理员',
      avatar: '',
      role: {
        id: 'super_admin',
        name: '工厂超级管理员',
        description: '工厂管理和操作权限',
        level: 0,
      },
      permissions,
      legacyPermissions,
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

  // 模拟权限管理员登录
  if (credentials.username === 'admin' && credentials.password === 'admin123') {
    const permissions = generateUserPermissions('PERMISSION_ADMIN');
    const legacyPermissions = [
      { id: '4', name: '系统管理', resource: 'admin', action: 'manage' }
    ];

    const user: User = {
      id: '2',
      username: 'admin',
      email: 'admin@heiniu.com',
      displayName: '权限管理员',
      avatar: '',
      role: {
        id: 'permission_admin',
        name: '权限管理员',
        description: '管理用户权限和角色分配',
        level: 5,
      },
      permissions,
      legacyPermissions,
      createdAt: '2025-01-01T00:00:00Z',
      lastLoginAt: new Date().toISOString(),
    };

    return {
      user,
      token: 'mock-jwt-token-admin-' + Date.now(),
      refreshToken: 'mock-refresh-token-admin-' + Date.now(),
      expiresIn: 3600,
    };
  }

  // 模拟部门管理员登录
  if (credentials.username === 'dept_admin' && credentials.password === 'dept123') {
    const permissions = generateUserPermissions('DEPARTMENT_ADMIN', 'FARMING');
    const legacyPermissions = [
      { id: '1', name: '农业管理', resource: 'farming', action: 'manage' }
    ];

    const user: User = {
      id: '3',
      username: 'dept_admin',
      email: 'dept@heiniu.com',
      displayName: '养殖部门管理员',
      avatar: '',
      role: {
        id: 'department_admin',
        name: '部门管理员',
        description: '管理本部门的人员和业务',
        level: 10,
      },
      permissions,
      legacyPermissions,
      createdAt: '2025-01-01T00:00:00Z',
      lastLoginAt: new Date().toISOString(),
    };

    return {
      user,
      token: 'mock-jwt-token-dept-' + Date.now(),
      refreshToken: 'mock-refresh-token-dept-' + Date.now(),
      expiresIn: 3600,
    };
  }

  // 模拟普通员工登录
  if (credentials.username === 'worker' && credentials.password === 'worker123') {
    const permissions = generateUserPermissions('USER', 'PROCESSING');
    const legacyPermissions = [
      { id: '2', name: '加工管理', resource: 'processing', action: 'read' }
    ];

    const user: User = {
      id: '4',
      username: 'worker',
      email: 'worker@heiniu.com',
      displayName: '生产部员工',
      avatar: '',
      role: {
        id: 'user',
        name: '普通员工',
        description: '操作层面的业务处理',
        level: 50,
      },
      permissions,
      legacyPermissions,
      createdAt: '2025-01-01T00:00:00Z',
      lastLoginAt: new Date().toISOString(),
    };

    return {
      user,
      token: 'mock-jwt-token-worker-' + Date.now(),
      refreshToken: 'mock-refresh-token-worker-' + Date.now(),
      expiresIn: 3600,
    };
  }

  throw new Error('用户名或密码错误。可用账户：super_admin/super123, user/user123, admin/admin123, dept_admin/dept123, worker/worker123');
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
              permissions: response.user.legacyPermissions || [],
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

        // 预览模式登录
        loginWithPreviewMode: async () => {
          set({ loading: true, error: null }, false, 'auth/preview/start');

          try {
            // 检查预览模式是否已启用
            if (!PreviewModeManager.isPreviewMode()) {
              throw new Error('预览模式未启用');
            }

            // 获取或创建预览用户
            let previewUser = PreviewModeManager.getPreviewUser();
            if (!previewUser) {
              previewUser = PreviewModeManager.createPreviewUser();
              PreviewModeManager.setPreviewUser(previewUser);
            }

            // 转换为AuthResponse格式
            const response = convertPreviewUserToAuthResponse(previewUser);
            const expiresAt = Date.now() + response.expiresIn * 1000;

            set({
              isAuthenticated: true,
              user: response.user,
              token: response.token,
              refreshToken: response.refreshToken,
              tokenExpiresAt: expiresAt,
              permissions: response.user.legacyPermissions || [],
              loading: false,
              error: null,
            }, false, 'auth/preview/success');

            console.log('✅ 预览模式登录成功:', response.user.displayName);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '预览模式登录失败';
            set({
              loading: false,
              error: errorMessage,
            }, false, 'auth/preview/error');

            console.error('❌ 预览模式登录失败:', errorMessage);
            throw error;
          }
        },

        // 检查预览模式
        checkPreviewMode: () => {
          // 检查是否处于预览模式
          const isPreviewMode = PreviewModeManager.isPreviewMode();
          
          if (isPreviewMode) {
            // 检查是否已过期
            if (PreviewModeManager.isExpired()) {
              console.log('[PreviewMode] 预览模式已过期，清理状态');
              PreviewModeManager.disablePreviewMode();
              get().logout();
              return false;
            }

            // 如果未登录，自动使用预览模式登录
            const { isAuthenticated } = get();
            if (!isAuthenticated) {
              console.log('[PreviewMode] 检测到预览模式，自动登录');
              get().loginWithPreviewMode().catch(error => {
                console.error('[PreviewMode] 自动登录失败:', error);
                PreviewModeManager.disablePreviewMode();
              });
            }

            return true;
          }

          return false;
        },

        // 用户登出
        logout: () => {
          // 检查是否为预览模式，如果是则清理预览状态
          if (PreviewModeManager.isPreviewMode()) {
            PreviewModeManager.disablePreviewMode();
            console.log('🚪 预览模式已退出');
          }

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
              permissions: response.user.legacyPermissions || [],
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

        // 检查用户权限 (兼容新旧权限结构)
        checkPermission: (resource: string, action: string): boolean => {
          const { user, isAuthenticated } = get();

          if (!isAuthenticated || !user) {
            return false;
          }

          // 优先使用新权限结构
          if (user.permissions) {
            const moduleMap = {
              'farming': MODULE_PERMISSIONS.FARMING_ACCESS,
              'processing': MODULE_PERMISSIONS.PROCESSING_ACCESS,
              'logistics': MODULE_PERMISSIONS.LOGISTICS_ACCESS,
              'admin': MODULE_PERMISSIONS.ADMIN_ACCESS,
              'platform': MODULE_PERMISSIONS.PLATFORM_ACCESS
            };

            const moduleKey = moduleMap[resource as keyof typeof moduleMap];
            if (moduleKey && user.permissions.modules[moduleKey]) {
              return true;
            }

            // 平台管理员拥有所有权限
            if (user.permissions.role === 'PLATFORM_ADMIN') {
              return true;
            }

            // 工厂超级管理员拥有除平台外的所有权限
            if (user.permissions.role === 'SUPER_ADMIN' && resource !== 'platform') {
              return true;
            }
          }

          // 向后兼容：使用旧权限结构
          if (user.legacyPermissions) {
            return user.legacyPermissions.some(permission => {
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
          }

          return false;
        },

        // 新增：检查模块权限
        checkModuleAccess: (module: string): boolean => {
          const { user, isAuthenticated } = get();

          if (!isAuthenticated || !user?.permissions) {
            return false;
          }

          // 转换为正确的模块权限类型
          const moduleMap: Record<string, keyof typeof MODULE_PERMISSIONS> = {
            'farming': 'FARMING_ACCESS',
            'processing': 'PROCESSING_ACCESS',
            'logistics': 'LOGISTICS_ACCESS',
            'admin': 'ADMIN_ACCESS',
            'platform': 'PLATFORM_ACCESS'
          };

          const moduleKey = moduleMap[module];
          if (!moduleKey) return false;

          return PermissionChecker.hasModuleAccess(user.permissions, moduleKey);
        },

        // 新增：检查功能权限
        checkFeaturePermission: (feature: string): boolean => {
          const { user, isAuthenticated } = get();

          if (!isAuthenticated || !user?.permissions) {
            return false;
          }

          return PermissionChecker.hasFeaturePermission(user.permissions, feature);
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

          // 首先检查预览模式
          if (get().checkPreviewMode()) {
            return; // 预览模式已处理登录
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

// 导出模块权限检查Hook
export const useModuleAccess = (module: string) => {
  return useAuthStore(state => state.checkModuleAccess(module));
};

// 导出功能权限检查Hook
export const useFeaturePermission = (feature: string) => {
  return useAuthStore(state => state.checkFeaturePermission(feature));
};

// 导出actions的便捷函数
export const authActions = {
  login: () => useAuthStore.getState().login,
  logout: () => useAuthStore.getState().logout,
  loginWithPreviewMode: () => useAuthStore.getState().loginWithPreviewMode,
  checkPreviewMode: () => useAuthStore.getState().checkPreviewMode,
  updateProfile: () => useAuthStore.getState().updateProfile,
  checkPermission: () => useAuthStore.getState().checkPermission,
  checkModuleAccess: () => useAuthStore.getState().checkModuleAccess,
  checkFeaturePermission: () => useAuthStore.getState().checkFeaturePermission,
  clearError: () => useAuthStore.getState().clearError,
};
