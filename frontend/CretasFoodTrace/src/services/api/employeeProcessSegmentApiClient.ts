import { apiClient } from './apiClient';

interface ActiveSegment {
  id: string;
  employeeId: number;
  employeeName: string;
  workTypeName?: string;
  processName?: string;
  startTime: string;
  status: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

const BASE = (factoryId: string) => `/mobile/${factoryId}/workreport/segments`;

export const employeeProcessSegmentApi = {
  start: (factoryId: string, data: { employeeId: number; workTypeId?: number; processId?: string; batchId?: string }) =>
    apiClient.post<ApiResponse>(`${BASE(factoryId)}/start`, data),

  checkout: (factoryId: string, data: { employeeId: number; reason?: string; notes?: string }) =>
    apiClient.post<ApiResponse>(`${BASE(factoryId)}/checkout`, data),

  switchRole: (factoryId: string, data: { employeeId: number; newWorkTypeId: number; newProcessId?: string }) =>
    apiClient.post<ApiResponse>(`${BASE(factoryId)}/switch`, data),

  getActive: (factoryId: string) =>
    apiClient.get<ApiResponse<ActiveSegment[]>>(`${BASE(factoryId)}/active`),
};

export type { ActiveSegment };
