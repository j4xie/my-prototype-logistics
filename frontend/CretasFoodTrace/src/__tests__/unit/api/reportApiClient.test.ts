// @ts-nocheck
/**
 * reportApiClient unit tests
 * Tests report endpoints: inventory, finance, personnel, sales, efficiency, KPI, forecast, anomaly, OEE, etc.
 */

import { reportApiClient } from '../../../services/api/reportApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

describe('reportApiClient', () => {
  let mock: MockAdapter;
  const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
  const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/reports`;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ========== Inventory Report ==========

  describe('getInventoryReport', () => {
    it('should GET /reports/inventory and return inventory data', async () => {
      const mockReport = {
        totalBatches: 150,
        totalValue: 250000,
        statusDistribution: { active: 100, expired: 10 },
        typeDistribution: { raw: 80, finished: 70 },
        expiringBatches: 5,
        expiredBatches: 10,
        lowStockItems: 3,
      };

      mock.onGet(`${BASE}/inventory`).reply(200, { data: mockReport });

      const result = await reportApiClient.getInventoryReport();
      expect(result.totalBatches).toBe(150);
      expect(result.totalValue).toBe(250000);
      expect(result.lowStockItems).toBe(3);
    });

    it('should pass date param when provided', async () => {
      mock.onGet(`${BASE}/inventory`).reply((config) => {
        expect(config.params).toHaveProperty('date', '2026-03-01');
        return [200, { data: { totalBatches: 0, totalValue: 0 } }];
      });

      await reportApiClient.getInventoryReport({ date: '2026-03-01' });
    });
  });

  // ========== Finance Report ==========

  describe('getFinanceReport', () => {
    it('should GET /reports/finance with date range', async () => {
      const mockReport = {
        totalRevenue: 500000,
        materialCost: 200000,
        laborCost: 80000,
        equipmentCost: 30000,
        otherCost: 10000,
        totalCost: 320000,
        totalProfit: 180000,
        profitMargin: 0.36,
        accountsReceivable: 50000,
        accountsPayable: 30000,
      };

      mock.onGet(`${BASE}/finance`).reply((config) => {
        expect(config.params).toHaveProperty('startDate', '2026-03-01');
        expect(config.params).toHaveProperty('endDate', '2026-03-20');
        return [200, { data: mockReport }];
      });

      const result = await reportApiClient.getFinanceReport({
        startDate: '2026-03-01',
        endDate: '2026-03-20',
      });
      expect(result.totalRevenue).toBe(500000);
      expect(result.profitMargin).toBe(0.36);
    });
  });

  // ========== Personnel Report ==========

  describe('getPersonnelReport', () => {
    it('should GET /reports/personnel and return personnel data', async () => {
      const mockReport = {
        totalUsers: 50,
        activeUsers: 45,
        departmentDistribution: { production: 30, warehouse: 10, quality: 5 },
      };

      mock.onGet(`${BASE}/personnel`).reply(200, { data: mockReport });

      const result = await reportApiClient.getPersonnelReport();
      expect(result.totalUsers).toBe(50);
      expect(result.activeUsers).toBe(45);
    });
  });

  // ========== Sales Report ==========

  describe('getSalesReport', () => {
    it('should GET /reports/sales with date range', async () => {
      const mockReport = {
        totalOrders: 120,
        totalRevenue: 400000,
        averageOrderValue: 3333,
        conversionRate: 0.85,
      };

      mock.onGet(`${BASE}/sales`).reply(200, { data: mockReport });

      const result = await reportApiClient.getSalesReport({
        startDate: '2026-03-01',
        endDate: '2026-03-20',
      });
      expect(result.totalOrders).toBe(120);
      expect(result.averageOrderValue).toBe(3333);
    });
  });

  // ========== Efficiency Analysis ==========

  describe('getEfficiencyAnalysis', () => {
    it('should GET /reports/efficiency-analysis with date range', async () => {
      const mockReport = { totalOutput: 5000, equipmentOEE: 0.82, completionRate: 0.95 };

      mock.onGet(`${BASE}/efficiency-analysis`).reply(200, { data: mockReport });

      const result = await reportApiClient.getEfficiencyAnalysis({
        startDate: '2026-03-01',
        endDate: '2026-03-20',
      });
      expect(result.totalOutput).toBe(5000);
      expect(result.equipmentOEE).toBe(0.82);
    });
  });

  // ========== KPI Metrics ==========

  describe('getKPIMetrics', () => {
    it('should GET /reports/kpi and return KPI data', async () => {
      const mockKPI = {
        productionEfficiency: 0.92,
        qualityRate: 0.98,
        deliveryOnTime: 0.95,
        costReduction: 0.05,
        inventoryTurnover: 12,
        equipmentOEE: 0.85,
        maintenanceCompliance: 0.90,
        laborProductivity: 0.88,
        safetyIncidents: 0,
      };

      mock.onGet(`${BASE}/kpi`).reply(200, { data: mockKPI });

      const result = await reportApiClient.getKPIMetrics();
      expect(result.productionEfficiency).toBe(0.92);
      expect(result.safetyIncidents).toBe(0);
    });
  });

  // ========== Period Comparison ==========

  describe('getPeriodComparison', () => {
    it('should GET /reports/period-comparison with two period date ranges', async () => {
      const mockComparison = {
        period1: { output: 5000, cost: 100000 },
        period2: { output: 5500, cost: 110000 },
        comparison: { outputChangeRate: 0.10, costChangeRate: 0.10 },
      };

      mock.onGet(`${BASE}/period-comparison`).reply((config) => {
        expect(config.params).toHaveProperty('period1Start', '2026-02-01');
        expect(config.params).toHaveProperty('period1End', '2026-02-28');
        expect(config.params).toHaveProperty('period2Start', '2026-03-01');
        expect(config.params).toHaveProperty('period2End', '2026-03-20');
        return [200, { data: mockComparison }];
      });

      const result = await reportApiClient.getPeriodComparison({
        period1Start: '2026-02-01',
        period1End: '2026-02-28',
        period2Start: '2026-03-01',
        period2End: '2026-03-20',
      });
      expect(result.comparison.outputChangeRate).toBe(0.10);
    });
  });

  // ========== Forecast Report ==========

  describe('getForecastReport', () => {
    it('should GET /reports/forecast with type and days', async () => {
      const mockForecast = {
        type: 'production',
        forecastDays: 7,
        forecastData: [
          { date: '2026-03-21', value: 1000, confidence: 0.9 },
          { date: '2026-03-22', value: 1050, confidence: 0.88 },
        ],
        historicalSummary: { days: 30, total: 30000, average: 1000 },
        method: 'ai_enhanced',
      };

      mock.onGet(`${BASE}/forecast`).reply((config) => {
        expect(config.params).toHaveProperty('type', 'production');
        expect(config.params).toHaveProperty('days', 7);
        return [200, { data: mockForecast }];
      });

      const result = await reportApiClient.getForecastReport({ type: 'production', days: 7 });
      expect(result.forecastData).toHaveLength(2);
      expect(result.type).toBe('production');
    });
  });

  // ========== Anomaly Report ==========

  describe('getAnomalyReport', () => {
    it('should GET /reports/anomalies and return anomaly data', async () => {
      const mockAnomalies = {
        anomalies: [
          { type: 'cost_spike', level: 'WARNING', title: '成本异常', description: '原材料成本超标', count: 3, detectedAt: '2026-03-20' },
        ],
        totalAnomalies: 1,
        period: { startDate: '2026-03-01', endDate: '2026-03-20' },
        dataContext: {},
        analysisMethod: 'ai_enhanced',
      };

      mock.onGet(`${BASE}/anomalies`).reply(200, { data: mockAnomalies });

      const result = await reportApiClient.getAnomalyReport({
        startDate: '2026-03-01',
        endDate: '2026-03-20',
      });
      expect(result.totalAnomalies).toBe(1);
      expect(result.anomalies[0].level).toBe('WARNING');
    });

    it('should work without params', async () => {
      mock.onGet(`${BASE}/anomalies`).reply(200, { data: { anomalies: [], totalAnomalies: 0 } });

      const result = await reportApiClient.getAnomalyReport();
      expect(result.totalAnomalies).toBe(0);
    });
  });

  // ========== Custom Report ==========

  describe('getCustomReport', () => {
    it('should POST /reports/custom with parameters', async () => {
      const params = { reportType: 'material_usage', metrics: ['totalUsage', 'wastage'], groupBy: 'day' };
      mock.onPost(`${BASE}/custom`).reply(200, { data: { totalUsage: 5000, wastage: 150 } });

      const result = await reportApiClient.getCustomReport(params);
      expect(result).toHaveProperty('totalUsage', 5000);
    });
  });

  // ========== Realtime Data ==========

  describe('getRealtimeData', () => {
    it('should GET /reports/realtime and return live data', async () => {
      const mockRealtime = { runningPlans: 3, todayOutput: 2500, equipmentStatus: { active: 10, maintenance: 2 } };
      mock.onGet(`${BASE}/realtime`).reply(200, { data: mockRealtime });

      const result = await reportApiClient.getRealtimeData();
      expect(result.runningPlans).toBe(3);
      expect(result.todayOutput).toBe(2500);
    });
  });

  // ========== OEE Report ==========

  describe('getOeeReport', () => {
    it('should GET /reports/oee with date range', async () => {
      const mockOee = { overallOee: 0.85, availability: 0.90, performance: 0.95, quality: 0.99, targetOee: 0.85 };

      mock.onGet(`${BASE}/oee`).reply(200, { data: mockOee });

      const result = await reportApiClient.getOeeReport({ startDate: '2026-03-01', endDate: '2026-03-20' });
      expect(result.overallOee).toBe(0.85);
    });
  });

  // ========== Cost Variance Report ==========

  describe('getCostVarianceReport', () => {
    it('should GET /reports/cost-variance with date range', async () => {
      const mockVariance = {
        totalPlannedCost: 100000,
        totalActualCost: 105000,
        totalVariance: 5000,
        totalVarianceRate: 0.05,
      };

      mock.onGet(`${BASE}/cost-variance`).reply(200, { data: mockVariance });

      const result = await reportApiClient.getCostVarianceReport({ startDate: '2026-03-01', endDate: '2026-03-20' });
      expect(result.totalVariance).toBe(5000);
      expect(result.totalVarianceRate).toBe(0.05);
    });
  });

  // ========== KPI Metrics (extended) ==========

  describe('getKpiMetrics', () => {
    it('should GET /reports/kpi-metrics and return full KPI DTO', async () => {
      const mockKpi = { oee: 0.85, fpy: 0.97, otif: 0.93, overallScore: 88, scoreGrade: 'A' };
      mock.onGet(`${BASE}/kpi-metrics`).reply(200, { data: mockKpi });

      const result = await reportApiClient.getKpiMetrics();
      expect(result.overallScore).toBe(88);
      expect(result.scoreGrade).toBe('A');
    });
  });

  // ========== Capacity Utilization ==========

  describe('getCapacityUtilizationReport', () => {
    it('should GET /reports/capacity-utilization with date range', async () => {
      const mockCapacity = { overallUtilization: 0.78, utilizationByLine: [], utilizationHeatmap: [] };
      mock.onGet(`${BASE}/capacity-utilization`).reply(200, { data: mockCapacity });

      const result = await reportApiClient.getCapacityUtilizationReport({ startDate: '2026-03-01', endDate: '2026-03-20' });
      expect(result.overallUtilization).toBe(0.78);
    });
  });

  // ========== On-Time Delivery ==========

  describe('getOnTimeDeliveryReport', () => {
    it('should GET /reports/on-time-delivery with date range', async () => {
      const mockDelivery = {
        totalOrders: 200,
        onTimeOrders: 190,
        onTimeRate: 0.95,
        otifRate: 0.92,
        target: 0.95,
      };

      mock.onGet(`${BASE}/on-time-delivery`).reply(200, { data: mockDelivery });

      const result = await reportApiClient.getOnTimeDeliveryReport({ startDate: '2026-03-01', endDate: '2026-03-20' });
      expect(result.onTimeRate).toBe(0.95);
      expect(result.totalOrders).toBe(200);
    });
  });
});
