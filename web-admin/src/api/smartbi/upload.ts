/**
 * SmartBI API - Upload Module
 * Upload-related functions: Excel upload, history, confirm, retry, backfill.
 */
import {
  request, get, post,
  getSmartBIBasePath,
  type AnalysisResult,
  type ChartConfig,
  type UploadHistoryItem,
  type FieldDefinition,
  type DynamicAnalysisResponse,
  type TableDataResponse,
  type BackfillResult,
  type BatchBackfillResult,
} from './common';

// Re-export UploadHistoryItem so consumers (RestaurantV2Dashboard etc.) can import it from this module
export type { UploadHistoryItem };

// ==================== Upload Functions ====================

/**
 * Bug #25b (2026-04-18): Detected table region in a stacked sheet.
 */
export interface TableRegion {
  index: number;
  startRow: number;
  endRow: number;
  headerRow: number;
  previewCols: string[];
  sampleRows: number;
  previewData: string[][];
}

export interface DetectRegionsResponse {
  success: boolean;
  sheetName?: string;
  totalRegions: number;
  regions: TableRegion[];
  errorMessage?: string;
}

/**
 * Bug #25b: Detect multiple independent table regions in a single sheet.
 * Calls Python service directly via the smartbi-api proxy — preview only, no persistence.
 */
export async function detectTableRegions(
  file: File,
  options?: { sheetIndex?: number; minBlankSeparator?: number },
): Promise<DetectRegionsResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.sheetIndex !== undefined) {
    formData.append('sheetIndex', String(options.sheetIndex));
  }
  if (options?.minBlankSeparator !== undefined) {
    formData.append('min_blank_separator', String(options.minBlankSeparator));
  }
  try {
    const res = await request.post('/smartbi-api/api/excel/detect-regions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      baseURL: '',
      timeout: 600000,
      // Apr 28 2026: caller falls through to full-file parse on failure (see
      // ExcelUpload.vue handleBeforeUpload line 327). Suppress the interceptor's
      // "操作失败" generic toast — the real error comes from uploadAndAnalyze.
      _silent: true,
    } as Parameters<typeof request.post>[2] & { _silent: true });
    return (res.data || res) as DetectRegionsResponse;
  } catch (error) {
    console.error('detectTableRegions failed:', error);
    return {
      success: false,
      totalRegions: 0,
      regions: [],
      errorMessage: error instanceof Error ? error.message : '区域检测失败',
    };
  }
}

/**
 * Upload Excel file
 */
