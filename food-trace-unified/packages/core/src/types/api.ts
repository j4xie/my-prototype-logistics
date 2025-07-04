// API相关类型定义
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, any>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchParams {
  q?: string;
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  enableMocks: boolean;
}

// 具体API请求类型
export interface GetProductsParams extends PaginationParams, SearchParams {
  batchId?: string;
  farmId?: string;
}

export interface GetBatchesParams extends PaginationParams, SearchParams {
  status?: string;
  farmId?: string;
  processingId?: string;
}

export interface GetTraceParams {
  batchId?: string;
  productId?: string;
  qrCode?: string;
}

export interface CreateBatchRequest {
  batchNumber: string;
  products: Partial<Product>[];
  farmingData?: Partial<FarmingData>;
}

export interface UpdateBatchRequest {
  id: string;
  status?: BatchStatus;
  processingData?: Partial<ProcessingData>;
  logisticsData?: Partial<LogisticsData>;
}

// 导入现有业务类型
import type { Product, Batch, FarmingData, ProcessingData, LogisticsData, BatchStatus } from './business';