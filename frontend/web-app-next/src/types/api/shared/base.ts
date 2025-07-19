/**
 * API基础类型声明
 * @description 统一的API响应格式和通用类型定义
 * @created 2025-06-03 TASK-P3-019A Day 0
 */

// 基础API响应格式
export interface BaseResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

// 分页参数
export interface PaginationParams {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 分页响应
export interface PaginatedResponse<T> extends BaseResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API错误类型
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// 通用查询参数
export interface QueryParams {
  search?: string;
  filter?: Record<string, any>;
  include?: string[];
  exclude?: string[];
}

// 通用实体基础字段
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// 用户相关基础类型
export interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  permissions: string[];
}

// 位置信息
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
}

// 文件上传响应
export interface FileUploadResponse {
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

// 操作结果
export interface OperationResult {
  success: boolean;
  affected: number;
  message?: string;
}

// HTTP方法类型
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// API状态码
export enum ApiStatusCode {
  SUCCESS = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}
