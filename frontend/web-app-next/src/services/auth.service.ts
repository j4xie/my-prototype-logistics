/**
 * 认证服务
 * 简化实现，直接使用现有的API客户端，支持Mock/Real API透明切换
 */

import { apiClient } from '@/lib/api';
import { realApiClient } from '@/lib/real-api-client';
import { getApiEnvironment, API_ENDPOINTS } from '@/config/api-endpoints';
import type {
  LoginRequest,
  RegisterRequest,
  UserInfo
} from '@/types/auth';
import { getApiConfig } from '@/lib/api-config';

/**
 * API错误类
 */
export class AuthApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/**
 * 认证服务实现
 */
export class AuthService {
  private environment: 'mock' | 'real';

  constructor() {
    // 使用统一的环境检测逻辑
    this.environment = getApiEnvironment(API_ENDPOINTS.AUTH.LOGIN) as 'mock' | 'real';

    console.log(`[AuthService] 初始化环境: ${this.environment}`);
    console.log(`[AuthService] 环境检查信息:`, {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_USE_MOCK_API: process.env.NEXT_PUBLIC_USE_MOCK_API,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'server-side',
      searchParams: typeof window !== 'undefined' ? window.location.search : 'server-side'
    });
  }

  /**
   * 获取当前API环境
   */
  public getEnvironment(): 'mock' | 'real' {
    return this.environment;
  }

