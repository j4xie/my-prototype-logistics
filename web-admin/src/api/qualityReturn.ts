/**
 * Sprint4-H Q-RETURN-1 — 质检退回单 API client.
 *
 * <p>对接 QualityReturnOrderController:
 *   - POST   /quality-return-orders         body: CreateReturnRequest
 *   - GET    /quality-return-orders?status=&targetType=&qualityInspectionId=&targetId=&page=&size=
 *   - GET    /quality-return-orders/{id}
 *   - PUT    /quality-return-orders/{id}    body: UpdateReturnRequest (仅 DRAFT)
 *   - PUT    /quality-return-orders/{id}/confirm
 *   - PUT    /quality-return-orders/{id}/ship      body: { shippingTrackingNo }
 *   - DELETE /quality-return-orders/{id}    (仅 DRAFT)
 *
 * 区分 T-RTA (客户退货) — 那走 sales_returns. 此处是上游退回 (供应商/委外).
 */
import { get, post, put, del } from './request';
import type { ApiResponse } from '@/types/api';

export type QualityReturnStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPED';
export type QualityReturnTargetType = 'SUPPLIER' | 'SUBCONTRACT';

export const RETURN_STATUS_LABELS: Record<QualityReturnStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  SHIPPED: '已发出',
};

export const RETURN_TARGET_LABELS: Record<QualityReturnTargetType, string> = {
  SUPPLIER: '退回供应商',
  SUBCONTRACT: '退回委外',
};

export interface QualityReturnOrder {
  id: string;
  factoryId: string;
  returnNumber: string | null;
  qualityInspectionId: string;
  targetType: QualityReturnTargetType;
  targetId: string;
  targetName: string | null;
  materialId: string | null;
  quantity: number;
  unit: string | null;
  reason: string | null;
  status: QualityReturnStatus;
  confirmedAt: string | null;
  confirmedBy: number | null;
  shippedAt: string | null;
  shippedBy: number | null;
  shippingTrackingNo: string | null;
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

export interface CreateReturnRequest {
  qualityInspectionId: string;
  targetType: QualityReturnTargetType;
  targetId: string;
  targetName?: string | null;
  materialId?: string | null;
  quantity: number;
  unit?: string | null;
  reason?: string | null;
}

export type UpdateReturnRequest = Partial<Omit<CreateReturnRequest, 'qualityInspectionId'>>;

export function createReturn(
  factoryId: string,
  request: CreateReturnRequest,
): Promise<ApiResponse<QualityReturnOrder>> {
  return post<QualityReturnOrder>(`/${factoryId}/quality-return-orders`, request);
}

export function listReturns(
  factoryId: string,
  params: {
    status?: QualityReturnStatus;
    targetType?: QualityReturnTargetType;
    qualityInspectionId?: string;
    targetId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  } = {},
): Promise<ApiResponse<PageResponse<QualityReturnOrder>>> {
  return get<PageResponse<QualityReturnOrder>>(`/${factoryId}/quality-return-orders`, {
    params: { page: 1, size: 20, ...params },
  });
}

export function getReturn(
  factoryId: string,
  id: string,
): Promise<ApiResponse<QualityReturnOrder>> {
  return get<QualityReturnOrder>(`/${factoryId}/quality-return-orders/${id}`);
}

export function updateReturn(
  factoryId: string,
  id: string,
  request: UpdateReturnRequest,
): Promise<ApiResponse<QualityReturnOrder>> {
  return put<QualityReturnOrder>(`/${factoryId}/quality-return-orders/${id}`, request);
}

export function confirmReturn(
  factoryId: string,
  id: string,
): Promise<ApiResponse<QualityReturnOrder>> {
  return put<QualityReturnOrder>(`/${factoryId}/quality-return-orders/${id}/confirm`, {});
}

export function shipReturn(
  factoryId: string,
  id: string,
  shippingTrackingNo: string,
): Promise<ApiResponse<QualityReturnOrder>> {
  return put<QualityReturnOrder>(`/${factoryId}/quality-return-orders/${id}/ship`, {
    shippingTrackingNo,
  });
}

export function cancelReturn(
  factoryId: string,
  id: string,
): Promise<ApiResponse<void>> {
  return del<void>(`/${factoryId}/quality-return-orders/${id}`);
}
