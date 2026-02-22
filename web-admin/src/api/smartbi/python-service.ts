/**
 * SmartBI API - Python Service Module
 * Direct Python service calls: chart build, insights, forecast, statistical analysis,
 * health check, food benchmarks, and food industry detection.
 */
import {
  pythonFetch,
  PYTHON_SMARTBI_URL,
  getPythonAuthHeaders,
  PYTHON_LLM_TIMEOUT_MS,
  type AnalysisResult,
  type StatisticalResult,
  type CorrelationResult,
  type ColumnSummary,
  type ChartPlanItem,
} from './common';

// ==================== Chart Building ====================

/**
 * Build chart
 */
export async function buildChart(params: {
  chartType: string;
  data: unknown[];
  xField?: string;
  yFields?: string[];
  title?: string;
}): Promise<{ success: boolean; option?: Record<string, unknown>; error?: string }> {
  try {
    const result = await pythonFetch('/api/chart/build', {
      method: 'POST',
      body: JSON.stringify(params)
    }) as Record<string, unknown>;
    return { success: result.success as boolean, option: result.config as Record<string, unknown> | undefined, error: result.error as string | undefined };
  } catch (error) {
    console.error('buildChart 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '图表构建请求失败'
    };
  }
}

/**
 * Chart recommendation - auto-recommend best chart types based on data
 */
export async function recommendChart(data: unknown[], signal?: AbortSignal): Promise<{
  success: boolean;
  recommendations?: Array<{ chartType: string; reason?: string; xField?: string; yFields?: string[]; priority: number }>;
  dataInfo?: { rowCount?: number; numericColumns: string[]; categoricalColumns: string[]; dateColumns: string[] };
  error?: string;
}> {
  try {
    return await pythonFetch('/api/chart/recommend', {
      method: 'POST',
      body: JSON.stringify({ data, fields: null }),
      signal
    }) as { success: boolean; recommendations?: Array<{ chartType: string; reason?: string; xField?: string; yFields?: string[]; priority: number }>; dataInfo?: { rowCount?: number; numericColumns: string[]; categoricalColumns: string[]; dateColumns: string[] }; error?: string };
  } catch (error) {
    console.error('recommendChart 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '图表推荐请求失败'
    };
  }
}

/**
 * LLM-powered smart chart recommendation
 * Calls Python /api/chart/smart-recommend for intelligent, diverse chart type suggestions
 */
export async function smartRecommendChart(params: {
  data: unknown[];
  sheetName?: string;
  context?: string;
  scenario?: string;
  maxRecommendations?: number;
  excludeTypes?: string[];
}, signal?: AbortSignal): Promise<{
  success: boolean;
  recommendations?: Array<{
    chartType: string;
    title?: string;
    reason?: string;
    xField?: string;
    yFields?: string[];
    seriesField?: string;
    priority: number;
    category?: string;
    confidence?: number;
    configHints?: Record<string, unknown>;
  }>;
  diversityScore?: number;
  method?: string;
  dataInfo?: { rowCount?: number; numericColumns: string[]; categoricalColumns: string[]; dateColumns: string[] };
  error?: string;
}> {
  try {
    const result = await pythonFetch('/api/chart/smart-recommend', {
      method: 'POST',
      timeoutMs: PYTHON_LLM_TIMEOUT_MS,
      body: JSON.stringify({
        data: params.data,
        sheetName: params.sheetName,
        context: params.context,
        scenario: params.scenario || 'general',
        maxRecommendations: params.maxRecommendations || 7,
        excludeTypes: params.excludeTypes
      }),
      signal
    }) as Record<string, unknown>;
    const data = result.data as Record<string, unknown> | undefined;
    return {
      success: result.success as boolean,
      recommendations: data?.recommendations as typeof returnType['recommendations'],
      diversityScore: data?.diversityScore as number | undefined,
      method: data?.method as string | undefined,
      dataInfo: data?.dataInfo as typeof returnType['dataInfo'],
      error: result.message as string | undefined
    };
  } catch (error) {
    console.warn('smartRecommendChart 失败 (将回退到基础推荐):', error instanceof Error ? error.message : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'LLM 图表推荐请求失败'
    };
  }
}
// Type helper for return type extraction
type returnType = Awaited<ReturnType<typeof smartRecommendChart>>;

