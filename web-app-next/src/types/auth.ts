/**
 * 认证相关类型定义
 * 基于真实API接口规范定义，对接后端表字段：用户名、密码、邮箱、手机号、部门、职位
 */

// 用户注册请求 - 对接后端字段
export interface RegisterRequest {
  username: string;     // 用户名（必填）
  password: string;     // 密码（必填）
  email: string;        // 邮箱（必填）
  phone?: string;       // 手机号（可选）
  department?: string;  // 部门（可选）
  position?: string;    // 职位（可选）
  confirmPassword?: string; // 前端验证用，不发送到后端
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
  code?: string;
}

// 用户信息 - 对应后端表结构
export interface UserInfo {
  id: string | number;
  username: string;     // 用户名
  email: string;        // 邮箱
  phone?: string;       // 手机号
  department?: string;  // 部门
  position?: string;    // 职位
  role?: string;        // 系统角色（管理员等）
  isAdmin?: boolean;    // 是否为管理员
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

// 认证状态响应
export interface AuthStatusResponse extends AuthBaseResponse {
  data?: {
    isAuthenticated: boolean;
    user?: UserInfo;
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

// 表单验证错误
export interface ValidationError {
  field: string;
  message: string;
}

// 管理员权限检查
export interface AdminPermission {
  canManageUsers: boolean;
  canViewReports: boolean;
  canManageSystem: boolean;
  canAccessAllData: boolean;
} 