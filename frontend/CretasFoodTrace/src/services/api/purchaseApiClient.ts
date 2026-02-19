import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 采购管理API客户端
 * 路径：/api/mobile/{factoryId}/purchase/*
 */

// ========== 类型定义 ==========

export interface PurchaseOrder {
  id: string;
  factoryId: string;
  orderNumber: string;
  supplierId: string;
  supplierName?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PARTIAL_RECEIVED' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate?: string;
  remark?: string;
  createdBy?: string;
  approvedBy?: string;
  items?: PurchaseOrderItem[];
  receiveRecords?: PurchaseReceiveRecord[];
  createdAt: string;
  updatedAt?: string;
}

export interface PurchaseOrderItem {
  id: string;
  materialTypeId: string;
  materialTypeName?: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  unit: string;
  totalPrice: number;
  remark?: string;
}

export interface PurchaseReceiveRecord {
  id: string;
  receiveNumber: string;
  receiveDate: string;
  receivedBy?: string;
  status: string;
  remark?: string;
  items?: PurchaseReceiveItem[];
}

export interface PurchaseReceiveItem {
  id: string;
  materialTypeId: string;
  materialTypeName?: string;
  receivedQuantity: number;
  unit: string;
  batchNumber?: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  expectedDeliveryDate?: string;
  remark?: string;
  items: {
    materialTypeId: string;
    quantity: number;
    unitPrice: number;
    unit: string;
  }[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ========== API客户端类 ==========

class PurchaseApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/purchase`;
  }

  /** 获取采购单列表 */
  async getOrders(params?: { page?: number; size?: number; status?: string }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<PurchaseOrder> }> {
    return apiClient.get(this.getPath(factoryId) + '/orders', { params });
  }

  /** 获取采购单详情 */
  async getOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: PurchaseOrder }> {
    return apiClient.get(this.getPath(factoryId) + `/orders/${orderId}`);
  }

  /** 创建采购单 */
  async createOrder(data: CreatePurchaseOrderRequest, factoryId?: string): Promise<{ success: boolean; data: PurchaseOrder }> {
    return apiClient.post(this.getPath(factoryId) + '/orders', data);
  }

  /** 提交审批 */
  async submitOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: PurchaseOrder }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/submit`);
  }

  /** 审批通过 */
  async approveOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: PurchaseOrder }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/approve`);
  }

  /** 驳回 */
  async rejectOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: PurchaseOrder }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/reject`);
  }

  /** 取消 */
  async cancelOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: PurchaseOrder }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/cancel`);
  }

  /** 收货 */
  async receiveOrder(orderId: string, items: { materialTypeId: string; receivedQuantity: number; unit: string }[], factoryId?: string): Promise<{ success: boolean; data: PurchaseReceiveRecord }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/receive`, { items });
  }
}

export const purchaseApiClient = new PurchaseApiClient();
