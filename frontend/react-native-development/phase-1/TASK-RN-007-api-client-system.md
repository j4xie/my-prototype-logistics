# TASK-RN-007: API客户端系统

> React Native Android开发 - API客户端系统实现任务
>
> 创建时间: 2025-08-05
> 预计工期: 2天 (16小时)
> 优先级: 高
> 状态: 待开始

## 📋 任务概述

建立完整的API客户端系统，包括智能API客户端、统一错误处理、离线队列支持、请求状态管理和性能优化等功能，为所有业务模块提供可靠的数据访问基础。

## 🎯 任务目标

- 创建智能的API客户端，支持自动token附加和网络重试
- 实现统一的错误处理机制，包括401自动刷新token
- 建立离线队列支持，提供良好的离线体验
- 集成请求状态管理，统一管理加载和错误状态
- 优化网络请求性能，支持请求缓存和防抖

## 📋 详细步骤

### **Day 1: 核心API客户端和错误处理** (8小时)

#### 1.1 智能API客户端 (4小时)

**1.1.1 基础API客户端**
```tsx
// src/services/apiClient.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { TokenManager } from './tokenManager';
import { NetworkManager } from './networkManager';
import { useAuthStore } from '@/stores/authStore';

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCache: boolean;
  cacheTimeout: number;
  enableOfflineQueue: boolean;
}

export interface ApiRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipRetry?: boolean;
  skipCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number; // 缓存生存时间（毫秒）
  priority?: 'high' | 'normal' | 'low';
  offlineQueueable?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message: string;
  timestamp: number;
  requestId: string;
}

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private config: ApiClientConfig;
  private requestCache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private offlineQueue: Array<{ config: ApiRequestConfig; resolve: Function; reject: Function }>;
  private retryQueues: Map<string, NodeJS.Timeout>;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableCache: true,
      cacheTimeout: 5 * 60 * 1000, // 5分钟
      enableOfflineQueue: true,
      ...config
    };

    this.requestCache = new Map();
    this.offlineQueue = [];
    this.retryQueues = new Map();

    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 请求拦截器
    this.axiosInstance.interceptors.request.use(
      async (config: any) => {
        // 添加请求ID用于追踪
        config.requestId = this.generateRequestId();
        
        // 添加认证token
        if (!config.skipAuth) {
          const token = await TokenManager.getValidToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // 添加用户信息
        const authStore = useAuthStore.getState();
        if (authStore.user && authStore.userType) {
          config.headers['X-User-Type'] = authStore.userType;
          if (authStore.factory) {
            config.headers['X-Factory-Id'] = authStore.factory.id;
          }
        }

        // 请求日志
        console.log(`🌐 API Request [${config.requestId}]:`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
          data: config.data
        });

        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        const requestId = response.config.requestId;
        
        console.log(`✅ API Response [${requestId}]:`, {
          status: response.status,
          data: response.data
        });

        // 标准化响应格式
        return {
          ...response,
          data: {
            data: response.data.data || response.data,
            status: response.status,
            message: response.data.message || 'Success',
            timestamp: Date.now(),
            requestId
          }
        };
      },
      async (error: AxiosError) => {
        const requestId = error.config?.requestId;
        
        console.error(`❌ API Error [${requestId}]:`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        return this.handleError(error);
      }
    );
  }

  private async handleError(error: AxiosError): Promise<never> {
    const config = error.config as ApiRequestConfig;
    
    // 401 未授权 - 尝试刷新token
    if (error.response?.status === 401 && !config.skipAuth) {
      try {
        const newToken = await TokenManager.refreshToken();
        if (newToken && config) {
          // 重试原请求
          config.headers = { ...config.headers, Authorization: `Bearer ${newToken}` };
          return this.axiosInstance.request(config);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // 跳转到登录页
        useAuthStore.getState().logout();
        throw new ApiError('AUTHENTICATION_FAILED', '认证失败，请重新登录', error);
      }
    }

    // 网络错误 - 添加到离线队列
    if (!navigator.onLine && config.offlineQueueable !== false) {
      return this.addToOfflineQueue(config);
    }

    // 其他错误 - 创建标准化错误
    throw this.createApiError(error);
  }

  // 生成请求ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 创建API错误
  private createApiError(error: AxiosError): ApiError {
    const status = error.response?.status || 0;
    const message = error.response?.data?.message || error.message;
    const code = this.getErrorCode(status);
    
    return new ApiError(code, message, error);
  }

  private getErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',  
      404: 'NOT_FOUND',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT'
    };
    
    return errorCodes[status] || 'UNKNOWN_ERROR';
  }

  // GET请求
  public async get<T = any>(
    url: string, 
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    // 检查缓存
    if (this.config.enableCache && !config.skipCache) {
      const cached = this.getFromCache(config.cacheKey || url);
      if (cached) {
        console.log(`💾 Cache hit for: ${url}`);
        return cached;
      }
    }

    const response = await this.axiosInstance.get<T>(url, config);
    
    // 缓存响应
    if (this.config.enableCache && !config.skipCache) {
      this.setCache(
        config.cacheKey || url, 
        response.data, 
        config.cacheTTL || this.config.cacheTimeout
      );
    }

    return response.data;
  }

  // POST请求
  public async post<T = any>(
    url: string, 
    data?: any, 
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  // PUT请求
  public async put<T = any>(
    url: string, 
    data?: any, 
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  // DELETE请求
  public async delete<T = any>(
    url: string, 
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  // 批量请求
  public async batch<T = any>(
    requests: Array<{ method: string; url: string; data?: any; config?: ApiRequestConfig }>
  ): Promise<ApiResponse<T>[]> {
    const promises = requests.map(req => {
      switch (req.method.toLowerCase()) {
        case 'get':
          return this.get(req.url, req.config);
        case 'post':
          return this.post(req.url, req.data, req.config);
        case 'put':
          return this.put(req.url, req.data, req.config);
        case 'delete':
          return this.delete(req.url, req.config);
        default:
          throw new Error(`Unsupported method: ${req.method}`);
      }
    });

    return Promise.all(promises);
  }

  // 缓存管理
  private getFromCache(key: string): any | null {
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    if (cached) {
      this.requestCache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  public clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.requestCache.keys()) {
        if (key.includes(pattern)) {
          this.requestCache.delete(key);
        }
      }
    } else {
      this.requestCache.clear();
    }
  }

  // 离线队列管理
  private async addToOfflineQueue(config: ApiRequestConfig): Promise<never> {
    if (!this.config.enableOfflineQueue) {
      throw new ApiError('NETWORK_ERROR', '网络不可用', new Error('Network unavailable'));
    }

    return new Promise((resolve, reject) => {
      this.offlineQueue.push({ config, resolve, reject });
      console.log(`📱 Added request to offline queue. Queue size: ${this.offlineQueue.length}`);
    });
  }

  public async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    console.log(`🔄 Processing offline queue: ${this.offlineQueue.length} requests`);

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const { config, resolve, reject } of queue) {
      try {
        const response = await this.axiosInstance.request(config);
        resolve(response.data);
      } catch (error) {
        reject(error);
      }
    }
  }

  // 获取客户端统计信息
  public getStats() {
    return {
      cacheSize: this.requestCache.size,
      offlineQueueSize: this.offlineQueue.length,
      config: this.config
    };
  }
}

// API错误类
export class ApiError extends Error {
  public code: string;
  public originalError?: Error;
  public status?: number;

  constructor(code: string, message: string, originalError?: Error) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.originalError = originalError;
    
    if (originalError && 'response' in originalError) {
      this.status = (originalError as any).response?.status;
    }
  }
}

// 创建默认API客户端实例
export const apiClient = new ApiClient();
```

