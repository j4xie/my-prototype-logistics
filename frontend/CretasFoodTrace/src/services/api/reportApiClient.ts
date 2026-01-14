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

// ========== 新增报表类型 (2026-01-14) ==========

export interface OeeReportDTO {
  factoryId: string;
  startDate: string;
  endDate: string;
  overallOee: number;
  availability: number;
  performance: number;
  quality: number;
  targetOee: number;
  oeeByEquipment: Array<{
    equipmentId: string;
    equipmentName: string;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
  }>;
  dailyOeeTrend: Array<{
    date: string;
    oee: number;
  }>;
  topLosses: Array<{
    category: string;
    lossType: string;
    lossMinutes: number;
    percentage: number;
  }>;
}

export interface CostVarianceItem {
  category: string;
  itemName: string;
  plannedCost: number;
  actualCost: number;
  variance: number;
  varianceRate: number;
}

export interface CostVarianceReportDTO {
  factoryId: string;
  startDate: string;
  endDate: string;
  totalPlannedCost: number;
  totalActualCost: number;
  totalVariance: number;
  totalVarianceRate: number;
  varianceByCategory: Array<{
    category: string;
    plannedCost: number;
    actualCost: number;
    variance: number;
    varianceRate: number;
  }>;
  topVarianceItems: CostVarianceItem[];
  varianceTrend: Array<{
    date: string;
    plannedCost: number;
    actualCost: number;
    variance: number;
  }>;
}

export interface KpiMetricsDTO {
  factoryId: string;
  reportDate: string;
  updatedAt: string;
  // 生产效率指标
  oee: number;
  outputCompletionRate: number;
  capacityUtilization: number;
  avgCycleTime: number;
  throughput: number;
  // 质量指标
  fpy: number;
  overallQualityRate: number;
  scrapRate: number;
  reworkRate: number;
  customerComplaintRate: number;
  // 成本指标
  unitCost: number;
  bomVarianceRate: number;
  materialCostRatio: number;
  laborCostRatio: number;
  overheadCostRatio: number;
  scrapLossRate: number;
  // 交付指标
  otif: number;
  onTimeDeliveryRate: number;
  inFullDeliveryRate: number;
  avgLeadTime: number;
  orderFulfillmentRate: number;
  // 设备指标
  equipmentAvailability: number;
  mtbf: number;
  mttr: number;
  pmCompletionRate: number;
  breakdownCount: number;
  // 人员指标
  outputPerWorker: number;
  attendanceRate: number;
  overtimeRate: number;
  trainingCompletionRate: number;
  safetyIncidents: number;
  // 库存指标
  inventoryTurnover: number;
  inventoryAccuracy: number;
  rawMaterialDays: number;
  finishedGoodsDays: number;
  // 综合评分
  overallScore: number;
  scoreGrade: string;
  periodChange: number;
}

export interface CapacityUtilizationReport {
  factoryId: string;
  startDate: string;
  endDate: string;
  overallUtilization: number;
  utilizationByLine: Array<{
    lineId: string;
    lineName: string;
    utilization: number;
    plannedCapacity: number;
    actualOutput: number;
  }>;
  utilizationHeatmap: Array<{
    date: string;
    hour: number;
    utilization: number;
  }>;
}

export interface OnTimeDeliveryReport {
  factoryId: string;
  startDate: string;
  endDate: string;
  target: number;  // 95%
  totalOrders: number;
  onTimeOrders: number;
  otifOrders: number;
  inFullOrders: number;
  onTimeRate: number;
  inFullRate: number;
  otifRate: number;
  dailyTrend: Array<{
    date: string;
    totalOrders: number;
    onTimeOrders: number;
    otifRate: number;
  }>;
  orderDetails: Array<{
    shipmentId: string;
    orderNumber: string;
    shipmentDate: string;
    quantity: number;
    status: string;  // pending, shipped, delivered
    onTime: boolean;
    inFull: boolean;
    otif: boolean;
  }>;
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

  // ========== 新增报表API (2026-01-14) ==========

  /**
   * 14. 获取OEE报表
   * GET /api/mobile/{factoryId}/reports/oee
   */
  async getOeeReport(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<OeeReportDTO> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<OeeReportDTO>(
      `${this.getPath(factoryId)}/oee`,
      { params: queryParams }
    );
  }

  /**
   * 15. 获取成本差异报表
   * GET /api/mobile/{factoryId}/reports/cost-variance
   */
  async getCostVarianceReport(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<CostVarianceReportDTO> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<CostVarianceReportDTO>(
      `${this.getPath(factoryId)}/cost-variance`,
      { params: queryParams }
    );
  }

  /**
   * 16. 获取完整KPI指标
   * GET /api/mobile/{factoryId}/reports/kpi-metrics
   */
  async getKpiMetrics(params?: {
    date?: string;
    factoryId?: string;
  }): Promise<KpiMetricsDTO> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<KpiMetricsDTO>(
      `${this.getPath(factoryId)}/kpi-metrics`,
      { params: queryParams }
    );
  }

  /**
   * 17. 获取产能利用率报表
   * GET /api/mobile/{factoryId}/reports/capacity-utilization
   */
  async getCapacityUtilizationReport(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<CapacityUtilizationReport> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<CapacityUtilizationReport>(
      `${this.getPath(factoryId)}/capacity-utilization`,
      { params: queryParams }
    );
  }

  /**
   * 18. 获取准时交付报表
   * GET /api/mobile/{factoryId}/reports/on-time-delivery
   */
  async getOnTimeDeliveryReport(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<OnTimeDeliveryReport> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<OnTimeDeliveryReport>(
      `${this.getPath(factoryId)}/on-time-delivery`,
      { params: queryParams }
    );
  }
}

export const reportApiClient = new ReportApiClient();
export default reportApiClient;