export function uploadExcel(file: File, dataType: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('data_type', dataType);
  return request.post(`${getSmartBIBasePath()}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * Upload and analyze Excel file (full flow)
 *
 * Via Java backend full flow:
 * 1. Java calls Python auto-parse to parse file
 * 2. Java persists data to PostgreSQL
 * 3. Generates AI insights and chart recommendations
 *
 * Fix: 2026-01-27 - Changed to call Java API to ensure data persists to PostgreSQL
 */
export async function uploadAndAnalyze(file: File, options?: {
  sheetIndex?: number;
  autoConfirm?: boolean;
  dataType?: string;
  // Bug #25b (2026-04-18): when the user picked a stacked-table region,
  // these bounds tell the pipeline which rows to keep (0-indexed, inclusive).
  selectedRegionStart?: number;
  selectedRegionEnd?: number;
  // P0-6 (Apr 20): 真上传进度回调, 取代 ExcelUpload.vue 里假的 90% 静态数字.
  // percent 0-100 是 loaded/total 比例. 上传完成后仍要等后端解析,不会直接 100 一次。
  onUploadProgress?: (percent: number, loaded: number, total: number) => void;
}): Promise<{
  success: boolean;
  parseResult: {
    row_count: number;
    headers: string[];
    preview_data: Record<string, unknown>[];
    field_mappings?: Array<{ original: string; standard: string }>;
    table_type?: string;
    sheet_name?: string;
  };
  analysis?: AnalysisResult;
  chartRecommendations?: ChartConfig[];
  uploadId?: number;
  requiresConfirmation?: boolean;
  error?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.sheetIndex !== undefined) {
    formData.append('sheetIndex', String(options.sheetIndex));
  }
  if (options?.autoConfirm !== undefined) {
    formData.append('autoConfirm', String(options.autoConfirm));
  }
  if (options?.dataType) {
    formData.append('dataType', options.dataType);
  }
  // Bug #25b: forward multi-stacked-table region bounds when user picked one.
  if (options?.selectedRegionStart !== undefined && options?.selectedRegionEnd !== undefined) {
    formData.append('selectedRegionStart', String(options.selectedRegionStart));
    formData.append('selectedRegionEnd', String(options.selectedRegionEnd));
  }

  try {
    const response = await request.post(`${getSmartBIBasePath()}/upload-and-analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // BUG #6 fix (Apr 15 2026): 120s → 600s (10min). 后端允许 500MB 文件, 但原 120s axios
      // 超时在大文件 (19MB POS zip 解压 263MB / 38MB sample) 下必然 timeout. 青花椒演示翻车根因.
      timeout: 600000,
      // P0-6: Axios 真上传进度 — 取代 UI 伪 90%. 只跟踪字节上传(不含后端解析).
      onUploadProgress: options?.onUploadProgress
        ? (e: { loaded: number; total?: number }) => {
            const total = e.total || file.size;
            const percent = total > 0 ? Math.round((e.loaded / total) * 100) : 0;
            options.onUploadProgress!(percent, e.loaded, total);
          }
        : undefined,
    });

    const result = response.data || response;

    if (!result.success) {
      return {
        success: false,
        parseResult: { row_count: 0, headers: [], preview_data: [] },
        error: result.message || '上传分析失败'
      };
    }

    const parseResponse = result.parseResult || {};
    return {
      success: true,
      parseResult: {
        row_count: parseResponse.rowCount || 0,
        headers: parseResponse.headers || [],
        preview_data: parseResponse.previewData || [],
        field_mappings: parseResponse.fieldMappings?.map((m: { originalColumn: string; standardField: string }) => ({
          original: m.originalColumn,
          standard: m.standardField
        })),
        table_type: result.detectedDataType,
        sheet_name: parseResponse.sheetName
      },
      analysis: result.aiAnalysis ? {
        success: true,
        answer: result.aiAnalysis,
        charts: result.chartConfig ? [result.chartConfig] : []
      } : undefined,
      chartRecommendations: result.recommendedTemplates?.map((t: { chartType: string; templateCode: string; description: string }) => ({
        type: t.chartType?.toLowerCase() || 'bar',
        title: t.description || t.templateCode,
        templateCode: t.templateCode
      })) || [],
      uploadId: result.uploadId,
      requiresConfirmation: result.requiresConfirmation === true
    };
  } catch (error) {
    console.error('uploadAndAnalyze 失败:', error);
    return {
      success: false,
      parseResult: { row_count: 0, headers: [], preview_data: [] },
      error: error instanceof Error ? error.message : '上传分析失败'
    };
  }
}

// ==================== Async Upload (Task #323 B MVP, Apr 20 2026) ====================

/**
 * Status polled from /api/smartbi/excel/auto-parse-status/{id}.
 */
