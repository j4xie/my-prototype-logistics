/**
 * SmartBI API - Shared Utilities
 * Common helpers used across all SmartBI API modules.
 */
import request from '../request';
import { get, post } from '../request';

// Re-export request utilities for submodules
export { request, get, post };

// ==================== Helper Functions ====================

/**
 * Get current logged-in user data (from localStorage).
 * Centralizes localStorage access for future migration to Pinia auth store.
 * (Corresponding store: src/store/modules/auth.ts -- useAuthStore().factoryId)
 */
export function getUserData(): { factoryId: string; [key: string]: unknown } {
  const userStr = localStorage.getItem('cretas_user');
  if (!userStr) {
    throw new Error('No user data found');
  }
  const user = JSON.parse(userStr);
  if (!user || typeof user !== 'object') {
    throw new Error('Invalid user data in storage');
  }
  return user;
}

/**
 * Get current factory ID.
 * AUDIT-011: Do NOT fall back to 'F001' -- that is a multi-tenant data breach risk.
 * If no factoryId is available, throw so the caller can redirect to login.
 */
export function getFactoryId(): string {
  try {
    const user = getUserData();
    if (!user.factoryId) {
      throw new Error('No factoryId in user data');
    }
    return user.factoryId;
  } catch (error) {
    console.error('Failed to get factoryId:', error);
    // Do NOT fall back to 'F001' -- surface the error
    throw new Error('Factory ID unavailable. Please log in again.');
  }
}

/**
 * Get SmartBI API base path
 */
export function getSmartBIBasePath(): string {
  return `/${getFactoryId()}/smart-bi`;
}

// ========== Concurrency Limiter (Phase 2.1) ==========
export class ConcurrencyLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  constructor(private maxConcurrent: number) {}
  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => { this.running++; resolve(); });
    });
  }
  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}
export const enrichmentLimiter = new ConcurrencyLimiter(3);

// ========== AbortController Registry (Phase audit) ==========
export const activeControllers = new Map<string, AbortController>();

export function getAbortSignal(key: string): AbortSignal {
  // Cancel any previous request with the same key
  const existing = activeControllers.get(key);
  if (existing) existing.abort();
  const controller = new AbortController();
  activeControllers.set(key, controller);
  return controller.signal;
}

export function abortSmartBIRequest(key: string): void {
  const controller = activeControllers.get(key);
  if (controller) {
    controller.abort();
    activeControllers.delete(key);
  }
}

// ==================== Python Service Fetch ====================

/**
 * Python SmartBI service URL
 * Dev: Vite proxy (/smartbi-api -> localhost:8083/api) for CORS
 * Prod: VITE_SMARTBI_URL direct
 */
const PYTHON_SMARTBI_URL = import.meta.env.VITE_SMARTBI_URL || '/smartbi-api';
const PYTHON_TIMEOUT_MS = 30000;

// ==================== snake_case -> camelCase transform (AUDIT-065) ====================

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function transformKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, val]) => [snakeToCamel(key), transformKeys(val)])
    );
  }
  return obj;
}

/**
 * AUDIT-015: Centralized fetch wrapper for all Python SmartBI service calls.
 * Adds: timeout, response.ok check, auth header, consistent error handling.
 * AUDIT-065: Automatically transforms snake_case keys to camelCase in responses.
 *
 * For FormData uploads, pass `headers: {}` to remove the default Content-Type
 * so the browser sets multipart/form-data automatically.
 */
export async function pythonFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PYTHON_TIMEOUT_MS);

  // If caller already provided a signal (e.g. for user-initiated abort),
  // listen on it and forward the abort to our controller.
  if (options.signal) {
    const externalSignal = options.signal;
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': import.meta.env.VITE_PYTHON_SECRET || 'cretas-internal-2026',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Python service error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return transformKeys(json);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Python service request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ==================== Type Definitions (shared across modules) ====================

// KPI card data -- unified definition in @/types/smartbi, re-export here
import type { KPICard as _KPICard } from '@/types/smartbi';
export type KPICard = _KPICard;

/**
 * Analysis query parameters
 */
export interface AnalysisParams {
  startDate: string;
  endDate: string;
  department?: string;
  region?: string;
  dimension?: string;
}

/**
 * Chart data
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
 * Dashboard response
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
 * NL query request
 */
export interface NLQueryRequest {
  query: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}

/**
 * NL query response
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
 * Alert info
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
 * Recommendation info
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
 * Incentive plan
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

/**
 * AI insight structure
 */
export interface AIInsightData {
  positive: {
    title: string;
    items: string[];
  };
  negative: {
    title: string;
    items: string[];
  };
  suggestions: {
    title: string;
    items: string[];
  };
  confidence?: number;
  generatedAt?: string;
}

/**
 * KPI data structure
 */
export interface KPIData {
  key: string;
  title: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: number | string;
  status?: 'success' | 'warning' | 'danger' | 'info' | 'default';
}

/**
 * Chart configuration structure
 */
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'waterfall' | 'radar' | 'gauge' | 'scatter' | 'area' | 'bar_horizontal' | 'combination';
  title?: string;
  option: Record<string, unknown>;
}

