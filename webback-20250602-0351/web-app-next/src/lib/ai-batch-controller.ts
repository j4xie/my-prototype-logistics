/**
 * AI批量数据获取控制器
 * 
 * 专为AI智能体数据分析场景设计的批量请求管理器，支持并发控制、请求合并、优先级排序等功能。
 */

import { AiCacheManager, CacheStrategy, AI_CACHE_STRATEGIES } from './ai-cache-manager';

// ========================= 类型定义 =========================

export interface ApiRequest {
  /** 请求唯一标识 */
  id: string;
  /** 请求配置 */
  config: RequestConfig;
  /** 缓存键 */
  cacheKey: string;
  /** 缓存策略 */
  cacheStrategy: CacheStrategy;
  /** 请求优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 超时时间(毫秒) */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 创建时间 */
  createdAt: number;
}

export interface RequestConfig {
  /** 请求URL */
  url: string;
  /** 请求方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: any;
  /** 查询参数 */
  params?: Record<string, any>;
}

export interface BatchResult<T> {
  /** 成功的请求结果 */
  successful: Array<{ id: string; data: T; fromCache: boolean; }>;
  /** 失败的请求 */
  failed: Array<{ id: string; error: Error; }>;
  /** 部分成功的请求 */
  partial: Array<{ id: string; data: T; warnings: string[]; }>;
}

export interface BatchStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 缓存命中数 */
  cacheHits: number;
  /** 平均响应时间(毫秒) */
  averageResponseTime: number;
  /** 并发峰值 */
  peakConcurrency: number;
  /** 总处理时间(毫秒) */
  totalProcessingTime: number;
}

interface PriorityQueueItem {
  request: ApiRequest;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  startTime: number;
}

// ========================= 优先级队列 =========================

class PriorityQueue<T extends PriorityQueueItem> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
    this.items.sort((a, b) => {
      // 优先级排序: high > medium > low
      const priorityMap = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityMap[a.request.priority];
      const bPriority = priorityMap[b.request.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // 同优先级按创建时间排序
      return a.request.createdAt - b.request.createdAt;
    });
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}

// ========================= 批量控制器主类 =========================

export class AiBatchController {
  private concurrencyLimit: number;
  private requestQueue: PriorityQueue<PriorityQueueItem>;
  private activeRequests: Set<string>;
  private cacheManager: AiCacheManager;
  private stats: BatchStats;
  private requestTimeout: number;
  private maxRetries: number;

  constructor(config: {
    concurrencyLimit?: number;
    requestTimeout?: number;
    maxRetries?: number;
    cacheManager?: AiCacheManager;
  } = {}) {
    this.concurrencyLimit = config.concurrencyLimit || 6;
    this.requestTimeout = config.requestTimeout || 30000; // 30秒
    this.maxRetries = config.maxRetries || 3;
    this.requestQueue = new PriorityQueue();
    this.activeRequests = new Set();
    this.cacheManager = config.cacheManager || new AiCacheManager();
    this.stats = this.initializeStats();
  }

  // ========================= 核心批量处理方法 =========================

  /**
   * 批量获取数据
   * @param requests 请求列表
   * @returns 批量结果
   */
  async batchFetch<T>(requests: ApiRequest[]): Promise<BatchResult<T>> {
    const startTime = Date.now();
    this.stats.totalRequests += requests.length;

    const results: BatchResult<T> = {
      successful: [],
      failed: [],
      partial: []
    };

    // 1. 请求去重和合并
    const dedupedRequests = this.deduplicateRequests(requests);
    console.log(`[AiBatchController] 去重后请求数: ${dedupedRequests.length}/${requests.length}`);

    // 2. 检查缓存
    const { cached, uncached } = await this.separateCachedRequests<T>(dedupedRequests);
    
    // 3. 处理缓存命中的请求
    cached.forEach(({ request, data }) => {
      results.successful.push({
        id: request.id,
        data,
        fromCache: true
      });
    });
    this.stats.cacheHits += cached.length;

    // 4. 批量处理未缓存的请求
    if (uncached.length > 0) {
      const networkResults = await this.processNetworkRequests<T>(uncached);
      results.successful.push(...networkResults.successful);
      results.failed.push(...networkResults.failed);
      results.partial.push(...networkResults.partial);
    }

    // 5. 更新统计信息
    this.updateStats(startTime, results);

    return results;
  }

  /**
   * 单个请求处理（带缓存）
   * @param request 请求对象
   * @returns 请求结果
   */
  async singleFetch<T>(request: ApiRequest): Promise<T> {
    // 先检查缓存
    const cached = await this.cacheManager.get<T>(request.cacheKey, request.cacheStrategy);
    if (cached !== null) {
      this.stats.cacheHits++;
      return cached;
    }

    // 执行网络请求
    const result = await this.executeRequest<T>(request);
    
    // 缓存结果
    await this.cacheManager.set(request.cacheKey, result, request.cacheStrategy);
    
    return result;
  }

  // ========================= 请求去重和缓存处理 =========================

  /**
   * 去重请求
   */
  private deduplicateRequests(requests: ApiRequest[]): ApiRequest[] {
    const seen = new Set<string>();
    const deduped: ApiRequest[] = [];

    for (const request of requests) {
      if (!seen.has(request.cacheKey)) {
        seen.add(request.cacheKey);
        deduped.push(request);
      }
    }

    return deduped;
  }

