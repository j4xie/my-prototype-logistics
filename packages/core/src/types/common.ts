/**
 * 通用类型定义
 */

/**
 * 基础实体接口
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * API响应基础结构
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  timestamp?: string;
  errors?: ApiError[];
}

/**
 * API错误
 */
export interface ApiError {
  field?: string;
  code: string;
  message: string;
  details?: any;
}

/**
 * 查询筛选器
 */
export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'nin' | 'between';
  value: any;
}

/**
 * 查询参数
 */
export interface QueryParams {
  filters?: QueryFilter[];
  search?: string;
  pagination?: PaginationParams;
  includes?: string[];
  excludes?: string[];
}

/**
 * 选项接口
 */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
  group?: string;
  icon?: string;
  description?: string;
}

/**
 * 键值对
 */
export interface KeyValuePair<K = string, V = any> {
  key: K;
  value: V;
}

/**
 * 坐标位置
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

/**
 * 地址信息
 */
export interface Address {
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  detail?: string;
  postalCode?: string;
  coordinates?: Coordinates;
}

/**
 * 文件信息
 */
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
  uploadedAt: string;
  uploadedBy?: string;
}

/**
 * 附件
 */
export interface Attachment extends FileInfo {
  category: 'image' | 'document' | 'video' | 'audio' | 'other';
  description?: string;
  tags?: string[];
}

/**
 * 审计日志
 */
export interface AuditLog extends BaseEntity {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export';
  userId?: string;
  userName?: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 通知消息
 */
export interface Notification extends BaseEntity {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  recipientId?: string;
  recipientType?: 'user' | 'role' | 'group' | 'all';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  readAt?: string;
  expiresAt?: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
}

/**
 * 通知操作
 */
export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  style?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  data?: Record<string, any>;
}

/**
 * 标签
 */
export interface Tag {
  id: string;
  name: string;
  color?: string;
  category?: string;
  description?: string;
}

/**
 * 状态枚举
 */
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

/**
 * 优先级枚举
 */
export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

/**
 * 数据同步状态
 */
export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  FAILED = 'failed',
  CONFLICT = 'conflict'
}

/**
 * 操作结果
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult<T = any> {
  successful: OperationResult<T>[];
  failed: OperationResult<T>[];
  total: number;
  successCount: number;
  failedCount: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: {
    field: string;
    message: string;
    code?: string;
  }[];
}

/**
 * 导出选项
 */
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf' | 'json';
  fields?: string[];
  filters?: QueryFilter[];
  includeHeaders?: boolean;
  filename?: string;
  template?: string;
}

/**
 * 导入选项
 */
export interface ImportOptions {
  format: 'csv' | 'excel' | 'json';
  mapping?: Record<string, string>;
  validateOnly?: boolean;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}

/**
 * 统计数据
 */
export interface Statistics {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  growth?: {
    value: number;
    percentage: number;
    period: string;
  };
  breakdown?: KeyValuePair<string, number>[];
}

/**
 * 时间范围
 */
export interface TimeRange {
  start: string;
  end: string;
  period?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

/**
 * 图表数据点
 */
export interface DataPoint {
  label: string;
  value: number;
  timestamp?: string;
  metadata?: Record<string, any>;
}

/**
 * 图表数据系列
 */
export interface DataSeries {
  name: string;
  data: DataPoint[];
  color?: string;
  type?: 'line' | 'bar' | 'area' | 'pie' | 'scatter';
}

/**
 * 系统配置
 */
export interface SystemConfig {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  category: string;
  description?: string;
  editable: boolean;
  sensitive?: boolean;
}

/**
 * 功能开关
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  conditions?: {
    userRoles?: string[];
    userIds?: string[];
    percentage?: number;
    startDate?: string;
    endDate?: string;
  };
}

/**
 * 版本信息
 */
export interface VersionInfo {
  version: string;
  buildNumber?: string;
  buildDate?: string;
  gitCommit?: string;
  environment?: string;
  features?: string[];
}

/**
 * 健康检查结果
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    duration?: number;
    metadata?: Record<string, any>;
  }[];
  timestamp: string;
  version?: string;
}