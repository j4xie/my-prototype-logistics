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

/**
 * Validate fetch response status — throws on non-OK responses
 */
async function assertOk(response: Response, label: string): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${label}: HTTP ${response.status} ${response.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
  }
}

// ========== Concurrency Limiter (Phase 2.1) ==========
class ConcurrencyLimiter {
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
const enrichmentLimiter = new ConcurrencyLimiter(3);

// ========== AbortController Registry (Phase audit) ==========
const activeControllers = new Map<string, AbortController>();

function getAbortSignal(key: string): { signal: AbortSignal; cleanup: () => void } {
  // Cancel any previous request with the same key
  const existing = activeControllers.get(key);
  if (existing) existing.abort();
  const controller = new AbortController();
  activeControllers.set(key, controller);
  return {
    signal: controller.signal,
    cleanup: () => activeControllers.delete(key)
  };
}

export function abortSmartBIRequest(key: string): void {
  const controller = activeControllers.get(key);
  if (controller) {
    controller.abort();
    activeControllers.delete(key);
  }
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

// ==================== Python SmartBI 直连 API ====================

/**
 * Python SmartBI 服务 URL
 * 开发环境: 通过 Vite proxy (/smartbi-api → localhost:8083/api) 解决跨域
 * 生产环境: 使用 VITE_SMARTBI_URL 直连
 */
const PYTHON_SMARTBI_URL = import.meta.env.VITE_SMARTBI_URL || '/smartbi-api';

/** Shared headers for all Python service fetch calls */
const PYTHON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Internal-Secret': import.meta.env.VITE_PYTHON_SECRET || 'cretas-internal-2026',
};

/**
 * AI 洞察结构
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
 * KPI 数据结构
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
 * 图表配置结构
 */
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'waterfall' | 'radar' | 'gauge' | 'scatter' | 'area' | 'bar_horizontal' | 'combination';
  title?: string;
  option: Record<string, unknown>;
}

/**
 * 分析结果结构
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
 * 上传并分析 Excel 文件 (完整流程)
 *
 * 通过 Java 后端执行完整流程：
 * 1. Java 调用 Python auto-parse 解析文件
 * 2. Java 持久化数据到 PostgreSQL
 * 3. 生成 AI 洞察和图表推荐
 *
 * 修复: 2026-01-27 - 改为调用 Java API，确保数据持久化到 PostgreSQL
 */
export async function uploadAndAnalyze(file: File, options?: {
  sheetIndex?: number;
  autoConfirm?: boolean;
  dataType?: string;
}): Promise<{
  success: boolean;
  parseResult: {
    row_count: number;
    headers: string[];
    preview_data: Record<string, unknown>[];
    field_mappings?: Array<{ original: string; standard: string }>;
    table_type?: string;
    sheet_name?: string;
  };
  analysis?: AnalysisResult;
  chartRecommendations?: ChartConfig[];
  uploadId?: number;
  error?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.sheetIndex !== undefined) {
    formData.append('sheetIndex', String(options.sheetIndex));
  }
  if (options?.autoConfirm !== undefined) {
    formData.append('autoConfirm', String(options.autoConfirm));
  }
  if (options?.dataType) {
    formData.append('dataType', options.dataType);
  }

  try {
    // 调用 Java 后端完整上传流程 (会自动持久化到 PostgreSQL)
    const response = await request.post(`${getSmartBIBasePath()}/upload-and-analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 分钟超时
    });

    // Java API 返回格式
    const result = response.data || response;

    if (!result.success) {
      return {
        success: false,
        parseResult: { row_count: 0, headers: [], preview_data: [] },
        error: result.message || '上传分析失败'
      };
    }

    // 转换 Java 返回格式为前端期望的格式
    const parseResponse = result.parseResult || {};
    return {
      success: true,
      parseResult: {
        row_count: parseResponse.rowCount || 0,
        headers: parseResponse.headers || [],
        preview_data: parseResponse.previewData || [],
        field_mappings: parseResponse.fieldMappings?.map((m: { originalColumn: string; standardField: string }) => ({
          original: m.originalColumn,
          standard: m.standardField
        })),
        table_type: result.detectedDataType,
        sheet_name: parseResponse.sheetName
      },
      analysis: {
        success: true,
        answer: result.aiAnalysis,
        insights: [],
        charts: result.chartConfig ? [result.chartConfig] : []
      },
      chartRecommendations: result.recommendedTemplates?.map((t: { chartType: string; templateCode: string; description: string }) => ({
        type: t.chartType?.toLowerCase() || 'bar',
        title: t.description || t.templateCode,
        templateCode: t.templateCode
      })) || [],
      uploadId: result.uploadId
    };
  } catch (error) {
    console.error('uploadAndAnalyze 失败:', error);
    return {
      success: false,
      parseResult: { row_count: 0, headers: [], preview_data: [] },
      error: error instanceof Error ? error.message : '上传分析失败'
    };
  }
}

/**
 * Chat 分析 (支持工具调用)
 */
export async function chatAnalysis(params: {
  query: string;
  data?: unknown[];
  fields?: Array<{ original: string; standard: string }>;
  table_type?: string;
  uploadId?: string;
  sheet_id?: string;
}): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chat/general-analysis`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({
        query: params.query,
        data: params.data,
        fields: params.fields,
        table_type: params.table_type,
        sheet_id: params.sheet_id ?? null
      })
    });
    await assertOk(response, 'chatAnalysis');
    return response.json();
  } catch (error) {
    console.error('chatAnalysis 失败:', error);
    const errMsg = error instanceof Error ? error.message : 'Chat 分析请求失败';
    return {
      success: false,
      error: errMsg
    };
  }
}

/**
 * 下钻分析
 */
export async function drillDownAnalysis(params: {
  dimension: string;
  measures: string[];
  data: unknown[];
  fields: Array<{ original: string; standard: string }>;
  filterValue?: string;
}): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chat/drill-down`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify(params)
    });
    await assertOk(response, 'drillDownAnalysis');
    return response.json();
  } catch (error) {
    console.error('drillDownAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '下钻分析请求失败'
    };
  }
}

/**
 * 行业基准对比
 */
export async function benchmarkAnalysis(params: {
  metrics: Record<string, number>;
  industry: string;
}): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chat/benchmark`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify(params)
    });
    await assertOk(response, 'benchmarkAnalysis');
    return response.json();
  } catch (error) {
    console.error('benchmarkAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '基准对比请求失败'
    };
  }
}

/**
 * 图表下钻分析 — 点击图表数据点后调用
 * 调用 Python /api/chat/drill-down 端点
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
  // P4: Multi-level drill-down
  available_dimensions?: string[];
  hierarchy?: { type: string; levels: string[]; current_level: number; max_level: number };
  breadcrumb?: Array<{ dimension: string; value: string }>;
  current_level?: number;
  max_level?: number;
}

export async function chartDrillDown(params: {
  uploadId: number;
  sheetName: string;
  dimension: string;
  filterValue: string;
  measures: string[];
  data: Record<string, unknown>[];
  // P4: Multi-level drill-down
  hierarchyType?: string;
  currentLevel?: number;
  breadcrumb?: Array<{ dimension: string; value: string }>;
}): Promise<DrillDownResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chat/drill-down`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({
        sheet_id: `upload_${params.uploadId}_${params.sheetName}`,
        dimension: params.dimension,
        filter_value: params.filterValue,
        measures: params.measures,
        data: params.data,
        hierarchy_type: params.hierarchyType,
        current_level: params.currentLevel,
        breadcrumb: params.breadcrumb
      })
    });
    await assertOk(response, 'chartDrillDown');
    const result = await response.json();

    // Generate AI insight if drill-down succeeded
    let aiInsight: string | undefined;
    if (result.success && result.result?.data?.length) {
      const insightRes = await generateInsights({
        data: result.result.data,
        analysisContext: `下钻分析: 维度="${params.dimension}", 筛选值="${params.filterValue}", 报表="${params.sheetName}"`,
        maxInsights: 3
      });
      if (insightRes.success && insightRes.insights?.length) {
        aiInsight = insightRes.insights
          .map(i => `**${i.type}**: ${i.text}${i.recommendation ? `\n建议: ${i.recommendation}` : ''}`)
          .join('\n\n');
      }
    }

    return {
      success: result.success,
      result: result.result,
      chartConfig: result.chart_config,
      aiInsight,
      error: result.error,
      available_dimensions: result.available_dimensions,
      hierarchy: result.hierarchy,
      breadcrumb: result.breadcrumb,
      current_level: result.current_level,
      max_level: result.max_level,
    };
  } catch (error) {
    console.error('chartDrillDown 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '下钻分析请求失败'
    };
  }
}

/**
 * 跨 Sheet 综合分析
 * 调用 Python /api/smartbi/cross-sheet-analysis 端点
 */
export interface CrossSheetResult {
  success: boolean;
  kpiComparison?: Array<{ sheetName: string; kpis: Record<string, number> }>;
  charts?: Array<{ chartType: string; title: string; config: Record<string, unknown> }>;
  aiSummary?: string;
  error?: string;
}

export async function crossSheetAnalysis(params: {
  uploadIds: number[];
  sheetNames: string[];
}): Promise<CrossSheetResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/cross-sheet-analysis`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({
        upload_ids: params.uploadIds,
        sheet_names: params.sheetNames
      })
    });
    await assertOk(response, 'crossSheetAnalysis');
    return response.json();
  } catch (error) {
    console.error('crossSheetAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '综合分析请求失败'
    };
  }
}

/**
 * YoY 同比分析
 * 调用 Python /api/smartbi/yoy-comparison 端点
 */
export interface YoYComparisonItem {
  label: string;
  current_value: number;
  previous_value: number;
  yoy_growth: number | null;
  category: string;
}

export interface YoYResult {
  success: boolean;
  current_upload_id: number;
  compare_upload_id?: number;
  current_period?: string;
  compare_period?: string;
  comparison: YoYComparisonItem[];
  summary?: Record<string, number>;
  error?: string;
}

export async function yoyComparison(params: {
  uploadId: number;
  compareUploadId?: number;
}): Promise<YoYResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/yoy-comparison`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({
        upload_id: params.uploadId,
        compare_upload_id: params.compareUploadId
      })
    });
    await assertOk(response, 'yoyComparison');
    return response.json();
  } catch (error) {
    console.error('yoyComparison failed:', error);
    return {
      success: false,
      current_upload_id: params.uploadId,
      comparison: [],
      error: error instanceof Error ? error.message : 'YoY comparison failed'
    };
  }
}

/**
 * 图表构建
 */
export async function buildChart(params: {
  chartType: string;
  data: unknown[];
  xField?: string;
  yFields?: string[];
  title?: string;
  signal?: AbortSignal;
}): Promise<{ success: boolean; option?: Record<string, unknown>; error?: string }> {
  try {
    const { signal, ...body } = params;
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chart/build`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify(body),
      signal
    });
    await assertOk(response, 'buildChart');
    const result = await response.json();
    // Python returns { config: {...} }, map to { option: {...} } for ECharts
    return { success: result.success, option: result.config, error: result.error };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.error('buildChart 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '图表构建请求失败'
    };
  }
}

/**
 * 图表推荐 - 根据数据自动推荐最佳图表类型
 */
export async function recommendChart(data: unknown[], signal?: AbortSignal): Promise<{
  success: boolean;
  recommendations?: Array<{ chartType: string; reason?: string; xField?: string; yFields?: string[]; priority: number }>;
  dataInfo?: { rowCount?: number; numericColumns: string[]; categoricalColumns: string[]; dateColumns: string[] };
  error?: string;
}> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chart/recommend`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({ data, fields: null }),
      signal
    });
    await assertOk(response, 'recommendChart');
    return response.json();
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
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chart/smart-recommend`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({
        data: params.data,
        sheetName: params.sheetName,
        context: params.context,
        scenario: params.scenario || 'general',
        maxRecommendations: params.maxRecommendations || 7,
        excludeTypes: params.excludeTypes
      }),
      signal
    });
    await assertOk(response, 'smartRecommendChart');
    const result = await response.json();
    const data = result.data || result;
    return {
      success: result.success ?? true,
      recommendations: data.recommendations,
      diversityScore: data.diversityScore,
      method: data.method,
      dataInfo: data.dataInfo,
      error: result.message
    };
  } catch (error) {
    console.error('smartRecommendChart 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'LLM 图表推荐请求失败'
    };
  }
}

/**
 * AI 洞察生成 - 基于数据生成分析洞察
 */
export async function generateInsights(params: {
  data: unknown[];
  analysisContext?: string;
  maxInsights?: number;
  signal?: AbortSignal;
}): Promise<{
  success: boolean;
  insights?: Array<{ type: string; text: string; recommendation?: string; sentiment?: string; importance?: number }>;
  error?: string;
}> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/insight/generate`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({
        data: params.data,
        analysisContext: params.analysisContext,
        maxInsights: params.maxInsights || 5
      }),
      signal: params.signal
    });
    await assertOk(response, 'generateInsights');
    return response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.error('generateInsights 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI 洞察生成请求失败'
    };
  }
}