/**
 * Analysis result structure
 */
export interface AnalysisResult {
  success: boolean;
  answer?: string;
  insights?: AIInsightData;
  kpis?: KPIData[];
  charts?: ChartConfig[];
  table?: {
    columns: string[];
    data: Record<string, unknown>[];
  };
  error?: string;
}

/**
 * Upload history item
 */
export interface UploadHistoryItem {
  id: number;
  fileName: string;
  sheetName: string;
  tableType: string;
  rowCount: number;
  columnCount: number;
  status: string;
  createdAt: string;
}

/**
 * Field definition
 */
export interface FieldDefinition {
  originalName: string;
  standardName: string;
  fieldType: string;
  semanticType: string;
  chartRole: string;
  isDimension: boolean;
  isMeasure: boolean;
  isTime: boolean;
  formatPattern: string;
}

/**
 * Column summary
 */
export interface ColumnSummary {
  name: string;
  type: string;
  nullCount?: number;
  uniqueCount?: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  // From Python quick-summary: sparkline data points and trend info
  sparkline?: number[];
  trend?: string;
  trendPercent?: number | null;
}

/**
 * Financial metrics
 */
interface FinancialRow {
  label: string;
  values: Record<string, number>;
  total: number;
}

export interface FinancialMetrics {
  revenue?: FinancialRow;
  cost?: FinancialRow;
  grossProfit?: FinancialRow;
  netProfit?: FinancialRow;
  expenses: FinancialRow[];
  grossMargin?: number;
  netMargin?: number;
  expenseRatio?: number;
  monthlyRevenue?: number[];
  monthlyNetProfit?: number[];
  mom?: Array<{ month: string; change: number | null }>;
  industryBenchmark: { grossMargin: number; netMargin: number; expenseRatio: number };
  gaps: Record<string, number>;
}

/**
 * Structured AI data
 */
export interface StructuredAIData {
  executiveSummary: string;
  riskAlerts: Array<{ title: string; description: string; severity?: string; mitigation?: string }>;
  opportunities: Array<{ title: string; description: string; potentialImpact?: string; actionRequired?: string }>;
  sensitivityAnalysis?: Array<{ factor: string; current_value: string; impact_description: string }>;
}

/**
 * Fallback: compute basic sensitivity analysis from financial metrics
 */
