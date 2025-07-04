// 认证相关Hooks - 重点模块
import { useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import type { LoginCredentials, RegisterRequest, User } from '../types/auth';

// 主要认证Hook
export const useAuth = () => {
  const {
    isAuthenticated,
    user,
    token,
    permissions,
    loading,
    error,
    login,
    logout,
    register,
    refreshToken,
    updateProfile,
    hasPermission,
    hasRole,
    clearError
  } = useAuthStore();

  return {
    // 状态
    isAuthenticated,
    user,
    token,
    permissions,
    loading,
    error,

    // 操作
    login,
    logout,
    register,
    refreshToken,
    updateProfile,
    hasPermission,
    hasRole,
    clearError
  };
};

// 用户信息Hook
export const useUser = () => {
  const { user, updateProfile, loading, error } = useAuthStore();

  const updateUserProfile = useCallback(async (data: Partial<User>) => {
    try {
      await updateProfile(data);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }, [updateProfile]);

  return {
    user,
    updateProfile: updateUserProfile,
    loading,
    error
  };
};

// 权限检查Hook
export const usePermission = () => {
  const { permissions, hasPermission, hasRole } = useAuthStore();

  const checkPermission = useCallback((resource: string, action: string) => {
    return hasPermission(resource, action);
  }, [hasPermission]);

  const checkRole = useCallback((role: string) => {
    return hasRole(role);
  }, [hasRole]);

  const isAdmin = useCallback(() => {
    return hasRole('admin');
  }, [hasRole]);

  const canManage = useCallback((resource: string) => {
    return hasPermission(resource, 'manage') || isAdmin();
  }, [hasPermission, isAdmin]);

  return {
    permissions,
    checkPermission,
    checkRole,
    isAdmin,
    canManage
  };
};

// 角色管理Hook
export const useRole = () => {
  const { user, hasRole } = useAuthStore();

  const currentRole = user?.role;
  
  const isFarmer = useCallback(() => hasRole('farmer'), [hasRole]);
  const isProcessor = useCallback(() => hasRole('processor'), [hasRole]);
  const isLogistics = useCallback(() => hasRole('logistics'), [hasRole]);
  const isRetailer = useCallback(() => hasRole('retailer'), [hasRole]);
  const isConsumer = useCallback(() => hasRole('consumer'), [hasRole]);
  const isAdmin = useCallback(() => hasRole('admin'), [hasRole]);
  const isInspector = useCallback(() => hasRole('inspector'), [hasRole]);

  return {
    currentRole,
    isFarmer,
    isProcessor,
    isLogistics,
    isRetailer,
    isConsumer,
    isAdmin,
    isInspector
  };
};

// 登录Hook
export const useLogin = () => {
  const { login, loading, error, clearError } = useAuthStore();

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    try {
      clearError();
      await login(credentials);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }, [login, clearError]);

  return {
    login: handleLogin,
    loading,
    error,
    clearError
  };
};

// 注册Hook
export const useRegister = () => {
  const { register, loading, error, clearError } = useAuthStore();

  const handleRegister = useCallback(async (data: RegisterRequest) => {
    try {
      clearError();
      await register(data);
      return true;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    }
  }, [register, clearError]);

  return {
    register: handleRegister,
    loading,
    error,
    clearError
  };
};

// 登出Hook
export const useLogout = () => {
  const { logout } = useAuthStore();

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  return {
    logout: handleLogout
  };
};

// Token管理Hook
export const useToken = () => {
  const { token, refreshToken, setToken, clearToken, loading } = useAuthStore();

  const isTokenExpired = useCallback(() => {
    if (!token) return true;
    return new Date() >= new Date(token.expiresAt);
  }, [token]);

  const isTokenExpiringSoon = useCallback((thresholdMinutes: number = 5) => {
    if (!token) return true;
    const expiryTime = new Date(token.expiresAt);
    const currentTime = new Date();
    const timeDiff = expiryTime.getTime() - currentTime.getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    return minutesDiff <= thresholdMinutes;
  }, [token]);

  const refreshTokenIfNeeded = useCallback(async () => {
    if (isTokenExpiringSoon()) {
      try {
        await refreshToken();
        return true;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
      }
    }
    return true;
  }, [isTokenExpiringSoon, refreshToken]);

  return {
    token,
    isTokenExpired,
    isTokenExpiringSoon,
    refreshToken,
    refreshTokenIfNeeded,
    setToken,
    clearToken,
    loading
  };
};