/**
 * 跨平台API客户端
 */

import { apiConfig } from '../config/api-config';
import { logger } from '../utils/logger';
import { AppError, ErrorType } from '../utils/error-handler';
import { Platform } from '../utils/helpers';

/**
 * API客户端接口
 */
export interface IApiClient {
  get<T = any>(url: string, config?: RequestConfig): Promise<T>;
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: RequestConfig): Promise<T>;
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  
  setAuthToken(token: string): void;
  removeAuthToken(): void;
  setBaseURL(baseURL: string): void;
  setTimeout(timeout: number): void;
}

/**
 * 请求配置
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  signal?: AbortSignal;
}

/**
 * 响应结构
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * 跨平台API客户端实现
 */
export class ApiClient implements IApiClient {
  private config = apiConfig.getConfig();
  private interceptors: {
    request: ((config: any) => any)[];
    response: ((response: any) => any)[];
    error: ((error: any) => any)[];
  } = {
    request: [],
    response: [],
    error: [],
  };

  constructor() {
    // 添加默认拦截器
    this.addDefaultInterceptors();
  }

  /**
   * GET请求
   */
  async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('GET', url, undefined, config);
  }

  /**
   * POST请求
   */
  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>('POST', url, data, config);
  }

  /**
   * PUT请求
   */
  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>('PUT', url, data, config);
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  /**
   * PATCH请求
   */
  async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>('PATCH', url, data, config);
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<T> {
    const fullUrl = this.buildUrl(url);
    const requestConfig = this.buildRequestConfig(method, data, config);
    
    let retries = config?.retries ?? this.config.retries;
    let lastError: Error;

    while (retries >= 0) {
      try {
        // 应用请求拦截器
        const finalConfig = await this.applyRequestInterceptors(requestConfig);
        
        // 发送请求
        const response = await this.sendRequest(fullUrl, finalConfig);
        
        // 应用响应拦截器
        const finalResponse = await this.applyResponseInterceptors(response);
        
        return finalResponse.data;
      } catch (error) {
        lastError = error as Error;
        
        // 应用错误拦截器
        await this.applyErrorInterceptors(lastError);
        
        // 判断是否需要重试
        if (retries > 0 && this.shouldRetry(lastError)) {
          retries--;
          await this.delay(this.config.retryDelay);
          continue;
        }
        
        throw this.normalizeError(lastError, method, fullUrl);
      }
    }

    throw this.normalizeError(lastError!, method, fullUrl);
  }

  /**
   * 发送请求（跨平台实现）
   */
  private async sendRequest(url: string, config: any): Promise<ApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 解析响应头
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // 解析响应体
      let data: any;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.blob();
      }

      // 构建响应对象
      const apiResponse: ApiResponse = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers,
      };

      // 检查HTTP状态
      if (!response.ok) {
        throw new AppError(
          `HTTP ${response.status}: ${response.statusText}`,
          ErrorType.API,
          'HTTP_ERROR',
          response.status,
          apiResponse
        );
      }

      return apiResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new AppError(
          'Request timeout',
          ErrorType.TIMEOUT,
          'REQUEST_TIMEOUT'
        );
      }
      
      throw error;
    }
  }

  /**
   * 构建完整URL
   */
  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    const baseURL = this.config.baseURL.endsWith('/') 
      ? this.config.baseURL.slice(0, -1) 
      : this.config.baseURL;
    
    const endpoint = url.startsWith('/') ? url : `/${url}`;
    
    return `${baseURL}${endpoint}`;
  }

  /**
   * 构建请求配置
   */
  private buildRequestConfig(method: string, data?: any, config?: RequestConfig): any {
    const headers = {
      ...this.config.headers,
      ...config?.headers,
    };

    const requestConfig: any = {
      method: method.toUpperCase(),
      headers,
      timeout: config?.timeout ?? this.config.timeout,
    };

    // 添加请求体
    if (data !== undefined && method.toUpperCase() !== 'GET') {
      if (typeof data === 'object' && !(data instanceof FormData)) {
        requestConfig.body = JSON.stringify(data);
      } else {
        requestConfig.body = data;
      }
    }

    return requestConfig;
  }

  /**
   * 应用请求拦截器
   */
  private async applyRequestInterceptors(config: any): Promise<any> {
    let result = config;
    
    for (const interceptor of this.interceptors.request) {
      try {
        result = await interceptor(result);
      } catch (error) {
        logger.warn('Request interceptor error', 'ApiClient', error);
      }
    }
    
    return result;
  }

  /**
   * 应用响应拦截器
   */
  private async applyResponseInterceptors(response: ApiResponse): Promise<ApiResponse> {
    let result = response;
    
    for (const interceptor of this.interceptors.response) {
      try {
        result = await interceptor(result);
      } catch (error) {
        logger.warn('Response interceptor error', 'ApiClient', error);
      }
    }
    
    return result;
  }

  /**
   * 应用错误拦截器
   */
  private async applyErrorInterceptors(error: Error): Promise<void> {
    for (const interceptor of this.interceptors.error) {
      try {
        await interceptor(error);
      } catch (interceptorError) {
        logger.warn('Error interceptor error', 'ApiClient', interceptorError);
      }
    }
  }

  /**
   * 添加默认拦截器
   */
  private addDefaultInterceptors(): void {
    // 请求日志拦截器
    this.interceptors.request.push((config) => {
      logger.debug(`API Request: ${config.method} ${config.url}`, 'ApiClient', {
        headers: config.headers,
        data: config.body,
      });
      return config;
    });

    // 响应日志拦截器
    this.interceptors.response.push((response) => {
      logger.debug(`API Response: ${response.status}`, 'ApiClient', {
        status: response.status,
        headers: response.headers,
      });
      return response;
    });

    // 错误日志拦截器
    this.interceptors.error.push((error) => {
      logger.error('API Error', 'ApiClient', error);
    });
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error): boolean {
    if (error instanceof AppError) {
      // 网络错误可以重试
      if (error.type === ErrorType.NETWORK || error.type === ErrorType.TIMEOUT) {
        return true;
      }
      
      // 5xx错误可以重试
      if (error.statusCode && error.statusCode >= 500) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: Error, method: string, url: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // 网络错误
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new AppError(
        'Network connection failed',
        ErrorType.NETWORK,
        'NETWORK_ERROR',
        undefined,
        { method, url, originalError: error }
      );
    }

    // 超时错误
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return new AppError(
        'Request timeout',
        ErrorType.TIMEOUT,
        'REQUEST_TIMEOUT',
        undefined,
        { method, url, originalError: error }
      );
    }

    // 默认API错误
    return new AppError(
      error.message || 'API request failed',
      ErrorType.API,
      'API_ERROR',
      undefined,
      { method, url, originalError: error }
    );
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(token: string): void {
    apiConfig.setAuthHeader(token);
    this.config = apiConfig.getConfig();
  }

  /**
   * 移除认证令牌
   */
  removeAuthToken(): void {
    apiConfig.removeAuthHeader();
    this.config = apiConfig.getConfig();
  }

  /**
   * 设置基础URL
   */
  setBaseURL(baseURL: string): void {
    apiConfig.setBaseURL(baseURL);
    this.config = apiConfig.getConfig();
  }

  /**
   * 设置超时时间
   */
  setTimeout(timeout: number): void {
    apiConfig.setTimeout(timeout);
    this.config = apiConfig.getConfig();
  }

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(interceptor: (config: any) => any): number {
    this.interceptors.request.push(interceptor);
    return this.interceptors.request.length - 1;
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(interceptor: (response: ApiResponse) => ApiResponse): number {
    this.interceptors.response.push(interceptor);
    return this.interceptors.response.length - 1;
  }

  /**
   * 添加错误拦截器
   */
  addErrorInterceptor(interceptor: (error: Error) => void): number {
    this.interceptors.error.push(interceptor);
    return this.interceptors.error.length - 1;
  }
}

/**
 * 默认API客户端实例
 */
export const apiClient = new ApiClient();

// 默认导出
export default apiClient;