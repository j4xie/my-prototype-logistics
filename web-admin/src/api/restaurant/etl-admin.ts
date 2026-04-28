/**
 * API client for restaurant ETL admin endpoints.
 * Consumes Task 1.4 Python endpoints:
 *   POST /api/smartbi/restaurant/etl/trigger
 *   GET  /api/smartbi/restaurant/etl/status
 *   GET  /api/smartbi/restaurant/etl/all-status
 *
 * Uses pythonFetch (snake→camel auto-convert) per W0.4 finding 6.
 */
import { pythonFetch } from '@/api/smartbi/common';

export interface EtlFailure {
  runAt: string;
  attempt: number;
  errorClass: string;
  errorMsgShort: string;
}

export interface EtlStatusResponse {
  factoryId: string;
  factoryName?: string | null;
  lastSuccessRun: string | null;
  lastStatus: 'success' | 'failed' | 'running' | 'queued' | 'never_ran';
  rowCounts: Record<string, number>;
  recentFailures: EtlFailure[];
}

export interface TriggerResponse {
  jobId: string;
  status: 'queued' | 'running';
  eta: number;
}

export interface AllStatusFactory {
  factoryId: string;
  factoryName: string;
  lastSuccessRun: string | null;
}

export interface AllStatusResponse {
  factories: AllStatusFactory[];
}

export async function triggerEtl(factoryId: string): Promise<TriggerResponse> {
  return pythonFetch('/api/smartbi/restaurant/etl/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factoryId }),
  }) as Promise<TriggerResponse>;
}

export async function fetchEtlStatus(factoryId: string): Promise<EtlStatusResponse> {
  const qs = new URLSearchParams({ factoryId }).toString();
  return pythonFetch(`/api/smartbi/restaurant/etl/status?${qs}`) as Promise<EtlStatusResponse>;
}

export async function fetchAllEtlStatus(): Promise<AllStatusResponse> {
  return pythonFetch('/api/smartbi/restaurant/etl/all-status') as Promise<AllStatusResponse>;
}