export function computeSensitivityFallback(fm: FinancialMetrics): StructuredAIData['sensitivityAnalysis'] {
  const items: NonNullable<StructuredAIData['sensitivityAnalysis']> = [];
  const rev = fm.revenue?.sum;
  const cost = fm.cost?.sum;
  const gm = fm.grossMargin;
  const np = fm.netProfit?.sum;

  if (rev && rev > 0 && np != null) {
    const revDrop10 = rev * 0.1;
    const newNp = np - revDrop10;
    const npChange = np !== 0 ? ((newNp - np) / Math.abs(np) * 100) : 0;
    items.push({
      factor: '营业收入',
      current_value: `${(rev / 10000).toFixed(0)}万元`,
      impact_description: `收入下降10%（${(revDrop10/10000).toFixed(0)}万元），净利润预计从${(np/10000).toFixed(0)}万元降至${(newNp/10000).toFixed(0)}万元（${npChange.toFixed(1)}%）`
    });
  }

  if (cost && cost > 0 && rev && np != null) {
    const costUp5 = cost * 0.05;
    const newNp2 = np - costUp5;
    items.push({
      factor: '营业成本',
      current_value: `${(cost / 10000).toFixed(0)}万元`,
      impact_description: `成本上升5%（+${(costUp5/10000).toFixed(0)}万元），净利润降至${(newNp2/10000).toFixed(0)}万元，净利率降至${rev > 0 ? (newNp2/rev*100).toFixed(1) : '?'}%`
    });
  }

  if (gm != null && gm > 0 && rev) {
    // gm and benchmark are decimals (0.20 = 20%), multiply by 100 for display
    const bmGM = fm.industryBenchmark.grossMargin;
    const gmPct = gm * 100;
    const bmGMPct = bmGM * 100;
    const gapPct = (gm - bmGM) * 100;
    items.push({
      factor: '毛利率',
      current_value: `${gmPct.toFixed(1)}%`,
      impact_description: gapPct < 0
        ? `当前低于行业均值${bmGMPct.toFixed(0)}%达${Math.abs(gapPct).toFixed(1)}个百分点，每提升1个百分点可增加利润约${(rev * 0.01 / 10000).toFixed(0)}万元`
        : `当前高于行业均值${bmGMPct.toFixed(0)}%达${gapPct.toFixed(1)}个百分点，需关注价格竞争对毛利率的下行压力`
    });
  }

  if (fm.expenseRatio != null && rev && rev > 0) {
    const totalExpense = fm.expenses.reduce((s, e) => s + (e.sum || 0), 0);
    if (totalExpense > 0) {
      const saving = totalExpense * 0.1;
      const erPct = fm.expenseRatio * 100;
      const bmERPct = fm.industryBenchmark.expenseRatio * 100;
      items.push({
        factor: '费用管控',
        current_value: `费用率${erPct.toFixed(1)}%`,
        impact_description: `费用压缩10%可节约${(saving/10000).toFixed(0)}万元，费用率从${erPct.toFixed(1)}%降至${(erPct * 0.9).toFixed(1)}%（行业${bmERPct.toFixed(0)}%）`
      });
    }
  }

  return items.length > 0 ? items : undefined;
}

/**
 * Enrich result (multi-chart + KPI)
 */
export interface EnrichResult {
  success: boolean;
  cached?: boolean;
  cachedAt?: string;
  charts?: Array<{ chartType: string; title: string; config: Record<string, unknown> }>;
  kpiSummary?: { rowCount: number; columnCount: number; columns: ColumnSummary[] };
  financialMetrics?: FinancialMetrics | null;
  aiAnalysis?: string;
  structuredAI?: StructuredAIData;
  error?: string;
  chartConfig?: Record<string, unknown>;
  timings?: Record<string, number>;
}

/**
 * Chart plan item
 */
export interface ChartPlanItem {
  chartType: string;
  data: Record<string, unknown>[];
  xField: string;
  yFields: string[];
  title: string;
  seriesField?: string;
}

/**
 * Smart KPI
 */
export interface SmartKPI {
  title: string;
  value: number | string;
  unit: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  changeRate?: number;
  status: 'success' | 'warning' | 'danger' | 'info' | 'default';
  displayMode: 'default' | 'sparkline';
  sparklineData: number[];
  benchmarkLabel?: string;
  benchmarkGap?: number;
}

/**
 * Drill-down result
 */
export interface DrillDownResult {
  success: boolean;
  result?: {
    dimension: string;
    filterValue: string;
    data: Record<string, unknown>[];
    summary: Record<string, unknown>;
  };
  chartConfig?: Record<string, unknown>;
  aiInsight?: string;
  error?: string;
  availableDimensions?: string[];
  hierarchy?: { type: string; levels: string[]; currentLevel: number; maxLevel: number };
  breadcrumb?: Array<{ dimension: string; value: string }>;
  currentLevel?: number;
  maxLevel?: number;
}

/**
 * Cross-sheet result
 */
export interface CrossSheetResult {
  success: boolean;
  kpiComparison?: Array<{ sheetName: string; kpis: Record<string, number> }>;
  charts?: Array<{ chartType: string; title: string; config: Record<string, unknown> }>;
  aiSummary?: string;
  error?: string;
}

/**
 * YoY comparison types
 */
export interface YoYComparisonItem {
  label: string;
  currentValue: number;
  previousValue: number;
  yoyGrowth: number | null;
  category: string;
}

export interface YoYResult {
  success: boolean;
  currentUploadId: number;
  compareUploadId?: number;
  currentPeriod?: string;
  comparePeriod?: string;
  comparison: YoYComparisonItem[];
  summary?: Record<string, number>;
  error?: string;
}

/**
 * Dynamic analysis response
 */
