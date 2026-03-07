/**
 * Restaurant Analytics API
 * Calls Python SmartBI endpoints for restaurant-specific analytics.
 */
import { pythonFetch, PYTHON_LLM_TIMEOUT_MS } from './smartbi/common'
import type { RestaurantAnalyticsResult, RestaurantUploadItem } from '@/types/restaurant-analytics'

interface AnalyticsResponse {
  success: boolean
  cached?: boolean
  cachedAt?: string
  data?: RestaurantAnalyticsResult
}

interface UploadsResponse {
  success: boolean
  data: RestaurantUploadItem[]
}

/**
 * Get cached restaurant analytics for an upload.
 */
export async function getRestaurantAnalytics(uploadId: number): Promise<AnalyticsResponse> {
  return pythonFetch(`/api/smartbi/restaurant-analytics/${uploadId}`) as Promise<AnalyticsResponse>
}

/**
 * Compute (or return cached) restaurant analytics for an upload.
 */
export async function computeRestaurantAnalytics(uploadId: number, force = false): Promise<AnalyticsResponse> {
  const query = force ? '?force=true' : ''
  return pythonFetch(`/api/smartbi/restaurant-analytics/${uploadId}${query}`, {
    method: 'POST',
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  }) as Promise<AnalyticsResponse>
}

/**
 * List uploads detected as restaurant data.
 */
export async function listRestaurantUploads(): Promise<UploadsResponse> {
  return pythonFetch('/api/smartbi/restaurant-analytics/uploads') as Promise<UploadsResponse>
}

/**
 * Get restaurant industry benchmarks.
 */
export async function getRestaurantBenchmarks(): Promise<{ success: boolean; data?: Record<string, unknown> }> {
  return pythonFetch('/api/smartbi/benchmark/restaurant') as Promise<{ success: boolean; data?: Record<string, unknown> }>
}