  /**
   * 分离缓存命中和未命中的请求
   */
  private async separateCachedRequests<T>(requests: ApiRequest[]): Promise<{
    cached: Array<{ request: ApiRequest; data: T; }>;
    uncached: ApiRequest[];
  }> {
    const cached: Array<{ request: ApiRequest; data: T; }> = [];
    const uncached: ApiRequest[] = [];

    for (const request of requests) {
      const cachedData = await this.cacheManager.get<T>(request.cacheKey, request.cacheStrategy);
      if (cachedData !== null) {
        cached.push({ request, data: cachedData as T });
      } else {
        uncached.push(request);
      }
    }

    return { cached, uncached };
  }

  // ========================= 网络请求处理 =========================

  /**
   * 处理网络请求
   */
  private async processNetworkRequests<T>(requests: ApiRequest[]): Promise<BatchResult<T>> {
    const results: BatchResult<T> = {
      successful: [],
      failed: [],
      partial: []
    };

    // 分块处理，控制并发
    const chunks = this.chunkRequests(requests, this.concurrencyLimit);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(request => 
        this.executeRequestWithRetry<T>(request)
          .then(data => ({ request, data, success: true as const }))
          .catch(error => ({ request, error, success: false as const }))
      );

      const chunkResults = await Promise.all(chunkPromises);
      
      for (const result of chunkResults) {
        if (result.success) {
          // 缓存成功的结果
          await this.cacheManager.set(
            result.request.cacheKey,
            result.data,
            result.request.cacheStrategy
          );
          
          results.successful.push({
            id: result.request.id,
            data: result.data,
            fromCache: false
          });
        } else {
          results.failed.push({
            id: result.request.id,
            error: result.error
          });
        }
      }
    }

    return results;
  }

  /**
   * 执行单个请求（带重试）
   */
  private async executeRequestWithRetry<T>(request: ApiRequest): Promise<T> {
    let lastError: Error;
    const maxRetries = request.retryCount || this.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeRequest<T>(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.sleep(delay);
          console.log(`[AiBatchController] 重试请求 ${request.id}, 尝试 ${attempt + 1}/${maxRetries}`);
        }
      }
    }

    throw lastError!;
  }

  /**
   * 执行单个请求
   */
  private async executeRequest<T>(request: ApiRequest): Promise<T> {
    const timeout = request.timeout || this.requestTimeout;
    
    // 更新并发统计
    this.activeRequests.add(request.id);
    this.stats.peakConcurrency = Math.max(this.stats.peakConcurrency, this.activeRequests.size);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(request.config.url, {
        method: request.config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...request.config.headers
        },
        body: request.config.body ? JSON.stringify(request.config.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } finally {
      this.activeRequests.delete(request.id);
    }
  }

  // ========================= 工具方法 =========================

  /**
   * 将请求分块
   */
  private chunkRequests(requests: ApiRequest[], chunkSize: number): ApiRequest[][] {
    const chunks: ApiRequest[][] = [];
    for (let i = 0; i < requests.length; i += chunkSize) {
      chunks.push(requests.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 休眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): BatchStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      peakConcurrency: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * 更新统计信息
   */
  private updateStats<T>(startTime: number, results: BatchResult<T>): void {
    const processingTime = Date.now() - startTime;
    this.stats.totalProcessingTime += processingTime;
    this.stats.successfulRequests += results.successful.length;
    this.stats.failedRequests += results.failed.length;
    
    // 计算平均响应时间
    const totalRequests = this.stats.totalRequests;
    if (totalRequests > 0) {
      this.stats.averageResponseTime = this.stats.totalProcessingTime / totalRequests;
    }
  }

  // ========================= 公共接口 =========================

  /**
   * 获取统计信息
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = this.initializeStats();
  }

  /**
   * 获取当前队列状态
   */
  getQueueStatus(): {
    queueSize: number;
    activeRequests: number;
    peakConcurrency: number;
  } {
    return {
      queueSize: this.requestQueue.size(),
      activeRequests: this.activeRequests.size,
      peakConcurrency: this.stats.peakConcurrency
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.requestQueue.clear();
  }

  /**
   * 销毁控制器
   */
  destroy(): void {
    this.clearQueue();
    this.activeRequests.clear();
    this.resetStats();
  }
}

// ========================= 便捷函数 =========================

/**
 * 创建API请求对象
 */
export function createApiRequest(
  id: string,
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
    priority?: 'high' | 'medium' | 'low';
    cacheStrategy?: CacheStrategy;
    timeout?: number;
    retryCount?: number;
  } = {}
): ApiRequest {
  const {
    method = 'GET',
    headers = {},
    body,
    params,
    priority = 'medium',
    cacheStrategy = AI_CACHE_STRATEGIES.DYNAMIC_DATA,
    timeout,
    retryCount
  } = options;

  // 构建完整URL
  const fullUrl = params ? `${url}?${new URLSearchParams(params).toString()}` : url;
  
  // 生成缓存键
  const cacheKey = `api:${method}:${fullUrl}:${body ? JSON.stringify(body) : ''}`;

  return {
    id,
    config: {
      url: fullUrl,
      method,
      headers,
      body,
      params
    },
    cacheKey,
    cacheStrategy,
    priority,
    timeout,
    retryCount,
    createdAt: Date.now()
  };
}

/**
 * 全局批量控制器实例
 */
let globalBatchController: AiBatchController | null = null;

/**
 * 获取全局批量控制器实例
 */
export function getGlobalBatchController(): AiBatchController {
  if (!globalBatchController) {
    globalBatchController = new AiBatchController();
  }
  return globalBatchController;
} 