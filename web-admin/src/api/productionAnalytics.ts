/**
 * 生产分析 & 人效分析 API
 * 基于 production_reports 表的实时分析
 */
import { get } from './request';

function getFactoryId(): string {
  try {
    const userStr = localStorage.getItem('cretas_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.factoryId || 'F001';
    }
  } catch {
    // ignore
  }
  return 'F001';
}

function basePath() {
  return `/${getFactoryId()}/production-analytics`;
}

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

interface DateParams {
  startDate?: string;
  endDate?: string;
}

// ==================== 生产分析 ====================

export function getProductionDashboard(params?: DateParams) {
  return get<ProductionDashboard>(`${basePath()}/dashboard`, params);
}

export function getDailyTrend(params?: DateParams) {
  return get<Record<string, unknown>[]>(`${basePath()}/daily-trend`, params);
}

export function getByProduct(params?: DateParams) {
  return get<Record<string, unknown>[]>(`${basePath()}/by-product`, params);
}

export function getByProcess(params?: DateParams) {
  return get<Record<string, unknown>[]>(`${basePath()}/by-process`, params);
}

// ==================== 人效分析 ====================

export function getEfficiencyDashboard(params?: DateParams) {
  return get<EfficiencyDashboard>(`${basePath()}/efficiency/dashboard`, params);
}

export function getWorkerRanking(params?: DateParams) {
  return get<Record<string, unknown>[]>(`${basePath()}/efficiency/workers`, params);
}

export function getEfficiencyTrend(params?: DateParams) {
  return get<Record<string, unknown>[]>(`${basePath()}/efficiency/trend`, params);
}

export function getHoursByProduct(params?: DateParams) {
  return get<Record<string, unknown>[]>(`${basePath()}/efficiency/hours`, params);
}

export function getWorkerProcessCross(params?: DateParams) {
  return get<Record<string, unknown>[]>(`${basePath()}/efficiency/cross`, params);
}
