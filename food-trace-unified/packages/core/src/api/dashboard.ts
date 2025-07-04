// 仪表盘API - 重点模块
import { api } from './client';
import type { ApiResponse } from '../types/api';
import type { DashboardStats, OverviewData } from '../types/state';

// 仪表盘统计数据API
export const dashboardApi = {
  // 获取仪表盘统计数据
  getStats: async (params?: {
    dateFrom?: string;
    dateTo?: string;
    category?: string[];
    status?: string[];
  }): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/api/dashboard/stats', { params });
    return response.data;
  },

  // 获取概览数据
  getOverview: async (): Promise<OverviewData> => {
    const response = await api.get<OverviewData>('/api/dashboard/overview');
    return response.data;
  },

  // 获取实时数据
  getRealTimeData: async (): Promise<{
    activeBatches: number;
    todayProduction: number;
    qualityScore: number;
    alerts: number;
  }> => {
    const response = await api.get('/api/dashboard/realtime');
    return response.data;
  },

  // 获取生产趋势
  getProductionTrend: async (params: {
    period: 'week' | 'month' | 'quarter' | 'year';
    category?: string;
  }) => {
    const response = await api.get('/api/dashboard/trends/production', { params });
    return response.data;
  },

  // 获取质量趋势
  getQualityTrend: async (params: {
    period: 'week' | 'month' | 'quarter' | 'year';
    category?: string;
  }) => {
    const response = await api.get('/api/dashboard/trends/quality', { params });
    return response.data;
  },

  // 获取销售趋势
  getSalesTrend: async (params: {
    period: 'week' | 'month' | 'quarter' | 'year';
    category?: string;
  }) => {
    const response = await api.get('/api/dashboard/trends/sales', { params });
    return response.data;
  },

  // 获取地域分布数据
  getGeographicDistribution: async () => {
    const response = await api.get('/api/dashboard/geographic');
    return response.data;
  },

  // 获取热门产品
  getTopProducts: async (params?: {
    limit?: number;
    period?: 'week' | 'month' | 'quarter';
    sortBy?: 'sales' | 'production' | 'quality';
  }) => {
    const response = await api.get('/api/dashboard/top-products', { params });
    return response.data;
  },

  // 获取预警信息
  getAlerts: async (params?: {
    type?: 'quality' | 'production' | 'logistics' | 'system';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'active' | 'resolved' | 'all';
    limit?: number;
  }) => {
    const response = await api.get('/api/dashboard/alerts', { params });
    return response.data;
  },

  // 标记预警已读
  markAlertAsRead: async (alertId: string) => {
    const response = await api.patch(`/api/dashboard/alerts/${alertId}/read`);
    return response.data;
  },

  // 解决预警
  resolveAlert: async (alertId: string, resolution?: string) => {
    const response = await api.patch(`/api/dashboard/alerts/${alertId}/resolve`, {
      resolution
    });
    return response.data;
  },

  // 获取近期活动
  getRecentActivities: async (params?: {
    limit?: number;
    type?: 'batch_created' | 'quality_check' | 'shipment' | 'harvest';
    userId?: string;
  }) => {
    const response = await api.get('/api/dashboard/activities', { params });
    return response.data;
  },

  // 获取系统健康状态
  getSystemHealth: async () => {
    const response = await api.get('/api/dashboard/health');
    return response.data;
  },

  // 获取关键指标
  getKPIs: async (params?: {
    period: 'today' | 'week' | 'month' | 'quarter' | 'year';
  }) => {
    const response = await api.get('/api/dashboard/kpis', { params });
    return response.data;
  },

  // 导出仪表盘数据
  exportData: async (params: {
    format: 'excel' | 'pdf' | 'csv';
    dateFrom?: string;
    dateTo?: string;
    sections?: ('stats' | 'trends' | 'alerts' | 'activities')[];
  }) => {
    const response = await api.post('/api/dashboard/export', params, {
      responseType: 'blob'
    });
    return response.data;
  },

  // 保存仪表盘配置
  saveConfig: async (config: {
    layout: 'grid' | 'list';
    widgets: string[];
    refreshInterval: number;
    defaultDateRange: string;
    filters: Record<string, any>;
  }) => {
    const response = await api.post('/api/dashboard/config', config);
    return response.data;
  },

  // 获取仪表盘配置
  getConfig: async () => {
    const response = await api.get('/api/dashboard/config');
    return response.data;
  },

  // 获取自定义图表数据
  getCustomChart: async (chartConfig: {
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    filters: Record<string, any>;
    groupBy?: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
    dateRange?: { from: string; to: string };
  }) => {
    const response = await api.post('/api/dashboard/charts/custom', chartConfig);
    return response.data;
  },

  // 获取对比数据
  getComparison: async (params: {
    metric: 'production' | 'quality' | 'sales' | 'efficiency';
    compareWith: 'previous_period' | 'same_period_last_year' | 'target';
    period: 'week' | 'month' | 'quarter' | 'year';
    category?: string;
  }) => {
    const response = await api.get('/api/dashboard/comparison', { params });
    return response.data;
  },

  // 获取预测数据
  getForecast: async (params: {
    metric: 'production' | 'sales' | 'quality';
    period: 'next_week' | 'next_month' | 'next_quarter';
    algorithm?: 'linear' | 'exponential' | 'seasonal';
  }) => {
    const response = await api.get('/api/dashboard/forecast', { params });
    return response.data;
  }
};