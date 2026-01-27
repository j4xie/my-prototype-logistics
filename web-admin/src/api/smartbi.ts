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

// ==================== Python SmartBI 直连 API ====================

/**
 * Python SmartBI 服务 URL
 * 优先使用环境变量，否则使用默认值
 */
const PYTHON_SMARTBI_URL = import.meta.env.VITE_SMARTBI_URL || 'http://139.196.165.140:8083';

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
  type: 'line' | 'bar' | 'pie' | 'waterfall' | 'radar' | 'gauge';
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
 * 图表构建
 */
export async function buildChart(params: {
  chartType: string;
  data: unknown[];
  xField: string;
  yFields: string[];
  title?: string;
}): Promise<{ success: boolean; option?: Record<string, unknown>; error?: string }> {
  try {
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/chart/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  } catch (error) {
    console.error('buildChart 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '图表构建请求失败'
    };
  }
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
