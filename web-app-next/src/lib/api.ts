// Mock配置导入 (TASK-P3-018C Day 1)
import { getApiConfig, checkMockHealth, getMockEnabledFromURL, type ApiConfig, type MockHealthStatus } from './api-config';

/**
 * HTTP响应类型
 */
// 注释：ApiResponse接口供其他模块使用，目前用于类型导出
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
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
 * API客户端配置
 */
interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * 请求选项
 */
interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

/**
 * 增强API客户端 - 支持Mock/Real API透明切换
 *
 * @description TASK-P3-018C改造：基于P3-018B中央Mock服务的API客户端
 * @features Mock感知、环境自适应、Schema版本检查
 */
class ApiClient {
  private config: ApiClientConfig;
  private authToken: string | null = null;
  private mockConfig: ApiConfig;
  private mockHealthStatus: MockHealthStatus | null = null;
  private lastHealthCheck: number = 0;
  private readonly healthCheckInterval = 30000; // 30秒健康检查间隔

  constructor(config: Partial<ApiClientConfig> = {}) {
    // 获取Mock配置
    this.mockConfig = getApiConfig();

    // URL参数可以覆盖环境变量
    const urlMockEnabled = getMockEnabledFromURL();
    if (urlMockEnabled !== null) {
      this.mockConfig.mockEnabled = urlMockEnabled;
    }

    this.config = {
      baseURL: this.mockConfig.baseURL,
      timeout: this.mockConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
      retryAttempts: this.mockConfig.retryAttempts,
      retryDelay: 1000,
      ...config,
    };

    // 初始化Mock健康检查
    if (this.mockConfig.mockEnabled && this.mockConfig.mockHealthCheck) {
      this.checkMockHealthStatus();
    }
  }

  /**
   * 检查Mock服务健康状态 - 简化版，避免循环依赖
   */
  private checkMockHealthStatus(): void {
    const now = Date.now();

    // 避免频繁检查
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return;
    }

    // 使用简化的健康检查，不再async
    this.mockHealthStatus = checkMockHealth();
    this.lastHealthCheck = now;

    // 开发环境输出Mock状态
    if (process.env.NODE_ENV === 'development') {
      console.info(`[API Client] Mock Status: ${this.mockHealthStatus.available ? '✅' : '❌'} (${this.mockHealthStatus.handlers} handlers)`);
    }
  }

  /**
   * 获取当前API模式
   */
  public getApiMode(): { mode: 'mock' | 'real' | 'fallback'; healthy: boolean } {
    if (!this.mockConfig.mockEnabled) {
      return { mode: 'real', healthy: true };
    }

    if (this.mockHealthStatus?.available) {
      return { mode: 'mock', healthy: true };
    }

    return { mode: 'fallback', healthy: false };
  }

  /**
   * 获取Mock健康状态
   */
  public getMockHealth(): MockHealthStatus | null {
    return this.mockHealthStatus;
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

    // 从localStorage获取token（如果有的话）
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth-token');
    }

    return null;
  }

  /**
   * 构建请求头
   */
  private buildHeaders(options: RequestOptions = {}): HeadersInit {
    const headers: Record<string, string> = {
      ...this.config.headers,
      ...options.headers,
    };

    // 添加认证头
    if (!options.skipAuth) {
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
  private async handleResponse<T>(response: Response): Promise<T> {
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
      } catch (responseError) {
        console.error('响应解析失败:', responseError);
        throw new ApiError('响应解析失败', 500, 'Parse Error');
      }

      throw new ApiError(errorMessage, response.status, 'HTTP_ERROR', response);
    }

    try {
      if (isJson) {
        return await response.json();
      } else {
        return await response.text() as unknown as T;
      }
    } catch (responseError) {
      console.error('响应解析失败:', responseError);
      throw new ApiError('响应解析失败', 500, 'Parse Error');
    }
  }

  /**
   * 执行带重试的请求
   */
  private async requestWithRetry<T>(
    url: string,
    options: RequestInit,
    requestOptions: RequestOptions = {}
  ): Promise<T> {
    const maxAttempts = this.config.retryAttempts;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, requestOptions.timeout || this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return await this.handleResponse<T>(response);

      } catch (error) {
        lastError = error as Error;

        // 如果是最后一次尝试，抛出错误
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
   * 通用请求方法
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(options);

    const requestOptions: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };

    // 添加请求体（除了GET和HEAD请求）
    if (data && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      return await this.requestWithRetry<T>(url, requestOptions, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * POST请求
   */
  async post<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }

  /**
   * PUT请求
   */
  async put<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  /**
   * PATCH请求
   */
  async patch<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  /**
   * 上传文件
   */
  async uploadFile<T = any>(
    endpoint: string,
    file: File,
    fieldName: string = 'file',
    options: RequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders({ ...options, headers: {} }); // 移除Content-Type，让浏览器自动设置

    const formData = new FormData();
    formData.append(fieldName, file);

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: headers as Record<string, string>,
      body: formData,
    };

    try {
      return await this.requestWithRetry<T>(url, requestOptions, options);
    } catch (error) {
      console.error('文件上传失败:', error);
      throw error;
    }
  }
}

