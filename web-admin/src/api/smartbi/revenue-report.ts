/**
 * QHJ 收入管理报表 API client.
 *
 * Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §8 + §10.7
 * Backend: 6 endpoints under /api/smartbi/{factory_id}/revenue-report/* (Phase G).
 *
 * Per project convention:
 *   - Snake_case JSON keys (mirror Python Pydantic models)
 *   - getSmartBIBasePath() includes /${factoryId} so callers don't repeat it
 *   - Blob downloads use responseType:'blob' so axios interceptor doesn't try
 *     to JSON-parse the body
 *   - Custom response headers (X-Cache-Hit etc.) require CORS expose_headers
 *     in main.py (Phase G2)
 */
import { request } from '@/api/request';
import { getSmartBIBasePath } from './common';

const BASE = () => `${getSmartBIBasePath()}/revenue-report`;

// ─── Type contracts (mirror Python) ─────────────────────────────────────

export interface UploadResultItem {
  filename: string;
  status: 'ok' | 'duplicate' | 'unknown';
  report_types?: string[];
  existing_upload_id?: number;
  preview_headers?: string[];
}

export interface UploadResponse {
  batch_id: string;
  files: UploadResultItem[];
}

export interface RevenueReportParams {
  store_names: string[];     // empty array = all stores
  date_from: string;          // YYYY-MM-DD
  date_to: string;            // YYYY-MM-DD
  meal_periods: string[];     // ['午市'] | ['晚市'] | [] = all
}

export interface GenerateSummary {
  store_count: number;
  date_range: string;
  gold_materialized_at: string;
  file_size_bytes: number;
  cache_hit: boolean;
  is_stale: boolean;
}

export interface PrepareResponse {
  cache_key: string;
  download_url: string;
  summary: GenerateSummary;
}

export interface StoreEntry {
  store_id: number;
  name: string;
}

export interface AuditLogEntry {
  id: number;
  generated_by: string;
  generated_at: string;
  params_snapshot: Record<string, unknown>;
  file_size_bytes: number;
  status: 'ok' | 'error';
  cache_hit: boolean;
  duration_ms: number;
  gold_materialized_at: string | null;
}

// ─── Endpoints ───────────────────────────────────────────────────────────

/**
 * Upload N files at once. Backend dispatches each by filename (pos_router).
 * Returns per-file status; ok / duplicate / unknown.
 */
export async function uploadPosFiles(files: File[]): Promise<UploadResponse> {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const res = await request.post(`${BASE()}/upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600_000, // 10 min — large CSVs
  });
  return res.data as UploadResponse;
}

/**
 * Trigger generation; returns metadata + download_url (no streaming).
 * Used by the AI Chat LLM Tool path; UI can also use to pre-warm cache.
 */
export async function prepare(params: RevenueReportParams) {
  const res = await request.post(`${BASE()}/prepare`, params);
  return res.data as PrepareResponse;
}

/**
 * Stream xlsx; returns blob + parsed response headers (X-Cache-Hit etc.).
 */
export async function generateAndDownload(params: RevenueReportParams): Promise<{
  blob: Blob;
  cacheHit: boolean;
  goldMaterializedAt: string;
  storeCount: number;
  isStale: boolean;
}> {
  const res = await request.post(`${BASE()}/generate`, params, {
    responseType: 'blob',
  });
  return {
    blob: res.data as Blob,
    cacheHit: (res.headers['x-cache-hit'] as string) === 'true',
    goldMaterializedAt: (res.headers['x-gold-materialized-at'] as string) || '',
    storeCount: parseInt((res.headers['x-store-count'] as string) || '0', 10),
    isStale: (res.headers['x-is-stale'] as string) === 'true',
  };
}

export async function listStores(
  excludeClosed = true,
): Promise<StoreEntry[]> {
  const res = await request.get(`${BASE()}/stores`, {
    params: { exclude_closed: excludeClosed },
  });
  return (res.data as StoreEntry[]) ?? [];
}

export async function getAuditLog(limit = 20): Promise<AuditLogEntry[]> {
  const res = await request.get(`${BASE()}/audit-log`, {
    params: { limit },
  });
  return (res.data as AuditLogEntry[]) ?? [];
}
