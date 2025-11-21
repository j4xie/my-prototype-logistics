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
  // ✅ 后端已实现的今日统计字段 (2025-11-20)
  todayStats?: {
    productionCount: number;
    qualityCheckCount: number;
    materialReceived: number;
    ordersCompleted: number;
    productionEfficiency: number;
    activeWorkers: number;
    todayOutputKg: number;        // 今日产量kg
    totalBatches: number;
    totalWorkers: number;
    activeEquipment: number;      // 活跃设备数
    totalEquipment: number;       // 总设备数
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
 * 质量统计数据
 */
export interface QualityDashboardData {
  period: string;
  summary: {
    totalInspections: number;
    passedInspections: number;
    failedInspections: number;
    passRate: number;
  };
  trends: Array<{
    date: string;
    inspections: number;
    passed: number;
    passRate: number;
  }>;
  issueDistribution: Array<{
    issueType: string;
    count: number;
  }>;
}

/**
 * 告警统计数据
 */
export interface AlertsDashboardData {
  period: string;
  summary: {
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    criticalAlerts: number;
  };
  byType: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
  recent: Array<{
    id: string;
    type: string;
    message: string;
    severity: string;
    timestamp: string;
  }>;
}

/**
 * 趋势分析数据
 */
export interface TrendAnalysisData {
  period: string;
  metric: string;
  data: Array<{
    date: string;
    value: number;
    change: number;
  }>;
  summary: {
    average: number;
    trend: 'up' | 'down' | 'stable';
    changePercentage: number;
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
    const response = await apiClient.get<{
      success: boolean;
      data: DashboardOverviewData;
      message?: string;
    }>(`/api/mobile/${factoryId}/processing/dashboard/overview`, {
      params: { period },
    });
    return response;
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
    const response = await apiClient.get<{
      success: boolean;
      data: ProductionStatisticsData;
      message?: string;
    }>(`/api/mobile/${factoryId}/processing/dashboard/production`, {
      params,
    });
    return response;
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
    const response = await apiClient.get<{
      success: boolean;
      data: EquipmentDashboardData;
      message?: string;
    }>(`/api/mobile/${factoryId}/processing/dashboard/equipment`);
    return response;
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
    data: QualityDashboardData;
    message?: string;
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      data: QualityDashboardData;
      message?: string;
    }>(`/api/mobile/${factoryId}/processing/dashboard/quality`, {
      params: { period },
    });
    return response;
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
    data: AlertsDashboardData;
    message?: string;
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      data: AlertsDashboardData;
      message?: string;
    }>(`/api/mobile/${factoryId}/processing/dashboard/alerts`, {
      params: { period },
    });
    return response;
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
    data: TrendAnalysisData;
    message?: string;
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      data: TrendAnalysisData;
      message?: string;
    }>(`/api/mobile/${factoryId}/processing/dashboard/trends`, {
      params,
    });
    return response;
  },
};

// 别名导出，兼容旧代码
export const dashboardApiClient = dashboardAPI;

export default dashboardAPI;
