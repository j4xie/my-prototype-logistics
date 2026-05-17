// S-CRM-1 — customer tracking record API client.
//
// Backend: CustomerTrackingRecordController @RequestMapping
//   "/api/mobile/{factoryId}/sales/customer-tracking"
//
// axios baseURL = '/api/mobile' so caller-side URLs start at "/{factoryId}/..."
// (matches the pattern in reminder.ts / salesNeed.ts / customers/list.vue).
//
// P1 #21 fix (2026-05-17): prior version prefixed `/mobile/${factoryId}/...`
// causing /api/mobile/mobile/... 404. Also adds GET-by-id + PUT (update) +
// generic R4-409 ApiError surfacing for callers.
import { get, post, put, del } from './request';

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

/** PUT body — only content/contactPerson/contactPhone/address/remark are mutable. */
export interface UpdateTrackingRecordRequest {
  content?: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  remark?: string;
}

export interface TrackingRecordPage {
  content: CustomerTrackingRecord[];
  totalElements: number;
  totalPages: number;
}

function basePath(factoryId: string): string {
  return `/${factoryId}/sales/customer-tracking`;
}

export async function listTrackingRecords(
  factoryId: string,
  params: { customerId?: string; page?: number; size?: number } = {}
): Promise<TrackingRecordPage> {
  const res = await get<TrackingRecordPage>(basePath(factoryId), { params });
  if (!res.success || !res.data) {
    return { content: [], totalElements: 0, totalPages: 0 };
  }
  return res.data;
}

export async function getTrackingRecord(
  factoryId: string,
  id: number
): Promise<CustomerTrackingRecord> {
  const res = await get<CustomerTrackingRecord>(`${basePath(factoryId)}/${id}`);
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载跟踪记录失败');
  }
  return res.data;
}

export async function createTrackingRecord(
  factoryId: string,
  body: CreateTrackingRecordRequest
): Promise<CustomerTrackingRecord> {
  const res = await post<CustomerTrackingRecord>(basePath(factoryId), body);
  if (!res.success || !res.data) {
    throw new Error(res.message || '创建跟踪记录失败');
  }
  return res.data;
}

export async function updateTrackingRecord(
  factoryId: string,
  id: number,
  body: UpdateTrackingRecordRequest
): Promise<CustomerTrackingRecord> {
  const res = await put<CustomerTrackingRecord>(`${basePath(factoryId)}/${id}`, body);
  if (!res.success || !res.data) {
    throw new Error(res.message || '更新跟踪记录失败');
  }
  return res.data;
}

export async function deleteTrackingRecord(
  factoryId: string,
  id: number
): Promise<void> {
  const res = await del(`${basePath(factoryId)}/${id}`);
  if (!res.success) {
    throw new Error(res.message || '删除跟踪记录失败');
  }
}
