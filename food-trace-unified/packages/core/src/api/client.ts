// API客户端核心
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../platform/logger';
import { ErrorHandler, NetworkError, ApiError } from '../utils/error';
import { getCoreConfig } from '../core';
import type { ApiResponse, ApiError as ApiErrorType } from '../types/api';

// API客户端类
export class ApiClient {
  private axios: AxiosInstance;
  private baseURL: string;
  private timeout: number;

  constructor(config: { baseURL: string; timeout?: number }) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 10000;
    
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // 请求拦截器
    this.axios.interceptors.request.use(
      (config) => {
        // 添加认证Token
        try {
          const coreConfig = getCoreConfig();
          const authStore = globalThis.__AUTH_STORE__;
          if (authStore?.token?.accessToken) {
            config.headers.Authorization = `Bearer ${authStore.token.accessToken}`;
          }
        } catch {
          // 如果获取token失败，继续请求
        }

        // 添加请求ID用于日志追踪
        config.metadata = { requestId: Date.now().toString() };
        
        logger.debug('API Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
          data: config.data
        });

        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('API Response:', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Token过期自动刷新
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const authStore = globalThis.__AUTH_STORE__;
            if (authStore?.refreshToken) {
              await authStore.refreshToken();
              return this.axios(originalRequest);
            }
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError);
            // 刷新失败，清除认证状态
            try {
              const authStore = globalThis.__AUTH_STORE__;
              authStore?.logout();
            } catch {}
          }
        }

        logger.error('API Error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
        });

        return Promise.reject(ErrorHandler.handleApiError(error));
      }
    );
  }

  // GET请求
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw ErrorHandler.handleApiError(error);
    }
  }

  // POST请求
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw ErrorHandler.handleApiError(error);
    }
  }

  // PUT请求
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw ErrorHandler.handleApiError(error);
    }
  }

  // DELETE请求
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw ErrorHandler.handleApiError(error);
    }
  }

  // PATCH请求
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw ErrorHandler.handleApiError(error);
    }
  }

  // 上传文件
  async upload<T = any>(
    url: string, 
    file: File | Blob, 
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.axios.post<ApiResponse<T>>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        }
      });

      return response.data;
    } catch (error) {
      throw ErrorHandler.handleApiError(error);
    }
  }

  // 下载文件
  async download(url: string, filename?: string): Promise<void> {
    try {
      const response = await this.axios.get(url, {
        responseType: 'blob'
      });

      // 创建下载链接
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      throw ErrorHandler.handleApiError(error);
    }
  }

  // 取消请求
  createCancelToken() {
    const source = axios.CancelToken.source();
    return {
      token: source.token,
      cancel: source.cancel
    };
  }

  // 设置默认Header
  setDefaultHeader(key: string, value: string): void {
    this.axios.defaults.headers.common[key] = value;
  }

  // 移除默认Header
  removeDefaultHeader(key: string): void {
    delete this.axios.defaults.headers.common[key];
  }

  // 设置认证Token
  setAuthToken(token: string): void {
    this.setDefaultHeader('Authorization', `Bearer ${token}`);
  }

  // 清除认证Token
  clearAuthToken(): void {
    this.removeDefaultHeader('Authorization');
  }
}

// 创建默认API客户端实例
let defaultApiClient: ApiClient;

export const createApiClient = (config?: { baseURL?: string; timeout?: number }): ApiClient => {
  try {
    const coreConfig = getCoreConfig();
    const clientConfig = {
      baseURL: config?.baseURL || coreConfig.apiBaseUrl,
      timeout: config?.timeout || 10000
    };
    return new ApiClient(clientConfig);
  } catch {
    // 如果core未初始化，返回临时实例
    return new ApiClient({
      baseURL: config?.baseURL || 'http://localhost:3000',
      timeout: config?.timeout || 10000
    });
  }
};

export const getApiClient = (): ApiClient => {
  if (!defaultApiClient) {
    defaultApiClient = createApiClient();
  }
  return defaultApiClient;
};

// 快捷API方法
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => 
    getApiClient().get<T>(url, config),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    getApiClient().post<T>(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    getApiClient().put<T>(url, data, config),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => 
    getApiClient().delete<T>(url, config),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    getApiClient().patch<T>(url, data, config),
  
  upload: <T = any>(url: string, file: File | Blob, onProgress?: (progress: number) => void) => 
    getApiClient().upload<T>(url, file, onProgress),
  
  download: (url: string, filename?: string) => 
    getApiClient().download(url, filename)
};