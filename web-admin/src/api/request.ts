/**
 * Axios 请求封装
 * 统一处理请求拦截、响应拦截、错误处理
 * 注意：不在顶层导入 element-plus，避免循环依赖
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, ApiError } from '@/types/api';

// 动态导入 ElMessage，避免循环依赖
const showMessage = async (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error') => {
  const { ElMessage } = await import('element-plus');
  ElMessage({ message, type });
};

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/mobile',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 延迟获取 router（避免循环依赖）
const getRouter = async () => {
  const router = await import('@/router');
  return router.default;
};

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 获取 token（从 localStorage 直接读取，避免 store 依赖问题）
    const token = localStorage.getItem('cretas_access_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // FormData 时删除 Content-Type，让浏览器自动设置 multipart/form-data
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Token 刷新状态
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data;

    // 如果响应已经是标准格式
    if (data && typeof data.success === 'boolean') {
      if (!data.success) {
        showMessage(data.message || '操作失败', 'error');
        return Promise.reject(new ApiError(data.message, data.code));
      }
      return data;
    }

    // 包装为标准格式
    return {
      success: true,
      data: data,
      message: 'OK'
    };
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    // 401 未授权 - 尝试刷新 token
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 如果正在刷新，将请求加入队列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('cretas_refresh_token');

        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // 刷新 token
        const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          `${import.meta.env.VITE_API_BASE_URL || '/api/mobile'}/auth/refresh`,
          { refreshToken }
        );

        if (response.data.success && response.data.data) {
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;

          // 保存新 token
          localStorage.setItem('cretas_access_token', accessToken);
          localStorage.setItem('cretas_refresh_token', newRefreshToken);

          processQueue(null, accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return request(originalRequest);
        } else {
          throw new Error('Token refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError as Error, null);

        // 刷新失败，清除认证状态并跳转登录
        localStorage.removeItem('cretas_access_token');
        localStorage.removeItem('cretas_refresh_token');
        localStorage.removeItem('cretas_user');

        // 延迟跳转，避免循环依赖
        setTimeout(async () => {
          const router = await getRouter();
          router.push('/login');
        }, 0);

        showMessage('登录已过期，请重新登录', 'error');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 禁止访问
    if (status === 403) {
      showMessage('您没有权限执行此操作', 'error');
      return Promise.reject(new ApiError('权限不足', 'FORBIDDEN', 403));
    }

    // 其他错误
    const message = error.response?.data?.message || error.message || '网络请求失败';
    showMessage(message, 'error');

    return Promise.reject(new ApiError(message, error.response?.data?.code, status));
  }
);

export default request;

// 便捷方法
export const get = <T>(url: string, config?: object): Promise<ApiResponse<T>> => {
  return request.get(url, config);
};

export const post = <T>(url: string, data?: object, config?: object): Promise<ApiResponse<T>> => {
  return request.post(url, data, config);
};

export const put = <T>(url: string, data?: object): Promise<ApiResponse<T>> => {
  return request.put(url, data);
};

export const del = <T>(url: string): Promise<ApiResponse<T>> => {
  return request.delete(url);
};
