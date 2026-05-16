/**
 * Sprint2-J P-FIN-1 follow-up (Chat 6 Vue) — 采购单财务审核 API.
 *
 * <p>对接 PurchaseService 已暴露的 4 端点 (Sprint 1 PR #660 + PR #675):
 *   - GET  /orders/by-status?status=PENDING_FINANCE_REVIEW
 *   - GET  /orders/{id}/price-comparison
 *   - POST /orders/{id}/finance-approve  body: { notes }
 *   - POST /orders/{id}/finance-reject   body: { notes }  (必填)
 *
 * <p>RBAC: approve/reject 后端 @RequirePermission("finance:read_write").
 * 前端按钮 v-if 用 permissionStore.canWrite('finance').
 */
import { get, post } from './request';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// 类型 (与 RN purchaseApiClient.ts 对齐)
// ============================================================================

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_FINANCE_REVIEW'
  | 'FINANCE_APPROVED'
  | 'FINANCE_REJECTED'
  | 'PARTIAL_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CLOSED';

export interface PurchaseOrderSummary {
  id: string;
  factoryId: string;
  orderNumber: string;
  supplierId: string;
  supplierName?: string | null;
  status: PurchaseOrderStatus;
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  remark?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  financeReviewedBy?: number | null;
  financeReviewedAt?: string | null;
  financeReviewNotes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface MaterialPriceComparison {
  materialTypeId: string;
  materialName: string | null;
  materialCode: string | null;
  unit: string | null;
  bomStandardPrice: number | null;
  movingAvgPrice: number | null;
  currentPrice: number | null;
  varianceFromBom: number | null;
  varianceFromAvg: number | null;
  priceAlert: boolean;
  bomProductNames: string | null;
  dataSourceHint: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ============================================================================
// API 方法 — baseURL = /api/mobile (request.ts:109)
// ============================================================================

/** 待财审采购单列表 (PENDING_FINANCE_REVIEW). 分页. */
export function listPendingFinanceReview(
  factoryId: string,
  params: { page?: number; size?: number } = {},
): Promise<ApiResponse<PageResponse<PurchaseOrderSummary>>> {
  return get<PageResponse<PurchaseOrderSummary>>(
    `/${factoryId}/purchase/orders/by-status`,
    {
      params: {
        status: 'PENDING_FINANCE_REVIEW',
        page: params.page ?? 1,
        size: params.size ?? 20,
      },
    },
  );
}

/** 采购单详情 (含基础字段 + financeReview 字段). */
export function getOrderDetail(
  factoryId: string,
  orderId: string,
): Promise<ApiResponse<PurchaseOrderSummary>> {
  return get<PurchaseOrderSummary>(`/${factoryId}/purchase/orders/${orderId}`);
}

/** 三价对比 (priceAlert=true 行需要红色高亮). */
export function getOrderPriceComparison(
  factoryId: string,
  orderId: string,
): Promise<ApiResponse<MaterialPriceComparison[]>> {
  return get<MaterialPriceComparison[]>(
    `/${factoryId}/purchase/orders/${orderId}/price-comparison`,
  );
}

/** 财务审核通过 (PENDING_FINANCE_REVIEW → FINANCE_APPROVED). notes 可选. */
export function financeApprove(
  factoryId: string,
  orderId: string,
  notes?: string,
): Promise<ApiResponse<PurchaseOrderSummary>> {
  return post<PurchaseOrderSummary>(
    `/${factoryId}/purchase/orders/${orderId}/finance-approve`,
    { notes: notes ?? null },
  );
}

/** 财务驳回 (PENDING_FINANCE_REVIEW → FINANCE_REJECTED). notes 必填. */
export function financeReject(
  factoryId: string,
  orderId: string,
  notes: string,
): Promise<ApiResponse<PurchaseOrderSummary>> {
  return post<PurchaseOrderSummary>(
    `/${factoryId}/purchase/orders/${orderId}/finance-reject`,
    { notes },
  );
}
