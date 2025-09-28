import { apiClient } from './apiClient';

// 告警通知接口类型
export interface AlertNotification {
  id: string;
  factoryId: string;
  alertType: 'quality' | 'equipment' | 'production' | 'safety';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  sourceId?: string;
  sourceType?: string;
  assignedTo?: any;
  status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: number;
  resolutionNotes?: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

// 告警统计数据接口
export interface AlertStatistics {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  responseTime: {
    average: number;
    median: number;
    byPriority: Record<string, number>;
  };
  trends: Array<{ date: string; count: number; resolved: number }>;
}

// 告警摘要接口
export interface AlertsSummary {
  critical: { count: number; latest?: AlertNotification };
  high: { count: number; latest?: AlertNotification };
  medium: { count: number; latest?: AlertNotification };
  low: { count: number; latest?: AlertNotification };
  totalUnresolved: number;
  avgResponseTime: number;
}

/**
 * 告警系统API客户端
 * 完全对接后端 /api/mobile/processing/alerts/* API
 */
export class AlertApiClient {
  private readonly BASE_PATH = '/api/mobile/processing';

  /**
   * 获取告警列表 (分页、过滤、排序)
   */
  async getAlerts(params?: {
    page?: number;
    limit?: number;
    severity?: AlertNotification['severity'];
    status?: AlertNotification['status'];
    alertType?: AlertNotification['alertType'];
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'severity' | 'status';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<{ 
    alerts: AlertNotification[]; 
    total: number; 
    page: number; 
    limit: number 
  }>> {
    try {
      console.log('获取告警列表:', params);

      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.severity) queryParams.set('severity', params.severity);
      if (params?.status) queryParams.set('status', params.status);
      if (params?.alertType) queryParams.set('alertType', params.alertType);
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);
      if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/alerts?${queryParams.toString()}` 
        : `${this.BASE_PATH}/alerts`;

      const response = await apiClient.get<ApiResponse<{ 
        alerts: AlertNotification[]; 
        total: number; 
        page: number; 
        limit: number 
      }>>(url);

      console.log('告警列表获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取告警列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个告警详情
   */
  async getAlertById(id: string): Promise<ApiResponse<AlertNotification>> {
    try {
      console.log('获取告警详情:', id);

      const response = await apiClient.get<ApiResponse<AlertNotification>>(
        `${this.BASE_PATH}/alerts/${id}`
      );

      console.log('告警详情获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取告警详情失败:', error);
      throw error;
    }
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(id: string, notes?: string): Promise<ApiResponse<AlertNotification>> {
    try {
      console.log('确认告警:', { id, notes });

      const response = await apiClient.post<ApiResponse<AlertNotification>>(
        `${this.BASE_PATH}/alerts/${id}/acknowledge`,
        { notes }
      );

      console.log('告警确认成功:', response);
      return response;
    } catch (error) {
      console.error('确认告警失败:', error);
      throw error;
    }
  }

  /**
   * 解决告警
   */
  async resolveAlert(id: string, resolutionData: {
    resolutionNotes: string;
    correctiveActions?: string;
  }): Promise<ApiResponse<AlertNotification>> {
    try {
      console.log('解决告警:', { id, resolutionData });

      const response = await apiClient.post<ApiResponse<AlertNotification>>(
        `${this.BASE_PATH}/alerts/${id}/resolve`,
        resolutionData
      );

      console.log('告警解决成功:', response);
      return response;
    } catch (error) {
      console.error('解决告警失败:', error);
      throw error;
    }
  }

  /**
   * 批量操作告警
   */
  async batchUpdateAlerts(ids: string[], action: {
    type: 'acknowledge' | 'resolve' | 'assign';
    data?: any;
  }): Promise<ApiResponse<{
    succeeded: string[];
    failed: Array<{ id: string; reason: string }>;
    total: number;
  }>> {
    try {
      console.log('批量操作告警:', { ids, action });

      const response = await apiClient.post<ApiResponse<{
        succeeded: string[];
        failed: Array<{ id: string; reason: string }>;
        total: number;
      }>>(`${this.BASE_PATH}/alerts/batch`, {
        alertIds: ids,
        action
      });

      console.log('批量操作成功:', response);
      return response;
    } catch (error) {
      console.error('批量操作失败:', error);
      throw error;
    }
  }

  /**
   * 告警统计数据
   */
  async getAlertStatistics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'severity' | 'type' | 'status';
  }): Promise<ApiResponse<AlertStatistics>> {
    try {
      console.log('获取告警统计:', params);

      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);
      if (params?.groupBy) queryParams.set('groupBy', params.groupBy);

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/alerts/statistics?${queryParams.toString()}` 
        : `${this.BASE_PATH}/alerts/statistics`;

      const response = await apiClient.get<ApiResponse<AlertStatistics>>(url);

      console.log('告警统计获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取告警统计失败:', error);
      throw error;
    }
  }

  /**
   * 告警摘要 (按严重级别)
   */
  async getAlertsSummary(): Promise<ApiResponse<AlertsSummary>> {
    try {
      console.log('获取告警摘要');

      const response = await apiClient.get<ApiResponse<AlertsSummary>>(
        `${this.BASE_PATH}/alerts/summary`
      );

      console.log('告警摘要获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取告警摘要失败:', error);
      throw error;
    }
  }

  /**
   * 创建告警 (系统内部使用)
   */
  async createAlert(alertData: {
    alertType: AlertNotification['alertType'];
    severity: AlertNotification['severity'];
    title: string;
    message: string;
    sourceId?: string;
    sourceType?: string;
    assignedTo?: any;
  }): Promise<ApiResponse<AlertNotification>> {
    try {
      console.log('创建告警:', alertData);

      const response = await apiClient.post<ApiResponse<AlertNotification>>(
        `${this.BASE_PATH}/alerts`,
        alertData
      );

      console.log('告警创建成功:', response);
      return response;
    } catch (error) {
      console.error('创建告警失败:', error);
      throw error;
    }
  }

  /**
   * 删除告警 (管理员功能)
   */
  async deleteAlert(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      console.log('删除告警:', id);

      const response = await apiClient.delete<ApiResponse<{ success: boolean; message: string }>>(
        `${this.BASE_PATH}/alerts/${id}`
      );

      console.log('告警删除成功:', response);
      return response;
    } catch (error) {
      console.error('删除告警失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户分配的告警
   */
  async getAssignedAlerts(userId?: number, params?: {
    page?: number;
    limit?: number;
    status?: AlertNotification['status'];
  }): Promise<ApiResponse<{ 
    alerts: AlertNotification[]; 
    total: number; 
    page: number; 
    limit: number 
  }>> {
    try {
      console.log('获取分配告警:', { userId, params });

      const queryParams = new URLSearchParams();
      if (userId) queryParams.set('assignedTo', userId.toString());
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.status) queryParams.set('status', params.status);

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/alerts/assigned?${queryParams.toString()}` 
        : `${this.BASE_PATH}/alerts/assigned`;

      const response = await apiClient.get<ApiResponse<{ 
        alerts: AlertNotification[]; 
        total: number; 
        page: number; 
        limit: number 
      }>>(url);

      console.log('分配告警获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取分配告警失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const alertApiClient = new AlertApiClient();