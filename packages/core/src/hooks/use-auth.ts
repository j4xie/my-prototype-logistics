/**
 * 认证相关Hooks
 */

import { useCallback, useEffect } from 'react';
import { AuthStore, createAuthStore } from '../store/auth-store';
import { LoginCredentials, RegisterRequest, User, Permission } from '../types/auth';

// 全局认证Store实例
let authStoreInstance: AuthStore | null = null;

/**
 * 获取或创建认证Store实例
 */
function getAuthStore(): AuthStore {
  if (!authStoreInstance) {
    authStoreInstance = createAuthStore();
  }
  return authStoreInstance;
}

/**
 * 认证状态Hook
 */
export function useAuth() {
  const store = getAuthStore().getStore();
  
  const {
    isAuthenticated,
    isInitialized,
    user,
    loading,
    error,
    login,
    logout,
    register,
    updateProfile,
    changePassword,
    hasPermission,
    hasRole,
    hasFeature,
    clearError,
    initialize,
  } = store();

  // 自动初始化
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  return {
    // 状态
    isAuthenticated,
    isInitialized,
    user,
    loading,
    error,
    
    // 操作
    login,
    logout,
    register,
    updateProfile,
    changePassword,
    clearError,
    
    // 权限检查
    hasPermission,
    hasRole,
    hasFeature,
  };
}

/**
 * 用户信息Hook
 */
export function useUser(): User | null {
  const store = getAuthStore().getStore();
  return store(state => state.user);
}

/**
 * 权限检查Hook
 */
export function usePermission(resource: string, action: string): boolean {
  const store = getAuthStore().getStore();
  return store(state => state.hasPermission(resource, action));
}

/**
 * 角色检查Hook
 */
export function useRole(role: string): boolean {
  const store = getAuthStore().getStore();
  return store(state => state.hasRole(role));
}

/**
 * 功能检查Hook
 */
export function useFeature(feature: string): boolean {
  const store = getAuthStore().getStore();
  return store(state => state.hasFeature(feature));
}

/**
 * 登录Hook
 */
export function useLogin() {
  const store = getAuthStore().getStore();
  const { login, loading, error, clearError } = store();

  const loginWithCredentials = useCallback(async (credentials: LoginCredentials) => {
    clearError();
    await login(credentials);
  }, [login, clearError]);

  return {
    login: loginWithCredentials,
    loading,
    error,
    clearError,
  };
}

/**
 * 注册Hook
 */
export function useRegister() {
  const store = getAuthStore().getStore();
  const { register, loading, error, clearError } = store();

  const registerUser = useCallback(async (request: RegisterRequest) => {
    clearError();
    await register(request);
  }, [register, clearError]);

  return {
    register: registerUser,
    loading,
    error,
    clearError,
  };
}

/**
 * 登出Hook
 */
export function useLogout() {
  const store = getAuthStore().getStore();
  const { logout, loading } = store();

  const logoutUser = useCallback(async () => {
    await logout();
  }, [logout]);

  return {
    logout: logoutUser,
    loading,
  };
}

/**
 * 用户资料更新Hook
 */
export function useUpdateProfile() {
  const store = getAuthStore().getStore();
  const { updateProfile, loading, error, clearError } = store();

  const updateUserProfile = useCallback(async (updates: Partial<User>) => {
    clearError();
    await updateProfile(updates);
  }, [updateProfile, clearError]);

  return {
    updateProfile: updateUserProfile,
    loading,
    error,
    clearError,
  };
}

/**
 * 权限列表Hook
 */
export function usePermissions(): Permission[] {
  const store = getAuthStore().getStore();
  return store(state => state.permissions);
}

/**
 * 认证状态Hook（仅状态）
 */
export function useAuthState() {
  const store = getAuthStore().getStore();
  
  return store(state => ({
    isAuthenticated: state.isAuthenticated,
    isInitialized: state.isInitialized,
    loading: state.loading,
    error: state.error,
  }));
}

/**
 * 认证操作Hook（仅操作）
 */
export function useAuthActions() {
  const store = getAuthStore().getStore();
  
  return store(state => ({
    login: state.login,
    logout: state.logout,
    register: state.register,
    updateProfile: state.updateProfile,
    changePassword: state.changePassword,
    clearError: state.clearError,
  }));
}

/**
 * 设置认证API
 */
export function setAuthApi(authApi: any) {
  const authStore = getAuthStore();
  authStore.setAuthApi(authApi);
}

/**
 * 重置认证Store
 */
export function resetAuthStore() {
  if (authStoreInstance) {
    authStoreInstance.destroy();
    authStoreInstance = null;
  }
}

// 默认导出
export default useAuth;