export interface DynamicAnalysisResponse {
  uploadId: number;
  tableType: string;
  kpiCards: Array<{
    title: string;
    value: string;
    rawValue: number;
    type?: string;
    formatPattern?: string;
    min?: number;
    max?: number;
  }>;
  charts: Array<{
    type: string;
    title: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    data: {
      labels: string[];
      datasets: Array<{
        label: string;
        data: number[];
      }>;
    };
  }>;
  insights: string[];
  fieldDefinitions: FieldDefinition[];
}

/**
 * Table data response
 */
export interface TableDataResponse {
  headers: string[];
  data: Record<string, unknown>[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Backfill types
 */
export interface BackfillResult {
  uploadId: number;
  status: 'success' | 'skipped' | 'failed';
  fieldsCreated: number;
  message: string;
}

export interface BatchBackfillResult {
  totalProcessed: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  details: BackfillResult[];
}

/**
 * Statistical result types
 */
export interface StatisticalResult {
  success: boolean;
  distributions: Record<string, {
    count: number;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    skewness: number;
    kurtosis: number;
    distributionType: string;
    isNormal: boolean;
    normalityPValue: number;
    coefficientOfVariation: number;
    percentiles: Record<string, number>;
  }>;
  correlations: {
    matrix: Record<string, Record<string, number>>;
    strongPositive: Array<{ var1: string; var2: string; correlation: number }>;
    strongNegative: Array<{ var1: string; var2: string; correlation: number }>;
    topCorrelation?: { var1: string; var2: string; correlation: number };
  };
  comparisons: Record<string, {
    measure: string;
    top3: Record<string, number>;
    bottom3: Record<string, number>;
    cr3: number;
    cr5: number;
    giniCoefficient: number;
    paretoCount: number;
    paretoRatio: number;
    totalItems: number;
  }>;
  outlierSummary: Record<string, { count: number; values: number[] }>;
  processingTimeMs: number;
  error?: string;
}

export interface CorrelationResult {
  success: boolean;
  correlationMatrix: Record<string, Record<string, number>>;
  strongPositive: Array<{ var1: string; var2: string; correlation: number }>;
  strongNegative: Array<{ var1: string; var2: string; correlation: number }>;
  topCorrelation?: { var1: string; var2: string; correlation: number };
  chartConfig?: Record<string, unknown>;
  processingTimeMs: number;
  error?: string;
}

/**
 * Column name humanization map and helper
 */
const COLUMN_NAME_MAP: Record<string, string> = {
  'actual_amount': '实际金额',
  'budget_amount': '预算金额',
  'variance': '差异',
  'variance_rate': '差异率',
  'completion_rate': '完成率',
  'revenue': '营业收入',
  'cost': '成本',
  'profit': '利润',
  'net_profit': '净利润',
  'gross_profit': '毛利',
  'gross_margin': '毛利率',
  'expense': '费用',
  'total': '合计',
  'amount': '金额',
  'quantity': '数量',
  'price': '单价',
  'unit_price': '单价',
  'sales': '销售额',
  'growth_rate': '增长率',
  '__rowIndex': '序号',
  '行次': '项目',
  'period': '期间',
  'region': '区域',
  'category': '分类',
  'item': '项目',
  'description': '摘要',
  'name': '名称',
  'type': '类型',
  'department': '部门',
  'month': '月份',
  'year': '年份',
  'date': '日期',
  'ratio': '比率',
  'rate': '比率',
  'count': '数量',
  'avg': '平均值',
  'sum': '合计',
  'max': '最大值',
  'min': '最小值',
  'balance': '余额',
  'net_amount': '净额',
  'tax': '税额',
  'discount': '折扣',
  'margin': '利润率',
  'percentage': '百分比',
  'status': '状态',
  'remark': '备注',
  'note': '备注',
  'actual': '实际',
  'budget': '预算',
  'target': '目标',
  'plan': '计划',
};

/**
 * Convert raw column names to human-friendly display names
 */
export function humanizeColumnName(col: string): string {
  // Fix 6: Strip technical dedup suffixes like _2, _3 first
  let cleaned = col.replace(/_(\d+)$/, (match, num) => {
    // Keep _2 etc for dates like 2025-01-01_2, handled below
    if (/^\d{4}-\d{2}-\d{2}_\d+$/.test(col)) return match;
    // For regular names, convert _2 → (2) etc, or just strip
    const n = parseInt(num);
    if (n >= 2 && n <= 15) {
      return `(${n})`;
    }
    return '';
  });

  // Strip redundant prefixes like "各销售X中心YYYY年各分部及区域" → keep meaningful tail
  cleaned = cleaned.replace(/^各[\u4e00-\u9fff]{2,6}中心\d{4}年/, '');
  cleaned = cleaned.replace(/^各[\u4e00-\u9fff]{2,6}及[\u4e00-\u9fff]{2,4}/, '');

  // Strip "逆向验证" suffix pattern
  cleaned = cleaned.replace(/逆向验证/, '(验证)');

  // Strip "YYYY年合计" prefix but keep the rest
  cleaned = cleaned.replace(/^\d{4}年合计/, '年度合计');

  const dateMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:_(\d+))?$/);
  if (dateMatch) {
    const month = parseInt(dateMatch[2]);
    const suffix = dateMatch[4] ? `(${dateMatch[4]})` : '';
    return `${month}月${suffix}`;
  }
  const ymMatch = cleaned.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    return `${parseInt(ymMatch[2])}月`;
  }
  if (COLUMN_NAME_MAP[cleaned]) return COLUMN_NAME_MAP[cleaned];
  const lower = cleaned.toLowerCase();
  for (const [key, val] of Object.entries(COLUMN_NAME_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }
  // Replace remaining underscores with spaces for readability
  cleaned = cleaned.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  if (cleaned.length > 15) {
    const lastSeg = cleaned.split(/[\s\/]/).pop();
    if (lastSeg && lastSeg.length >= 2 && lastSeg.length <= 10) return lastSeg;
    const lastPart = cleaned.split(/[&\uFF06\u00B7]/).pop()?.trim();
    if (lastPart && lastPart.length >= 2 && lastPart.length <= 10) return lastPart;
    return cleaned.slice(0, 12) + '\u2026';
  }
  return cleaned;
}

