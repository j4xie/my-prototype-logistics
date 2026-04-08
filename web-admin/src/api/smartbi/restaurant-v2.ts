/**
 * SmartBI Restaurant V2 API Client (Week 3.5 + Week 4.6)
 *
 * 调用后端 /api/smartbi/restaurant-analytics-v2/{upload_id} endpoint
 * 对应 services/restaurant/analyzer.py (RestaurantAnalyzerV2)
 *
 * V2 Unified Report Schema (11 sections as of Week 4.6):
 *   Week 2-3:
 *     - menuNormalization        菜品命名归一
 *     - channelMargin            渠道毛利率 (4 层 COGS)
 *     - financialMetrics         财务指标 + cost_rigidity
 *     - diagnostics              诊断引擎输出 (list)
 *     - benchmarkAlerts          对标预警 (list, 含年度影响)
 *   Week 4 新增:
 *     - storePnlOnePager         单店 P&L 一页纸 (Week 4.1)
 *     - diningHeatmap            营业时段热力图 (Week 4.2)
 *     - storedValueDependency    充卡依赖度 (Week 4.3a)
 *     - longTailSku              长尾 SKU 识别 (Week 4.3b)
 *     - reviewAnalysis           大众点评评论 (Week 4.5)
 *     - bomLayerStatus           BOM Layer 2+3 精度状态 (Week 4.4)
 */
import { pythonFetch } from './common';

// ── Type definitions ────────────────────────────────────────

export interface FinancialMetricsPeriod {
  revenue: number;
  food_cost?: number;
  labor_cost?: number;
  rent?: number;
  other_cost?: number;
  net_profit?: number;
  stored_value_giveaway?: number;  // Week 4.3
  stored_value_charge?: number;
}

export interface FinancialData {
  current: FinancialMetricsPeriod;
  previous?: FinancialMetricsPeriod;
  monthly_revenue?: number;
}

// Week 4.5 — 大众点评评论
export interface ReviewInput {
  id?: number | string;
  rating: number;       // 1-5
  content: string;
  created_at: string;   // ISO date
  platform?: string;
  reviewer?: string;
}

// Week 4.4 — SKU form (Layer 2)
export interface SkuFormIngredientInput {
  name: string;
  cost: number;
  weightG?: number;
  unitPricePerKg?: number;
}

export interface SkuFormInput {
  skuName: string;
  category: string;
  totalCogsAmount: number;
  sellingPrice?: number;
  monthlySalesQuantity?: number;
  ingredients?: SkuFormIngredientInput[];
  uploadedBy?: string;
  notes?: string;
}

// Week 4.4 — Monthly purchase (Layer 3)
export interface MonthlyPurchaseInput {
  period: string;           // "2026-02"
  totalPurchase: number;
  totalRevenue: number;
  categoryBreakdown?: Record<string, number>;
  storeId?: string;
  notes?: string;
}

export interface V2AnalyzePayload {
  sub_sector?: string;
  store_id?: string;
  store_name?: string;
  period?: string;
  financial_data?: FinancialData;
  // Week 4 新增 inputs
  reviews?: ReviewInput[];
  sku_forms?: SkuFormInput[];
  monthly_purchases?: MonthlyPurchaseInput[];
}

// ── Result types ────────────────────────────────────────────

export interface MenuNormalization {
  originalUniqueCount: number;
  normalizedUniqueCount: number;
  reduction: number;
  reductionPct: number;
  appliedAliasTable: string;
  note: string;
}

export interface ChannelMarginRow {
  channel: string;
  revenue: number;
  orderCount: number;
  avgTicket: number;
  commissionRate: number;
  commissionAmount: number;
  deliveryFee: number;
  packagingCost: number;
  cogs: number;
  cogsSource: string;
  cogsConfidence: string;
  cogsWarning?: string;
  netRevenue: number;
  grossProfit: number;
  grossMarginPct: number;
  expectedAccuracyPp: number;
  commissionSource: string;
}

