/**
 * 简化版 API Hook系统
 *
 * @description 专注于Mock API到真实API的无缝切换，支持MVP生产加工AI分析
 * @created Phase-3技术栈现代化 - TASK-P3-016A扩展版
 * @updated 支持farming, processing, AI analytics业务模块
 */

import { useState, useEffect, useCallback } from 'react';

// 导入现有的API客户端
import { apiClient, ApiError } from '../lib/api';

// TASK-P3-018C Day 1: Mock感知功能导入
import { getApiConfig, checkMockHealth, type ApiConfig } from '../lib/api-config';

/**
 * API状态类型
 */
export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * API Hook返回类型
 */
export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
  status: ApiStatus;
  refetch: () => Promise<void>;
}

/**
 * Mock状态Hook返回类型 (TASK-P3-018C)
 */
export interface MockStatusResult {
  mockEnabled: boolean;
  mockHealthy: boolean;
  mockHandlers: number;
  apiMode: 'mock' | 'real' | 'fallback';
  lastCheck: number;
}

/**
 * 基础API Hook配置
 */
export interface UseApiConfig {
  immediate?: boolean;  // 是否立即执行
  cacheKey?: string;   // 缓存key
  cacheTTL?: number;   // 缓存时间（毫秒）
  mockAware?: boolean; // 是否启用Mock感知
}

/**
 * Mock状态Hook返回类型
 */
export interface MockStatusResult {
  mockEnabled: boolean;
  mockHealthy: boolean;
  mockHandlers: number;
  apiMode: 'mock' | 'real' | 'fallback';
  lastCheck: number;
}

/**
 * 智能缓存系统
 */
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5分钟默认TTL
const REALTIME_CACHE_TTL = 30 * 1000; // 实时数据30秒TTL
const ANALYTICS_CACHE_TTL = 10 * 60 * 1000; // AI分析结果10分钟TTL
const STATIC_CACHE_TTL = 30 * 60 * 1000; // 静态数据30分钟TTL

/**
 * 基础API Hook - 增强版本
 */
