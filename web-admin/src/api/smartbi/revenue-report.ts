/**
 * QHJ 收入管理报表 API client.
 *
 * Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §8 + §10.7
 * Backend: 6 endpoints under /api/smartbi/{factory_id}/revenue-report/* (Phase G).
 *
 * Per project convention:
 *   - Snake_case JSON keys (mirror Python Pydantic models)
 *   - Python endpoints live at /api/smartbi/{factory}/* — NOT the Java
 *     /api/mobile/{factory}/smart-bi/* path. We override axios baseURL='' to
 *     bypass the default '/api/mobile' prefix and call Python directly.
 *   - Blob downloads use responseType:'blob' so axios interceptor doesn't try
 *     to JSON-parse the body
 *   - Custom response headers (X-Cache-Hit etc.) require CORS expose_headers
 *     in main.py (Phase G2)
 */
import request from '@/api/request';
import { getFactoryId } from './common';

const BASE = () => `/api/smartbi/${getFactoryId()}/revenue-report`;

// Python endpoints are NOT under axios' default /api/mobile baseURL.
// Passing baseURL: '' tells axios to use the absolute path verbatim, so the
// browser hits /api/smartbi/... which nginx routes to Python 8083/8084.
const PY = { baseURL: '' };

// For /generate: response interceptor unwraps res.data by default, losing
// res.headers. _keepResponse=true makes the interceptor return the raw
// AxiosResponse so we can read X-Cache-Hit / X-Gold-Materialized-At /
// X-Store-Count / X-Is-Stale (set by main.py CORS expose_headers).
const PY_BLOB = { baseURL: '', responseType: 'blob' as const, _keepResponse: true };

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

export interface PreviewData {
  block1_yoy: Array<Record<string, unknown>>;     // 可比同比 first N rows
  block2_mom: Array<Record<string, unknown>>;     // 环比 first N rows
  block3_meal_split: Array<Record<string, unknown>>;  // 堂食外卖占比 first N rows
  meta: {
    date_from?: string;
    date_to?: string;
    yoy_available?: boolean;
    yoy_note?: string | null;
  };
}

export interface PrepareResponse {
  cache_key: string;
  download_url: string;
  summary: GenerateSummary;
  preview?: PreviewData;
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
    ...PY,
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
  const res = await request.post(`${BASE()}/prepare`, params, PY);
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
  // PY_BLOB sets _keepResponse: true so we get raw AxiosResponse with .headers.
  const res = await request.post(`${BASE()}/generate`, params, PY_BLOB);
  // Axios lowercases all response header names regardless of server casing.
  const h = (res as { headers: Record<string, string> }).headers || {};
  return {
    blob: (res as { data: Blob }).data,
    cacheHit: h['x-cache-hit'] === 'true',
    goldMaterializedAt: h['x-gold-materialized-at'] || '',
    storeCount: parseInt(h['x-store-count'] || '0', 10),
    isStale: h['x-is-stale'] === 'true',
  };
}

export async function listStores(
  excludeClosed = true,
): Promise<StoreEntry[]> {
  const res = await request.get(`${BASE()}/stores`, {
    ...PY,
    params: { exclude_closed: excludeClosed },
  });
  return (res.data as StoreEntry[]) ?? [];
}

export async function getAuditLog(limit = 20): Promise<AuditLogEntry[]> {
  const res = await request.get(`${BASE()}/audit-log`, {
    ...PY,
    params: { limit },
  });
  return (res.data as AuditLogEntry[]) ?? [];
}