/**
 * T1.1: SSE streaming version of generateInsights
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
      headers: PYTHON_HEADERS,
      body: JSON.stringify({
        data: params.data,
        analysisContext: params.analysisContext,
        maxInsights: params.maxInsights || 5
      }),
      signal: params.signal
    });
    await assertOk(response, 'generateInsightsStream');

    const reader = response.body?.getReader();
    if (!reader) {
      // console.warn('[SSE] No reader available, falling back to non-streaming');
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
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
    // Stream ended without 'done' event
    // console.warn('[SSE] Stream ended without done event');
    return { success: false, error: 'Stream ended without result', _streamingUsed: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.warn('[SSE] generateInsightsStream failed, falling back:', error);
    const fallback = await generateInsights(params);
    return { ...fallback, _streamingUsed: false };
  }
}

// ==================== 智能图表标题 + KPI 选择 ====================

/**
 * 根据图表类型和字段名生成语义化标题
 * 输出人性化标题，避免原始列名暴露
 * "行次 - 2025-01-01, 2025-02-01 对比" → "各项目1-2月对比"
 */
export function generateChartTitle(chartType: string, xField: string, yFields: string[]): string {
  const xLabel = humanizeColumnName(xField);

  // Check if yFields are date columns → compress to range
  const isDateY = yFields.length > 0 && yFields.every(f => /^\d{4}-\d{2}/.test(f) || /^\d{1,2}月$/.test(f));

  let yLabel: string;
  if (isDateY) {
    yLabel = compressMonthRange(yFields);
  } else if (yFields.length === 1) {
    yLabel = humanizeColumnName(yFields[0]);
  } else if (yFields.length <= 2) {
    yLabel = yFields.map(humanizeColumnName).join('、');
  } else {
    yLabel = `${yFields.length}项指标`;
  }

  const cap = (s: string) => s.length > 30 ? s.slice(0, 27) + '...' : s;

  switch (chartType) {
    case 'line':
      if (xLabel === '月份' || xField === '月份') return cap(`${yLabel} 月度趋势`);
      return cap(isDateY ? `各${xLabel}${yLabel}趋势` : `${yLabel} 变化趋势`);
    case 'bar':
      if (xLabel === '月份' || xField === '月份') return cap(`${yLabel} 月度对比`);
      return cap(isDateY ? `各${xLabel}${yLabel}对比` : (xLabel ? `各${xLabel}${yLabel}对比` : `${yLabel} 对比分析`));
    case 'pie':
      return cap(`${yLabel} 构成占比`);
    case 'waterfall':
      return cap(`${yLabel} 增减分析`);
    case 'scatter':
      return cap(yFields.length >= 1 && xField
        ? `${xLabel} vs ${humanizeColumnName(yFields[0])}`
        : '散点分布');
    case 'area':
      return cap(xField === '月份' ? `${yLabel} 累计趋势` : `${yLabel} 面积分布`);
    case 'combination':
      return cap(`${yLabel} 综合对比`);
    case 'radar':
      return '多维度对比分析';
    case 'bar_horizontal':
      return cap(`${yLabel} 排行`);
    case 'pareto':
      return cap(`${yLabel} 帕累托分析 (80/20)`);
    case 'boxplot':
      return cap(`${yLabel} 分布箱线图`);
    case 'funnel':
      return cap(`${yLabel} 漏斗分析`);
    case 'nested_donut':
      return cap(`${yLabel} 层级占比`);
    case 'correlation_matrix':
      return cap(`${yLabel} 相关性矩阵`);
    default:
      return cap(`${yLabel} 分析`);
  }
}

/**
 * 中文财务关键词权重表 — 用于 KPI 智能选择
 */
