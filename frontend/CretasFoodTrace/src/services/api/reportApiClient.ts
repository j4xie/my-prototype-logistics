import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 报表统计API客户端
 * 路径：/api/mobile/{factoryId}/reports/*
 *
 * 注意: 以下功能由其他API提供，避免重复:
 * - dashboard/production/quality/equipment → 使用 dashboardApiClient (ProcessingController)
 * - cost-analysis/trend-analysis → 使用 aiApiClient (AIController)
 *
 * 本客户端专注于: 库存、财务、人员、销售、KPI、预测、异常检测、导出等报表功能
 */

// ========== 类型定义 ==========

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ReportResponse<T = Record<string, unknown>> {
  success: boolean;
  data: T;
  message?: string;
}

export interface InventoryReport {
  totalBatches: number;
  totalValue: number;
  statusDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  expiringBatches: number;
  expiredBatches: number;
  lowStockItems: number;
}

export interface FinanceReport {
  totalRevenue: number;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  otherCost: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  accountsReceivable: number;
  accountsPayable: number;
}

export interface PersonnelReport {
  totalUsers: number;
  activeUsers: number;
  departmentDistribution: Record<string, number>;
}

export interface SalesReport {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  conversionRate: number;
}

export interface EfficiencyReport {
  totalOutput: number;
  equipmentOEE: number;
  completionRate?: number;
}

export interface KPIMetrics {
  productionEfficiency: number;
  qualityRate: number;
  deliveryOnTime: number;
  costReduction: number;
  inventoryTurnover: number;
  equipmentOEE: number;
  maintenanceCompliance: number;
  laborProductivity: number;
  safetyIncidents: number;
}

export interface PeriodComparisonReport {
  period1: { output: number; cost: number };
  period2: { output: number; cost: number };
  comparison: {
    outputChangeRate: number;
    costChangeRate: number;
  };
}

export interface ForecastDataPoint {
  date: string;
  value: number;
  confidence: number;
}

export interface ForecastReport {
  type: string;
  forecastDays: number;
  forecastData: ForecastDataPoint[];
  historicalSummary: {
    days: number;
    total: number;
    average: number;
  };
  aiAnalysis?: string;
  reasoningContent?: string;
  method: string;
}

export interface Anomaly {
  type: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  count: number;
  detectedAt: string;
}

export interface AnomalyReport {
  anomalies: Anomaly[];
  totalAnomalies: number;
  period: { startDate: string; endDate: string };
  dataContext: Record<string, unknown>;
  aiAnalysis?: string;
  reasoningContent?: string;
  analysisMethod: string;
}

export interface CustomReportParams {
  reportType: string;
  metrics?: string[];
  filters?: Record<string, unknown>;
  groupBy?: string;
  startDate?: string;
  endDate?: string;
}

export interface RealtimeData {
  runningPlans: number;
  todayOutput: number;
  equipmentStatus: Record<string, number>;
}

// ========== API客户端类 ==========

class ReportApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/reports`;
  }

  /**
   * 1. 获取库存报表
   * GET /api/mobile/{factoryId}/reports/inventory
   */
  async getInventoryReport(params?: {
    date?: string; // YYYY-MM-DD
    factoryId?: string;
  }): Promise<InventoryReport> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<InventoryReport>(
      `${this.getPath(factoryId)}/inventory`,
      { params: queryParams }
    );
  }

  /**
   * 2. 获取财务报表
   * GET /api/mobile/{factoryId}/reports/finance
   */
  async getFinanceReport(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<FinanceReport> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<FinanceReport>(
      `${this.getPath(factoryId)}/finance`,
      { params: queryParams }
    );
  }

  /**
   * 3. 获取人员报表
   * GET /api/mobile/{factoryId}/reports/personnel
   */
  async getPersonnelReport(params?: {
    date?: string;
    factoryId?: string;
  }): Promise<PersonnelReport> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<PersonnelReport>(
      `${this.getPath(factoryId)}/personnel`,
      { params: queryParams }
    );
  }

  /**
   * 4. 获取销售报表
   * GET /api/mobile/{factoryId}/reports/sales
   */
  async getSalesReport(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<SalesReport> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<SalesReport>(
      `${this.getPath(factoryId)}/sales`,
      { params: queryParams }
    );
  }

  /**
   * 5. 获取效率分析报表
   * GET /api/mobile/{factoryId}/reports/efficiency-analysis
   */
  async getEfficiencyAnalysis(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<EfficiencyReport> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<EfficiencyReport>(
      `${this.getPath(factoryId)}/efficiency-analysis`,
      { params: queryParams }
    );
  }

  /**
   * 6. 获取KPI指标
   * GET /api/mobile/{factoryId}/reports/kpi
   */
  async getKPIMetrics(params?: {
    date?: string;
    factoryId?: string;
  }): Promise<KPIMetrics> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<KPIMetrics>(
      `${this.getPath(factoryId)}/kpi`,
      { params: queryParams }
    );
  }

  /**
   * 7. 获取周期对比报表
   * GET /api/mobile/{factoryId}/reports/period-comparison
   */
  async getPeriodComparison(params: {
    period1Start: string;
    period1End: string;
    period2Start: string;
    period2End: string;
    factoryId?: string;
  }): Promise<PeriodComparisonReport> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<PeriodComparisonReport>(
      `${this.getPath(factoryId)}/period-comparison`,
      { params: queryParams }
    );
  }

  /**
   * 8. 获取预测报表 (AI增强)
   * GET /api/mobile/{factoryId}/reports/forecast
   */
  async getForecastReport(params: {
    type: 'production' | 'cost';
    days: number;
    factoryId?: string;
  }): Promise<ForecastReport> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<ForecastReport>(
      `${this.getPath(factoryId)}/forecast`,
      { params: queryParams }
    );
  }

  /**
   * 9. 获取异常报告 (AI增强)
   * GET /api/mobile/{factoryId}/reports/anomalies
   */
  async getAnomalyReport(params?: {
    startDate?: string;
    endDate?: string;
    factoryId?: string;
  }): Promise<AnomalyReport> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<AnomalyReport>(
      `${this.getPath(factoryId)}/anomalies`,
      { params: queryParams }
    );
  }

  /**
   * 10. 导出Excel报表
   * GET /api/mobile/{factoryId}/reports/export/excel
   * 返回文件下载
   */
  async exportReportExcel(params: {
    reportType: string;
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<Blob> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<Blob>(
      `${this.getPath(factoryId)}/export/excel`,
      {
        params: queryParams,
        responseType: 'blob'
      }
    );
  }

  /**
   * 11. 导出PDF报表
   * GET /api/mobile/{factoryId}/reports/export/pdf
   * 返回文件下载
   */
  async exportReportPdf(params: {
    reportType: string;
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<Blob> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<Blob>(
      `${this.getPath(factoryId)}/export/pdf`,
      {
        params: queryParams,
        responseType: 'blob'
      }
    );
  }

  /**
   * 12. 获取自定义报表
   * POST /api/mobile/{factoryId}/reports/custom
   */
  async getCustomReport(
    parameters: CustomReportParams,
    factoryId?: string
  ): Promise<Record<string, unknown>> {
    return await apiClient.post<Record<string, unknown>>(
      `${this.getPath(factoryId)}/custom`,
      parameters
    );
  }

  /**
   * 13. 获取实时数据
   * GET /api/mobile/{factoryId}/reports/realtime
   */
  async getRealtimeData(factoryId?: string): Promise<RealtimeData> {
    return await apiClient.get<RealtimeData>(
      `${this.getPath(factoryId)}/realtime`
    );
  }
}

export const reportApiClient = new ReportApiClient();
export default reportApiClient;
