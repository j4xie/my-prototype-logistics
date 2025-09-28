import { alertApiClient, AlertNotification, AlertStatistics, AlertsSummary } from '../api/alertApiClient';
import { StorageService } from '../storage/storageService';
import { NetworkManager } from '../networkManager';

/**
 * 告警服务
 * 提供告警管理的业务逻辑封装
 */
export class AlertService {
  private static readonly CACHE_KEY_PREFIX = 'alert_cache_';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取告警列表
   */
  static async getAlerts(params?: {
    page?: number;
    limit?: number;
    severity?: AlertNotification['severity'];
    status?: AlertNotification['status'];
    alertType?: AlertNotification['alertType'];
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'severity' | 'status';
    sortOrder?: 'asc' | 'desc';
    useCache?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      alerts: AlertNotification[];
      total: number;
      page: number;
      limit: number;
    };
    message?: string;
  }> {
    try {
      // 生成缓存key
      const cacheKey = `${this.CACHE_KEY_PREFIX}list_${JSON.stringify(params || {})}`;
      
      // 尝试从缓存获取（如果允许）
      if (params?.useCache !== false) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的告警列表数据');
          return { success: true, data: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        // 尝试获取缓存数据作为离线回退
        const offlineData = await this.getCachedData(cacheKey);
        if (offlineData) {
          return { success: true, data: offlineData, message: '网络不可用，显示缓存数据' };
        }
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.getAlerts({
          page: params?.page || 1,
          limit: params?.limit || 20,
          severity: params?.severity,
          status: params?.status,
          alertType: params?.alertType,
          startDate: params?.startDate,
          endDate: params?.endDate,
          sortBy: params?.sortBy || 'createdAt',
          sortOrder: params?.sortOrder || 'desc'
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存数据
        await this.setCachedData(cacheKey, response.data);
        
        console.log('告警列表获取成功:', {
          count: response.data.alerts.length,
          total: response.data.total,
          page: response.data.page
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取告警列表失败' };
    } catch (error) {
      console.error('获取告警列表失败:', error);
      return { success: false, message: error.message || '获取告警列表失败' };
    }
  }

  /**
   * 获取告警详情
   */
  static async getAlertDetail(id: string): Promise<{
    success: boolean;
    alert?: AlertNotification;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.getAlertById(id),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        console.log('告警详情获取成功:', response.data);
        return {
          success: true,
          alert: response.data
        };
      }

      return { success: false, message: response.message || '获取告警详情失败' };
    } catch (error) {
      console.error('获取告警详情失败:', error);
      return { success: false, message: error.message || '获取告警详情失败' };
    }
  }

  /**
   * 确认告警
   */
  static async acknowledgeAlert(id: string, notes?: string): Promise<{
    success: boolean;
    alert?: AlertNotification;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.acknowledgeAlert(id, notes),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 清除相关缓存
        await this.clearRelatedCache();
        
        console.log('告警确认成功:', response.data);
        return {
          success: true,
          alert: response.data,
          message: '告警已确认'
        };
      }

      return { success: false, message: response.message || '确认告警失败' };
    } catch (error) {
      console.error('确认告警失败:', error);
      return { success: false, message: error.message || '确认告警失败' };
    }
  }

  /**
   * 解决告警
   */
  static async resolveAlert(id: string, resolutionData: {
    resolutionNotes: string;
    correctiveActions?: string;
  }): Promise<{
    success: boolean;
    alert?: AlertNotification;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.resolveAlert(id, resolutionData),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 清除相关缓存
        await this.clearRelatedCache();
        
        console.log('告警解决成功:', response.data);
        return {
          success: true,
          alert: response.data,
          message: '告警已解决'
        };
      }

      return { success: false, message: response.message || '解决告警失败' };
    } catch (error) {
      console.error('解决告警失败:', error);
      return { success: false, message: error.message || '解决告警失败' };
    }
  }

  /**
   * 批量处理告警
   */
  static async batchProcessAlerts(alertIds: string[], action: {
    type: 'acknowledge' | 'resolve' | 'assign';
    data?: any;
  }): Promise<{
    success: boolean;
    result?: {
      succeeded: string[];
      failed: Array<{ id: string; reason: string }>;
      total: number;
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.batchUpdateAlerts(alertIds, action),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 清除相关缓存
        await this.clearRelatedCache();
        
        console.log('批量处理告警成功:', response.data);
        return {
          success: true,
          result: response.data,
          message: `成功处理 ${response.data.succeeded.length} 个告警`
        };
      }

      return { success: false, message: response.message || '批量处理失败' };
    } catch (error) {
      console.error('批量处理告警失败:', error);
      return { success: false, message: error.message || '批量处理失败' };
    }
  }

  /**
   * 获取告警统计
   */
  static async getAlertStatistics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'severity' | 'type' | 'status';
  }): Promise<{
    success: boolean;
    statistics?: AlertStatistics;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.getAlertStatistics(params),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        console.log('告警统计获取成功:', response.data);
        return {
          success: true,
          statistics: response.data
        };
      }

      return { success: false, message: response.message || '获取告警统计失败' };
    } catch (error) {
      console.error('获取告警统计失败:', error);
      return { success: false, message: error.message || '获取告警统计失败' };
    }
  }

  /**
   * 获取告警摘要
   */
  static async getAlertsSummary(): Promise<{
    success: boolean;
    summary?: AlertsSummary;
    message?: string;
  }> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}summary`;
      
      // 尝试从缓存获取
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        console.log('使用缓存的告警摘要数据');
        return { success: true, summary: cachedData };
      }

      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.getAlertsSummary(),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存摘要数据（较短的缓存时间）
        await this.setCachedData(cacheKey, response.data, 2 * 60 * 1000); // 2分钟
        
        console.log('告警摘要获取成功:', response.data);
        return {
          success: true,
          summary: response.data
        };
      }

      return { success: false, message: response.message || '获取告警摘要失败' };
    } catch (error) {
      console.error('获取告警摘要失败:', error);
      return { success: false, message: error.message || '获取告警摘要失败' };
    }
  }

  /**
   * 获取用户分配的告警
   */
  static async getAssignedAlerts(userId?: number, params?: {
    page?: number;
    limit?: number;
    status?: AlertNotification['status'];
  }): Promise<{
    success: boolean;
    data?: {
      alerts: AlertNotification[];
      total: number;
      page: number;
      limit: number;
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => alertApiClient.getAssignedAlerts(userId, params),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        console.log('分配告警获取成功:', {
          count: response.data.alerts.length,
          total: response.data.total
        });
        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取分配告警失败' };
    } catch (error) {
      console.error('获取分配告警失败:', error);
      return { success: false, message: error.message || '获取分配告警失败' };
    }
  }

  /**
   * 获取告警严重程度显示信息
   */
  static getSeverityDisplayInfo(severity: AlertNotification['severity']) {
    const severityMap = {
      critical: { label: '紧急', color: '#FF4444', icon: 'alert-circle' },
      high: { label: '高', color: '#FF8800', icon: 'warning' },
      medium: { label: '中', color: '#FFBB33', icon: 'alert-triangle' },
      low: { label: '低', color: '#00AA88', icon: 'info' }
    };
    return severityMap[severity] || severityMap.medium;
  }

  /**
   * 获取告警状态显示信息
   */
  static getStatusDisplayInfo(status: AlertNotification['status']) {
    const statusMap = {
      new: { label: '新建', color: '#FF4444', icon: 'circle' },
      acknowledged: { label: '已确认', color: '#FFBB33', icon: 'check-circle' },
      in_progress: { label: '处理中', color: '#00AAFF', icon: 'clock' },
      resolved: { label: '已解决', color: '#00AA88', icon: 'check-circle-2' },
      closed: { label: '已关闭', color: '#888888', icon: 'x-circle' }
    };
    return statusMap[status] || statusMap.new;
  }

  /**
   * 获取告警类型显示信息
   */
  static getTypeDisplayInfo(alertType: AlertNotification['alertType']) {
    const typeMap = {
      quality: { label: '质量', color: '#FF4444', icon: 'shield-alert' },
      equipment: { label: '设备', color: '#00AAFF', icon: 'settings' },
      production: { label: '生产', color: '#FFBB33', icon: 'activity' },
      safety: { label: '安全', color: '#FF8800', icon: 'shield' }
    };
    return typeMap[alertType] || typeMap.production;
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
  private static async clearRelatedCache(): Promise<void> {
    try {
      // 获取所有缓存键
      const keys = await StorageService.getAllKeys();
      const alertCacheKeys = keys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));
      
      // 删除所有告警相关缓存
      await Promise.all(
        alertCacheKeys.map(key => StorageService.removeItem(key))
      );
      
      console.log('清除告警缓存完成:', alertCacheKeys.length);
    } catch (error) {
      console.warn('清除缓存失败:', error);
    }
  }

  /**
   * 格式化时间显示
   */
  static formatTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return '刚刚';
      if (diffMinutes < 60) return `${diffMinutes}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;
      
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }
}