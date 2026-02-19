import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 销售管理API客户端
 * 路径：/api/mobile/{factoryId}/sales/*
 */

// ========== 类型定义 ==========

export interface SalesOrder {
  id: string;
  factoryId: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate?: string;
  remark?: string;
  createdBy?: string;
  items?: SalesOrderItem[];
  deliveryRecords?: SalesDeliveryRecord[];
  createdAt: string;
  updatedAt?: string;
}

export interface SalesOrderItem {
  id: string;
  productTypeId: string;
  productTypeName?: string;
  quantity: number;
  deliveredQuantity: number;
  unitPrice: number;
  unit: string;
  totalPrice: number;
}

export interface SalesDeliveryRecord {
  id: string;
  deliveryNumber: string;
  deliveryDate: string;
  deliveredBy?: string;
  status: string;
  remark?: string;
  items?: SalesDeliveryItem[];
}

export interface SalesDeliveryItem {
  id: string;
  productTypeId: string;
  productTypeName?: string;
  deliveredQuantity: number;
  unit: string;
  batchNumber?: string;
}

export interface FinishedGoodsBatch {
  id: string;
  factoryId: string;
  batchNumber: string;
  productTypeId: string;
  productTypeName?: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  unit: string;
  productionDate: string;
  expiryDate?: string;
  unitCost?: number;
  storageLocation?: string;
  createdAt: string;
}

export interface CreateSalesOrderRequest {
  customerId: string;
  expectedDeliveryDate?: string;
  remark?: string;
  items: {
    productTypeId: string;
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

class SalesApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/sales`;
  }

  /** 获取销售单列表 */
  async getOrders(params?: { page?: number; size?: number; status?: string }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<SalesOrder> }> {
    return apiClient.get(this.getPath(factoryId) + '/orders', { params });
  }

  /** 获取销售单详情 */
  async getOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: SalesOrder }> {
    return apiClient.get(this.getPath(factoryId) + `/orders/${orderId}`);
  }

  /** 创建销售单 */
  async createOrder(data: CreateSalesOrderRequest, factoryId?: string): Promise<{ success: boolean; data: SalesOrder }> {
    return apiClient.post(this.getPath(factoryId) + '/orders', data);
  }

  /** 确认销售单 */
  async confirmOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: SalesOrder }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/confirm`);
  }

  /** 取消销售单 */
  async cancelOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: SalesOrder }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/cancel`);
  }

  /** 发货 */
  async deliverOrder(orderId: string, items: { productTypeId: string; deliveredQuantity: number; unit: string }[], factoryId?: string): Promise<{ success: boolean; data: SalesDeliveryRecord }> {
    return apiClient.post(this.getPath(factoryId) + `/orders/${orderId}/deliver`, { items });
  }

  /** 获取成品库存列表 */
  async getFinishedGoods(params?: { page?: number; size?: number }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<FinishedGoodsBatch> }> {
    return apiClient.get(this.getPath(factoryId) + '/finished-goods', { params });
  }
}

export const salesApiClient = new SalesApiClient();
