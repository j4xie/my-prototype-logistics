/**
 * Sprint4-H Q-PROCESS-1 — 工序质检不良 API client.
 *
 * <p>对接 QualityDefectController 端点:
 *   - POST /quality-defects                    body: RecordDefectRequest
 *   - GET  /quality-defects?status=&defectType=&qualityInspectionId=&materialId=&page=&size=
 *   - GET  /quality-defects/by-inspection/{inspectionId}
 *   - GET  /quality-defects/summary
 *   - GET  /quality-defects/{id}
 *   - PUT  /quality-defects/{id}/assign        body: { handlingAction, assignedTo }
 *   - PUT  /quality-defects/{id}/close         body: { closeNotes }
 *
 * RBAC: write 需要 quality:read_write, read 需要 quality:read 或 quality:read_write.
 */
import { get, post, put } from './request';
import type { ApiResponse } from '@/types/api';

export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type DefectType =
  | 'APPEARANCE'
  | 'WEIGHT'
  | 'COMPOSITION'
  | 'MICROBIAL'
  | 'PACKAGING'
  | 'FOREIGN_OBJECT'
  | 'SENSORY'
  | 'SHELF_LIFE'
  | 'OTHER';

export const DEFECT_TYPE_LABELS: Record<DefectType, string> = {
  APPEARANCE: '外观缺陷',
  WEIGHT: '重量不达标',
  COMPOSITION: '成分异常',
  MICROBIAL: '微生物超标',
  PACKAGING: '包装缺陷',
  FOREIGN_OBJECT: '异物',
  SENSORY: '感官异常',
  SHELF_LIFE: '保质期问题',
  OTHER: '其他',
};

export const DEFECT_STATUS_LABELS: Record<DefectStatus, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  CLOSED: '已闭环',
};

export interface QualityDefect {
  id: string;
  factoryId: string;
  qualityInspectionId: string;
  materialId: string | null;
  defectType: DefectType;
  quantity: number;
  cause: string | null;
  handlingAction: string | null;
  assignedTo: number | null;
  status: DefectStatus;
  closedAt: string | null;
  closedBy: number | null;
  closeNotes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RecordDefectRequest {
  qualityInspectionId: string;
  materialId?: string | null;
  defectType: DefectType;
  quantity: number;
  cause?: string | null;
}

export interface AssignDefectRequest {
  handlingAction: string;
  assignedTo?: number | null;
}

export interface CloseDefectRequest {
  closeNotes?: string | null;
}

export interface DefectSummary {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export function recordDefect(
  factoryId: string,
  request: RecordDefectRequest,
): Promise<ApiResponse<QualityDefect>> {
  return post<QualityDefect>(`/${factoryId}/quality-defects`, request);
}

export function listDefects(
  factoryId: string,
  params: {
    status?: DefectStatus;
    defectType?: DefectType;
    qualityInspectionId?: string;
    materialId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  } = {},
): Promise<ApiResponse<PageResponse<QualityDefect>>> {
  return get<PageResponse<QualityDefect>>(`/${factoryId}/quality-defects`, {
    params: { page: 1, size: 20, ...params },
  });
}

export function listByInspection(
  factoryId: string,
  inspectionId: string,
): Promise<ApiResponse<QualityDefect[]>> {
  return get<QualityDefect[]>(`/${factoryId}/quality-defects/by-inspection/${inspectionId}`);
}

export function getSummary(factoryId: string): Promise<ApiResponse<DefectSummary>> {
  return get<DefectSummary>(`/${factoryId}/quality-defects/summary`);
}

export function getDefect(
  factoryId: string,
  defectId: string,
): Promise<ApiResponse<QualityDefect>> {
  return get<QualityDefect>(`/${factoryId}/quality-defects/${defectId}`);
}

export function assignDefect(
  factoryId: string,
  defectId: string,
  request: AssignDefectRequest,
): Promise<ApiResponse<QualityDefect>> {
  return put<QualityDefect>(`/${factoryId}/quality-defects/${defectId}/assign`, request);
}

export function closeDefect(
  factoryId: string,
  defectId: string,
  request: CloseDefectRequest = {},
): Promise<ApiResponse<QualityDefect>> {
  return put<QualityDefect>(`/${factoryId}/quality-defects/${defectId}/close`, request);
}