const KPI_KEYWORD_WEIGHTS: Record<string, { weight: number; status: 'success' | 'warning' | 'danger' | 'info' }> = {
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

/**
 * 智能 KPI 提取 — 替代旧版 getTopKPIs
 *
 * 策略：
 * 1. 按中文关键词匹配重要指标
 * 2. 月度数据计算趋势方向 + 变化百分比
 * 3. 生成 sparkline 采样数据
 * 4. 设置状态颜色
 * 5. 回退：取 sum 最大的列
 */
export interface SmartKPI {
  title: string;
  value: number | string;
  unit: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  changeRate?: number;  // Phase 3.5: period-over-period change %
  status: 'success' | 'warning' | 'danger' | 'info' | 'default';
  displayMode: 'default' | 'sparkline';
  sparklineData: number[];
  benchmarkLabel?: string;  // P1: industry benchmark label
  benchmarkGap?: number;    // P1: gap vs benchmark (pp)
}

export function getSmartKPIs(
  kpiSummary: { rowCount: number; columnCount: number; columns: ColumnSummary[] },
  financialMetrics?: FinancialMetrics | null
): SmartKPI[] {
  const numericTypes = ['int64', 'float64', 'numeric', 'number', 'int32', 'float32'];
  const numericCols = (kpiSummary.columns || []).filter(
    c => numericTypes.includes(c.type) && c.sum != null
  );

  if (numericCols.length === 0) {
    return [{
      title: '数据行数',
      value: kpiSummary.rowCount,
      unit: '行',
      status: 'info',
      displayMode: 'default',
      sparklineData: []
    }];
  }

  // ========== Phase 1: Financial ratio KPIs from computed metrics ==========
  const ratioKPIs: SmartKPI[] = [];

  if (financialMetrics) {
    // Revenue KPI with MoM trend
    if (financialMetrics.revenue) {
      const rev = financialMetrics.revenue.total;
      const { displayValue, unit } = formatLargeNumber(rev);
      const lastMom = financialMetrics.mom?.filter(m => m.change !== null).slice(-1)[0];
      ratioKPIs.push({
        title: '营业收入',
        value: displayValue,
        unit,
        trend: lastMom?.change != null ? (lastMom.change > 0 ? 'up' : lastMom.change < 0 ? 'down' : 'flat') : undefined,
        trendValue: lastMom?.change != null ? `环比${lastMom.change > 0 ? '+' : ''}${lastMom.change.toFixed(1)}%` : undefined,
        changeRate: lastMom?.change ?? undefined,
        status: 'success',
        displayMode: financialMetrics.monthlyRevenue && financialMetrics.monthlyRevenue.length >= 2 ? 'sparkline' : 'default',
        sparklineData: financialMetrics.monthlyRevenue || [],
      });
    }

    // Gross margin KPI
    if (financialMetrics.grossMargin != null) {
      const gap = financialMetrics.gaps['grossMargin'] ?? 0;
      const isHealthy = gap >= 0;
      ratioKPIs.push({
        title: '毛利率',
        value: (financialMetrics.grossMargin * 100).toFixed(1),
        unit: '%',
        trendValue: `行业${(financialMetrics.industryBenchmark.grossMargin * 100).toFixed(0)}%`,
        status: isHealthy ? 'success' : gap > -0.05 ? 'warning' : 'danger',
        displayMode: 'default',
        sparklineData: [],
        benchmarkLabel: `行业均值${(financialMetrics.industryBenchmark.grossMargin * 100).toFixed(0)}%`,
        benchmarkGap: gap * 100,
      });
    }

    // Net margin KPI
    if (financialMetrics.netMargin != null) {
      const gap = financialMetrics.gaps['netMargin'] ?? 0;
      const isHealthy = gap >= 0;
      ratioKPIs.push({
        title: '净利率',
        value: (financialMetrics.netMargin * 100).toFixed(1),
        unit: '%',
        trendValue: `行业${(financialMetrics.industryBenchmark.netMargin * 100).toFixed(0)}%`,
        status: isHealthy ? 'success' : financialMetrics.netMargin >= 0 ? 'warning' : 'danger',
        displayMode: financialMetrics.monthlyNetProfit && financialMetrics.monthlyNetProfit.length >= 2 ? 'sparkline' : 'default',
        sparklineData: financialMetrics.monthlyNetProfit || [],
        benchmarkLabel: `行业均值${(financialMetrics.industryBenchmark.netMargin * 100).toFixed(0)}%`,
        benchmarkGap: gap * 100,
      });
    }

    // Net profit KPI
    if (financialMetrics.netProfit && ratioKPIs.length < 4) {
      const np = financialMetrics.netProfit.total;
      const { displayValue, unit } = formatLargeNumber(np);
      ratioKPIs.push({
        title: '净利润',
        value: displayValue,
        unit,
        status: np >= 0 ? 'success' : 'danger',
        displayMode: financialMetrics.monthlyNetProfit && financialMetrics.monthlyNetProfit.length >= 2 ? 'sparkline' : 'default',
        sparklineData: financialMetrics.monthlyNetProfit || [],
      });
    }

    // Expense ratio KPI
    if (financialMetrics.expenseRatio != null && ratioKPIs.length < 4) {
      ratioKPIs.push({
        title: '费用率',
        value: (financialMetrics.expenseRatio * 100).toFixed(1),
        unit: '%',
        trendValue: `基准${(financialMetrics.industryBenchmark.expenseRatio * 100).toFixed(0)}%`,
        status: financialMetrics.expenseRatio <= financialMetrics.industryBenchmark.expenseRatio ? 'success' : 'warning',
        displayMode: 'default',
        sparklineData: [],
      });
    }
  }

  // If financial metrics provided enough KPIs, use those
  if (ratioKPIs.length >= 3) {
    return ratioKPIs.slice(0, 4);
  }

  // ========== Phase 2: Column-based KPIs (original logic, as fallback/supplement) ==========

  // 扩展列类型（Python quick-summary 返回的额外字段）
  type ExtendedColumn = ColumnSummary & { sparkline?: number[]; trend?: string; trendPercent?: number };

  interface ScoredCol {
    col: ExtendedColumn;
    score: number;
    matchedKeyword: string;
    status: 'success' | 'warning' | 'danger' | 'info' | 'default';
  }
  const scored: ScoredCol[] = numericCols.map(col => {
    const extCol = col as ExtendedColumn;
    let score = 0;
    let matchedKeyword = '';
    let status: 'success' | 'warning' | 'danger' | 'info' | 'default' = 'default';

    for (const [keyword, config] of Object.entries(KPI_KEYWORD_WEIGHTS)) {
      if (col.name.includes(keyword)) {
        score += config.weight;
        matchedKeyword = keyword;
        status = config.status;
        break;
      }
    }

    const absSum = Math.abs(col.sum || 0);
    if (absSum > 0) score += Math.min(Math.log10(absSum + 1) * 5, 30);
    if (extCol.trend) score += 10;

    return { col: extCol, score, matchedKeyword, status };
  });

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate: skip columns already covered by ratio KPIs
  const coveredNames = new Set(ratioKPIs.map(k => k.title));
  const remaining = scored.filter(s => !coveredNames.has(s.col.name));

  const slotsNeeded = 4 - ratioKPIs.length;
  const topN = remaining.slice(0, slotsNeeded);

  const columnKPIs: SmartKPI[] = topN.map(({ col, status }) => {
    const val = col.sum || 0;
    const extCol = col;

    const { displayValue, unit } = formatLargeNumber(val);

    let trendPct = extCol.trendPercent;
    // Fix 1+9: sparkline-based MoM, skip trailing zeros (empty/total rows)
    if (extCol.sparkline && extCol.sparkline.length >= 2) {
      const spark = extCol.sparkline;
      // Skip trailing zeros to find last meaningful data point
      let lastIdx = spark.length - 1;
      while (lastIdx > 0 && spark[lastIdx] === 0) lastIdx--;
      if (lastIdx >= 1) {
        const last = spark[lastIdx];
        const prev = spark[lastIdx - 1];
        if (prev !== 0) {
          trendPct = Math.round(((last - prev) / Math.abs(prev)) * 1000) / 10;
        } else {
          trendPct = last !== 0 ? 100 : 0;
        }
      } else {
        trendPct = 0;
      }
    }
    const trend: 'up' | 'down' | 'flat' | undefined =
      trendPct != null ? (trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'flat') : undefined;
    const trendValue = trendPct != null ? `${trendPct > 0 ? '+' : ''}${trendPct}%` : undefined;

    let finalStatus = status;
    if (finalStatus === 'default' && trend) {
      finalStatus = trend === 'up' ? 'success' : trend === 'down' ? 'danger' : 'info';
    }

    return {
      title: humanizeColumnName(col.name),
      value: displayValue,
      unit,
      trend,
      trendValue,
      changeRate: trendPct != null ? trendPct : undefined,
      status: finalStatus,
      displayMode: (extCol.sparkline && extCol.sparkline.length >= 2 ? 'sparkline' : 'default') as 'sparkline' | 'default',
      sparklineData: extCol.sparkline || []
    };
  });

  return [...ratioKPIs, ...columnKPIs].slice(0, 4);
}

/**
 * 格式化大数值为显示值和单位
 */
function formatLargeNumber(val: number): { displayValue: string; unit: string } {
  if (Math.abs(val) >= 1e8) return { displayValue: (val / 1e8).toFixed(1), unit: '亿' };
  if (Math.abs(val) >= 1e4) return { displayValue: (val / 1e4).toFixed(1), unit: '万' };
  if (Number.isInteger(val)) return { displayValue: val.toLocaleString(), unit: '' };
  return { displayValue: val.toFixed(2), unit: '' };
}

// ==================== 财务指标预计算 ====================

/**
 * 中文财务关键词 → 行数据匹配
 */
interface FinancialRow {
  label: string;
  values: Record<string, number>;
  total: number;
}

/**
 * 财务指标计算结果
 */
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
 * 预计算财务指标 — 送给 LLM 更好的"食材"
 * 从利润表数据中识别关键行，计算比率指标、环比变化、行业对标
 */
export function computeFinancialMetrics(
  data: Record<string, unknown>[],
  monthlyColumns: string[],
  labelField: string
): FinancialMetrics | null {
  if (!data.length) return null;

  const keywordMap: Array<{ keywords: string[]; field: keyof Pick<FinancialMetrics, 'revenue' | 'cost' | 'grossProfit' | 'netProfit'> }> = [
    { keywords: ['营业收入', '主营业务收入'], field: 'revenue' },
    { keywords: ['营业成本', '主营业务成本'], field: 'cost' },
    { keywords: ['毛利润', '毛利'], field: 'grossProfit' },
    { keywords: ['净利润'], field: 'netProfit' },
  ];
  const expenseKeywords = ['销售费用', '管理费用', '财务费用', '研发费用'];
  const allFinancialKeywords = [
    ...keywordMap.flatMap(m => m.keywords),
    ...expenseKeywords,
  ];

  // Auto-detect label column by scanning for financial keywords in row values.
  // Always run detection if the passed labelField doesn't contain financial keywords
  // (handles numeric/merged-cell column names where detectLabelField picks the wrong column).
  let effectiveLabelField = labelField;
  const sample = data.slice(0, Math.min(data.length, 80));

  // Validate that the passed labelField actually contains financial keywords
  if (effectiveLabelField) {
    let labelFieldMatches = 0;
    for (const row of sample) {
      const val = String(row[effectiveLabelField] ?? '').replace(/[\s\u3000]+/g, '');
      if (val && allFinancialKeywords.some(kw => val.includes(kw))) {
        labelFieldMatches++;
      }
    }
    if (labelFieldMatches < 2) {
      effectiveLabelField = ''; // Force auto-detection
    }
  }

  if (!effectiveLabelField) {
    const allKeys = Object.keys(data[0] || {});
    let bestCol = '';
    let bestMatches = 0;
    for (const key of allKeys) {
      let matchCount = 0;
      for (const row of sample) {
        const val = String(row[key] ?? '').replace(/[\s\u3000]+/g, '');
        if (val && allFinancialKeywords.some(kw => val.includes(kw))) {
          matchCount++;
        }
      }
      if (matchCount > bestMatches) {
        bestMatches = matchCount;
        bestCol = key;
      }
    }
    // Need at least 2 financial keyword matches to be confident
    if (bestMatches >= 2) {
      effectiveLabelField = bestCol;
    }
  }

  if (!effectiveLabelField) return null;

  const result: FinancialMetrics = {
    expenses: [],
    industryBenchmark: { grossMargin: 0.30, netMargin: 0.05, expenseRatio: 0.20 },
    gaps: {},
  };

  // Scan rows for financial line items
  for (const row of data) {
    // Normalize full-width spaces (U+3000) and collapse whitespace for matching
    const rawLabel = String(row[effectiveLabelField] ?? '');
    const label = rawLabel.replace(/[\s\u3000]+/g, '').trim();
    if (!label) continue;

    // Collect numeric values for this row
    const values: Record<string, number> = {};
    let total = 0;
    for (const [key, val] of Object.entries(row)) {
      if (key === effectiveLabelField) continue;
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (!isNaN(num)) {
        values[key] = num;
        total += num;
      }
    }
    if (Object.keys(values).length === 0) continue;

    const finRow: FinancialRow = { label, values, total };

    // Match to financial categories
    for (const { keywords, field } of keywordMap) {
      if (keywords.some(kw => label.includes(kw)) && !result[field]) {
        (result as Record<string, unknown>)[field] = finRow;
        break;
      }
    }

    // Match expense rows
    if (expenseKeywords.some(kw => label.includes(kw))) {
      result.expenses.push(finRow);
    }
  }

  // Compute ratio metrics
  if (result.revenue && result.revenue.total !== 0) {
    const rev = Math.abs(result.revenue.total);

    if (result.cost) {
      result.grossMargin = (result.revenue.total - result.cost.total) / rev;
      result.gaps['grossMargin'] = result.grossMargin - result.industryBenchmark.grossMargin;
    }

    if (result.netProfit) {
      result.netMargin = result.netProfit.total / rev;
      result.gaps['netMargin'] = result.netMargin - result.industryBenchmark.netMargin;
    }

    if (result.expenses.length > 0) {
      const totalExpense = result.expenses.reduce((sum, e) => sum + e.total, 0);
      result.expenseRatio = totalExpense / rev;
      result.gaps['expenseRatio'] = result.expenseRatio - result.industryBenchmark.expenseRatio;
    }

    // Monthly revenue series for trend analysis
    if (monthlyColumns.length >= 2 && result.revenue) {
      result.monthlyRevenue = monthlyColumns.map(m => result.revenue!.values[m] ?? 0);
      result.mom = monthlyColumns.map((m, i) => {
        if (i === 0 || !result.monthlyRevenue) return { month: humanizeColumnName(m), change: null };
        const prev = result.monthlyRevenue[i - 1];
        const curr = result.monthlyRevenue[i];
        return {
          month: humanizeColumnName(m),
          change: prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null,
        };
      });
    }

    if (monthlyColumns.length >= 2 && result.netProfit) {
      result.monthlyNetProfit = monthlyColumns.map(m => result.netProfit!.values[m] ?? 0);
    }
  }

  // Only return if we found at least one key metric
  if (!result.revenue && !result.netProfit && result.expenses.length === 0) return null;
  return result;
}

/**
 * 将财务指标格式化为 LLM 可理解的上下文文本
 */
function formatFinancialContext(metrics: FinancialMetrics): string {
  const parts: string[] = ['预计算财务指标:'];

  const fmt = (val: number) => {
    if (Math.abs(val) >= 1e8) return `${(val / 1e8).toFixed(2)}亿`;
    if (Math.abs(val) >= 1e4) return `${(val / 1e4).toFixed(2)}万`;
    return val.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };

  if (metrics.revenue) parts.push(`- 营业收入: ${fmt(metrics.revenue.total)}`);
  if (metrics.cost) parts.push(`- 营业成本: ${fmt(metrics.cost.total)}`);
  if (metrics.grossProfit) parts.push(`- 毛利: ${fmt(metrics.grossProfit.total)}`);
  if (metrics.netProfit) parts.push(`- 净利润: ${fmt(metrics.netProfit.total)}`);
  for (const exp of metrics.expenses) {
    parts.push(`- ${exp.label}: ${fmt(exp.total)}`);
  }

  if (metrics.grossMargin != null) {
    const gap = metrics.gaps['grossMargin'];
    parts.push(`- 毛利率: ${(metrics.grossMargin * 100).toFixed(1)}% (行业参考30%, ${gap && gap >= 0 ? '高于' : '低于'}行业${Math.abs((gap ?? 0) * 100).toFixed(1)}pp)`);
  }
  if (metrics.netMargin != null) {
    const gap = metrics.gaps['netMargin'];
    parts.push(`- 净利率: ${(metrics.netMargin * 100).toFixed(1)}% (行业参考5%, ${gap && gap >= 0 ? '高于' : '低于'}行业${Math.abs((gap ?? 0) * 100).toFixed(1)}pp)`);
  }
  if (metrics.expenseRatio != null) {
    parts.push(`- 费用率: ${(metrics.expenseRatio * 100).toFixed(1)}% (行业参考20%)`);
  }

  if (metrics.mom && metrics.mom.length > 0) {
    const momParts = metrics.mom
      .filter(m => m.change !== null)
      .map(m => `${m.month}:${m.change! > 0 ? '+' : ''}${m.change!.toFixed(1)}%`);
    if (momParts.length > 0) {
      parts.push(`- 收入环比: ${momParts.join(', ')}`);
    }
  }

  return parts.join('\n');
}

// ==================== 多图表仪表板辅助函数 ====================

/**
 * 图表计划项
 */
export interface ChartPlanItem {
  chartType: string;
  data: Record<string, unknown>[];
  xField: string;
  yFields: string[];
  title: string;
  seriesField?: string;
  totalItems?: number;  // P1.3: total items before truncation (for "view more")
}

/**
 * 列统计摘要
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
}

/**
 * 结构化 AI 分析数据
 */
export interface StructuredAIData {
  executiveSummary: string;
  riskAlerts: Array<{ title: string; description: string; severity?: string; mitigation?: string }>;
  opportunities: Array<{ title: string; description: string; potential_impact?: string; action_required?: string }>;
  sensitivityAnalysis?: Array<{ factor: string; current_value: string; impact_description: string }>;
}

/**
 * Fallback: compute basic sensitivity analysis from financial metrics
 * when the LLM doesn't return sensitivity_analysis in its response
 */
function computeSensitivityFallback(fm: FinancialMetrics): StructuredAIData['sensitivityAnalysis'] {
  const items: NonNullable<StructuredAIData['sensitivityAnalysis']> = [];
  const rev = fm.revenue?.sum;
  const cost = fm.cost?.sum;
  const gm = fm.grossMargin;
  const nm = fm.netMargin;
  const np = fm.netProfit?.sum;

  if (rev && rev > 0 && np != null) {
    // Revenue sensitivity
    const revDrop10 = rev * 0.1;
    const newNp = (np - revDrop10);
    const npChange = np !== 0 ? ((newNp - np) / Math.abs(np) * 100) : 0;
    items.push({
      factor: '营业收入',
      current_value: `${(rev / 10000).toFixed(0)}万元`,
      impact_description: `收入下降10%（${(revDrop10/10000).toFixed(0)}万元），净利润预计从${(np/10000).toFixed(0)}万元降至${(newNp/10000).toFixed(0)}万元（${npChange.toFixed(1)}%）`
    });
  }

  if (cost && cost > 0 && rev && np != null) {
    // Cost sensitivity
    const costUp5 = cost * 0.05;
    const newNp = np - costUp5;
    items.push({
      factor: '营业成本',
      current_value: `${(cost / 10000).toFixed(0)}万元`,
      impact_description: `成本上升5%（+${(costUp5/10000).toFixed(0)}万元），净利润降至${(newNp/10000).toFixed(0)}万元，净利率降至${rev > 0 ? (newNp/rev*100).toFixed(1) : '?'}%`
    });
  }

  if (gm != null && gm > 0) {
    // Gross margin sensitivity (gm and benchmark are decimals, e.g. 0.20 = 20%)
    const bmGM = fm.industryBenchmark.grossMargin;
    const gmPct = gm * 100;
    const bmGMPct = bmGM * 100;
    const gapPct = (gm - bmGM) * 100;
    items.push({
      factor: '毛利率',
      current_value: `${gmPct.toFixed(1)}%`,
      impact_description: gapPct < 0
        ? `当前低于行业均值${bmGMPct.toFixed(0)}%达${Math.abs(gapPct).toFixed(1)}个百分点，每提升1个百分点可增加利润约${rev ? (rev * 0.01 / 10000).toFixed(0) : '?'}万元`
        : `当前高于行业均值${bmGMPct.toFixed(0)}%达${gapPct.toFixed(1)}个百分点，需关注价格竞争对毛利率的下行压力`
    });
  }

  if (fm.expenseRatio != null && rev && rev > 0) {
    // Expense ratio sensitivity (decimal values)
    const bmER = fm.industryBenchmark.expenseRatio;
    const totalExpense = fm.expenses.reduce((s, e) => s + (e.sum || 0), 0);
    if (totalExpense > 0) {
      const saving = totalExpense * 0.1;
      const erPct = fm.expenseRatio * 100;
      const bmERPct = bmER * 100;
      items.push({
        factor: '费用管控',
        current_value: `费用率${erPct.toFixed(1)}%`,
        impact_description: `费用压缩10%可节约${(saving/10000).toFixed(0)}万元，费用率从${erPct.toFixed(1)}%降至${(erPct * 0.9).toFixed(1)}%（行业${bmERPct.toFixed(0)}%）`
      });
    }
  }

  return items.length > 0 ? items : undefined as unknown as NonNullable<StructuredAIData['sensitivityAnalysis']>;
}

/**
 * 渐进式渲染回调 (P0: Progressive Rendering)
 * enrichSheetAnalysis 每完成一个阶段就通过此回调通知 Vue 组件更新 UI
 */
export interface EnrichProgress {
  phase: 'data' | 'kpi' | 'charts' | 'chart-single' | 'ai' | 'ai-streaming' | 'complete';
  partial: Partial<EnrichResult> & { aiStreamChunk?: string };
}

/**
 * enrichSheetAnalysis 返回结构（多图表 + KPI）
 */
export interface EnrichResult {
  success: boolean;
  cached?: boolean;          // true when loaded from persistent cache
  cachedAt?: string;         // ISO timestamp of when cache was saved
  charts?: Array<{ chartType: string; title: string; config: Record<string, unknown> }>;
  kpiSummary?: { rowCount: number; columnCount: number; columns: ColumnSummary[] };
  financialMetrics?: FinancialMetrics | null;  // P0.2: pre-computed financial ratios
  aiAnalysis?: string;
  structuredAI?: StructuredAIData;
  error?: string;
  chartConfig?: Record<string, unknown>; // 向后兼容 charts[0].config
  timings?: Record<string, number>; // Phase 0: performance instrumentation
  rawData?: Record<string, unknown>[]; // cleaned data for cross-filtering & export
  chartsTotal?: number; // P0: expected total chart count for progressive loading indicator
}

// ==================== Analysis Cache API ====================

/**
 * 从 Python 缓存获取已持久化的分析结果
 * 命中时 < 1s 返回完整 EnrichResult，避免 30-40s 重算
 */
export async function getCachedAnalysis(uploadId: number): Promise<EnrichResult | null> {
  try {
    const res = await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/analysis-cache/${uploadId}`, {
      headers: PYTHON_HEADERS,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.cached) {
      return {
        success: true,
        cached: true,
        cachedAt: data.cachedAt,
        charts: data.charts,
        kpiSummary: data.kpiSummary,
        aiAnalysis: data.aiAnalysis,
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
 * 保存分析结果到 Python 持久化缓存
 * enrichment 完成后异步调用，不阻塞 UI
 */
export async function saveAnalysisToCache(
  uploadId: number,
  factoryId: string,
  result: EnrichResult
): Promise<void> {
  try {
    await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/analysis-cache/${uploadId}`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
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
 * 删除缓存，强制下次重新 enrichment
 * "刷新分析" 按钮调用
 */
export async function invalidateAnalysisCache(uploadId: number): Promise<void> {
  try {
    await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/analysis-cache/${uploadId}`, {
      method: 'DELETE',
      headers: PYTHON_HEADERS,
    });
  } catch (e) {
    // console.warn('[Cache] Failed to invalidate cache:', e);
  }
}

/**
 * 清洗无意义列名：移除 Column_XX 自动命名列，清理全角空白
 */
export function renameMeaninglessColumns(data: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!data.length) return [];

  const allKeys = Object.keys(data[0]);
  // Column_XX 模式通常是 Excel 空列导致
  const meaninglessPattern = /^Column_\d+$/i;

  const keyMap = new Map<string, string>();
  const keysToKeep: string[] = [];

  const usedNames = new Set<string>();
  for (const key of allKeys) {
    if (meaninglessPattern.test(key)) continue; // 删除 Column_XX
    // 清理全角空格、多余空白
    let cleaned = key.replace(/[\u3000\u00A0]/g, '').replace(/\s+/g, '').trim();
    cleaned = cleaned || key;
    // 碰撞检测：如果清洗后名称已存在，加后缀
    if (usedNames.has(cleaned)) {
      let suffix = 2;
      while (usedNames.has(`${cleaned}_${suffix}`)) suffix++;
      cleaned = `${cleaned}_${suffix}`;
    }
    usedNames.add(cleaned);
    keyMap.set(key, cleaned);
    keysToKeep.push(key);
  }

  if (keysToKeep.length === allKeys.length && [...keyMap.entries()].every(([k, v]) => k === v)) {
    return data; // 无需清洗
  }

  return data.map(row => {
    const cleaned: Record<string, unknown> = {};
    for (const key of keysToKeep) {
      cleaned[keyMap.get(key)!] = row[key];
    }
    return cleaned;
  });
}

/**
 * 从月份列名中提取排序用的数值 (YYYYMM)
 */
function extractMonthSortKey(col: string): number {
  // YYYY-MM-DD or YYYY-MM
  const isoMatch = col.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return parseInt(isoMatch[1]) * 100 + parseInt(isoMatch[2]);
  // 2024年1月 / 2024年12月
  const cnFullMatch = col.match(/^(\d{4})年(\d{1,2})月$/);
  if (cnFullMatch) return parseInt(cnFullMatch[1]) * 100 + parseInt(cnFullMatch[2]);
  // 1月 ~ 12月 (assume current year for sorting)
  const cnShortMatch = col.match(/^(\d{1,2})月$/);
  if (cnShortMatch) return 9999 * 100 + parseInt(cnShortMatch[1]); // group together
  return 0;
}

/**
 * 检测月份列名（支持 YYYY-MM-DD, YYYY-MM, 1月~12月, 2024年1月 等）
 */
function detectMonthlyColumns(keys: string[]): string[] {
  const isoPattern = /^\d{4}-\d{2}(-\d{2})?$/;
  const cnFullPattern = /^\d{4}年\d{1,2}月$/;
  const cnShortPattern = /^\d{1,2}月$/;

  const monthCols = keys.filter(k =>
    isoPattern.test(k) || cnFullPattern.test(k) || cnShortPattern.test(k)
  );

  // 按月份数值排序（非字典序）
  return monthCols.sort((a, b) => extractMonthSortKey(a) - extractMonthSortKey(b));
}

/**
 * 格式化月份列名为显示标签
 * "2025-01-01" → "2025-01", "2024年3月" → "2024年3月", "3月" → "3月"
 */
function formatMonthLabel(col: string): string {
  // YYYY-MM-DD → YYYY-MM
  if (/^\d{4}-\d{2}-\d{2}$/.test(col)) return col.substring(0, 7);
  // YYYY-MM stays as is
  if (/^\d{4}-\d{2}$/.test(col)) return col;
  // Chinese patterns stay as is
  return col;
}

// ==================== 列名人性化 ====================

/**
 * 英文/技术列名 → 中文业务名映射
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
  'net_margin': '净利率',
  'expense': '费用',
  'expense_ratio': '费用率',
  'total': '合计',
  'amount': '金额',
  'quantity': '数量',
  'price': '单价',
  'unit_price': '单价',
  'sales': '销售额',
  'growth_rate': '增长率',
  'yoy_growth': '同比增长',
  'mom_growth': '环比增长',
  'operating_income': '营业收入',
  'operating_cost': '营业成本',
  'operating_expense': '营业费用',
  'admin_expense': '管理费用',
  'financial_expense': '财务费用',
  'total_revenue': '总收入',
  'total_cost': '总成本',
  'category': '类别',
  'department': '部门',
  'region': '区域',
  'product': '产品',
  'month': '月份',
  'year': '年份',
  'date': '日期',
  '__rowIndex': '序号',
  '行次': '项目',
};

/**
 * 将原始列名转换为人性化显示名
 * "2025-01-01" → "1月"
 * "2025-01-01_2" → "1月(累计)"
 * "actual_amount" → "实际金额"
 * "行次" → "项目"
 */
// T2.3 + T4.3: Memoization cache with LRU eviction (cap at 500 entries)
const _humanizeCache = new Map<string, string>();
const _HUMANIZE_CACHE_LIMIT = 500;
export function humanizeColumnName(col: string): string {
  const cached = _humanizeCache.get(col);
  if (cached !== undefined) return cached;
  // T4.3: Evict oldest entries when cache exceeds limit
  if (_humanizeCache.size >= _HUMANIZE_CACHE_LIMIT) {
    const firstKey = _humanizeCache.keys().next().value;
    if (firstKey !== undefined) _humanizeCache.delete(firstKey);
  }
  const result = _humanizeColumnNameImpl(col);
  _humanizeCache.set(col, result);
  return result;
}
function _humanizeColumnNameImpl(col: string): string {
  // Handle unnamed/placeholder column names from pandas merge artifacts
  if (/^Unnamed:\s*\d+$/i.test(col)) return `数据列${col.replace(/\D+/g, '')}`;
  // Pure numeric column names (e.g., "0", "1", "2")
  if (/^\d+$/.test(col.trim())) return `数据列${col.trim()}`;

  // Fix 6: Strip technical dedup suffixes like _2, _3 first
  let cleaned = col.replace(/_(\d+)$/, (match, num) => {
    if (/^\d{4}-\d{2}-\d{2}_\d+$/.test(col)) return match;
    const n = parseInt(num);
    if (n >= 2 && n <= 15) {
      return `(${n})`;
    }
    return '';
  });

  // Strip redundant prefixes
  cleaned = cleaned.replace(/^各[\u4e00-\u9fff]{2,6}中心\d{4}年/, '');
  cleaned = cleaned.replace(/^各[\u4e00-\u9fff]{2,6}及[\u4e00-\u9fff]{2,4}/, '');
  cleaned = cleaned.replace(/逆向验证/, '(验证)');
  cleaned = cleaned.replace(/^\d{4}年合计/, '年度合计');

  // 1. YYYY-MM-DD or YYYY-MM-DD_N patterns
  const dateMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:_(\d+))?$/);
  if (dateMatch) {
    const month = parseInt(dateMatch[2]);
    const suffix = dateMatch[4] ? `(${dateMatch[4]})` : '';
    return `${month}月${suffix}`;
  }
  // 2. YYYY-MM pattern
  const ymMatch = cleaned.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    return `${parseInt(ymMatch[2])}月`;
  }
  // 3. Exact match in lookup table
  if (COLUMN_NAME_MAP[cleaned]) return COLUMN_NAME_MAP[cleaned];
  // 4. Case-insensitive lookup
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
 * 将多个月份列名压缩为范围表示
 * ["1月", "2月", "3月"] → "1-3月"
 * ["2025-01", "2025-02", "2025-03"] → "1-3月"
 */
function compressMonthRange(fields: string[]): string {
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

  return fields.slice(0, 3).map(humanizeColumnName).join('、');
}

/**
 * 转置为时间序列：将"每月一列"转为"每月一行"
 * 支持 YYYY-MM-DD, YYYY-MM, 中文月份列名
 * 输入: [{ "项目": "营业收入", "2025-01-01": 876, "2025-02-01": 543 }]
 * 输出: [{ "月份": "2025-01", "营业收入": 876, ... }]
 */
function transposeForTimeSeries(
  data: Record<string, unknown>[],
  monthCols: string[],
  labelField: string
): Record<string, unknown>[] {
  if (!monthCols.length || !labelField) return [];

  // 取前 5 行（避免数据爆炸）
  const seriesRows = data.filter(row => row[labelField] != null).slice(0, 10);
  if (!seriesRows.length) return [];

  return monthCols.map(month => {
    const row: Record<string, unknown> = { '月份': formatMonthLabel(month) };
    for (const sr of seriesRows) {
      const label = String(sr[labelField]);
      const val = sr[month];
      row[label] = typeof val === 'number' ? val : (parseFloat(String(val)) || 0);
    }
    return row;
  });
}

/**
 * 前端检测真正的数值列（修复 Python 混合类型误判）
 * 当 Python 因 mixed types（如 "实际净利" 混在数值列中）将列误判为 object 时，
 * 前端扫描实际值来判断哪些列是数值列。
 */
function detectNumericColumns(
  data: Record<string, unknown>[],
  pythonNumericCols: string[],
  allKeys: string[]
): string[] {
  if (!data.length || !allKeys.length) return pythonNumericCols;

  const sampleSize = Math.min(data.length, 50);
  const sample = data.slice(0, sampleSize);
  const frontendCols: string[] = [];

  for (const key of allKeys) {
    let numericCount = 0;
    let nonNullCount = 0;
    for (const row of sample) {
      const val = row[key];
      if (val == null) continue;
      nonNullCount++;
      if (typeof val === 'number' && !isNaN(val)) {
        numericCount++;
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed !== '' && !isNaN(Number(trimmed))) {
          numericCount++;
        }
      }
    }
    // 超过 50% 的非空值是数字 → 视为数值列
    if (nonNullCount > 0 && numericCount / nonNullCount > 0.5) {
      frontendCols.push(key);
    }
  }

  // 合并去重：Python ∪ 前端扫描
  const merged = new Set([...pythonNumericCols, ...frontendCols]);
  return [...merged];
}

/**
 * 前端自行检测 labelField（分类/标签列）
 * 优先级：Python categoricalColumns[0] → 评分扫描 → 第一列文本检测 → 空
 */
function detectLabelField(
  data: Record<string, unknown>[],
  categoricalColumns: string[],
  numericColumns: string[],
  allKeys: string[]
): string {
  // 1. Python 已检测到分类列 → 检查是否真的是分类列（非数值）
  if (categoricalColumns.length > 0 && categoricalColumns[0]) {
    const candidate = categoricalColumns[0];
    // 验证：如果该列超过 50% 是数字，则不是真正的分类列
    const numSet = new Set(numericColumns);
    if (!numSet.has(candidate)) {
      const sampleSize = Math.min(data.length, 50);
      let numericCount = 0;
      let nonNullCount = 0;
      for (const row of data.slice(0, sampleSize)) {
        const val = row[candidate];
        if (val == null) continue;
        nonNullCount++;
        if (typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val.trim())))) {
          numericCount++;
        }
      }
      // 如果 >50% 是数字，跳过这个候选，继续扫描
      if (nonNullCount > 0 && numericCount / nonNullCount <= 0.5) {
        return candidate;
      }
    } else {
      return candidate;
    }
  }

  if (!data.length || !allKeys.length) return '';

  const numSet = new Set(numericColumns);
  const sampleSize = Math.min(data.length, 50);
  const sample = data.slice(0, sampleSize);

  // 中文标签列名模式
  const labelNamePattern = /项目|名称|类型|区域|部门|客户|产品|科目|摘要|品名|公司|分类|品牌|渠道|城市|省份|地区/;

  // 2. 评分扫描非数值列
  let bestCol = '';
  let bestScore = -Infinity;

  for (const key of allKeys) {
    if (numSet.has(key)) continue; // 跳过 Python 已认定的数值列

    // 统计字符串值占比
    let stringCount = 0;
    const uniqueVals = new Set<string>();
    for (const row of sample) {
      const val = row[key];
      if (val != null && typeof val === 'string' && val.trim() !== '') {
        stringCount++;
        uniqueVals.add(val.trim());
      }
    }
    const stringRatio = stringCount / sampleSize;
    if (stringRatio <= 0.3) continue; // 字符串太少，不适合做标签

    let score = stringRatio * 100;

    // 列名匹配中文标签模式 → +50
    if (labelNamePattern.test(key)) score += 50;

    // 是第一列 → 小加分（可能是序号列，不应过度加分）
    if (key === allKeys[0]) score += 10;
    // 非首列但列名匹配标签模式 → 额外加分（如"客户名称"在第二列）
    if (key !== allKeys[0] && labelNamePattern.test(key)) score += 15;

    // 高基数不适合 X 轴
    if (uniqueVals.size > 30) score -= 30;

    // 唯一值太少也不好
    if (uniqueVals.size < 2) score -= 50;

    if (score > bestScore) {
      bestScore = score;
      bestCol = key;
    }
  }

  if (bestCol) return bestCol;

  // 3. 检查第一列：财务报表第一列常为文本但 pandas 可能误判
  const firstKey = allKeys[0];
  if (firstKey) {
    const first10 = data.slice(0, 10);
    let textCount = 0;
    for (const row of first10) {
      const val = row[firstKey];
      if (val != null && typeof val === 'string' && val.trim() !== '' && isNaN(Number(val))) {
        textCount++;
      }
    }
    // 超过半数是非数字文本 → 可用
    if (textCount >= 5) return firstKey;
  }

  // 4. 真的找不到
  return '';
}

// T1.2 + T4.3: Chart plan structure cache with LRU eviction (cap at 50 entries)
const _chartPlanCache = new Map<string, ChartPlanItem[]>();
const _PLAN_CACHE_LIMIT = 50;

function getChartPlanCacheKey(cleanedData: Record<string, unknown>[], labelField: string, monthlyColumns: string[]): string {
  if (!cleanedData.length) return '';
  const colSig = Object.keys(cleanedData[0]).sort().join(',');
  return `${colSig}|${labelField}|${monthlyColumns.join(',')}|${cleanedData.length}`;
}

/**
 * 生成多图表方案 — 三阶段架构（3-5 张多样化图表）
 * Phase 1: 依赖 labelField 的核心策略
 * Phase 2: 多样化图表类型（需 labelField）
 * Phase 3: 不依赖 labelField 的保底策略
 */
function buildChartPlan(
  cleanedData: Record<string, unknown>[],
  recommendations: Array<{ chartType: string; xField?: string; yFields?: string[]; priority: number }>,
  dataInfo: { numericColumns: string[]; categoricalColumns: string[]; dateColumns: string[] },
  monthlyColumns: string[],
  labelField: string
): ChartPlanItem[] {
  const plans: ChartPlanItem[] = [];
  const usedTypes = new Set<string>();

  const numCols = dataInfo.numericColumns || [];

  // ========== Phase 1: 依赖 labelField 的核心策略 ==========

  // 策略 1: 月份列 → 时间趋势折线图
  if (monthlyColumns.length >= 2 && labelField) {
    const tsData = transposeForTimeSeries(cleanedData, monthlyColumns, labelField);
    if (tsData.length > 0) {
      const seriesKeys = Object.keys(tsData[0]).filter(k => k !== '月份');
      if (seriesKeys.length > 0) {
        plans.push({
          chartType: 'line',
          data: tsData,
          xField: '月份',
          yFields: seriesKeys.slice(0, 5),
          title: generateChartTitle('line', '月份', seriesKeys.slice(0, 5))
        });
        usedTypes.add('line');
      }
    }
  }

  // 策略 2: 分类柱状图
  if (labelField && numCols.length > 0 && !usedTypes.has('bar')) {
    const yFields = numCols.filter(c => c !== labelField).slice(0, 3);
    if (yFields.length > 0) {
      const filteredData = cleanedData.filter(row => row[labelField] != null);
      const chartData = filteredData.slice(0, 20);
      if (chartData.length > 0) {
        const isTruncated = filteredData.length > 20;
        const barTitle = isTruncated
          ? generateChartTitle('bar', labelField, yFields) + ' (前20项)'
          : generateChartTitle('bar', labelField, yFields);
        plans.push({
          chartType: 'bar',
          data: chartData,
          xField: labelField,
          yFields,
          title: barTitle,
          totalItems: isTruncated ? filteredData.length : undefined,
        });
        usedTypes.add('bar');
      }
    }
  }

  // 策略 3: 饼图/占比
  if (labelField && numCols.length > 0 && !usedTypes.has('pie')) {
    let valueField = numCols.find(c => /合计|总计|sum|total/i.test(c));
    if (!valueField) {
      valueField = monthlyColumns.length > 0
        ? monthlyColumns[monthlyColumns.length - 1]
        : numCols[0];
    }
    if (valueField) {
      const allPieData = cleanedData
        .filter(row => row[labelField] != null && row[valueField!] != null)
        .filter(row => { const v = Number(row[valueField!]); return !isNaN(v) && v > 0; });
      const pieData = allPieData.slice(0, 10);
      if (pieData.length >= 2) {
        const isTruncated = allPieData.length > 10;
        plans.push({
          chartType: 'pie',
          data: pieData,
          xField: labelField,
          yFields: [valueField],
          title: generateChartTitle('pie', labelField, [valueField]) + (isTruncated ? ` (前${pieData.length}项)` : ''),
          totalItems: isTruncated ? allPieData.length : undefined,
        });
        usedTypes.add('pie');
      }
    }
  }

  // 策略 4: 从 Python recommendations 中补充不同类型
  for (const rec of recommendations) {
    if (plans.length >= 7) break;
    if (usedTypes.has(rec.chartType)) continue;
    if (!rec.xField || !rec.yFields?.length) continue;

    const chartData = cleanedData.filter(row => row[rec.xField!] != null).slice(0, 30);
    if (chartData.length < 2) continue;

    plans.push({
      chartType: rec.chartType,
      data: chartData,
      xField: rec.xField,
      yFields: rec.yFields,
      title: generateChartTitle(rec.chartType, rec.xField!, rec.yFields!)
    });
    usedTypes.add(rec.chartType);
  }

  // 策略 5: 横向柱图（月度排行）
  if (plans.length < 7 && monthlyColumns.length > 0 && labelField && !usedTypes.has('bar_horizontal')) {
    const tsData = transposeForTimeSeries(cleanedData, monthlyColumns, labelField);
    if (tsData.length > 0) {
      const firstSeries = Object.keys(tsData[0]).find(k => k !== '月份');
      if (firstSeries) {
        const sorted = [...tsData].sort((a, b) => Number(b[firstSeries] || 0) - Number(a[firstSeries] || 0));
        plans.push({
          chartType: 'bar',
          data: sorted,
          xField: '月份',
          yFields: [firstSeries],
          title: generateChartTitle('bar', '月份', [firstSeries])
        });
      }
    }
  }

  // ========== Phase 2: 多样化图表类型（需 labelField）==========

  // 策略 6: 瀑布图（适合 3-20 行的财务增减数据）
  if (plans.length < 7 && labelField && numCols.length > 0 && !usedTypes.has('waterfall')) {
    const wfDataRaw = cleanedData.filter(row => row[labelField] != null);
    if (wfDataRaw.length >= 3) {
      const yField = numCols.find(c => c !== labelField) || numCols[0];
      if (yField) {
        // For large datasets (>30 rows), take top 25 by absolute value
        let wfData = wfDataRaw;
        if (wfData.length > 30) {
          wfData = [...wfDataRaw]
            .sort((a, b) => Math.abs(Number(b[yField] || 0)) - Math.abs(Number(a[yField] || 0)))
            .slice(0, 25);
        }
        plans.push({
          chartType: 'waterfall',
          data: wfData,
          xField: labelField,
          yFields: [yField],
          title: generateChartTitle('waterfall', labelField, [yField])
        });
        usedTypes.add('waterfall');
      }
    }
  }

  // 策略 7: 面积图（月份列存在 + labelField，替代重复折线图）
  if (plans.length < 7 && monthlyColumns.length >= 2 && labelField && !usedTypes.has('area')) {
    const tsData = transposeForTimeSeries(cleanedData, monthlyColumns, labelField);
    if (tsData.length > 0) {
      const seriesKeys = Object.keys(tsData[0]).filter(k => k !== '月份');
      if (seriesKeys.length > 0) {
        plans.push({
          chartType: 'area',
          data: tsData,
          xField: '月份',
          yFields: seriesKeys.slice(0, 3),
          title: generateChartTitle('area', '月份', seriesKeys.slice(0, 3))
        });
        usedTypes.add('area');
      }
    }
  }

  // 策略 8: 组合图（柱+线叠加，需 labelField + 2 个数值列）
  if (plans.length < 7 && labelField && numCols.length >= 2 && !usedTypes.has('combination')) {
    const yFields = numCols.filter(c => c !== labelField).slice(0, 2);
    if (yFields.length >= 2) {
      const chartData = cleanedData.filter(row => row[labelField] != null).slice(0, 15);
      if (chartData.length >= 2) {
        plans.push({
          chartType: 'combination',
          data: chartData,
          xField: labelField,
          yFields,
          title: generateChartTitle('combination', labelField, yFields)
        });
        usedTypes.add('combination');
      }
    }
  }

  // ========== Phase 2.5: 食品行业 + 财务专用图表策略 (P2.1) ==========

  // Derive allKeys from cleanedData (not a parameter of buildChartPlan)
  const allKeys = cleanedData.length > 0 ? Object.keys(cleanedData[0]) : [];

  // Detect data characteristics for smarter chart selection
  const allKeysLower = allKeys.map(k => k.toLowerCase());
  const allKeysJoined = allKeys.join('|');
  const isFinancial = /收入|支出|费用|利润|成本|净利|毛利|营业|revenue|cost|profit|expense|margin/i.test(allKeysJoined);
  const hasRatioColumns = allKeys.some(k => /率|比例|%|占比|ratio|percent/i.test(k));
  const budgetActualPairs = (() => {
    const budgetCol = allKeys.find(k => /预算|budget|plan|目标|target/i.test(k));
    const actualCol = allKeys.find(k => /实际|actual|实绩|完成/i.test(k));
    return budgetCol && actualCol ? [budgetCol, actualCol] : null;
  })();

  // Strategy: Gauge chart for ratio/percentage columns
  if (plans.length < 7 && hasRatioColumns && labelField && !usedTypes.has('gauge')) {
    const ratioCol = numCols.find(k => /率|比例|%|占比|ratio|percent/i.test(k));
    if (ratioCol) {
      const chartData = cleanedData.filter(row => row[labelField] != null).slice(0, 5);
      if (chartData.length > 0) {
        plans.push({
          chartType: 'gauge',
          data: chartData,
          xField: labelField,
          yFields: [ratioCol],
          title: generateChartTitle('gauge', labelField, [ratioCol])
        });
        usedTypes.add('gauge');
      }
    }
  }

  // Strategy: Budget vs Actual combination chart
  if (plans.length < 7 && budgetActualPairs && labelField && !usedTypes.has('combination')) {
    const chartData = cleanedData.filter(row => row[labelField] != null).slice(0, 15);
    if (chartData.length >= 2) {
      plans.push({
        chartType: 'combination',
        data: chartData,
        xField: labelField,
        yFields: budgetActualPairs,
        title: `${humanizeColumnName(budgetActualPairs[0])} vs ${humanizeColumnName(budgetActualPairs[1])} 对比`
      });
      usedTypes.add('combination');
    }
  }

  // Strategy: Radar chart when 3+ numeric columns and moderate rows
  if (plans.length < 7 && labelField && numCols.length >= 3 && cleanedData.length <= 10 && !usedTypes.has('radar')) {
    const radarData = cleanedData.filter(row => row[labelField] != null).slice(0, 5);
    if (radarData.length >= 2) {
      plans.push({
        chartType: 'radar',
        data: radarData,
        xField: labelField,
        yFields: numCols.filter(c => c !== labelField).slice(0, 6),
        title: generateChartTitle('radar', labelField, numCols.slice(0, 4))
      });
      usedTypes.add('radar');
    }
  }

  // Strategy: Ranking horizontal bar for large datasets
  if (plans.length < 7 && labelField && numCols.length > 0 && cleanedData.length > 10 && !usedTypes.has('ranking')) {
    const rankCol = numCols.find(c => c !== labelField) || numCols[0];
    if (rankCol) {
      const sorted = [...cleanedData]
        .filter(row => row[labelField] != null && row[rankCol] != null)
        .sort((a, b) => Math.abs(Number(b[rankCol] || 0)) - Math.abs(Number(a[rankCol] || 0)))
        .slice(0, 15);
      if (sorted.length >= 3) {
        plans.push({
          chartType: 'ranking',
          data: sorted,
          xField: labelField,
          yFields: [rankCol],
          title: `${humanizeColumnName(rankCol)} 排名 (Top ${sorted.length})`
        });
        usedTypes.add('ranking');
      }
    }
  }

  // ========== Phase 2.7: 新增6种图表策略 ==========

  // 策略: Pareto chart (80/20分析) — labelField + numericCol, top 20% 占总和≥55%
  if (plans.length < 7 && labelField && numCols.length > 0 && !usedTypes.has('pareto')) {
    const paretoCol = numCols.find(c => c !== labelField) || numCols[0];
    if (paretoCol) {
      const validData = cleanedData
        .filter(row => row[labelField] != null && row[paretoCol] != null)
        .map(row => ({ ...row, __pVal: Math.abs(Number(row[paretoCol]) || 0) }))
        .filter(r => r.__pVal > 0)
        .sort((a, b) => b.__pVal - a.__pVal);

      if (validData.length >= 5) {
        const totalSum = validData.reduce((s, r) => s + r.__pVal, 0);
        const top20Count = Math.max(1, Math.ceil(validData.length * 0.2));
        const top20Sum = validData.slice(0, top20Count).reduce((s, r) => s + r.__pVal, 0);
        const top20Pct = totalSum > 0 ? (top20Sum / totalSum) * 100 : 0;

        if (top20Pct >= 55) {
          plans.push({
            chartType: 'pareto',
            data: validData.slice(0, 20).map(({ __pVal, ...rest }) => rest),
            xField: labelField,
            yFields: [paretoCol],
            title: generateChartTitle('pareto', labelField, [paretoCol])
          });
          usedTypes.add('pareto');
        }
      }
    }
  }

  // 策略: Boxplot (箱线图) — numericCols ≥1, rows ≥20
  if (plans.length < 7 && numCols.length >= 1 && cleanedData.length >= 20 && !usedTypes.has('boxplot')) {
    const boxCols = numCols.filter(c => c !== labelField).slice(0, 4);
    if (boxCols.length > 0) {
      plans.push({
        chartType: 'boxplot',
        data: cleanedData,
        xField: labelField || boxCols[0],
        yFields: boxCols,
        title: generateChartTitle('boxplot', labelField || '数据', boxCols)
      });
      usedTypes.add('boxplot');
    }
  }

  // 策略: Horizontal bar (横向柱图) — labelField with avg label length > 8 chars
  if (plans.length < 7 && labelField && numCols.length > 0 && !usedTypes.has('bar_horizontal') && !usedTypes.has('ranking')) {
    const labels = cleanedData
      .map(row => String(row[labelField] || ''))
      .filter(l => l.length > 0);
    const avgLen = labels.length > 0 ? labels.reduce((s, l) => s + l.length, 0) / labels.length : 0;

    if (avgLen > 8) {
      const yField = numCols.find(c => c !== labelField) || numCols[0];
      if (yField) {
        const sorted = [...cleanedData]
          .filter(row => row[labelField] != null && row[yField] != null)
          .sort((a, b) => Math.abs(Number(b[yField] || 0)) - Math.abs(Number(a[yField] || 0)))
          .slice(0, 15);
        if (sorted.length >= 3) {
          plans.push({
            chartType: 'bar_horizontal',
            data: sorted,
            xField: labelField,
            yFields: [yField],
            title: generateChartTitle('bar_horizontal', labelField, [yField])
          });
          usedTypes.add('bar_horizontal');
        }
      }
    }
  }

  // 策略: Funnel (漏斗图) — labelField contains stage/step/阶段/步骤 keywords
  if (plans.length < 7 && labelField && numCols.length > 0 && !usedTypes.has('funnel')) {
    const colNamesJoined = allKeys.join('|') + '|' + cleanedData.slice(0, 5).map(r => String(r[labelField] || '')).join('|');
    const hasFunnelKeywords = /stage|step|阶段|步骤|环节|流程|转化|漏斗|phase/i.test(colNamesJoined);
    if (hasFunnelKeywords) {
      const yField = numCols.find(c => c !== labelField) || numCols[0];
      if (yField) {
        const funnelData = cleanedData.filter(row => row[labelField] != null && row[yField] != null).slice(0, 10);
        if (funnelData.length >= 2) {
          plans.push({
            chartType: 'funnel',
            data: funnelData,
            xField: labelField,
            yFields: [yField],
            title: generateChartTitle('funnel', labelField, [yField])
          });
          usedTypes.add('funnel');
        }
      }
    }
  }

  // 策略: Nested donut (嵌套环形图) — ≥2 categorical columns
  if (plans.length < 7 && dataInfo.categoricalColumns.length >= 2 && numCols.length > 0 && !usedTypes.has('nested_donut')) {
    const cat1 = dataInfo.categoricalColumns[0];
    const cat2 = dataInfo.categoricalColumns[1];
    const yField = numCols.find(c => c !== cat1 && c !== cat2) || numCols[0];
    if (yField) {
      const donutData = cleanedData.filter(row => row[cat1] != null && row[cat2] != null).slice(0, 20);
      if (donutData.length >= 3) {
        plans.push({
          chartType: 'nested_donut',
          data: donutData,
          xField: cat1,
          yFields: [yField],
          seriesField: cat2,
          title: generateChartTitle('nested_donut', cat1, [yField])
        });
        usedTypes.add('nested_donut');
      }
    }
  }

  // 策略: Correlation matrix (散点矩阵) — ≥3 numeric columns
  if (plans.length < 7 && numCols.length >= 3 && !usedTypes.has('correlation_matrix')) {
    const corrCols = numCols.filter(c => c !== labelField).slice(0, 5);
    if (corrCols.length >= 3) {
      plans.push({
        chartType: 'correlation_matrix',
        data: cleanedData.slice(0, 100),
        xField: corrCols[0],
        yFields: corrCols.slice(1),
        title: generateChartTitle('correlation_matrix', corrCols[0], corrCols.slice(1))
      });
      usedTypes.add('correlation_matrix');
    }
  }

  // ========== Phase 3: 不依赖 labelField 的保底策略 ==========
  // 只要有数值列，就一定能出图

  if (plans.length === 0 && numCols.length > 0) {
    // 策略 9: 行号索引柱状图
    const indexedData = cleanedData.slice(0, 20).map((row, i) => ({
      ...row,
      __rowIndex: `#${i + 1}`
    }));
    const yFields = numCols.slice(0, 3);
    plans.push({
      chartType: 'bar',
      data: indexedData,
      xField: '__rowIndex',
      yFields,
      title: generateChartTitle('bar', '#行号', yFields)
    });
    usedTypes.add('bar');

    // 策略 10: 散点图（需 2 个数值列）
    if (numCols.length >= 2) {
      plans.push({
        chartType: 'scatter',
        data: cleanedData.slice(0, 50),
        xField: numCols[0],
        yFields: [numCols[1]],
        title: generateChartTitle('scatter', numCols[0], [numCols[1]])
      });
      usedTypes.add('scatter');
    }

    // 策略 11: 雷达图（需 3 个数值列，取前 5 行）
    if (numCols.length >= 3) {
      const radarData = cleanedData.slice(0, 5).map((row, i) => ({
        ...row,
        __rowIndex: `#${i + 1}`
      }));
      plans.push({
        chartType: 'radar',
        data: radarData,
        xField: '__rowIndex',
        yFields: numCols.slice(0, 6),
        title: generateChartTitle('radar', '__rowIndex', numCols.slice(0, 6))
      });
      usedTypes.add('radar');
    }
  }

  return plans.slice(0, 7);
}

