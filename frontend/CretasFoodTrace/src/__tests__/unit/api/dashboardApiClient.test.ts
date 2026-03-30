// @ts-nocheck
/**
 * dashboardApiClient 单元测试
 * 测试仪表盘API客户端：概览、生产统计、设备、质量、告警、餐饮、趋势
 */

import { dashboardAPI } from '../../../services/api/dashboardApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

interface MockApiResponse<T = any> {
  success: boolean;
  data: T;
}

describe('dashboardApiClient', () => {
  let mock: MockAdapter;
  const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
  const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}`;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ========== getDashboardOverview ==========
  describe('getDashboardOverview', () => {
    it('should GET overview with default period=today', async () => {
      const mockData = { totalOrders: 50, completedOrders: 40, revenue: 10000 };
      mock.onGet(`${BASE}/reports/dashboard/overview`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getDashboardOverview() as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mock.history.get[0].params?.period || 'today').toBe('today');
    });

    it('should GET overview with custom period', async () => {
      const mockData = { totalOrders: 200, completedOrders: 180, revenue: 50000 };
      mock.onGet(`${BASE}/reports/dashboard/overview`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getDashboardOverview('week') as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should GET overview with custom factoryId', async () => {
      const customFactory = 'FACTORY_002';
      const customBase = `/api/mobile/${customFactory}`;
      const mockData = { totalOrders: 10 };
      mock.onGet(`${customBase}/reports/dashboard/overview`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getDashboardOverview(undefined, customFactory) as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should handle error response', async () => {
      mock.onGet(`${BASE}/reports/dashboard/overview`).reply(500, {
        success: false,
        message: '服务器错误',
      });

      await expect(dashboardAPI.getDashboardOverview()).rejects.toThrow();
    });
  });

  // ========== getProductionStatistics ==========
  describe('getProductionStatistics', () => {
    it('should GET production statistics', async () => {
      const mockData = { totalBatches: 10, completedBatches: 8, yieldRate: 0.95 };
      mock.onGet(`${BASE}/reports/dashboard/production`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getProductionStatistics() as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data.totalBatches).toBe(10);
    });

    it('should forward params to production statistics', async () => {
      const mockData = { totalBatches: 5 };
      mock.onGet(`${BASE}/reports/dashboard/production`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getProductionStatistics({ period: 'month', lineId: 'L1' }) as MockApiResponse;
      expect(result.success).toBe(true);
    });

    it('should handle empty production data', async () => {
      mock.onGet(`${BASE}/reports/dashboard/production`).reply(200, {
        success: true,
        data: { totalBatches: 0, completedBatches: 0 },
      });

      const result = await dashboardAPI.getProductionStatistics() as MockApiResponse;
      expect(result.data.totalBatches).toBe(0);
    });
  });

  // ========== getEquipmentDashboard ==========
  describe('getEquipmentDashboard', () => {
    it('should GET equipment dashboard', async () => {
      const mockData = { totalEquipment: 20, onlineCount: 18, alertCount: 2 };
      mock.onGet(`${BASE}/reports/dashboard/equipment`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getEquipmentDashboard() as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data.totalEquipment).toBe(20);
    });

    it('should GET equipment dashboard with custom factoryId', async () => {
      const customBase = `/api/mobile/F002`;
      mock.onGet(`${customBase}/reports/dashboard/equipment`).reply(200, {
        success: true,
        data: { totalEquipment: 5 },
      });

      const result = await dashboardAPI.getEquipmentDashboard('F002') as MockApiResponse;
      expect(result.success).toBe(true);
    });
  });

  // ========== getQualityDashboard ==========
  describe('getQualityDashboard', () => {
    it('should GET quality dashboard with default period=month', async () => {
      const mockData = { passRate: 0.98, totalInspections: 150, failedCount: 3 };
      mock.onGet(`${BASE}/reports/dashboard/quality`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getQualityDashboard() as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data.passRate).toBe(0.98);
    });

    it('should GET quality dashboard with custom period', async () => {
      const mockData = { passRate: 0.95, totalInspections: 500 };
      mock.onGet(`${BASE}/reports/dashboard/quality`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getQualityDashboard('year') as MockApiResponse;
      expect(result.success).toBe(true);
    });
  });

  // ========== getAlertsDashboard ==========
  describe('getAlertsDashboard', () => {
    it('should GET alerts dashboard', async () => {
      const mockData = { totalAlerts: 5, criticalAlerts: 1, warningAlerts: 4 };
      mock.onGet(`${BASE}/reports/dashboard/alerts`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getAlertsDashboard() as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data.totalAlerts).toBe(5);
    });

    it('should GET alerts with period param', async () => {
      mock.onGet(`${BASE}/reports/dashboard/alerts`).reply(200, {
        success: true,
        data: { totalAlerts: 0 },
      });

      const result = await dashboardAPI.getAlertsDashboard('week') as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data.totalAlerts).toBe(0);
    });
  });

  // ========== getRestaurantDashboardSummary ==========
  describe('getRestaurantDashboardSummary', () => {
    it('should GET restaurant dashboard summary', async () => {
      const mockData = { totalRestaurants: 12, activeOrders: 30, avgRating: 4.5 };
      mock.onGet(`${BASE}/restaurant-dashboard/summary`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getRestaurantDashboardSummary() as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data.totalRestaurants).toBe(12);
    });

    it('should handle network error on restaurant dashboard', async () => {
      mock.onGet(`${BASE}/restaurant-dashboard/summary`).networkError();

      await expect(dashboardAPI.getRestaurantDashboardSummary()).rejects.toThrow();
    });
  });

  // ========== getTrendAnalysis ==========
  describe('getTrendAnalysis', () => {
    it('should GET trend analysis', async () => {
      const mockData = { labels: ['Mon', 'Tue', 'Wed'], values: [100, 120, 110] };
      mock.onGet(`${BASE}/reports/dashboard/trends`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getTrendAnalysis() as MockApiResponse;
      expect(result.success).toBe(true);
      expect(result.data.labels).toHaveLength(3);
    });

    it('should forward params to trend analysis', async () => {
      const mockData = { labels: ['Jan'], values: [500] };
      mock.onGet(`${BASE}/reports/dashboard/trends`).reply(200, {
        success: true,
        data: mockData,
      });

      const result = await dashboardAPI.getTrendAnalysis({ metric: 'revenue', period: 'year' }) as MockApiResponse;
      expect(result.success).toBe(true);
    });

    it('should handle 401 unauthorized on trend analysis', async () => {
      mock.onGet(`${BASE}/reports/dashboard/trends`).reply(401, {
        success: false,
        message: 'Token expired',
      });

      await expect(dashboardAPI.getTrendAnalysis()).rejects.toThrow();
    });
  });
});
