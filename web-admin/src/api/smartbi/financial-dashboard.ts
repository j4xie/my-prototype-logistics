/**
 * SmartBI Financial Dashboard API
 * Calls Python /api/smartbi/financial-dashboard/* endpoints
 */
import { pythonFetch, PYTHON_LLM_TIMEOUT_MS } from './common';

export interface FinancialDashboardRequest {
  upload_id?: number;
  raw_data?: Record<string, unknown>[];
  chart_type?: string;
  year?: number;
  period_type?: string;
  start_month?: number;
  end_month?: number;
  factory_id?: string;
  filters?: Record<string, string[]>; // Fix 72: Global slicer filters
}

export interface ChartKPI {
  label: string;
  value: number | string;
  unit: string;
  trend?: 'up' | 'down' | 'flat';
  subtitle?: string;
  sparkline?: number[];
}

export interface ChartResult {
  chartType: string;
  title: string;
  kpis: ChartKPI[];
  echartsOption: Record<string, unknown>;
  tableData?: Record<string, unknown>;
  analysisContext: string;
  metadata: {
    period: string | Record<string, unknown>;
    dataQuality: string;
  };
  success: boolean;
  error?: string;
  quarterlyProgress?: { quarter: string; budget: number; actual: number; rate: number }[];
  monthlyDataRows?: { currentYear: number[]; lastYear: number[]; labels: string[] };
}

export interface AvailableChartType {
  chartType: string;
  displayName: string;
  description: string;
}

export interface PeriodInfo {
  year: number;
  period_type: string;
  start_month: number;
  end_month: number;
  label: string;
}

export interface DashboardResponse {
  success: boolean;
  charts: ChartResult[];
  availableTypes: AvailableChartType[];
  period: PeriodInfo;
  totalCharts: number;
  successCount: number;
  availableDimensions?: { name: string; values: string[] }[]; // Fix 72: Slicer dimensions
}

export interface PPTExportRequest {
  upload_id?: number;
  year?: number;
  period_type?: string;
  start_month?: number;
  end_month?: number;
  chart_images: Record<string, string>;
  analysis_results: Record<string, string>;
  template?: string;
  company_name?: string;
  kpi_summary?: Record<string, unknown>;
}

export interface AnalyzeChartRequest {
  chart_type: string;
  analysis_context: string;
  follow_up_question?: string;
  previous_analysis?: string;
}

export interface AnalyzeChartResponse {
  success: boolean;
  chartType?: string;
  analysis: string;
  error?: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  chartTypes: string[];
  thumbnail?: string;
}

export interface TemplatesResponse {
  success: boolean;
  templates: TemplateItem[];
}

/**
 * Generate a single chart by type
 */
export async function generateChart(data: FinancialDashboardRequest): Promise<ChartResult> {
  return await pythonFetch('/api/smartbi/financial-dashboard/generate', {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  }) as ChartResult;
}

/**
 * Batch generate all dashboard charts
 */
export async function batchGenerate(data: FinancialDashboardRequest): Promise<DashboardResponse> {
  return await pythonFetch('/api/smartbi/financial-dashboard/batch', {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  }) as DashboardResponse;
}

/**
 * Request AI analysis text for a chart
 */
export async function analyzeChart(data: AnalyzeChartRequest): Promise<AnalyzeChartResponse> {
  return await pythonFetch('/api/smartbi/financial-dashboard/analyze', {
    method: 'POST',
    body: JSON.stringify(data),
    timeoutMs: PYTHON_LLM_TIMEOUT_MS,
  }) as AnalyzeChartResponse;
}

/**
 * List available PPT templates
 */
export async function listTemplates(): Promise<TemplatesResponse> {
  return await pythonFetch('/api/smartbi/financial-dashboard/templates') as TemplatesResponse;
}

/**
 * Export dashboard as PPT — returns a Blob via raw fetch (binary response).
 * Bug #13: added 3 min timeout via AbortController. Large dashboards with many
 * chart images can take 30-90s server-side; prior version had no timeout
 * so a hung server connection locked the loading spinner forever.
 */
export async function exportPPT(data: PPTExportRequest): Promise<Blob | null> {
  const EXPORT_TIMEOUT_MS = 180000; // 3 min
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);
  try {
    const { PYTHON_SMARTBI_URL, getPythonAuthHeaders } = await import('./common');
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/financial-dashboard/export-ppt`, {
      method: 'POST',
      headers: {
        ...getPythonAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`PPT导出失败: HTTP ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('exportPPT 超时 (>3分钟)');
    } else {
      console.error('exportPPT 失败:', error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface ExcelExportRequest {
  charts: Record<string, unknown>[];
  analysis_results: Record<string, string>;
  company_name?: string;
  year?: number;
  period_type?: string;
  start_month?: number;
  end_month?: number;
}

export interface PDFExportRequest {
  chart_images: Record<string, string>;
  analysis_results: Record<string, string>;
  company_name?: string;
  year?: number;
  period_type?: string;
  start_month?: number;
  end_month?: number;
  kpi_summary?: Record<string, unknown>;
}

/**
 * Export dashboard as Excel — returns a Blob via raw fetch (binary response).
 * Bug #13: added 3 min timeout via AbortController.
 */
export async function exportExcel(data: ExcelExportRequest): Promise<Blob | null> {
  const EXPORT_TIMEOUT_MS = 180000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);
  try {
    const { PYTHON_SMARTBI_URL, getPythonAuthHeaders } = await import('./common');
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/financial-dashboard/export-excel`, {
      method: 'POST',
      headers: {
        ...getPythonAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Excel导出失败: HTTP ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('exportExcel 超时 (>3分钟)');
    } else {
      console.error('exportExcel 失败:', error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Export dashboard as PDF — returns a Blob via raw fetch (binary response).
 * Bug #13: added 3 min timeout via AbortController.
 */
export async function exportPDF(data: PDFExportRequest): Promise<Blob | null> {
  const EXPORT_TIMEOUT_MS = 180000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);
  try {
    const { PYTHON_SMARTBI_URL, getPythonAuthHeaders } = await import('./common');
    const response = await fetch(`${PYTHON_SMARTBI_URL}/api/smartbi/financial-dashboard/export-pdf`, {
      method: 'POST',
      headers: {
        ...getPythonAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`PDF导出失败: HTTP ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('exportPDF 超时 (>3分钟)');
    } else {
      console.error('exportPDF 失败:', error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