/**
 * 批量构建图表：调用 Python /api/chart/batch
 */
export async function batchBuildCharts(plans: ChartPlanItem[], signal?: AbortSignal): Promise<{
  success: boolean;
  charts: Array<{ success: boolean; chartType: string; config: Record<string, unknown>; anomalies?: Record<string, unknown> }>;
}> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chart/batch`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify(plans.map(p => ({
        chartType: p.chartType,
        data: p.data,
        xField: p.xField,
        yFields: p.yFields,
        title: p.title,
        seriesField: p.seriesField
      }))),
      signal
    });
    await assertOk(response, 'batchBuildCharts');
    const result = await response.json();
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

/**
 * 快速统计摘要（无 LLM，~100ms）
 */
export async function quickSummary(data: unknown[], signal?: AbortSignal): Promise<{
  success: boolean;
  rowCount: number;
  columnCount: number;
  columns: ColumnSummary[];
}> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/insight/quick-summary`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify(data),
      signal
    });
    await assertOk(response, 'quickSummary');
    return response.json();
  } catch (error) {
    console.error('quickSummary 失败:', error);
    return { success: false, rowCount: 0, columnCount: 0, columns: [] };
  }
}

/**
 * Forecast API call (Phase 3.2 — Tableau + Power BI + FineBI forecast trend lines)
 * Calls Python /api/forecast/predict with numeric series, returns predictions + confidence interval
 */
