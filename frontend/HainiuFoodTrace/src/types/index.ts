// 基础API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  permissions: UserPermissions;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  level: number;
}

export interface UserPermissions {
  modules: {
    farming_access?: boolean;
    processing_access?: boolean;
    logistics_access?: boolean;
    trace_access?: boolean;
    admin_access?: boolean;
    platform_access?: boolean;
  };
  features: string[];
  role: string;
  roleLevel: number;
  department?: string;
}

// 认证相关类型
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// 设备信息类型
export interface DeviceInfo {
  deviceId: string;
  model: string;
  brand: string;
  osVersion: string;
  appVersion: string;
}

// 存储键名常量
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  APP_SETTINGS: 'app_settings',
} as const;