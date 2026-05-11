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
 */
export interface ChartTemplate {
  id: number;
  name: string;
  code: string;
  type: 'LINE' | 'BAR' | 'PIE' | 'GAUGE' | 'HEATMAP' | 'MAP' | 'RANKING' | 'KPI' | 'COMBINED';
  category: string;
  description?: string;
  configJson?: string;
  dataSourceId?: number;
  dataSourceName?: string;
  isActive: boolean;
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
 */
export interface ThresholdConfig {
  id: number;
  metricCode: string;
  metricName: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  direction: 'UP' | 'DOWN';
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

/**
 * 获取图表模板列表
 */
export function getChartTemplates(params?: {
  page?: number;
  size?: number;
  keyword?: string;
  type?: string;
  category?: string;
  isActive?: boolean;
}): Promise<ApiResponse<PageResponse<ChartTemplate>>> {
  return get('/smartbi-config/charts', { params });
}

/**
 * 获取单个图表模板
 */
export function getChartTemplate(id: number): Promise<ApiResponse<ChartTemplate>> {
  return get(`/smartbi-config/charts/${id}`);
}

/**
 * 创建图表模板
 */
export function createChartTemplate(data: Partial<ChartTemplate>): Promise<ApiResponse<ChartTemplate>> {
  return post('/smartbi-config/charts', data);
}

/**
 * 更新图表模板
 */
export function updateChartTemplate(id: number, data: Partial<ChartTemplate>): Promise<ApiResponse<ChartTemplate>> {
  return put(`/smartbi-config/charts/${id}`, data);
}

/**
 * 删除图表模板
 */
export function deleteChartTemplate(id: number): Promise<ApiResponse<void>> {
  return del(`/smartbi-config/charts/${id}`);
}

/**
 * 预览图表
 */
export function previewChart(id: number): Promise<ApiResponse<unknown>> {
  return get(`/smartbi-config/charts/${id}/preview`);
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