export async function getForecast(data: number[], periods = 3, signal?: AbortSignal): Promise<{
  success: boolean;
  predictions: number[];
  lowerBound: number[];
  upperBound: number[];
}> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/forecast/predict`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify({ data, periods, algorithm: 'auto' }),
      signal
    });
    await assertOk(response, 'getForecast');
    return response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.error('getForecast 失败:', error);
    return { success: false, predictions: [], lowerBound: [], upperBound: [] };
  }
}

/**
 * Sheet 数据增强 - 多图表仪表板版本 (P0: 渐进式渲染)
 * 编排：清洗 → recommend + quickSummary (并行) → buildChartPlan → 逐个 buildChart → forecast + insights (并行)
 * @param onProgress 渐进式回调，每完成一阶段即通知 Vue 组件更新 UI
 */
export async function enrichSheetAnalysis(
  uploadId: number,
  forceRefresh = false,
  onProgress?: (progress: EnrichProgress) => void
): Promise<EnrichResult> {
  // Cache-first: try loading from persistent cache before full enrichment
  if (!forceRefresh) {
    try {
      const cached = await getCachedAnalysis(uploadId);
      if (cached && cached.success) {
        onProgress?.({ phase: 'complete', partial: cached });
        return cached;
      }
    } catch (e) {
      // console.warn('[Cache] Error checking cache, proceeding with enrichment:', e);
    }
  }

  await enrichmentLimiter.acquire();
  const timings: Record<string, number> = {};
  const tick = (label: string, t0: number) => { timings[label] = Math.round(performance.now() - t0); };
  const abortController = new AbortController();
  const prevController = activeControllers.get(`enrich-${uploadId}`);
  if (prevController) prevController.abort();
  activeControllers.set(`enrich-${uploadId}`, abortController);
  try {
    // ===== Phase 1: Data Fetch + Clean (<1s) =====
    let t0 = performance.now();
    const tableRes = await getUploadTableData(uploadId, 0, 2000);
    if (!tableRes.success || !tableRes.data?.data?.length) {
      return { success: false, error: '无法获取上传数据' };
    }
    const rawData = tableRes.data.data as Record<string, unknown>[];
    tick('getUploadTableData', t0);

    // T3.3: Single-pass data preparation (was 3 separate iterations: rename → extract → clean)
    t0 = performance.now();
    const { renamedData, cleanedData, textContext } = prepareDataSinglePass(rawData);
    tick('prepareData', t0);
    if (!cleanedData.length) {
      return { success: false, error: '清洗后无有效数据' };
    }

    onProgress?.({ phase: 'data', partial: { rawData: cleanedData } });

    // ===== Phase 2: KPI + Recommendations (<3s) =====
    t0 = performance.now();
    const [recRes, summaryRes] = await Promise.all([
      recommendChart(cleanedData, abortController.signal),
      quickSummary(cleanedData, abortController.signal)
    ]);
    tick('recommend+summary', t0);

    const recommendations = recRes.success && recRes.recommendations?.length
      ? recRes.recommendations
      : [{ chartType: 'bar', xField: undefined, yFields: undefined, priority: 1 }];

    const dataInfo = recRes.dataInfo || { numericColumns: [], categoricalColumns: [], dateColumns: [] };

    t0 = performance.now();
    const allKeys = Object.keys(cleanedData[0]);
    const monthlyColumns = detectMonthlyColumns(allKeys);
    const enhancedNumericCols = detectNumericColumns(cleanedData, dataInfo.numericColumns, allKeys);
    const enhancedDataInfo = { ...dataInfo, numericColumns: enhancedNumericCols };
    const labelField = detectLabelField(cleanedData, dataInfo.categoricalColumns, enhancedNumericCols, allKeys);

    // T1.2: Chart plan cache — skip buildChartPlan if column structure unchanged
    const planCacheKey = getChartPlanCacheKey(cleanedData, labelField, monthlyColumns);
    let plans: ChartPlanItem[];
    if (!forceRefresh && planCacheKey && _chartPlanCache.has(planCacheKey)) {
      plans = _chartPlanCache.get(planCacheKey)!;
    } else {
      plans = buildChartPlan(cleanedData, recommendations, enhancedDataInfo, monthlyColumns, labelField);
      if (planCacheKey) {
        // T4.3: Evict oldest entries when cache exceeds limit
        if (_chartPlanCache.size >= _PLAN_CACHE_LIMIT) {
          const firstKey = _chartPlanCache.keys().next().value;
          if (firstKey !== undefined) _chartPlanCache.delete(firstKey);
        }
        _chartPlanCache.set(planCacheKey, plans);
      }
    }
    tick('detect+buildPlan', t0);

    // T2.1: Single-pass column sum computation — reuse for KPI enhancement
    t0 = performance.now();
    const columnSums = new Map<string, number>();
    const numericSet = new Set(enhancedNumericCols);
    for (const row of cleanedData) {
      for (const col of enhancedNumericCols) {
        const v = row[col];
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        if (!isNaN(n)) columnSums.set(col, (columnSums.get(col) || 0) + n);
      }
    }
    tick('columnSums', t0);

    // Assemble KPI summary with pre-computed sums (T2.1: avoids O(n) re-scan per column)
    const kpiSummary = summaryRes.success
      ? { rowCount: summaryRes.rowCount, columnCount: summaryRes.columnCount, columns: summaryRes.columns }
      : undefined;
    if (kpiSummary && enhancedNumericCols.length > 0) {
      kpiSummary.columns = kpiSummary.columns.map(col => {
        if (!numericSet.has(col.name) || ['int64', 'float64', 'number', 'int32', 'float32'].includes(col.type)) {
          return col;
        }
        return { ...col, type: 'float64', sum: columnSums.get(col.name) || 0 };
      });
    }

    const financialMetrics = computeFinancialMetrics(cleanedData, monthlyColumns, labelField);

    // Notify KPI ready — user sees KPI cards within ~2-3s
    onProgress?.({ phase: 'kpi', partial: { kpiSummary, financialMetrics, chartsTotal: plans.length } });

    // ===== Phase 3: Progressive Chart Building (逐个, 并行度=3) =====
    t0 = performance.now();
    const charts: Array<{ chartType: string; title: string; config: Record<string, unknown>; totalItems?: number; xField?: string; anomalies?: Record<string, unknown> }> = [];

    if (plans.length > 0) {
      const CHART_CONCURRENCY = 6;
      for (let i = 0; i < plans.length; i += CHART_CONCURRENCY) {
        if (abortController.signal.aborted) break; // T2.2: early exit on abort
        const batch = plans.slice(i, i + CHART_CONCURRENCY);
        const results = await Promise.all(batch.map(plan =>
          buildChart({
            chartType: plan.chartType,
            data: plan.data,
            xField: plan.xField,
            yFields: plan.yFields,
            title: plan.title,
            signal: abortController.signal  // T2.2: propagate abort signal
          })
        ));
        results.forEach((res, j) => {
          const planIdx = i + j;
          const plan = plans[planIdx];
          if (res.success && res.option) {
            charts.push({
              chartType: plan.chartType,
              title: plan.title,
              config: res.option,
              xField: plan.xField,
              anomalies: undefined,
              totalItems: plan.totalItems,
            });
            // Notify each chart as it completes — user sees charts appear one by one
            onProgress?.({ phase: 'chart-single', partial: { charts: [...charts] } });
          }
        });
      }
    }
    tick('progressiveCharts', t0);

    // ===== Phase 3.5: Forecast + AI Insights (并行) =====
    t0 = performance.now();

    // Build insight context (needed for AI call)
    const columnNames = allKeys.map(humanizeColumnName).join(', ');
    const contextParts = [`数据列: ${columnNames}`];
    if (textContext) contextParts.push(textContext);
    if (financialMetrics) contextParts.push(formatFinancialContext(financialMetrics));
    const insightData = cleanedData.slice(0, 100);

    // Run forecast and AI insights in parallel
    // T1.1: Use streaming for AI insights — onProgress receives chunks as they arrive
    const [, insightRes] = await Promise.all([
      // Forecast: add trend lines to line charts — ALL line charts in parallel (#3 opt)
      (async () => {
        const lineCharts = charts.filter(c => c.chartType === 'line');
        await Promise.all(lineCharts.map(async (chart) => {
          const config = chart.config as any;
          const series = config?.series;
          if (!Array.isArray(series)) return;
          const firstSeries = series.find((s: any) => s.type === 'line' && Array.isArray(s.data));
          if (!firstSeries) return;
          const numericData = firstSeries.data.filter((v: unknown) => typeof v === 'number' && !isNaN(v as number));
          if (numericData.length < 5) return;
          try {
            const forecastRes = await getForecast(numericData, 3);
            if (forecastRes.success && forecastRes.predictions?.length) {
              const xData = config.xAxis?.data;
              if (Array.isArray(xData)) {
                for (let fi = 0; fi < forecastRes.predictions.length; fi++) xData.push(`预测${fi + 1}`);
              }
              const padded = new Array(numericData.length).fill(null);
              padded[padded.length - 1] = numericData[numericData.length - 1];
              series.push({
                name: `${firstSeries.name}(预测)`, type: 'line',
                data: [...padded, ...forecastRes.predictions.map((v: number) => Math.round(v * 100) / 100)],
                lineStyle: { type: 'dashed', width: 2 }, symbol: 'diamond', symbolSize: 6,
                itemStyle: { color: '#9ca3af' }
              });
              if (forecastRes.lowerBound?.length && forecastRes.upperBound?.length) {
                const basePad = new Array(numericData.length).fill(null);
                series.push({
                  name: '置信下界', type: 'line',
                  data: [...basePad, ...forecastRes.lowerBound.map((v: number) => Math.round(v * 100) / 100)],
                  lineStyle: { opacity: 0 }, symbol: 'none', silent: true, z: -1
                });
                series.push({
                  name: '置信区间', type: 'line',
                  data: [...basePad, ...forecastRes.upperBound.map((v: number) => Math.round(v * 100) / 100)],
                  lineStyle: { opacity: 0 }, symbol: 'none',
                  areaStyle: { color: 'rgba(156,163,175,0.18)', origin: 'auto' }, silent: true, z: -1
                });
              }
            }
          } catch { /* Forecast is optional */ }
        }));
      })(),
      // AI Insights — T1.1: use streaming with progressive text callback
      generateInsightsStream({
        data: insightData,
        analysisContext: contextParts.join('\n'),
        maxInsights: 5,
        signal: abortController.signal,
        onChunk: (chunk) => {
          // T1.1: Stream raw LLM text to UI progressively
          onProgress?.({ phase: 'ai-streaming', partial: { aiStreamChunk: chunk } });
        }
      })
    ]);
    tick('forecast+insights', t0);

    // Process AI insights
    let aiAnalysis = '';
    let structuredAI: StructuredAIData | undefined;
    if (insightRes.success && insightRes.insights?.length) {
      const metaInsight = insightRes.insights.find(i => i.type === '_meta');
      const normalInsights = insightRes.insights.filter(i => i.type !== '_meta');

      if (metaInsight) {
        const meta = metaInsight as Record<string, unknown>;
        structuredAI = {
          executiveSummary: (meta.executive_summary as string) || (meta.text as string) || '',
          riskAlerts: (meta.risk_alerts as StructuredAIData['riskAlerts']) || [],
          opportunities: (meta.opportunities as StructuredAIData['opportunities']) || [],
          sensitivityAnalysis: (meta.sensitivity_analysis as StructuredAIData['sensitivityAnalysis']) || []
        };
      }

      // Fallback: compute sensitivity analysis from financial metrics if LLM didn't return it
      if (structuredAI && (!structuredAI.sensitivityAnalysis || structuredAI.sensitivityAnalysis.length === 0) && financialMetrics) {
        structuredAI.sensitivityAnalysis = computeSensitivityFallback(financialMetrics);
      }

      aiAnalysis = normalInsights
        .map(i => {
          let line = `**${i.type}**: ${i.text}`;
          if (i.recommendation) line += `\n建议: ${i.recommendation}`;
          return line;
        })
        .join('\n\n');
    }

    // Notify AI analysis ready
    onProgress?.({ phase: 'ai', partial: { aiAnalysis: aiAnalysis || undefined, structuredAI } });

    // Output timing table (dev only)
    if (import.meta.env.DEV) console.table(timings);

    const hasContent = !!(charts.length || aiAnalysis);
    const enrichResult: EnrichResult = {
      success: hasContent,
      charts: charts.length ? charts : undefined,
      kpiSummary,
      financialMetrics,
      aiAnalysis: aiAnalysis || undefined,
      structuredAI,
      chartConfig: charts.length ? charts[0].config : undefined,
      error: hasContent ? undefined : '未能生成图表或 AI 洞察',
      timings,
      rawData: cleanedData,
    };

    // Notify complete
    onProgress?.({ phase: 'complete', partial: enrichResult });

    // Save to persistent cache (fire-and-forget)
    if (hasContent) {
      saveAnalysisToCache(uploadId, getFactoryId(), enrichResult).catch(() => {});
    }

    return enrichResult;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: '分析已取消' };
    }
    console.error('enrichSheetAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sheet 数据增强失败'
    };
  } finally {
    activeControllers.delete(`enrich-${uploadId}`);
    enrichmentLimiter.release();
  }
}

/**
 * T3.3: Single-pass data preparation — combines rename, text extraction, and cleaning
 * into one iteration over the dataset instead of three separate passes.
 *
 * Previously: renameMeaninglessColumns() → extractTextContext() → cleanDataForChart()
 * Each iterated the full dataset separately (3x iterations).
 * Now: one iteration builds the rename map, extracts text context, and cleans data together.
 */
function prepareDataSinglePass(rawData: Record<string, unknown>[]): {
  renamedData: Record<string, unknown>[];
  cleanedData: Record<string, unknown>[];
  textContext: string;
} {
  if (!rawData.length) return { renamedData: [], cleanedData: [], textContext: '' };

  const allKeys = Object.keys(rawData[0]);

  // --- Step A: Build rename map (from renameMeaninglessColumns logic) ---
  const meaninglessPattern = /^Column_\d+$/i;
  const keyMap = new Map<string, string>();
  const keysToKeep: string[] = [];
  const usedNames = new Set<string>();

  for (const key of allKeys) {
    if (meaninglessPattern.test(key)) continue;
    let cleaned = key.replace(/[\u3000\u00A0]/g, '').replace(/\s+/g, '').trim();
    cleaned = cleaned || key;
    if (usedNames.has(cleaned)) {
      let suffix = 2;
      while (usedNames.has(`${cleaned}_${suffix}`)) suffix++;
      cleaned = `${cleaned}_${suffix}`;
    }
    usedNames.add(cleaned);
    keyMap.set(key, cleaned);
    keysToKeep.push(key);
  }

  const needsRename = keysToKeep.length !== allKeys.length || [...keyMap.entries()].some(([k, v]) => k !== v);

  // --- Step B: Detect which columns have at least one non-null value (for clean) ---
  const colHasValue = new Set<string>();

  // --- Step C: Prepare text context extraction state ---
  const renamedFirstKey = keysToKeep.length > 0 ? keysToKeep[0] : allKeys[0];
  const labelValues: string[] = [];
  const noteTexts: string[] = [];

  // --- Step D: Single pass over all rows ---
  const renamedRows: Record<string, unknown>[] = [];
  const cleanedRows: Record<string, unknown>[] = [];

  for (let ri = 0; ri < rawData.length; ri++) {
    const row = rawData[ri];

    // D.1: Rename + collect valid cols
    const renamedRow: Record<string, unknown> = {};
    let hasNonEmpty = false;

    for (const key of keysToKeep) {
      const val = row[key];
      const newKey = needsRename ? keyMap.get(key)! : key;
      if (val != null) colHasValue.add(newKey);
      // Clean: null/NaN → null
      if (val == null || (typeof val === 'number' && isNaN(val))) {
        renamedRow[newKey] = null;
      } else {
        renamedRow[newKey] = val;
        if (val !== 0 && val !== '') hasNonEmpty = true;
      }
    }

    renamedRows.push(renamedRow);

    // D.2: Extract text context from first column
    const firstVal = row[renamedFirstKey];
    if (firstVal != null && typeof firstVal === 'string') {
      const trimmed = firstVal.trim();
      if (trimmed && isNaN(Number(trimmed))) {
        labelValues.push(trimmed);
      }
    }

    // D.3: Extract notes from first/last 5 rows
    if (ri < 5 || ri >= rawData.length - 5) {
      for (const key of keysToKeep) {
        const val = row[key];
        if (val == null || typeof val !== 'string') continue;
        const text = val.trim();
        if (!text || text.length < 4) continue;
        if (/备注|说明|编制|注[:：]|单位[:：]|口径|来源|统计|含|不含|包含/.test(text)) {
          noteTexts.push(text);
        }
      }
    }

    // D.4: Filter empty rows for cleanedData
    if (hasNonEmpty) {
      cleanedRows.push(renamedRow);
    }
  }

  // --- Step E: Remove all-null columns from cleaned data ---
  const validKeys = (needsRename ? keysToKeep.map(k => keyMap.get(k)!) : keysToKeep).filter(k => colHasValue.has(k));
  const needsColFilter = validKeys.length < (needsRename ? keysToKeep.length : allKeys.length);
  const finalCleaned = needsColFilter
    ? cleanedRows.map(row => {
        const filtered: Record<string, unknown> = {};
        for (const k of validKeys) filtered[k] = row[k];
        return filtered;
      })
    : cleanedRows;

  // --- Step F: Build text context string ---
  const textLines: string[] = [];
  const structureLabels = labelValues.filter(v =>
    /^[一二三四五六七八九十]+[、.]/.test(v) ||
    /^[\(（]\d+[\)）]/.test(v) ||
    /^\d+[、.\s]/.test(v) ||
    /合计|小计|总计|净|毛利/.test(v)
  );
  if (structureLabels.length > 0) {
    textLines.push(`报表结构项: ${structureLabels.slice(0, 20).join('; ')}`);
  }
  const uniqueLabels = [...new Set(labelValues)].slice(0, 30);
  if (uniqueLabels.length > 0) {
    textLines.push(`数据项目: ${uniqueLabels.join(', ')}`);
  }
  if (noteTexts.length > 0) {
    textLines.push(...[...new Set(noteTexts)]);
  }

  return {
    renamedData: renamedRows,
    cleanedData: finalCleaned,
    textContext: textLines.join('\n'),
  };
}

/**
 * 从原始数据中提取文字上下文（标题行、备注、编制说明等）
 * 利润表中的文字行如 "一、营业收入"、"编制说明"、"备注" 等在 cleanDataForChart 时会被过滤，
 * 这里提前提取出来，传递给 AI 分析以保留业务语义。
 * NOTE: Kept for backward compatibility — prefer prepareDataSinglePass() for new code paths.
 */
function extractTextContext(rawData: Record<string, unknown>[], sheetName?: string): string {
  if (!rawData.length) return '';

  const textLines: string[] = [];
  const allKeys = Object.keys(rawData[0]);
  // 取第一列（通常是"项目"列）作为主要文字来源
  const firstKey = allKeys[0];

  // 扫描所有行，提取第一列中的纯文字行
  const labelValues: string[] = [];
  for (const row of rawData) {
    const val = row[firstKey];
    if (val != null && typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed && isNaN(Number(trimmed))) {
        labelValues.push(trimmed);
      }
    }
  }

  // 提取报表结构信息（大纲式标题）
  const structureLabels = labelValues.filter(v =>
    /^[一二三四五六七八九十]+[、.]/.test(v) ||  // "一、营业收入"
    /^[\(（]\d+[\)）]/.test(v) ||                  // "(1) 营业成本"
    /^\d+[、.\s]/.test(v) ||                       // "1、营业税金"
    /合计|小计|总计|净|毛利/.test(v)               // 汇总行
  );
  if (structureLabels.length > 0) {
    textLines.push(`报表结构项: ${structureLabels.slice(0, 20).join('; ')}`);
  }

  // 提取全部标签（前30个去重）
  const uniqueLabels = [...new Set(labelValues)].slice(0, 30);
  if (uniqueLabels.length > 0) {
    textLines.push(`数据项目: ${uniqueLabels.join(', ')}`);
  }

  // 扫描前5行和后5行，提取可能的备注、单位、编制说明
  const scanRows = [...rawData.slice(0, 5), ...rawData.slice(-5)];
  for (const row of scanRows) {
    for (const key of allKeys) {
      const val = row[key];
      if (val == null || typeof val !== 'string') continue;
      const text = val.trim();
      if (!text || text.length < 4) continue;
      // 匹配备注、说明、单位等关键词
      if (/备注|说明|编制|注[:：]|单位[:：]|口径|来源|统计|含|不含|包含/.test(text)) {
        textLines.push(text);
      }
    }
  }

  if (textLines.length === 0) return '';

  const prefix = sheetName ? `报表: ${sheetName}` : '';
  return [prefix, ...textLines].filter(Boolean).join('\n');
}

/**
 * 清洗数据：移除全 null 列、替换 null/NaN 为 0、过滤空行
 */
function cleanDataForChart(data: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!data.length) return [];

  // 1. 找出有至少一个非 null 值的列
  const allKeys = Object.keys(data[0]);
  const validKeys = allKeys.filter(key =>
    data.some(row => row[key] != null)
  );

  // 2. 重建数据：仅保留有效列，null 数值替换为 0
  return data
    .map(row => {
      const cleaned: Record<string, unknown> = {};
      for (const key of validKeys) {
        const val = row[key];
        if (val == null || (typeof val === 'number' && isNaN(val))) {
          cleaned[key] = null;  // 保持 null，让 ECharts 断线处理，避免 KPI mean 被拉低
        } else {
          cleaned[key] = val;
        }
      }
      return cleaned;
    })
    .filter(row => {
      // 过滤掉所有值都是 null 或 0 的行
      return Object.values(row).some(v => v != null && v !== 0 && v !== '');
    });
}

// ==================== 数据持久化 API (通过 Java 现有端点) ====================

/**
 * 确认上传并持久化 (使用现有 Java 端点)
 * 注意: 这调用的是已存在的 /upload/confirm 端点
 */
export function confirmUploadAndPersist(data: {
  parseResponse: {
    fileName?: string;
    sheetName?: string;
    headers: string[];
    rowCount: number;
    columnCount: number;
    previewData?: unknown[];
    tableType?: string;
  };
  confirmedMappings?: Record<string, string>;
  dataType?: string;
  saveRawData?: boolean;
  generateChart?: boolean;
  chartTemplateId?: number;
}) {
  return post(`${getSmartBIBasePath()}/upload/confirm`, data);
}

/**
 * 获取数据源列表 (Schema-based datasources)
 */
export function getDatasourceList(params?: { page?: number; size?: number }) {
  return get(`${getSmartBIBasePath()}/datasource/list`, { params });
}

// ==================== 动态数据分析 API ====================

/**
 * 上传历史记录
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
 * 字段定义
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
 * 动态分析结果
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
 * 获取上传历史列表
 * 用于数据源选择器展示已上传的 Excel 文件
 */
export function getUploadHistory(params?: { status?: string }) {
  return get<UploadHistoryItem[]>(`${getSmartBIBasePath()}/uploads`, { params });
}

/**
 * 获取动态数据分析结果
 * 对已上传的 Excel 数据进行分析，返回 KPI、图表和洞察
 *
 * @param uploadId - 上传记录ID
 * @param analysisType - 分析类型: auto/finance/sales/inventory
 */
export function getDynamicAnalysis(uploadId: number, analysisType: string = 'auto') {
  return get<DynamicAnalysisResponse>(`${getSmartBIBasePath()}/analysis/dynamic`, {
    params: { uploadId, analysisType }
  });
}

/**
 * 获取上传数据的字段定义
 * 用于了解数据结构和可用的分析维度
 */
export function getUploadFields(uploadId: number) {
  return get<FieldDefinition[]>(`${getSmartBIBasePath()}/uploads/${uploadId}/fields`);
}

// ==================== Phase 5: 数据预览 API ====================

/**
 * 表格数据响应结构
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
 * 获取上传数据的表格预览（分页）
 * 用于查看已持久化的原始 Excel 数据
 *
 * @param uploadId - 上传记录ID
 * @param page - 页码（从0开始）
 * @param size - 每页大小
 */
export function getUploadTableData(uploadId: number, page = 0, size = 50) {
  return get<TableDataResponse>(`${getSmartBIBasePath()}/uploads/${uploadId}/data`, {
    params: { page, size }
  });
}

// ==================== Phase 5: 诊断与回填 API ====================

/**
 * 回填结果结构
 */
export interface BackfillResult {
  uploadId: number;
  status: 'success' | 'skipped' | 'failed';
  fieldsCreated: number;
  message: string;
}

/**
 * 批量回填结果结构
 */
export interface BatchBackfillResult {
  totalProcessed: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  details: BackfillResult[];
}

/**
 * 诊断缺少字段定义的上传记录
 */
export function diagnoseUploadsMissingFields() {
  return get<{ totalUploads: number; missingFieldsCount: number; hasIssues: boolean }>(
    `${getSmartBIBasePath()}/uploads-missing-fields`
  );
}

/**
 * 回填单个上传的字段定义
 */
export function backfillFieldDefinitions(uploadId: number) {
  return post<BackfillResult>(`${getSmartBIBasePath()}/backfill/fields/${uploadId}`);
}

/**
 * 批量回填字段定义
 */
export function batchBackfillFieldDefinitions(limit = 100) {
  return post<BatchBackfillResult>(`${getSmartBIBasePath()}/backfill/batch`, null, {
    params: { limit }
  });
}

// ==================== P5: Statistical / Causal Analysis ====================

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
    distribution_type: string;
    is_normal: boolean;
    normality_p_value: number;
    coefficient_of_variation: number;
    percentiles: Record<string, number>;
  }>;
  correlations: {
    matrix: Record<string, Record<string, number>>;
    strong_positive: Array<{ var1: string; var2: string; correlation: number }>;
    strong_negative: Array<{ var1: string; var2: string; correlation: number }>;
    top_correlation?: { var1: string; var2: string; correlation: number };
  };
  comparisons: Record<string, {
    measure: string;
    top_3: Record<string, number>;
    bottom_3: Record<string, number>;
    cr3: number;
    cr5: number;
    gini_coefficient: number;
    pareto_count: number;
    pareto_ratio: number;
    total_items: number;
  }>;
  outlier_summary: Record<string, { count: number; values: number[] }>;
  processing_time_ms: number;
  error?: string;
}

export interface CorrelationResult {
  success: boolean;
  correlation_matrix: Record<string, Record<string, number>>;
  strong_positive: Array<{ var1: string; var2: string; correlation: number }>;
  strong_negative: Array<{ var1: string; var2: string; correlation: number }>;
  top_correlation?: { var1: string; var2: string; correlation: number };
  chart_config?: Record<string, unknown>;
  processing_time_ms: number;
  error?: string;
}

export async function statisticalAnalysis(params: {
  data: Record<string, unknown>[];
  measures?: string[];
  dimensions?: string[];
}): Promise<StatisticalResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/statistical/analyze`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify(params)
    });
    await assertOk(response, 'statisticalAnalysis');
    return response.json();
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
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/statistical/correlations`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
      body: JSON.stringify(params)
    });
    await assertOk(response, 'correlationAnalysis');
    return response.json();
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

// ==================== Sheet Retry API ====================

/**
 * Retry a failed or stuck sheet upload
 * Loads stored Excel file from disk, re-parses via Python, and re-persists data
 *
 * @param uploadId - Upload record ID to retry
 * @returns Retry result with upload details
 */
export function retrySheetUpload(uploadId: number) {
  return post<{ uploadId: number; message: string; rowCount?: number; headers?: string[] }>(
    `${getSmartBIBasePath()}/retry-sheet/${uploadId}`
  );
}

// ==================== Python 服务健康检查 ====================

/**
 * Python SmartBI 服务健康状态
 */
export interface PythonHealthStatus {
  enabled: boolean;
  available: boolean;
  llmConfigured: boolean;
  consecutiveFailures: number;
  lastCheckMs: number;
  url: string;
}

/**
 * 检查 Python SmartBI 服务健康状态
 *
 * 通过 Java 后端的代理端点检查 Python 服务可用性。
 * 返回的状态包含：是否可用、LLM 是否配置、连续失败次数等。
 *
 * @returns Python 服务健康状态
 */
export function checkPythonHealth() {
  return get<PythonHealthStatus>(`${getSmartBIBasePath()}/python-health`);
}

// ==================== Food Industry Benchmark API (A5) ====================

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

/**
 * Fetch food processing industry benchmarks
 */
export async function fetchFoodBenchmarks(): Promise<{ success: boolean; data?: FoodBenchmarkData }> {
  try {
    const res = await fetch(`${PYTHON_SMARTBI_URL}/smartbi/benchmark/food-processing`, {
      headers: PYTHON_HEADERS,
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (e) {
    console.warn('Failed to fetch food benchmarks:', e);
    return { success: false };
  }
}

/**
 * Compare actual metrics against industry benchmarks
 */
export async function compareBenchmarks(
  metrics: Record<string, number>,
  subSector?: string
): Promise<{ success: boolean; comparisons?: BenchmarkComparison[]; overall_score?: number; summary?: string }> {
  try {
    const res = await fetch(`${PYTHON_SMARTBI_URL}/smartbi/benchmark/compare`, {
      method: 'POST',
      headers: PYTHON_HEADERS,
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
 * Detect if uploaded data is food-industry related (client-side detection)
 * This avoids a network call by using keyword matching on column names.
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
  // Lowered threshold: 2+ financial keywords is enough for template bar
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

// ==================== P1: 食品行业分析模板 ====================

export interface FoodTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Pre-defined chart plan — skip recommendChart when applying template */
  chartPlan: Array<{
    chartType: string;
    xFieldHint: string;        // column name keyword to match
    yFieldHints: string[];     // column name keywords for y-axis
    title: string;
  }>;
  /** KPI column hints */
  kpiHints: string[];
}

/** Built-in food industry analysis templates */
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
 * Returns chart plans with resolved xField/yFields, or null if mapping fails.
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
    // Exact match first
    for (const p of patterns) {
      const exact = allKeys.find(k => k === p);
      if (exact) return exact;
    }
    // Fuzzy match (keyword contains)
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
    // If no hints matched, fall back to first numeric columns
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
