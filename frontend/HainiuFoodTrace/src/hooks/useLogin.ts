import React, { useState, useCallback } from 'react';
import { 
  AuthServiceInstance as AuthService,
  BiometricManagerInstance as BiometricManager,
  NetworkManagerInstance as NetworkManager,
  UserIdentificationServiceInstance as UserIdentificationService,
  TokenManagerInstance as TokenManager
} from '../services/serviceFactory';
import { useAuthStore } from '../store/authStore';
import { 
  LoginRequest, 
  LoginResponse, 
  BiometricAuthOptions, 
  UserRole,
  DeviceBindingInfo
} from '../types/auth';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export interface UseLoginOptions {
  enableBiometric?: boolean;
  enableAutoLogin?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface UseLoginReturn {
  // 登录方法
  login: (credentials: Omit<LoginRequest, 'deviceInfo'>) => Promise<boolean>;
  biometricLogin: (options?: BiometricAuthOptions) => Promise<boolean>;
  autoLogin: () => Promise<boolean>;
  
  // 状态
  isLoading: boolean;
  error: string | null;
  retryCount: number;
  networkStatus: 'online' | 'offline' | 'checking';
  
  // 生物识别状态
  biometricStatus: {
    available: boolean;
    enabled: boolean;
    type: string;
  };
  
  // 用户识别
  userIdentification: ReturnType<typeof UserIdentificationService.identifyUser> | null;
  
  // 控制方法
  clearError: () => void;
  retry: () => void;
  enableBiometricLogin: () => Promise<void>;
  disableBiometricLogin: () => Promise<void>;
}

export function useLogin(options: UseLoginOptions = {}): UseLoginReturn {
  const {
    enableBiometric = true,
    enableAutoLogin = true,
    maxRetries = 3,
    retryDelay = 2000
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [lastCredentials, setLastCredentials] = useState<LoginRequest | null>(null);
  const [userIdentification, setUserIdentification] = useState<ReturnType<typeof UserIdentificationService.identifyUser> | null>(null);
  
  const [biometricStatus, setBiometricStatus] = useState({
    available: false,
    enabled: false,
    type: '生物识别'
  });

  const { setUser, setPermissions, setFactory, setUserType, setAuthenticated } = useAuthStore();

  // 初始化网络状态监听
  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    const initializeNetworkMonitoring = async () => {
      await NetworkManager.initialize();
      
      unsubscribe = NetworkManager.addListener((state) => {
        setNetworkStatus(state.isConnected ? 'online' : 'offline');
      });
      
      // 获取初始状态
      const currentState = await NetworkManager.getCurrentState();
      setNetworkStatus(currentState.isConnected ? 'online' : 'offline');
    };

    initializeNetworkMonitoring().catch(console.error);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // 初始化生物识别状态
  React.useEffect(() => {
    const initializeBiometric = async () => {
      if (!enableBiometric) return;

      try {
        const capabilities = await BiometricManager.getCapabilities();
        const enabled = await BiometricManager.isBiometricLoginEnabled();
        const displayName = await BiometricManager.getBiometricTypeDisplayName();

        setBiometricStatus({
          available: capabilities.isAvailable,
          enabled,
          type: displayName
        });
      } catch (error) {
        console.error('Failed to initialize biometric status:', error);
      }
    };

    initializeBiometric();
  }, [enableBiometric]);

  /**
   * 获取设备信息
   */
  const getDeviceInfo = useCallback(async (): Promise<LoginRequest['deviceInfo']> => {
    try {
      // 获取真实的设备信息
      const deviceId = await Application.getAndroidId() || 
                      await Application.getIosIdForVendorAsync() ||
                      Device.osInternalBuildId ||
                      'device-' + Date.now(); // 降级方案
      
      return {
        deviceId,
        deviceModel: Device.modelName || Device.deviceName || 'Unknown Device',
        osVersion: Device.osVersion || Platform.Version.toString(),
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        platform: Platform.OS as 'ios' | 'android'
      };
    } catch (error) {
      console.error('Failed to get device info:', error);
      // 错误时返回降级信息
      return {
        deviceId: 'device-fallback-' + Date.now(),
        deviceModel: 'Unknown Device',
        osVersion: Platform.Version.toString(),
        appVersion: '1.0.0',
        platform: Platform.OS as 'ios' | 'android'
      };
    }
  }, []);

  /**
   * 处理登录成功
   */
  const handleLoginSuccess = useCallback(async (response: LoginResponse) => {
    if (response.user) {
      setUser(response.user);
      
      // 根据用户类型设置权限和工厂信息
      if (response.user.userType === 'platform') {
        const platformUser = response.user as any;
        setPermissions({
          modules: {
            farming_access: false,
            processing_access: false,
            logistics_access: false,
            trace_access: false,
            admin_access: false,
            platform_access: true,
          },
          features: platformUser.platformUser?.permissions || [],
          role: platformUser.platformUser?.role || 'platform_operator',
          userType: 'platform'
        });
        setUserType('platform');
      } else {
        const factoryUser = response.user as any;
        setPermissions({
          modules: {
            farming_access: true,
            processing_access: true,
            logistics_access: true,
            trace_access: true,
            admin_access: factoryUser.factoryUser?.role !== 'viewer',
            platform_access: false,
          },
          features: factoryUser.factoryUser?.permissions || [],
          role: factoryUser.factoryUser?.role || 'operator',
          userType: 'factory'
        });
        setUserType('factory');
        
        if (factoryUser.factoryUser?.factoryId) {
          setFactory({
            id: factoryUser.factoryUser.factoryId,
            name: '工厂名称', // 从API获取
            address: '工厂地址'
          });
        }
      }
    }
    
    setAuthenticated(true);
    setRetryCount(0);
    setError(null);
  }, [setUser, setPermissions, setFactory, setUserType, setAuthenticated]);

  /**
   * 处理登录错误
   */
  const handleLoginError = useCallback((error: any) => {
    console.error('Login error:', error);
    
    // 友好的错误信息映射
    const errorMessages: { [key: string]: string } = {
      'Network request failed': '网络连接失败，请检查网络设置',
      'timeout': '请求超时，请稍后重试',
      'ECONNREFUSED': '无法连接到服务器',
      'ENOTFOUND': '服务器地址无法访问',
      '用户名或密码错误': '用户名或密码错误，请检查后重试',
      '账户尚未激活': '您的账户尚未激活，请联系管理员',
      '工厂不存在': '所属工厂不存在或已停用',
      'Network not available': '网络连接不可用，请检查网络设置'
    };

    let errorMessage = error.message;
    for (const [key, value] of Object.entries(errorMessages)) {
      if (errorMessage?.includes(key)) {
        errorMessage = value;
        break;
      }
    }

    setError(errorMessage || '登录失败，请稍后重试');
  }, []);

  /**
   * 执行登录重试逻辑
   */
  const executeWithRetry = useCallback(async (
    operation: () => Promise<LoginResponse>,
    credentials?: LoginRequest
  ): Promise<boolean> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 检查网络状态
        if (networkStatus === 'offline') {
          const connected = await NetworkManager.waitForConnection(5000);
          if (!connected) {
            throw new Error('Network not available');
          }
        }

        const response = await operation();
        
        if (response.success) {
          await handleLoginSuccess(response);
          return true;
        } else {
          throw new Error(response.message || 'Login failed');
        }

      } catch (error: any) {
        console.error(`Login attempt ${attempt + 1} failed:`, error);
        
        // 检查是否应该重试
        const shouldRetry = attempt < maxRetries && 
          (error.message?.includes('Network') || 
           error.message?.includes('timeout') ||
           error.message?.includes('ECONNABORTED'));

        if (shouldRetry) {
          setRetryCount(attempt + 1);
          setError(`网络错误，正在重试 (${attempt + 1}/${maxRetries})`);
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(1.5, attempt)));
        } else {
          handleLoginError(error);
          setRetryCount(0);
          return false;
        }
      }
    }

    return false;
  }, [maxRetries, retryDelay, networkStatus, handleLoginSuccess, handleLoginError]);

  /**
   * 普通登录
   */
  const login = useCallback(async (
    credentials: Omit<LoginRequest, 'deviceInfo'>
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 用户识别
      const identification = UserIdentificationService.identifyUser(credentials.username);
      setUserIdentification(identification);

      // 构造完整的登录请求
      const deviceInfo = await getDeviceInfo();
      const loginRequest: LoginRequest = {
        ...credentials,
        deviceInfo,
        biometricEnabled: enableBiometric && biometricStatus.available
      };

      setLastCredentials(loginRequest);

      const success = await executeWithRetry(() => AuthService.login(loginRequest), loginRequest);

      // 如果登录成功且启用了生物识别，询问是否保存凭据
      if (success && enableBiometric && biometricStatus.available && !biometricStatus.enabled) {
        try {
          await BiometricManager.enableBiometricLogin();
          setBiometricStatus(prev => ({ ...prev, enabled: true }));
        } catch (biometricError) {
          console.error('Failed to enable biometric login:', biometricError);
          // 不影响登录流程，只是记录错误
        }
      }

      return success;

    } catch (error) {
      handleLoginError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [
    enableBiometric, 
    biometricStatus, 
    getDeviceInfo, 
    executeWithRetry, 
    handleLoginError
  ]);

  /**
   * 生物识别登录
   */
  const biometricLogin = useCallback(async (
    options: BiometricAuthOptions = {}
  ): Promise<boolean> => {
    if (!biometricStatus.available || !biometricStatus.enabled) {
      setError('生物识别登录不可用');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await executeWithRetry(() => 
        AuthService.biometricLogin(options)
      );
      return success;
    } catch (error) {
      handleLoginError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [biometricStatus, executeWithRetry, handleLoginError]);

  /**
   * 自动登录
   */
  const autoLogin = useCallback(async (): Promise<boolean> => {
    if (!enableAutoLogin) return false;

    setIsLoading(true);
    setError(null);

    try {
      // 检查是否有有效的token
      const hasValidToken = await TokenManager.getValidToken();
      if (!hasValidToken) {
        return false;
      }

      // 验证认证状态
      const authStatus = await AuthService.checkAuthStatus();
      if (authStatus.isAuthenticated && authStatus.user) {
        await handleLoginSuccess({
          success: true,
          message: 'Auto login successful',
          user: authStatus.user
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Auto login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [enableAutoLogin, handleLoginSuccess]);

  /**
   * 启用生物识别登录
   */
  const enableBiometricLogin = useCallback(async (): Promise<void> => {
    try {
      await BiometricManager.enableBiometricLogin();
      setBiometricStatus(prev => ({ ...prev, enabled: true }));
    } catch (error) {
      console.error('Failed to enable biometric login:', error);
      throw error;
    }
  }, []);

  /**
   * 禁用生物识别登录
   */
  const disableBiometricLogin = useCallback(async (): Promise<void> => {
    try {
      await BiometricManager.disableBiometricLogin();
      setBiometricStatus(prev => ({ ...prev, enabled: false }));
    } catch (error) {
      console.error('Failed to disable biometric login:', error);
      throw error;
    }
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  /**
   * 重试登录
   */
  const retry = useCallback(async () => {
    if (lastCredentials) {
      const { deviceInfo, ...credentials } = lastCredentials;
      await login(credentials);
    }
  }, [lastCredentials, login]);

  return {
    // 登录方法
    login,
    biometricLogin,
    autoLogin,
    
    // 状态
    isLoading,
    error,
    retryCount,
    networkStatus,
    biometricStatus,
    userIdentification,
    
    // 控制方法
    clearError,
    retry,
    enableBiometricLogin,
    disableBiometricLogin
  };
}