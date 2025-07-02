/**
 * 认证相关类型定义
 * 基于真实API接口规范定义
 */

// 用户注册请求
export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  confirmPassword?: string; // 前端验证用
}

// 用户登录请求
export interface LoginRequest {
  username: string;
  password: string;
}

// 认证响应基础接口
export interface AuthBaseResponse {
  success: boolean;
  message?: string;
}

// 用户信息
export interface UserInfo {
  id: string | number;
  username: string;
  email: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 登录成功响应
export interface LoginResponse extends AuthBaseResponse {
  data?: {
    token: string;
    refreshToken?: string;
    user: UserInfo;
    expiresIn?: number;
  };
}

// 注册成功响应
export interface RegisterResponse extends AuthBaseResponse {
  data?: {
    user: UserInfo;
    token?: string;
  };
}

// API错误响应
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// 认证状态检查响应
export interface AuthStatusResponse extends AuthBaseResponse {
  data?: {
    isAuthenticated: boolean;
    user?: UserInfo;
  };
}

// 通用API响应包装器
export type ApiResponse<T = unknown> = T & {
  success: boolean;
  message?: string;
}; 