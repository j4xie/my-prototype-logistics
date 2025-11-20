/**
 * 忘记密码API客户端
 * 功能：发送验证码、验证验证码、重置密码
 *
 * 后端API路径：/api/mobile/auth/*
 */

import { apiClient } from './apiClient';

/**
 * 发送验证码请求参数
 */
export interface SendVerificationCodeRequest {
  phoneNumber: string;
  verificationType: 'password_reset' | 'phone_verify' | 'login_verify';
}

/**
 * 发送验证码响应
 */
export interface SendVerificationCodeResponse {
  success: boolean;
  message: string;
  expiresIn: number | null; // 有效期（秒）
  retryAfter: number; // 下次可发送时间（秒后）
  sentAt: string; // ISO timestamp
}

/**
 * 验证重置码请求参数
 */
export interface VerifyResetCodeRequest {
  phoneNumber: string;
  verificationCode: string;
}

/**
 * 验证重置码响应
 */
export interface VerifyResetCodeResponse {
  success: boolean;
  message: string;
  resetToken: string; // 重置令牌（用于后续密码重置）
  expiresIn: number; // 重置令牌有效期（秒）
  verifiedAt: string; // ISO timestamp
}

/**
 * 重置密码请求参数
 */
export interface ForgotPasswordRequest {
  phoneNumber: string;
  resetToken: string;
  newPassword: string;
}

/**
 * 重置密码响应
 */
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  resetAt: string; // ISO timestamp
}

/**
 * 忘记密码API客户端
 */
export const forgotPasswordAPI = {
  /**
   * 发送验证码
   * 后端API: POST /api/mobile/auth/send-verification-code
   */
  sendVerificationCode: async (
    params: SendVerificationCodeRequest
  ): Promise<{
    success: boolean;
    data: SendVerificationCodeResponse;
    message?: string;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: SendVerificationCodeResponse;
      message?: string;
    }>(
      '/api/mobile/auth/send-verification-code',
      params
    );
    // apiClient拦截器已返回response.data，无需再访问.data
    return response;
  },

  /**
   * 验证重置验证码
   * 后端API: POST /api/mobile/auth/verify-reset-code
   */
  verifyResetCode: async (
    params: VerifyResetCodeRequest
  ): Promise<{
    success: boolean;
    data: VerifyResetCodeResponse;
    message?: string;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: VerifyResetCodeResponse;
      message?: string;
    }>(
      '/api/mobile/auth/verify-reset-code',
      params
    );
    // apiClient拦截器已返回response.data，无需再访问.data
    return response;
  },

  /**
   * 忘记密码-重置密码
   * 后端API: POST /api/mobile/auth/forgot-password
   */
  forgotPassword: async (
    params: ForgotPasswordRequest
  ): Promise<{
    success: boolean;
    data: ForgotPasswordResponse;
    message?: string;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: ForgotPasswordResponse;
      message?: string;
    }>(
      '/api/mobile/auth/forgot-password',
      params
    );
    // apiClient拦截器已返回response.data，无需再访问.data
    return response;
  },
};
