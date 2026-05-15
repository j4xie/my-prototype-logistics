/**
 * SmartBI API - Kitchen Cost & Ops Analytics (Phase IIb)
 *
 * Wraps GET /api/mobile/{factoryId}/smart-bi/analysis/kitchen-cost.
 * Restaurant-only endpoint; factory tenants receive a not-applicable envelope.
 *
 * Spec: docs/superpowers/specs/2026-05-15-restaurant-phase-iib-kitchen-cost-analytics-spec.md
 */
import { get, getSmartBIBasePath } from './common';

// ==================== Types ====================

export type GroupBy = 'day' | 'week' | 'month';
export type AlertLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface KitchenCostQueryParams {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  groupBy?: GroupBy; // default 'day'
  topN?: number; // default 10, max 50 (server-enforced)
}

export interface DateRangeEnvelope {
  startDate: string;
  endDate: string;
  days: number;
  groupBy: GroupBy;
  warning?: string;
}

// Wastage analytics
export type WastageType = 'DAMAGED' | 'EXPIRED' | 'OTHER' | 'PROCESSING' | 'SPOILED' | string;

export interface TopWasteIngredient {
  ingredientId: number;
  name: string;
  category: string;
  totalCost: number | null;
  quantity: number | null;
  unit: string;
  eventCount: number;
}

export interface WastageByTypeEntry {
  type: WastageType;
  totalCost: number;
  eventCount: number;
}

export interface WastageTrendPoint {
  period: string; // YYYY-MM-DD / YYYY-Www / YYYY-MM
  totalCost: number;
  eventCount: number;
}

export interface WastageAnalytics {
  totalWastageCost: number;
  totalWastageEvents: number;
  /** ratio in [0,1] range — null when denominator (requisition cost) is 0 */
  wastageRate: number | null;
  /** percent form, ratio * 100, null mirrors wastageRate */
  wastageRatePercent: number | null;
  topWasteIngredients: TopWasteIngredient[];
  wastageByType: WastageByTypeEntry[];
  trend: WastageTrendPoint[];
  dataSource: string;
}

// Requisition trend
export interface RequisitionCategoryEntry {
  category: string;
  totalCost: number;
  eventCount: number;
  /** share of category cost over total requisition cost — null if denominator 0 */
  share: number | null;
}

export interface RequisitionTrendPoint {
  period: string;
  totalCost: number;
  eventCount: number;
}

export interface RequisitionTrend {
  totalCost: number;
  totalEvents: number;
  byCategory: RequisitionCategoryEntry[];
  trend: RequisitionTrendPoint[];
  dataSource: string;
}

// Stocktaking variance
export interface StocktakingIngredientEntry {
  ingredientId: number;
  name: string;
  category: string;
  diffQty: number;
  diffCost: number;
}

export interface StocktakingVariance {
  totalShortageQty: number;
  totalShortageCost: number;
  totalSurplusQty: number;
  totalSurplusCost: number;
  netVarianceCost: number;
  byIngredient: StocktakingIngredientEntry[];
  lastStocktakingDate: string | null;
  stocktakingCount: number;
  dataSource: string;
}

// Food cost ratio
export interface FoodCostRatioBenchmark {
  healthy: number; // 0.30
  warning: number; // 0.35
  critical: number; // 0.40
}

export interface FoodCostRatio {
  totalRequisitionCost: number;
  totalRevenue: number;
  /** requisitionCost / revenue, in [0, +inf) — null if revenue = 0 */
  ratio: number | null;
  ratioPercent: number | null;
  benchmark: FoodCostRatioBenchmark;
  alertLevel: AlertLevel | null;
  alertMessage: string | null;
  dataCaveats: string[];
  dataSource: string;
}

export interface KitchenCostData {
  tenantType: 'RESTAURANT';
  factoryId: string;
  dateRange: DateRangeEnvelope;
  wastageAnalytics: WastageAnalytics;
  requisitionTrend: RequisitionTrend;
  stocktakingVariance: StocktakingVariance;
  foodCostRatio: FoodCostRatio;
  generatedAt: string;
}

/** Factory tenant branch (kitchen-cost is restaurant-only) */
export interface FactoryNotApplicableData {
  tenantType: 'FACTORY';
  factoryId: string;
  notApplicable: true;
  code: 'FACTORY_BRANCH_NOT_APPLICABLE';
  message: string;
}

export type KitchenCostResponseData = KitchenCostData | FactoryNotApplicableData;

// ==================== API ====================

/**
 * Get kitchen cost & ops analytics for the current factory (restaurant tenants only).
 *
 * @param params - date range + groupBy
 * @returns wrapped response (unwrap via response.data)
 */
export function getKitchenCostAnalysis(params: KitchenCostQueryParams) {
  return get<KitchenCostResponseData>(`${getSmartBIBasePath()}/analysis/kitchen-cost`, {
    params,
  });
}

// Type guard for narrowing tenant branches
export function isRestaurantKitchenCost(
  data: KitchenCostResponseData | null | undefined,
): data is KitchenCostData {
  return !!data && data.tenantType === 'RESTAURANT' && !('notApplicable' in data);
}