export interface ChannelMargin {
  factoryId: string;
  subSector: string;
  period: string;
  totalRevenue: number;
  totalGrossProfit: number;
  overallGrossMarginPct: number;
  rows: ChannelMarginRow[];
  cogsSourceSummary: Record<string, number>;
  adviceZh: string[];
}

export interface FinancialMetrics {
  revenue: number;
  foodCost?: number;
  laborCost?: number;
  rent?: number;
  otherCost?: number;
  netProfit?: number;
  foodCostRatio?: number;
  laborCostRatio?: number;
  rentRatio?: number;
  restaurantNetMargin?: number;
  costRigidity?: number;
  revenueChangePct?: number;
  laborCostChangePct?: number;
  foodCostChangePct?: number;
}

export interface Diagnosis {
  metricKey: string;
  metricNameZh: string;
  actualValue: number;
  benchmarkMedian?: number;
  benchmarkRange?: number[];
  thresholdSource: string;
  higherIsWorse: boolean;
  status: string;
  severity: 'critical' | 'warning' | 'info';
  deltaPp: number;
  deltaPct: number;
  descriptionZh: string;
  suggestionZh: string[];
  playbookId?: string;
  playbookUrlZh?: string;
  subSectorNotes: string[];
  formulaZh?: string;
}

export interface BenchmarkAlert {
  metricKey: string;
  metricNameZh: string;
  storeName?: string;
  actualValue: number;
  median: number;
  rangeLow: number;
  rangeHigh: number;
  deltaPpFromMedian: number;
  deltaPpFromHigh: number;
  severity: 'red' | 'yellow' | 'info';
  higherIsWorse: boolean;
  estimatedYearlyImpact?: number;
  messageZh: string;
  actionHint: string;
  source: string;
}

// ── Week 4 section types ────────────────────────────────────

// Week 4.1 — Store P&L One Pager
export interface StorePnlOnePager {
  storeName: string;
  period: string;
  subSector: string;
  headline: string;
  headlineColor: 'green' | 'yellow' | 'red';
  emoji?: string;
  pnlLines?: Array<{
    label: string;
    current?: number;
    previous?: number;
    deltaPct?: number;
    pctOfRevenue?: number;
  }>;
  diagnosticBriefs?: Array<{
    severity: string;
    message: string;
  }>;
  channelSummary?: Array<{
    channel: string;
    revenue: number;
    grossMarginPct: number;
  }>;
  topInsights?: string[];
  topRecommendations?: string[];
}

// Week 4.2 — Dining Period Heatmap
export interface HeatmapCell {
  dayOfWeek: number;
  dayLabel: string;
  hour: number;
  revenue: number;
  orderCount: number;
  avgTicket: number;
}

export interface MealPeriodStats {
  period: string;
  hourRange: number[];
  revenue: number;
  orderCount: number;
  revenuePct: number;
  avgTicket: number;
}

export interface PeakPeriod {
  dayLabel: string;
  hour: number;
  revenue: number;
  orderCount: number;
  emoji: string;
}

export interface DiningHeatmap {
  cells: HeatmapCell[];
  mealPeriods: MealPeriodStats[];
  topPeakHours: PeakPeriod[];
  bottomOffPeakHours: PeakPeriod[];
  totalRevenue: number;
  totalOrders: number;
  avgHourlyRevenue: number;
  peakOffPeakRatio: number;
  insights: string[];
  recommendations: string[];
}

// Week 4.3a — Stored Value Dependency
export interface StoredValueDependency {
  storedValueGiveaway: number;
  storedValueCharge?: number;
  revenue: number;
  dependencyPct: number;
  chargeToRevenueRatio?: number;
  severity: 'info' | 'warning' | 'critical';
  messageZh: string;
  warnings: string[];
  recommendations: string[];
}

// Week 4.3b — Long Tail SKU
export interface LowEfficiencySku {
  name: string;
  quantity: number;
  revenue: number;
  unitPrice: number;
  quantityPercentile: number;
  revenuePercentile: number;
  score: number;
  recommendation: string;
  reason: string;
}

