/**
 * 认证相关类型定义
 */

import { BaseEntity } from './common';

/**
 * 用户角色
 */
export interface UserRole extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  level: number; // 权限级别: 1-管理员, 2-操作员, 3-查看者
  permissions: Permission[];
  isSystem: boolean; // 是否为系统内置角色
}

/**
 * 权限
 */
export interface Permission extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  resource: string; // 资源类型: 'farming', 'processing', 'logistics', 'admin'
  action: string;   // 操作类型: 'read', 'write', 'delete', 'manage'
  scope?: 'own' | 'department' | 'all'; // 权限范围
  conditions?: Record<string, any>; // 权限条件
}

/**
 * 用户信息
 */
export interface User extends BaseEntity {
  username: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  department?: string;
  position?: string;
  
  // 认证相关
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string;
  loginCount: number;
  
  // 偏好设置
  preferences: UserPreferences;
  
  // 安全设置
  security: UserSecurity;
  
  // 元数据
  metadata?: Record<string, any>;
}

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  // 界面设置
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  
  // 通知设置
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    desktop: boolean;
    categories: Record<string, boolean>;
  };
  
  // 界面布局
  layout: {
    sidebarCollapsed: boolean;
    compactMode: boolean;
    showTooltips: boolean;
    animationsEnabled: boolean;
  };
  
  // 数据设置
  itemsPerPage: number;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  
  // 业务偏好
  defaultViews: Record<string, string>;
  favorites: string[];
  recentItems: string[];
}

/**
 * 用户安全设置
 */
export interface UserSecurity {
  // 密码相关
  passwordExpiresAt?: string;
  passwordChangeRequired: boolean;
  passwordHistory?: string[]; // 密码历史(加密)
  
  // 多因素认证
  mfaEnabled: boolean;
  mfaMethods: MfaMethod[];
  
  // 会话管理
  maxSessions: number;
  sessionTimeout: number; // 分钟
  
  // 安全日志
  lastPasswordChange?: string;
  failedLoginAttempts: number;
  lastFailedLoginAt?: string;
  lockedUntil?: string;
  
  // IP白名单
  allowedIPs?: string[];
  
  // 设备管理
  trustedDevices: TrustedDevice[];
}

/**
 * 多因素认证方法
 */
export interface MfaMethod {
  id: string;
  type: 'totp' | 'sms' | 'email' | 'backup_codes';
  name: string;
  enabled: boolean;
  verified: boolean;
  createdAt: string;
  lastUsedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * 受信任设备
 */
export interface TrustedDevice {
  id: string;
  name: string;
  deviceId: string;
  userAgent: string;
  ip: string;
  location?: string;
  trustedAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

/**
 * 登录凭据
 */
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
  deviceId?: string;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: string;
  position?: string;
  inviteCode?: string;
  termsAccepted: boolean;
}

/**
 * 密码重置请求
 */
export interface PasswordResetRequest {
  email: string;
  redirectUrl?: string;
}

/**
 * 密码更新请求
 */
export interface PasswordUpdateRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 认证响应
 */
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number; // 秒
  tokenType: 'Bearer';
  permissions: string[];
  features: string[];
}

/**
 * 令牌信息
 */
export interface TokenInfo {
  sub: string; // 用户ID
  username: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number; // 签发时间
  exp: number; // 过期时间
  iss: string; // 签发者
  aud: string; // 受众
  deviceId?: string;
  sessionId?: string;
}

/**
 * 会话信息
 */
export interface Session extends BaseEntity {
  userId: string;
  sessionId: string;
  deviceId?: string;
  userAgent: string;
  ip: string;
  location?: string;
  isActive: boolean;
  expiresAt: string;
  lastActivity: string;
  metadata?: Record<string, any>;
}

/**
 * 认证状态
 */
export interface AuthState {
  // 认证状态
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 用户信息
  user: User | null;
  
  // 令牌信息
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  
  // 权限信息
  permissions: Permission[];
  features: string[];
  
  // 会话信息
  session: Session | null;
  
  // 设备信息
  deviceId: string | null;
  
  // 认证方法
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  changePassword: (request: PasswordUpdateRequest) => Promise<void>;
  resetPassword: (request: PasswordResetRequest) => Promise<void>;
  
  // 权限检查
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (role: string) => boolean;
  hasFeature: (feature: string) => boolean;
  
  // 状态管理
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * 认证事件
 */
export interface AuthEvent {
  type: 'login' | 'logout' | 'register' | 'password_change' | 'profile_update' | 
        'token_refresh' | 'permission_change' | 'session_expire' | 'mfa_enable' | 
        'mfa_disable' | 'device_trust' | 'device_revoke';
  userId: string;
  sessionId?: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  // 密码策略
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // 天数
    historySize: number;
    lockoutThreshold: number;
    lockoutDuration: number; // 分钟
  };
  
  // 会话策略
  session: {
    maxDuration: number; // 分钟
    inactivityTimeout: number; // 分钟
    maxConcurrentSessions: number;
    requireMfaForPrivileged: boolean;
  };
  
  // 令牌策略
  token: {
    accessTokenDuration: number; // 分钟
    refreshTokenDuration: number; // 天数
    allowRefreshTokenRotation: boolean;
    requireSecureTransport: boolean;
  };
  
  // 多因素认证
  mfa: {
    enabled: boolean;
    required: boolean;
    backupCodesCount: number;
    totpWindow: number;
    smsTimeout: number; // 分钟
  };
}

/**
 * OAuth提供商配置
 */
export interface OAuthProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'saml' | 'oidc';
  enabled: boolean;
  clientId: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
  redirectUri: string;
  metadata?: Record<string, any>;
}

/**
 * 审计日志查询
 */
export interface AuditLogQuery {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  ip?: string;
  success?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * 安全警报
 */
export interface SecurityAlert extends BaseEntity {
  type: 'suspicious_login' | 'multiple_failed_attempts' | 'unusual_location' | 
        'privilege_escalation' | 'data_access' | 'configuration_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  location?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}