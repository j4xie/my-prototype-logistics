/**
 * SmartBI Gold Reads API client.
 *
 * Wraps the 5 /api/smartbi/gold/* endpoints exposed by the Python backend
 * (week 4 Phase B v0 of Unified Data Layer v1 spec).
 *
 * NOTE: pythonFetch auto-converts snake_case → camelCase via transformKeys
 * (see common.ts line ~190). So these interfaces describe the CAMELCASE
 * shape the caller actually receives, not the raw Python JSON.
 */
import { pythonFetch, PYTHON_LLM_TIMEOUT_MS } from './common';

export interface DateRangeQuery {
  factoryId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface FinanceSummary {
  factoryId: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  billCount: number;
  avgBillValue: number | null;
  storeCount: number;
  dayCount: number;
  topStores: Array<{
    storeId: number;
    storeName: string;
    revenue: number;
    billCount: number;
  }>;
}

export interface DailyTrend {
  factoryId: string;
  startDate: string;
  endDate: string;
  points: Array<{
    date: string;
    revenue: number;
    billCount: number;
    avgBillValue: number | null;
  }>;
}

export interface TopProducts {
  factoryId: string;
  startMonth: string;
  endMonth: string;
  topProducts: Array<{
    productId: number;
    productName: string;
    qtySold: number;
    revenue: number;
    billCount: number;
  }>;
}

export interface ChannelBreakdown {
  factoryId: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  channels: Array<{
    channelId: number;
    channelName: string;
    amount: number;
    billCount: number;
    sharePct: number;
  }>;
}

export interface DiscountBreakdown {
  factoryId: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  discounts: Array<{
    discountId: number;
    discountName: string;
    amount: number;
    billCount: number;
    sharePct: number;
  }>;
}

export interface KpiSummary {
  factoryId: string;
  startDate: string;
  endDate: string;
  revenue: number;
  billCount: number;
  itemCount: number;
  customerCount: number;
  storeCount: number;
  dayCount: number;
  avgBillValue: number | null;
  itemsPerBill: number | null;
  avgPerCapita: number | null;
}

const _q = (args: DateRangeQuery & { topN?: number }): string => {
  const p = new URLSearchParams({
    factory_id: args.factoryId,
    start_date: args.startDate,
    end_date: args.endDate,
  });
  if (args.topN !== undefined) p.set('top_n', String(args.topN));
  return p.toString();
};

export async function getFinanceSummary(args: DateRangeQuery & { topNStores?: number }): Promise<FinanceSummary> {
  const p = new URLSearchParams({
    factory_id: args.factoryId,
    start_date: args.startDate,
    end_date: args.endDate,
  });
  if (args.topNStores !== undefined) p.set('top_n_stores', String(args.topNStores));
  return (await pythonFetch(`/api/smartbi/gold/finance-summary?${p}`, {
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  })) as FinanceSummary;
}

export async function getDailyTrend(args: DateRangeQuery): Promise<DailyTrend> {
  return (await pythonFetch(`/api/smartbi/gold/daily-trend?${_q(args)}`, {
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  })) as DailyTrend;
}

export async function getTopProducts(args: DateRangeQuery & { topN?: number }): Promise<TopProducts> {
  return (await pythonFetch(`/api/smartbi/gold/top-products?${_q(args)}`, {
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  })) as TopProducts;
}

export async function getChannelBreakdown(args: DateRangeQuery & { topN?: number }): Promise<ChannelBreakdown> {
  return (await pythonFetch(`/api/smartbi/gold/channel-breakdown?${_q(args)}`, {
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  })) as ChannelBreakdown;
}

export async function getDiscountBreakdown(args: DateRangeQuery & { topN?: number }): Promise<DiscountBreakdown> {
  return (await pythonFetch(`/api/smartbi/gold/discount-breakdown?${_q(args)}`, {
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  })) as DiscountBreakdown;
}

export async function getKpiSummary(args: DateRangeQuery): Promise<KpiSummary> {
  return (await pythonFetch(`/api/smartbi/gold/kpi-summary?${_q(args)}`, {
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  })) as KpiSummary;
}