/**
 * Format large number into display value and unit
 */
export function formatLargeNumber(val: number): { displayValue: string; unit: string } {
  if (Math.abs(val) >= 1e8) return { displayValue: (val / 1e8).toFixed(1), unit: '亿' };
  if (Math.abs(val) >= 1e4) return { displayValue: (val / 1e4).toFixed(1), unit: '万' };
  if (Number.isInteger(val)) return { displayValue: val.toLocaleString(), unit: '' };
  return { displayValue: val.toFixed(2), unit: '' };
}

/**
 * Compress month ranges for display
 */
export function compressMonthRange(fields: string[]): string {
  if (fields.length === 0) return '';
  if (fields.length === 1) return humanizeColumnName(fields[0]);

  const months: number[] = [];
  for (const f of fields) {
    const h = humanizeColumnName(f);
    const m = h.match(/^(\d{1,2})月/);
    if (m) months.push(parseInt(m[1]));
  }

  if (months.length >= 2) {
    const sorted = [...months].sort((a, b) => a - b);
    return `${sorted[0]}-${sorted[sorted.length - 1]}月`;
  }

  return fields.slice(0, 3).map(humanizeColumnName).join('\u3001');
}

/**
 * Shared subtotal/summary row pattern
 */
export const SUBTOTAL_SUMMARY_PATTERN = /^(合计|小计|总计|total|subtotal|sum|毛利[率]?(?!-)|净利[润率]?(?!-)|[一二三四五六七八九十]+[、.]|[减加][：:])/i;

/**
 * KPI keyword weights for smart KPI selection
 */
export const KPI_KEYWORD_WEIGHTS: Record<string, { weight: number; status: 'success' | 'warning' | 'danger' | 'info' }> = {
  '营业收入': { weight: 100, status: 'success' },
  '收入': { weight: 95, status: 'success' },
  '净利润': { weight: 90, status: 'success' },
  '利润': { weight: 85, status: 'success' },
  '毛利': { weight: 80, status: 'success' },
  '毛利率': { weight: 80, status: 'info' },
  '成本': { weight: 75, status: 'warning' },
  '费用': { weight: 70, status: 'warning' },
  '合计': { weight: 65, status: 'info' },
  '总计': { weight: 60, status: 'info' },
  '销售': { weight: 55, status: 'success' },
  '税': { weight: 50, status: 'danger' },
  '资产': { weight: 45, status: 'info' },
  '负债': { weight: 40, status: 'danger' }
};