#### 1.2 统一错误处理 (4小时)

**1.2.1 错误处理中心**
```tsx
// src/services/errorHandlingService.ts
import { ApiError } from './apiClient';
import { useErrorStore } from '@/stores/errorStore';
import { showNotification } from '@/utils/notifications';

export interface ErrorContext {
  userId?: string;
  route?: string;
  action?: string;
  timestamp: number;
  requestId?: string;
}

export interface ErrorReport {
  error: ApiError;
  context: ErrorContext;
  handled: boolean;
  retryCount: number;
}

export class ErrorHandlingService {
  private static errorReports: ErrorReport[] = [];
  private static maxReports = 100;

  // 统一错误处理入口
  static async handleError(
    error: ApiError | Error,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    const apiError = error instanceof ApiError ? error : new ApiError('UNKNOWN_ERROR', error.message, error);
    
    const fullContext: ErrorContext = {
      timestamp: Date.now(),
      ...context
    };

    const errorReport: ErrorReport = {
      error: apiError,
      context: fullContext,
      handled: false,
      retryCount: 0
    };

    // 记录错误报告
    this.addErrorReport(errorReport);

    // 根据错误类型处理
    await this.processError(errorReport);
  }

  private static addErrorReport(report: ErrorReport): void {
    this.errorReports.unshift(report);
    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(0, this.maxReports);
    }

    // 更新错误状态
    useErrorStore.getState().addError({
      id: this.generateErrorId(),
      message: report.error.message,
      code: report.error.code,
      timestamp: report.context.timestamp,
      context: report.context
    });
  }

  private static async processError(report: ErrorReport): Promise<void> {
    const { error, context } = report;

    console.error('🚨 Processing error:', {
      code: error.code,
      message: error.message,
      context
    });

    switch (error.code) {
      case 'AUTHENTICATION_FAILED':
        await this.handleAuthenticationError(report);
        break;

      case 'AUTHORIZATION_FAILED':
        await this.handleAuthorizationError(report);
        break;

      case 'NETWORK_ERROR':
        await this.handleNetworkError(report);
        break;

      case 'VALIDATION_ERROR':
        await this.handleValidationError(report);
        break;

      case 'RATE_LIMIT_EXCEEDED':
        await this.handleRateLimitError(report);
        break;

      case 'SERVICE_UNAVAILABLE':
        await this.handleServiceUnavailableError(report);
        break;

      default:
        await this.handleGenericError(report);
        break;
    }

    report.handled = true;
  }

  // 认证错误处理
  private static async handleAuthenticationError(report: ErrorReport): Promise<void> {
    showNotification({
      type: 'error',
      title: '认证失败',
      message: '您的登录已过期，请重新登录',
      duration: 5000
    });

    // 清除认证状态并跳转到登录页
    useAuthStore.getState().logout();
    // 这里需要根据导航系统实现跳转
  }

  // 授权错误处理
  private static async handleAuthorizationError(report: ErrorReport): Promise<void> {
    showNotification({
      type: 'warning',
      title: '权限不足',
      message: '您没有执行此操作的权限',
      duration: 4000
    });
  }

  // 网络错误处理
  private static async handleNetworkError(report: ErrorReport): Promise<void> {
    const isRetryable = report.retryCount < 3;
    
    if (isRetryable) {
      showNotification({
        type: 'info',
        title: '网络连接异常',
        message: `正在重试... (${report.retryCount + 1}/3)`,
        duration: 2000
      });
      
      // 实现重试逻辑
      report.retryCount++;
      // 这里可以重试原始请求
    } else {
      showNotification({
        type: 'error',
        title: '网络连接失败',
        message: '请检查您的网络连接并稍后重试',
        duration: 5000
      });
    }
  }

  // 验证错误处理
  private static async handleValidationError(report: ErrorReport): Promise<void> {
    let message = '请检查输入的数据格式';
    
    // 尝试解析具体的验证错误信息
    if (report.error.originalError && 'response' in report.error.originalError) {
      const responseData = (report.error.originalError as any).response?.data;
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        message = responseData.errors.map((err: any) => err.message).join('\n');
      } else if (responseData?.message) {
        message = responseData.message;
      }
    }

    showNotification({
      type: 'warning',
      title: '数据验证失败',
      message,
      duration: 4000
    });
  }

  // 速率限制错误处理
  private static async handleRateLimitError(report: ErrorReport): Promise<void> {
    showNotification({
      type: 'warning',
      title: '请求过于频繁',
      message: '请稍后再试',
      duration: 3000
    });

    // 可以实现退避重试策略
    setTimeout(() => {
      // 重试逻辑
    }, 5000);
  }

  // 服务不可用错误处理
  private static async handleServiceUnavailableError(report: ErrorReport): Promise<void> {
    showNotification({
      type: 'error',
      title: '服务暂不可用',
      message: '系统正在维护中，请稍后重试',
      duration: 5000
    });
  }

  // 通用错误处理
  private static async handleGenericError(report: ErrorReport): Promise<void> {
    showNotification({
      type: 'error',
      title: '操作失败',
      message: report.error.message || '发生了未知错误，请稍后重试',
      duration: 4000
    });
  }

  // 生成错误ID
  private static generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取错误报告
  static getErrorReports(limit?: number): ErrorReport[] {
    return limit ? this.errorReports.slice(0, limit) : [...this.errorReports];
  }

  // 清除错误报告
  static clearErrorReports(): void {
    this.errorReports = [];
    useErrorStore.getState().clearErrors();
  }

  // 错误统计
  static getErrorStats() {
    const reports = this.errorReports;
    const errorCounts = reports.reduce((acc, report) => {
      acc[report.error.code] = (acc[report.error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: reports.length,
      errorCounts,
      recentErrors: reports.slice(0, 5),
      handledErrors: reports.filter(r => r.handled).length,
      unhandledErrors: reports.filter(r => !r.handled).length
    };
  }
}

// 错误状态管理
interface ErrorState {
  errors: Array<{
    id: string;
    message: string;
    code: string;
    timestamp: number;
    context: ErrorContext;
    dismissed: boolean;
  }>;
  globalError: string | null;
  isOffline: boolean;
}

interface ErrorActions {
  addError: (error: Omit<ErrorState['errors'][0], 'dismissed'>) => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
  setGlobalError: (error: string | null) => void;
  setOfflineStatus: (isOffline: boolean) => void;
}

export const useErrorStore = create<ErrorState & ErrorActions>()((set, get) => ({
  errors: [],
  globalError: null,
  isOffline: false,

  addError: (error) => {
    const state = get();
    set({
      errors: [{ ...error, dismissed: false }, ...state.errors.slice(0, 50)]
    });
  },

  dismissError: (id) => {
    const state = get();
    set({
      errors: state.errors.map(error =>
        error.id === id ? { ...error, dismissed: true } : error
      )
    });
  },

  clearErrors: () => {
    set({ errors: [] });
  },

  setGlobalError: (error) => {
    set({ globalError: error });
  },

  setOfflineStatus: (isOffline) => {
    set({ isOffline });
  }
}));
```

