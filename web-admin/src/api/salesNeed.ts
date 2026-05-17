/**
 * 销售需求 API — Sprint 4 W2 S-NEED-1.
 * Base: /api/mobile/{factoryId}/sales-needs.
 */
import request from './request';

export type SalesNeedStatus = 'DRAFT' | 'CONFIRMED' | 'CONVERTED_TO_SO' | 'CANCELLED';
export type SalesNeedPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface SalesNeed {
  id: string;
  factoryId: string;
  customerId: string;
  customerName?: string | null;
  productId: string;
  productName?: string | null;
  qtyDemand: number;
  unit: string;
  expectedDeliveryDate?: string | null;
  priority: SalesNeedPriority;
  status: SalesNeedStatus;
  remark?: string | null;
  convertedSalesOrderId?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesNeedCreateRequest {
  customerId: string;
  customerName?: string;
  productId: string;
  productName?: string;
  qtyDemand: number;
  unit: string;
  expectedDeliveryDate?: string;
  priority?: SalesNeedPriority;
  remark?: string;
}

export interface SalesNeedUpdateRequest {
  qtyDemand?: number;
  unit?: string;
  expectedDeliveryDate?: string;
  priority?: SalesNeedPriority;
  remark?: string;
}

export interface SalesNeedPage {
  content: SalesNeed[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

function getFactoryId(factoryId?: string): string {
  if (factoryId) return factoryId;
  const raw = localStorage.getItem('user');
  if (!raw) throw new Error('未登录');
  const p = JSON.parse(raw) as { factoryId?: string; factoryUser?: { factoryId?: string } };
  const fid = p?.factoryUser?.factoryId ?? p?.factoryId;
  if (!fid) throw new Error('当前账号未绑定工厂');
  return fid;
}

const base = (fid?: string) => `/${getFactoryId(fid)}/sales-needs`;

export function listSalesNeeds(params: {
  status?: string;
  customerId?: string;
  page?: number;
  size?: number;
  factoryId?: string;
}): Promise<{ success: boolean; data: SalesNeedPage }> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.customerId) q.set('customerId', params.customerId);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request.get(`${base(params.factoryId)}?${q.toString()}`);
}

export function getSalesNeed(id: string): Promise<{ success: boolean; data: SalesNeed }> {
  return request.get(`${base()}/${id}`);
}

export function createSalesNeed(
  req: SalesNeedCreateRequest,
): Promise<{ success: boolean; data: SalesNeed }> {
  return request.post(base(), req);
}

export function updateSalesNeed(
  id: string,
  req: SalesNeedUpdateRequest,
): Promise<{ success: boolean; data: SalesNeed }> {
  return request.put(`${base()}/${id}`, req);
}

export function confirmSalesNeed(id: string): Promise<{ success: boolean; data: SalesNeed }> {
  return request.post(`${base()}/${id}/confirm`, {});
}

export function convertSalesNeed(
  id: string,
): Promise<{ success: boolean; data: { id: string; orderNumber: string } }> {
  return request.post(`${base()}/${id}/convert`, {});
}

export function cancelSalesNeed(id: string): Promise<{ success: boolean; data: SalesNeed }> {
  return request.post(`${base()}/${id}/cancel`, {});
}
