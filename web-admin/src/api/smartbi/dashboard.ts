/**
 * SmartBI API - Dashboard Module
 * Dashboard data, analysis endpoints, alerts, recommendations, incentive plans.
 */
import {
  get, post,
  getSmartBIBasePath,
  type AnalysisParams,
  type DashboardResponse,
  type NLQueryRequest,
  type NLQueryResponse,
  type SmartBIAlert,
  type SmartBIRecommendation,
  type IncentivePlan,
} from './common';

// ==================== Dashboard Functions ====================

/**
 * Get executive dashboard data
 */
export function getExecutiveDashboard(period: string = 'month') {
  return get<DashboardResponse>(`${getSmartBIBasePath()}/dashboard/executive`, {
    params: { period },
  });
}

/**
 * Get sales analysis
 */
export function getSalesAnalysis(params: AnalysisParams) {
  return get(`${getSmartBIBasePath()}/analysis/sales`, { params });
}

/**
 * Get department analysis
 */
export function getDepartmentAnalysis(params: AnalysisParams) {
  return get(`${getSmartBIBasePath()}/analysis/department`, { params });
}

/**
 * Get region analysis
 */
export function getRegionAnalysis(params: AnalysisParams) {
  return get(`${getSmartBIBasePath()}/analysis/region`, { params });
}

/**
 * Get finance analysis
 */
export function getFinanceAnalysis(params: AnalysisParams & { analysisType?: string }) {
  return get(`${getSmartBIBasePath()}/analysis/finance`, { params });
}

// ==================== NL Query ====================

/**
 * Natural language query
 */
export function query(data: NLQueryRequest) {
  return post<NLQueryResponse>(`${getSmartBIBasePath()}/query`, data);
}

/**
 * Data drill-down (via Java backend)
 */
export function drillDown(data: {
  dimension: string;
  filterValue: string;
  startDate?: string;
  endDate?: string;
}) {
  return post(`${getSmartBIBasePath()}/drill-down`, data);
}

// ==================== Alerts & Recommendations ====================

/**
 * Get alerts list
 */
export function getAlerts(category?: string) {
  return get<SmartBIAlert[]>(`${getSmartBIBasePath()}/alerts`, {
    params: category ? { category } : undefined,
  });
}

/**
 * Get recommendations list
 */
export function getRecommendations(analysisType?: string) {
  return get<SmartBIRecommendation[]>(`${getSmartBIBasePath()}/recommendations`, {
    params: analysisType ? { analysisType } : undefined,
  });
}

/**
 * Get incentive plan
 */
export function getIncentivePlan(targetType: string, targetId: string) {
  return get<IncentivePlan>(`${getSmartBIBasePath()}/incentive-plan/${targetType}/${targetId}`);
}

// AUDIT-013: getTrendAnalysis removed -- no backend handler exists for GET /analysis/trend.
// AUDIT-014: getComparisonAnalysis removed -- no backend handler exists for POST /analysis/comparison.
// AUDIT-031: exportReport removed -- no backend handler exists for POST /smart-bi/export.
