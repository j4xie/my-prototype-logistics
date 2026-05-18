/**
 * #833 H-WAGE follow-up — 年度汇算 API client.
 *
 * Backend: AnnualTaxSettlementController at /api/mobile/{factoryId}/hr/annual-settlements
 *
 * China 综合所得 annual settlement: aggregates monthly SalaryItem + AnnualBonus + SpecialDeduction
 * for a tax year, applies 7-bracket ANNUAL tax, compares against monthly prepaid sum →
 * refund (negative refundOwed) / owed (positive refundOwed) / 平账 (zero).
 *
 * @since 2026-05-18
 */
import { get, post, del } from './request';
import type { ApiResponse } from '@/types/api';

export type AnnualTaxSettlementStatus = 'DRAFT' | 'CONFIRMED' | 'REPORTED';

export interface AnnualTaxSettlement {
  id: string;
  factoryId: string;
  userId: number;
  taxYear: number;
  totalSalary: number;
  totalBonus: number;
  totalSocialInsurance: number;
  totalProvidentFund: number;
  totalSpecialDeductions: number;
  annualTaxableIncome: number;
  annualTaxDue: number;
  monthlyPrepaidSum: number;
  /** >0: 应补缴, <0: 应退税, =0: 平账 */
  refundOwed: number;
  /** info-only: 一次性年终奖个税合计, 独立计税不进汇算 */
  annualBonusTax: number;
  bracketLabel?: string | null;
  bracketRate?: string | null;
  status: AnnualTaxSettlementStatus;
  monthsCovered: number;
  computedAt?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: number | null;
  reportedAt?: string | null;
  reportedBy?: number | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** R1 防呆 preview payload — 不写库, 仅展示 breakdown. */
export interface AnnualTaxPreview {
  totalSalary: number;
  totalBonus: number;
  totalSocialInsurance: number;
  totalProvidentFund: number;
  totalSpecialDeductions: number;
  annualTaxableIncome: number;
  annualTaxDue: number;
  monthlyPrepaidSum: number;
  refundOwed: number;
  annualBonusTax: number;
  bracketLabel: string;
  bracketRate: string;
  monthsCovered: number;
}

export interface AnnualTaxListParams {
  taxYear?: number;
  status?: AnnualTaxSettlementStatus;
  userId?: number;
  page?: number;
  size?: number;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** R1 防呆: preview (不写库) — 用于"计算"button → dialog 显示应退/应补 */
export function previewAnnualSettlement(
  factoryId: string,
  userId: number,
  taxYear: number
): Promise<ApiResponse<AnnualTaxPreview>> {
  return post<AnnualTaxPreview>(
    `/${factoryId}/hr/annual-settlements/preview`,
    { userId, taxYear }
  );
}

/**
 * R4 防呆 idempotent: 计算并保存. 同 (user, year) re-compute updates existing.
 * R5 防呆: REPORTED 状态返 400 (Service 拒绝).
 */
export function computeAnnualSettlement(
  factoryId: string,
  userId: number,
  taxYear: number
): Promise<ApiResponse<AnnualTaxSettlement>> {
  return post<AnnualTaxSettlement>(
    `/${factoryId}/hr/annual-settlements/compute`,
    { userId, taxYear }
  );
}

export function confirmAnnualSettlement(
  factoryId: string,
  id: string
): Promise<ApiResponse<AnnualTaxSettlement>> {
  return post<AnnualTaxSettlement>(
    `/${factoryId}/hr/annual-settlements/${id}/confirm`
  );
}

/** CONFIRMED → REPORTED: R5 防呆 锁住, 后续 compute 拒改 */
export function reportAnnualSettlement(
  factoryId: string,
  id: string
): Promise<ApiResponse<AnnualTaxSettlement>> {
  return post<AnnualTaxSettlement>(
    `/${factoryId}/hr/annual-settlements/${id}/report`
  );
}

export function deleteAnnualSettlement(
  factoryId: string,
  id: string
): Promise<ApiResponse<void>> {
  return del<void>(`/${factoryId}/hr/annual-settlements/${id}`);
}

export function getAnnualSettlement(
  factoryId: string,
  id: string
): Promise<ApiResponse<AnnualTaxSettlement>> {
  return get<AnnualTaxSettlement>(`/${factoryId}/hr/annual-settlements/${id}`);
}

export function listAnnualSettlements(
  factoryId: string,
  params: AnnualTaxListParams = {}
): Promise<ApiResponse<SpringPage<AnnualTaxSettlement>>> {
  return get<SpringPage<AnnualTaxSettlement>>(
    `/${factoryId}/hr/annual-settlements`,
    { params }
  );
}
