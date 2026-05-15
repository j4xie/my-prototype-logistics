/**
 * SmartBI API - Upload Status Dashboard
 *
 * Read-only listing of recent uploads per factory. Backed by Python endpoint
 * GET /api/smartbi/{factory_id}/uploads/list (smartbi/api/upload_status.py).
 *
 * RLS-enforced — caller's JWT factory_id must match the URL factory_id, or
 * the Python endpoint returns 403.
 */
import { getFactoryId, pythonFetch } from './common';

// ==================== Types ====================

/**
 * User-facing status bucket. Backend collapses the 7-value DB enum to 3:
 *   PENDING / PROCESSING / PARSING / MAPPED / RETRYING → "PENDING"
 *   COMPLETED                                          → "COMPLETED"
 *   FAILED / ARCHIVED                                  → "ERROR"
 */
export type UploadStatusBucket = 'PENDING' | 'COMPLETED' | 'ERROR';

/**
 * One upload entry. snake_case keys are auto-transformed to camelCase by
 * pythonFetch (see common.ts transformKeys). The interface below uses the
 * post-transform camelCase shape.
 */
export interface UploadStatusItem {
  uploadId: number;
  filename: string | null;
  reportType: string;       // e.g. "meal_split" / "daily_summary" / "unknown"
  status: UploadStatusBucket;
  fileSizeBytes: number | null;
  uploadedAt: string | null;       // ISO 8601 LocalDateTime (Java Jackson format)
  completedAt: string | null;      // null unless status === 'COMPLETED'
  errorMessage: string | null;
  bronzeRows: number | null;
  silverRows: number | null;       // not tracked on smart_bi_pg_excel_uploads
}

export interface UploadStatusListResponse {
  factoryId: string;
  total: number;
  uploads: UploadStatusItem[];
}

export interface UploadStatusListOptions {
  /** Max rows to return. Default 50, max 200. */
  limit?: number;
  /** Look-back window in days. Default 7, max 90. */
  days?: number;
  /** Allow caller to cancel via AbortController.signal. */
  signal?: AbortSignal;
}

// ==================== API ====================

/**
 * Fetch recent uploads for the caller's factory (factory_id resolved from
 * the JWT-backed user blob in localStorage, then enforced server-side).
 *
 * Sort order: most recent uploaded_at DESC. RLS handles tenant isolation.
 */
export async function listUploadStatus(
  options: UploadStatusListOptions = {},
): Promise<UploadStatusListResponse> {
  const factoryId = getFactoryId();
  const params = new URLSearchParams();
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options.days !== undefined) {
    params.set('days', String(options.days));
  }
  const qs = params.toString();
  const path = `/api/smartbi/${encodeURIComponent(factoryId)}/uploads/list${qs ? `?${qs}` : ''}`;

  return await pythonFetch<UploadStatusListResponse>(path, {
    method: 'GET',
    signal: options.signal,
  });
}
