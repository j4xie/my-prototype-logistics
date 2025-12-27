/**
 * 认证状态管理
 * 注意：此文件不能导入其他 store 模块和 API 模块，避免循环依赖
 * API 调用使用动态导入
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types/auth';
import { isPlatformUser, isFactoryUser, ROLE_METADATA } from '@/types/auth';
// 注意：不在顶层导入 api/auth，改为在函数内动态导入

// 存储 Key
const TOKEN_KEY = 'cretas_access_token';
const REFRESH_TOKEN_KEY = 'cretas_refresh_token';
const USER_KEY = 'cretas_user';

export const useAuthStore = defineStore('auth', () => {
  // State
  const accessToken = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  const user = ref<User | null>(null);
  const loading = ref(false);

  // 初始化时尝试从 localStorage 恢复用户信息
  const storedUser = localStorage.getItem(USER_KEY);
  if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && typeof parsed === 'object') {
        user.value = parsed;
      }
    } catch (e) {
      console.error('Failed to parse stored user:', e);
      // 清理无效数据
      localStorage.removeItem(USER_KEY);
    }
  } else if (storedUser) {
    // 清理无效数据 (如 "undefined" 字符串)
    localStorage.removeItem(USER_KEY);
  }

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

  const currentRole = computed(() => {
    if (!user.value) return 'unactivated';
    if (isPlatformUser(user.value)) return user.value.platformUser?.role || 'unactivated';
    if (isFactoryUser(user.value)) return user.value.factoryUser?.role || 'unactivated';
    return 'unactivated';
  });

  const factoryId = computed(() => {
    if (!user.value) return '';
    if (isFactoryUser(user.value)) return user.value.factoryUser?.factoryId || '';
    return '';
  });

  const roleMetadata = computed(() => {
    const role = currentRole.value;
    return ROLE_METADATA[role] || ROLE_METADATA['viewer'];
  });

  const isPlatform = computed(() => isPlatformUser(user.value));
  const isFactory = computed(() => isFactoryUser(user.value));
  const userLevel = computed(() => roleMetadata.value?.level ?? 99);
  const department = computed(() => roleMetadata.value?.department ?? 'none');

  // Actions
  function setTokens(access: string, refresh: string) {
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }

  function setUser(userData: User) {
    user.value = userData;
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }

  function clearAuth() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function login(username: string, password: string): Promise<boolean> {
    loading.value = true;
    try {
      // 动态导入 API，避免循环依赖
      const { login: loginApi } = await import('@/api/auth');
      const response = await loginApi({ username, password });

      if (response.success && response.data) {
        const data = response.data;
        // 后端返回扁平结构：token/accessToken, refreshToken, 用户信息直接在 data 中
        const token = data.accessToken || data.token;
        const refresh = data.refreshToken;

        if (!token || !refresh) {
          console.error('Missing token in response:', data);
          return false;
        }

        setTokens(token, refresh);

        // 构建用户对象 - 后端返回的是工厂用户
        const userData: User = {
          id: data.userId,
          username: data.username,
          email: '',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userType: 'factory',
          factoryUser: {
            role: data.role,
            factoryId: data.factoryId,
            permissions: data.permissions || [],
          }
        } as User;
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      // 动态导入 API，避免循环依赖
      const { logout: logoutApi } = await import('@/api/auth');
      await logoutApi();
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      clearAuth();
    }
  }

  async function fetchCurrentUser(): Promise<boolean> {
    if (!accessToken.value) return false;

    try {
      // 动态导入 API，避免循环依赖
      const { getCurrentUser } = await import('@/api/auth');
      const response = await getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      return false;
    }
  }

  function hasRole(roles: string | string[]): boolean {
    const role = currentRole.value;
    if (Array.isArray(roles)) {
      return roles.includes(role);
    }
    return role === roles;
  }

  function hasMinLevel(minLevel: number): boolean {
    return userLevel.value <= minLevel;
  }

  return {
    // State
    accessToken,
    refreshToken,
    user,
    loading,

    // Getters
    isAuthenticated,
    currentRole,
    factoryId,
    roleMetadata,
    isPlatform,
    isFactory,
    userLevel,
    department,

    // Actions
    setTokens,
    setUser,
    clearAuth,
    login,
    logout,
    fetchCurrentUser,
    hasRole,
    hasMinLevel
  };
});