  /**
   * 用户登录 - 优先使用真实API
   */
  async login(credentials: LoginRequest): Promise<any> {
    try {
      // 判断登录类型：平台管理员 vs 工厂用户
      const isPlatformAdmin = ['platform_admin'].includes(credentials.username);
      const isFactoryUser = ['super_admin', 'user', 'factory_admin', 'farming_admin', 'processing_admin', 'logistics_admin'].includes(credentials.username);

      console.log(`[AuthService] 尝试登录 ${credentials.username} (${isPlatformAdmin ? '平台管理员' : isFactoryUser ? '工厂用户' : '真实API用户'})`);

      let response;
      if (isPlatformAdmin) {
        // 平台管理员登录 - 使用真实后端API
        console.log(`[AuthService] 平台管理员使用真实后端API`);
        response = await realApiClient.post('/api/auth/platform-login', credentials);
      } else {
        // 所有其他用户都使用工厂登录接口
        console.log(`[AuthService] 工厂用户使用真实后端API`);

        // 需要添加工厂ID - 默认使用测试工厂
        const loginData = {
          username: credentials.username,
          password: credentials.password,
          factoryId: 'TEST_2024_001' // 默认测试工厂ID
        };

        response = await realApiClient.post('/api/auth/login', loginData);
      }

      console.log(`[AuthService] 登录响应:`, response);

      // 处理真实后端API格式: {success: boolean, data: any, message: string}
      if (response && response.success) {
        const userData = response.data;
        console.log(`[AuthService] 用户登录成功:`, userData.admin?.username || userData.user?.username);

        // 设置认证token用于后续请求
        if (userData.tokens?.token) {
          realApiClient.setToken(userData.tokens.token);
        }

        return {
          success: true,
          data: userData,
          message: response.message || '登录成功'
        };
      }

      throw new AuthApiError(
        response?.message || '登录失败',
        400,
        'LOGIN_FAILED'
      );

    } catch (error) {
      console.error(`[AuthService] 登录失败:`, error);

      if (error instanceof AuthApiError) {
        throw error;
      }

      throw new AuthApiError(
        error instanceof Error ? error.message : '登录请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 手机号验证 - 新增方法
   */
  async verifyPhone(phoneNumber: string, factoryId: string = 'TEST_2024_001'): Promise<any> {
    try {
      console.log(`[AuthService] 验证手机号: ${phoneNumber}`);

      const response = await realApiClient.post(API_ENDPOINTS.AUTH.VERIFY_PHONE, {
        phoneNumber,
        factoryId
      });

      console.log(`[AuthService] 手机号验证响应:`, response);

      if (response && response.success) {
        return response;
      }

      throw new AuthApiError(
        response?.message || '手机号验证失败',
        400,
        'PHONE_VERIFY_FAILED'
      );

    } catch (error) {
      console.error(`[AuthService] 手机号验证失败:`, error);

      if (error instanceof AuthApiError) {
        throw error;
      }

      throw new AuthApiError(
        error instanceof Error ? error.message : '手机号验证请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 用户注册 - 使用新后端API
   */
  async register(userData: RegisterRequest & { tempToken?: string; factoryId?: string }): Promise<any> {
    try {
      console.log(`[AuthService] 尝试注册 ${userData.username}`);

      // 前端验证
      if (userData.confirmPassword && userData.password !== userData.confirmPassword) {
        throw new AuthApiError('密码确认不匹配', 400, 'PASSWORD_MISMATCH');
      }

      // 构建注册数据
      const { confirmPassword, ...apiData } = userData;
      const registerData = {
        ...apiData,
        factoryId: apiData.factoryId || 'TEST_2024_001' // 默认工厂ID
      };

      const response = await realApiClient.post(API_ENDPOINTS.AUTH.REGISTER, registerData);

      console.log(`[AuthService] 注册响应:`, response);

      // 处理新后端API响应格式
      if (response && response.success) {
        const userData = response.data || response;
        console.log(`[AuthService] 注册成功:`, userData.username);
        return response;
      }

      throw new AuthApiError(
        response?.message || '注册失败',
        400,
        'REGISTER_FAILED'
      );

    } catch (error) {
      console.error(`[AuthService] 注册失败:`, error);

      if (error instanceof AuthApiError) {
        throw error;
      }

      throw new AuthApiError(
        error instanceof Error ? error.message : '注册请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    try {
      console.log(`[AuthService] 用户登出`);

      await realApiClient.post(API_ENDPOINTS.AUTH.LOGOUT);

      // 清除本地存储的token
      realApiClient.setToken(null);
      console.log(`[AuthService] 登出成功`);

    } catch (error) {
      console.warn(`[AuthService] 登出请求失败:`, error);
      // 登出失败不抛出异常，因为可能是网络问题
    }
  }

  /**
   * 检查认证状态
   */
  async checkAuthStatus(): Promise<any> {
    try {
      const response = await realApiClient.get(API_ENDPOINTS.AUTH.STATUS);

      if (response) {
        return response;
      }

      return {
        success: false,
        message: '认证状态检查失败',
        data: { isAuthenticated: false }
      };

    } catch (error) {
      console.warn(`[AuthService] 认证状态检查失败:`, error);
      return {
        success: false,
        message: '认证状态检查失败',
        data: { isAuthenticated: false }
      };
    }
  }

  /**
   * 获取用户资料
   */
  async getUserProfile(): Promise<UserInfo> {
    try {
      const response = await realApiClient.get(API_ENDPOINTS.AUTH.PROFILE);

      if (response?.data) {
        return response.data;
      }

      if (response?.user) {
        return response.user;
      }

      throw new AuthApiError('获取用户资料失败');

    } catch (error) {
      console.error('[AuthService] 获取用户资料失败:', error);
      throw new AuthApiError('获取用户资料失败');
    }
  }

  /**
   * 刷新令牌
   */
  async refreshToken(): Promise<any> {
    try {
      const response = await realApiClient.post(API_ENDPOINTS.AUTH.REFRESH);

      if (response?.data?.token || response?.token) {
        return response;
      }

      throw new AuthApiError('令牌刷新失败');

    } catch (error) {
      console.error('[AuthService] 令牌刷新失败:', error);
      throw new AuthApiError('令牌刷新失败');
    }
  }

  /**
   * 修改密码
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<any> {
    try {
      const response = await realApiClient.put(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        oldPassword,
        newPassword
      });

      if (response && response.success) {
        return response;
      }

      throw new AuthApiError(
        response?.message || '密码修改失败',
        400,
        'PASSWORD_CHANGE_FAILED'
      );

    } catch (error) {
      console.error('[AuthService] 密码修改失败:', error);

      if (error instanceof AuthApiError) {
        throw error;
      }

      throw new AuthApiError('密码修改请求失败');
    }
  }
}

// 创建认证服务实例
export const authService = new AuthService();

// 导出服务实例
export default authService;
