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
    // 认证服务总是检查认证API的环境
    this.environment = getApiEnvironment(API_ENDPOINTS.AUTH.LOGIN) as 'mock' | 'real';
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
      console.log(`[AuthService] 尝试登录 (${this.environment} API):`, credentials.username);
      
      // 根据环境使用不同的端点
      const endpoint = this.environment === 'real' 
        ? '/users/login'  // 真实API端点
        : '/auth/login';  // Mock API端点

      const response = await apiClient.post(endpoint, credentials);
      
      console.log(`[AuthService] 登录响应 (${this.environment}):`, response);

      // 简单的成功检查
      if (response && (response.success !== false)) {
        const userData = response.data || response;
        console.log(`[AuthService] 登录成功 (${this.environment}):`, userData.user?.username || userData.username);
        return response;
      }

      throw new AuthApiError(
        response?.message || '登录失败',
        400,
        'LOGIN_FAILED'
      );

    } catch (error) {
      console.error(`[AuthService] 登录失败 (${this.environment}):`, error);
      
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
      console.log(`[AuthService] 尝试注册 (${this.environment} API):`, userData.username);

      // 前端验证
      if (userData.confirmPassword && userData.password !== userData.confirmPassword) {
        throw new AuthApiError('密码确认不匹配', 400, 'PASSWORD_MISMATCH');
      }

      // 移除确认密码字段
      const { confirmPassword, ...apiData } = userData;

      // 根据环境使用不同的端点
      const endpoint = this.environment === 'real'
        ? '/users/register'  // 真实API端点
        : '/auth/register';  // Mock API端点

      const response = await apiClient.post(endpoint, apiData);
      
      console.log(`[AuthService] 注册响应 (${this.environment}):`, response);

      // 简单的成功检查
      if (response && (response.success !== false)) {
        const userData = response.data || response;
        console.log(`[AuthService] 注册成功 (${this.environment}):`, userData.user?.username || userData.username);
        return response;
      }

      throw new AuthApiError(
        response?.message || '注册失败',
        400,
        'REGISTER_FAILED'
      );

    } catch (error) {
      console.error(`[AuthService] 注册失败 (${this.environment}):`, error);
      
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
        : '/auth/logout';

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
        : '/auth/status';

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

// 导出服务实例和类型
export default authService; 