/**
 * Restaurant Analytics Types
 * Structured data types for restaurant operations dashboards.
 */

export interface MenuQuadrantItem {
  name: string
  quadrant: 'Star' | 'Plow' | 'Puzzle' | 'Dog'
  revenue: number
  quantity: number
  unitProfit: number
}

export interface MenuQuadrantData {
  items: MenuQuadrantItem[]
  qtyMedian: number
  profitMedian: number
  summary: {
    starCount: number
    plowCount: number
    puzzleCount: number
    dogCount: number
  }
}

export interface StoreMetrics {
  name: string
  revenue: number
  orderCount: number
  avgTicket: number
  discountPct: number
}

export interface StoreComparisonData {
  stores: StoreMetrics[]
  weakStores: string[]
  medianRevenue: number
}

export interface CategoryBreakdownItem {
  category: string
  revenue: number
  pct: number
}

export interface ComboMethodItem {
  method: string
  revenue: number
  pct: number
  count: number
}

export interface DiscountAlert {
  store: string
  discountPct: number
}

/** 经营数据指标 (Operations Metrics) — 基于内部 POS/ERP 数据 */
export interface OperationsMetrics {
  signatureConcentration: number
  returnRate: number
  priceVsBenchmark: { actual: number; benchmarkMedian: number }
  consistencyScore: number
}

/** @deprecated Use OperationsMetrics instead */
export type DianpingGapData = OperationsMetrics

/** 平台准入检查项 */
export interface PlatformCheckItem {
  key: string
  label: string
  pass: boolean | null
  detail: string
  source: 'data' | 'manual'
}

/** 榜单匹配推荐 */
export interface RecommendedList {
  list: string
  readiness: string
  action: string
}

/** 改进路线图项 */
export interface ImprovementRoadmapItem {
  checkKey: string
  label: string
  priority: 'high' | 'medium' | 'low'
  timeline: string
  action: string
}

/** 平台运营分析 (Platform Readiness) — 大众点评/美团准入评估 */
export interface PlatformReadiness {
  checks: PlatformCheckItem[]
  score: number
  passCount: number
  totalChecks: number
  dataChecks: number
  subSector: string
  recommendedLists?: RecommendedList[]
  improvementRoadmap?: ImprovementRoadmapItem[]
}

/** 价格带分析 */
export interface PriceBandAnalysis {
  bands: Array<{ band: string; skuCount: number; revenue: number; pct: number }>
  mainBand: string
  avgUnitPrice: number
  benchmarkMedian: number
  pricePositioning: string
}

/** 品类集中度 (HHI / 长尾) */
export interface CategoryConcentration {
  hhi: number
  top3Pct: number
  concentrationLevel: string
  categories: Array<{ name: string; pct: number; cumPct: number }>
  longTailCount: number
  longTailPct: number
}

/** 门店效率矩阵 */
export interface StoreEfficiencyMatrix {
  stores: Array<{ name: string; revenue: number; skuCount: number; quadrant: string }>
  medianRevenue: number
  medianSkuCount: number
  summary: { highEfficiency: number; scaleLeader: number; bloated: number; underperforming: number }
}

/** 供应链风险项 */
export interface SupplyChainRisk {
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  action: string
}

/** 供应链分析 (食品溯源联动) */
export interface SupplyChainAnalysis {
  supplierConcentration: {
    hhi: number
    riskLevel: string
    supplierCount: number
    top1Pct: number
    singleSourceRisk: boolean
    suppliers: Array<{ name: string; spend: number; pct: number; cumPct: number }>
  }
  ingredientCostBreakdown?: {
    ingredients: Array<{ name: string; cost: number; pct: number; cumPct: number }>
    top5CostPct: number
    totalIngredientCount: number
  }
  menuIngredientLinkage?: {
    linkedItems: number
    totalMenuItems: number
    totalIngredients: number
    coverage: number
    linkedNames: string[]
  }
  risks: SupplyChainRisk[]
  overallRiskScore: '高' | '中' | '低'
}

/** 趋势分析 */
export interface TrendAnalysis {
  dailyTrend: Array<{ date: string; revenue: number }>
  totalDays: number
  avgDailyRevenue: number
  popGrowth: number | null
  peakDay: { date: string; revenue: number }
  troughDay: { date: string; revenue: number }
  weeklyTrend?: Array<{ week: string; revenue: number }>
  storeTrends?: Record<string, Array<{ date: string; revenue: number }>>
}

/** 时段分析 */
export interface TimePeriodAnalysis {
  hourlyDistribution: Array<{ hour: number; revenue: number; orderCount: number }>
  mealPeriods: Array<{ period: string; revenue: number; pct: number; orderCount: number }>
  peakHour: number
  peakHourLabel: string
  weekdayAvg: number
  weekendAvg: number
  mainMealPeriod: string
  mainMealPct: number
}

/** 维度可用性提示 */
export interface DimensionHint {
  key: string
  label: string
  available: boolean
  requiredCols: string
  hint?: string
}

export interface RestaurantAnalyticsResult {
  menuQuadrant: MenuQuadrantData
  storeComparison: StoreComparisonData
  categoryBreakdown: CategoryBreakdownItem[]
  comboEfficiency: { methods: ComboMethodItem[] }
  discountAlerts: DiscountAlert[]
  /** @deprecated Use operationsMetrics instead */
  dianpingGaps: OperationsMetrics
  /** 经营数据分析 */
  operationsMetrics: OperationsMetrics
  /** 平台运营分析 */
  platformReadiness: PlatformReadiness
  benchmarksUsed: string
  /** Phase C: 价格带分析 */
  priceBandAnalysis?: PriceBandAnalysis
  /** Phase C: 品类集中度 */
  categoryConcentration?: CategoryConcentration
  /** Phase C: 门店效率矩阵 */
  storeEfficiencyMatrix?: StoreEfficiencyMatrix
  /** 数据质量告警 */
  dataQualityWarnings?: string[]
  /** 供应链分析 (食品溯源联动) */
  supplyChainAnalysis?: SupplyChainAnalysis
  /** 趋势分析 */
  trendAnalysis?: TrendAnalysis
  /** 时段分析 */
  timePeriodAnalysis?: TimePeriodAnalysis
  /** 维度可用性提示 */
  dimensionHints?: DimensionHint[]
}

export interface RestaurantUploadItem {
  id: number
  fileName: string
  sheetName: string
  rowCount: number
  createdAt: string
  hasCachedAnalytics: boolean
}
