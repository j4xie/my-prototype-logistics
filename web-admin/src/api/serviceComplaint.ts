/**
 * P2 #74 S-COMPLAINT-1 — 售后服务投诉 API.
 * Base: /api/mobile/{factoryId}/service-complaints.
 */
import request from './request';

export type ServiceComplaintType =
  | 'PRODUCT_QUALITY'
  | 'DELIVERY_LATE'
  | 'SERVICE_ATTITUDE'
  | 'PRICING'
  | 'OTHER';

export type ServiceComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ServiceComplaintSource = 'PHONE' | 'EMAIL' | 'WECHAT' | 'IN_STORE' | 'OTHER';

export type ServiceComplaintStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface ServiceComplaint {
  id: string;
  factoryId: string;
  complaintNumber: string;
  customerId: string;
  customerName?: string | null;
  orderId?: string | null;
  complaintType: ServiceComplaintType;
  severity: ServiceComplaintSeverity;
  source: ServiceComplaintSource;
  status: ServiceComplaintStatus;
  description: string;
  handledBy?: number | null;
  resolution?: string | null;
  occurredAt?: string | null;
  resolvedAt?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceComplaintCreateRequest {
  customerId: string;
  customerName?: string;
  orderId?: string;
  complaintType: ServiceComplaintType;
  severity: ServiceComplaintSeverity;
  source: ServiceComplaintSource;
  description: string;
  handledBy?: number;
  occurredAt?: string;
}

export interface ServiceComplaintUpdateRequest {
  complaintType?: ServiceComplaintType;
  severity?: ServiceComplaintSeverity;
  source?: ServiceComplaintSource;
  description?: string;
  handledBy?: number;
  resolution?: string;
  occurredAt?: string;
}

export interface ServiceComplaintPage {
  content: ServiceComplaint[];
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

const base = (fid?: string): string => `/${getFactoryId(fid)}/service-complaints`;

export function listServiceComplaints(params: {
  status?: string;
  customerId?: string;
  page?: number;
  size?: number;
  factoryId?: string;
}): Promise<{ success: boolean; data: ServiceComplaintPage }> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.customerId) q.set('customerId', params.customerId);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 20));
  return request.get(`${base(params.factoryId)}?${q.toString()}`);
}

export function getServiceComplaint(
  id: string,
): Promise<{ success: boolean; data: ServiceComplaint }> {
  return request.get(`${base()}/${id}`);
}

export function createServiceComplaint(
  req: ServiceComplaintCreateRequest,
): Promise<{ success: boolean; data: ServiceComplaint }> {
  return request.post(base(), req);
}

export function updateServiceComplaint(
  id: string,
  req: ServiceComplaintUpdateRequest,
): Promise<{ success: boolean; data: ServiceComplaint }> {
  return request.put(`${base()}/${id}`, req);
}

export function startServiceComplaint(
  id: string,
  handledBy?: number,
): Promise<{ success: boolean; data: ServiceComplaint }> {
  return request.post(`${base()}/${id}/start`, handledBy != null ? { handledBy } : {});
}

export function resolveServiceComplaint(
  id: string,
  resolution: string,
): Promise<{ success: boolean; data: ServiceComplaint }> {
  return request.post(`${base()}/${id}/resolve`, { resolution });
}

export function closeServiceComplaint(
  id: string,
): Promise<{ success: boolean; data: ServiceComplaint }> {
  return request.post(`${base()}/${id}/close`, {});
}
