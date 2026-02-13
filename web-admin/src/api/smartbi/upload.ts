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

// ==================== Upload Functions ====================

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

  try {
    const response = await request.post(`${getSmartBIBasePath()}/upload-and-analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
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
      analysis: {
        success: true,
        answer: result.aiAnalysis,
        insights: [],
        charts: result.chartConfig ? [result.chartConfig] : []
      },
      chartRecommendations: result.recommendedTemplates?.map((t: { chartType: string; templateCode: string; description: string }) => ({
        type: t.chartType?.toLowerCase() || 'bar',
        title: t.description || t.templateCode,
        templateCode: t.templateCode
      })) || [],
      uploadId: result.uploadId
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

/**
 * Confirm upload and persist (using existing Java endpoint)
 */
export function confirmUploadAndPersist(data: {
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
  return post(`${getSmartBIBasePath()}/upload/confirm`, data);
}

/**
 * Get upload history list
 */
export function getUploadHistory(params?: { status?: string }) {
  return get<UploadHistoryItem[]>(`${getSmartBIBasePath()}/uploads`, { params });
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
