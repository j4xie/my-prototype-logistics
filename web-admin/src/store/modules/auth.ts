/**
 * 认证状态管理
 *
 * Auth strategy:
 *   Tokens are stored in HttpOnly cookies (set by the server).
 *   JavaScript cannot read them — this is intentional (XSS protection).
 *   User info (non-sensitive) is kept in localStorage for fast hydration.
 *   `isAuthenticated` is derived from having user info in memory;
 *   if the cookie has expired the next API call will 401 and redirect to login.
 *
 * Note: This file must not import other store modules or API modules at the
 * top level to avoid circular dependencies. Use dynamic imports inside functions.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types/auth';
import { isPlatformUser, isFactoryUser, ROLE_METADATA } from '@/types/auth';

// localStorage keys (only for non-sensitive user info)
const USER_KEY = 'cretas_user';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const loading = ref(false);

  // 初始化时尝试从 localStorage 恢复用户信息 (non-sensitive)
  const storedUser = localStorage.getItem(USER_KEY);
  if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && typeof parsed === 'object') {
        user.value = parsed;
      }
    } catch (e) {
      console.error('Failed to parse stored user:', e);
      localStorage.removeItem(USER_KEY);
    }
  } else if (storedUser) {
    localStorage.removeItem(USER_KEY);
  }

  // Getters
  // Since tokens are in HttpOnly cookies (not readable by JS), we check user info.
  // If the cookie expired, the next API call will 401 and the interceptor redirects to login.
  const isAuthenticated = computed(() => !!user.value);

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

  const factoryType = computed(() => {
    if (!user.value) return '';
    if (isFactoryUser(user.value)) return user.value.factoryUser?.factoryType || 'FACTORY';
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
  function setUser(userData: User) {
    user.value = userData;
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }

  function clearAuth() {
    user.value = null;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('cretas_access_token');
    // Note: HttpOnly cookies are cleared by the server on logout
  }

  async function login(username: string, password: string): Promise<boolean> {
    loading.value = true;
    try {
      // 动态导入 API，避免循环依赖
      const { login: loginApi } = await import('@/api/auth');
      const response = await loginApi({ username, password });

      if (response.success && response.data) {
        const data = response.data;
        // Store token in localStorage as fallback for when HttpOnly cookies
        // don't work (e.g. certain browser policies, cross-origin scenarios).
        // The request interceptor reads this and sets the Authorization header.
        if (data.token || data.accessToken) {
          localStorage.setItem('cretas_access_token', data.token || data.accessToken);
        }

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
            factoryType: data.factoryType || 'FACTORY',
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
      // The backend clears HttpOnly cookies via Set-Cookie: Max-Age=0
      const { logout: logoutApi } = await import('@/api/auth');
      await logoutApi();
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      clearAuth();
    }
  }

  async function fetchCurrentUser(): Promise<boolean> {
    try {
      // 动态导入 API，避免循环依赖
      // Auth cookie is sent automatically via withCredentials
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
    user,
    loading,

    // Getters
    isAuthenticated,
    currentRole,
    factoryId,
    factoryType,
    roleMetadata,
    isPlatform,
    isFactory,
    userLevel,
    department,

    // Actions
    setUser,
    clearAuth,
    login,
    logout,
    fetchCurrentUser,
    hasRole,
    hasMinLevel
  };
});
