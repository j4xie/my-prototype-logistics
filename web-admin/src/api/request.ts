/**
 * Axios 请求封装
 * 统一处理请求拦截、响应拦截、错误处理
 * 注意：不在顶层导入 element-plus，避免循环依赖
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, ApiError } from '@/types/api';

// 动态导入 ElMessage，避免循环依赖
// Apr 18 2026 UX 优化: error 类 toast 默认 3s 闪过对业务流程错误 (库存不足/并发冲突/
// 批次未分配) 太短 — 用户需时间看清具体原因 + 去依赖流程处理. 改成 duration: 0 (sticky,
// 必须用户手动关) + showClose: true. warning/success/info 保持 3s.
const showMessage = async (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error') => {
  const { ElMessage } = await import('element-plus');
  ElMessage({
    message,
    type,
    duration: type === 'error' ? 0 : 3000,
    showClose: type === 'error',
  });
};

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/mobile',
  timeout: 30000,
  withCredentials: true, // Send HttpOnly cookies with every request
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'web' // Tells backend to use cookie-based auth
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
    // Add Authorization header from localStorage token
    const token = localStorage.getItem('cretas_access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
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
  resolve: () => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data;

    // Defensive: reject HTML responses that leaked through (routing misconfiguration).
    // When an API URL hits a non-proxied path, Vite SPA fallback returns index.html
    // with 200 OK. Without this guard, axios returns {success:true, data:"<HTML>"}
    // and downstream code silently iterates characters of the HTML string.
    // See R20-F2: workflow-designer rendered 766 empty 📦 tiles for this reason.
    if (typeof data === 'string' && data.trimStart().startsWith('<')) {
      const url = response.config?.url || '(unknown)';
      const msg = `API 路由错误: ${url} 返回了 HTML (期望 JSON). 检查后端 @RequestMapping 或 nginx 代理规则.`;
      showMessage(msg, 'error');
      return Promise.reject(new ApiError(msg, 'ROUTING_ERROR'));
    }

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
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _silent?: boolean };
    const status = error.response?.status;

    // 401 未授权 - 尝试刷新 token via cookie
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 如果正在刷新，将请求加入队列
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Cookie is already refreshed by the server, just retry
            return request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is in an HttpOnly cookie scoped to the refresh path.
        // The server reads it from the cookie and sets updated cookies in the response.
        const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          `${import.meta.env.VITE_API_BASE_URL || '/api/mobile'}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: { 'X-Client-Type': 'web' }
          }
        );

        if (response.data.success) {
          // Update localStorage fallback token
          const newToken = (response.data.data as Record<string, string>)?.accessToken
            || (response.data.data as Record<string, string>)?.token;
          if (newToken) {
            localStorage.setItem('cretas_access_token', newToken);
          }
          processQueue(null);
          return request(originalRequest);
        } else {
          throw new Error('Token refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError as Error);

        // 刷新失败，清除本地状态并跳转登录
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
    // Allow callers to suppress error toast via _silent config flag
    if (!originalRequest._silent) {
      showMessage(message, 'error');
    }

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

// Admin API 便捷方法 — 绕过 /api/mobile baseURL，直接使用绝对路径
// 用于 /api/admin/* 等非 /api/mobile 前缀的后端接口
const adminBaseURL = import.meta.env.VITE_API_BASE_URL ? '' : '';
export const adminGet = <T>(url: string, config?: object): Promise<ApiResponse<T>> => {
  return request.get(url, { ...config, baseURL: adminBaseURL });
};
export const adminPost = <T>(url: string, data?: object, config?: object): Promise<ApiResponse<T>> => {
  return request.post(url, data, { ...config, baseURL: adminBaseURL });
};
export const adminPut = <T>(url: string, data?: object): Promise<ApiResponse<T>> => {
  return request.put(url, data, { baseURL: adminBaseURL });
};
export const adminDel = <T>(url: string): Promise<ApiResponse<T>> => {
  return request.delete(url, { baseURL: adminBaseURL });
};
