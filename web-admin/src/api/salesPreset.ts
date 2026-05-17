/**
 * Sprint 4 W2 S-REPORTS-PRESETS — Vue client to Python /api/smartbi/{factoryId}/sales-preset/*.
 *
 * Direct Python fetch (consistent w/ revenue-report / restaurant-analytics pattern).
 * No Java pass-through.
 */
import { pythonFetch } from '@/api/smartbi/common';
import { getFactoryId } from '@/api/smartbi/common';

const base = () => `/api/smartbi/${getFactoryId()}/sales-preset`;

export interface DailyReport {
  date: string;
  orderCount: number;
  revenue: number;
  paid: number;
  unpaid: number;
}

export interface MonthlyReport {
  yearMonth: string;
  orderCount: number;
  revenue: number;
  paid: number;
  unpaid: number;
  daily: Array<{ date: string; orderCount: number; revenue: number }>;
}

export interface YearlyReport {
  year: number;
  orderCount: number;
  revenue: number;
  paid: number;
  monthly: Array<{ month: number; orderCount: number; revenue: number }>;
}

export interface CustomerRankRow {
  rank: number;
  customerId: string;
  customerName: string;
  orderCount: number;
  revenue: number;
  paid: number;
}

export interface ProductRankRow {
  rank: number;
  productTypeId: string;
  productName: string | null;
  totalQty: number;
  unit: string | null;
  revenue: number;
  orderCount: number;
}

export function fetchDailyReport(date?: string): Promise<{ success: boolean; data: DailyReport }> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return pythonFetch(`${base()}/daily-report${q}`);
}

export function fetchMonthlyReport(yearMonth?: string): Promise<{ success: boolean; data: MonthlyReport }> {
  const q = yearMonth ? `?yearMonth=${encodeURIComponent(yearMonth)}` : '';
  return pythonFetch(`${base()}/monthly-report${q}`);
}

export function fetchYearlyReport(year?: number): Promise<{ success: boolean; data: YearlyReport }> {
  const q = year ? `?year=${year}` : '';
  return pythonFetch(`${base()}/yearly-report${q}`);
}

export function fetchCustomerRank(
  startDate?: string, endDate?: string, limit = 20,
): Promise<{ success: boolean; data: { startDate: string; endDate: string; rank: CustomerRankRow[] } }> {
  const q = new URLSearchParams();
  if (startDate) q.set('startDate', startDate);
  if (endDate) q.set('endDate', endDate);
  q.set('limit', String(limit));
  return pythonFetch(`${base()}/customer-rank?${q.toString()}`);
}

export function fetchProductRank(
  startDate?: string, endDate?: string, limit = 20,
): Promise<{ success: boolean; data: { startDate: string; endDate: string; rank: ProductRankRow[] } }> {
  const q = new URLSearchParams();
  if (startDate) q.set('startDate', startDate);
  if (endDate) q.set('endDate', endDate);
  q.set('limit', String(limit));
  return pythonFetch(`${base()}/product-rank?${q.toString()}`);
}
