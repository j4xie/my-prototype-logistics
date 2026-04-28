/**
 * API client for restaurant data completeness endpoint.
 * Consumes Task 2.1 Python endpoint:
 *   GET /api/smartbi/restaurant/completeness?factoryId=
 *
 * Uses pythonFetch (snake→camel auto-convert) per W0.4 finding 6.
 * No `as any` — all types explicitly defined.
 */
import { pythonFetch } from '@/api/smartbi/common';

export interface CompletenessModule {
  id: string;
  name: string;
  hasData: boolean;
  recordCount: number;
  lastUpdated: string | null;
  coverage: number;
  missingHints: string[];
  windowDays: number;
}

export interface CompletenessResponse {
  factoryId: string;
  factoryName: string;
  factoryType: string;
  factoryAgeDays: number;
  modules: CompletenessModule[];
  overallCompleteness: number;
  /** 'hit' when served from cache, 'miss' on fresh computation */
  cachedAt: string;
}

export async function fetchCompleteness(factoryId: string): Promise<CompletenessResponse> {
  const qs = new URLSearchParams({ factoryId }).toString();
  return pythonFetch(`/api/smartbi/restaurant/completeness?${qs}`) as Promise<CompletenessResponse>;
}
