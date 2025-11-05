/**
 * Dashboard API Client
 * 仪表板数据API调用
 */

import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 生产概览数据
 */
export interface DashboardOverviewData {
  period: string;
  summary: {
    totalBatches: number;
    activeBatches: number;
    completedBatches: number;
    qualityInspections: number;
    activeAlerts: number;
    onDutyWorkers: number;
    totalWorkers: number;
  };
  kpi: {
    productionEfficiency: number;
    qualityPassRate: number;
    equipmentUtilization: number;
  };
  alerts: {
    active: number;
    status: string;
  };
}

/**
 * 生产统计数据
 */
export interface ProductionStatisticsData {
  batchStatusDistribution: Array<{
    status: string;
    count: number;
    totalQuantity: number;
  }>;
  productTypeStats: Array<{
    productType: string;
    count: number;
    totalQuantity: number;
    avgQuantity: number;
  }>;
  dailyTrends: Array<{
    date: string;
    batches: number;
    quantity: number;
    completed: number;
  }>;
}

/**
 * 设备统计数据
 */
export interface EquipmentDashboardData {
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  departmentDistribution: Array<{
    department: string;
    count: number;
  }>;
  summary: {
    totalEquipment: number;
    activeEquipment: number;
    utilizationRate: number;
    recentAlerts: number;
  };
}

/**
 * Dashboard API Client
 */
export const dashboardAPI = {
  /**
   * 获取生产概览
   * @param period - 时间周期: today, week, month
   * @param factoryId - 工厂ID（可选，默认使用DEFAULT_FACTORY_ID）
   */
  getDashboardOverview: async (
    period: 'today' | 'week' | 'month' = 'today',
    factoryId: string = DEFAULT_FACTORY_ID
  ): Promise<{
    success: boolean;
    data: DashboardOverviewData;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/mobile/${factoryId}/processing/dashboard/overview`, {
      params: { period },
    });
    return response.data;
  },

  /**
   * 获取生产统计
   * @param params - 查询参数
   * @param factoryId - 工厂ID（可选，默认使用DEFAULT_FACTORY_ID）
   */
  getProductionStatistics: async (
    params?: {
      startDate?: string;
      endDate?: string;
      department?: string;
    },
    factoryId: string = DEFAULT_FACTORY_ID
  ): Promise<{
    success: boolean;
    data: ProductionStatisticsData;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/mobile/${factoryId}/processing/dashboard/production`, {
      params,
    });
    return response.data;
  },

  /**
   * 获取设备统计
   * @param factoryId - 工厂ID（可选，默认使用DEFAULT_FACTORY_ID）
   */
  getEquipmentDashboard: async (factoryId: string = DEFAULT_FACTORY_ID): Promise<{
    success: boolean;
    data: EquipmentDashboardData;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/mobile/${factoryId}/processing/dashboard/equipment`);
    return response.data;
  },

  /**
   * 获取质量统计
   * @param period - 时间周期: week, month, quarter
   * @param factoryId - 工厂ID（可选，默认使用DEFAULT_FACTORY_ID）
   */
  getQualityDashboard: async (
    period: 'week' | 'month' | 'quarter' = 'month',
    factoryId: string = DEFAULT_FACTORY_ID
  ): Promise<{
    success: boolean;
    data: any;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/mobile/${factoryId}/processing/dashboard/quality`, {
      params: { period },
    });
    return response.data;
  },

  /**
   * 获取告警统计
   * @param period - 时间周期: week, month
   * @param factoryId - 工厂ID（可选，默认使用DEFAULT_FACTORY_ID）
   */
  getAlertsDashboard: async (
    period: 'week' | 'month' = 'week',
    factoryId: string = DEFAULT_FACTORY_ID
  ): Promise<{
    success: boolean;
    data: any;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/mobile/${factoryId}/processing/dashboard/alerts`, {
      params: { period },
    });
    return response.data;
  },

  /**
   * 获取趋势分析
   * @param params - 查询参数
   * @param factoryId - 工厂ID（可选，默认使用DEFAULT_FACTORY_ID）
   */
  getTrendAnalysis: async (
    params: {
      period?: 'week' | 'month' | 'quarter';
      metric?: 'production' | 'quality';
    } = {},
    factoryId: string = DEFAULT_FACTORY_ID
  ): Promise<{
    success: boolean;
    data: any;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/mobile/${factoryId}/processing/dashboard/trends`, {
      params,
    });
    return response.data;
  },
};

// 别名导出，兼容旧代码
export const dashboardApiClient = dashboardAPI;

export default dashboardAPI;
