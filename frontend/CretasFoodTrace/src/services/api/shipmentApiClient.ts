import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 出货记录API客户端
 * 路径：/api/mobile/{factoryId}/shipments/*
 *
 * 业务场景：管理产品出货记录，追踪物流状态
 */

// ========== 类型定义 ==========

export interface ShipmentRecord {
  id: string;
  factoryId: string;
  shipmentNumber: string;
  customerId: string;
  orderNumber?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalAmount?: number;
  shipmentDate: string;
  deliveryAddress: string;
  logisticsCompany?: string;
  trackingNumber?: string;
  status: 'pending' | 'shipped' | 'delivered' | 'returned';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateShipmentRequest {
  customerId: string;
  orderNumber?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  shipmentDate?: string;
  deliveryAddress: string;
  logisticsCompany?: string;
  trackingNumber?: string;
  notes?: string;
}

export interface UpdateShipmentRequest {
  customerId?: string;
  orderNumber?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  shipmentDate?: string;
  deliveryAddress?: string;
  logisticsCompany?: string;
  trackingNumber?: string;
  notes?: string;
}

export interface ShipmentStats {
  total: number;
  pending: number;
  shipped: number;
  delivered: number;
  returned: number;
}

// ========== API客户端类 ==========

class ShipmentApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/shipments`;
  }

  /**
   * 1. 获取出货记录列表（分页）
   * GET /api/mobile/{factoryId}/shipments
   */
  async getShipments(params?: {
    factoryId?: string;
    page?: number;
    size?: number;
    status?: string;
  }): Promise<{ data: ShipmentRecord[]; totalElements: number; totalPages: number }> {
    const { factoryId, ...queryParams } = params || {};
    const apiResponse = await apiClient.get<any>(
      `${this.getPath(factoryId)}`,
      { params: queryParams }
    );

    // 处理后端返回格式
    if (apiResponse.data && Array.isArray(apiResponse.data)) {
      return {
        data: apiResponse.data,
        totalElements: apiResponse.totalElements || apiResponse.data.length,
        totalPages: apiResponse.totalPages || 1
      };
    } else if (Array.isArray(apiResponse)) {
      return { data: apiResponse, totalElements: apiResponse.length, totalPages: 1 };
    }

    console.warn('[ShipmentApiClient] 未知的响应格式:', apiResponse);
    return { data: [], totalElements: 0, totalPages: 0 };
  }

  /**
   * 2. 获取单个出货记录
   * GET /api/mobile/{factoryId}/shipments/{id}
   */
  async getShipmentById(id: string, factoryId?: string): Promise<ShipmentRecord> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/${id}`
    );
    return response.data || response;
  }

  /**
   * 3. 创建出货记录
   * POST /api/mobile/{factoryId}/shipments
   */
  async createShipment(
    request: CreateShipmentRequest,
    factoryId?: string
  ): Promise<ShipmentRecord> {
    const response = await apiClient.post<any>(
      `${this.getPath(factoryId)}`,
      request
    );
    return response.data || response;
  }

  /**
   * 4. 更新出货记录
   * PUT /api/mobile/{factoryId}/shipments/{id}
   */
  async updateShipment(
    id: string,
    request: UpdateShipmentRequest,
    factoryId?: string
  ): Promise<ShipmentRecord> {
    const response = await apiClient.put<any>(
      `${this.getPath(factoryId)}/${id}`,
      request
    );
    return response.data || response;
  }

  /**
   * 5. 更新出货状态
   * PUT /api/mobile/{factoryId}/shipments/{id}/status
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'shipped' | 'delivered' | 'returned',
    factoryId?: string
  ): Promise<ShipmentRecord> {
    const response = await apiClient.put<any>(
      `${this.getPath(factoryId)}/${id}/status`,
      { status }
    );
    return response.data || response;
  }

  /**
   * 6. 删除出货记录
   * DELETE /api/mobile/{factoryId}/shipments/{id}
   */
  async deleteShipment(id: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 7. 按客户查询出货记录
   * GET /api/mobile/{factoryId}/shipments/customer/{customerId}
   */
  async getShipmentsByCustomer(
    customerId: string,
    factoryId?: string
  ): Promise<ShipmentRecord[]> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/customer/${customerId}`
    );
    return response.data || response || [];
  }

  /**
   * 8. 按日期范围查询
   * GET /api/mobile/{factoryId}/shipments/date-range
   */
  async getShipmentsByDateRange(params: {
    startDate: string;
    endDate: string;
    factoryId?: string;
  }): Promise<ShipmentRecord[]> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/date-range`,
      { params: queryParams }
    );
    return response.data || response || [];
  }

  /**
   * 9. 物流追踪查询
   * GET /api/mobile/{factoryId}/shipments/tracking/{trackingNumber}
   */
  async getShipmentByTrackingNumber(
    trackingNumber: string,
    factoryId?: string
  ): Promise<ShipmentRecord | null> {
    try {
      const response = await apiClient.get<any>(
        `${this.getPath(factoryId)}/tracking/${trackingNumber}`
      );
      return response.data || response;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 10. 获取出货统计
   * GET /api/mobile/{factoryId}/shipments/stats
   */
  async getShipmentStats(factoryId?: string): Promise<ShipmentStats> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/stats`
    );
    return response.data || response;
  }
}

export const shipmentApiClient = new ShipmentApiClient();
export default shipmentApiClient;
