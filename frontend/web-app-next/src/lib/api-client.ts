/**
 * 最小可行API客户端 (基于需求重新评估的结果)
 *
 * @version 1.0.0
 * @description 专注于核心业务需求，避免过度工程化
 * @features 基础HTTP方法、认证管理、错误处理、重试机制、文件上传
 */

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  fromCache?: boolean;
  fromOfflineQueue?: boolean;
}

/**
 * API错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 网络错误类
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * 最小API客户端配置
 */
interface MinimalApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retryAttempts?: number;
  retryDelay?: number;
  enableInterceptors?: boolean;
  // 兼容性属性（忽略实现）
  enableOfflineQueue?: boolean;
  useMockData?: boolean;
  mockDelay?: number;
}

/**
 * 请求配置
 */
interface RequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retries?: number;
  // 兼容性属性（简化实现）
  priority?: any; // OperationPriority
  forceOnline?: boolean;
  forceOffline?: boolean;
  skipQueue?: boolean;
  fromOfflineQueue?: boolean;
}

// 兼容性枚举
export enum OperationMode {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AUTO = 'auto'
}

/**
 * 请求/响应拦截器类型 (简化版本)
 */
type RequestInterceptor = (config: any) => any;
type ResponseInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T>;
type ErrorInterceptor = (error: Error) => Error | Promise<never>;

/**
 * 最小可行API客户端
 * 兼容ExtendedApiClient接口，但实现简化
 */
export class MinimalApiClient {
  private config: Required<MinimalApiClientConfig>;
  private authToken: string | null = null;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private currentMode: OperationMode = OperationMode.AUTO;

  constructor(config: MinimalApiClientConfig = {}) {
    // 强制使用本地后端，忽略所有环境变量
    const forceLocalBackend = 'http://localhost:3001';
    console.log('[API Client] 强制使用本地后端:', forceLocalBackend);

    this.config = {
      baseURL: forceLocalBackend,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      retryAttempts: 3,
      retryDelay: 1000,
      enableInterceptors: true,
      enableOfflineQueue: false,
      useMockData: false,
      mockDelay: 0,
      ...config,
      // 确保baseURL不被覆盖
      baseURL: forceLocalBackend,
    };
  }

  // 兼容性方法
  setMode(mode: OperationMode): void {
    this.currentMode = mode;
    console.log(`[MinimalApiClient] 模式设置为: ${mode} (简化实现)`);
  }

  getMode(): OperationMode {
    return this.currentMode;
  }

  /**
   * 兼容性方法：通用请求方法
   */
  async request<T = any>(config: {
    method: string;
    endpoint?: string;
    url?: string;
    data?: any;
    options?: RequestConfig;
  }): Promise<ApiResponse<T>> {
    const { method, endpoint, url, data, options = {} } = config;
    const finalEndpoint = endpoint || url || '';
    return this.requestWithRetry<T>(method, finalEndpoint, data, options);
  }

  /**
   * 设置认证token
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /**
   * 获取认证token
   */
  private getAuthToken(): string | null {
    if (this.authToken) {
      return this.authToken;
    }

    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth-token');
    }

