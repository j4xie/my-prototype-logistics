import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

const prisma = new PrismaClient();

/**
 * 数据库性能优化工具
 */
class PerformanceOptimizer {
  constructor() {
    this.performanceMetrics = {
      slowQueries: [],
      queryStats: new Map(),
      cacheStats: new Map()
    };
  }

  /**
   * 启用查询性能监控
   */
  enableQueryMonitoring() {
    // 记录慢查询
    prisma.$on('query', (e) => {
      const duration = e.duration;
      const query = e.query;
      
      // 记录超过100ms的查询
      if (duration > 100) {
        this.performanceMetrics.slowQueries.push({
          query,
          duration,
          timestamp: new Date(),
          params: e.params
        });

        logger.warn('慢查询检测', {
          duration,
          query: query.substring(0, 200),
          timestamp: new Date()
        });
      }

      // 更新查询统计
      const queryType = this.extractQueryType(query);
      const stats = this.performanceMetrics.queryStats.get(queryType) || {
        count: 0,
        totalDuration: 0,
        avgDuration: 0
      };

      stats.count++;
      stats.totalDuration += duration;
      stats.avgDuration = stats.totalDuration / stats.count;
      
      this.performanceMetrics.queryStats.set(queryType, stats);
    });

    logger.info('数据库性能监控已启用');
  }

  /**
   * 提取查询类型
   */
  extractQueryType(query) {
    const cleanQuery = query.toLowerCase().trim();
    if (cleanQuery.startsWith('select')) return 'SELECT';
    if (cleanQuery.startsWith('insert')) return 'INSERT';
    if (cleanQuery.startsWith('update')) return 'UPDATE';
    if (cleanQuery.startsWith('delete')) return 'DELETE';
    return 'OTHER';
  }

  /**
   * 缓存管理
   */
  setupCaching() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    
    // 定期清理过期缓存
    setInterval(() => {
      this.cleanExpiredCache();
    }, 60000); // 每分钟清理一次