### **Day 2: 请求状态管理和性能优化** (8小时)

#### 2.1 请求状态管理 (4小时)

**2.1.1 请求状态Hook**
```tsx
// src/hooks/useApiRequest.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiResponse, ApiRequestConfig } from '@/services/apiClient';
import { ErrorHandlingService } from '@/services/errorHandlingService';

export interface UseApiRequestOptions extends ApiRequestConfig {
  immediate?: boolean; // 是否立即执行
  pollingInterval?: number; // 轮询间隔（毫秒）
  dependencies?: any[]; // 依赖数组，变化时重新请求
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  transform?: (data: any) => any; // 数据转换函数
}

export interface UseApiRequestReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T>;
  refresh: () => Promise<T>;
  cancel: () => void;
  reset: () => void;
}

export function useApiRequest<T = any>(
  requestFn: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiRequestOptions = {}
): UseApiRequestReturn<T> {
  const {
    immediate = false,
    pollingInterval,
    dependencies = [],
    onSuccess,
    onError,
    transform,
    ...requestConfig
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cancelRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // 清理函数
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (cancelRef.current) {
        cancelRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (...args: any[]): Promise<T> => {
    if (!mountedRef.current) return Promise.reject(new Error('Component unmounted'));

    // 取消之前的请求
    if (cancelRef.current) {
      cancelRef.current.abort();
    }

    // 创建新的取消控制器
    cancelRef.current = new AbortController();
    
    setLoading(true);
    setError(null);

    try {
      const response = await requestFn(...args);
      
      if (!mountedRef.current) {
        return Promise.reject(new Error('Component unmounted'));
      }

      const transformedData = transform ? transform(response.data) : response.data;
      
      setData(transformedData);
      setLoading(false);
      
      onSuccess?.(transformedData);
      
      return transformedData;
    } catch (err: any) {
      if (!mountedRef.current) {
        return Promise.reject(err);
      }

      if (err.name !== 'AbortError') {
        setError(err);
        setLoading(false);
        
        // 统一错误处理
        await ErrorHandlingService.handleError(err, {
          action: 'api_request',
          requestId: Math.random().toString(36)
        });
        
        onError?.(err);
      }
      
      throw err;
    }
  }, [requestFn, transform, onSuccess, onError]);

  const refresh = useCallback(async (): Promise<T> => {
    return execute();
  }, [execute]);

  const cancel = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current.abort();
      cancelRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setData(null);
    setError(null);
    setLoading(false);
  }, [cancel]);

  // 立即执行
  useEffect(() => {
    if (immediate || dependencies.length > 0) {
      execute();
    }
  }, dependencies);

  // 轮询设置
  useEffect(() => {
    if (pollingInterval && pollingInterval > 0) {
      pollingRef.current = setInterval(() => {
        if (!loading) {
          execute();
        }
      }, pollingInterval);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [pollingInterval, loading, execute]);

  return {
    data,
    loading,
    error,
    execute,
    refresh,
    cancel,
    reset
  };
}

// 分页请求Hook
export interface UsePaginatedRequestOptions extends UseApiRequestOptions {
  initialPage?: number;
  pageSize?: number;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function usePaginatedRequest<T = any>(
  requestFn: (page: number, pageSize: number, ...args: any[]) => Promise<ApiResponse<PaginatedData<T>>>,
  options: UsePaginatedRequestOptions = {}
) {
  const { initialPage = 1, pageSize = 10, ...requestOptions } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [allData, setAllData] = useState<T[]>([]);

  const {
    data,
    loading,
    error,
    execute: executeOriginal,
    refresh,
    cancel,
    reset: resetOriginal
  } = useApiRequest(
    (page: number, size: number, ...args: any[]) => requestFn(page, size, ...args),
    {
      ...requestOptions,
      onSuccess: (paginatedData: PaginatedData<T>) => {
        if (currentPage === 1) {
          setAllData(paginatedData.items);
        } else {
          setAllData(prev => [...prev, ...paginatedData.items]);
        }
        requestOptions.onSuccess?.(paginatedData);
      }
    }
  );

  const loadPage = useCallback(async (page: number, ...args: any[]) => {
    setCurrentPage(page);
    return executeOriginal(page, pageSize, ...args);
  }, [executeOriginal, pageSize]);

  const loadMore = useCallback(async (...args: any[]) => {
    if (data?.hasMore) {
      return loadPage(currentPage + 1, ...args);
    }
  }, [data?.hasMore, currentPage, loadPage]);

  const reset = useCallback(() => {
    resetOriginal();
    setCurrentPage(initialPage);
    setAllData([]);
  }, [resetOriginal, initialPage]);

  return {
    data: data || { items: [], total: 0, page: currentPage, pageSize, hasMore: false },
    allData,
    loading,
    error,
    currentPage,
    loadPage,
    loadMore,
    refresh,
    cancel,
    reset
  };
}

// 批量请求Hook
export function useBatchRequest<T = any>(
  requests: Array<() => Promise<ApiResponse<T>>>,
  options: UseApiRequestOptions = {}
) {
  const [results, setResults] = useState<(T | Error)[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  const {
    loading,
    error,
    execute,
    cancel,
    reset
  } = useApiRequest(
    async () => {
      const promises = requests.map(async (requestFn, index) => {
        try {
          const response = await requestFn();
          setCompletedCount(prev => prev + 1);
          return response.data;
        } catch (err) {
          setCompletedCount(prev => prev + 1);
          return err as Error;
        }
      });

      const batchResults = await Promise.all(promises);
      setResults(batchResults);
      return batchResults;
    },
    options
  );

  const resetBatch = useCallback(() => {
    reset();
    setResults([]);
    setCompletedCount(0);
  }, [reset]);

  return {
    results,
    completedCount,
    totalCount: requests.length,
    progress: requests.length > 0 ? completedCount / requests.length : 0,
    loading,
    error,
    execute,
    cancel,
    reset: resetBatch
  };
}
```