/**
 * Batch build charts: call Python /api/chart/batch
 */
export async function batchBuildCharts(plans: Array<{
  chartType: string;
  data: Record<string, unknown>[];
  xField: string;
  yFields: string[];
  title: string;
  seriesField?: string;
}>, signal?: AbortSignal): Promise<{
  success: boolean;
  charts: Array<{ success: boolean; chartType: string; config: Record<string, unknown>; anomalies?: Record<string, unknown> }>;
}> {
  try {
    const result = await pythonFetch('/api/chart/batch', {
      method: 'POST',
      timeoutMs: PYTHON_LLM_TIMEOUT_MS,
      body: JSON.stringify(plans.map(p => ({
        chartType: p.chartType,
        data: p.data,
        xField: p.xField,
        yFields: p.yFields,
        title: p.title,
        seriesField: p.seriesField
      }))),
      signal
    }) as Record<string, unknown>;
    // Python batch endpoint returns {success, data: {charts: [...]}}
    const chartArray = ((result.data as Record<string, unknown>)?.charts ?? result.charts ?? []) as Array<Record<string, unknown>>;
    return {
      success: result.success as boolean,
      charts: chartArray.map((c) => ({
        success: c.success as boolean,
        chartType: c.chartType as string,
        config: c.config as Record<string, unknown>,
        anomalies: c.anomalies as Record<string, unknown> | undefined
      }))
    };
  } catch (error) {
    console.error('batchBuildCharts 失败:', error);
    return { success: false, charts: [] };
  }
}

// ==================== AI Insights ====================

/**
 * AI insight generation - generate analysis insights from data
 */
export async function generateInsights(params: {
  data: unknown[];
  analysisContext?: string;
  maxInsights?: number;
}): Promise<{
  success: boolean;
  insights?: Array<{ type: string; text: string; recommendation?: string; sentiment?: string; importance?: number }>;
  error?: string;
}> {
  try {
    return await pythonFetch('/api/insight/generate', {
      method: 'POST',
      timeoutMs: PYTHON_LLM_TIMEOUT_MS,
      body: JSON.stringify({
        data: params.data,
        analysisContext: params.analysisContext,
        maxInsights: params.maxInsights || 5
      })
    }) as { success: boolean; insights?: Array<{ type: string; text: string; recommendation?: string; sentiment?: string; importance?: number }>; error?: string };
  } catch (error) {
    console.error('generateInsights 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI 洞察生成请求失败'
    };
  }
}

/**
 * Quick statistical summary (no LLM, ~100ms)
 * When uploadId is provided, Python loads data from PG directly (avoids large POST body).
 */
export async function quickSummary(data: unknown[], signal?: AbortSignal, uploadId?: number): Promise<{
  success: boolean;
  rowCount: number;
  columnCount: number;
  columns: ColumnSummary[];
}> {
  try {
    // Prefer server-side data loading when uploadId is available
    const body = uploadId
      ? JSON.stringify({ upload_id: uploadId })
      : JSON.stringify(data);
    return await pythonFetch('/api/insight/quick-summary', {
      method: 'POST',
      body,
      signal
    }) as { success: boolean; rowCount: number; columnCount: number; columns: ColumnSummary[] };
  } catch (error) {
    console.error('quickSummary 失败:', error);
    return { success: false, rowCount: 0, columnCount: 0, columns: [] };
  }
}

// ==================== Forecast ====================

/**
 * Forecast API call (Phase 3.2)
 * Calls Python /api/forecast/predict with numeric series, returns predictions + confidence interval
 */
export async function getForecast(data: number[], periods = 3): Promise<{
  success: boolean;
  predictions: number[];
  lowerBound: number[];
  upperBound: number[];
}> {
  try {
    return await pythonFetch('/api/forecast/predict', {
      method: 'POST',
      body: JSON.stringify({ data, periods, algorithm: 'auto' })
    }) as { success: boolean; predictions: number[]; lowerBound: number[]; upperBound: number[] };
  } catch (error) {
    console.error('getForecast 失败:', error);
    return { success: false, predictions: [], lowerBound: [], upperBound: [] };
  }
}

