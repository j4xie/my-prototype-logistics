/**
 * Sprint 4 Chat K — 数据中台 API (export / import / operation log).
 *
 * 后端: /api/mobile/{factoryId}/{export-rules,import-rules,operation-logs}
 * baseURL 已 prefix /api/mobile,这里只填 {factoryId}/ 后的路径.
 */

import { get, post, put, del } from './request';
import type { AxiosRequestConfig } from 'axios';

// ───── 通用类型 ─────

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;       // current page (0-based)
  size: number;
}

// ───── OperationLog (C-LOG-AUDIT-1) ─────

export interface OperationLog {
  id: number;
  factoryId: string;
  userId: number | null;
  username: string | null;
  module: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  diff: Array<{ field: string; from: unknown; to: unknown }> | null;
  summary: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  elapsedMs: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface OperationLogFilters {
  module?: string;
  action?: string;
  userId?: number;
  entityType?: string;
  entityId?: string;
  start?: string;       // ISO-8601
  end?: string;
  page?: number;
  size?: number;
}

export const operationLogApi = {
  list(factoryId: string, filters: OperationLogFilters = {}) {
    const params: Record<string, string | number> = {};
    if (filters.module) params.module = filters.module;
    if (filters.action) params.action = filters.action;
    if (filters.userId !== undefined) params.userId = filters.userId;
    if (filters.entityType) params.entityType = filters.entityType;
    if (filters.entityId) params.entityId = filters.entityId;
    if (filters.start) params.start = filters.start;
    if (filters.end) params.end = filters.end;
    params.page = filters.page ?? 0;
    params.size = filters.size ?? 50;
    return get<PageResult<OperationLog>>(`/${factoryId}/operation-logs`, { params });
  },

  get(factoryId: string, logId: number) {
    return get<OperationLog>(`/${factoryId}/operation-logs/${logId}`);
  },
};

// ───── ExportRule (C-EXPORT-CENTER-1) ─────

export interface ExportRuleColumn {
  field: string;
  header: string;
  width?: number;
}

export interface ExportRule {
  id?: number;
  factoryId: string;
  moduleCode: string;
  ruleName: string;
  description?: string;
  columns: ExportRuleColumn[];
  filterExpression?: string;
  format: 'XLSX' | 'CSV' | 'PDF';
  isAsync: boolean;
  rowThreshold: number;
  targetEntity: string;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExportJob {
  id: string;
  factoryId: string;
  ruleId: number;
  triggeredBy: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  runtimeParams: Record<string, unknown> | null;
  filePath: string | null;
  fileSizeBytes: number | null;
  rowCount: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ExportRunResponse {
  mode: 'SYNC' | 'ASYNC';
  jobId?: string;
  filename?: string;
  rowCount?: number;
  fileSizeBytes?: number;
  fileBase64?: string;
  status?: string;
}

export const exportRuleApi = {
  list(factoryId: string, moduleCode?: string, page = 0, size = 20) {
    const params: Record<string, string | number> = { page, size };
    if (moduleCode) params.moduleCode = moduleCode;
    return get<PageResult<ExportRule>>(`/${factoryId}/export-rules`, { params });
  },
  get(factoryId: string, ruleId: number) {
    return get<ExportRule>(`/${factoryId}/export-rules/${ruleId}`);
  },
  create(factoryId: string, rule: Omit<ExportRule, 'id' | 'createdAt' | 'updatedAt'>) {
    return post<ExportRule>(`/${factoryId}/export-rules`, rule);
  },
  update(factoryId: string, ruleId: number, patch: Partial<ExportRule>) {
    return put<ExportRule>(`/${factoryId}/export-rules/${ruleId}`, patch);
  },
  delete(factoryId: string, ruleId: number) {
    return del(`/${factoryId}/export-rules/${ruleId}`);
  },
  run(factoryId: string, ruleId: number, runtimeParams?: Record<string, unknown>) {
    return post<ExportRunResponse>(`/${factoryId}/export-rules/${ruleId}/run`, { runtimeParams });
  },
  listJobs(factoryId: string, status?: string, page = 0, size = 20) {
    const params: Record<string, string | number> = { page, size };
    if (status) params.status = status;
    return get<PageResult<ExportJob>>(`/${factoryId}/export-rules/jobs`, { params });
  },
  getJob(factoryId: string, jobId: string) {
    return get<ExportJob>(`/${factoryId}/export-rules/jobs/${jobId}`);
  },
  downloadUrl(factoryId: string, jobId: string) {
    // 返完整 URL 让 <a href> / window.open 直下载. 实际 token 由 interceptor 注入,
    // 这里假设由调用方包 baseURL 前缀.
    return `/api/mobile/${factoryId}/export-rules/jobs/${jobId}/download`;
  },
};

// ───── ImportRule (C-IMPORT-CENTER-1) ─────

export interface ImportRuleMappingEntry {
  excelCol: string;
  entityField: string;
  validator?: string;
}

export interface ImportRule {
  id?: number;
  factoryId: string;
  moduleCode: string;
  ruleName: string;
  description?: string;
  mapping: ImportRuleMappingEntry[];
  dedupStrategy: 'SKIP' | 'UPDATE' | 'ERROR';
  dedupKeyField?: string;
  targetEntity: string;
  createdBy?: number;
}

export interface ImportJob {
  id: string;
  factoryId: string;
  ruleId: number;
  triggeredBy: number;
  status: 'PENDING' | 'DRYRUN_DONE' | 'COMMITTED' | 'FAILED';
  sourceFilename: string | null;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  committedRows: number | null;
  errors: Array<{ row: number; col: string; msg: string }> | null;
  errorFilePath: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const importRuleApi = {
  list(factoryId: string, moduleCode?: string, page = 0, size = 20) {
    const params: Record<string, string | number> = { page, size };
    if (moduleCode) params.moduleCode = moduleCode;
    return get<PageResult<ImportRule>>(`/${factoryId}/import-rules`, { params });
  },
  get(factoryId: string, ruleId: number) {
    return get<ImportRule>(`/${factoryId}/import-rules/${ruleId}`);
  },
  create(factoryId: string, rule: Omit<ImportRule, 'id'>) {
    return post<ImportRule>(`/${factoryId}/import-rules`, rule);
  },
  update(factoryId: string, ruleId: number, patch: Partial<ImportRule>) {
    return put<ImportRule>(`/${factoryId}/import-rules/${ruleId}`, patch);
  },
  delete(factoryId: string, ruleId: number) {
    return del(`/${factoryId}/import-rules/${ruleId}`);
  },
  dryrun(factoryId: string, ruleId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    const cfg: AxiosRequestConfig = { headers: { 'Content-Type': 'multipart/form-data' } };
    return post<ImportJob>(`/${factoryId}/import-rules/${ruleId}/dryrun`, form, cfg);
  },
  commit(factoryId: string, jobId: string) {
    return post<ImportJob>(`/${factoryId}/import-rules/jobs/${jobId}/commit`);
  },
  listJobs(factoryId: string, status?: string, page = 0, size = 20) {
    const params: Record<string, string | number> = { page, size };
    if (status) params.status = status;
    return get<PageResult<ImportJob>>(`/${factoryId}/import-rules/jobs`, { params });
  },
  getJob(factoryId: string, jobId: string) {
    return get<ImportJob>(`/${factoryId}/import-rules/jobs/${jobId}`);
  },
};
