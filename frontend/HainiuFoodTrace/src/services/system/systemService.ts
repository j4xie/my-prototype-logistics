import { systemApiClient, SystemHealth, SystemPerformance, SystemStatistics, SystemLog, ApiAccessLog } from '../api/systemApiClient';
import { StorageService } from '../storage/storageService';
import { NetworkManager } from '../networkManager';

/**
 * 系统监控服务
 * 提供系统监控的业务逻辑封装
 */
export class SystemService {
  private static readonly CACHE_KEY_PREFIX = 'system_cache_';
  private static readonly CACHE_DURATION = 2 * 60 * 1000; // 2分钟缓存
  private static readonly METRICS_INTERVAL = 5000; // 5秒更新一次指标

  /**
   * 获取系统健康状态
   */
  static async getSystemHealth(useCache: boolean = true): Promise<{
    success: boolean;
    health?: SystemHealth;
    message?: string;
  }> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}health`;
      
      // 尝试从缓存获取（如果允许）
      if (useCache) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的系统健康数据');
          return { success: true, health: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        // 返回离线状态
        return {
          success: true,
          health: {
            status: 'unhealthy',
            services: {
              database: { status: 'down', responseTime: 0, message: '网络不可用' },
              redis: { status: 'down', responseTime: 0, message: '网络不可用' },
              storage: { status: 'down', available: false, message: '网络不可用' },
              network: { status: 'down', latency: 0, message: '网络不可用' }
            },
            uptime: 0,
            version: 'N/A',
            timestamp: new Date().toISOString()
          },
          message: '网络不可用'
        };
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.getSystemHealth(),
        { maxRetries: 1, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存数据（较短的缓存时间）
        await this.setCachedData(cacheKey, response.data, 1 * 60 * 1000); // 1分钟
        
        console.log('系统健康状态获取成功:', response.data.status);
        return {
          success: true,
          health: response.data
        };
      }

      return { success: false, message: response.message || '获取系统健康状态失败' };
    } catch (error) {
      console.error('获取系统健康状态失败:', error);
      return { success: false, message: error.message || '获取系统健康状态失败' };
    }
  }

  /**
   * 获取系统性能指标
   */
  static async getSystemPerformance(useCache: boolean = true): Promise<{
    success: boolean;
    performance?: SystemPerformance;
    message?: string;
  }> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}performance`;
      
      // 尝试从缓存获取（如果允许）
      if (useCache) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的系统性能数据');
          return { success: true, performance: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        // 尝试获取缓存数据作为离线回退
        const offlineData = await this.getCachedData(cacheKey);
        if (offlineData) {
          return { success: true, performance: offlineData, message: '网络不可用，显示缓存数据' };
        }
        throw new Error('网络连接不可用');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.getSystemPerformance(),
        { maxRetries: 1, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存数据
        await this.setCachedData(cacheKey, response.data, 30 * 1000); // 30秒
        
        console.log('系统性能指标获取成功');
        return {
          success: true,
          performance: response.data
        };
      }

      return { success: false, message: response.message || '获取系统性能指标失败' };
    } catch (error) {
      console.error('获取系统性能指标失败:', error);
      return { success: false, message: error.message || '获取系统性能指标失败' };
    }
  }

  /**
   * 获取系统统计数据
   */
  static async getSystemStatistics(useCache: boolean = true): Promise<{
    success: boolean;
    statistics?: SystemStatistics;
    message?: string;
  }> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}statistics`;
      
      // 尝试从缓存获取（如果允许）
      if (useCache) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的系统统计数据');
          return { success: true, statistics: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        // 尝试获取缓存数据作为离线回退
        const offlineData = await this.getCachedData(cacheKey);
        if (offlineData) {
          return { success: true, statistics: offlineData, message: '网络不可用，显示缓存数据' };
        }
        throw new Error('网络连接不可用');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.getSystemStatistics(),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存数据
        await this.setCachedData(cacheKey, response.data);
        
        console.log('系统统计数据获取成功');
        return {
          success: true,
          statistics: response.data
        };
      }

      return { success: false, message: response.message || '获取系统统计数据失败' };
    } catch (error) {
      console.error('获取系统统计数据失败:', error);
      return { success: false, message: error.message || '获取系统统计数据失败' };
    }
  }

  /**
   * 获取系统日志
   */
  static async getSystemLogs(params?: {
    page?: number;
    limit?: number;
    level?: SystemLog['level'];
    category?: SystemLog['category'];
    startDate?: string;
    endDate?: string;
    search?: string;
    useCache?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      logs: SystemLog[];
      total: number;
      page: number;
      limit: number;
    };
    message?: string;
  }> {
    try {
      // 生成缓存key
      const cacheKey = `${this.CACHE_KEY_PREFIX}logs_${JSON.stringify(params || {})}`;
      
      // 尝试从缓存获取（如果允许）
      if (params?.useCache !== false && params?.page === 1) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的系统日志数据');
          return { success: true, data: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.getSystemLogs({
          page: params?.page || 1,
          limit: params?.limit || 20,
          level: params?.level,
          category: params?.category,
          startDate: params?.startDate,
          endDate: params?.endDate,
          search: params?.search
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存第一页数据
        if (params?.page === 1 || !params?.page) {
          await this.setCachedData(cacheKey, response.data, 1 * 60 * 1000); // 1分钟
        }
        
        console.log('系统日志获取成功:', {
          count: response.data.logs.length,
          total: response.data.total,
          page: response.data.page
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取系统日志失败' };
    } catch (error) {
      console.error('获取系统日志失败:', error);
      return { success: false, message: error.message || '获取系统日志失败' };
    }
  }

  /**
   * 获取API访问日志
   */
  static async getApiAccessLogs(params?: {
    page?: number;
    limit?: number;
    method?: string;
    statusCode?: number;
    startDate?: string;
    endDate?: string;
    endpoint?: string;
    useCache?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      logs: ApiAccessLog[];
      total: number;
      page: number;
      limit: number;
    };
    message?: string;
  }> {
    try {
      // 生成缓存key
      const cacheKey = `${this.CACHE_KEY_PREFIX}api_logs_${JSON.stringify(params || {})}`;
      
      // 尝试从缓存获取（如果允许）
      if (params?.useCache !== false && params?.page === 1) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的API日志数据');
          return { success: true, data: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.getApiAccessLogs({
          page: params?.page || 1,
          limit: params?.limit || 20,
          method: params?.method,
          statusCode: params?.statusCode,
          startDate: params?.startDate,
          endDate: params?.endDate,
          endpoint: params?.endpoint
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存第一页数据
        if (params?.page === 1 || !params?.page) {
          await this.setCachedData(cacheKey, response.data, 1 * 60 * 1000); // 1分钟
        }
        
        console.log('API访问日志获取成功:', {
          count: response.data.logs.length,
          total: response.data.total,
          page: response.data.page
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取API访问日志失败' };
    } catch (error) {
      console.error('获取API访问日志失败:', error);
      return { success: false, message: error.message || '获取API访问日志失败' };
    }
  }

  /**
   * 获取实时系统指标
   */
  static async getRealTimeMetrics(): Promise<{
    success: boolean;
    metrics?: {
      cpu: number;
      memory: number;
      disk: number;
      activeUsers: number;
      requestsPerSecond: number;
      timestamp: string;
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.getRealTimeMetrics(),
        { maxRetries: 1, baseDelay: 500 }
      );

      if (response.success && response.data) {
        console.log('实时系统指标获取成功');
        return {
          success: true,
          metrics: response.data
        };
      }

      return { success: false, message: response.message || '获取实时指标失败' };
    } catch (error) {
      console.error('获取实时指标失败:', error);
      return { success: false, message: error.message || '获取实时指标失败' };
    }
  }

  /**
   * 记录系统日志
   */
  static async logSystemEvent(logData: {
    level: SystemLog['level'];
    category: SystemLog['category'];
    message: string;
    details?: any;
  }): Promise<{
    success: boolean;
    log?: SystemLog;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.createSystemLog(logData),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        console.log('系统日志记录成功:', response.data);
        
        // 清除日志缓存
        await this.clearRelatedCache('logs');
        
        return {
          success: true,
          log: response.data
        };
      }

      return { success: false, message: response.message || '记录系统日志失败' };
    } catch (error) {
      console.error('记录系统日志失败:', error);
      return { success: false, message: error.message || '记录系统日志失败' };
    }
  }

  /**
   * 清理过期日志
   */
  static async cleanupLogs(daysToKeep: number = 30): Promise<{
    success: boolean;
    deleted?: number;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.cleanupLogs({ daysToKeep }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        console.log('日志清理成功:', response.data);
        
        // 清除日志缓存
        await this.clearRelatedCache('logs');
        
        return {
          success: true,
          deleted: response.data.deleted,
          message: response.data.message
        };
      }

      return { success: false, message: response.message || '清理日志失败' };
    } catch (error) {
      console.error('清理日志失败:', error);
      return { success: false, message: error.message || '清理日志失败' };
    }
  }

  /**
   * 获取错误统计
   */
  static async getErrorStatistics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'hour' | 'day' | 'week';
  }): Promise<{
    success: boolean;
    data?: {
      total: number;
      byCategory: Record<string, number>;
      byStatusCode: Record<string, number>;
      trends: Array<{
        timestamp: string;
        count: number;
        errorRate: number;
      }>;
    };
    message?: string;
  }> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}error_stats_${JSON.stringify(params || {})}`;
      
      // 尝试从缓存获取
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        console.log('使用缓存的错误统计数据');
        return { success: true, data: cachedData };
      }

      const response = await NetworkManager.executeWithRetry(
        () => systemApiClient.getErrorStatistics(params),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存数据
        await this.setCachedData(cacheKey, response.data, 5 * 60 * 1000); // 5分钟
        
        console.log('错误统计获取成功:', {
          total: response.data.total
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取错误统计失败' };
    } catch (error) {
      console.error('获取错误统计失败:', error);
      return { success: false, message: error.message || '获取错误统计失败' };
    }
  }

  /**
   * 获取服务状态显示信息
   */
  static getServiceStatusInfo(status: 'up' | 'down'): {
    label: string;
    color: string;
    icon: string;
  } {
    return status === 'up'
      ? { label: '正常', color: '#00AA88', icon: 'checkmark-circle' }
      : { label: '异常', color: '#FF4444', icon: 'close-circle' };
  }

  /**
   * 获取健康状态显示信息
   */
  static getHealthStatusInfo(status: 'healthy' | 'degraded' | 'unhealthy'): {
    label: string;
    color: string;
    icon: string;
  } {
    const statusMap = {
      healthy: { label: '健康', color: '#00AA88', icon: 'checkmark-circle' },
      degraded: { label: '降级', color: '#FFBB33', icon: 'warning' },
      unhealthy: { label: '异常', color: '#FF4444', icon: 'close-circle' }
    };
    return statusMap[status] || statusMap.unhealthy;
  }

  /**
   * 获取日志级别显示信息
   */
  static getLogLevelInfo(level: SystemLog['level']): {
    label: string;
    color: string;
    icon: string;
  } {
    const levelMap = {
      info: { label: '信息', color: '#007AFF', icon: 'information-circle' },
      warning: { label: '警告', color: '#FFBB33', icon: 'warning' },
      error: { label: '错误', color: '#FF4444', icon: 'close-circle' },
      debug: { label: '调试', color: '#666666', icon: 'bug' }
    };
    return levelMap[level] || levelMap.info;
  }

  /**
   * 格式化字节大小
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 格式化运行时间
   */
  static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    
    return parts.length > 0 ? parts.join(' ') : '刚刚启动';
  }

  /**
   * 缓存数据
   */
  private static async setCachedData(key: string, data: any, customDuration?: number): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        duration: customDuration || this.CACHE_DURATION
      };
      await StorageService.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('缓存数据失败:', error);
    }
  }

  /**
   * 获取缓存数据
   */
  private static async getCachedData(key: string): Promise<any | null> {
    try {
      const cachedItem = await StorageService.getItem(key);
      if (!cachedItem) return null;

      const cacheData = JSON.parse(cachedItem);
      const isExpired = Date.now() - cacheData.timestamp > cacheData.duration;
      
      if (isExpired) {
        await StorageService.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('获取缓存数据失败:', error);
      return null;
    }
  }

  /**
   * 清除相关缓存
   */
  private static async clearRelatedCache(type?: string): Promise<void> {
    try {
      // 获取所有缓存键
      const keys = await StorageService.getAllKeys();
      const systemCacheKeys = keys.filter(key => {
        if (type) {
          return key.startsWith(`${this.CACHE_KEY_PREFIX}${type}`);
        }
        return key.startsWith(this.CACHE_KEY_PREFIX);
      });
      
      // 删除相关缓存
      await Promise.all(
        systemCacheKeys.map(key => StorageService.removeItem(key))
      );
      
      console.log('清除系统缓存完成:', systemCacheKeys.length);
    } catch (error) {
      console.warn('清除缓存失败:', error);
    }
  }
}