/**
 * Materialized analytics API client.
 * Endpoints (via pythonFetch to Python 8083, proxied at /smartbi-api):
 *   GET  /api/smartbi/analytics/cached/{uploadId}
 *   POST /api/smartbi/analytics/materialize/{uploadId}
 */
import { pythonFetch } from './common';

export interface MaterializedKpis {
  [key: string]: string | number | boolean | null;
}

// Note: pythonFetch (common.ts) auto-converts snake_case → camelCase via transformKeys.
// Interfaces below use camelCase to match the runtime shape.
export interface MaterializedResult {
  code: string;
  title: string;
  data: Record<string, unknown>;
  chartConfig: Record<string, unknown> | null;
  kpis: MaterializedKpis;
  insightText: string | null;
  domain: string;
  schemaVersion: number;
  createdAt: string | null;
}

export interface MaterializedCacheResponse {
  success: boolean;
  cached: boolean;
  uploadId: number;
  factoryId: string;
  count: number;
  results: MaterializedResult[];
}

export interface MaterializeTriggerResponse {
  success: boolean;
  uploadId: number;
  factoryId: string;
  domain: string;
  totalTemplates: number;
  applied: number;
  skipped: number;
  errored: number;
  saved: number;
  wallMs: number;
}

export function fetchCachedAnalytics(uploadId: number | string): Promise<MaterializedCacheResponse> {
  return pythonFetch(`/api/smartbi/analytics/cached/${uploadId}`, {
    method: 'GET',
  }) as Promise<MaterializedCacheResponse>;
}

export function triggerMaterialization(uploadId: number | string): Promise<MaterializeTriggerResponse> {
  return pythonFetch(`/api/smartbi/analytics/materialize/${uploadId}`, {
    method: 'POST',
    timeoutMs: 120_000,  // 200K-row materialize can take 50-60s
  }) as Promise<MaterializeTriggerResponse>;
}