#### 2.2 请求缓存和性能优化 (4小时)

**2.2.1 智能缓存系统**
```tsx
// src/services/cacheService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { compress, decompress } from 'lz-string';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // 生存时间（毫秒）
  version: string;
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  version?: string;
  storage?: 'memory' | 'persistent';
  maxSize?: number; // 最大缓存条目数
}

export class CacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private readonly STORAGE_PREFIX = 'cache_';
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分钟
  private readonly MAX_MEMORY_SIZE = 100;

  // 设置缓存
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const {
      ttl = this.DEFAULT_TTL,
      compress = false,
      version = '1.0',
      storage = 'memory',
      maxSize = this.MAX_MEMORY_SIZE
    } = options;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version,
      compressed: compress,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    if (storage === 'memory') {
      // 内存缓存
      this.memoryCache.set(key, entry);
      
      // 检查缓存大小限制
      if (this.memoryCache.size > maxSize) {
        this.evictLeastRecentlyUsed();
      }
    } else {
      // 持久化缓存
      try {
        let serializedData = JSON.stringify(entry);
        
        if (compress) {
          serializedData = compress(serializedData);
          entry.compressed = true;
        }
        
        await AsyncStorage.setItem(this.STORAGE_PREFIX + key, serializedData);
      } catch (error) {
        console.error('Failed to set persistent cache:', error);
        // 降级到内存缓存
        this.memoryCache.set(key, entry);
      }
    }
  }

  // 获取缓存
  async get<T>(key: string, options: Pick<CacheOptions, 'storage'> = {}): Promise<T | null> {
    const { storage = 'memory' } = options;

    let entry: CacheEntry<T> | null = null;

    if (storage === 'memory') {
      entry = this.memoryCache.get(key) || null;
    } else {
      try {
        const serializedData = await AsyncStorage.getItem(this.STORAGE_PREFIX + key);
        if (serializedData) {
          let parsedData = serializedData;
          
          // 尝试解压缩
          try {
            const decompressed = decompress(serializedData);
            if (decompressed) {
              parsedData = decompressed;
            }
          } catch {
            // 数据可能没有压缩
          }
          
          entry = JSON.parse(parsedData);
        }
      } catch (error) {
        console.error('Failed to get persistent cache:', error);
        return null;
      }
    }

    if (!entry) {
      return null;
    }

    // 检查缓存是否过期
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // 缓存已过期，删除它
      await this.delete(key, { storage });
      return null;
    }

    // 更新访问统计
    entry.accessCount++;
    entry.lastAccessed = now;

    if (storage === 'memory') {
      this.memoryCache.set(key, entry);
    }

    return entry.data;
  }

  // 删除缓存
  async delete(key: string, options: Pick<CacheOptions, 'storage'> = {}): Promise<void> {
    const { storage = 'memory' } = options;

    if (storage === 'memory') {
      this.memoryCache.delete(key);
    } else {
      try {
        await AsyncStorage.removeItem(this.STORAGE_PREFIX + key);
      } catch (error) {
        console.error('Failed to delete persistent cache:', error);
      }
    }
  }

  // 清除所有缓存
  async clear(options: Pick<CacheOptions, 'storage'> = {}): Promise<void> {
    const { storage = 'memory' } = options;

    if (storage === 'memory') {
      this.memoryCache.clear();
    } else {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith(this.STORAGE_PREFIX));
        await AsyncStorage.multiRemove(cacheKeys);
      } catch (error) {
        console.error('Failed to clear persistent cache:', error);
      }
    }
  }

  // 获取缓存统计信息
  async getStats(storage: 'memory' | 'persistent' = 'memory') {
    if (storage === 'memory') {
      const entries = Array.from(this.memoryCache.values());
      return {
        size: this.memoryCache.size,
        totalAccess: entries.reduce((sum, entry) => sum + entry.accessCount, 0),
        averageAge: entries.length > 0 
          ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length 
          : 0,
        hitRate: this.calculateHitRate()
      };
    } else {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith(this.STORAGE_PREFIX));
        return {
          size: cacheKeys.length,
          keys: cacheKeys.map(key => key.replace(this.STORAGE_PREFIX, ''))
        };
      } catch (error) {
        console.error('Failed to get persistent cache stats:', error);
        return { size: 0, keys: [] };
      }
    }
  }

  // 淘汰最少使用的缓存条目
  private evictLeastRecentlyUsed(): void {
    if (this.memoryCache.size === 0) return;

    let lruKey = '';
    let oldestAccess = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.memoryCache.delete(lruKey);
      console.log(`Evicted cache entry: ${lruKey}`);
    }
  }

  // 计算缓存命中率（简化实现）
  private hitRequestCount = 0;
  private totalRequestCount = 0;

  private calculateHitRate(): number {
    return this.totalRequestCount > 0 ? this.hitRequestCount / this.totalRequestCount : 0;
  }

  // 缓存预热
  async warmup(entries: Array<{ key: string; data: any; options?: CacheOptions }>): Promise<void> {
    const promises = entries.map(entry => 
      this.set(entry.key, entry.data, entry.options)
    );
    
    await Promise.all(promises);
    console.log(`Cache warmed up with ${entries.length} entries`);
  }

  // 批量获取
  async getMultiple<T>(keys: string[], options: Pick<CacheOptions, 'storage'> = {}): Promise<Record<string, T | null>> {
    const promises = keys.map(async key => {
      const value = await this.get<T>(key, options);
      return [key, value] as [string, T | null];
    });

    const results = await Promise.all(promises);
    return Object.fromEntries(results);
  }

  // 批量设置
  async setMultiple(
    entries: Array<{ key: string; data: any; options?: CacheOptions }>
  ): Promise<void> {
    const promises = entries.map(entry => 
      this.set(entry.key, entry.data, entry.options)
    );
    
    await Promise.all(promises);
  }
}

// 创建全局缓存服务实例
export const cacheService = new CacheService();

// 缓存装饰器Hook
export function useCachedRequest<T = any>(
  key: string,
  requestFn: () => Promise<ApiResponse<T>>,
  options: UseApiRequestOptions & CacheOptions = {}
) {
  const { ttl, storage = 'memory', ...requestOptions } = options;

  return useApiRequest(
    async () => {
      // 尝试从缓存获取
      const cached = await cacheService.get<T>(key, { storage });
      if (cached) {
        console.log(`Cache hit for key: ${key}`);
        return { data: cached } as ApiResponse<T>;
      }

      // 缓存未命中，执行请求
      console.log(`Cache miss for key: ${key}`);
      const response = await requestFn();
      
      // 缓存响应数据
      await cacheService.set(key, response.data, { ttl, storage });
      
      return response;
    },
    requestOptions
  );
}
```