/**
 * 导出API客户端实例
 */
export const apiClient = new ApiClient();

/**
 * 认证相关API
 */
export const authApi = {
  /**
   * 用户登录
   */
  login: (credentials: { username: string; password: string }) =>
    apiClient.post('/auth/login', credentials),

  /**
   * 用户登出
   */
  logout: () => apiClient.post('/auth/logout'),

  /**
   * 获取用户信息
   */
  getUser: () => apiClient.get('/auth/user'),

  /**
   * 刷新Token
   */
  refreshToken: () => apiClient.post('/auth/refresh'),

  /**
   * 获取用户权限
   */
  getPermissions: () => apiClient.get('/auth/permissions'),
};

/**
 * 溯源查询相关API
 */
export const traceApi = {
  /**
   * 获取批次信息
   */
  getBatchInfo: (batchId: string) =>
    apiClient.get(`/trace/batch/${batchId}`),

  /**
   * 搜索批次
   */
  searchBatches: (query: string) =>
    apiClient.get(`/trace/search?q=${encodeURIComponent(query)}`),

  /**
   * 获取搜索历史
   */
  getSearchHistory: () => apiClient.get('/trace/history'),

  /**
   * 添加搜索记录
   */
  addSearchRecord: (batchId: string) =>
    apiClient.post('/trace/history', { batchId }),
};

/**
 * 仪表板相关API
 */
export const dashboardApi = {
  /**
   * 获取统计数据
   */
  getStats: () => apiClient.get('/dashboard/stats'),

  /**
   * 获取概览数据
   */
  getOverview: (timeRange?: string) =>
    apiClient.get(`/dashboard/overview${timeRange ? `?range=${timeRange}` : ''}`),

  /**
   * 获取报告数据
   */
  getReports: (filters: any) =>
    apiClient.post('/dashboard/reports', filters),

  /**
   * 刷新数据
   */
  refreshData: () =>
    apiClient.post('/dashboard/refresh'),
};

/**
 * 养殖管理相关API - MVP核心功能
 */
export const farmingApi = {
  /**
   * 获取养殖批次列表
   */
  getBatches: () => apiClient.get('/farming/batches'),

  /**
   * 获取特定批次数据
   */
  getBatchData: (batchId: string) => apiClient.get(`/farming/batch/${batchId}`),

  /**
   * 获取环境数据
   */
  getEnvironmentData: (timeRange?: string) => {
    const params = timeRange ? `?timeRange=${timeRange}` : '';
    return apiClient.get(`/farming/environment${params}`);
  },

  /**
   * 获取健康指标
   */
  getHealthMetrics: (batchId?: string) => {
    const params = batchId ? `?batchId=${batchId}` : '';
    return apiClient.get(`/farming/health-metrics${params}`);
  },

  /**
   * 获取疫苗记录
   */
  getVaccineRecords: (batchId?: string) => {
    const params = batchId ? `?batchId=${batchId}` : '';
    return apiClient.get(`/farming/vaccine${params}`);
  },

  /**
   * 获取繁育信息
   */
  getBreedingInfo: (batchId?: string) => {
    const params = batchId ? `?batchId=${batchId}` : '';
    return apiClient.get(`/farming/breeding${params}`);
  },

  /**
   * 获取饲料管理记录
   */
  getFeedManagement: () => apiClient.get('/farming/feed-management'),

  /**
   * 获取环境控制设置
   */
  getEnvironmentControl: () => apiClient.get('/farming/environment-control'),

  /**
   * 获取养殖记录（原有功能保持）
   */
  getRecords: () => apiClient.get('/farming/records'),
};

/**
 * 生产加工相关API - MVP核心功能
 */
