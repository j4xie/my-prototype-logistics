/**
 * #833 H-WAGE follow-up — 工厂级 社保 / 公积金 费率配置 API client.
 *
 * Backend: HrInsuranceConfigController at /api/mobile/{factoryId}/hr/insurance-config
 *
 * @since 2026-05-18
 */
import { get, post } from './request';
import type { ApiResponse } from '@/types/api';

export type InsuranceStatus = 'ACTIVE' | 'ARCHIVED';

export interface HrInsuranceConfig {
  id: string;
  factoryId: string;
  employeePensionRate: number;
  employerPensionRate: number;
  employeeMedicalRate: number;
  employerMedicalRate: number;
  employeeUnemploymentRate: number;
  employerUnemploymentRate: number;
  employeeProvidentFundRate: number;
  employerProvidentFundRate: number;
  baseSalaryLowerBound?: number | null;
  baseSalaryUpperBound?: number | null;
  effectiveFrom: string;       // ISO yyyy-MM-dd
  status: InsuranceStatus;
  remark?: string | null;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveInsuranceConfigPayload {
  employeePensionRate: number;
  employerPensionRate: number;
  employeeMedicalRate: number;
  employerMedicalRate: number;
  employeeUnemploymentRate: number;
  employerUnemploymentRate: number;
  employeeProvidentFundRate: number;
  employerProvidentFundRate: number;
  baseSalaryLowerBound?: number | null;
  baseSalaryUpperBound?: number | null;
  effectiveFrom: string;
  remark?: string;
}

/** 获取当前生效的配置 (yearMonth 可选, 默认本月). */
export function getCurrentInsuranceConfig(
  factoryId: string,
  yearMonth?: string
): Promise<ApiResponse<HrInsuranceConfig>> {
  return get<HrInsuranceConfig>(
    `/${factoryId}/hr/insurance-config/current`,
    { params: yearMonth ? { yearMonth } : {} }
  );
}

/** 历史版本列表 (含 ACTIVE + ARCHIVED, effectiveFrom 倒序). */
export function listInsuranceConfigHistory(
  factoryId: string
): Promise<ApiResponse<HrInsuranceConfig[]>> {
  return get<HrInsuranceConfig[]>(`/${factoryId}/hr/insurance-config/history`);
}

/** 保存新版本 (老 ACTIVE 自动 → ARCHIVED). */
export function saveInsuranceConfig(
  factoryId: string,
  payload: SaveInsuranceConfigPayload
): Promise<ApiResponse<HrInsuranceConfig>> {
  return post<HrInsuranceConfig>(
    `/${factoryId}/hr/insurance-config`,
    payload
  );
}

/** R5 防呆: 重置为法定默认值. */
export function resetInsuranceConfigDefaults(
  factoryId: string
): Promise<ApiResponse<HrInsuranceConfig>> {
  return post<HrInsuranceConfig>(`/${factoryId}/hr/insurance-config/reset-defaults`, {});
}
