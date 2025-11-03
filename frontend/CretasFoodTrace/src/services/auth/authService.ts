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
  RegisterRequest,
  RegisterResponseData,
  ChangePasswordRequest,
  ChangePasswordResponse,
  User,
  FactoryUser,
  PlatformUser,
  AuthTokens,
  BiometricAuthOptions,
  UserRole,
  Department,
  USER_ROLES,
  PLATFORM_ROLES,
  FACTORY_ROLES,
  UserDTO
} from '../../types/auth';
import { transformBackendUser, getUserRole } from '../../utils/roleMapping';

export class AuthService {
  // 登录方法 - 支持新的 /api/auth/login 端点
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('开始登录流程:', { username: credentials.username });

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用新的API端点 - 统一登录接口（支持工厂用户和平台管理员）
      // 注意: unified-login 会自动识别用户类型（平台管理员 or 工厂用户）
      // 所以不需要显式传递 factoryId - 后端会根据username判断
      const loginPayload: any = {
        username: credentials.username,
        password: credentials.password,
        deviceInfo: credentials.deviceInfo
      };

      // 仅当需要明确指定工厂用户时才传递 factoryId（目前不需要）
      // 因为后端会通过用户名自动识别是平台用户还是工厂用户

      console.log('📤 发送登录请求:', JSON.stringify(loginPayload, null, 2));

      const rawResponse = await NetworkManager.executeWithRetry(
        () => apiClient.post<any>('/api/mobile/auth/unified-login', loginPayload),
        { maxRetries: 2, baseDelay: 1000 }
      );

      console.log('🔍 Raw API Response:', JSON.stringify(rawResponse, null, 2));

      // 转换新API的响应格式为内部格式
      const response = this.adaptNewApiResponse(rawResponse);

      if (response.success && response.user && response.tokens) {
        // 调试日志: 打印转换后的用户数据
        console.log('✅ Transformed User Data:', JSON.stringify(response.user, null, 2));

        // 使用TokenManager保存认证信息
        const tokenData = {
          accessToken: response.tokens.token || response.tokens.accessToken,
          refreshToken: response.tokens.refreshToken,
          tempToken: response.tokens.tempToken,
          expiresAt: Date.now() + (response.tokens.expiresIn || 86400) * 1000, // 默认24小时
          tokenType: response.tokens.tokenType || 'Bearer'
        };

        await TokenManager.storeTokens(tokenData);
        await this.saveUserInfo(response.user);

        // 如果启用了生物识别且设备支持，询问是否保存凭据
        if (credentials.biometricEnabled) {
          const canUseBiometric = await BiometricManager.isAvailable();
          if (canUseBiometric) {
            await BiometricManager.saveBiometricCredentials({
              username: credentials.username,
              encryptedToken: response.tokens.token || response.tokens.accessToken,
              deviceInfo: credentials.deviceInfo
            });
          }
        }

        console.log('登录成功:', {
          userId: response.user.id,
          role: getUserRole(response.user),
          userType: response.user.userType
        });
      }

