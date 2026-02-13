import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';
import type {
  WorkReportSubmitRequest,
  WorkReportResponse,
  CheckinRequest,
  CheckoutRequest,
  BatchWorkSessionResponse,
  FormTemplateResponse,
} from '../../types/workReporting';

interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

class WorkReportingApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = requireFactoryId(factoryId);
    return `/api/mobile/${currentFactoryId}/work-reporting`;
  }

  async submitReport(
    data: WorkReportSubmitRequest,
    workerId: number,
    factoryId?: string
  ): Promise<ApiResponse<WorkReportResponse>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/reports?workerId=${workerId}`,
      data
    );
  }

  async getReports(params?: {
    factoryId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
  }): Promise<ApiResponse<PagedResponse<WorkReportResponse>>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/reports`, { params: query });
  }

  async getReport(
    reportId: number,
    factoryId?: string
  ): Promise<ApiResponse<WorkReportResponse>> {
    return await apiClient.get(`${this.getPath(factoryId)}/reports/${reportId}`);
  }

  async updateReport(
    reportId: number,
    data: Partial<WorkReportSubmitRequest>,
    factoryId?: string
  ): Promise<ApiResponse<WorkReportResponse>> {
    return await apiClient.put(`${this.getPath(factoryId)}/reports/${reportId}`, data);
  }

  async approveReport(
    reportId: number,
    approved: boolean,
    factoryId?: string
  ): Promise<ApiResponse<WorkReportResponse>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/reports/${reportId}/approve?approved=${approved}`
    );
  }

  async checkin(
    data: CheckinRequest,
    factoryId?: string
  ): Promise<ApiResponse<BatchWorkSessionResponse>> {
    return await apiClient.post(`${this.getPath(factoryId)}/checkin`, data);
  }

  async checkout(
    data: CheckoutRequest,
    factoryId?: string
  ): Promise<ApiResponse<BatchWorkSessionResponse>> {
    return await apiClient.post(`${this.getPath(factoryId)}/checkout`, data);
  }

  async getCheckinList(
    batchId: number,
    factoryId?: string
  ): Promise<ApiResponse<BatchWorkSessionResponse[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/checkin/batch/${batchId}`);
  }

  async getTodayCheckins(
    employeeId: number,
    factoryId?: string
  ): Promise<ApiResponse<BatchWorkSessionResponse[]>> {
    return await apiClient.get(
      `${this.getPath(factoryId)}/checkin/today?employeeId=${employeeId}`
    );
  }

  async getSchema(
    entityType: string,
    factoryId?: string
  ): Promise<ApiResponse<FormTemplateResponse>> {
    return await apiClient.get(`${this.getPath(factoryId)}/schemas/${entityType}`);
  }

  async getSummary(params?: {
    factoryId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/summary`, { params: query });
  }
}

export const workReportingApiClient = new WorkReportingApiClient();
