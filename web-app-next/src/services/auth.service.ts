/**
 * 认证服务
 * 简化实现，直接使用现有的API客户端，支持Mock/Real API透明切换
 */

import { apiClient } from '@/lib/api';
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
      NEXT_PUBLIC_USE_REAL_AUTH_API: process.env.NEXT_PUBLIC_USE_REAL_AUTH_API,
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
   * 用户登录
   */
  async login(credentials: LoginRequest): Promise<any> {
    try {
      // 根据用户名决定使用Mock API还是Real API
      const useRealApi = credentials.username === 'user';
      const apiType = useRealApi ? 'real' : 'mock';

      console.log(`[AuthService] 尝试登录 ${credentials.username} (${apiType} API)`);

      // 根据API类型使用不同的端点和格式
      const endpoint = useRealApi
        ? '/users/login'    // 真实API端点
        : '/api/auth/login'; // Mock API端点

      let response;
      if (useRealApi) {
        // 工厂用户：真实API使用FormData格式发送数据
        console.log(`[AuthService] 工厂用户使用FormData格式发送登录请求`);
        response = await apiClient.postForm(endpoint, credentials, { forceRealApi: true });
      } else {
        // 平台管理员：Mock API使用JSON格式
        console.log(`[AuthService] 平台管理员使用Mock API`);
        response = await apiClient.post(endpoint, credentials);
      }

      console.log(`[AuthService] 登录响应 (${apiType}):`, response);

      // 处理不同API的响应格式
      if (useRealApi) {
        // 真实API格式: {state: number, message: string, data: any}
        // 注意：后端实际返回 state:200 表示成功，不是 state:2000
        if (response && (response.state === 2000 || response.state === 200)) {
          // state 2000 或 200 表示成功
          const userData = response.data;
          console.log(`[AuthService] 工厂用户登录成功 (真实API):`, userData?.username || userData?.uid);
          return {
            success: true,
            data: userData,
            message: response.message || '登录成功'
          };
        } else {
          // 处理具体的错误状态码
          let errorMessage = response?.message || '登录失败';
          let errorCode = 'LOGIN_FAILED';

          switch (response?.state) {
            case 4004:
              errorMessage = response.message || '用户不存在，请检查用户名';
              errorCode = 'USER_NOT_FOUND';
              break;
            case 4003:
            case 4005:
              errorMessage = response.message || '密码错误，请重新输入';
              errorCode = 'INVALID_PASSWORD';
              break;
            case 4001:
              errorMessage = response.message || '参数错误，请检查输入信息';
              errorCode = 'INVALID_PARAMS';
              break;
            default:
              errorMessage = response?.message || `登录失败 (状态码: ${response?.state})`;
              errorCode = 'LOGIN_FAILED';
          }

          console.log(`[AuthService] 工厂用户登录失败 (真实API) - 状态码: ${response?.state}, 信息: ${errorMessage}`);

          throw new AuthApiError(
            errorMessage,
            400,
            errorCode
          );
        }
      } else {
        // Mock API格式: {success: boolean, data: any}
        if (response && (response.success !== false)) {
          const userData = response.data || response;
          console.log(`[AuthService] 平台管理员登录成功 (Mock API):`, userData.user?.username || userData.username);
          return response;
        }

        throw new AuthApiError(
          response?.message || '登录失败',
          400,
          'LOGIN_FAILED'
        );
      }

    } catch (error) {
      const apiType = credentials.username === 'user' ? 'real' : 'mock';
      console.error(`[AuthService] 登录失败 (${apiType}):`, error);

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
   * 用户注册
   */
  async register(userData: RegisterRequest): Promise<any> {
    try {
      // 注册统一使用Mock API（工厂用户通常由超级管理员创建）
      const apiType = 'mock';
      console.log(`[AuthService] 尝试注册 ${userData.username} (${apiType} API)`);

      // 前端验证
      if (userData.confirmPassword && userData.password !== userData.confirmPassword) {
        throw new AuthApiError('密码确认不匹配', 400, 'PASSWORD_MISMATCH');
      }

      // 移除确认密码字段
      const { confirmPassword, ...apiData } = userData;

      // 注册统一使用Mock API端点
      const endpoint = '/api/auth/register';

      // Mock API使用JSON格式
      console.log(`[AuthService] 使用Mock API进行注册`);
      const response = await apiClient.post(endpoint, apiData);

      console.log(`[AuthService] 注册响应 (${apiType}):`, response);

      // 处理Mock API响应格式
      if (response && (response.success !== false)) {
        const userData = response.data || response;
        console.log(`[AuthService] 注册成功 (Mock API):`, userData.user?.username || userData.username);
        return response;
      }

      throw new AuthApiError(
        response?.message || '注册失败',
        400,
        'REGISTER_FAILED'
      );

    } catch (error) {
      console.error(`[AuthService] 注册失败 (mock):`, error);

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
      console.log(`[AuthService] 用户登出 (${this.environment} API)`);

      const endpoint = this.environment === 'real'
        ? '/users/logout'
        : '/api/auth/logout';

      await apiClient.post(endpoint);
      console.log(`[AuthService] 登出成功 (${this.environment})`);

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
      const endpoint = this.environment === 'real'
        ? '/users/status'
        : '/api/auth/status';

      const response = await apiClient.get(endpoint);

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
      const endpoint = this.environment === 'real'
        ? '/users/profile'
        : '/users/profile';

      const response = await apiClient.get(endpoint);

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
      const endpoint = this.environment === 'real'
        ? '/auth/refresh'
        : '/auth/refresh';

      const response = await apiClient.post(endpoint);

      if (response?.data?.token || response?.token) {
        return response;
      }

      throw new AuthApiError('令牌刷新失败');

    } catch (error) {
      console.error('[AuthService] 令牌刷新失败:', error);
      throw new AuthApiError('令牌刷新失败');
    }
  }
}

// 创建认证服务实例
export const authService = new AuthService();

// 导出服务实例
export default authService;