// ==================== Statistical / Causal Analysis ====================

export async function statisticalAnalysis(params: {
  data: Record<string, unknown>[];
  measures?: string[];
  dimensions?: string[];
}): Promise<StatisticalResult> {
  try {
    return await pythonFetch('/api/statistical/analyze', {
      method: 'POST',
      body: JSON.stringify(params)
    }) as StatisticalResult;
  } catch (error) {
    console.error('statisticalAnalysis failed:', error);
    return {
      success: false,
      distributions: {},
      correlations: { matrix: {}, strong_positive: [], strong_negative: [] },
      comparisons: {},
      outlier_summary: {},
      processing_time_ms: 0,
      error: error instanceof Error ? error.message : 'Statistical analysis failed'
    };
  }
}

export async function correlationAnalysis(params: {
  data: Record<string, unknown>[];
  measures?: string[];
}): Promise<CorrelationResult> {
  try {
    return await pythonFetch('/api/statistical/correlations', {
      method: 'POST',
      body: JSON.stringify(params)
    }) as CorrelationResult;
  } catch (error) {
    console.error('correlationAnalysis failed:', error);
    return {
      success: false,
      correlation_matrix: {},
      strong_positive: [],
      strong_negative: [],
      processing_time_ms: 0,
      error: error instanceof Error ? error.message : 'Correlation analysis failed'
    };
  }
}

// ==================== Analysis Cache ====================

/**
 * Get cached analysis from Python persistent cache
 * When cache hit, returns complete EnrichResult in <1s, avoiding 30-40s recalculation
 */
export async function getCachedAnalysis(uploadId: number): Promise<{
  success: boolean;
  cached?: boolean;
  cachedAt?: string;
  charts?: unknown;
  kpiSummary?: unknown;
  aiAnalysis?: string;
  structuredAI?: unknown;
  financialMetrics?: unknown;
  chartConfig?: unknown;
} | null> {
  try {
    const data = await pythonFetch(`/api/smartbi/analysis-cache/${uploadId}`) as Record<string, unknown>;
    if (data.success && data.cached) {
      return {
        success: true,
        cached: true,
        cachedAt: data.cachedAt as string,
        charts: data.charts,
        kpiSummary: data.kpiSummary,
        aiAnalysis: data.aiAnalysis as string,
        structuredAI: data.structuredAI,
        financialMetrics: data.financialMetrics,
        chartConfig: data.chartConfig,
      };
    }
    return null;
  } catch (e) {
    // console.warn('[Cache] Failed to load cached analysis:', e);
    return null;
  }
}

/**
 * Save analysis result to Python persistent cache
 * Called async after enrichment, does not block UI
 */
export async function saveAnalysisToCache(
  uploadId: number,
  factoryId: string,
  result: {
    charts?: unknown;
    kpiSummary?: unknown;
    aiAnalysis?: string;
    structuredAI?: unknown;
    financialMetrics?: unknown;
  }
): Promise<void> {
  try {
    await pythonFetch(`/api/smartbi/analysis-cache/${uploadId}`, {
      method: 'POST',
      body: JSON.stringify({
        factory_id: factoryId,
        charts: result.charts,
        kpiSummary: result.kpiSummary,
        aiAnalysis: result.aiAnalysis,
        structuredAI: result.structuredAI,
        financialMetrics: result.financialMetrics,
      }),
    });
  } catch (e) {
    // console.warn('[Cache] Failed to save analysis to cache:', e);
  }
}

/**
 * Delete cache, force next enrichment to recompute
 * Called by "refresh analysis" button
 */
export async function invalidateAnalysisCache(uploadId: number): Promise<void> {
  try {
    await pythonFetch(`/api/smartbi/analysis-cache/${uploadId}`, {
      method: 'DELETE',
    });
  } catch (e) {
    // console.warn('[Cache] Failed to invalidate cache:', e);
  }
}

// ==================== Streaming Insights ====================

/**
 * Streaming insight generation via SSE.
 * Calls /api/insight/generate-stream, yields raw text chunks as they arrive,
 * then returns the final parsed result from the 'done' event.
 */
