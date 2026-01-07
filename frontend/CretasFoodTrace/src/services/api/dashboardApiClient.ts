/**
 * Dashboard API Client
 * 仪表板数据API调用
 *
 * 注意：所有方法都需要 factoryId
 * - 工厂用户：自动从登录信息获取
 * - 平台管理员：必须显式提供 factoryId 参数
 */

import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';

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
    totalMaterialBatches?: number; // 总原材料批次数
  };
  kpi: {
    productionEfficiency: number;
    qualityPassRate: number;
    equipmentUtilization: number;
    unitCost?: number;        // 单位成本 (本月成本/产量)
    avgCycleHours?: number;   // 平均生产周期（小时）
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
 * 与后端 ReportController.getEquipmentDashboard 返回结构匹配
 */
export interface EquipmentDashboardData {
  totalEquipments: number;
  runningEquipments: number;
  maintenanceEquipments: number;
  averageUtilization: number;
  monitoring: Array<{
    equipmentId: number;
    name: string;
    status: string;
    weeklyUtilizationRate: number;
    totalOperatingHours: number | null;
    lastMaintenanceDate: string | null;
  }>;
  // 兼容旧结构（可选）
  statusDistribution?: Array<{
    status: string;
    count: number;
  }>;
  departmentDistribution?: Array<{
    department: string;
    count: number;
  }>;
  summary?: {
    totalEquipment: number;
    activeEquipment: number;
    utilizationRate: number;
    recentAlerts: number;
  };
}

/**
 * 质量统计数据
 * 与后端 ReportController.getQualityDashboard 返回结构匹配
 */
export interface QualityDashboardData {
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  passRate: number;
  defectRate: number;
  qualityGrade: string;
  avgPassRate: number;
  recentInspections: Array<{
    id: string;
    productionBatchId: number;
    inspectorId: number;
    inspectionDate: string;
    sampleSize: number;
    passCount?: number;
    failCount: number;
    passRate: number | null;
    result: string;
    qualityGrade: string | null;
    defectRate: number;
    notes: string;
  }>;
  monthlyStatistics: Record<string, unknown>;
  trends: Array<{
    date: string;
    inspections: number;
    passed: number;
    passRate: number;
  }>;
  // 兼容旧结构（可选）
  period?: string;
  summary?: {
    totalInspections: number;
    passedInspections: number;
    failedInspections: number;
    passRate: number;
  };
  issueDistribution?: Array<{
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
   * @param factoryId - 工厂ID（可选，工厂用户自动获取；平台管理员必须提供）
   */
  getDashboardOverview: async (
    period: 'today' | 'week' | 'month' = 'today',
    factoryId?: string
  ): Promise<{
    success: boolean;
    data: DashboardOverviewData;
    message?: string;
  }> => {
    const currentFactoryId = requireFactoryId(factoryId);
    const response = await apiClient.get<{
      success: boolean;
      data: DashboardOverviewData;
      message?: string;
    }>(`/api/mobile/${currentFactoryId}/reports/dashboard/overview`, {
      params: { period },
    });
    return response;
  },

  /**
   * 获取生产统计
   * @param params - 查询参数
   * @param factoryId - 工厂ID（可选，将从登录用户信息中获取）
   */
  getProductionStatistics: async (
    params?: {
      startDate?: string;
      endDate?: string;
      department?: string;
    },
    factoryId?: string
  ): Promise<{
    success: boolean;
    data: ProductionStatisticsData;
    message?: string;
  }> => {
    const currentFactoryId = requireFactoryId(factoryId);
    const response = await apiClient.get<{
      success: boolean;
      data: ProductionStatisticsData;
      message?: string;
    }>(`/api/mobile/${currentFactoryId}/reports/dashboard/production`, {
      params,
    });
    return response;
  },

  /**
   * 获取设备统计
   * @param factoryId - 工厂ID（可选，将从登录用户信息中获取）
   */
  getEquipmentDashboard: async (factoryId?: string): Promise<{
    success: boolean;
    data: EquipmentDashboardData;
    message?: string;
  }> => {
    const currentFactoryId = requireFactoryId(factoryId);
    const response = await apiClient.get<{
      success: boolean;
      data: EquipmentDashboardData;
      message?: string;
    }>(`/api/mobile/${currentFactoryId}/reports/dashboard/equipment`);
    return response;
  },

  /**
   * 获取质量统计
   * @param period - 时间周期: week, month, quarter
   * @param factoryId - 工厂ID（可选，将从登录用户信息中获取）
   */
  getQualityDashboard: async (
    period: 'week' | 'month' | 'quarter' = 'month',
    factoryId?: string
  ): Promise<{
    success: boolean;
    data: QualityDashboardData;
    message?: string;
  }> => {
    const currentFactoryId = requireFactoryId(factoryId);
    const response = await apiClient.get<{
      success: boolean;
      data: QualityDashboardData;
      message?: string;
    }>(`/api/mobile/${currentFactoryId}/reports/dashboard/quality`, {
      params: { period },
    });
    return response;
  },

  /**
   * 获取告警统计
   * @param period - 时间周期: week, month
   * @param factoryId - 工厂ID（可选，将从登录用户信息中获取）
   */
  getAlertsDashboard: async (
    period: 'week' | 'month' = 'week',
    factoryId?: string
  ): Promise<{
    success: boolean;
    data: AlertsDashboardData;
    message?: string;
  }> => {
    const currentFactoryId = requireFactoryId(factoryId);
    const response = await apiClient.get<{
      success: boolean;
      data: AlertsDashboardData;
      message?: string;
    }>(`/api/mobile/${currentFactoryId}/reports/dashboard/alerts`, {
      params: { period },
    });
    return response;
  },

  /**
   * 获取趋势分析
   * @param params - 查询参数
   * @param factoryId - 工厂ID（可选，将从登录用户信息中获取）
   */
  getTrendAnalysis: async (
    params: {
      period?: 'week' | 'month' | 'quarter';
      metric?: 'production' | 'quality';
    } = {},
    factoryId?: string
  ): Promise<{
    success: boolean;
    data: TrendAnalysisData;
    message?: string;
  }> => {
    const currentFactoryId = requireFactoryId(factoryId);
    const response = await apiClient.get<{
      success: boolean;
      data: TrendAnalysisData;
      message?: string;
    }>(`/api/mobile/${currentFactoryId}/reports/dashboard/trends`, {
      params,
    });
    return response;
  },
};

// 别名导出，兼容旧代码
export const dashboardApiClient = dashboardAPI;

export default dashboardAPI;
