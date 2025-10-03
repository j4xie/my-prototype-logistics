import { apiClient } from '../api/apiClient';
import { StorageService } from '../storage/storageService';
import { TokenManager } from '../tokenManager';
import { BiometricManager } from '../biometricManager';
import { NetworkManager } from '../networkManager';
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterPhaseOneRequest, 
  RegisterPhaseTwoRequest,
  RegisterResponse,
  User, 
  AuthTokens,
  BiometricAuthOptions,
  UserRole,
  USER_ROLES,
  PLATFORM_ROLES,
  FACTORY_ROLES
} from '../../types/auth';
import { transformBackendUser, getUserRole } from '../../utils/roleMapping';

export class AuthService {
  // 登录方法
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('开始登录流程:', { username: credentials.username });
      
      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      const response = await NetworkManager.executeWithRetry(
        () => apiClient.post<LoginResponse>('/mobile/auth/unified-login', {
          username: credentials.username,
          password: credentials.password,
          deviceInfo: credentials.deviceInfo
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.user && response.tokens) {
        // 转换后端用户数据为前端格式
        const transformedUser = transformBackendUser(response.user);
        
        // 使用TokenManager保存认证信息
        const tokenData = {
          accessToken: response.tokens.token || response.tokens.accessToken,
          refreshToken: response.tokens.refreshToken,
          tempToken: response.tokens.tempToken,
          expiresAt: Date.now() + (response.tokens.expiresIn || 86400) * 1000, // 默认24小时
          tokenType: response.tokens.tokenType || 'Bearer'
        };
        
        await TokenManager.storeTokens(tokenData);
        await this.saveUserInfo(transformedUser);
        
        // 如果启用了生物识别且设备支持，询问是否保存凭据
        if (credentials.biometricEnabled) {
          const canUseBiometric = await BiometricManager.isAvailable();
          if (canUseBiometric) {
            await BiometricManager.saveBiometricCredentials({
              username: credentials.username,
              encryptedToken: response.tokens.accessToken,
              deviceInfo: credentials.deviceInfo
            });
          }
        }
        
        console.log('登录成功:', { 
          userId: transformedUser.id, 
          role: getUserRole(transformedUser),
          userType: transformedUser.userType
        });
        
        // 返回转换后的用户数据
        response.user = transformedUser;
      }

      return response;
    } catch (error) {
      console.error('登录失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 发送验证码
  static async sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>('/api/mobile/auth/send-verification', {
        phoneNumber,
        verificationType: 'registration'
      });
      return response;
    } catch (error) {
      console.error('发送验证码失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 验证手机号和验证码
  static async verifyPhoneNumber(request: {
    phoneNumber: string;
    verificationCode: string;
    verificationType: 'registration' | 'reset';
  }): Promise<{
    success: boolean;
    message?: string;
    tempToken?: string;
    factoryId?: string;
    whitelistInfo?: any;
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message?: string;
        tempToken?: string;
        factoryId?: string;
        whitelistInfo?: any;
      }>('/api/auth/verify-phone', request);
      
      if (response.tempToken) {
        await StorageService.setSecureItem('temp_token', response.tempToken);
      }
      
      return response;
    } catch (error) {
      console.error('验证手机号失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 注册第一阶段 - 手机验证
  static async registerPhaseOne(request: RegisterPhaseOneRequest): Promise<RegisterResponse> {
    try {
      const response = await apiClient.post<RegisterResponse>('/api/mobile/auth/register-phase-one', request);
      
      if (response.tempToken) {
        await StorageService.setSecureItem('temp_token', response.tempToken);
      }
      
      return response;
    } catch (error) {
      console.error('注册第一阶段失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 注册第二阶段 - 完整资料
  static async registerPhaseTwo(request: RegisterPhaseTwoRequest): Promise<RegisterResponse> {
    try {
      const response = await apiClient.post<RegisterResponse>('/api/mobile/auth/register-phase-two', request);
      
      if (response.success && response.user && response.tokens) {
        // 转换后端用户数据为前端格式
        const transformedUser = transformBackendUser(response.user);
        
        await this.saveAuthTokens(response.tokens);
        await this.saveUserInfo(transformedUser);
        
        // 清除临时token
        await StorageService.removeSecureItem('temp_token');
        
        // 返回转换后的用户数据
        response.user = transformedUser;
      }
      
      return response;
    } catch (error) {
      console.error('注册第二阶段失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 生物识别登录
  static async biometricLogin(options: BiometricAuthOptions = {}): Promise<LoginResponse> {
    try {
      // 检查生物识别是否启用
      const isBiometricEnabled = await BiometricManager.isBiometricLoginEnabled();
      if (!isBiometricEnabled) {
        throw new Error('生物识别登录未启用');
      }

      // 执行生物识别认证
      const authenticated = await BiometricManager.authenticate(options);
      if (!authenticated) {
        throw new Error('生物识别认证失败');
      }

      // 获取已保存的凭据
      const savedCredentials = await BiometricManager.getBiometricCredentials();
      if (!savedCredentials) {
        throw new Error('未找到生物识别登录凭据');
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 使用统一登录接口进行生物识别登录验证
      const response = await NetworkManager.executeWithRetry(
        () => apiClient.post<LoginResponse>('/api/mobile/auth/unified-login', {
          username: savedCredentials.username,
          biometricToken: savedCredentials.encryptedToken,
          deviceInfo: savedCredentials.deviceInfo,
          loginType: 'biometric'
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.user && response.tokens) {
        // 转换后端用户数据为前端格式
        const transformedUser = transformBackendUser(response.user);
        
        // 使用TokenManager保存新的认证信息
        const tokenData = {
          accessToken: response.tokens.accessToken,
          refreshToken: response.tokens.refreshToken,
          tempToken: response.tokens.tempToken,
          expiresAt: Date.now() + response.tokens.expiresIn * 1000,
          tokenType: response.tokens.tokenType || 'Bearer'
        };
        
        await TokenManager.storeTokens(tokenData);
        await this.saveUserInfo(transformedUser);
        
        // 更新生物识别凭据
        await BiometricManager.saveBiometricCredentials({
          username: savedCredentials.username,
          encryptedToken: response.tokens.accessToken,
          deviceInfo: savedCredentials.deviceInfo
        });
        
        console.log('生物识别登录成功:', { 
          userId: transformedUser.id, 
          role: getUserRole(transformedUser),
          userType: transformedUser.userType
        });
        
        // 返回转换后的用户数据
        response.user = transformedUser;
      }

      return response;

    } catch (error) {
      console.error('生物识别登录失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 设备绑定登录 (一键登录)
  static async deviceLogin(): Promise<LoginResponse> {
    try {
      const deviceId = await StorageService.getSecureItem('device_id');
      const deviceToken = await StorageService.getSecureItem('device_token');
      
      if (!deviceId || !deviceToken) {
        throw new Error('设备未绑定，请先进行正常登录');
      }

      const response = await apiClient.post<LoginResponse>('/api/mobile/auth/device-login', {
        deviceId,
        deviceToken
      });

      if (response.success && response.user && response.tokens) {
        // 转换后端用户数据为前端格式
        const transformedUser = transformBackendUser(response.user);
        
        await this.saveAuthTokens(response.tokens);
        await this.saveUserInfo(transformedUser);
        
        // 返回转换后的用户数据
        response.user = transformedUser;
      }

      return response;
    } catch (error) {
      console.error('设备登录失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 登出
  static async logout(): Promise<void> {
    try {
      // 通知服务器登出
      await apiClient.post('/api/mobile/auth/logout');
    } catch (error) {
      console.error('服务器登出失败:', error);
    } finally {
      // 清除本地认证信息
      await this.clearAuthData();
    }
  }

  // 检查认证状态
  static async checkAuthStatus(): Promise<{ isAuthenticated: boolean; user: User | null }> {
    try {
      const accessToken = await TokenManager.getValidToken();
      const userInfo = await StorageService.getItem('user_info');

      if (!accessToken || !userInfo) {
        return { isAuthenticated: false, user: null };
      }

      const user = JSON.parse(userInfo) as User;
      
      // 验证token是否仍然有效
      try {
        await NetworkManager.executeWithRetry(
          () => apiClient.get('/mobile/auth/profile'),
          { maxRetries: 1, baseDelay: 1000 }
        );
        return { isAuthenticated: true, user };
      } catch (error) {
        console.error('Token validation failed:', error);
        // Token可能过期或无效，清除认证信息
        await this.clearAuthData();
        return { isAuthenticated: false, user: null };
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
      return { isAuthenticated: false, user: null };
    }
  }

  // 保存认证令牌 (已使用TokenManager替代)
  private static async saveAuthTokens(tokens: AuthTokens): Promise<void> {
    // This method is deprecated, use TokenManager.storeTokens instead
    console.warn('saveAuthTokens is deprecated, use TokenManager.storeTokens instead');
  }

  // 保存用户信息
  private static async saveUserInfo(user: User): Promise<void> {
    await StorageService.setItem('user_info', JSON.stringify(user));
    await StorageService.setItem('user_role', getUserRole(user));
    await StorageService.setItem('last_login', new Date().toISOString());
  }

  // 获取生物识别凭据 (已使用BiometricManager替代)
  private static async getSavedBiometricCredentials(): Promise<{
    username: string;
    encryptedPassword: string;
    deviceInfo: any;
  } | null> {
    // This method is deprecated, use BiometricManager.getBiometricCredentials instead
    console.warn('getSavedBiometricCredentials is deprecated, use BiometricManager.getBiometricCredentials instead');
    return null;
  }

  // 保存生物识别凭据 (已使用BiometricManager替代)
  static async saveBiometricCredentials(username: string, password: string, deviceInfo: any): Promise<void> {
    // This method is deprecated, use BiometricManager.saveBiometricCredentials instead
    console.warn('saveBiometricCredentials is deprecated, use BiometricManager.saveBiometricCredentials instead');
    
    await BiometricManager.saveBiometricCredentials({
      username,
      encryptedToken: password, // This should be the encrypted token, not password
      deviceInfo
    });
  }

  // 清除认证数据
  private static async clearAuthData(): Promise<void> {
    await Promise.all([
      TokenManager.clearTokens(),
      StorageService.removeItem('user_info'),
      StorageService.removeItem('user_role'),
      StorageService.removeItem('last_login'),
      StorageService.removeSecureItem('device_token')
    ]);
  }

  // 权限检查
  static async hasPermission(permission: string): Promise<boolean> {
    try {
      const userInfo = await StorageService.getItem('user_info');
      if (!userInfo) return false;

      const user = JSON.parse(userInfo) as User;
      return user.permissions.features.includes(permission);
    } catch (error) {
      console.error('权限检查失败:', error);
      return false;
    }
  }

  // 角色检查
  static async hasRole(role: UserRole): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;
      return getUserRole(user) === role;
    } catch (error) {
      console.error('角色检查失败:', error);
      return false;
    }
  }

  // 获取当前用户
  static async getCurrentUser(): Promise<User | null> {
    try {
      const userInfo = await StorageService.getItem('user_info');
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
      console.error('获取当前用户失败:', error);
      return null;
    }
  }

  // 错误处理
  private static handleAuthError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('认证服务出现未知错误');
  }
}