    return null;
  }

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    if (this.config.enableInterceptors) {
      this.requestInterceptors.push(interceptor);
    }
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    if (this.config.enableInterceptors) {
      this.responseInterceptors.push(interceptor);
    }
  }

  /**
   * 添加错误拦截器
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    if (this.config.enableInterceptors) {
      this.errorInterceptors.push(interceptor);
    }
  }

  /**
   * 构建请求头
   */
  private buildHeaders(config: RequestConfig = {}): HeadersInit {
    const headers: Record<string, string> = {
      ...this.config.headers,
      ...config.headers,
    };

    if (!config.skipAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * 构建完整URL
   */
  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    return `${this.config.baseURL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  }

  /**
   * 处理响应
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        if (isJson) {
          const errorResponse = await response.json();
          errorMessage = errorResponse.message || errorMessage;
        } else {
          errorMessage = await response.text() || errorMessage;
        }
      } catch {
        // 忽略解析错误，使用默认错误消息
      }

      const error = new ApiError(errorMessage, response.status, 'HTTP_ERROR', response);

      // 应用错误拦截器
      if (this.config.enableInterceptors) {
        for (const interceptor of this.errorInterceptors) {
          try {
            const processedError = interceptor(error);
            if (processedError instanceof Promise) {
              await processedError;
            }
          } catch (interceptedError) {
            throw interceptedError;
          }
        }
      }

      throw error;
    }

    let data: T;
    try {
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text() as unknown as T;
      }
    } catch {
      throw new ApiError('响应解析失败', 500, 'PARSE_ERROR');
    }

    const apiResponse: ApiResponse<T> = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      fromCache: false,
      fromOfflineQueue: false,
    };

    // 应用响应拦截器
    if (this.config.enableInterceptors) {
      let processedResponse = apiResponse;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = interceptor(processedResponse);
      }
      return processedResponse;
    }

    return apiResponse;
  }

  /**
   * 执行带重试的请求
   */
  private async requestWithRetry<T>(
    method: string,
    endpoint: string,
    data?: any,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const maxAttempts = config.retries ?? this.config.retryAttempts;
    const url = this.buildUrl(endpoint);
    let lastError: Error;

    // 详细的调试日志
    console.log('[API Client] 请求详情:', {
      method: method.toUpperCase(),
      endpoint,
      url,
      baseURL: this.config.baseURL,
      data: data ? JSON.stringify(data).substring(0, 100) + '...' : 'null',
      timestamp: new Date().toISOString()
    });

    // 应用请求拦截器
    let requestConfig = { ...config, url, method, data: data || null };
    if (this.config.enableInterceptors) {
      for (const interceptor of this.requestInterceptors) {
        requestConfig = interceptor(requestConfig);
      }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, config.timeout || this.config.timeout);

        const headers = this.buildHeaders(config);
        const requestOptions: RequestInit = {
          method: method.toUpperCase(),
          headers,
          signal: controller.signal,
        };

        if (data && !['GET', 'HEAD'].includes(method.toUpperCase())) {
          requestOptions.body = JSON.stringify(data);
        }

        const response = await fetch(requestConfig.url, requestOptions);
        clearTimeout(timeoutId);

        return await this.handleResponse<T>(response);

      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new NetworkError(`请求超时 (${this.config.timeout}ms)`);
          }
          throw lastError;
        }

        // 等待重试延迟
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }

    throw lastError!;
  }

  /**
   * GET请求
   */
  async get<T = any>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>('GET', endpoint, undefined, config);
  }

  /**
   * POST请求
   */
  async post<T = any>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>('POST', endpoint, data, config);
  }

  /**
   * PUT请求
   */
  async put<T = any>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>('PUT', endpoint, data, config);
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>('DELETE', endpoint, undefined, config);
  }

  /**
   * PATCH请求
   */
  async patch<T = any>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>('PATCH', endpoint, data, config);
  }

  /**
   * 上传文件
   */
  async uploadFile<T = any>(
    endpoint: string,
    file: File,
    fieldName: string = 'file',
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders({ ...config, headers: {} }); // 移除Content-Type

    const formData = new FormData();
    formData.append(fieldName, file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.timeout || this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers as Record<string, string>,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 兼容性方法：获取统计信息（简化版本）
   */
  async getStats(): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    onlineRequests: number;
    offlineRequests: number;
    errors: number;
  }> {
    // 返回基础统计信息
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      onlineRequests: 0,
      offlineRequests: 0,
      errors: 0,
    };
  }

  /**
   * 兼容性方法：触发同步（空实现）
   */
  async triggerSync(): Promise<void> {
    console.log('[MinimalApiClient] 同步功能未启用，跳过');
  }

  /**
   * 兼容性方法：获取队列状态（空实现）
   */
  async getQueueStatus(): Promise<{ size: number; pending: number; failed: number }> {
    return { size: 0, pending: 0, failed: 0 };
  }

  /**
   * 兼容性方法：销毁客户端
   */
  destroy(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
    console.log('[MinimalApiClient] 客户端已清理');
  }
}

/**
 * 兼容性类型别名
 */
export class ExtendedApiClient extends MinimalApiClient {}
export type ExtendedApiClientConfig = MinimalApiClientConfig;

/**
 * 工厂函数
 */
export function createExtendedApiClient(config?: MinimalApiClientConfig): ExtendedApiClient {
  return new ExtendedApiClient(config);
}

/**
 * 默认客户端实例
 */
export const extendedApiClient = new ExtendedApiClient();
