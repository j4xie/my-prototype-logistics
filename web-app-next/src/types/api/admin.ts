/**
 * 管理模块API类型声明
 * @description 涵盖用户管理、角色权限、审计日志、系统配置、报表生成等业务场景
 * @created 2025-06-03 TASK-P3-019A Day 0
 */

import { BaseEntity, BaseResponse, PaginatedResponse } from './shared/base';

// ============ 用户管理 ============

export interface User extends BaseEntity {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;

  // 账户状态
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: string;
  passwordChangedAt: string;

  // 角色和权限
  roles: string[];
  permissions: string[];
  department?: string;
  position?: string;

  // 个人信息
  profile: {
    bio?: string;
    timezone: string;
    language: 'zh-CN' | 'en-US' | 'zh-TW';
    dateFormat: string;
    theme: 'light' | 'dark' | 'auto';
  };

  // 安全设置
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string;
    failedLoginAttempts: number;
    lockedUntil?: string;
    trustedDevices: string[];
  };

  // 工作信息
  employment?: {
    employeeId: string;
    hireDate: string;
    managerId?: string;
    workLocation: string;
    workSchedule: string;
  };
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles: string[];
  department?: string;
  position?: string;
  employment?: User['employment'];
}

export interface UpdateUserRequest extends Partial<Omit<CreateUserRequest, 'password'>> {
  profile?: Partial<User['profile']>;
  security?: Partial<User['security']>;
}

// ============ 角色管理 ============

export interface Role extends BaseEntity {
  name: string;
  code: string;
  description: string;
  level: number; // 角色级别，数字越大权限越高

  // 权限配置
  permissions: {
    permissionId: string;
    permissionName: string;
    resource: string;
    actions: ('create' | 'read' | 'update' | 'delete' | 'approve')[];
    scope: 'all' | 'department' | 'team' | 'own';
  }[];

  // 角色限制
  restrictions: {
    maxUsers?: number;
    ipWhitelist?: string[];
    timeRestrictions?: {
      allowedDays: number[]; // 0-6 (周日-周六)
      allowedHours: {
        start: string;
        end: string;
      };
    };
    dataAccess?: {
      allowedModules: string[];
      restrictedFields: string[];
    };
  };

  // 继承关系
  parentRole?: string;
  childRoles: string[];

  status: 'active' | 'inactive';
  isSystemRole: boolean; // 系统内置角色不可删除
  userCount: number; // 当前拥有此角色的用户数
}

export interface CreateRoleRequest {
  name: string;
  code: string;
  description: string;
  level: number;
  permissions: Role['permissions'];
  restrictions?: Role['restrictions'];
  parentRole?: string;
}

// ============ 权限管理 ============

export interface Permission extends BaseEntity {
  name: string;
  code: string;
  description: string;
  resource: string; // 资源类型 (user, role, product, order等)
  actions: string[]; // 可执行的操作

  // 权限分组
  category: 'user_management' | 'content_management' | 'system_config' | 'reporting' | 'api_access';
  group: string;

  // 权限级别
  level: 'system' | 'admin' | 'manager' | 'user';
  isSystemPermission: boolean;

  // 依赖关系
  dependencies: string[]; // 前置权限
  excludes: string[]; // 互斥权限

  status: 'active' | 'deprecated';
}

// ============ 审计日志 ============

export interface AuditLog extends BaseEntity {
  // 操作信息
  action: string; // 操作类型
  resource: string; // 操作资源
  resourceId?: string; // 资源ID

  // 用户信息
  userId: string;
  username: string;
  userRole: string;

  // 请求信息
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  userAgent: string;
  ipAddress: string;

  // 操作详情
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  // 结果信息
  status: 'success' | 'failure' | 'warning';
  statusCode: number;
  errorMessage?: string;

  // 上下文信息
  context: {
    sessionId: string;
    requestId: string;
    source: 'web' | 'mobile' | 'api' | 'system';
    feature?: string;
    module?: string;
  };

