/**
 * useApi Hook系统 - 完整实现
 * 
 * @description 提供完整的API Hook系统，包括业务Hook、缓存管理和错误处理
 * @created Phase-3技术栈现代化 - TASK-P3-016A
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { authService, traceService, productService, userService, dashboardService } from '@/services/http-service';

// 缓存系统
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟默认TTL

/**
 * API状态类型
 */
export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * API Hook返回类型
 */
export interface ApiHookResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  status: ApiStatus;
  refetch: () => Promise<void>;
  cancel: () => void;
}

/**
 * API Hook配置
 */
export interface ApiHookConfig {
  immediate?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  retry?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * 基础API Hook
 */
export function useBaseApi<T>(
  apiCall: (signal?: AbortSignal) => Promise<T>,
  config: ApiHookConfig = {}
): ApiHookResult<T> {
  const {
    immediate = false,
    cacheKey,
    cacheTTL = CACHE_TTL,
    retry = false,
    retryAttempts = 3,
    retryDelay = 1000
  } = config;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<ApiStatus>('idle');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  // 检查缓存
  const getCachedData = useCallback((): T | null => {
    if (!cacheKey) return null;
    
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    
    if (cached) {
      cache.delete(cacheKey);
    }
    
    return null;
  }, [cacheKey]);

  // 设置缓存
  const setCachedData = useCallback((data: T) => {
    if (cacheKey) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: cacheTTL
      });
    }
  }, [cacheKey, cacheTTL]);

  // 执行API调用
  const execute = useCallback(async () => {
    // 检查缓存
    const cachedData = getCachedData();
    if (cachedData) {
      setData(cachedData);
      setStatus('success');
      setError(null);
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setStatus('loading');
    setError(null);

    try {
      const result = await apiCall(abortControllerRef.current.signal);
      
      if (!abortControllerRef.current.signal.aborted) {
        setData(result);
        setStatus('success');
        setCachedData(result);
        retryCountRef.current = 0;
      }
    } catch (err) {
      if (!abortControllerRef.current.signal.aborted) {
        const error = err as Error;
        
        // 重试逻辑
        if (retry && retryCountRef.current < retryAttempts && error.name !== 'AbortError') {
          retryCountRef.current++;
          setTimeout(() => {
            execute();
          }, retryDelay * retryCountRef.current);
          return;
        }
        
        setError(error);
        setStatus('error');
        retryCountRef.current = 0;
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setLoading(false);
      }
    }
  }, [apiCall, getCachedData, setCachedData, retry, retryAttempts, retryDelay]);

  // 取消请求
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setStatus('idle');
    }
  }, []);

  // 重新获取
  const refetch = useCallback(async () => {
    await execute();
  }, [execute]);

  // 自动执行
  useEffect(() => {
    if (immediate) {
      execute();
    }

    return () => {
      cancel();
    };
  }, [immediate, execute, cancel]);

  return {
    data,
    loading,
    error,
    status,
    refetch,
    cancel
  };
}

/**
 * 认证相关Hook
 */
