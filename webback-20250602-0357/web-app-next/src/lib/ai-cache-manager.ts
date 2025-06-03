/**
 * AI智能缓存管理器
 * 
 * 专为AI智能体数据分析场景设计的高性能缓存系统，支持多层级缓存、智能策略和性能监控。
 * 
 * 核心特性：
 * - 双层缓存: L1内存缓存 + L2本地存储
 * - 智能策略: 基于数据类型和更新频率的自适应缓存
 * - 性能监控: 实时命中率统计和性能分析
 * - AI优化: 专为数据分析场景优化的缓存策略
 */

import { StorageAdapter } from './storage-adapter';

// ========================= 类型定义 =========================

export interface CacheStrategy {
  /** 数据类型：静态/动态/实时 */
  type: 'static' | 'dynamic' | 'real-time';
  /** 生存时间(毫秒) */
  ttl: number;
  /** 缓存优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 刷新阈值(0-1，超过此值主动刷新) */
  refreshThreshold: number;
  /** 是否允许过期数据临时使用 */
  allowStale?: boolean;
}

export interface CachedData<T = any> {
  /** 缓存的实际数据 */
  value: T;
  /** 缓存创建时间戳 */
  timestamp: number;
  /** 使用的缓存策略 */
  strategy: CacheStrategy;
  /** 命中次数 */
  hitCount: number;
  /** 数据大小(字节) */
  size: number;
  /** 最后访问时间 */
  lastAccessed: number;
}

export interface CacheStatistics {
  /** L1缓存命中次数 */
  l1Hits: number;
  /** L2缓存命中次数 */
  l2Hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** L1缓存命中率 */
  l1HitRate: number;
  /** L2缓存命中率 */
  l2HitRate: number;
  /** 总命中率 */
  totalHitRate: number;
  /** L1缓存大小 */
  l1Size: number;
  /** L2缓存大小 */
  l2Size: number;
  /** 总请求数 */
  totalRequests: number;
}

export interface AiCacheConfig {
  /** L1缓存最大条目数 */
  maxL1Entries?: number;
  /** L1缓存最大内存使用(MB) */
  maxL1MemoryMB?: number;
  /** L2缓存最大大小(MB) */
  maxL2StorageMB?: number;
  /** 统计数据收集间隔(秒) */
  statsInterval?: number;
  /** 自动清理间隔(秒) */
  cleanupInterval?: number;
}

// ========================= 预定义缓存策略 =========================

export const AI_CACHE_STRATEGIES = {
  /** 静态数据：配置信息、模型参数等 */
  STATIC_DATA: {
    type: 'static' as const,
    ttl: 24 * 60 * 60 * 1000, // 24小时
    priority: 'high' as const,
    refreshThreshold: 0.9,
    allowStale: true
  },

  /** 动态数据：用户数据、历史记录等 */
  DYNAMIC_DATA: {
    type: 'dynamic' as const,
    ttl: 60 * 60 * 1000, // 1小时
    priority: 'medium' as const,
    refreshThreshold: 0.7,
    allowStale: true
  },

  /** 实时数据：传感器数据、实时状态等 */
  REAL_TIME_DATA: {
    type: 'real-time' as const,
    ttl: 5 * 60 * 1000, // 5分钟
    priority: 'low' as const,
    refreshThreshold: 0.5,
    allowStale: false
  },

  /** AI分析结果：计算密集型结果缓存 */
  AI_ANALYSIS_RESULT: {
    type: 'dynamic' as const,
    ttl: 30 * 60 * 1000, // 30分钟
    priority: 'high' as const,
    refreshThreshold: 0.8,
    allowStale: true
  }
} as const;

// ========================= 主要缓存管理器类 =========================

export class AiCacheManager {
  private l1Cache: Map<string, CachedData> = new Map();
  private l2Storage: StorageAdapter;
  private statistics: CacheStatistics;
  private config: Required<AiCacheConfig>;
  private cleanupTimer?: NodeJS.Timeout;
  private statsTimer?: NodeJS.Timeout;

