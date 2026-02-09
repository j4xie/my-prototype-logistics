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

function getAbortSignal(key: string): AbortSignal {
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
}): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chat/general-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        data: params.data,
        fields: params.fields,
        table_type: params.table_type
      })
    });
    return response.json();
  } catch (error) {
    console.error('chatAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Chat 分析请求失败'
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_ids: params.uploadIds,
        sheet_names: params.sheetNames
      })
    });
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: params.uploadId,
        compare_upload_id: params.compareUploadId
      })
    });
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
}): Promise<{ success: boolean; option?: Record<string, unknown>; error?: string }> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chart/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const result = await response.json();
    // Python returns { config: {...} }, map to { option: {...} } for ECharts
    return { success: result.success, option: result.config, error: result.error };
  } catch (error) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, fields: null }),
      signal
    });
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
 * AI 洞察生成 - 基于数据生成分析洞察
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
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/insight/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: params.data,
        analysisContext: params.analysisContext,
        maxInsights: params.maxInsights || 5
      })
    });
    return response.json();
  } catch (error) {
    console.error('generateInsights 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI 洞察生成请求失败'
    };
  }
}

// ==================== 智能图表标题 + KPI 选择 ====================

/**
 * 根据图表类型和字段名生成语义化标题
 * 输出人性化标题，避免原始列名暴露
 * "行次 - 2025-01-01, 2025-02-01 对比" → "各项目1-2月对比"
 */
