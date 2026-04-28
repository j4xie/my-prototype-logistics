/**
 * API client for restaurant outlier detection endpoints.
 * Consumes Task 7 Python endpoints:
 *   GET  /api/restaurant/outliers
 *   POST /api/restaurant/outliers/dismiss
 *   DELETE /api/restaurant/outliers/dismiss/{id}
 *
 * Uses pythonFetch (snake→camel auto-convert) per Phase A pattern.
 * No `as any` — all types explicitly defined.
 * Reviewer R2: baselineSource field required for transparency badge rendering.
 */

import { pythonFetch } from '@/api/smartbi/common';

/**
 * A single outlier detection result (pending review).
 */
export interface OutlierItem {
  anomalyDate: string;
  kpiKind: string;
  kpiLabel: string;
  value: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  deviationX: number;
  severity: 'high' | 'medium';
  direction: 'above' | 'below';
  // Reviewer R2: Transparent baseline source marking for admin awareness
  baselineSource: 'self' | 'global';
  baselineN: '<10' | '10-49' | '50-99' | '100-499' | '500+';
}

/**
 * A previously dismissed outlier (historical record).
 */
export interface DismissedItem {
  id: number;
  anomalyDate: string;
  kpiKind: string;
  kpiLabel: string;
  dismissedBy: string;
  dismissedAt: string;
  snapshotValue: number;
  snapshotQ1: number;
  snapshotQ3: number;
  snapshotBaselineSource: 'self' | 'global';
}

/**
 * Response from GET /api/restaurant/outliers.
 */
export interface OutliersResponse {
  factoryId: string;
  windowDays: number;
  cachedAt: string;
  summary: {
    totalAnomalies: number;
    dismissedThisMonth: number;
    insufficientKpis: string[];
  };
  outliers: OutlierItem[];
  dismissed: DismissedItem[];
}

/**
 * Payload for POST /api/restaurant/outliers/dismiss.
 */
export interface DismissPayload {
  factoryId: string;
  anomalyDate: string;
  kpiKind: string;
  snapshotValue: number;
  snapshotQ1: number;
  snapshotQ3: number;
  snapshotBaselineSource: 'self' | 'global';
}

/**
 * Fetch outliers for a given factory.
 *
 * @param factoryId - Factory ID (required)
 * @param windowDays - Analysis window in days (default 30, range 1-365)
 * @returns Promise resolving to OutliersResponse
 * @throws Error on network failure, 401 (not authenticated), 403 (insufficient permission)
 */
export async function fetchOutliers(
  factoryId: string,
  windowDays = 30
): Promise<OutliersResponse> {
  const qs = new URLSearchParams({
    factoryId,
    windowDays: String(windowDays),
  }).toString();
  return pythonFetch(`/api/restaurant/outliers?${qs}`) as Promise<OutliersResponse>;
}

/**
 * Mark an outlier as dismissed (non-anomalous).
 *
 * @param payload - Dismissal payload with outlier details
 * @returns Promise resolving to { id: number } (dismissal record ID)
 * @throws Error on 400 (validation), 401 (not authenticated), 403 (permission),
 *         409 (already dismissed)
 */
export async function dismissOutlier(payload: DismissPayload): Promise<{ id: number }> {
  return pythonFetch('/api/restaurant/outliers/dismiss', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  }) as Promise<{ id: number }>;
}

/**
 * Restore a previously dismissed outlier to pending status.
 *
 * @param id - Dismissal record ID
 * @returns Promise resolving to void (204 No Content)
 * @throws Error on 401 (not authenticated), 403 (permission), 404 (not found)
 */
export async function undismissOutlier(id: number): Promise<void> {
  await pythonFetch(`/api/restaurant/outliers/dismiss/${id}`, {
    method: 'DELETE',
  });
}