## 🏆 交付物

### 技术交付物
- [ ] **智能API客户端** (apiClient.ts) - 完整的HTTP客户端
- [ ] **统一错误处理** (errorHandlingService.ts) - 错误处理中心
- [ ] **请求状态管理** (useApiRequest.ts) - 请求状态Hook
- [ ] **智能缓存系统** (cacheService.ts) - 多层级缓存
- [ ] **离线队列支持** - 网络恢复后自动重试
- [ ] **请求性能优化** - 请求合并、防抖、缓存

### 功能交付物
- [ ] **自动Token管理** - Token自动附加和刷新
- [ ] **网络重试机制** - 智能重试和退避策略
- [ ] **离线数据支持** - 离线队列和数据同步
- [ ] **请求状态追踪** - 加载、错误、成功状态管理
- [ ] **批量请求支持** - 多请求并发处理
- [ ] **分页请求支持** - 分页数据加载和合并

### 性能交付物
- [ ] **请求缓存机制** - 内存和持久化双重缓存
- [ ] **请求去重** - 相同请求自动去重
- [ ] **数据压缩** - 大数据自动压缩存储
- [ ] **智能预加载** - 预测性数据加载
- [ ] **性能监控** - 请求性能和错误统计

## ✅ 验收标准

### 功能完整性验证
- [ ] API客户端正确处理所有HTTP方法
- [ ] Token自动管理和刷新正常工作
- [ ] 错误处理覆盖所有错误类型
- [ ] 离线队列在网络恢复后正确处理
- [ ] 缓存系统正确存储和检索数据

