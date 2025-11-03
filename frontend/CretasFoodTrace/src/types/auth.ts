// 用户角色定义 - 完全匹配后端数据库
// 平台角色 (PlatformAdmin表)
export const PLATFORM_ROLES = {
  PLATFORM_ADMIN: 'platform_admin'  // 统一的平台管理员角色
} as const;

// 工厂角色 (User表)
export const FACTORY_ROLES = {
  FACTORY_SUPER_ADMIN: 'factory_super_admin',
  PERMISSION_ADMIN: 'permission_admin',
  DEPARTMENT_ADMIN: 'department_admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
  UNACTIVATED: 'unactivated'
} as const;

// 统一角色定义 (兼容旧代码)
export const USER_ROLES = {
  // 平台角色
  PLATFORM_ADMIN: 'platform_admin', // 统一的平台管理员角色
  // 工厂角色
  FACTORY_SUPER_ADMIN: 'factory_super_admin',
  PERMISSION_ADMIN: 'permission_admin',
  DEPARTMENT_ADMIN: 'department_admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
} as const;

export type PlatformRole = typeof PLATFORM_ROLES[keyof typeof PLATFORM_ROLES];
export type FactoryRole = typeof FACTORY_ROLES[keyof typeof FACTORY_ROLES];
export type UserRole = PlatformRole | FactoryRole;

// 用户权限接口
export interface UserPermissions {
  modules: {
    farming_access: boolean;
    processing_access: boolean;
    logistics_access: boolean;
    trace_access: boolean;
    admin_access: boolean;
    platform_access: boolean;
    debug_access?: boolean;
    system_config?: boolean;
  };
  features: string[];
  role: string;
  userType: 'platform' | 'factory';
  level?: number;
  departments?: string[];
}

// 部门定义 - 匹配后端数据库
export const DEPARTMENTS = {
  FARMING: 'farming',
  PROCESSING: 'processing',
  LOGISTICS: 'logistics',
  QUALITY: 'quality',
  MANAGEMENT: 'management'
} as const;

export type Department = typeof DEPARTMENTS[keyof typeof DEPARTMENTS];

// 基础用户接口
interface BaseUser {
  id: string;
  username: string;
  email: string;
  phone?: string;
  fullName?: string;
  avatar?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// 平台用户接口 (PlatformAdmin表)
export interface PlatformUser extends BaseUser {
  userType: 'platform';
  platformUser: {
    role: PlatformRole;
    permissions: string[];
  };
}

// 工厂用户接口 (User表)
export interface FactoryUser extends BaseUser {
  userType: 'factory';
  factoryUser: {
    role: FactoryRole;
    factoryId: string;
    department?: Department;
    position?: string;
    permissions: string[];
  };
}

// 统一用户类型
export type User = PlatformUser | FactoryUser;

// 认证令牌接口
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tempToken?: string;
  expiresIn: number;
  tokenType: string;
}

// 登录请求接口
export interface LoginRequest {
  username: string;
  password: string;
  deviceInfo?: {
    deviceId: string;
    deviceModel: string;
    osVersion: string;
    appVersion: string;
    platform: 'ios' | 'android';
  };
  factoryId?: string;
  rememberMe?: boolean;
  biometricEnabled?: boolean;
}

// 登录响应接口
export interface LoginResponse {
  success: boolean;
  message: string;
  user?: User;
  tokens?: AuthTokens;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

// 修改密码请求接口
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// 修改密码响应接口
export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

// 注册请求接口 (第一阶段 - 手机验证)
export interface RegisterPhaseOneRequest {
  phoneNumber: string;
  verificationType: 'register' | 'reset_password';
  factoryId?: string;
}

// 注册请求接口 (第二阶段 - 完整资料)
export interface RegisterPhaseTwoRequest {
  phoneNumber: string;
  verificationCode: string;
  username: string;
  password: string;
  realName: string;
  email?: string;
  departmentId?: string;
  role?: UserRole;
  deviceInfo: {
    deviceId: string;
    deviceModel: string;
    osVersion: string;
    appVersion: string;
    platform: 'ios' | 'android';
  };
}

// 注册响应接口
export interface RegisterResponse {
  success: boolean;
  message: string;
  tempToken?: string;
  user?: User;
  tokens?: AuthTokens;
  nextStep?: 'phone_verification' | 'complete_profile' | 'done';
}

// 认证状态接口
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  error: string | null;
  deviceBound: boolean;
  biometricEnabled: boolean;
  lastLoginMethod: 'password' | 'biometric' | 'device' | null;
}

// 权限检查接口
export interface PermissionCheckOptions {
  requireAll?: boolean; // 是否需要所有权限都满足
  checkLevel?: boolean; // 是否检查权限级别
  checkDepartment?: boolean; // 是否检查部门权限
}

// 生物识别认证选项
export interface BiometricAuthOptions {
  promptMessage?: string;
  cancelButtonText?: string;
  fallbackToDevicePasscode?: boolean;
  disableDeviceFallback?: boolean;
}

// 设备绑定信息
export interface DeviceBindingInfo {
  deviceId: string;
  deviceName: string;
  bindingDate: string;
  lastUsed: string;
  isActive: boolean;
  platform: 'ios' | 'android';
  appVersion: string;
}

// 用户注册请求接口 (新的 /api/auth/register)
export interface RegisterRequest {
  tempToken: string;           // 临时令牌（验证手机后获得）
  username: string;            // 用户名
  password: string;            // 密码
  realName: string;            // 真实姓名
  factoryId: string;           // 工厂ID
  department?: string;         // 部门（可选）
  position?: string;           // 职位（可选）
  email?: string;              // 邮箱（可选）
}

// 用户注册响应接口 (新的 /api/auth/register)
export interface RegisterResponseData {
  accessToken: string;         // 访问令牌
  refreshToken: string;        // 刷新令牌
  tokenType: string;           // 令牌类型
  expiresIn: number;           // 令牌过期时间（秒）
  user: UserDTO;               // 用户信息
  message: string;             // 提示消息
}

// UserDTO - 用户数据传输对象
export interface UserDTO {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  isActive: boolean;
  roleCode: FactoryRole | PlatformRole;
  roleDisplayName: string;
  factoryId?: string;
  department?: Department;
  departmentDisplayName?: string;
  position?: string;
  ccrRate?: number;
  monthlySalary?: number;
  expectedWorkMinutes?: number;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

// API 错误响应
export interface AuthError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}