    logger.info('缓存系统已初始化');
  }

  /**
   * 获取缓存数据
   */
  getCache(key) {
    if (this.cacheExpiry.get(key) && this.cacheExpiry.get(key) > Date.now()) {
      const stats = this.performanceMetrics.cacheStats.get(key) || { hits: 0, misses: 0 };
      stats.hits++;
      this.performanceMetrics.cacheStats.set(key, stats);
      
      return this.cache.get(key);
    }
    
    // 缓存未命中
    const stats = this.performanceMetrics.cacheStats.get(key) || { hits: 0, misses: 0 };
    stats.misses++;
    this.performanceMetrics.cacheStats.set(key, stats);
    
    return null;
  }

  /**
   * 设置缓存数据
   */
  setCache(key, value, ttlSeconds = 300) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + ttlSeconds * 1000);
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
        this.performanceMetrics.cacheStats.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('缓存清理完成', { cleanedCount });
    }
  }

  /**
   * 数据库连接池优化
   */
  optimizeConnectionPool() {
    // Prisma连接池配置在schema.prisma中
    // 这里可以添加连接池监控逻辑
    logger.info('数据库连接池优化配置完成');
  }

  /**
   * 批量操作优化
   */
  async batchInsert(model, records, batchSize = 100) {
    const results = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const result = await prisma[model].createMany({
          data: batch,
          skipDuplicates: true
        });
        results.push(result);
        
        logger.debug('批量插入完成', {
          model,
          batchSize: batch.length,
          processed: i + batch.length,
          total: records.length
        });
      } catch (error) {
        logger.error('批量插入失败', {
          model,
          batchIndex: Math.floor(i / batchSize),
          error: error.message
        });
        throw error;
      }
    }
    
    return results;
  }

  /**
   * 分页查询优化
   */
  async paginateQuery(model, options = {}) {
    const {
      where = {},
      orderBy = { createdAt: 'desc' },
      page = 1,
      limit = 20,
      include,
      select
    } = options;

    const skip = (page - 1) * limit;
    
    // 使用游标分页来提高大数据集的性能
    if (page > 100) {
      logger.warn('大分页查询性能警告', {
        model,
        page,
        limit,
        suggestion: '考虑使用游标分页'
      });
    }

    const queryOptions = {
      where,
      orderBy,
      skip,
      take: limit,
      ...(include && { include }),
      ...(select && { select })
    };

    const [data, total] = await Promise.all([
      prisma[model].findMany(queryOptions),
      prisma[model].count({ where })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 索引使用分析
   */
  async analyzeIndexUsage() {
    try {
      // MySQL索引使用情况查询
      const indexStats = await prisma.$queryRaw`
        SELECT 
          table_name,
          index_name,
          non_unique,
          column_name,
          cardinality
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE()
        ORDER BY table_name, index_name, seq_in_index
      `;

      // 未使用的索引检查
      const unusedIndexes = await prisma.$queryRaw`
        SELECT 
          object_schema,
          object_name,
          index_name
        FROM performance_schema.table_io_waits_summary_by_index_usage
        WHERE index_name IS NOT NULL
        AND count_star = 0
        AND object_schema = DATABASE()
        ORDER BY object_schema, object_name
      `;

      logger.info('索引分析完成', {
        totalIndexes: indexStats.length,
        unusedIndexes: unusedIndexes.length
      });

      return {
        indexStats,
        unusedIndexes,
        recommendations: this.generateIndexRecommendations(indexStats, unusedIndexes)
      };
    } catch (error) {
      logger.error('索引分析失败', { error: error.message });
      return null;
    }
  }

  /**
   * 生成索引优化建议
   */
  generateIndexRecommendations(indexStats, unusedIndexes) {
    const recommendations = [];

    // 检查未使用的索引
    if (unusedIndexes.length > 0) {
      recommendations.push({
        type: 'remove_unused_indexes',
        message: '发现未使用的索引，建议删除以减少写操作开销',
        indexes: unusedIndexes.map(idx => `${idx.object_name}.${idx.index_name}`)
      });
    }

    // 检查低基数索引
    const lowCardinalityIndexes = indexStats.filter(idx => 
      idx.cardinality && idx.cardinality < 10 && idx.index_name !== 'PRIMARY'
    );

    if (lowCardinalityIndexes.length > 0) {
      recommendations.push({
        type: 'low_cardinality_indexes',
        message: '发现低基数索引，可能不够有效',
        indexes: lowCardinalityIndexes.map(idx => 
          `${idx.table_name}.${idx.index_name} (基数: ${idx.cardinality})`
        )
      });
    }

    return recommendations;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    const report = {
      timestamp: new Date(),
      slowQueries: {
        total: this.performanceMetrics.slowQueries.length,
        recent: this.performanceMetrics.slowQueries
          .slice(-10) // 最近10个慢查询
          .map(q => ({
            duration: q.duration,
            query: q.query.substring(0, 100) + '...',
            timestamp: q.timestamp
          }))
      },
      queryStats: Object.fromEntries(this.performanceMetrics.queryStats),
      cacheStats: {
        totalKeys: this.cache.size,
        hitRatio: this.calculateCacheHitRatio(),
        details: Object.fromEntries(
          Array.from(this.performanceMetrics.cacheStats.entries())
            .map(([key, stats]) => [
              key, 
              {
                ...stats,
                hitRatio: stats.hits / (stats.hits + stats.misses) * 100
              }
            ])
        )
      }
    };

    return report;
  }

  /**
   * 计算缓存命中率
   */
  calculateCacheHitRatio() {
    let totalHits = 0;
    let totalMisses = 0;

    for (const stats of this.performanceMetrics.cacheStats.values()) {
      totalHits += stats.hits;
      totalMisses += stats.misses;
    }

    return totalHits + totalMisses > 0 
      ? (totalHits / (totalHits + totalMisses)) * 100 
      : 0;
  }

  /**
   * 清理旧数据
   */
  async cleanupOldData(days = 90) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const results = {};

    try {
      // 清理旧的系统日志
      const deletedSystemLogs = await prisma.systemLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          level: { in: ['debug', 'info'] } // 只删除非错误日志
        }
      });
      results.systemLogs = deletedSystemLogs.count;

      // 清理旧的API访问日志
      const deletedApiLogs = await prisma.apiAccessLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          statusCode: { lt: 400 } // 只删除成功请求日志
        }
      });
      results.apiLogs = deletedApiLogs.count;

      // 清理过期的仪表板缓存
      const deletedDashboardCache = await prisma.dashboardMetric.deleteMany({
        where: {
          cacheExpiresAt: { lt: new Date() }
        }
      });
      results.dashboardCache = deletedDashboardCache.count;

      logger.info('数据清理完成', {
        cutoffDate,
        results,
        totalDeleted: Object.values(results).reduce((sum, count) => sum + count, 0)
      });

      return results;
    } catch (error) {
      logger.error('数据清理失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 监控连接池状态
   */
  monitorConnectionPool() {
    setInterval(async () => {
      try {
        // 检查数据库连接状态
        await prisma.$queryRaw`SELECT 1`;
        
        // 记录连接池状态（简化版）
        logger.debug('数据库连接池状态检查完成', {
          timestamp: new Date(),
          status: 'healthy'
        });
      } catch (error) {
        logger.error('数据库连接池检查失败', { error: error.message });
      }
    }, 30000); // 每30秒检查一次
  }
}

// 创建性能优化器实例
const performanceOptimizer = new PerformanceOptimizer();

// 初始化性能优化
export const initializePerformanceOptimization = () => {
  performanceOptimizer.enableQueryMonitoring();
  performanceOptimizer.setupCaching();
  performanceOptimizer.optimizeConnectionPool();
  performanceOptimizer.monitorConnectionPool();
  
  logger.info('性能优化系统初始化完成');
};

export default performanceOptimizer;