export const processingApi = {
  /**
   * 获取质量报告
   */
  getQualityReports: (params?: Record<string, any>) => {
    const queryParams = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get(`/processing/quality-reports${queryParams}`);
  },

  /**
   * 获取生产计划
   */
  getProductionSchedule: (dateRange?: string) => {
    const params = dateRange ? `?dateRange=${dateRange}` : '';
    return apiClient.get(`/processing/schedule${params}`);
  },

  /**
   * 获取设备状态
   */
  getEquipmentStatus: () => apiClient.get('/processing/equipment'),

  /**
   * 获取加工记录
   */
  getProcessingRecords: (batchId?: string) => {
    const params = batchId ? `?batchId=${batchId}` : '';
    return apiClient.get(`/processing/records${params}`);
  },

  /**
   * 获取包装信息
   */
  getPackagingInfo: (batchId: string) => apiClient.get(`/processing/packaging/${batchId}`),

  /**
   * 获取温度日志
   */
  getTemperatureLogs: (timeRange?: string) => {
    const params = timeRange ? `?timeRange=${timeRange}` : '';
    return apiClient.get(`/processing/temperature${params}`);
  },

  /**
   * 获取安全检查记录
   */
  getSafetyChecks: () => apiClient.get('/processing/safety-check'),

  /**
   * 获取质量标准
   */
  getQualityStandards: () => apiClient.get('/processing/quality-standards'),

  /**
   * 获取合规检查
   */
  getComplianceCheck: () => apiClient.get('/processing/compliance-check'),

  /**
   * 获取加工批次（原有功能保持）
   */
  getBatches: () => apiClient.get('/processing/batches'),

  /**
   * 获取加工记录（原有功能保持兼容）
   */
  getRecords: () => apiClient.get('/processing/records'),
};

/**
 * AI数据分析相关API - MVP关键功能
 */
export const aiAnalyticsApi = {
  /**
   * 生产数据洞察分析
   */
  getProductionInsights: (params: {
    batchId?: string;
    timeRange?: string;
    analysisType?: 'efficiency' | 'quality' | 'cost' | 'all';
  }) => apiClient.post('/ai/production-insights', params),

  /**
   * 获取优化建议
   */
  getOptimizationSuggestions: (data: {
    processType: 'farming' | 'processing' | 'logistics';
    currentData: Record<string, any>;
    targetMetrics?: string[];
  }) => apiClient.post('/ai/optimize', data),

  /**
   * 预测分析
   */
  getPredictiveAnalysis: (dataset: {
    type: 'yield' | 'quality' | 'timeline' | 'cost';
    inputData: Record<string, any>;
    predictionPeriod?: string;
  }) => apiClient.post('/ai/predict', dataset),

  /**
   * 数据聚合分析
   */
  getDataAggregation: (config: {
    sources: string[]; // ['farming', 'processing', 'logistics']
    timeRange: string;
    aggregationType: 'summary' | 'detailed' | 'comparison';
  }) => apiClient.post('/ai/aggregate', config),

  /**
   * 实时监控分析
   */
  getRealtimeAnalysis: (monitoringConfig: {
    modules: string[];
    alertThresholds?: Record<string, number>;
  }) => apiClient.post('/ai/realtime-analysis', monitoringConfig),

  /**
   * AI模型状态检查
   */
  getModelStatus: () => apiClient.get('/ai/model-status'),

  /**
   * 获取AI分析历史
   */
  getAnalysisHistory: (params?: { limit?: number; offset?: number }) => {
    const queryParams = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return apiClient.get(`/ai/analysis-history${queryParams}`);
  },
};

/**
 * 批量数据处理相关API
 */
export const dataProcessingApi = {
  /**
   * 批量获取历史数据
   */
  getBatchHistoricalData: (request: {
    modules: string[];
    startDate: string;
    endDate: string;
    batchSize?: number;
  }) => apiClient.post('/data/batch-historical', request),

  /**
   * 数据预处理
   */
  preprocessData: (config: {
    dataSource: string;
    processingRules: Record<string, any>;
    outputFormat?: 'json' | 'csv' | 'chart';
  }) => apiClient.post('/data/preprocess', config),

  /**
   * 获取数据导出状态
   */
  getExportStatus: (exportId: string) => apiClient.get(`/data/export/${exportId}`),

  /**
   * 数据质量检查
   */
  checkDataQuality: (dataSource: string) => apiClient.post('/data/quality-check', { dataSource }),
};

export const logisticsApi = {
  /**
   * 获取物流信息
   */
  getShipments: () => apiClient.get('/logistics/shipments'),

  /**
   * 跟踪货物
   */
  trackShipment: (trackingId: string) =>
    apiClient.get(`/logistics/tracking/${trackingId}`),
};
