/**
 * P-NUCLEAR-1 (28-Backlog #30) — 核价单 询价/核价/采购 pipeline API client.
 *
 * <p>Backend: InquiryQuoteController at /api/mobile/{factoryId}/purchase/inquiry-quotes
 */
import { get, post } from './request';
import type { ApiResponse } from '@/types/api';

export type InquiryQuoteStatus =
  | 'DRAFT'
  | 'INQUIRING'
  | 'QUOTED'
  | 'SELECTED'
  | 'CONVERTED'
  | 'CANCELLED';

export interface InquiryQuote {
  id: string;
  factoryId: string;
  inquiryNumber: string;
  title?: string | null;
  materialTypeId: string;
  materialName?: string | null;
  specification?: string | null;
  quantity: number;
  unit: string;
  inquiryDate: string;
  requiredDate?: string | null;
  status: InquiryQuoteStatus;
  selectedSupplierId?: string | null;
  selectedSupplierName?: string | null;
  selectedUnitPrice?: number | null;
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  version?: number | null;
}

export interface InquiryQuoteSupplierPrice {
  id: string;
  inquiryQuoteId: string;
  supplierId: string;
  supplierName?: string | null;
  unitPrice: number;
  taxRate?: number | null;
  validUntil?: string | null;
  deliveryDays?: number | null;
  quotedAt: string;
  remark?: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ============================================================================
// 核价单 CRUD
// ============================================================================

export function createInquiry(
  factoryId: string,
  body: {
    title?: string;
    materialTypeId: string;
    materialName?: string;
    specification?: string;
    quantity: number;
    unit: string;
    inquiryDate: string;
    requiredDate?: string;
    remark?: string;
  },
): Promise<ApiResponse<InquiryQuote>> {
  return post<InquiryQuote>(`/${factoryId}/purchase/inquiry-quotes`, body);
}

export function listInquiries(
  factoryId: string,
  params: { page?: number; size?: number } = {},
): Promise<ApiResponse<PageResponse<InquiryQuote>>> {
  return get<PageResponse<InquiryQuote>>(`/${factoryId}/purchase/inquiry-quotes`, {
    params: { page: params.page ?? 1, size: params.size ?? 20 },
  });
}

export function getInquiry(
  factoryId: string,
  inquiryId: string,
): Promise<ApiResponse<InquiryQuote>> {
  return get<InquiryQuote>(`/${factoryId}/purchase/inquiry-quotes/${inquiryId}`);
}

export function submitInquiry(
  factoryId: string,
  inquiryId: string,
): Promise<ApiResponse<InquiryQuote>> {
  return post<InquiryQuote>(
    `/${factoryId}/purchase/inquiry-quotes/${inquiryId}/submit`,
  );
}

export function cancelInquiry(
  factoryId: string,
  inquiryId: string,
): Promise<ApiResponse<InquiryQuote>> {
  return post<InquiryQuote>(
    `/${factoryId}/purchase/inquiry-quotes/${inquiryId}/cancel`,
  );
}

// ============================================================================
// 供应商报价
// ============================================================================

export function addSupplierPrice(
  factoryId: string,
  inquiryId: string,
  body: {
    supplierId: string;
    unitPrice: number;
    taxRate?: number;
    validUntil?: string;
    deliveryDays?: number;
    remark?: string;
  },
): Promise<ApiResponse<InquiryQuoteSupplierPrice>> {
  return post<InquiryQuoteSupplierPrice>(
    `/${factoryId}/purchase/inquiry-quotes/${inquiryId}/supplier-prices`,
    body,
  );
}

export function listSupplierPrices(
  factoryId: string,
  inquiryId: string,
): Promise<ApiResponse<InquiryQuoteSupplierPrice[]>> {
  return get<InquiryQuoteSupplierPrice[]>(
    `/${factoryId}/purchase/inquiry-quotes/${inquiryId}/supplier-prices`,
  );
}

// ============================================================================
// 选定 + 转化采购单 (防呆 R4: idempotent, 409 已生成 PO)
// ============================================================================

export function selectAndConvert(
  factoryId: string,
  inquiryId: string,
  body: {
    selectedSupplierId: string;
    expectedDeliveryDate?: string;
    remark?: string;
  },
): Promise<ApiResponse<{ id: string; orderNumber: string }>> {
  return post(
    `/${factoryId}/purchase/inquiry-quotes/${inquiryId}/select-and-convert`,
    body,
  );
}
