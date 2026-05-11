/**
 * SmartBI 配置管理 API
 * 提供数据源、图表模板、公式、阈值等配置管理
 */
// R21-F4 fix: route through /api/mobile/* (nginx-proxied) instead of unroutable /api/admin/*
// Backend controller moved from /api/admin/smartbi-config to /api/mobile/smartbi-config
// to match nginx proxy rules (same pattern as R20-F2 workflow-designer fix).
import { get, post, put, del } from './request';
import type { ApiResponse } from '@/types/api';

// ==================== 类型定义 ====================

/**
 * 数据源配置
 */
export interface DataSource {
  id: number;
  name: string;
  code: string;
  type: 'DATABASE' | 'API' | 'EXCEL' | 'CUSTOM';
  description?: string;
  connectionConfig?: string;
  refreshInterval?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 图表模板配置
 *
 * Issue #336 fix: align FE field names with BE entity (SmartBiChartTemplate).
 * Pre-fix mismatch: name→templateName, code→templateCode, type→chartType,
 * configJson→chartOptions. dataSourceId/dataSourceName not on entity (dropped).
 * Jackson silent-dropped all 4 → CRUD entirely broken.
 */
export interface ChartTemplate {
  id: number;
  templateName: string;
  templateCode: string;
  chartType: 'LINE' | 'BAR' | 'PIE' | 'GAUGE' | 'HEATMAP' | 'MAP' | 'RANKING' | 'KPI' | 'COMBINED' | 'RADAR' | 'SCATTER' | 'FUNNEL' | 'AREA' | 'STACKED_BAR' | 'DOUGHNUT' | 'COMBO';
  category: string;
  description?: string;
  chartOptions?: string;
  applicableMetrics?: string;
  dataMapping?: string;
  layoutConfig?: string;
  factoryId?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 计算公式配置
 */
export interface Formula {
  id: number;
  name: string;
  code: string;
  expression: string;
  description?: string;
  variables?: string;
  resultType: 'NUMBER' | 'PERCENTAGE' | 'TEXT';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 阈值配置
 *
 * 字段名必须与 BE entity SmartBiAlertThreshold 列名一致 (Issue #279 修复):
 * - warningValue / criticalValue: BigDecimal 阈值
 * - comparisonOperator: 短枚举 GT/LT/GTE/LTE/EQ
 *   (DB 历史数据可能含长枚举 LESS_THAN/GREATER_THAN, 显示层兼容两种)
 *
 * 旧字段名 warningThreshold/criticalThreshold/direction 与 BE 列名不匹配,
 * Jackson 静默丢弃导致 PUT 200 但 DB 不变 (silent-drop)。
 */
export interface ThresholdConfig {
  id: number;
  metricCode: string;
  metricName: string;
  warningValue?: number;
  criticalValue?: number;
  comparisonOperator?: string;
  unit?: string;
  description?: string;
  isActive: boolean;
  updatedAt?: string;
}

/**
 * 分页响应
 */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ==================== 数据源 API ====================
//
// Issue #280: BE controller (SmartBIConfigController data-sources endpoints)
// requires factoryId either as query param OR in body. FE previously sent
// neither, so create/update returned 200 envelope with success=false
// "factoryId 必填". All 6 endpoints below now accept factoryId as a required
// parameter and forward it as a query param (matches chat1 diag T1 success
// path).

/**
 * 获取数据源列表
 */
export function getDataSources(
  factoryId: string,
  params?: {
    page?: number;
    size?: number;
    keyword?: string;
    type?: string;
    isActive?: boolean;
  }
): Promise<ApiResponse<PageResponse<DataSource>>> {
  return get('/smartbi-config/data-sources', { params: { ...params, factoryId } });
}

/**
 * 获取单个数据源
 */
export function getDataSource(factoryId: string, id: number): Promise<ApiResponse<DataSource>> {
  return get(`/smartbi-config/data-sources/${id}`, { params: { factoryId } });
}

/**
 * 创建数据源
 */
export function createDataSource(
  factoryId: string,
  data: Partial<DataSource>
): Promise<ApiResponse<DataSource>> {
  return post(`/smartbi-config/data-sources?factoryId=${encodeURIComponent(factoryId)}`, data);
}

/**
 * 更新数据源
 */
export function updateDataSource(
  factoryId: string,
  id: number,
  data: Partial<DataSource>
): Promise<ApiResponse<DataSource>> {
  return put(`/smartbi-config/data-sources/${id}?factoryId=${encodeURIComponent(factoryId)}`, data);
}

/**
 * 删除数据源
 */
export function deleteDataSource(factoryId: string, id: number): Promise<ApiResponse<void>> {
  return del(`/smartbi-config/data-sources/${id}?factoryId=${encodeURIComponent(factoryId)}`);
}

/**
 * 测试数据源连接
 */
export function testDataSourceConnection(
  factoryId: string,
  id: number
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return post(`/smartbi-config/data-sources/${id}/test?factoryId=${encodeURIComponent(factoryId)}`);
}

// ==================== 图表模板 API ====================
//
// Issue #336 fix: URL was `/charts` (dead, BE 404) — corrected to `/chart-templates`.
// BE controller endpoints: GET /chart-templates (list, no pagination),
// GET /chart-templates/{code}, POST /chart-templates, PUT /chart-templates/{id},
// DELETE /chart-templates/{id}. BE list only accepts {category, chartType} query
// params (no keyword/isActive/page/size). BE returns List<>, NOT PageResponse<>.
// Preview endpoint does not exist on BE.

/**
 * 获取图表模板列表
 *
 * BE GET /chart-templates accepts only `category` + `chartType` query params and
 * returns `List<SmartBiChartTemplate>` (no pagination). Frontend pagination /
 * keyword filtering must be done client-side or via separate audit ticket.
 */
export function getChartTemplates(params?: {
  category?: string;
  chartType?: string;
}): Promise<ApiResponse<ChartTemplate[]>> {
  return get('/smartbi-config/chart-templates', { params });
}

/**
 * 获取单个图表模板（按 code 而非 id — BE 路径参数是 templateCode）
 */
export function getChartTemplate(code: string, factoryId?: string): Promise<ApiResponse<ChartTemplate>> {
  return get(`/smartbi-config/chart-templates/${encodeURIComponent(code)}`, {
    params: factoryId ? { factoryId } : undefined,
  });
}

/**
 * 创建图表模板
 */
export function createChartTemplate(data: Partial<ChartTemplate>): Promise<ApiResponse<ChartTemplate>> {
  return post('/smartbi-config/chart-templates', data);
}

/**
 * 更新图表模板（BE PUT /chart-templates/{id} — id 是 Long entity PK）
 */
export function updateChartTemplate(id: number, data: Partial<ChartTemplate>): Promise<ApiResponse<ChartTemplate>> {
  return put(`/smartbi-config/chart-templates/${id}`, data);
}

/**
 * 删除图表模板（BE DELETE /chart-templates/{id} — id 是 Long entity PK）
 */
export function deleteChartTemplate(id: number): Promise<ApiResponse<void>> {
  return del(`/smartbi-config/chart-templates/${id}`);
}

// ==================== 公式 API ====================

/**
 * 获取公式列表
 */
export function getFormulas(params?: {
  page?: number;
  size?: number;
  keyword?: string;
  resultType?: string;
  isActive?: boolean;
}): Promise<ApiResponse<PageResponse<Formula>>> {
  return get('/smartbi-config/formulas', { params });
}

/**
 * 获取单个公式
 */
export function getFormula(id: number): Promise<ApiResponse<Formula>> {
  return get(`/smartbi-config/formulas/${id}`);
}

/**
 * 创建公式
 */
export function createFormula(data: Partial<Formula>): Promise<ApiResponse<Formula>> {
  return post('/smartbi-config/formulas', data);
}

/**
 * 更新公式
 */
export function updateFormula(id: number, data: Partial<Formula>): Promise<ApiResponse<Formula>> {
  return put(`/smartbi-config/formulas/${id}`, data);
}

/**
 * 删除公式
 */
export function deleteFormula(id: number): Promise<ApiResponse<void>> {
  return del(`/smartbi-config/formulas/${id}`);
}

/**
 * 验证公式表达式
 */
export function validateFormula(expression: string): Promise<ApiResponse<{ valid: boolean; error?: string }>> {
  return post('/smartbi-config/formulas/validate', { expression });
}

// ==================== 阈值 API ====================

/**
 * 获取阈值配置列表
 */
export function getThresholds(params?: {
  keyword?: string;
  isActive?: boolean;
}): Promise<ApiResponse<ThresholdConfig[]>> {
  return get('/smartbi-config/thresholds', { params });
}

/**
 * 批量更新阈值配置
 */
export function updateThresholds(data: Partial<ThresholdConfig>[]): Promise<ApiResponse<void>> {
  return put('/smartbi-config/thresholds', data);
}

/**
 * 更新单个阈值配置
 */
export function updateThreshold(id: number, data: Partial<ThresholdConfig>): Promise<ApiResponse<ThresholdConfig>> {
  return put(`/smartbi-config/thresholds/${id}`, data);
}
