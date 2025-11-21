/**
 * 告警管理API客户端
 * 设备告警和异常提醒功能
 * ✅ P1-5: 后端已实现
 */

import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

export interface AlertDTO {
  id: number | string;
  factoryId: string;
  equipmentId: string;
  equipmentName?: string;
  alertType: string;
  level: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  message: string;
  details?: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: number;
  resolvedAt?: string;
  resolvedBy?: number;
  resolutionNotes?: string;
  ignoredAt?: string;
  ignoredBy?: number;
  ignoreReason?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

class AlertApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}`;
  }

  /**
   * 获取设备告警列表
   * 端点: GET /api/mobile/{factoryId}/equipment-alerts
   * ✅ P1-5: 后端已实现
   * ⚠️ 注意: 后端页码从1开始，不是0
   */
  async getEquipmentAlerts(params: {
    factoryId?: string;
    page?: number;
    size?: number;
    status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    code: number;
    data: PageResponse<AlertDTO>;
    message?: string;
  }> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get(
      `${this.getPath(factoryId)}/equipment-alerts`,
      { params: queryParams }
    );
    return response.data;
  }

  /**
   * 解决告警
   * 端点: POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve
   * ✅ P1-5: 后端已实现
   */
  async resolveAlert(params: {
    factoryId: string;
    alertId: string;
    resolutionNotes?: string;
    resolvedBy: number;
  }): Promise<{
    success: boolean;
    code: number;
    data: {
      id: string;
      status: string;
      resolvedAt: string;
      resolvedBy: number;
    };
    message?: string;
  }> {
    const { factoryId, alertId, ...data } = params;
    const response = await apiClient.post(
      `${this.getPath(factoryId)}/equipment/alerts/${alertId}/resolve`,
      data
    );
    return response.data;
  }

  /**
   * 忽略告警
   * 端点: POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/ignore
   */
  async ignoreAlert(params: {
    factoryId: string;
    alertId: string;
    reason?: string;
  }): Promise<{
    success: boolean;
    code: number;
    data: {
      id: string;
      status: string;
    };
    message?: string;
  }> {
    const { factoryId, alertId, ...data } = params;
    const response = await apiClient.post(
      `${this.getPath(factoryId)}/equipment/alerts/${alertId}/ignore`,
      data
    );
    return response.data;
  }

  /**
   * 获取告警统计信息
   * 端点: GET /api/mobile/{factoryId}/equipment-alerts/statistics
   */
  async getAlertStatistics(factoryId?: string): Promise<{
    success: boolean;
    code: number;
    data: {
      total: number;
      pending: number;
      resolved: number;
      critical: number;
      warning: number;
      info: number;
    };
    message?: string;
  }> {
    const response = await apiClient.get(
      `${this.getPath(factoryId)}/equipment-alerts/statistics`
    );
    return response.data;
  }
}

export const alertApiClient = new AlertApiClient();
export default alertApiClient;
