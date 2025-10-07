/**
 * useLogin Hook - 登录逻辑封装（兼容EnhancedLoginScreen）
 */

import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuthStore } from '../store';
import { AuthServiceInstance as AuthService } from '../services/serviceFactory';

interface LoginParams {
  username: string;
  password: string;
  rememberMe?: boolean;
  biometricEnabled?: boolean;
}

interface UseLoginOptions {
  enableBiometric?: boolean;
  enableAutoLogin?: boolean;
  maxRetries?: number;
}

interface UseLoginReturn {
  login: (params: LoginParams) => Promise<boolean>;
  biometricLogin: () => Promise<boolean>;
  autoLogin: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  retryCount: number;
  networkStatus: boolean;
  biometricStatus: {
    available: boolean;
    isEnrolled: boolean;
  };
  userIdentification: {
    deviceId: string;
    userId: string | null;
  };
  clearError: () => void;
  retry: () => void;
  enableBiometricLogin: (username: string, password: string) => Promise<void>;
}

/**
 * 生成简单的设备ID
 */
function generateDeviceId(): string {
  return `device-${Platform.OS}-${Date.now()}`;
}

export function useLogin(options?: UseLoginOptions): UseLoginReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [networkStatus] = useState(true);
  const [biometricStatus] = useState({
    available: false,
    isEnrolled: false,
  });
  const [userIdentification] = useState({
    deviceId: generateDeviceId(),
    userId: null as string | null,
  });

  const { login: setAuthState } = useAuthStore();

  const login = async (params: LoginParams): Promise<boolean> => {
    const { username, password, rememberMe = false } = params;

    setIsLoading(true);
    setError(null);

    try {
      const deviceInfo = {
        deviceId: userIdentification.deviceId,
        deviceModel: 'Unknown',
        platform: Platform.OS as 'ios' | 'android',
        osVersion: Platform.Version.toString(),
        appVersion: '1.0.0',
      };

      const result = await AuthService.login({
        username: username.trim(),
        password: password.trim(),
        deviceInfo,
        biometricEnabled: rememberMe,
      });

      if (result.success && result.user && result.tokens) {
        setAuthState(result.user, {
          accessToken: result.tokens.accessToken || result.tokens.token || '',
          refreshToken: result.tokens.refreshToken || '',
          expiresIn: result.tokens.expiresIn || 86400,
          tokenType: result.tokens.tokenType || 'Bearer',
        });

        Alert.alert('登录成功', `欢迎回来，${result.user.username}！`);
        return true;
      } else {
        throw new Error(result.message || '登录失败');
      }
    } catch (err: any) {
      console.error('登录失败:', err);
      const errorMessage = err.message || '登录失败，请重试';
      setError(errorMessage);
      setRetryCount(prev => prev + 1);
      Alert.alert('登录失败', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const biometricLogin = async (): Promise<boolean> => {
    Alert.alert('提示', '生物识别登录功能暂未实现');
    return false;
  };

  const autoLogin = async (): Promise<boolean> => {
    console.log('自动登录功能暂未实现');
    return false;
  };

  const enableBiometricLogin = async (username: string, password: string) => {
    Alert.alert('提示', '生物识别功能暂未实现');
  };

  const clearError = () => {
    setError(null);
  };

  const retry = () => {
    setError(null);
    setRetryCount(0);
  };

  return {
    login,
    biometricLogin,
    autoLogin,
    isLoading,
    error,
    retryCount,
    networkStatus,
    biometricStatus,
    userIdentification,
    clearError,
    retry,
    enableBiometricLogin,
  };
}