export function useApi<T>(
  apiCall: () => Promise<T>,
  config: UseApiConfig = {}
): UseApiResult<T> {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: ApiError | Error | null;
    status: ApiStatus;
  }>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  const execute = useCallback(async () => {
    // 智能缓存检查
    if (config.cacheKey) {
      const cached = cache.get(config.cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        setState({
          data: cached.data,
          loading: false,
          error: null,
          status: 'success'
        });
        return;
      }
    }

    setState(prev => ({
      ...prev,
      loading: true,
      status: 'loading'
    }));

    try {
      const result = await apiCall();

      // 智能缓存保存
      if (config.cacheKey) {
        const ttl = config.cacheTTL || DEFAULT_CACHE_TTL;
        cache.set(config.cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl
        });
      }

      setState({
        data: result,
        loading: false,
        error: null,
        status: 'success'
      });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new Error(String(error));
      setState({
        data: null,
        loading: false,
        error: apiError,
        status: 'error'
      });
    }
  }, [apiCall, config.cacheKey, config.cacheTTL]);

  // 立即执行
  useEffect(() => {
    if (config.immediate !== false) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 故意为空依赖，只在组件挂载时执行一次

  return {
    ...state,
    refetch: execute
  };
}

/**
 * 认证相关Hook
 */
export function useAuth() {
  return {
    // 登录
    useLogin: () => useApi(
      () => Promise.resolve(null), // 占位，实际由组件调用时提供参数
      { immediate: false }
    ),

    // 当前用户
    useCurrentUser: () => useApi(
      () => apiClient.get('/auth/status'),
      { cacheKey: 'current-user', cacheTTL: STATIC_CACHE_TTL }
    ),

    // 登出
    logout: async () => {
      await apiClient.post('/auth/logout');
      cache.clear(); // 清空缓存
    }
  };
}

/**
 * 溯源相关Hook
 */
export function useTrace() {
  return {
    // 获取溯源列表
    useTraces: (params?: Record<string, any>) => useApi(
      () => {
        const queryParams = params ? `?${new URLSearchParams(params).toString()}` : '';
        return apiClient.get(`/trace${queryParams}`);
      },
      {
        cacheKey: params ? `traces-${JSON.stringify(params)}` : 'traces',
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取单个溯源
    useTraceById: (id: string) => useApi(
      () => apiClient.get(`/trace/${id}`),
      { cacheKey: `trace-${id}`, cacheTTL: DEFAULT_CACHE_TTL }
    )
  };
}

/**
 * 产品相关Hook
 */
export function useProduct() {
  return {
    // 获取产品列表
    useProducts: (params?: Record<string, any>) => useApi(
      () => {
        const queryParams = params ? `?${new URLSearchParams(params).toString()}` : '';
        return apiClient.get(`/products${queryParams}`);
      },
      {
        cacheKey: params ? `products-${JSON.stringify(params)}` : 'products',
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取单个产品
    useProductById: (id: string) => useApi(
      () => apiClient.get(`/products/${id}`),
      { cacheKey: `product-${id}`, cacheTTL: DEFAULT_CACHE_TTL }
    )
  };
}

/**
 * 养殖管理Hook - MVP核心功能
 */
export function useFarming() {
  return {
    // 获取批次数据
    useBatchData: (batchId?: string) => useApi(
      () => batchId ? apiClient.get(`/farming/batch/${batchId}`) : apiClient.get('/farming/batches'),
      {
        cacheKey: batchId ? `farming-batch-${batchId}` : 'farming-batches',
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取环境数据（实时）
    useEnvironmentData: (timeRange?: string) => useApi(
      () => {
        const params = timeRange ? `?timeRange=${timeRange}` : '';
        return apiClient.get(`/farming/environment${params}`);
      },
      {
        cacheKey: `farming-environment-${timeRange || 'current'}`,
        cacheTTL: REALTIME_CACHE_TTL // 实时数据短缓存
      }
    ),

    // 获取健康指标
    useHealthMetrics: (batchId?: string) => useApi(
      () => {
        const params = batchId ? `?batchId=${batchId}` : '';
        return apiClient.get(`/farming/health-metrics${params}`);
      },
      {
        cacheKey: `farming-health-${batchId || 'all'}`,
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取疫苗记录
    useVaccineRecords: (batchId?: string) => useApi(
      () => {
        const params = batchId ? `?batchId=${batchId}` : '';
        return apiClient.get(`/farming/vaccine${params}`);
      },
      {
        cacheKey: `farming-vaccine-${batchId || 'all'}`,
        cacheTTL: STATIC_CACHE_TTL
      }
    ),

    // 获取繁育信息
    useBreedingInfo: (batchId?: string) => useApi(
      () => {
        const params = batchId ? `?batchId=${batchId}` : '';
        return apiClient.get(`/farming/breeding${params}`);
      },
      {
        cacheKey: `farming-breeding-${batchId || 'all'}`,
        cacheTTL: STATIC_CACHE_TTL
      }
    )
  };
}

/**
 * 生产加工Hook - MVP核心功能
 */
export function useProcessing() {
  return {
    // 获取质量报告
    useQualityReports: (params?: Record<string, any>) => useApi(
      () => {
        const queryParams = params ? `?${new URLSearchParams(params).toString()}` : '';
        return apiClient.get(`/processing/quality-reports${queryParams}`);
      },
      {
        cacheKey: `processing-quality-${JSON.stringify(params || {})}`,
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取生产计划
    useProductionSchedule: (dateRange?: string) => useApi(
      () => {
        const params = dateRange ? `?dateRange=${dateRange}` : '';
        return apiClient.get(`/processing/schedule${params}`);
      },
      {
        cacheKey: `processing-schedule-${dateRange || 'current'}`,
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取设备状态（实时）
    useEquipmentStatus: () => useApi(
      () => apiClient.get('/processing/equipment'),
      {
        cacheKey: 'processing-equipment',
        cacheTTL: REALTIME_CACHE_TTL // 设备状态需要实时
      }
    ),

    // 获取加工记录
    useProcessingRecords: (batchId?: string) => useApi(
      () => {
        const params = batchId ? `?batchId=${batchId}` : '';
        return apiClient.get(`/processing/records${params}`);
      },
      {
        cacheKey: `processing-records-${batchId || 'all'}`,
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取包装信息
    usePackagingInfo: (batchId: string) => useApi(
      () => apiClient.get(`/processing/packaging/${batchId}`),
      {
        cacheKey: `processing-packaging-${batchId}`,
        cacheTTL: DEFAULT_CACHE_TTL
      }
    ),

    // 获取温度日志（实时）
    useTemperatureLogs: (timeRange?: string) => useApi(
      () => {
        const params = timeRange ? `?timeRange=${timeRange}` : '';
        return apiClient.get(`/processing/temperature${params}`);
      },
      {
        cacheKey: `processing-temperature-${timeRange || 'current'}`,
        cacheTTL: REALTIME_CACHE_TTL
      }
    )
  };
}

/**
 * AI数据分析Hook - MVP关键功能
 */
export function useAIAnalytics() {
  return {
    // 生产数据洞察
    useProductionInsights: (params: {
      batchId?: string;
      timeRange?: string;
      analysisType?: 'efficiency' | 'quality' | 'cost' | 'all';
    }) => useApi(
      () => apiClient.post('/ai/production-insights', params),
      {
        cacheKey: `ai-insights-${JSON.stringify(params)}`,
        cacheTTL: ANALYTICS_CACHE_TTL // AI分析结果中期缓存
      }
    ),

    // 优化建议
    useOptimizationSuggestions: (data: {
      processType: 'farming' | 'processing' | 'logistics';
      currentData: Record<string, any>;
      targetMetrics?: string[];
    }) => useApi(
      () => apiClient.post('/ai/optimize', data),
      {
        cacheKey: `ai-optimize-${data.processType}-${JSON.stringify(data.targetMetrics || [])}`,
        cacheTTL: ANALYTICS_CACHE_TTL
      }
    ),

    // 预测分析
    usePredictiveAnalysis: (dataset: {
      type: 'yield' | 'quality' | 'timeline' | 'cost';
      inputData: Record<string, any>;
      predictionPeriod?: string;
    }) => useApi(
      () => apiClient.post('/ai/predict', dataset),
      {
        cacheKey: `ai-predict-${dataset.type}-${dataset.predictionPeriod || 'default'}`,
        cacheTTL: ANALYTICS_CACHE_TTL
      }
    ),

    // 数据聚合分析
    useDataAggregation: (config: {
      sources: string[]; // ['farming', 'processing', 'logistics']
      timeRange: string;
      aggregationType: 'summary' | 'detailed' | 'comparison';
    }) => useApi(
      () => apiClient.post('/ai/aggregate', config),
      {
        cacheKey: `ai-aggregate-${config.aggregationType}-${config.timeRange}`,
        cacheTTL: ANALYTICS_CACHE_TTL
      }
    ),

    // 实时监控分析
    useRealtimeAnalysis: (monitoringConfig: {
      modules: string[];
      alertThresholds?: Record<string, number>;
    }) => useApi(
      () => apiClient.post('/ai/realtime-analysis', monitoringConfig),
      {
        cacheKey: `ai-realtime-${JSON.stringify(monitoringConfig.modules)}`,
        cacheTTL: REALTIME_CACHE_TTL // 实时分析短缓存
      }
    )
  };
}

/**
 * 批量数据处理Hook - 大数据分析支持
 */
export function useBatchDataProcessing() {
  return {
    // 批量获取历史数据
    useBatchHistoricalData: (request: {
      modules: string[];
      startDate: string;
      endDate: string;
      batchSize?: number;
    }) => useApi(
      () => apiClient.post('/data/batch-historical', request),
      {
        cacheKey: `batch-data-${request.startDate}-${request.endDate}-${JSON.stringify(request.modules)}`,
        cacheTTL: STATIC_CACHE_TTL // 历史数据长缓存
      }
    ),

    // 数据预处理
    useDataPreprocessing: (config: {
      dataSource: string;
      processingRules: Record<string, any>;
      outputFormat?: 'json' | 'csv' | 'chart';
    }) => useApi(
      () => apiClient.post('/data/preprocess', config),
      {
        cacheKey: `preprocess-${config.dataSource}-${JSON.stringify(config.processingRules)}`,
        cacheTTL: ANALYTICS_CACHE_TTL
      }
    )
  };
}

/**
 * 用户相关Hook
 */
export function useUser() {
  return {
    // 获取用户资料
    useProfile: () => useApi(
      () => apiClient.get('/users/profile'),
      { cacheKey: 'user-profile', cacheTTL: STATIC_CACHE_TTL }
    )
  };
}

/**
 * 手动登录函数 - 增强错误处理
 */
export async function login(credentials: { username: string; password: string }) {
  try {
    const response = await apiClient.post('/auth/login', credentials);
    cache.clear(); // 登录后清空旧缓存
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(`登录失败: ${String(error)}`);
  }
}

/**
 * 清空所有缓存
 */
export function clearCache() {
  cache.clear();
}

/**
 * 清空特定模块缓存
 */
export function clearModuleCache(module: 'farming' | 'processing' | 'ai' | 'auth' | 'all') {
  if (module === 'all') {
    cache.clear();
    return;
  }

  for (const [key] of cache) {
    if (key.startsWith(module)) {
      cache.delete(key);
    }
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats() {
  return {
    totalEntries: cache.size,
    memoryUsage: JSON.stringify([...cache.entries()]).length,
    oldestEntry: Math.min(...[...cache.values()].map(v => v.timestamp)),
    newestEntry: Math.max(...[...cache.values()].map(v => v.timestamp))
  };
}

/**
 * TASK-P3-018C Day 1: Mock状态检查Hook
 *
 * @description 检查Mock服务状态，支持开发时API模式可视化
 * @returns Mock服务的健康状态和配置信息
 */
export function useMockStatus(): MockStatusResult & {
  config: ApiConfig;
  checkHealth: () => Promise<void>;
} {
  const [status, setStatus] = useState<MockStatusResult>({
    mockEnabled: false,
    mockHealthy: false,
    mockHandlers: 0,
    apiMode: 'real',
    lastCheck: 0
  });

  const [config] = useState<ApiConfig>(() => getApiConfig());

  const checkHealth = useCallback(async () => {
    if (!config.mockEnabled) {
      setStatus(prev => ({ ...prev, apiMode: 'real', lastCheck: Date.now() }));
      return;
    }

    try {
      const healthStatus = await checkMockHealth();
      setStatus({
        mockEnabled: config.mockEnabled,
        mockHealthy: healthStatus.available,
        mockHandlers: healthStatus.handlers,
        apiMode: healthStatus.available ? 'mock' : 'fallback',
        lastCheck: healthStatus.lastCheck
      });
    } catch {
      setStatus(prev => ({
        ...prev,
        mockHealthy: false,
        apiMode: 'fallback',
        lastCheck: Date.now()
      }));
    }
  }, [config.mockEnabled]);

  // 初始化和定期检查
  useEffect(() => {
    checkHealth();

    // 开发环境定期检查
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(checkHealth, 30000); // 30秒检查一次
      return () => clearInterval(interval);
    }
  }, [checkHealth]);

  return {
    ...status,
    config,
    checkHealth
  };
}