### 性能验证
- [ ] 请求响应时间在可接受范围
- [ ] 缓存命中率 > 70%
- [ ] 内存使用保持稳定
- [ ] 网络请求数量得到优化
- [ ] 离线到在线切换流畅

### 可靠性验证
- [ ] 网络异常时系统稳定运行
- [ ] 大量并发请求时性能稳定
- [ ] 错误恢复机制有效
- [ ] 数据一致性得到保证
- [ ] 内存泄漏和资源清理正确

### 安全性验证
- [ ] Token安全传输和存储
- [ ] 敏感数据不被缓存
- [ ] 请求参数正确验证
- [ ] 响应数据安全处理

## 📊 时间分配

| 阶段 | 内容 | 预计时间 | 关键交付物 |
|------|------|----------|-----------|
| Day 1 上午 | 智能API客户端 | 4小时 | apiClient.ts |
| Day 1 下午 | 统一错误处理 | 4小时 | errorHandlingService.ts |
| Day 2 上午 | 请求状态管理 | 4小时 | useApiRequest.ts |
| Day 2 下午 | 缓存和性能优化 | 4小时 | cacheService.ts |
| **总计** | **API客户端系统完整实现** | **16小时** | **完整API服务** |

## 🚨 风险与对策

### 技术风险
- **风险**: 网络请求性能影响用户体验
- **对策**: 智能缓存、请求合并、预加载机制

