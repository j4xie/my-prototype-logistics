/**
 * AI数据分析场景专用错误处理器
 * 支持智能重试、熔断器模式、优雅降级、数据质量过滤
 */

// 类型定义
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export interface AiRequestContext {
  endpoint: string;
  dataType: 'farming' | 'logistics' | 'processing' | 'trace' | 'analytics';
  priority: 'high' | 'medium' | 'low';
  requiresDataQuality: boolean;
  fallbackStrategy: 'cache' | 'mock' | 'degraded' | 'none';
}

export interface PerformanceMetric {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
  totalDuration: number;
  successRate: number;
  lastFailure?: Date;
}

// 熔断器状态
enum CircuitState {
  CLOSED = 'CLOSED',     // 正常状态
  OPEN = 'OPEN',         // 熔断状态
  HALF_OPEN = 'HALF_OPEN' // 半开状态
}

/**
 * 熔断器实现
 * 防止级联失败，保护系统稳定性
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime?: Date;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.log('[CircuitBreaker] 进入半开状态，尝试恢复');
      } else {
        throw new Error('熔断器开启：服务暂时不可用');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
          } catch (error) {
        this.onFailure();
        throw error;
      }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = undefined;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      console.log('[CircuitBreaker] 半开状态失败，重新开启熔断器');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log(`[CircuitBreaker] 达到失败阈值 ${this.config.failureThreshold}，开启熔断器`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * AI场景专用错误处理器
 * 集成智能重试、熔断器、优雅降级等功能
 */
export class AiErrorHandler {
  private circuitBreaker: CircuitBreaker;
  private retryConfig: RetryConfig;
  private performanceMetrics: Map<string, PerformanceMetric> = new Map();

