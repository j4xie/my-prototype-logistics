/**
 * SmartBI API 服务
 * 提供智能BI分析、经营驾驶舱、自然语言问答等功能
 */
import request from './request';
import { get, post } from './request';

// ==================== 辅助函数 ====================

/**
 * 获取当前工厂ID
 * 从 localStorage 中读取用户信息获取 factoryId
 */
function getFactoryId(): string {
  try {
    const userStr = localStorage.getItem('cretas_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.factoryId || 'F001';
    }
  } catch (e) {
    console.warn('Failed to get factoryId from localStorage');
  }
  return 'F001'; // 默认工厂ID
}

/**
 * 获取 SmartBI API 基础路径
 */
function getSmartBIBasePath(): string {
  return `/${getFactoryId()}/smart-bi`;
}

// ==================== 类型定义 ====================

/**
 * 分析查询参数
 */
export interface AnalysisParams {
  startDate: string;
  endDate: string;
  department?: string;
  region?: string;
  dimension?: string;
}

/**
 * KPI 卡片数据
 */
export interface KPICard {
  key: string;
  title: string;
  value: string;
  rawValue: number;
  unit?: string;
  change?: number;
  changeRate?: number;
  trend: 'up' | 'down' | 'flat';
  status: 'green' | 'yellow' | 'red';
}

/**
 * 图表数据
 */
export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'gauge' | 'heatmap' | 'map';
  title: string;
  xAxis?: string[];
  series: Array<{
    name: string;
    data: number[];
    type?: string;
  }>;
}

/**
 * 驾驶舱响应
 */
export interface DashboardResponse {
  period: string;
  startDate: string;
  endDate: string;
  kpiCards: KPICard[];
  rankings: Record<string, unknown[]>;
  charts: Record<string, ChartData>;
  aiInsights: Array<{
    id: string;
    level: string;
    text: string;
  }>;
  alerts: unknown[];
  recommendations: unknown[];
}

/**
 * 自然语言查询请求
 */
export interface NLQueryRequest {
  query: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}

/**
 * 自然语言查询响应
 */
export interface NLQueryResponse {
  intent: string;
  confidence: number;
  responseText: string;
  data?: unknown;
  chartConfig?: ChartData;
  suggestions?: string[];
}

/**
 * 预警信息
 */
export interface SmartBIAlert {
  id: string;
  category: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  suggestedAction?: string;
  createdAt: string;
  isResolved: boolean;
}

/**
 * 建议信息
 */
export interface SmartBIRecommendation {
  id: string;
  analysisType: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImpact?: string;
  actionItems?: string[];
  createdAt: string;
}

/**
 * 激励方案
 */
export interface IncentivePlan {
  targetType: string;
  targetId: string;
  targetName: string;
  currentPerformance: Record<string, unknown>;
  suggestedIncentives: Array<{
    type: string;
    amount?: number;
    description: string;
    conditions?: string[];
  }>;
  projectedImpact?: {
    revenueIncrease?: number;
    costSaving?: number;
    efficiencyGain?: number;
  };
}

// ==================== API 函数 ====================

/**
 * 上传 Excel 文件
 */
export function uploadExcel(file: File, dataType: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('data_type', dataType);
  return request.post(`${getSmartBIBasePath()}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * 获取经营驾驶舱数据
 */
export function getExecutiveDashboard(period: string = 'month') {
  return get<DashboardResponse>(`${getSmartBIBasePath()}/dashboard/executive`, {
    params: { period },
  });
}

/**
 * 获取销售分析
 */
export function getSalesAnalysis(params: AnalysisParams) {
  return get(`${getSmartBIBasePath()}/analysis/sales`, { params });
}

/**
 * 获取部门分析
 */
export function getDepartmentAnalysis(params: AnalysisParams) {
  return get(`${getSmartBIBasePath()}/analysis/department`, { params });
}

/**
 * 获取区域分析
 */
export function getRegionAnalysis(params: AnalysisParams) {
  return get(`${getSmartBIBasePath()}/analysis/region`, { params });
}

/**
 * 获取财务分析
 */
export function getFinanceAnalysis(params: AnalysisParams & { analysisType?: string }) {
  return get(`${getSmartBIBasePath()}/analysis/finance`, { params });
}

/**
 * 自然语言问答
 */
export function query(data: NLQueryRequest) {
  return post<NLQueryResponse>(`${getSmartBIBasePath()}/query`, data);
}

/**
 * 数据下钻
 */
export function drillDown(data: {
  dimension: string;
  filterValue: string;
  startDate?: string;
  endDate?: string;
}) {
  return post(`${getSmartBIBasePath()}/drill-down`, data);
}

/**
 * 获取预警列表
 */
export function getAlerts(category?: string) {
  return get<SmartBIAlert[]>(`${getSmartBIBasePath()}/alerts`, {
    params: category ? { category } : undefined,
  });
}

/**
 * 获取建议列表
 */
export function getRecommendations(analysisType?: string) {
  return get<SmartBIRecommendation[]>(`${getSmartBIBasePath()}/recommendations`, {
    params: analysisType ? { analysisType } : undefined,
  });
}

/**
 * 获取激励方案
 */
export function getIncentivePlan(targetType: string, targetId: string) {
  return get<IncentivePlan>(`${getSmartBIBasePath()}/incentive-plan/${targetType}/${targetId}`);
}

/**
 * 获取趋势分析
 */
export function getTrendAnalysis(params: {
  metric: string;
  startDate: string;
  endDate: string;
  granularity?: 'day' | 'week' | 'month';
}) {
  return get(`${getSmartBIBasePath()}/analysis/trend`, { params });
}

/**
 * 获取对比分析
 */
export function getComparisonAnalysis(params: {
  dimension: string;
  metrics: string[];
  startDate: string;
  endDate: string;
  compareWith?: 'previous_period' | 'same_period_last_year';
}) {
  return post(`${getSmartBIBasePath()}/analysis/comparison`, params);
}

/**
 * 导出报表
 */
export function exportReport(params: {
  reportType: string;
  format: 'excel' | 'pdf';
  startDate: string;
  endDate: string;
  dimensions?: string[];
}) {
  return request.post(`${getSmartBIBasePath()}/export`, params, {
    responseType: 'blob',
  });
}