      return response;
    } catch (error) {
      console.error('登录失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 适配新API响应格式 - 处理后端统一登录返回
  private static adaptNewApiResponse(rawResponse: any): LoginResponse {
    try {
      // 后端unified-login实际返回格式:
      // {
      //   code: 200,
      //   success: true,
      //   message: "操作成功",
      //   data: {
      //     userId, username, role, token, refreshToken, profile, permissions, ...
      //   }
      // }

      if (!rawResponse.success || rawResponse.code !== 200) {
        return {
          success: false,
          message: rawResponse.message || '登录失败'
        };
      }

      // 检查是否有data字段
      if (!rawResponse.data) {
        return {
          success: false,
          message: '登录响应中缺少数据'
        };
      }

      const data = rawResponse.data;

      // 检查是否有必需字段 (token/userId)
      if (!data.token || !data.userId) {
        return {
          success: false,
          message: '登录响应中缺少用户信息或Token'
        };
      }

      // 构建用户对象 - 从data中提取信息
      const backendUser = {
        id: data.userId,
        username: data.username,
        email: data.profile?.email || '',
        phone: data.profile?.phoneNumber || '',
        fullName: data.profile?.name || data.username,
        avatar: data.profile?.avatar,
        lastLogin: data.lastLoginTime,
        lastLoginAt: data.lastLoginTime,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isActive: true,
        role: data.role,
        roleCode: data.role,
        factoryId: data.factoryId,
        factoryName: data.factoryName,
        department: data.profile?.department,
        position: data.profile?.position,
        permissions: data.permissions
      };

      // 构建tokens对象 - 从data中提取token信息
      const backendTokens = {
        token: data.token,
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        tokenType: 'Bearer'
      };

      // 确定userType - 如果有factoryId则是factory用户，否则是platform用户
      const userType = backendUser.factoryId ? 'factory' : 'platform';

      let user: User;

      if (userType === 'factory') {
        user = {
          id: String(backendUser.id),
          username: backendUser.username,
          email: backendUser.email || '',
          phone: backendUser.phone,
          fullName: backendUser.fullName,
          avatar: backendUser.avatar,
          lastLoginAt: backendUser.lastLoginAt || backendUser.lastLogin,
          createdAt: backendUser.createdAt,
          updatedAt: backendUser.updatedAt,
          isActive: backendUser.isActive,
          userType: 'factory',
          factoryUser: {
            role: backendUser.roleCode as FactoryRole,
            factoryId: backendUser.factoryId,
            department: backendUser.department as Department,
            position: backendUser.position,
            permissions: backendUser.permissions?.features || []
          }
        } as User;
      } else {
        user = {
          id: String(backendUser.id),
          username: backendUser.username,
          email: backendUser.email || '',
          phone: backendUser.phone,
          fullName: backendUser.fullName,
          avatar: backendUser.avatar,
          lastLoginAt: backendUser.lastLoginAt || backendUser.lastLogin,
          createdAt: backendUser.createdAt,
          updatedAt: backendUser.updatedAt,
          isActive: backendUser.isActive,
          userType: 'platform',
          platformUser: {
            role: backendUser.role as PlatformRole,
            permissions: backendUser.permissions?.features || []
          }
        } as User;
      }

      // 添加权限信息到user对象顶级属性（用于后续权限检查）
      const permissionsData = backendUser.permissions || {};
      (user as any).permissions = {
        modules: permissionsData.modules || {},
        features: permissionsData.features || [],
        role: permissionsData.role || backendUser.roleCode || backendUser.role || '',
        userType: user.userType,
        level: permissionsData.roleLevel || 0,
        departments: user.userType === 'factory' ? [(user as FactoryUser).factoryUser.department] : undefined
      };

      // 转换用户数据（如果需要进一步处理）
      const transformedUser = transformBackendUser(user);

      // 构建tokens对象 - 后端返回 token 字段，需要映射为 accessToken
      const tokens: AuthTokens = {
        accessToken: backendTokens.token || backendTokens.accessToken,
        refreshToken: backendTokens.refreshToken,
        tempToken: undefined,
        expiresIn: backendTokens.expiresIn || 86400,
        tokenType: backendTokens.tokenType || 'Bearer'
      };

      console.log('✅ API响应适配成功:', {
        userId: user.id,
        username: user.username,
        userType: user.userType,
        hasToken: !!tokens.accessToken
      });

      return {
        success: true,
        message: rawResponse.message || '登录成功',
        user: transformedUser,
        tokens: tokens
      };
    } catch (error) {
      console.error('适配API响应失败:', error);
      return {
        success: false,
        message: '登录响应处理失败'
      };
    }
  }

  // 发送验证码
  static async sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>('/api/mobile/auth/send-code', {
        phoneNumber
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
      }>('/api/mobile/auth/verify-code', {
        phoneNumber: request.phoneNumber,
        code: request.verificationCode
      });

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

  // 用户注册 - 支持新的 /api/auth/register 端点
  static async register(request: RegisterRequest): Promise<LoginResponse> {
    try {
      console.log('开始用户注册流程:', { username: request.username });

      // 前端验证
      if (!request.tempToken || !request.username || !request.password || !request.realName || !request.factoryId) {
        throw new Error('缺少必需字段');
      }

      if (request.password.length < 6) {
        throw new Error('密码长度必须至少6个字符');
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用API端点
      const rawResponse = await NetworkManager.executeWithRetry(
        () => apiClient.post<any>('/api/auth/register', {
          tempToken: request.tempToken,
          username: request.username,
          password: request.password,
          realName: request.realName,
          factoryId: request.factoryId,
          department: request.department,
          position: request.position,
          email: request.email
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      console.log('🔍 Raw Register API Response:', JSON.stringify(rawResponse, null, 2));

      // 转换API响应为内部格式
      const response = this.adaptRegisterResponse(rawResponse);

      if (response.success && response.user && response.tokens) {
        // 调试日志: 打印转换后的用户数据
        console.log('✅ Transformed User Data:', JSON.stringify(response.user, null, 2));

        // 使用TokenManager保存认证信息
        const tokenData = {
          accessToken: response.tokens.accessToken,
          refreshToken: response.tokens.refreshToken,
          tempToken: response.tokens.tempToken,
          expiresAt: Date.now() + (response.tokens.expiresIn || 86400) * 1000, // 默认24小时
          tokenType: response.tokens.tokenType || 'Bearer'
        };

        await TokenManager.storeTokens(tokenData);
        await this.saveUserInfo(response.user);

        // 清除临时token
        await StorageService.removeSecureItem('temp_token');

        console.log('用户注册成功:', {
          userId: response.user.id,
          role: getUserRole(response.user),
          userType: response.user.userType
        });
      }

      return response;
    } catch (error) {
      console.error('用户注册失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 适配用户注册API响应格式
  private static adaptRegisterResponse(rawResponse: any): LoginResponse {
    try {
      // 实际API返回格式: { code, data, message, success, timestamp }
      // data 包含: { accessToken, refreshToken, tokenType, expiresIn, user, message }
      // 需要转换为内部格式: { success, message, user, tokens }

      if (!rawResponse.success || !rawResponse.data) {
        return {
          success: false,
          message: rawResponse.message || '注册失败'
        };
      }

      const data = rawResponse.data;

      // 后端已经返回了完整的user对象，直接使用
      if (data.user) {
        const backendUser = data.user as UserDTO;

        // 确定userType - 如果有factoryId则是factory用户，否则是platform用户
        const userType = backendUser.factoryId ? 'factory' : 'platform';

        let user: User;

        if (userType === 'factory') {
          user = {
            id: String(backendUser.id),
            username: backendUser.username,
            email: backendUser.email || '',
            phone: backendUser.phone,
            fullName: backendUser.fullName,
            avatar: undefined,
            lastLoginAt: backendUser.lastLogin,
            createdAt: backendUser.createdAt,
            updatedAt: backendUser.updatedAt,
            isActive: backendUser.isActive,
            userType: 'factory',
            factoryUser: {
              role: backendUser.roleCode as FACTORY_ROLES,
              factoryId: backendUser.factoryId || '',
              department: backendUser.department as Department,
              position: backendUser.position,
              permissions: []
            }
          } as User;
        } else {
          user = {
            id: String(backendUser.id),
            username: backendUser.username,
            email: backendUser.email || '',
            phone: backendUser.phone,
            fullName: backendUser.fullName,
            avatar: undefined,
            lastLoginAt: backendUser.lastLogin,
            createdAt: backendUser.createdAt,
            updatedAt: backendUser.updatedAt,
            isActive: backendUser.isActive,
            userType: 'platform',
            platformUser: {
              role: backendUser.roleCode as PLATFORM_ROLES,
              permissions: []
            }
          } as User;
        }

        // 添加权限信息到user对象顶级属性（用于后续权限检查）
        (user as any).permissions = {
          modules: {},
          features: [],
          role: backendUser.roleCode || '',
          userType: user.userType,
          level: 0,
          departments: user.userType === 'factory' ? [(user as FactoryUser).factoryUser.department] : undefined
        };

        // 转换用户数据（如果需要进一步处理）
        const transformedUser = transformBackendUser(user);

        // 构建tokens对象
        const tokens: AuthTokens = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tempToken: undefined,
          expiresIn: data.expiresIn || 86400,
          tokenType: data.tokenType || 'Bearer'
        };

        return {
          success: true,
          message: data.message || rawResponse.message || '注册成功',
          user: transformedUser,
          tokens: tokens
        };
      }

      // 如果没有user对象，返回错误
      return {
        success: false,
        message: '注册响应中缺少用户信息'
      };
    } catch (error) {
      console.error('适配注册API响应失败:', error);
      return {
        success: false,
        message: '注册响应处理失败'
      };
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
      // 通知服务器登出 - 调用移动端API端点
      const response = await apiClient.post<any>('/api/mobile/auth/logout');

      console.log('服务器登出成功:', {
        code: response.code,
        message: response.message,
        timestamp: response.timestamp
      });
    } catch (error) {
      console.error('服务器登出失败:', error);
      // 即使服务器登出失败，也继续清除本地数据
      // 保证用户可以成功退出应用
    } finally {
      // 清除本地认证信息
      await this.clearAuthData();

      console.log('本地认证数据已清除，用户登出完成');
    }
  }

  // 重置密码（忘记密码流程）
  static async resetPassword(
    tempToken: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 前端验证
      if (!tempToken) {
        throw new Error('缺少临时令牌，请先验证手机号');
      }

      if (!newPassword) {
        throw new Error('请输入新密码');
      }

      if (newPassword.length < 6 || newPassword.length > 20) {
        throw new Error('新密码长度必须在6-20个字符之间');
      }

      console.log('开始重置密码流程');

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => apiClient.post<any>('/api/mobile/auth/reset-password', {
          tempToken,
          newPassword
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success || response.code === 200) {
        console.log('密码重置成功');
        return {
          success: true,
          message: response.message || '密码重置成功，请使用新密码登录'
        };
      } else {
        throw new Error(response.message || '密码重置失败');
      }
    } catch (error) {
      console.error('密码重置失败:', error);
      throw this.handleAuthError(error);
    }
  }

  // 修改密码
  static async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResponse> {
    try {
      // 前端验证
      if (!oldPassword || !newPassword) {
        throw new Error('原密码和新密码不能为空');
      }

      if (oldPassword === newPassword) {
        throw new Error('新密码不能与旧密码相同');
      }

      if (newPassword.length < 6 || newPassword.length > 20) {
        throw new Error('新密码长度必须在6-20个字符之间');
      }

      console.log('开始修改密码:', { username: '***' });

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用API - 注意参数在query string中
      const response = await NetworkManager.executeWithRetry(
        () =>
          apiClient.post<any>('/api/auth/change-password', null, {
            params: {
              oldPassword,
              newPassword
            }
          }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('密码修改成功:', {
          message: response.message,
          timestamp: response.timestamp
        });

        return {
          success: true,
          message: response.message || '密码修改成功',
          timestamp: response.timestamp
        };
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error) {
      console.error('密码修改失败:', error);
      throw this.handleAuthError(error);
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
          () => apiClient.get('/api/auth/profile'),
          { maxRetries: 1, baseDelay: 1000 }
        );
        return { isAuthenticated: true, user };
      } catch (error) {
        // Token可能过期或无效(401错误是正常的),静默清除认证信息
        // 不打印错误日志,避免误导用户
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

    // 只在有角色时保存，避免保存null值
    const role = getUserRole(user);
    if (role) {
      await StorageService.setItem('user_role', role);
    }

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