  // 性能指标
  performance: {
    responseTime: number; // 响应时间(ms)
    queryCount?: number; // 数据库查询次数
    cacheHit?: boolean;
  };

  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CreateAuditLogRequest {
  action: string;
  resource: string;
  resourceId?: string;
  method: AuditLog['method'];
  endpoint: string;
  userAgent: string;
  ipAddress: string;
  changes?: AuditLog['changes'];
  status: AuditLog['status'];
  statusCode: number;
  errorMessage?: string;
  context: AuditLog['context'];
  performance: AuditLog['performance'];
  severity: AuditLog['severity'];
}

// ============ 系统配置 ============

export interface SystemConfig extends BaseEntity {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  category: 'general' | 'security' | 'email' | 'api' | 'ui' | 'business';

  // 配置元信息
  name: string;
  description: string;
  isPublic: boolean; // 是否可被前端访问
  isEditable: boolean; // 是否可编辑

  // 验证规则
  validation?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[]; // 枚举值
  };

  // 默认值和备注
  defaultValue: any;
  example?: string;
  notes?: string;

  // 变更追踪
  lastModifiedBy: string;
  version: number;
  changeHistory: {
    version: number;
    oldValue: any;
    newValue: any;
    changedBy: string;
    changedAt: string;
    reason?: string;
  }[];
}

export interface UpdateSystemConfigRequest {
  value: any;
  reason?: string;
}

// ============ 通知管理 ============

export interface Notification extends BaseEntity {
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'announcement';

  // 目标用户
  recipients: {
    type: 'all' | 'roles' | 'users' | 'departments';
    targets: string[]; // 具体的角色ID、用户ID或部门ID
  };

  // 通知渠道
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };

  // 内容设置
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'system' | 'security' | 'business' | 'maintenance' | 'promotion';

  // 时间设置
  scheduledAt?: string; // 定时发送
  expiresAt?: string; // 过期时间

  // 状态统计
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  statistics: {
    totalRecipients: number;
    sentCount: number;
    readCount: number;
    clickCount: number;
    failedCount: number;
  };

  // 发送者信息
  senderId: string;
  senderName: string;

  // 关联信息
  relatedResource?: {
    type: string;
    id: string;
    url?: string;
  };
}

export interface CreateNotificationRequest {
  title: string;
  content: string;
  type: Notification['type'];
  recipients: Notification['recipients'];
  channels: Notification['channels'];
  priority: Notification['priority'];
  category: Notification['category'];
  scheduledAt?: string;
  expiresAt?: string;
  relatedResource?: Notification['relatedResource'];
}

// ============ API响应类型 ============

// 用户管理API
export type GetUsersResponse = PaginatedResponse<User>;
export type GetUserResponse = BaseResponse<User>;
export type CreateUserResponse = BaseResponse<User>;
export type UpdateUserResponse = BaseResponse<User>;
export type DeleteUserResponse = BaseResponse<{ id: string }>;

// 角色管理API
export type GetRolesResponse = PaginatedResponse<Role>;
export type GetRoleResponse = BaseResponse<Role>;
export type CreateRoleResponse = BaseResponse<Role>;
export type UpdateRoleResponse = BaseResponse<Role>;

// 权限管理API
export type GetPermissionsResponse = PaginatedResponse<Permission>;
export type GetPermissionResponse = BaseResponse<Permission>;

// 审计日志API
export type GetAuditLogsResponse = PaginatedResponse<AuditLog>;
export type GetAuditLogResponse = BaseResponse<AuditLog>;
export type CreateAuditLogResponse = BaseResponse<AuditLog>;

// 系统配置API
export type GetSystemConfigsResponse = PaginatedResponse<SystemConfig>;
export type GetSystemConfigResponse = BaseResponse<SystemConfig>;
export type UpdateSystemConfigResponse = BaseResponse<SystemConfig>;

// 通知管理API
export type GetNotificationsResponse = PaginatedResponse<Notification>;
export type GetNotificationResponse = BaseResponse<Notification>;
export type CreateNotificationResponse = BaseResponse<Notification>;
export type UpdateNotificationResponse = BaseResponse<Notification>;

// 统计数据
export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  totalPermissions: number;
  recentAudits: number;
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  securityAlerts: number;
  pendingNotifications: number;
}

export type GetAdminDashboardResponse = BaseResponse<AdminDashboard>;