  constructor(
    retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    },
    circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 300000
    }
  ) {
    this.retryConfig = retryConfig;
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
  }

  /**
   * 处理AI请求的主入口
   * 集成所有错误处理策略
   */
  async handleAiRequest<T>(
    request: () => Promise<T>,
    context: AiRequestContext
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return this.retryWithBackoff(request, context);
      });

      success = true;
      return result;
    } catch (error) {
      console.error(`[AiErrorHandler] 最终请求失败 ${context.endpoint}:`, error);

      // 尝试优雅降级
      const fallbackResult = await this.tryFallback<T>(context);
      if (fallbackResult !== null) {
        success = true;
        return fallbackResult;
      }

      throw error;
    } finally {
      // 记录性能指标
      const duration = Date.now() - startTime;
      this.recordPerformance(context.endpoint, duration, success);
    }
  }

  /**
   * 指数退避重试实现
   * 包含抖动算法和数据质量检查
   */
  private async retryWithBackoff<T>(
    request: () => Promise<T>,
    context: AiRequestContext
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        console.log(`[AiErrorHandler] 尝试请求 ${context.endpoint} (第${attempt + 1}次)`);

        const result = await request();

        // AI数据质量检查
        if (context.requiresDataQuality && !this.isValidAiData(result, context)) {
          throw new Error(`数据质量检查失败: ${context.dataType}`);
        }

        if (attempt > 0) {
          console.log(`[AiErrorHandler] 重试成功 ${context.endpoint} (第${attempt + 1}次尝试)`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // 检查是否应该重试
        if (attempt >= this.retryConfig.maxRetries || !this.shouldRetry(error as Error, attempt)) {
          break;
        }

        // 计算退避延迟（含抖动）
        const delay = this.calculateBackoffDelay(attempt);
        console.log(`[AiErrorHandler] 请求失败，${delay}ms后重试 ${context.endpoint}:`, (error as Error).message);

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * 数据质量验证
   * 针对AI分析场景的特定验证规则
   */
  private isValidAiData(data: any, context: AiRequestContext): boolean {
    if (!data) return false;

    try {
      switch (context.dataType) {
        case 'farming':
          return this.validateFarmingData(data);
        case 'logistics':
          return this.validateLogisticsData(data);
        case 'processing':
          return this.validateProcessingData(data);
        case 'trace':
          return this.validateTraceData(data);
        case 'analytics':
          return this.validateAnalyticsData(data);
        default:
          return this.validateGenericData(data);
      }
    } catch (error) {
      console.warn(`[AiErrorHandler] 数据验证异常:`, error);
      return false;
    }
  }

  /**
   * 优雅降级策略
   * 当主要数据源失败时提供备选方案
   */
  private async tryFallback<T>(context: AiRequestContext): Promise<T | null> {
    console.log(`[AiErrorHandler] 尝试优雅降级策略: ${context.fallbackStrategy}`);

    try {
      switch (context.fallbackStrategy) {
        case 'cache':
          return await this.getFallbackFromCache<T>(context);
        case 'mock':
          return await this.getFallbackFromMock<T>(context);
        case 'degraded':
          return await this.getFallbackDegraded<T>(context);
        case 'none':
        default:
          return null;
      }
    } catch (error) {
      console.warn(`[AiErrorHandler] 降级策略失败:`, error);
      return null;
    }
  }

  /**
   * 指数退避延迟计算
   * 包含抖动算法避免惊群效应
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelay
    );

    if (!this.retryConfig.jitter) {
      return exponentialDelay;
    }

    // 添加±25%的随机抖动
    const jitterRange = exponentialDelay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;

    return Math.max(100, exponentialDelay + jitter); // 最小100ms
  }

  /**
   * 判断错误是否应该重试
   */
  private shouldRetry(error: Error, attempt: number): boolean {
    // 超过最大重试次数
    if (attempt >= this.retryConfig.maxRetries) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();

    // 不应该重试的错误类型
    const nonRetryableErrors = [
      'unauthorized',
      'forbidden',
      'not found',
      'method not allowed',
      'validation error',
      'invalid request'
    ];

    if (nonRetryableErrors.some(msg => errorMessage.includes(msg))) {
      console.log(`[AiErrorHandler] 不可重试错误: ${error.message}`);
      return false;
    }

    // 可重试的错误类型
    const retryableErrors = [
      'timeout',
      'network error',
      'connection refused',
      'server error',
      'service unavailable',
      'too many requests'
    ];

    return retryableErrors.some(msg => errorMessage.includes(msg));
  }

  /**
   * 性能指标记录
   */
  private recordPerformance(endpoint: string, duration: number, success: boolean): void {
    const metric = this.performanceMetrics.get(endpoint) || {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      avgDuration: 0,
      totalDuration: 0,
      successRate: 0
    };

    metric.totalCalls++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.totalCalls;

    if (success) {
      metric.successCount++;
    } else {
      metric.failureCount++;
      metric.lastFailure = new Date();
    }

    metric.successRate = metric.successCount / metric.totalCalls;
    this.performanceMetrics.set(endpoint, metric);
  }

  // 工具方法
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 数据验证方法
  private validateFarmingData(data: any): boolean {
    return data && typeof data === 'object' &&
           (data.farmId || data.cropData || data.soilData);
  }

  private validateLogisticsData(data: any): boolean {
    return data && typeof data === 'object' &&
           (data.shipmentId || data.location || data.status);
  }

  private validateProcessingData(data: any): boolean {
    return data && typeof data === 'object' &&
           (data.batchId || data.processData || data.qualityMetrics);
  }

  private validateTraceData(data: any): boolean {
    return data && typeof data === 'object' &&
           (data.traceId || data.traceChain || data.verification);
  }

  private validateAnalyticsData(data: any): boolean {
    return data && typeof data === 'object' &&
           (data.metrics || data.insights || data.aggregatedData);
  }

  private validateGenericData(data: any): boolean {
    return data !== null && data !== undefined;
  }

  // 降级策略实现
  private async getFallbackFromCache<T>(context: AiRequestContext): Promise<T | null> {
    // 这里需要与缓存管理器集成
    console.log(`[AiErrorHandler] 尝试从缓存获取 ${context.endpoint}`);
    return null; // 临时返回null，后续集成缓存管理器
  }

  private async getFallbackFromMock<T>(context: AiRequestContext): Promise<T | null> {
    console.log(`[AiErrorHandler] 使用Mock数据 ${context.dataType}，转发到MSW中央服务`);

    // Day 6迁移: 不再使用内联Mock数据，转发到MSW中央服务
    try {
      const mockEndpoint = this.getMockEndpointForDataType(context.dataType);
      const response = await fetch(mockEndpoint);

      if (response.ok) {
        const data = await response.json();
        return data.data as T;
      }
    } catch (error) {
      console.warn('[AiErrorHandler] MSW Mock服务不可用，使用基础降级数据', error);
    }

    // 如果MSW不可用，使用基础降级数据
    return this.generateDegradedData<T>(context);
  }

  private async getFallbackDegraded<T>(context: AiRequestContext): Promise<T | null> {
    console.log(`[AiErrorHandler] 使用降级数据 ${context.dataType}`);
    // 返回简化的数据结构
    return this.generateDegradedData<T>(context);
  }

  /**
   * 根据数据类型获取对应的MSW Mock端点
   * Day 6: 替代内联Mock数据的端点映射
   */
  private getMockEndpointForDataType(dataType: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

    switch (dataType) {
      case 'farming':
        return `${baseUrl}/farming`;
      case 'logistics':
        return `${baseUrl}/logistics`;
      case 'processing':
        return `${baseUrl}/processing`;
      case 'trace':
        return `${baseUrl}/trace/default`;
      case 'analytics':
        return `${baseUrl}/admin`; // 管理模块包含分析数据
      default:
        return `${baseUrl}/users/profile`; // 默认端点
    }
  }

  private generateDegradedData<T>(context: AiRequestContext): T {
    return { degraded: true, dataType: context.dataType, timestamp: Date.now() } as T;
  }

  // 公共接口
  getPerformanceMetrics(): Map<string, PerformanceMetric> {
    return new Map(this.performanceMetrics);
  }

  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStats();
  }

  resetMetrics(): void {
    this.performanceMetrics.clear();
  }
}

// 创建全局实例
let globalErrorHandler: AiErrorHandler;

export function getGlobalErrorHandler(): AiErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new AiErrorHandler();
  }
  return globalErrorHandler;
}

// 便捷导出
export { CircuitState };
