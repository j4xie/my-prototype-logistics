/**
 * P1-40 H-WAGE 专项扣除 follow-up — 个税专项附加扣除 API client.
 *
 * Backend: SalarySpecialDeductionController at /api/mobile/{factoryId}/hr/special-deductions
 *
 * @since 2026-05-17
 */
import { get, post, put, del } from './request';
import type { ApiResponse } from '@/types/api';

export type DeductionType =
  | 'CHILD_EDUCATION'
  | 'CONTINUING_EDUCATION'
  | 'SERIOUS_ILLNESS'
  | 'HOUSING_LOAN'
  | 'HOUSING_RENT'
  | 'ELDER_SUPPORT';

export type DeductionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface SalarySpecialDeduction {
  id: string;
  factoryId: string;
  userId: number;
  deductionType: DeductionType;
  monthlyAmount: number;
  validFrom: string;       // ISO yyyy-MM-dd
  validTo?: string | null; // null = 长期有效
  status: DeductionStatus;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface DeductionListParams {
  userId?: number;
  status?: DeductionStatus;
  deductionType?: DeductionType;
  page?: number;
  size?: number;
}

export interface DeductionMonthPreview {
  userId: number;
  yearMonth: string;
  activeDeductions: SalarySpecialDeduction[];
  totalMonthlyDeduction: number;
}

export interface CreateDeductionPayload {
  userId: number;
  deductionType: DeductionType;
  monthlyAmount: number;
  validFrom: string;
  validTo?: string | null;
  notes?: string;
}

export interface UpdateDeductionPayload {
  monthlyAmount?: number;
  validTo?: string | null;
  notes?: string;
}

// R1 防呆: 拉取该 user+yearMonth 当月所有 ACTIVE 扣除明细 + 合计
export function previewDeductionForMonth(
  factoryId: string,
  userId: number,
  yearMonth: string
): Promise<ApiResponse<DeductionMonthPreview>> {
  return get<DeductionMonthPreview>(
    `/${factoryId}/hr/special-deductions/preview-for-month`,
    { params: { userId, yearMonth } }
  );
}

export function createDeduction(
  factoryId: string,
  payload: CreateDeductionPayload
): Promise<ApiResponse<SalarySpecialDeduction>> {
  return post<SalarySpecialDeduction>(
    `/${factoryId}/hr/special-deductions`,
    payload
  );
}

export function updateDeduction(
  factoryId: string,
  id: string,
  payload: UpdateDeductionPayload
): Promise<ApiResponse<SalarySpecialDeduction>> {
  return put<SalarySpecialDeduction>(
    `/${factoryId}/hr/special-deductions/${id}`,
    payload
  );
}

export function changeDeductionStatus(
  factoryId: string,
  id: string,
  status: DeductionStatus
): Promise<ApiResponse<SalarySpecialDeduction>> {
  return post<SalarySpecialDeduction>(
    `/${factoryId}/hr/special-deductions/${id}/status`,
    { status }
  );
}

export function deleteDeduction(
  factoryId: string,
  id: string
): Promise<ApiResponse<void>> {
  return del<void>(`/${factoryId}/hr/special-deductions/${id}`);
}

export function getDeduction(
  factoryId: string,
  id: string
): Promise<ApiResponse<SalarySpecialDeduction>> {
  return get<SalarySpecialDeduction>(`/${factoryId}/hr/special-deductions/${id}`);
}

export function listDeductions(
  factoryId: string,
  params: DeductionListParams = {}
): Promise<ApiResponse<SpringPage<SalarySpecialDeduction>>> {
  return get<SpringPage<SalarySpecialDeduction>>(
    `/${factoryId}/hr/special-deductions`,
    { params }
  );
}
