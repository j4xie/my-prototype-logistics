/**
 * SmartBI Gold Reads API client.
 *
 * Wraps the 5 /api/smartbi/gold/* endpoints exposed by the Python backend
 * (week 4 Phase B v0 of Unified Data Layer v1 spec). Each function returns
 * the raw JSON shape the endpoint produces; no camelCase transform applied
 * because the Vue page knows to use snake_case from these routes.
 */
import { pythonFetch, PYTHON_LLM_TIMEOUT_MS } from './common';

export interface DateRangeQuery {
  factoryId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface FinanceSummary {
  factory_id: string;
  start_date: string;
  end_date: string;
  total_revenue: number;
  bill_count: number;
  avg_bill_value: number | null;
  store_count: number;
  day_count: number;
  top_stores: Array<{
    store_id: number;
    store_name: string;
    revenue: number;
    bill_count: number;
  }>;
}

export interface DailyTrend {
  factory_id: string;
  start_date: string;
  end_date: string;
  points: Array<{
    date: string;
    revenue: number;
    bill_count: number;
    avg_bill_value: number | null;
  }>;
}

export interface TopProducts {
  factory_id: string;
  start_month: string;
  end_month: string;
  top_products: Array<{
    product_id: number;
    product_name: string;
    qty_sold: number;
    revenue: number;
    bill_count: number;
  }>;
}

export interface ChannelBreakdown {
  factory_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  channels: Array<{
    channel_id: number;
    channel_name: string;
    amount: number;
    bill_count: number;
    share_pct: number;
  }>;
}

export interface KpiSummary {
  factory_id: string;
  start_date: string;
  end_date: string;
  revenue: number;
  bill_count: number;
  item_count: number;
  customer_count: number;
  store_count: number;
  day_count: number;
  avg_bill_value: number | null;
  items_per_bill: number | null;
  avg_per_capita: number | null;
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

export async function getKpiSummary(args: DateRangeQuery): Promise<KpiSummary> {
  return (await pythonFetch(`/api/smartbi/gold/kpi-summary?${_q(args)}`, {
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  })) as KpiSummary;
}
