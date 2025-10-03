import { apiClient } from './apiClient';

// 系统日志接口类型
export interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  category: 'auth' | 'api' | 'database' | 'business' | 'system';
  message: string;
  details?: any;
  userId?: number;
  factoryId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// API访问日志接口
export interface ApiAccessLog {
  id: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  userId?: number;
  factoryId?: string;
  ipAddress: string;
  userAgent: string;
  requestBody?: any;
  responseBody?: any;
  error?: string;
  createdAt: string;
}

// 系统性能指标接口
export interface SystemPerformance {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  database: {
    connections: number;
    maxConnections: number;
    queryTime: number;
    slowQueries: number;
  };
  api: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
}

// 系统健康状态接口
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: {
      status: 'up' | 'down';
      responseTime: number;
      message?: string;
    };
    redis: {
      status: 'up' | 'down';
      responseTime: number;
      message?: string;
    };
    storage: {
      status: 'up' | 'down';
      available: boolean;
      message?: string;
    };
    network: {
      status: 'up' | 'down';
      latency: number;
      message?: string;
    };
  };
  uptime: number;
  version: string;
  timestamp: string;
}

// 系统统计数据接口
export interface SystemStatistics {
  users: {
    total: number;
    active: number;
    online: number;
    newToday: number;
  };
  factories: {
    total: number;
    active: number;
  };
  processing: {
    batchesToday: number;
    batchesTotal: number;
    activeProduction: number;
  };
  quality: {
    inspectionsToday: number;
    passRate: number;
    failuresCount: number;
  };
  alerts: {
    activeAlerts: number;
    criticalAlerts: number;
    resolvedToday: number;
  };
  storage: {
    filesCount: number;
    totalSize: number;
    imagesCount: number;
    documentsCount: number;
  };
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * 系统监控API客户端
 * 完全对接后端 /api/mobile/system/* API
 */
export class SystemApiClient {
  private readonly BASE_PATH = '/api/mobile/system';

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<ApiResponse<SystemHealth>> {
    try {
      console.log('获取系统健康状态');

      const response = await apiClient.get<ApiResponse<SystemHealth>>(
        `${this.BASE_PATH}/health`
      );

      console.log('系统健康状态获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取系统健康状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统性能指标
   */
  async getSystemPerformance(): Promise<ApiResponse<SystemPerformance>> {
    try {
      console.log('获取系统性能指标');

      const response = await apiClient.get<ApiResponse<SystemPerformance>>(
        `${this.BASE_PATH}/performance`
      );

      console.log('系统性能指标获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取系统性能指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统统计数据
   */
  async getSystemStatistics(): Promise<ApiResponse<SystemStatistics>> {
    try {
      console.log('获取系统统计数据');

      const response = await apiClient.get<ApiResponse<SystemStatistics>>(
        `${this.BASE_PATH}/statistics`
      );

      console.log('系统统计数据获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取系统统计数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统日志列表
   */
  async getSystemLogs(params?: {
    page?: number;
    limit?: number;
    level?: SystemLog['level'];
    category?: SystemLog['category'];
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<ApiResponse<{
    logs: SystemLog[];
    total: number;
    page: number;
    limit: number;
  }>> {
    try {
      console.log('获取系统日志:', params);

      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.level) queryParams.set('level', params.level);
      if (params?.category) queryParams.set('category', params.category);
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);
      if (params?.search) queryParams.set('search', params.search);

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/logs?${queryParams.toString()}` 
        : `${this.BASE_PATH}/logs`;

      const response = await apiClient.get<ApiResponse<{
        logs: SystemLog[];
        total: number;
        page: number;
        limit: number;
      }>>(url);

      console.log('系统日志获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取系统日志失败:', error);
      throw error;
    }
  }

  /**
   * 创建系统日志
   */
  async createSystemLog(logData: {
    level: SystemLog['level'];
    category: SystemLog['category'];
    message: string;
    details?: any;
  }): Promise<ApiResponse<SystemLog>> {
    try {
      console.log('创建系统日志:', logData);

      const response = await apiClient.post<ApiResponse<SystemLog>>(
        `${this.BASE_PATH}/logs`,
        logData
      );

      console.log('系统日志创建成功:', response);
      return response;
    } catch (error) {
      console.error('创建系统日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取API访问日志
   */
  async getApiAccessLogs(params?: {
    page?: number;
    limit?: number;
    method?: string;
    statusCode?: number;
    startDate?: string;
    endDate?: string;
    endpoint?: string;
  }): Promise<ApiResponse<{
    logs: ApiAccessLog[];
    total: number;
    page: number;
    limit: number;
  }>> {
    try {
      console.log('获取API访问日志:', params);

      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.method) queryParams.set('method', params.method);
      if (params?.statusCode) queryParams.set('statusCode', params.statusCode.toString());
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);
      if (params?.endpoint) queryParams.set('endpoint', params.endpoint);

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/api-logs?${queryParams.toString()}` 
        : `${this.BASE_PATH}/api-logs`;

      const response = await apiClient.get<ApiResponse<{
        logs: ApiAccessLog[];
        total: number;
        page: number;
        limit: number;
      }>>(url);

      console.log('API访问日志获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取API访问日志失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期日志
   */
  async cleanupLogs(params?: {
    daysToKeep?: number;
    category?: SystemLog['category'];
  }): Promise<ApiResponse<{
    deleted: number;
    message: string;
  }>> {
    try {
      console.log('清理过期日志:', params);

      const response = await apiClient.post<ApiResponse<{
        deleted: number;
        message: string;
      }>>(`${this.BASE_PATH}/cleanup-logs`, params || {});

      console.log('日志清理成功:', response);
      return response;
    } catch (error) {
      console.error('清理日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取实时系统指标
   */
  async getRealTimeMetrics(): Promise<ApiResponse<{
    cpu: number;
    memory: number;
    disk: number;
    activeUsers: number;
    requestsPerSecond: number;
    timestamp: string;
  }>> {
    try {
      console.log('获取实时系统指标');

      const response = await apiClient.get<ApiResponse<{
        cpu: number;
        memory: number;
        disk: number;
        activeUsers: number;
        requestsPerSecond: number;
        timestamp: string;
      }>>(`${this.BASE_PATH}/realtime-metrics`);

      console.log('实时系统指标获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取实时系统指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统配置信息
   */
  async getSystemConfig(): Promise<ApiResponse<{
    environment: string;
    version: string;
    features: string[];
    limits: {
      maxFileSize: number;
      maxUsers: number;
      maxFactories: number;
      maxStorage: number;
    };
    maintenance: {
      enabled: boolean;
      message?: string;
      scheduledAt?: string;
    };
  }>> {
    try {
      console.log('获取系统配置信息');

      const response = await apiClient.get<ApiResponse<{
        environment: string;
        version: string;
        features: string[];
        limits: {
          maxFileSize: number;
          maxUsers: number;
          maxFactories: number;
          maxStorage: number;
        };
        maintenance: {
          enabled: boolean;
          message?: string;
          scheduledAt?: string;
        };
      }>>(`${this.BASE_PATH}/config`);

      console.log('系统配置信息获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取系统配置信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取错误统计
   */
  async getErrorStatistics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'hour' | 'day' | 'week';
  }): Promise<ApiResponse<{
    total: number;
    byCategory: Record<string, number>;
    byStatusCode: Record<string, number>;
    trends: Array<{
      timestamp: string;
      count: number;
      errorRate: number;
    }>;
  }>> {
    try {
      console.log('获取错误统计:', params);

      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);
      if (params?.groupBy) queryParams.set('groupBy', params.groupBy);

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/error-statistics?${queryParams.toString()}` 
        : `${this.BASE_PATH}/error-statistics`;

      const response = await apiClient.get<ApiResponse<{
        total: number;
        byCategory: Record<string, number>;
        byStatusCode: Record<string, number>;
        trends: Array<{
          timestamp: string;
          count: number;
          errorRate: number;
        }>;
      }>>(url);

      console.log('错误统计获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取错误统计失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const systemApiClient = new SystemApiClient();