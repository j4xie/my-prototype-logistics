/**
 * AI数据获取Hook
 *
 * 专为AI智能体数据分析场景设计的数据获取hook，集成智能缓存、批量处理、错误恢复等功能。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getGlobalBatchController,
  createApiRequest,
  type BatchResult
} from '@/lib/ai-batch-controller';
import {
  AI_CACHE_STRATEGIES,
  type CacheStrategy,
  getCachedData
} from '@/lib/ai-cache-manager';
import {
  getGlobalErrorHandler,
  type AiRequestContext,
  type PerformanceMetric
} from '@/lib/ai-error-handler';

// ========================= 类型定义 =========================

export interface AiDataFetchOptions {
  /** 缓存策略 */
  cacheStrategy?: CacheStrategy;
  /** 请求优先级 */
  priority?: 'high' | 'medium' | 'low';
  /** 是否启用批量处理 */
  enableBatch?: boolean;
  /** 超时时间(毫秒) */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 依赖数组，用于自动重新获取 */
  deps?: any[];
  /** 是否立即获取数据 */
  immediate?: boolean;
  /** 错误处理回调 */
  onError?: (error: Error) => void;
  /** 成功回调 */
  onSuccess?: (data: any) => void;
}

export interface AiDataFetchResult<T> {
  /** 数据 */
  data: T | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 手动重新获取 */
  refetch: () => Promise<void>;
  /** 清除缓存并重新获取 */
  refresh: () => Promise<void>;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 最后更新时间 */
  lastUpdated: Date | null;
}

export interface AiBatchFetchOptions {
  /** 缓存策略 */
  cacheStrategy?: CacheStrategy;
  /** 请求优先级 */
  priority?: 'high' | 'medium' | 'low';
  /** 超时时间(毫秒) */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 错误处理回调 */
  onError?: (results: BatchResult<any>) => void;
  /** 成功回调 */
  onSuccess?: (results: BatchResult<any>) => void;
}

// ========================= 单个数据获取Hook =========================

/**
 * AI单个数据获取Hook
 * @param url 请求URL
 * @param options 配置选项
 * @returns 数据获取结果
 */
