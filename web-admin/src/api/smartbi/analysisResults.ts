/**
 * Week 6 — batch read of materialized template results.
 *
 * Calls Python /api/smartbi/gold/analysis-results directly via
 * pythonFetch (matches existing gold.ts pattern — Java gateway does
 * not proxy /smart-bi/gold/* routes).
 *
 * pythonFetch auto-converts snake_case → camelCase via transformKeys
 * (common.ts:140). Types below describe the CAMELCASE shape the
 * caller receives, not the raw Python JSON.
 */
import { pythonFetch } from './common';

export interface AnalysisResultItem {
  uploadId: number;
  templateCode: string;
  domain: string | null;
  analysisType: string;
  analysisResult: unknown;
  chartConfigs: unknown[] | null;
  kpiValues: Record<string, unknown> | null;
  insights: unknown[] | null;
  createdAt: string | null;
  uploadLabel: string | null;
  uploadCreatedAt: string | null;
}

export interface AnalysisResultsResponse {
  items: AnalysisResultItem[];
  missingCodes: string[];
  neverMaterializedCodes: string[];
}

export async function getAnalysisResults(
  factoryId: string,
  codes: string[],
  opts: { uploadId?: number } = {},
): Promise<AnalysisResultsResponse> {
  const params = new URLSearchParams({
    template_codes: codes.join(','),
    factory_id: factoryId,
  });
  if (opts.uploadId !== undefined) {
    params.set('upload_id', String(opts.uploadId));
  }
  const result = (await pythonFetch(
    `/api/smartbi/gold/analysis-results?${params.toString()}`,
    { method: 'GET' },
  )) as AnalysisResultsResponse;
  return result;
}
