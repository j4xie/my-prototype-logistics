// S-CRM-1 (Sprint 4 Wave 2 Chat L) — customer tracking record API client.
import { get, post, del } from './request';

export interface CustomerTrackingRecord {
  id: number;
  factoryId: string;
  customerId: string;
  recordTime: string; // ISO datetime
  recorderName?: string;
  recorderId?: number;
  content: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTrackingRecordRequest {
  customerId: string;
  recordTime?: string;
  recorderName?: string;
  recorderId?: number;
  content: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  remark?: string;
}

interface PageResponse {
  content: CustomerTrackingRecord[];
  totalElements: number;
  totalPages: number;
}

export async function listTrackingRecords(
  factoryId: string,
  params: { customerId?: string; page?: number; size?: number } = {}
): Promise<PageResponse> {
  const res = await get<PageResponse>(`/mobile/${factoryId}/sales/customer-tracking`, { params });
  if (!res.success || !res.data) {
    return { content: [], totalElements: 0, totalPages: 0 };
  }
  return res.data;
}

export async function createTrackingRecord(
  factoryId: string,
  body: CreateTrackingRecordRequest
): Promise<CustomerTrackingRecord> {
  const res = await post<CustomerTrackingRecord>(`/mobile/${factoryId}/sales/customer-tracking`, body);
  if (!res.success || !res.data) {
    throw new Error(res.message || '创建跟踪记录失败');
  }
  return res.data;
}

export async function deleteTrackingRecord(factoryId: string, id: number): Promise<void> {
  const res = await del(`/mobile/${factoryId}/sales/customer-tracking/${id}`);
  if (!res.success) {
    throw new Error(res.message || '删除跟踪记录失败');
  }
}