export async function generateInsightsStream(params: {
  data: unknown[];
  analysisContext?: string;
  maxInsights?: number;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
}): Promise<{
  success: boolean;
  insights?: Array<{ type: string; text: string; recommendation?: string; sentiment?: string; importance?: number }>;
  error?: string;
  _streamingUsed?: boolean;
}> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/insight/generate-stream`, {
      method: 'POST',
      headers: getPythonAuthHeaders(),
      body: JSON.stringify({
        data: params.data,
        analysisContext: params.analysisContext,
        maxInsights: params.maxInsights || 5
      }),
      signal: params.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) {
      const fallback = await generateInsights(params);
      return { ...fallback, _streamingUsed: false };
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: { success: boolean; insights?: unknown[]; error?: string } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6).replace(/\\n/g, '\n');
          if (eventType === 'chunk' && params.onChunk) {
            params.onChunk(data);
          } else if (eventType === 'done') {
            try {
              finalResult = JSON.parse(data);
            } catch {
              console.warn('Failed to parse SSE done event');
            }
          }
        }
      }
    }

    if (finalResult) {
      return {
        ...(finalResult as {
          success: boolean;
          insights?: Array<{ type: string; text: string; recommendation?: string; sentiment?: string; importance?: number }>;
          error?: string;
        }),
        _streamingUsed: true
      };
    }
    return { success: false, error: 'Stream ended without result', _streamingUsed: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.warn('[SSE] generateInsightsStream failed, falling back:', error);
    const fallback = await generateInsights(params);
    return { ...fallback, _streamingUsed: false };
  }
}

// ==================== Python Health Check ====================

export interface PythonHealthStatus {
  enabled: boolean;
  available: boolean;
  llmConfigured: boolean;
  consecutiveFailures: number;
  lastCheckMs: number;
  url: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export async function checkPythonHealth(): Promise<ApiResponse<PythonHealthStatus>> {
  try {
    const resp = await fetch(`${PYTHON_SMARTBI_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return {
      success: true,
      data: {
        enabled: true,
        available: true,
        llmConfigured: !!data.llm_configured,
        consecutiveFailures: 0,
        lastCheckMs: Date.now(),
        url: PYTHON_SMARTBI_URL,
      },
      message: 'OK',
    };
  } catch {
    return {
      success: false,
      data: {
        enabled: false,
        available: false,
        llmConfigured: false,
        consecutiveFailures: 1,
        lastCheckMs: Date.now(),
        url: PYTHON_SMARTBI_URL,
      },
      message: 'Python service unavailable',
    };
  }
}

// ==================== Food Industry Benchmarks ====================

export interface FoodBenchmarkMetric {
  name: string;
  range: [number, number];
  median: number;
  unit: string;
  description: string;
  sub_sectors?: Record<string, { range: [number, number]; median: number }>;
}

export interface FoodBenchmarkData {
  industry: string;
  source: string;
  year: number;
  metrics: Record<string, FoodBenchmarkMetric>;
  food_safety_standards: Record<string, string>;
}

export interface BenchmarkComparison {
  metric_key: string;
  metric_name: string;
  actual_value: number;
  benchmark_range: [number, number];
  benchmark_median: number;
  unit: string;
  status: string;
  gap_from_median: number;
  recommendation: string;
}

export interface FoodIndustryDetection {
  is_food_industry: boolean;
  confidence: number;
  detected_categories: string[];
  matched_keywords: string[];
  suggested_benchmarks: string[];
  suggested_standards: string[];
}

