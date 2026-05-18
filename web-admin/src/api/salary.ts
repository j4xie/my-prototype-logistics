/**
 * P1-40 H-WAGE-FULL MVP — 月度工资单 API client.
 *
 * Backend: SalaryItemController at /api/mobile/{factoryId}/hr/salaries
 *
 * @since 2026-05-17
 */
import { get, post, put, del } from './request';
import type { ApiResponse } from '@/types/api';

export type SalaryStatus = 'DRAFT' | 'CONFIRMED' | 'PAID';

export interface SalaryItem {
  id: string;
  factoryId: string;
  userId: number;
  yearMonth: string;
  baseSalary: number;
  socialInsuranceEmployee: number;
  socialInsuranceEmployer: number;
  providentFundEmployee: number;
  providentFundEmployer: number;
  taxableIncome: number;
  personalTax: number;
  netSalary: number;
  status: SalaryStatus;
  remark?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: number | null;
  paidAt?: string | null;
  paidBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryComputePreview {
  baseSalary: number;
  socialInsuranceEmployee: number;
  socialInsuranceEmployer: number;
  providentFundEmployee: number;
  providentFundEmployer: number;
  taxableIncome: number;
  personalTax: number;
  netSalary: number;
}

export interface SalaryMonthlySummary {
  totalBase: number;
  totalSocialEmployee: number;
  totalPersonalTax: number;
  totalNet: number;
}

export interface SalaryListParams {
  yearMonth?: string;
  status?: SalaryStatus;
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

// R1 防呆: 输入 baseSalary 后实时算 social/tax/net (不写库).
export function previewSalaryCompute(
  factoryId: string,
  baseSalary: number
): Promise<ApiResponse<SalaryComputePreview>> {
  return post<SalaryComputePreview>(
    `/${factoryId}/hr/salaries/preview-compute`,
    { baseSalary }
  );
}

export function createSalary(
  factoryId: string,
  payload: { userId: number; yearMonth: string; baseSalary: number; remark?: string }
): Promise<ApiResponse<SalaryItem>> {
  return post<SalaryItem>(`/${factoryId}/hr/salaries`, payload);
}

export function updateSalary(
  factoryId: string,
  id: string,
  payload: { baseSalary?: number; remark?: string }
): Promise<ApiResponse<SalaryItem>> {
  return put<SalaryItem>(`/${factoryId}/hr/salaries/${id}`, payload);
}

export function recomputeSalary(
  factoryId: string,
  id: string
): Promise<ApiResponse<SalaryItem>> {
  return post<SalaryItem>(`/${factoryId}/hr/salaries/${id}/recompute`);
}

export function confirmSalary(
  factoryId: string,
  id: string
): Promise<ApiResponse<SalaryItem>> {
  return post<SalaryItem>(`/${factoryId}/hr/salaries/${id}/confirm`);
}

export function markSalaryPaid(
  factoryId: string,
  id: string
): Promise<ApiResponse<SalaryItem>> {
  return post<SalaryItem>(`/${factoryId}/hr/salaries/${id}/pay`);
}

export function deleteSalary(
  factoryId: string,
  id: string
): Promise<ApiResponse<void>> {
  return del<void>(`/${factoryId}/hr/salaries/${id}`);
}

export function getSalary(
  factoryId: string,
  id: string
): Promise<ApiResponse<SalaryItem>> {
  return get<SalaryItem>(`/${factoryId}/hr/salaries/${id}`);
}

export function listSalaries(
  factoryId: string,
  params: SalaryListParams = {}
): Promise<ApiResponse<SpringPage<SalaryItem>>> {
  return get<SpringPage<SalaryItem>>(`/${factoryId}/hr/salaries`, { params });
}

export function getMonthlySummary(
  factoryId: string,
  yearMonth: string
): Promise<ApiResponse<SalaryMonthlySummary>> {
  return get<SalaryMonthlySummary>(
    `/${factoryId}/hr/salaries/summary`,
    { params: { yearMonth } }
  );
}
