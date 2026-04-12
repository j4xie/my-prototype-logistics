/**
 * 认证相关 API
 */
import request from './request';
import type { ApiResponse } from '@/types/api';
import type { User, AuthTokens, LoginRequest, LoginResponse } from '@/types/auth';

// 登录响应数据
interface LoginData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

/**
 * 统一登录
 */
export function login(data: LoginRequest): Promise<ApiResponse<LoginData>> {
  return request.post('/auth/unified-login', data);
}

/**
 * 刷新令牌
 * For web clients the refresh token is in an HttpOnly cookie (sent automatically).
 * The optional parameter is kept for backward compatibility with mobile/other callers.
 */
export function refreshToken(token?: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
  if (token) {
    return request.post('/auth/refresh', null, { params: { refreshToken: token } });
  }
  // Web client: refresh token comes from cookie, no body/params needed
  return request.post('/auth/refresh');
}

/**
 * 登出
 */
export function logout(): Promise<ApiResponse<null>> {
  return request.post('/auth/logout');
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser(): Promise<ApiResponse<User>> {
  return request.get('/auth/me');
}

/**
 * 修改密码
 */
export function changePassword(data: { oldPassword: string; newPassword: string }): Promise<ApiResponse<null>> {
  return request.post('/auth/change-password', data);
}

/**
 * 检查用户名是否可用
 * TODO: requires factoryId — not actively imported anywhere; keeping for future use
 * Backend path: GET /{factoryId}/users/check/username?username=xxx (UserController)
 */
export function checkUsername(factoryId: string, username: string): Promise<ApiResponse<{ available: boolean }>> {
  return request.get(`/${factoryId}/users/check/username`, { params: { username } });
}