  constructor(config: AiCacheConfig = {}) {
    this.config = {
      maxL1Entries: 1000,
      maxL1MemoryMB: 50,
      maxL2StorageMB: 200,
      statsInterval: 60,
      cleanupInterval: 300,
      ...config
    };

    this.l2Storage = new StorageAdapter('ai-cache-l2');
    this.statistics = this.initializeStatistics();
    
    this.startPeriodicTasks();
  }

  // ========================= 核心缓存操作 =========================

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @param strategy 缓存策略
   * @returns 缓存的数据或null
   */
  async get<T = unknown>(key: string, strategy: CacheStrategy): Promise<T | null> {
    this.statistics.totalRequests++;

    // L1 缓存检查
    const l1Data = this.l1Cache.get(key);
    if (l1Data && this.isValidCacheData(l1Data, strategy)) {
      l1Data.hitCount++;
      l1Data.lastAccessed = Date.now();
      this.recordCacheHit('L1');
      return l1Data.value as T;
    }

    // L2 缓存检查
    try {
      const l2Data = await this.l2Storage.get<CachedData<T>>(key);
      if (l2Data && this.isValidCacheData(l2Data, strategy)) {
        // 升级到L1缓存
        this.setL1Cache(key, l2Data);
        this.recordCacheHit('L2');
        return l2Data.value;
      }
    } catch (error) {
      console.warn('[AiCacheManager] L2缓存读取失败:', error);
    }

    this.recordCacheMiss();
    return null;
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param value 要缓存的数据
   * @param strategy 缓存策略
   */
  async set<T>(key: string, value: T, strategy: CacheStrategy): Promise<void> {
    const cachedData: CachedData<T> = {
      value,
      timestamp: Date.now(),
      strategy,
      hitCount: 0,
      size: this.calculateDataSize(value),
      lastAccessed: Date.now()
    };

    // 设置L1缓存
    this.setL1Cache(key, cachedData);

    // 设置L2缓存（异步，不阻塞）
    try {
      await this.l2Storage.set(key, cachedData);
    } catch (error) {
      console.warn('[AiCacheManager] L2缓存写入失败:', error);
    }
  }

  /**
   * 删除缓存数据
   * @param key 缓存键
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    try {
      await this.l2Storage.delete(key);
    } catch (error) {
      console.warn('[AiCacheManager] L2缓存删除失败:', error);
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    try {
      await this.l2Storage.clear();
    } catch (error) {
      console.warn('[AiCacheManager] L2缓存清空失败:', error);
    }
    this.statistics = this.initializeStatistics();
  }

  // ========================= 缓存策略管理 =========================

  /**
   * 检查缓存数据是否有效
   */
  private isValidCacheData(data: CachedData, strategy: CacheStrategy): boolean {
    const now = Date.now();
    const age = now - data.timestamp;

    // 检查TTL
    if (age > strategy.ttl) {
      // 如果允许过期数据且在刷新阈值内，仍可使用
      if (strategy.allowStale && age < strategy.ttl * 1.2) {
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * 设置L1缓存并管理容量
   */
  private setL1Cache<T>(key: string, data: CachedData<T>): void {
    // 检查内存限制
    if (this.shouldEvictL1Cache()) {
      this.evictL1Cache();
    }

    this.l1Cache.set(key, data);
  }

  /**
   * 检查是否需要清理L1缓存
   */
  private shouldEvictL1Cache(): boolean {
    // 检查条目数量限制
    if (this.l1Cache.size >= this.config.maxL1Entries) {
      return true;
    }

    // 检查内存使用限制
    const currentMemoryMB = this.calculateL1MemoryUsage() / (1024 * 1024);
    if (currentMemoryMB >= this.config.maxL1MemoryMB) {
      return true;
    }

    return false;
  }

  /**
   * 清理L1缓存（LRU策略）
   */
  private evictL1Cache(): void {
    const entries = Array.from(this.l1Cache.entries());
    
    // 按最后访问时间排序（LRU）
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // 删除最少使用的20%
    const deleteCount = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < deleteCount; i++) {
      this.l1Cache.delete(entries[i][0]);
    }
  }

  // ========================= 性能监控 =========================

  /**
   * 记录L1缓存命中
   */
  private recordCacheHit(level: 'L1' | 'L2'): void {
    if (level === 'L1') {
      this.statistics.l1Hits++;
    } else {
      this.statistics.l2Hits++;
    }
    this.updateHitRates();
  }

  /**
   * 记录缓存未命中
   */
  private recordCacheMiss(): void {
    this.statistics.misses++;
    this.updateHitRates();
  }

  /**
   * 更新命中率统计
   */
  private updateHitRates(): void {
    const total = this.statistics.totalRequests;
    if (total > 0) {
      this.statistics.l1HitRate = this.statistics.l1Hits / total;
      this.statistics.l2HitRate = this.statistics.l2Hits / total;
      this.statistics.totalHitRate = (this.statistics.l1Hits + this.statistics.l2Hits) / total;
    }
  }

  /**
   * 获取当前缓存统计信息
   */
  getStatistics(): CacheStatistics {
    return {
      ...this.statistics,
      l1Size: this.l1Cache.size,
      l2Size: 0, // L2大小需要异步获取，这里简化处理
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.statistics = this.initializeStatistics();
  }

  // ========================= 工具方法 =========================

  /**
   * 计算数据大小（粗略估算）
   */
  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 简单估算，每字符2字节
    } catch {
      return 1024; // 默认1KB
    }
  }

  /**
   * 计算L1缓存内存使用量
   */
  private calculateL1MemoryUsage(): number {
    let totalSize = 0;
    for (const data of this.l1Cache.values()) {
      totalSize += data.size;
    }
    return totalSize;
  }

  /**
   * 初始化统计信息
   */
  private initializeStatistics(): CacheStatistics {
    return {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      l1HitRate: 0,
      l2HitRate: 0,
      totalHitRate: 0,
      l1Size: 0,
      l2Size: 0,
      totalRequests: 0
    };
  }

  /**
   * 启动定期任务
   */
  private startPeriodicTasks(): void {
    // 定期清理过期缓存
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredCache();
    }, this.config.cleanupInterval * 1000);

    // 定期输出统计信息（开发环境）
    if (process.env.NODE_ENV === 'development') {
      this.statsTimer = setInterval(() => {
        const stats = this.getStatistics();
        console.log('[AiCacheManager] 缓存统计:', {
          totalHitRate: `${(stats.totalHitRate * 100).toFixed(1)}%`,
          l1Hits: stats.l1Hits,
          l2Hits: stats.l2Hits,
          misses: stats.misses,
          l1Size: stats.l1Size
        });
      }, this.config.statsInterval * 1000);
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, data] of this.l1Cache.entries()) {
      const age = now - data.timestamp;
      if (age > data.strategy.ttl && !data.strategy.allowStale) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.l1Cache.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`[AiCacheManager] 清理了 ${expiredKeys.length} 个过期缓存项`);
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
    }
    this.l1Cache.clear();
  }
}

// ========================= 导出便捷函数 =========================

let globalCacheManager: AiCacheManager | null = null;

/**
 * 获取全局缓存管理器实例
 */
export function getGlobalCacheManager(): AiCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new AiCacheManager();
  }
  return globalCacheManager;
}

/**
 * 便捷的缓存获取函数
 */
export async function getCachedData<T>(
  key: string, 
  fetcher: () => Promise<T>, 
  strategy: CacheStrategy = AI_CACHE_STRATEGIES.DYNAMIC_DATA
): Promise<T> {
  const cacheManager = getGlobalCacheManager();
  
  // 尝试从缓存获取
  const cached = await cacheManager.get<T>(key, strategy);
  if (cached !== null) {
    return cached;
  }

  // 缓存未命中，执行获取函数
  const data = await fetcher();
  
  // 存储到缓存
  await cacheManager.set(key, data, strategy);
  
  return data;
} 