export function useAiDataFetch<T = any>(
  url: string | null,
  options: AiDataFetchOptions = {}
): AiDataFetchResult<T> {
  const {
    cacheStrategy = AI_CACHE_STRATEGIES.DYNAMIC_DATA,
    priority = 'medium',
    enableBatch = false,
    timeout,
    retryCount,
    deps = [],
    immediate = true,
    onError,
    onSuccess
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const requestIdRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (clearCache = false) => {
    if (!url) return;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const requestId = `${Date.now()}-${Math.random()}`;
    requestIdRef.current = requestId;

    try {
      if (enableBatch) {
        // 使用批量控制器
        const batchController = getGlobalBatchController();
        const request = createApiRequest(requestId, url, {
          priority,
          cacheStrategy,
          timeout,
          retryCount
        });

        if (clearCache) {
          // 清除缓存
          await batchController['cacheManager'].delete(request.cacheKey);
        }

        const result = await batchController.singleFetch<T>(request);

        if (requestIdRef.current === requestId) {
          setData(result);
          setFromCache(false); // 批量控制器内部处理缓存
          setLastUpdated(new Date());
          onSuccess?.(result);
        }
      } else {
        // 使用缓存获取函数
        const result = await getCachedData<T>(
          `direct:${url}`,
          async () => {
            const response = await fetch(url, {
              signal: abortControllerRef.current?.signal
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
          },
          cacheStrategy
        );

        if (requestIdRef.current === requestId) {
          setData(result);
          setFromCache(true);
          setLastUpdated(new Date());
          onSuccess?.(result);
        }
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [url, enableBatch, priority, cacheStrategy, timeout, retryCount, onError, onSuccess]);

  // 自动获取数据
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate, fetchData]);

  // 依赖变化时重新获取
  useEffect(() => {
    if (deps.length > 0) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const refetch = useCallback(() => fetchData(false), [fetchData]);
  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    refresh,
    fromCache,
    lastUpdated
  };
}

// ========================= 批量数据获取Hook =========================

/**
 * AI批量数据获取Hook
 * @param requests 请求列表
 * @param options 配置选项
 * @returns 批量获取结果
 */
export function useAiBatchFetch<T = any>(
  requests: Array<{ id: string; url: string; }> | null,
  options: AiBatchFetchOptions = {}
): {
  results: BatchResult<T> | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getResultById: (id: string) => T | null;
} {
  const {
    cacheStrategy = AI_CACHE_STRATEGIES.DYNAMIC_DATA,
    priority = 'medium',
    timeout,
    retryCount,
    onError,
    onSuccess
  } = options;

  const [results, setResults] = useState<BatchResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBatch = useCallback(async () => {
    if (!requests || requests.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const batchController = getGlobalBatchController();
      const apiRequests = requests.map(req =>
        createApiRequest(req.id, req.url, {
          priority,
          cacheStrategy,
          timeout,
          retryCount
        })
      );

      const batchResults = await batchController.batchFetch<T>(apiRequests);

      setResults(batchResults);
      onSuccess?.(batchResults);

      if (batchResults.failed.length > 0) {
        onError?.(batchResults);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [requests, priority, cacheStrategy, timeout, retryCount, onError, onSuccess]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  const getResultById = useCallback((id: string): T | null => {
    if (!results) return null;

    const successResult = results.successful.find(r => r.id === id);
    if (successResult) return successResult.data;

    const partialResult = results.partial.find(r => r.id === id);
    if (partialResult) return partialResult.data;

    return null;
  }, [results]);

  return {
    results,
    loading,
    error,
    refetch: fetchBatch,
    getResultById
  };
}

// ========================= 智能预取Hook =========================

/**
 * AI智能预取Hook
 * 基于用户行为和AI分析需求预先获取可能需要的数据
 */
export function useAiPreFetch() {
  const batchController = getGlobalBatchController();

  const preFetch = useCallback(async (urls: string[], priority: 'high' | 'medium' | 'low' = 'low') => {
    const requests = urls.map((url, index) =>
      createApiRequest(
        `prefetch-${index}-${Date.now()}`,
        url,
        {
          priority,
          cacheStrategy: AI_CACHE_STRATEGIES.DYNAMIC_DATA
        }
      )
    );

    try {
      await batchController.batchFetch(requests);
      console.log(`[useAiPreFetch] 预取完成: ${urls.length} 个请求`);
    } catch (error) {
      console.warn('[useAiPreFetch] 预取失败:', error);
    }
  }, [batchController]);

  return { preFetch };
}

// ========================= 性能监控Hook =========================

/**
 * AI性能监控Hook
 * 获取实时的缓存和批量处理性能指标
 */
export function useAiPerformanceMetrics(refreshInterval: number = 5000) {
  const [metrics, setMetrics] = useState<{
    cacheHitRate: number;
    averageResponseTime: number;
    activeRequests: number;
    queueSize: number;
    totalRequests: number;
  } | null>(null);

  useEffect(() => {
    const updateMetrics = () => {
      try {
        const batchController = getGlobalBatchController();
        const stats = batchController.getStats();
        const queueStatus = batchController.getQueueStatus();

        setMetrics({
          cacheHitRate: stats.totalRequests > 0 ? stats.cacheHits / stats.totalRequests : 0,
          averageResponseTime: stats.averageResponseTime,
          activeRequests: queueStatus.activeRequests,
          queueSize: queueStatus.queueSize,
          totalRequests: stats.totalRequests
        });
      } catch (error) {
        console.warn('[useAiPerformanceMetrics] 更新指标失败:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return metrics;
}

// ========================= 导出常用配置 =========================

/**
 * AI场景的预定义配置
 */
export const AI_FETCH_PRESETS = {
  /** 实时数据分析 */
  REAL_TIME_ANALYSIS: {
    cacheStrategy: AI_CACHE_STRATEGIES.REAL_TIME_DATA,
    priority: 'high' as const,
    enableBatch: true,
    timeout: 10000,
    retryCount: 2
  },

  /** 历史数据查询 */
  HISTORICAL_DATA: {
    cacheStrategy: AI_CACHE_STRATEGIES.STATIC_DATA,
    priority: 'medium' as const,
    enableBatch: true,
    timeout: 30000,
    retryCount: 3
  },

  /** AI模型推理结果 */
  AI_INFERENCE: {
    cacheStrategy: AI_CACHE_STRATEGIES.AI_ANALYSIS_RESULT,
    priority: 'high' as const,
    enableBatch: false,
    timeout: 60000,
    retryCount: 1
  },

  /** 用户配置数据 */
  USER_CONFIG: {
    cacheStrategy: AI_CACHE_STRATEGIES.DYNAMIC_DATA,
    priority: 'medium' as const,
    enableBatch: false,
    timeout: 15000,
    retryCount: 2
  }
} as const;

// ========================= 错误处理增强Hook =========================

/**
 * AI数据获取增强Hook (集成智能重试和错误处理)
 * 相比基础版本增加了熔断器、优雅降级、数据质量检查等功能
 */
export function useAiDataFetchEnhanced<T = any>(
  url: string | null,
  options: AiDataFetchOptions & {
    /** 数据类型 (用于数据质量检查) */
    dataType: 'farming' | 'logistics' | 'processing' | 'trace' | 'analytics';
    /** 是否启用数据质量检查 */
    enableDataQuality?: boolean;
    /** 优雅降级策略 */
    fallbackStrategy?: 'cache' | 'mock' | 'degraded' | 'none';
    /** 依赖数组 */
    dependencies?: any[];
  } = { dataType: 'analytics' }
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: (clearCache?: boolean) => Promise<void>;
  /** 错误处理器性能指标 */
  errorMetrics: Map<string, PerformanceMetric> | null;
  /** 熔断器状态 */
  circuitStatus: any;
} {
  const {
    dataType,
    enableDataQuality = true,
    fallbackStrategy = 'cache',
    cacheStrategy = AI_CACHE_STRATEGIES.DYNAMIC_DATA,
    priority = 'medium',
    enableBatch = true,
    timeout = 20000,
    retryCount = 3,
    dependencies = [],
    onError,
    onSuccess
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [errorMetrics, setErrorMetrics] = useState<Map<string, PerformanceMetric> | null>(null);
  const [circuitStatus, setCircuitStatus] = useState<any>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const fetchDataEnhanced = useCallback(async (clearCache = false) => {
    if (!url) return;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const requestId = `enhanced-${Date.now()}-${Math.random()}`;
    requestIdRef.current = requestId;

    try {
      const errorHandler = getGlobalErrorHandler();

      // 构建AI请求上下文
      const context: AiRequestContext = {
        endpoint: url,
        dataType,
        priority,
        requiresDataQuality: enableDataQuality,
        fallbackStrategy: fallbackStrategy || 'cache'
      };

      // 使用错误处理器执行请求
      const result = await errorHandler.handleAiRequest<T>(async () => {
        if (enableBatch) {
          // 使用批量控制器
          const batchController = getGlobalBatchController();
          const request = createApiRequest(requestId, url, {
            priority,
            cacheStrategy,
            timeout,
            retryCount
          });

          if (clearCache) {
            await batchController['cacheManager'].delete(request.cacheKey);
          }

          const batchResult = await batchController.batchFetch<T>([request]);

          if (batchResult.successful.length > 0) {
            return batchResult.successful[0].data;
                     } else if (batchResult.failed.length > 0) {
             throw new Error(String(batchResult.failed[0].error));
           } else {
            throw new Error('批量请求无结果');
          }
        } else {
                     // 直接API调用 (简化版，实际应该集成具体API客户端)
           const response = await fetch(url, {
             signal: abortControllerRef.current?.signal
           });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        }
      }, context);

      // 更新状态
      if (requestIdRef.current === requestId) {
        setData(result);
        onSuccess?.(result);

        // 更新错误处理器指标
        setErrorMetrics(errorHandler.getPerformanceMetrics());
        setCircuitStatus(errorHandler.getCircuitBreakerStatus());
      }
    } catch (err) {
      const errorHandler = getGlobalErrorHandler();
      const errorObj = err instanceof Error ? err : new Error(String(err));

      if (requestIdRef.current === requestId) {
        setError(errorObj);
        onError?.(errorObj);

        // 更新错误处理器指标
        setErrorMetrics(errorHandler.getPerformanceMetrics());
        setCircuitStatus(errorHandler.getCircuitBreakerStatus());
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [url, dataType, enableDataQuality, fallbackStrategy, cacheStrategy, priority, enableBatch, timeout, retryCount, onError, onSuccess]);

  useEffect(() => {
    fetchDataEnhanced();
  }, [fetchDataEnhanced, dependencies]);

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchDataEnhanced,
    errorMetrics,
    circuitStatus
  };
}

/**
 * AI错误监控Hook
 * 监控错误处理器的性能指标和熔断器状态
 */
export function useAiErrorMonitoring(refreshInterval: number = 3000) {
  const [metrics, setMetrics] = useState<{
    performanceMetrics: Map<string, PerformanceMetric>;
    circuitBreakerStatus: any;
    healthScore: number;
    lastUpdated: Date;
  } | null>(null);

  useEffect(() => {
    const updateMetrics = () => {
      try {
        const errorHandler = getGlobalErrorHandler();
        const performanceMetrics = errorHandler.getPerformanceMetrics();
        const circuitBreakerStatus = errorHandler.getCircuitBreakerStatus();

        // 计算系统健康分数 (0-100)
        let healthScore = 100;

        for (const [, metric] of performanceMetrics) {
          const successRate = metric.successRate * 100;
          const avgDuration = metric.avgDuration;

          // 成功率影响 (权重: 60%)
          healthScore -= (100 - successRate) * 0.6;

          // 平均响应时间影响 (权重: 30%)
          if (avgDuration > 10000) {
            healthScore -= 30; // 超过10秒严重扣分
          } else if (avgDuration > 5000) {
            healthScore -= 15; // 超过5秒中等扣分
          } else if (avgDuration > 2000) {
            healthScore -= 5; // 超过2秒轻微扣分
          }
        }

        // 熔断器状态影响 (权重: 10%)
        if (circuitBreakerStatus.state === 'OPEN') {
          healthScore -= 10;
        } else if (circuitBreakerStatus.state === 'HALF_OPEN') {
          healthScore -= 5;
        }

        healthScore = Math.max(0, Math.min(100, healthScore));

        setMetrics({
          performanceMetrics,
          circuitBreakerStatus,
          healthScore,
          lastUpdated: new Date()
        });
      } catch (error) {
        console.warn('[useAiErrorMonitoring] 更新错误监控指标失败:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return metrics;
}