export function generateChartTitle(chartType: string, xField: string, yFields: string[]): string {
  // Humanize field names
  const xLabel = humanizeColumnName(xField);

  // Check if yFields are date columns → compress to range
  const isDateY = yFields.length > 0 && yFields.every(f => /^\d{4}-\d{2}/.test(f) || /^\d{1,2}月$/.test(f));
  const yLabel = isDateY
    ? compressMonthRange(yFields)
    : yFields.length === 1
      ? humanizeColumnName(yFields[0])
      : yFields.slice(0, 2).map(humanizeColumnName).join('、');

  // Detect if data likely has unit context (万/亿)
  const typeVerb: Record<string, string> = {
    'line': '趋势',
    'bar': '对比',
    'pie': '构成占比',
    'waterfall': '增减分析',
    'scatter': '相关性',
    'area': '趋势',
    'combination': '综合对比',
    'radar': '多维对比',
    'bar_horizontal': '排行',
  };

  const verb = typeVerb[chartType] || '分析';

  switch (chartType) {
    case 'line':
      if (xLabel === '月份' || xField === '月份') return `${yLabel} 月度趋势`;
      return isDateY ? `各${xLabel}${yLabel}趋势` : `${yLabel} 变化趋势`;
    case 'bar':
      if (xLabel === '月份' || xField === '月份') return `${yLabel} 月度对比`;
      return isDateY ? `各${xLabel}${yLabel}对比` : (xLabel ? `各${xLabel}${yLabel}对比` : `${yLabel} 对比分析`);
    case 'pie':
      return `${yLabel} 构成占比`;
    case 'waterfall':
      return `${yLabel} 增减分析`;
    case 'scatter':
      return yFields.length >= 1 && xField
        ? `${xLabel} vs ${humanizeColumnName(yFields[0])} 相关性`
        : '散点分布';
    case 'area':
      return xField === '月份' ? `${yLabel} 累计趋势` : `${yLabel} 面积分布`;
    case 'combination':
      return `${yLabel} 综合对比`;
    case 'radar':
      return '多维度对比分析';
    case 'bar_horizontal':
      return `${yLabel} 排行`;
    default:
      return `${yLabel} ${verb}`;
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

    const trend = (extCol.trend as 'up' | 'down' | 'flat') || undefined;
    const trendPct = extCol.trendPercent;
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
}

// ==================== Analysis Cache API ====================

/**
 * 从 Python 缓存获取已持久化的分析结果
 * 命中时 < 1s 返回完整 EnrichResult，避免 30-40s 重算
 */
export async function getCachedAnalysis(uploadId: number): Promise<EnrichResult | null> {
  try {
    const res = await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/analysis-cache/${uploadId}`);
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
    console.warn('[Cache] Failed to load cached analysis:', e);
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
      headers: { 'Content-Type': 'application/json' },
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
    console.warn('[Cache] Failed to save analysis to cache:', e);
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
    });
  } catch (e) {
    console.warn('[Cache] Failed to invalidate cache:', e);
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
};

/**
 * 将原始列名转换为人性化显示名
 * "2025-01-01" → "1月"
 * "2025-01-01_2" → "1月(累计)"
 * "actual_amount" → "实际金额"
 * "行次" → "项目"
 */
export function humanizeColumnName(col: string): string {
  // 1. YYYY-MM-DD or YYYY-MM-DD_N patterns
  const dateMatch = col.match(/^(\d{4})-(\d{2})-(\d{2})(?:_(\d+))?$/);
  if (dateMatch) {
    const month = parseInt(dateMatch[2]);
    const suffix = dateMatch[4] ? `(${dateMatch[4]})` : '';
    return `${month}月${suffix}`;
  }
  // 2. YYYY-MM pattern
  const ymMatch = col.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    return `${parseInt(ymMatch[2])}月`;
  }
  // 3. Exact match in lookup table
  if (COLUMN_NAME_MAP[col]) return COLUMN_NAME_MAP[col];
  // 4. Case-insensitive lookup
  const lower = col.toLowerCase();
  for (const [key, val] of Object.entries(COLUMN_NAME_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }
  // 5. Already Chinese or no match — return as-is
  return col;
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
        const barTitle = filteredData.length > 20
          ? generateChartTitle('bar', labelField, yFields) + ' (前20项)'
          : generateChartTitle('bar', labelField, yFields);
        plans.push({
          chartType: 'bar',
          data: chartData,
          xField: labelField,
          yFields,
          title: barTitle
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
      const pieData = cleanedData
        .filter(row => row[labelField] != null && row[valueField!] != null)
        .filter(row => { const v = Number(row[valueField!]); return !isNaN(v) && v > 0; })
        .slice(0, 10);
      if (pieData.length >= 2) {
        plans.push({
          chartType: 'pie',
          data: pieData,
          xField: labelField,
          yFields: [valueField],
          title: generateChartTitle('pie', labelField, [valueField]) + (pieData.length < cleanedData.filter(r => r[labelField] != null && r[valueField!] != null).filter(r => Number(r[valueField!]) > 0).length ? ` (前${pieData.length}项)` : '')
        });
        usedTypes.add('pie');
      }
    }
  }

  // 策略 4: 从 Python recommendations 中补充不同类型
  for (const rec of recommendations) {
    if (plans.length >= 5) break;
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
  if (plans.length < 4 && monthlyColumns.length > 0 && labelField && !usedTypes.has('bar_horizontal')) {
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
  if (plans.length < 5 && labelField && numCols.length > 0 && !usedTypes.has('waterfall')) {
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
  if (plans.length < 5 && monthlyColumns.length >= 2 && labelField && !usedTypes.has('area')) {
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
  if (plans.length < 5 && labelField && numCols.length >= 2 && !usedTypes.has('combination')) {
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

  return plans.slice(0, 5);
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal
    });
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
export async function getForecast(data: number[], periods = 3): Promise<{
  success: boolean;
  predictions: number[];
  lowerBound: number[];
  upperBound: number[];
}> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/forecast/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, periods, algorithm: 'auto' })
    });
    return response.json();
  } catch (error) {
    console.error('getForecast 失败:', error);
    return { success: false, predictions: [], lowerBound: [], upperBound: [] };
  }
}

/**
 * Sheet 数据增强 - 多图表仪表板版本
 * 编排：清洗 → recommend + quickSummary (并行) → buildChartPlan → batchBuild → forecast → insights
 */
export async function enrichSheetAnalysis(uploadId: number, forceRefresh = false): Promise<EnrichResult> {
  // Cache-first: try loading from persistent cache before full enrichment
  if (!forceRefresh) {
    try {
      const cached = await getCachedAnalysis(uploadId);
      if (cached && cached.success) {
        console.log(`[Cache] Hit for uploadId=${uploadId}, skipping enrichment`);
        return cached;
      }
    } catch (e) {
      console.warn('[Cache] Error checking cache, proceeding with enrichment:', e);
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
    // 1. 获取持久化的表格数据
    let t0 = performance.now();
    const tableRes = await getUploadTableData(uploadId, 0, 2000);
    if (!tableRes.success || !tableRes.data?.data?.length) {
      return { success: false, error: '无法获取上传数据' };
    }
    const rawData = tableRes.data.data as Record<string, unknown>[];
    tick('getUploadTableData', t0);

    // 2. 清洗列名
    t0 = performance.now();
    const renamedData = renameMeaninglessColumns(rawData);
    tick('rename', t0);

    // 3. 提取文字上下文
    t0 = performance.now();
    const textContext = extractTextContext(renamedData);
    tick('extractTextContext', t0);

    // 4. 清洗数据
    t0 = performance.now();
    const cleanedData = cleanDataForChart(renamedData);
    tick('cleanData', t0);
    if (!cleanedData.length) {
      return { success: false, error: '清洗后无有效数据' };
    }

    // 5. 并行：推荐图表 + KPI 摘要
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

    // 6. 检测月份列 + 增强数值列检测 + 增强 labelField + 构建多图表计划
    t0 = performance.now();
    const allKeys = Object.keys(cleanedData[0]);
    const monthlyColumns = detectMonthlyColumns(allKeys);
    // 增强数值列检测：修复 Python 混合类型误判
    const enhancedNumericCols = detectNumericColumns(cleanedData, dataInfo.numericColumns, allKeys);
    const enhancedDataInfo = { ...dataInfo, numericColumns: enhancedNumericCols };
    const labelField = detectLabelField(cleanedData, dataInfo.categoricalColumns, enhancedNumericCols, allKeys);
    const plans = buildChartPlan(cleanedData, recommendations, enhancedDataInfo, monthlyColumns, labelField);
    tick('detect+buildPlan', t0);

    // 7. 批量构建图表
    t0 = performance.now();
    let charts: Array<{ chartType: string; title: string; config: Record<string, unknown> }> = [];
    if (plans.length > 0) {
      const batchRes = await batchBuildCharts(plans, abortController.signal);
      if (batchRes.success && batchRes.charts?.length) {
        charts = batchRes.charts
          .map((c, i) => ({           // i preserves 1:1 correspondence with plans[i]
            chartType: c.chartType,
            title: plans[i]?.title || '数据分析',
            config: c.config,
            xField: plans[i]?.xField || '',
            anomalies: c.anomalies  // Phase 3.1: IQR anomaly data
          }))
          .filter(c => c.config);     // filter AFTER mapping to preserve index alignment
      }

      // fallback: 如果 batch 失败，逐个构建
      if (charts.length === 0) {
        for (const plan of plans) {
          const res = await buildChart({
            chartType: plan.chartType,
            data: plan.data,
            xField: plan.xField,
            yFields: plan.yFields,
            title: plan.title
          });
          if (res.success && res.option) {
            charts.push({ chartType: plan.chartType, title: plan.title, config: res.option, xField: plan.xField });
          }
        }
      }
    }
    tick('batchBuildCharts', t0);

    // 7.5 Forecast trend lines for line charts (Phase 3.2)
    t0 = performance.now();
    for (const chart of charts) {
      if (chart.chartType !== 'line') continue;
      const config = chart.config as any;
      const series = config?.series;
      if (!Array.isArray(series)) continue;

      // Only forecast first numeric series to avoid API overload
      const firstSeries = series.find((s: any) => s.type === 'line' && Array.isArray(s.data));
      if (!firstSeries) continue;
      const numericData = firstSeries.data.filter((v: unknown) => typeof v === 'number' && !isNaN(v as number));
      if (numericData.length < 5) continue;

      try {
        const forecastRes = await getForecast(numericData, 3);
        if (forecastRes.success && forecastRes.predictions?.length) {
          // Extend xAxis with forecast labels
          const xData = config.xAxis?.data;
          if (Array.isArray(xData)) {
            for (let i = 0; i < forecastRes.predictions.length; i++) {
              xData.push(`预测${i + 1}`);
            }
          }

          // Add forecast dashed series
          const padded = new Array(numericData.length).fill(null);
          // Connect from last actual to first forecast
          padded[padded.length - 1] = numericData[numericData.length - 1];
          series.push({
            name: `${firstSeries.name}(预测)`,
            type: 'line',
            data: [...padded, ...forecastRes.predictions.map((v: number) => Math.round(v * 100) / 100)],
            lineStyle: { type: 'dashed', width: 2 },
            symbol: 'diamond',
            symbolSize: 6,
            itemStyle: { color: '#9ca3af' }
          });

          // Add confidence interval area (双线 + areaStyle，不使用 stack 避免累加错误)
          if (forecastRes.lowerBound?.length && forecastRes.upperBound?.length) {
            const basePad = new Array(numericData.length).fill(null);
            // 下界线（不可见，作为面积底线）
            series.push({
              name: '置信下界',
              type: 'line',
              data: [...basePad, ...forecastRes.lowerBound.map((v: number) => Math.round(v * 100) / 100)],
              lineStyle: { opacity: 0 },
              symbol: 'none',
              silent: true,
              z: -1
            });
            // 上界线（不可见，areaStyle 填充到下界）
            series.push({
              name: '置信区间',
              type: 'line',
              data: [...basePad, ...forecastRes.upperBound.map((v: number) => Math.round(v * 100) / 100)],
              lineStyle: { opacity: 0 },
              symbol: 'none',
              areaStyle: { color: 'rgba(156,163,175,0.18)', origin: 'auto' },
              silent: true,
              z: -1
            });
          }
        }
      } catch {
        // Forecast is optional, don't block on failure
      }
    }
    tick('forecast', t0);

    // 7.6 Pre-compute financial metrics for richer LLM context (P0.2)
    t0 = performance.now();
    const financialMetrics = computeFinancialMetrics(cleanedData, monthlyColumns, labelField);
    tick('computeFinancialMetrics', t0);

    // 8. 生成 AI 洞察
    t0 = performance.now();
    let aiAnalysis = '';
    let structuredAI: StructuredAIData | undefined;
    const insightData = cleanedData.slice(0, 100);
    const columnNames = allKeys.map(humanizeColumnName).join(', ');
    const contextParts = [`数据列: ${columnNames}`];
    if (textContext) {
      contextParts.push(textContext);
    }
    if (financialMetrics) {
      contextParts.push(formatFinancialContext(financialMetrics));
    }
    const insightRes = await generateInsights({
      data: insightData,
      analysisContext: contextParts.join('\n'),
      maxInsights: 5
    });
    if (insightRes.success && insightRes.insights?.length) {
      // 提取 _meta 类型的结构化数据
      const metaInsight = insightRes.insights.find(i => i.type === '_meta');
      const normalInsights = insightRes.insights.filter(i => i.type !== '_meta');

      if (metaInsight) {
        const meta = metaInsight as Record<string, unknown>;
        structuredAI = {
          executiveSummary: (meta.executive_summary as string) || (meta.text as string) || '',
          riskAlerts: (meta.risk_alerts as StructuredAIData['riskAlerts']) || [],
          opportunities: (meta.opportunities as StructuredAIData['opportunities']) || []
        };
      }

      aiAnalysis = normalInsights
        .map(i => {
          let line = `**${i.type}**: ${i.text}`;
          if (i.recommendation) line += `\n建议: ${i.recommendation}`;
          return line;
        })
        .join('\n\n');
    }
    tick('generateInsights', t0);

    // 9. 组装 KPI 摘要（同步前端增强的数值列类型，修复 Python 混合类型误判导致 KPI 只显示 1 个）
    const kpiSummary = summaryRes.success
      ? { rowCount: summaryRes.rowCount, columnCount: summaryRes.columnCount, columns: summaryRes.columns }
      : undefined;
    if (kpiSummary && enhancedNumericCols.length > 0) {
      const numericSet = new Set(enhancedNumericCols);
      kpiSummary.columns = kpiSummary.columns.map(col => {
        if (!numericSet.has(col.name) || ['int64', 'float64', 'number', 'int32', 'float32'].includes(col.type)) {
          return col;
        }
        // Python marked as object but frontend detected numeric — compute sum from data
        let sum = 0;
        for (const row of cleanedData) {
          const v = row[col.name];
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          if (!isNaN(n)) sum += n;
        }
        return { ...col, type: 'float64', sum };
      });
    }

    // Output timing table
    console.table(timings);

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
      timings
    };

    // Save to persistent cache (fire-and-forget, don't block UI)
    if (hasContent) {
      saveAnalysisToCache(uploadId, getFactoryId(), enrichResult).catch(e =>
        console.warn('[Cache] Failed to save:', e)
      );
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
 * 从原始数据中提取文字上下文（标题行、备注、编制说明等）
 * 利润表中的文字行如 "一、营业收入"、"编制说明"、"备注" 等在 cleanDataForChart 时会被过滤，
 * 这里提前提取出来，传递给 AI 分析以保留业务语义。
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
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
