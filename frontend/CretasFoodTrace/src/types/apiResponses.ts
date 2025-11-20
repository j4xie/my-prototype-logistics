import { User, AuthTokens, UserDTO } from './auth';

/**
 * API响应类型定义
 * 用于替换authService.ts中的 as any 类型断言
 */

// 基础API响应格式
export interface BaseApiResponse<T = any> {
  code: number;
  success: boolean;
  message: string;
  data?: T;
  timestamp?: string;
}

// 统一登录API响应数据
export interface UnifiedLoginResponseData {
  userId: number | string;
  username: string;
  role: string;
  roleCode?: string;
  token?: string;
  accessToken?: string;
  refreshToken: string;
  expiresIn?: number;
  tokenType?: string;
  factoryId?: string;
  factoryName?: string;
  profile?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
    avatar?: string;
    department?: string;
    position?: string;
  };
  permissions?: {
    modules?: Record<string, boolean>;
    features?: string[];
    role?: string;
    roleLevel?: number;
  };
  lastLoginTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 统一登录API响应
export type UnifiedLoginApiResponse = BaseApiResponse<UnifiedLoginResponseData>;

// 注册第一阶段响应数据
export interface RegisterPhaseOneResponseData {
  tempToken: string;
  factoryId?: string;
  phoneNumber: string;
  expiresAt: number;
  isNewUser: boolean;
  message?: string;
}

// 注册第一阶段API响应
export type RegisterPhaseOneApiResponse = BaseApiResponse<RegisterPhaseOneResponseData>;

// 用户注册API响应数据
export interface RegisterApiResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserDTO;
  message: string;
}

// 用户注册API响应
export type RegisterApiResponse = BaseApiResponse<RegisterApiResponseData>;

// 登出API响应
export interface LogoutApiResponse {
  code: number;
  message: string;
  timestamp: string;
}

// 重置密码API响应
export interface ResetPasswordApiResponse {
  code: number;
  success: boolean;
  message: string;
  timestamp?: string;
}

// 修改密码API响应
export interface ChangePasswordApiResponse {
  code: number;
  success: boolean;
  message: string;
  timestamp?: string;
}

// 错误响应接口 (用于错误处理)
export interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string;
      error?: string;
      code?: number;
    };
  };
  message?: string;
}
