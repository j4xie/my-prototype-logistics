import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 报废记录API客户端
 * 路径：/api/mobile/{factoryId}/disposal-records/*
 *
 * 业务场景：管理报废记录，追踪损耗，审批流程
 */

// ========== 类型定义 ==========

export interface DisposalRecord {
  id: number;
  factoryId: string;
  disposalType: 'raw_material' | 'semi_finished' | 'finished_product' | 'package';
  relatedBatchId?: string;
  disposalQuantity: number;
  quantityUnit: string;
  disposalReason: string;
  disposalMethod?: string;
  disposalDate: string;
  estimatedLoss?: number;
  recoveryValue?: number;
  isApproved: boolean;
  approverId?: number;
  approverName?: string;
  approvedAt?: string;
  notes?: string;
  isRecyclable?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDisposalRequest {
  disposalType: 'raw_material' | 'semi_finished' | 'finished_product' | 'package';
  relatedBatchId?: string;
  disposalQuantity: number;
  quantityUnit: string;
  disposalReason: string;
  disposalMethod?: string;
  estimatedLoss?: number;
  recoveryValue?: number;
  notes?: string;
  isRecyclable?: boolean;
}

export interface DisposalStats {
  totalCount: number;
  pendingCount: number;
  totalQuantity: number;
  totalLoss: number;
  recoveryValue: number;
  netLoss: number;
}

// ========== API客户端类 ==========

class DisposalRecordApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/disposal-records`;
  }

  /**
   * 1. 获取报废记录列表（分页）
   * GET /api/mobile/{factoryId}/disposal-records
   */
  async getDisposalRecords(params?: {
    factoryId?: string;
    page?: number;
    size?: number;
    type?: string;
  }): Promise<{ data: DisposalRecord[]; totalElements: number; totalPages: number }> {
    const { factoryId, ...queryParams } = params || {};
    const apiResponse = await apiClient.get<any>(
      `${this.getPath(factoryId)}`,
      { params: queryParams }
    );

    if (apiResponse.data && Array.isArray(apiResponse.data)) {
      return {
        data: apiResponse.data,
        totalElements: apiResponse.totalElements || apiResponse.data.length,
        totalPages: apiResponse.totalPages || 1
      };
    } else if (Array.isArray(apiResponse)) {
      return { data: apiResponse, totalElements: apiResponse.length, totalPages: 1 };
    }

    return { data: [], totalElements: 0, totalPages: 0 };
  }

  /**
   * 2. 获取单个报废记录
   * GET /api/mobile/{factoryId}/disposal-records/{id}
   */
  async getDisposalRecordById(id: number, factoryId?: string): Promise<DisposalRecord> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/${id}`
    );
    return response.data || response;
  }

  /**
   * 3. 创建报废记录
   * POST /api/mobile/{factoryId}/disposal-records
   */
  async createDisposalRecord(
    request: CreateDisposalRequest,
    factoryId?: string
  ): Promise<DisposalRecord> {
    const response = await apiClient.post<any>(
      `${this.getPath(factoryId)}`,
      request
    );
    return response.data || response;
  }

  /**
   * 4. 更新报废记录
   * PUT /api/mobile/{factoryId}/disposal-records/{id}
   */
  async updateDisposalRecord(
    id: number,
    request: Partial<CreateDisposalRequest>,
    factoryId?: string
  ): Promise<DisposalRecord> {
    const response = await apiClient.put<any>(
      `${this.getPath(factoryId)}/${id}`,
      request
    );
    return response.data || response;
  }

  /**
   * 5. 审批报废记录
   * PUT /api/mobile/{factoryId}/disposal-records/{id}/approve
   */
  async approveDisposalRecord(
    id: number,
    approverId: number,
    approverName: string,
    factoryId?: string
  ): Promise<DisposalRecord> {
    const response = await apiClient.put<any>(
      `${this.getPath(factoryId)}/${id}/approve`,
      { approverId, approverName }
    );
    return response.data || response;
  }

  /**
   * 6. 删除报废记录
   * DELETE /api/mobile/{factoryId}/disposal-records/{id}
   */
  async deleteDisposalRecord(id: number, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 7. 获取待审批的报废记录
   * GET /api/mobile/{factoryId}/disposal-records/pending
   */
  async getPendingApprovals(factoryId?: string): Promise<DisposalRecord[]> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/pending`
    );
    return response.data || response || [];
  }

  /**
   * 8. 按日期范围查询
   * GET /api/mobile/{factoryId}/disposal-records/date-range
   */
  async getDisposalsByDateRange(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<DisposalRecord[]> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/date-range`,
      { params: queryParams }
    );
    return response.data || response || [];
  }

  /**
   * 9. 获取报废统计
   * GET /api/mobile/{factoryId}/disposal-records/stats
   */
  async getDisposalStats(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<DisposalStats> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/stats`,
      { params: queryParams }
    );
    return response.data || response;
  }

  /**
   * 10. 获取可回收报废记录
   * GET /api/mobile/{factoryId}/disposal-records/recyclable
   */
  async getRecyclableDisposals(factoryId?: string): Promise<DisposalRecord[]> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/recyclable`
    );
    return response.data || response || [];
  }
}

export const disposalRecordApiClient = new DisposalRecordApiClient();
export default disposalRecordApiClient;
