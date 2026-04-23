/**
 * Week 6 — batch read of materialized template results.
 * Backend: GET /api/mobile/{factoryId}/smart-bi/gold/analysis-results
 *          (Python proxied via Java gateway; auth via JWT)
 * Or direct: GET /api/smartbi/gold/analysis-results (Python direct; needs X-Factory-Id)
 */
import { get } from './common';

export interface AnalysisResultItem {
  upload_id: number;
  template_code: string;
  domain: string | null;
  analysis_type: string;
  analysis_result: unknown;
  chart_configs: unknown[] | null;
  kpi_values: Record<string, unknown> | null;
  insights: unknown[] | null;
  created_at: string | null;
  upload_label: string | null;
  upload_created_at: string | null;
}

export interface AnalysisResultsResponse {
  items: AnalysisResultItem[];
  missing_codes: string[];
  never_materialized_codes: string[];
}

export function getAnalysisResults(
  factoryId: string,
  codes: string[],
  opts: { uploadId?: number } = {},
) {
  const params: Record<string, string | number> = {
    template_codes: codes.join(','),
  };
  if (opts.uploadId !== undefined) {
    params.upload_id = opts.uploadId;
  }
  return get<AnalysisResultsResponse>(
    `/${factoryId}/smart-bi/gold/analysis-results`,
    { params },
  );
}
