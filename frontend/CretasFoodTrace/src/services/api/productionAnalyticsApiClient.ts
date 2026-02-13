import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';

/**
 * 生产分析 & 人效分析 API
 * 基于 production_reports 表的实时分析
 */

// ==================== 类型定义 ====================

export interface KPIItem {
  key: string;
  label: string;
  value: number;
  unit: string;
  change: number;
  changeType: 'up' | 'down' | 'flat';
  gradient: 'purple' | 'pink' | 'blue' | 'green';
}

export interface ProductionDashboard {
  kpis: KPIItem[];
  dailyTrend: Record<string, unknown>[];
  byProduct: Record<string, unknown>[];
  byProcess: Record<string, unknown>[];
}

export interface EfficiencyDashboard {
  kpis: KPIItem[];
  workerRanking: Record<string, unknown>[];
  dailyTrend: Record<string, unknown>[];
  hoursByProduct: Record<string, unknown>[];
  workerProcessCross: Record<string, unknown>[];
}

interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

interface DateParams {
  startDate?: string;
  endDate?: string;
}

function basePath(factoryId?: string): string {
  const fid = factoryId || requireFactoryId();
  return `/api/mobile/${fid}/production-analytics`;
}

// ==================== 生产分析 ====================

export async function getProductionDashboard(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<ProductionDashboard>> {
  const response = await apiClient.get(`${basePath(factoryId)}/dashboard`, { params });
  return response.data;
}

export async function getDailyTrend(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<Record<string, unknown>[]>> {
  const response = await apiClient.get(`${basePath(factoryId)}/daily-trend`, { params });
  return response.data;
}

export async function getByProduct(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<Record<string, unknown>[]>> {
  const response = await apiClient.get(`${basePath(factoryId)}/by-product`, { params });
  return response.data;
}

export async function getByProcess(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<Record<string, unknown>[]>> {
  const response = await apiClient.get(`${basePath(factoryId)}/by-process`, { params });
  return response.data;
}

// ==================== 人效分析 ====================

export async function getEfficiencyDashboard(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<EfficiencyDashboard>> {
  const response = await apiClient.get(`${basePath(factoryId)}/efficiency/dashboard`, { params });
  return response.data;
}

export async function getWorkerRanking(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<Record<string, unknown>[]>> {
  const response = await apiClient.get(`${basePath(factoryId)}/efficiency/workers`, { params });
  return response.data;
}

export async function getEfficiencyTrend(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<Record<string, unknown>[]>> {
  const response = await apiClient.get(`${basePath(factoryId)}/efficiency/trend`, { params });
  return response.data;
}

export async function getHoursByProduct(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<Record<string, unknown>[]>> {
  const response = await apiClient.get(`${basePath(factoryId)}/efficiency/hours`, { params });
  return response.data;
}

export async function getWorkerProcessCross(
  params?: DateParams,
  factoryId?: string
): Promise<ApiResponse<Record<string, unknown>[]>> {
  const response = await apiClient.get(`${basePath(factoryId)}/efficiency/cross`, { params });
  return response.data;
}
