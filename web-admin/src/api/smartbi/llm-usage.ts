/**
 * LLM Usage Admin API — per-factory / per-model token consumption views.
 *
 * Backend: Python /api/smartbi/admin/llm-usage/*
 */
import { adminGet } from '../request';

const BASE = '/smartbi-api/api/smartbi/admin/llm-usage';

export interface UsageSummary {
  window_days: number;
  window: {
    calls: number; input_tok: number; output_tok: number; total_tok: number;
    avg_ms: number; errors: number;
  };
  today: { calls: number; total_tok: number; errors: number };
}

export interface ByModelRow {
  provider: string; model: string; calls: number;
  input_tok: number; output_tok: number; total_tok: number;
  avg_ms: number; errors: number;
}

export interface ByFactoryRow {
  factory_id: string; calls: number;
  input_tok: number; output_tok: number; total_tok: number;
  models_used: number; avg_ms: number; errors: number;
  last_call_at: string;
}

export interface ByProviderRow {
  provider: string; calls: number; models: number;
  total_tok: number; avg_ms: number; errors: number;
}

export interface RecentRow {
  ts: string; provider: string; model: string; caller: string | null;
  input_tokens: number; output_tokens: number; total_tokens: number;
  latency_ms: number | null; status_code: number;
  factory_id: string | null; error_snippet: string | null;
}

export interface HourlyRow {
  hour: string; model: string; calls: number; total_tok: number;
}

export const llmUsageApi = {
  summary: (days = 7) => adminGet<UsageSummary>(`${BASE}/summary?days=${days}`),
  byModel: (days = 7) => adminGet<ByModelRow[]>(`${BASE}/by-model?days=${days}`),
  byFactory: (days = 7) => adminGet<ByFactoryRow[]>(`${BASE}/by-factory?days=${days}`),
  byFactoryModel: (days = 7, factoryId?: string) =>
    adminGet<ByFactoryRow[]>(`${BASE}/by-factory-model?days=${days}${factoryId ? '&factory_id=' + encodeURIComponent(factoryId) : ''}`),
  byProvider: (days = 7) => adminGet<ByProviderRow[]>(`${BASE}/by-provider-account?days=${days}`),
  recent: (limit = 100) => adminGet<RecentRow[]>(`${BASE}/recent?limit=${limit}`),
  hourly: (hours = 24) => adminGet<HourlyRow[]>(`${BASE}/hourly?hours=${hours}`),
};
