import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError,
  InternalAxiosRequestConfig 
} from 'axios';
import { Alert } from 'react-native';
import { TokenManager } from '../tokenManager';
import { NetworkManager } from '../networkManager';
import { SmartNavigationService } from '../../navigation/SmartNavigationService';

// API响应类型
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  code?: number;
  success: boolean;
  timestamp?: string;
}

// API错误类型
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

// 请求配置扩展
export interface EnhancedRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipRetry?: boolean;
  skipErrorHandling?: boolean;
  retryCount?: number;
  maxRetries?: number;
  retryDelay?: number;
  offlineSupport?: boolean;
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
}

// 请求队列项
interface QueuedRequest {
  config: EnhancedRequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
  priority: number;
}

// 重试策略配置
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  retryCondition?: (error: AxiosError) => boolean;
}

/**
 * 增强型API客户端
 * 提供自动Token管理、请求重试、离线支持等功能
 */
export class EnhancedApiClient {
  private axiosInstance: AxiosInstance;
  private tokenRefreshPromise: Promise<any> | null = null;
  private requestQueue: QueuedRequest[] = [];
  private isRefreshingToken = false;
  private offlineQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private networkManager: NetworkManager;

  // 配置参数
  private readonly DEFAULT_TIMEOUT = 30000; // 30秒
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1秒
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly REQUEST_TIMEOUT_LONG = 60000; // 60秒，用于文件上传等
  