- **风险**: 离线队列数据丢失
- **对策**: 持久化存储、数据完整性检查

- **风险**: 缓存数据过期不一致
- **对策**: 智能缓存策略、版本控制机制

### 安全风险
- **风险**: Token泄露或被截获
- **对策**: 安全存储、HTTPS强制、Token定期刷新

- **风险**: 缓存中包含敏感数据
- **对策**: 敏感数据不缓存、缓存加密

### 性能风险
- **风险**: 缓存占用过多内存
- **对策**: LRU淘汰策略、内存监控

- **风险**: 大量并发请求影响性能
- **对策**: 请求队列、限流机制

## 🔄 与其他任务的接口

### 输入依赖
- **TASK-RN-003**: 认证架构和Token管理
- **TASK-RN-004**: 登录系统和用户状态
- **TASK-RN-005**: 权限控制系统

### 输出到后续任务
- **TASK-RN-008**: 用户管理界面使用API客户端
- **TASK-RN-009**: 基础组件库集成API状态
- **所有业务模块**: 使用API客户端进行数据交互

## 📝 开发检查点

### Day 1 检查点
- [ ] API客户端基础功能是否完整
- [ ] Token管理和刷新是否正常
- [ ] 错误处理机制是否有效
- [ ] 请求拦截器和响应拦截器是否工作

### Day 2 检查点
- [ ] 请求状态管理是否稳定
- [ ] 缓存系统是否高效
- [ ] 离线队列是否可靠
- [ ] 整体性能是否满足要求

## 📞 技术支持

**负责人**: [待分配]
**技术支持**: [项目技术负责人]
**参考资料**: 
- Axios文档: https://axios-http.com/
- React Query最佳实践
- 移动端网络优化指南

---

**任务创建时间**: 2025-08-05
**计划开始时间**: TASK-RN-006完成后
**计划完成时间**: 开始后2个工作日

*此任务是所有业务功能的数据基础，提供可靠高效的API交互能力。*