export function useAuth() {
  const login = useCallback((credentials: { username: string; password: string; rememberMe?: boolean }) => {
    return useBaseApi(() => authService.login(credentials), {
      immediate: false,
      cacheKey: undefined // 登录不缓存
    });
  }, []);

  const logout = useCallback(() => {
    return useBaseApi(() => authService.logout(), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  const getCurrentUser = useCallback(() => {
    return useBaseApi(() => authService.getCurrentUser(), {
      immediate: false,
      cacheKey: 'current-user',
      cacheTTL: 10 * 60 * 1000 // 10分钟
    });
  }, []);

  const getPermissions = useCallback(() => {
    return useBaseApi(() => authService.getPermissions(), {
      immediate: false,
      cacheKey: 'user-permissions',
      cacheTTL: 15 * 60 * 1000 // 15分钟
    });
  }, []);

  return {
    login,
    logout,
    getCurrentUser,
    getPermissions
  };
}

/**
 * 溯源相关Hook
 */
export function useTrace() {
  const getTraces = useCallback((params?: any) => {
    const cacheKey = params ? `traces-${JSON.stringify(params)}` : 'traces';
    return useBaseApi(() => traceService.getTraces(params), {
      immediate: false,
      cacheKey,
      retry: true
    });
  }, []);

  const getTrace = useCallback((id: string) => {
    return useBaseApi(() => traceService.getTrace(id), {
      immediate: false,
      cacheKey: `trace-${id}`,
      retry: true
    });
  }, []);

  const createTrace = useCallback((data: any) => {
    return useBaseApi(() => traceService.createTrace(data), {
      immediate: false,
      cacheKey: undefined // 创建操作不缓存
    });
  }, []);

  const updateTrace = useCallback((id: string, data: any) => {
    return useBaseApi(() => traceService.updateTrace(id, data), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  const deleteTrace = useCallback((id: string) => {
    return useBaseApi(() => traceService.deleteTrace(id), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  const verifyTrace = useCallback((id: string, verificationCode?: string) => {
    return useBaseApi(() => traceService.verifyTrace(id, verificationCode), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  const searchTraces = useCallback((query: string, filters?: any) => {
    const cacheKey = `search-traces-${query}-${JSON.stringify(filters)}`;
    return useBaseApi(() => traceService.searchTraces(query, filters), {
      immediate: false,
      cacheKey,
      cacheTTL: 2 * 60 * 1000 // 搜索结果缓存2分钟
    });
  }, []);

  return {
    getTraces,
    getTrace,
    createTrace,
    updateTrace,
    deleteTrace,
    verifyTrace,
    searchTraces
  };
}

/**
 * 产品相关Hook
 */
export function useProduct() {
  const getProducts = useCallback((params?: any) => {
    const cacheKey = params ? `products-${JSON.stringify(params)}` : 'products';
    return useBaseApi(() => productService.getProducts(params), {
      immediate: false,
      cacheKey,
      retry: true
    });
  }, []);

  const getProduct = useCallback((id: string) => {
    return useBaseApi(() => productService.getProduct(id), {
      immediate: false,
      cacheKey: `product-${id}`,
      retry: true
    });
  }, []);

  const getCategories = useCallback(() => {
    return useBaseApi(() => productService.getCategories(), {
      immediate: false,
      cacheKey: 'product-categories',
      cacheTTL: 30 * 60 * 1000 // 分类缓存30分钟
    });
  }, []);

  const createProduct = useCallback((data: any) => {
    return useBaseApi(() => productService.createProduct(data), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  return {
    getProducts,
    getProduct,
    getCategories,
    createProduct
  };
}

/**
 * 用户相关Hook
 */
export function useUser() {
  const getProfile = useCallback(() => {
    return useBaseApi(() => userService.getProfile(), {
      immediate: false,
      cacheKey: 'user-profile',
      cacheTTL: 10 * 60 * 1000
    });
  }, []);

  const updateProfile = useCallback((data: any) => {
    return useBaseApi(() => userService.updateProfile(data), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  const uploadAvatar = useCallback((file: File) => {
    return useBaseApi(() => userService.uploadAvatar(file), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  const changePassword = useCallback((data: any) => {
    return useBaseApi(() => userService.changePassword(data), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  return {
    getProfile,
    updateProfile,
    uploadAvatar,
    changePassword
  };
}

/**
 * 仪表板相关Hook
 */
export function useDashboard() {
  const useStats = useCallback((timeRange?: string) => {
    const cacheKey = `dashboard-stats-${timeRange || 'default'}`;
    return useBaseApi(() => dashboardService.getStats(timeRange), {
      immediate: false,
      cacheKey,
      cacheTTL: 5 * 60 * 1000, // 统计数据缓存5分钟
      retry: true
    });
  }, []);

  const useOverview = useCallback(() => {
    return useBaseApi(() => dashboardService.getOverview(), {
      immediate: false,
      cacheKey: 'dashboard-overview',
      cacheTTL: 3 * 60 * 1000, // 概览数据缓存3分钟
      retry: true
    });
  }, []);

  const generateReport = useCallback((filters: any) => {
    return useBaseApi(() => dashboardService.generateReport(filters), {
      immediate: false,
      cacheKey: undefined // 报告生成不缓存
    });
  }, []);

  const refreshData = useCallback(() => {
    return useBaseApi(() => dashboardService.refreshData(), {
      immediate: false,
      cacheKey: undefined
    });
  }, []);

  return {
    useStats,
    useOverview,
    generateReport,
    refreshData
  };
}

/**
 * 缓存工具函数
 */
export function clearAllCache(): void {
  cache.clear();
}

export function clearCacheByKey(key: string): void {
  cache.delete(key);
}

export function clearCacheByPattern(pattern: string): void {
  const regex = new RegExp(pattern);
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
}

export function getCacheStats(): {
  size: number;
  keys: string[];
  totalMemory: number;
} {
  const keys = Array.from(cache.keys());
  const totalMemory = keys.reduce((total, key) => {
    const item = cache.get(key);
    if (item) {
      return total + JSON.stringify(item.data).length;
    }
    return total;
  }, 0);

  return {
    size: cache.size,
    keys,
    totalMemory
  };
}

/**
 * 简化版API Hook (用于向后兼容)
 */
export function useSimpleApi<T>(
  apiCall: (signal?: AbortSignal) => Promise<T>,
  config: ApiHookConfig = {}
): ApiHookResult<T> {
  return useBaseApi(apiCall, config);
}

// 导出所有Hook和工具函数
export {
  useBaseApi,
  useAuth,
  useTrace,
  useProduct,
  useUser,
  useDashboard,
  useSimpleApi
}; 