  constructor(baseURL: string) {
    this.networkManager = NetworkManager;
    
    // 创建axios实例
    this.axiosInstance = axios.create({
      baseURL,
      timeout: this.DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    // 设置拦截器
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();

    // 监听网络状态变化
    this.setupNetworkListener();
  }

  /**
   * 设置请求拦截器
   */
  private setupRequestInterceptor() {
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          // 添加请求ID用于追踪
          config.headers['X-Request-ID'] = this.generateRequestId();
          
          // 添加时间戳
          config.headers['X-Timestamp'] = Date.now().toString();

          // 自动添加认证Token
          if (!(config as EnhancedRequestConfig).skipAuth) {
            const token = await TokenManager.getValidToken();
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          }

          // 添加设备信息
          config.headers['X-Device-Type'] = 'mobile';
          config.headers['X-Platform'] = 'react-native';
          config.headers['X-App-Version'] = '1.0.0';

          // 处理请求优先级
          const priority = (config as EnhancedRequestConfig).priority || 'medium';
          config.headers['X-Priority'] = priority;

          // 网络质量自适应
          const networkQuality = await this.networkManager.getNetworkQuality();
          if (networkQuality.responseTime > 2000) {
            // 网络较慢时增加超时时间
            config.timeout = this.REQUEST_TIMEOUT_LONG;
          }

          console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            requestId: config.headers['X-Request-ID'],
            priority,
            timeout: config.timeout
          });

          return config;
        } catch (error) {
          console.error('Request interceptor error:', error);
          return config;
        }
      },
      (error: AxiosError) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 设置响应拦截器
   */
  private setupResponseInterceptor() {
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // 记录成功响应
        console.log(`API Response Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          requestId: response.config.headers['X-Request-ID'],
          responseTime: this.calculateResponseTime(response)
        });

        // 处理业务逻辑错误
        if (response.data && response.data.code && response.data.code !== 200) {
          const error = new Error(response.data.message || 'Business logic error');
          (error as any).isBusinessError = true;
          (error as any).code = response.data.code;
          (error as any).data = response.data;
          return Promise.reject(error);
        }

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as EnhancedRequestConfig;
        
        console.error(`API Response Error: ${config?.method?.toUpperCase()} ${config?.url}`, {
          status: error.response?.status,
          message: error.message,
          requestId: config?.headers?.['X-Request-ID']
        });

        // 处理不同类型的错误
        if (error.response) {
          return this.handleHttpError(error);
        } else if (error.request) {
          return this.handleNetworkError(error);
        } else {
          return this.handleRequestError(error);
        }
      }
    );
  }

  /**
   * 处理HTTP错误
   */
  private async handleHttpError(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;
    const status = error.response?.status;

    switch (status) {
      case 401:
        return this.handle401Error(error);
      case 403:
        return this.handle403Error(error);
      case 404:
        return this.handle404Error(error);
      case 429:
        return this.handle429Error(error);
      case 500:
      case 502:
      case 503:
      case 504:
        return this.handle5xxError(error);
      default:
        return this.handleGenericError(error);
    }
  }

  /**
   * 处理401未授权错误
   */
  private async handle401Error(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;

    // 如果已经在刷新Token，将请求加入队列
    if (this.isRefreshingToken) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          config,
          resolve,
          reject,
          timestamp: Date.now(),
          priority: this.getPriorityValue(config.priority || 'medium')
        });
      });
    }

    try {
      this.isRefreshingToken = true;
      
      // 尝试刷新Token
      const refreshed = await TokenManager.refreshTokens();
      
      if (refreshed) {
        // 重试原请求
        const newToken = await TokenManager.getValidToken();
        if (newToken && config) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${newToken}`;
          
          // 处理队列中的请求
          this.processRequestQueue();
          
          return this.axiosInstance(config);
        }
      }
      
      // 刷新失败，清空队列并跳转到登录页
      this.clearRequestQueue();
      SmartNavigationService.navigate('Auth');
      
      return Promise.reject(new Error('Token refresh failed, please login again'));
      
    } finally {
      this.isRefreshingToken = false;
    }
  }

  /**
   * 处理403权限不足错误
   */
  private async handle403Error(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;
    
    if (!config?.skipErrorHandling) {
      Alert.alert(
        '权限不足',
        '您没有访问此资源的权限',
        [
          { text: '确定', onPress: () => SmartNavigationService.goBack() }
        ]
      );
    }
    
    return Promise.reject(error);
  }

  /**
   * 处理404未找到错误
   */
  private async handle404Error(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;
    
    if (!config?.skipErrorHandling) {
      console.warn('API endpoint not found:', config?.url);
    }
    
    return Promise.reject(error);
  }

  /**
   * 处理429限流错误
   */
  private async handle429Error(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;
    const retryAfter = error.response?.headers['retry-after'];
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
    
    if (!config?.skipRetry && (config?.retryCount || 0) < (config?.maxRetries || this.DEFAULT_MAX_RETRIES)) {
      await this.delay(delay);
      return this.retryRequest(config);
    }
    
    return Promise.reject(error);
  }

  /**
   * 处理5xx服务器错误
   */
  private async handle5xxError(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;
    
    if (!config?.skipRetry && (config?.retryCount || 0) < (config?.maxRetries || this.DEFAULT_MAX_RETRIES)) {
      return this.retryRequest(config);
    }
    
    if (!config?.skipErrorHandling) {
      Alert.alert(
        '服务器错误',
        '服务暂时不可用，请稍后重试',
        [
          { text: '重试', onPress: () => this.retryRequest(config) },
          { text: '取消' }
        ]
      );
    }
    
    return Promise.reject(error);
  }

  /**
   * 处理网络错误
   */
  private async handleNetworkError(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;
    const isOnline = await this.networkManager.isConnected();
    
    if (!isOnline) {
      // 离线模式处理
      if (config?.offlineSupport) {
        return this.addToOfflineQueue(config);
      } else {
        Alert.alert(
          '网络连接失败',
          '请检查您的网络连接',
          [
            { text: '重试', onPress: () => this.retryRequest(config) },
            { text: '取消' }
          ]
        );
      }
    } else {
      // 网络连接正常但请求失败，可能是超时
      if (!config?.skipRetry && (config?.retryCount || 0) < (config?.maxRetries || this.DEFAULT_MAX_RETRIES)) {
        return this.retryRequest(config);
      }
    }
    
    return Promise.reject(error);
  }

  /**
   * 处理请求配置错误
   */
  private async handleRequestError(error: AxiosError): Promise<any> {
    console.error('Request configuration error:', error.message);
    return Promise.reject(error);
  }

  /**
   * 处理通用错误
   */
  private async handleGenericError(error: AxiosError): Promise<any> {
    const config = error.config as EnhancedRequestConfig;
    
    if (!config?.skipErrorHandling) {
      console.error('Generic API error:', error.message);
    }
    
    return Promise.reject(error);
  }

  /**
   * 重试请求
   */
  private async retryRequest(config: EnhancedRequestConfig): Promise<any> {
    const retryConfig = { ...config };
    retryConfig.retryCount = (retryConfig.retryCount || 0) + 1;
    
    const delay = retryConfig.retryDelay || this.DEFAULT_RETRY_DELAY;
    const exponentialDelay = delay * Math.pow(2, retryConfig.retryCount - 1);
    
    await this.delay(exponentialDelay);
    
    return this.axiosInstance(retryConfig);
  }

  /**
   * 设置网络监听
   */
  private setupNetworkListener() {
    // 监听网络状态变化
    setInterval(async () => {
      const isOnline = await this.networkManager.isConnected();
      
      if (isOnline && this.offlineQueue.length > 0 && !this.isProcessingQueue) {
        this.processOfflineQueue();
      }
    }, 5000);
  }

  /**
   * 处理离线队列
   */
  private async processOfflineQueue() {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      // 按优先级和时间排序
      this.offlineQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // 高优先级先执行
        }
        return a.timestamp - b.timestamp; // 时间早的先执行
      });
      
      const batchSize = 5; // 每批处理5个请求
      
      while (this.offlineQueue.length > 0) {
        const batch = this.offlineQueue.splice(0, batchSize);
        
        await Promise.allSettled(
          batch.map(async (item) => {
            try {
              const response = await this.axiosInstance(item.config);
              item.resolve(response);
            } catch (error) {
              item.reject(error);
            }
          })
        );
        
        // 批次间短暂延迟，避免服务器压力过大
        if (this.offlineQueue.length > 0) {
          await this.delay(1000);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * 添加到离线队列
   */
  private addToOfflineQueue(config: EnhancedRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      // 检查队列大小限制
      if (this.offlineQueue.length >= this.MAX_QUEUE_SIZE) {
        // 移除最旧的低优先级请求
        const lowPriorityIndex = this.offlineQueue.findIndex(
          item => item.priority === this.getPriorityValue('low')
        );
        if (lowPriorityIndex !== -1) {
          const removed = this.offlineQueue.splice(lowPriorityIndex, 1)[0];
          removed.reject(new Error('Request removed from offline queue'));
        } else {
          reject(new Error('Offline queue is full'));
          return;
        }
      }

      this.offlineQueue.push({
        config,
        resolve,
        reject,
        timestamp: Date.now(),
        priority: this.getPriorityValue(config.priority || 'medium')
      });
    });
  }

  /**
   * 处理请求队列
   */
  private processRequestQueue() {
    this.requestQueue.forEach(async (item) => {
      try {
        const response = await this.axiosInstance(item.config);
        item.resolve(response);
      } catch (error) {
        item.reject(error);
      }
    });
    
    this.requestQueue = [];
  }

  /**
   * 清空请求队列
   */
  private clearRequestQueue() {
    this.requestQueue.forEach(item => {
      item.reject(new Error('Request cancelled due to authentication failure'));
    });
    this.requestQueue = [];
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 计算响应时间
   */
  private calculateResponseTime(response: AxiosResponse): number {
    const requestTime = response.config.headers['X-Timestamp'];
    if (requestTime) {
      return Date.now() - parseInt(requestTime);
    }
    return 0;
  }

  /**
   * 获取优先级数值
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 公共API方法
  
  /**
   * GET请求
   */
  public async get<T = any>(
    url: string, 
    config?: EnhancedRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * POST请求
   */
  public async post<T = any>(
    url: string, 
    data?: any, 
    config?: EnhancedRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * PUT请求
   */
  public async put<T = any>(
    url: string, 
    data?: any, 
    config?: EnhancedRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * DELETE请求
   */
  public async delete<T = any>(
    url: string, 
    config?: EnhancedRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * PATCH请求
   */
  public async patch<T = any>(
    url: string, 
    data?: any, 
    config?: EnhancedRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * 文件上传
   */
  public async upload<T = any>(
    url: string, 
    file: any, 
    config?: EnhancedRequestConfig
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const uploadConfig: EnhancedRequestConfig = {
      ...config,
      timeout: this.REQUEST_TIMEOUT_LONG,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers
      }
    };

    const response = await this.axiosInstance.post<ApiResponse<T>>(
      url, 
      formData, 
      uploadConfig
    );
    return response.data;
  }

  /**
   * 批量请求
   */
  public async batch<T = any>(
    requests: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      url: string;
      data?: any;
      config?: EnhancedRequestConfig;
    }>
  ): Promise<ApiResponse<T>[]> {
    const promises = requests.map(req => {
      switch (req.method) {
        case 'GET':
          return this.get(req.url, req.config);
        case 'POST':
          return this.post(req.url, req.data, req.config);
        case 'PUT':
          return this.put(req.url, req.data, req.config);
        case 'DELETE':
          return this.delete(req.url, req.config);
        case 'PATCH':
          return this.patch(req.url, req.data, req.config);
        default:
          throw new Error(`Unsupported method: ${req.method}`);
      }
    });

    return Promise.all(promises);
  }

  /**
   * 获取请求统计信息
   */
  public getStats() {
    return {
      queueSize: this.requestQueue.length,
      offlineQueueSize: this.offlineQueue.length,
      isRefreshingToken: this.isRefreshingToken,
      isProcessingQueue: this.isProcessingQueue
    };
  }

  /**
   * 清理资源
   */
  public cleanup() {
    this.clearRequestQueue();
    this.offlineQueue = [];
    this.tokenRefreshPromise = null;
    this.isRefreshingToken = false;
    this.isProcessingQueue = false;
  }
}

// 创建默认实例
const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
export const apiClient = new EnhancedApiClient(baseURL);

export default apiClient;