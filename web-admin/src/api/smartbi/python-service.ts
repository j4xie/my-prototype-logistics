/**
 * SmartBI API - Python Service Module
 * Direct Python service calls: chart build, insights, forecast, statistical analysis.
 */
import {
  pythonFetch,
  type AnalysisResult,
  type StatisticalResult,
  type CorrelationResult,
  type ColumnSummary,
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
    console.error('smartRecommendChart 失败:', error);
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
    return {
      success: result.success,
      charts: (result.charts || []).map((c: Record<string, unknown>) => ({
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
 */
export async function quickSummary(data: unknown[], signal?: AbortSignal): Promise<{
  success: boolean;
  rowCount: number;
  columnCount: number;
  columns: ColumnSummary[];
}> {
  try {
    return await pythonFetch('/api/insight/quick-summary', {
      method: 'POST',
      body: JSON.stringify(data),
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