export interface LongTailSku {
  totalSkuCount: number;
  top20PctSkusContribute: number;
  lowEfficiencySkus: LowEfficiencySku[];
  seasonalExcluded: string[];
  recommendedDelistCount: number;
  estimatedCostSaving: number;
  insights: string[];
  recommendations: string[];
}

// Week 4.5 — Review Analysis
export interface DishMention {
  dishName: string;
  mentionCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveRate: number;
  netSentiment: number;
  avgReviewRating: number;
  exampleQuotes: string[];
}

export interface PeriodRating {
  period: string;
  avgRating: number;
  reviewCount: number;
  positiveRate: number;
}

export interface RatingTrend {
  periods: PeriodRating[];
  direction: 'rising' | 'stable' | 'declining' | 'sharp_decline';
  totalDelta: number;
  latestAvg: number;
  earliestAvg: number;
  maxPeriodDrop: number;
}

export interface ReviewAnalysis {
  totalReviews: number;
  avgRating: number;
  ratingTrend?: RatingTrend;
  dishTags: DishMention[];
  topPraisedDishes: DishMention[];
  topComplainedDishes: DishMention[];
  hiddenGems: DishMention[];
  riskAlerts: string[];
  insights: string[];
  recommendations: string[];
}

// Week 4.4 — BOM Layer Status
export interface BomLayerStatus {
  currentLayer: string;             // "Layer 1" / "Layer 2" / "Layer 3"
  currentAccuracyPp: number;        // ±X%
  layer2SkuCount: number;
  layer3PeriodCount: number;
  upgradeHint: string;
}

export interface V2UnifiedReport {
  factoryId: string;
  subSector: string;
  storeId?: string;
  storeName?: string;
  period: string;
  sections: {
    // Week 2-3
    menuNormalization?: MenuNormalization;
    channelMargin?: ChannelMargin;
    financialMetrics?: FinancialMetrics;
    diagnostics?: Diagnosis[];
    benchmarkAlerts?: BenchmarkAlert[];
    // Week 4
    storePnlOnePager?: StorePnlOnePager;
    diningHeatmap?: DiningHeatmap;
    storedValueDependency?: StoredValueDependency;
    longTailSku?: LongTailSku;
    reviewAnalysis?: ReviewAnalysis;
    bomLayerStatus?: BomLayerStatus;
  };
  warnings: string[];
  executiveSummary: string[];
  summary: {
    sectionsGenerated: string[];
    totalDiagnoses: number;
    totalAlerts: number;
    criticalIssues: number;
    redAlerts: number;
  };
}

export interface V2Response {
  success: boolean;
  cached: boolean;
  data?: V2UnifiedReport;
  performance?: {
    loadSeconds: number;
    computeSeconds: number;
    totalSeconds: number;
    posRows: number;
  };
  warning?: string;
  message?: string;
  code?: string;
  cachedAt?: string;
}

// ── API functions ──────────────────────────────────────────

/**
 * GET /api/smartbi/restaurant-analytics-v2/{upload_id}
 * 读缓存, 没算过返回 {success: false, cached: false}
 */
export async function getRestaurantAnalyticsV2(
  uploadId: number
): Promise<V2Response> {
  return pythonFetch<V2Response>(
    `/api/smartbi/restaurant-analytics-v2/${uploadId}`,
    { method: 'GET' }
  );
}

/**
 * POST /api/smartbi/restaurant-analytics-v2/{upload_id}
 * 触发 V2 分析, 返回 unified report
 */
export async function computeRestaurantAnalyticsV2(
  uploadId: number,
  payload: V2AnalyzePayload = {},
  force: boolean = false
): Promise<V2Response> {
  const url = `/api/smartbi/restaurant-analytics-v2/${uploadId}${force ? '?force=true' : ''}`;
  return pythonFetch<V2Response>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