export interface AsyncUploadStatus {
  success: boolean;
  uploadId: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileName?: string;
  factoryId?: string;
  rowCount?: number | null;
  columnCount?: number | null;
  detectedTableType?: string;
  fieldMappings?: unknown;
  contextInfo?: Record<string, unknown>;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Start an async upload (non-blocking). Returns uploadId immediately so the
 * caller can poll status and the user can even close the tab mid-parse.
 *
 * Use this for files > 50MB or when UX must not block on parse time.
 * Small files should still use uploadAndAnalyze (synchronous) for simplicity.
 */
export async function uploadFileAsync(
  file: File,
  factoryId: string,
  options?: {
    sheetIndex?: number;
    maxRows?: number;
    selectedRegionStart?: number;
    selectedRegionEnd?: number;
    onUploadProgress?: (percent: number, loaded: number, total: number) => void;
  },
): Promise<{ success: boolean; uploadId?: number; bytesReceived?: number; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('factory_id', factoryId);
  if (options?.sheetIndex !== undefined) {
    formData.append('sheet_index', String(options.sheetIndex));
  }
  if (options?.maxRows !== undefined) {
    formData.append('max_rows', String(options.maxRows));
  }
  if (options?.selectedRegionStart !== undefined && options?.selectedRegionEnd !== undefined) {
    formData.append('selected_region_start', String(options.selectedRegionStart));
    formData.append('selected_region_end', String(options.selectedRegionEnd));
  }

  try {
    // Direct Python endpoint via smartbi-api proxy (bypasses Java). Upload-only
    // timeout — parse happens in background, so this is just bytes-in-transit.
    const res = await request.post('/smartbi-api/api/smartbi/excel/auto-parse-async', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      baseURL: '',
      timeout: 600000, // 10min for the transfer itself; parse is async
      onUploadProgress: options?.onUploadProgress
        ? (e: { loaded: number; total?: number }) => {
            const total = e.total || file.size;
            const percent = total > 0 ? Math.round((e.loaded / total) * 100) : 0;
            options.onUploadProgress!(percent, e.loaded, total);
          }
        : undefined,
    });
    const data = (res.data || res) as { success: boolean; uploadId: number; bytesReceived: number };
    return { success: !!data.success, uploadId: data.uploadId, bytesReceived: data.bytesReceived };
  } catch (error) {
    console.error('uploadFileAsync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : '异步上传失败' };
  }
}

/**
 * Poll /auto-parse-status/{id} until status is terminal (COMPLETED / FAILED)
 * or timeout. Each poll fires onProgress so UI can show stage info.
 *
 * Usage:
 *   const { uploadId } = await uploadFileAsync(file, 'F001');
 *   const final = await pollUploadStatus(uploadId, { onProgress: s => updateUI(s) });
 *   if (final.status === 'COMPLETED') {...}
 */
export async function pollUploadStatus(
  uploadId: number,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (s: AsyncUploadStatus) => void;
  },
): Promise<AsyncUploadStatus> {
  const interval = options?.intervalMs ?? 3000; // 3s cadence
  const timeout = options?.timeoutMs ?? 20 * 60 * 1000; // 20 min
  const onProgress = options?.onProgress ?? (() => {});
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const res = await request.get(
        `/smartbi-api/api/smartbi/excel/auto-parse-status/${uploadId}`,
        { baseURL: '', timeout: 15000, _silent: true } as Record<string, unknown>,
      );
      const status = (res.data || res) as AsyncUploadStatus;
      onProgress(status);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        return status;
      }
    } catch (error) {
      // Transient errors (network blip, 502 during Python restart) — keep
      // polling unless we've exhausted the outer timeout budget.
      console.warn('[pollUploadStatus] transient error, retrying:', error);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Async upload poll timeout after ${timeout}ms (uploadId=${uploadId})`);
}

// ==================== End Async Upload ====================

/**
 * Confirm upload and persist (using existing Java endpoint)
 */
export function confirmUploadAndPersist(data: {
  // Bug #43 fix (2026-04-18): pass uploadId returned from /upload-and-analyze
  // so backend skips the 50-row-trim re-persist path and only updates
  // field_definitions. Rows were pre-persisted during initial upload.
  uploadId?: number;
  parseResponse: {
    fileName?: string;
    sheetName?: string;
    headers: string[];
    rowCount: number;
    columnCount: number;
    previewData?: unknown[];
    tableType?: string;
  };
  confirmedMappings?: Record<string, string>;
  dataType?: string;
  saveRawData?: boolean;
  generateChart?: boolean;
  chartTemplateId?: number;
}) {
  // P0-2 (Apr 20): 200K rows confirmUpload can need minutes for DB persist → 10min timeout
  return post(`${getSmartBIBasePath()}/upload/confirm`, data, { timeout: 600000 });
}

/**
 * Get upload history list.
 * Uses factory-scoped Java endpoint to ensure data isolation between factories.
 */
export async function getUploadHistory(params?: { status?: string; page?: number; size?: number }): Promise<{ success: boolean; data: UploadHistoryItem[] }> {
  try {
    const mergedParams = { page: 0, size: 200, ...params };
    const res = await get<{ content?: UploadHistoryItem[] } | UploadHistoryItem[]>(`${getSmartBIBasePath()}/uploads`, { params: mergedParams, _silent: true } as Record<string, unknown>);
    // Handle paginated response (Spring Page: { content: [], totalElements, ... })
    if (res.success && res.data && !Array.isArray(res.data) && Array.isArray(res.data.content)) {
      return { success: true, data: res.data.content };
    }
    // Backward compat: plain array
    if (res.success && Array.isArray(res.data)) {
      return { success: true, data: res.data };
    }
    return { success: res.success, data: [] };
  } catch {
    return { success: false, data: [] };
  }
}

/**
 * Get upload data fields
 */
export function getUploadFields(uploadId: number) {
  return get<FieldDefinition[]>(`${getSmartBIBasePath()}/uploads/${uploadId}/fields`);
}

/**
 * Get upload table data (paginated)
 */
export function getUploadTableData(uploadId: number, page = 0, size = 50) {
  return get<TableDataResponse>(`${getSmartBIBasePath()}/uploads/${uploadId}/data`, {
    params: { page, size }
  });
}

/**
 * Retry a failed or stuck sheet upload
 */
export function retrySheetUpload(uploadId: number) {
  return post<{ uploadId: number; message: string; rowCount?: number; headers?: string[] }>(
    `${getSmartBIBasePath()}/retry-sheet/${uploadId}`
  );
}

/**
 * Get datasource list (Schema-based datasources)
 */
export function getDatasourceList(params?: { page?: number; size?: number }) {
  return get(`${getSmartBIBasePath()}/datasource/list`, { params });
}

// ==================== Diagnosis & Backfill ====================

/**
 * Diagnose uploads missing field definitions
 */
export function diagnoseUploadsMissingFields() {
  return get<{ totalUploads: number; missingFieldsCount: number; hasIssues: boolean }>(
    `${getSmartBIBasePath()}/uploads-missing-fields`
  );
}

/**
 * Backfill field definitions for a single upload
 */
export function backfillFieldDefinitions(uploadId: number) {
  return post<BackfillResult>(`${getSmartBIBasePath()}/backfill/fields/${uploadId}`);
}

/**
 * Batch backfill field definitions
 */
export function batchBackfillFieldDefinitions(limit = 100) {
  return post<BatchBackfillResult>(`${getSmartBIBasePath()}/backfill/batch`, null, {
    params: { limit }
  });
}

// ==================== Dynamic Data Analysis ====================

/**
 * Get dynamic data analysis result
 */
export function getDynamicAnalysis(uploadId: number, analysisType: string = 'auto') {
  return get<DynamicAnalysisResponse>(`${getSmartBIBasePath()}/analysis/dynamic`, {
    params: { uploadId, analysisType }
  });
}

/**
 * Deduplicate upload history: group by fileName+sheetName, keep latest uploadId.
 */
export function deduplicateUploads(uploads: UploadHistoryItem[]): UploadHistoryItem[] {
  const map = new Map<string, UploadHistoryItem>();
  for (const item of uploads) {
    const key = `${item.fileName}|${item.sheetName || ''}`;
    const existing = map.get(key);
    if (!existing || item.id > existing.id) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}