export async function fetchFoodBenchmarks(): Promise<{ success: boolean; data?: FoodBenchmarkData }> {
  try {
    const res = await fetch(`${PYTHON_SMARTBI_URL}/smartbi/benchmark/food-processing`, {
      headers: getPythonAuthHeaders(),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (e) {
    console.warn('Failed to fetch food benchmarks:', e);
    return { success: false };
  }
}

export async function compareBenchmarks(
  metrics: Record<string, number>,
  subSector?: string
): Promise<{ success: boolean; comparisons?: BenchmarkComparison[]; overall_score?: number; summary?: string }> {
  try {
    const res = await fetch(`${PYTHON_SMARTBI_URL}/smartbi/benchmark/compare`, {
      method: 'POST',
      headers: getPythonAuthHeaders(),
      body: JSON.stringify({ metrics, sub_sector: subSector }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: json.success, comparisons: json.comparisons, overall_score: json.overall_score, summary: json.summary };
  } catch (e) {
    console.warn('Failed to compare benchmarks:', e);
    return { success: false };
  }
}

/**
 * Detect if uploaded data is food-industry related (client-side detection).
 * Uses keyword matching on column names — no network call needed.
 */
export function detectFoodIndustryLocal(
  columnNames: string[],
  sampleData?: Record<string, unknown>[]
): FoodIndustryDetection {
  const FOOD_KEYWORDS = new Set([
    '原料', '添加剂', '微生物', '保质期', '批次号', 'HACCP', 'GB',
    '肉制品', '乳制品', '调味品', '速冻', '烘焙', '饮料',
    '车间', '工序', '灭菌', '包装', '冷链', '良品率', '损耗率',
  ]);
  const FINANCIAL_KEYWORDS = new Set([
    '毛利率', '净利率', '营业收入', '营业成本', '销售费用', '管理费用',
    '利润', '费用率', '收入', '成本', '预算', '实际', '合计', '金额',
    '费用', '净利', '返利', '区域', '分部', '科目',
  ]);

  const allText = columnNames.join(' ') + ' ' +
    (sampleData ? sampleData.slice(0, 10).map(r => Object.values(r).join(' ')).join(' ') : '');

  const foodMatches: string[] = [];
  const finMatches: string[] = [];
  for (const kw of FOOD_KEYWORDS) {
    if (allText.includes(kw)) foodMatches.push(kw);
  }
  for (const kw of FINANCIAL_KEYWORDS) {
    if (allText.includes(kw)) finMatches.push(kw);
  }

  const totalMatches = foodMatches.length * 2 + finMatches.length;
  const confidence = Math.min(1.0, totalMatches / 8);
  const isFoodIndustry = foodMatches.length > 0 || finMatches.length >= 2;

  const categories: string[] = [];
  if (finMatches.length > 0) categories.push('financial');
  if (foodMatches.length > 0) categories.push('food_specific');

  return {
    is_food_industry: isFoodIndustry,
    confidence,
    detected_categories: categories,
    matched_keywords: [...foodMatches, ...finMatches].slice(0, 15),
    suggested_benchmarks: finMatches.length > 0
      ? ['gross_margin', 'net_margin', 'selling_expense_ratio', 'admin_expense_ratio']
      : [],
    suggested_standards: foodMatches.length > 0
      ? ['GB 2760-2014 食品添加剂使用标准', 'GB 14881-2013 食品生产通用卫生规范']
      : [],
  };
}

// ==================== Food Industry Templates ====================

export interface FoodTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  chartPlan: Array<{
    chartType: string;
    xFieldHint: string;
    yFieldHints: string[];
    title: string;
  }>;
  kpiHints: string[];
}

export const FOOD_TEMPLATES: FoodTemplate[] = [
  {
    id: 'food-cost-trend',
    name: '原料成本月度趋势',
    category: '食品-财务',
    description: '原料采购成本的月度变化趋势',
    chartPlan: [
      { chartType: 'line', xFieldHint: '月|日期|时间|month|date', yFieldHints: ['金额|成本|采购|cost|amount'], title: '原料成本月度趋势' },
      { chartType: 'pie', xFieldHint: '类别|品类|原料|category', yFieldHints: ['金额|成本|amount'], title: '原料成本构成' },
      { chartType: 'bar', xFieldHint: '类别|品类|原料|category', yFieldHints: ['金额|成本|amount'], title: '各类原料成本对比' },
    ],
    kpiHints: ['总成本', '环比', '同比', '占比'],
  },
  {
    id: 'food-quality',
    name: '批次质量合格率',
    category: '食品-生产',
    description: '生产批次的质量合格率分析',
    chartPlan: [
      { chartType: 'bar', xFieldHint: '批次|产线|班组|line', yFieldHints: ['合格率|良品率|rate|ratio'], title: '各产线合格率对比' },
      { chartType: 'line', xFieldHint: '日期|月|date|time', yFieldHints: ['合格率|良品率|rate'], title: '合格率趋势' },
    ],
    kpiHints: ['合格率', '不良率', '批次数'],
  },
  {
    id: 'food-inventory',
    name: '库存周转分析',
    category: '食品-仓储',
    description: '原料及成品库存周转效率',
    chartPlan: [
      { chartType: 'waterfall', xFieldHint: '物料|品类|material', yFieldHints: ['金额|库存|stock|amount'], title: '库存金额分布' },
      { chartType: 'combination', xFieldHint: '物料|品类|material', yFieldHints: ['周转天数|周转率|turnover', '库存量|stock'], title: '周转率 vs 库存量' },
    ],
    kpiHints: ['周转天数', '库存金额', '周转率'],
  },
  {
    id: 'food-sales-region',
    name: '销售区域对比',
    category: '食品-销售',
    description: '不同销售区域的业绩对比',
    chartPlan: [
      { chartType: 'bar', xFieldHint: '区域|省|地区|城市|region', yFieldHints: ['销售额|收入|revenue|sales'], title: '区域销售额对比' },
      { chartType: 'pie', xFieldHint: '区域|省|地区|region', yFieldHints: ['销售额|收入|revenue'], title: '区域销售贡献' },
      { chartType: 'radar', xFieldHint: '区域|省|地区|region', yFieldHints: ['销售额|利润|客户数|revenue|profit'], title: '区域综合表现' },
    ],
    kpiHints: ['总销售额', '区域数', '增长率'],
  },
  {
    id: 'food-expense',
    name: '费用结构分析',
    category: '食品-财务',
    description: '费用科目结构及预算执行分析',
    chartPlan: [
      { chartType: 'waterfall', xFieldHint: '科目|项目|费用|item|expense', yFieldHints: ['金额|amount|费用'], title: '费用结构瀑布图' },
      { chartType: 'pie', xFieldHint: '科目|项目|费用|item', yFieldHints: ['金额|amount|费用'], title: '费用占比' },
      { chartType: 'gauge', xFieldHint: '科目|项目|item', yFieldHints: ['费用率|比率|ratio|rate'], title: '费用率仪表' },
    ],
    kpiHints: ['费用率', '预算达成率', '总费用'],
  },
];

/**
 * Map user data columns to a template's expected fields via fuzzy keyword matching.
 */
export function mapColumnsToTemplate(
  data: Record<string, unknown>[],
  template: FoodTemplate,
  labelField: string
): ChartPlanItem[] | null {
  if (!data.length) return null;
  const allKeys = Object.keys(data[0]);

  function findColumn(hint: string): string | null {
    const patterns = hint.split('|');
    for (const p of patterns) {
      const exact = allKeys.find(k => k === p);
      if (exact) return exact;
    }
    for (const p of patterns) {
      const match = allKeys.find(k => k.toLowerCase().includes(p.toLowerCase()));
      if (match) return match;
    }
    return null;
  }

  function findNumericColumns(hints: string[]): string[] {
    const found: string[] = [];
    for (const hint of hints) {
      const col = findColumn(hint);
      if (col) found.push(col);
    }
    if (found.length === 0) {
      for (const k of allKeys) {
        if (k === labelField) continue;
        const sampleVals = data.slice(0, 5).map(r => r[k]);
        if (sampleVals.some(v => typeof v === 'number' || !isNaN(Number(v)))) {
          found.push(k);
          if (found.length >= 2) break;
        }
      }
    }
    return found;
  }

  const plans: ChartPlanItem[] = [];

  for (const tplChart of template.chartPlan) {
    const xField = findColumn(tplChart.xFieldHint) || labelField;
    const yFields = findNumericColumns(tplChart.yFieldHints);
    if (!xField || yFields.length === 0) continue;

    const chartData = data.filter(row => row[xField] != null).slice(0, 30);
    if (chartData.length < 2) continue;

    plans.push({
      chartType: tplChart.chartType,
      data: chartData,
      xField,
      yFields,
      title: tplChart.title,
    });
  }

  return plans.length > 0 ? plans : null;
}
