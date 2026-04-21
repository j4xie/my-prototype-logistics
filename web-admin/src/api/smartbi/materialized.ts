/**
 * Materialized analytics API client.
 * Endpoints:
 *   GET  /api/smartbi/analytics/cached/{uploadId}
 *   POST /api/smartbi/analytics/materialize/{uploadId}
 */
import { request } from './common';

export interface MaterializedKpis {
  [key: string]: string | number | boolean | null;
}

export interface MaterializedResult {
  code: string;
  title: string;
  data: Record<string, unknown>;
  chart_config: Record<string, unknown> | null;
  kpis: MaterializedKpis;
  insight_text: string | null;
  domain: string;
  schema_version: number;
  created_at: string | null;
}

export interface MaterializedCacheResponse {
  success: boolean;
  cached: boolean;
  upload_id: number;
  factory_id: string;
  count: number;
  results: MaterializedResult[];
}

export interface MaterializeTriggerResponse {
  success: boolean;
  upload_id: number;
  factory_id: string;
  domain: string;
  total_templates: number;
  applied: number;
  skipped: number;
  errored: number;
  saved: number;
  wall_ms: number;
}

export function fetchCachedAnalytics(uploadId: number | string): Promise<MaterializedCacheResponse> {
  return request({
    url: `/smartbi-api/api/smartbi/analytics/cached/${uploadId}`,
    method: 'GET',
  });
}

export function triggerMaterialization(uploadId: number | string): Promise<MaterializeTriggerResponse> {
  return request({
    url: `/smartbi-api/api/smartbi/analytics/materialize/${uploadId}`,
    method: 'POST',
  });
}
