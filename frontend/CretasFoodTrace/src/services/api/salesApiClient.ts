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

export interface CreateDeliveryRequest {
  /** 关联的销售订单ID（可选，支持无单出库） */
  salesOrderId?: string;
  customerId: string;
  deliveryDate: string;
  deliveryAddress?: string;
  logisticsCompany?: string;
  trackingNumber?: string;
  remark?: string;
  items: CreateDeliveryItemRequest[];
}

export interface CreateDeliveryItemRequest {
  productTypeId: string;
  productName?: string;
  deliveredQuantity: number;
  unit: string;
  unitPrice?: number;
  remark?: string;
}

export interface SalesStatistics {
  [key: string]: unknown;
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

  // ==================== 销售订单 ====================

  /** 获取销售单列表 */
  async getOrders(params?: { page?: number; size?: number }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<SalesOrder> }> {
    return apiClient.get(this.getPath(factoryId) + '/orders', { params });
  }

  /** 按状态查询销售单列表 */
  async getOrdersByStatus(status: SalesOrder['status'], params?: { page?: number; size?: number }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<SalesOrder> }> {
    return apiClient.get(this.getPath(factoryId) + '/orders/by-status', { params: { status, ...params } });
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

  // ==================== 发货/出库 ====================

  /** 创建发货单 (POST /deliveries) */
  async createDelivery(data: CreateDeliveryRequest, factoryId?: string): Promise<{ success: boolean; data: SalesDeliveryRecord }> {
    return apiClient.post(this.getPath(factoryId) + '/deliveries', data);
  }

  /** 获取发货单列表 (GET /deliveries) */
  async getDeliveries(params?: { page?: number; size?: number }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<SalesDeliveryRecord> }> {
    return apiClient.get(this.getPath(factoryId) + '/deliveries', { params });
  }

  /** 获取发货单详情 (GET /deliveries/{deliveryId}) */
  async getDelivery(deliveryId: string, factoryId?: string): Promise<{ success: boolean; data: SalesDeliveryRecord }> {
    return apiClient.get(this.getPath(factoryId) + `/deliveries/${deliveryId}`);
  }

  /** 发货确认，扣减成品库存 (POST /deliveries/{deliveryId}/ship) */
  async shipDelivery(deliveryId: string, factoryId?: string): Promise<{ success: boolean; data: SalesDeliveryRecord }> {
    return apiClient.post(this.getPath(factoryId) + `/deliveries/${deliveryId}/ship`);
  }

  /** 签收确认 (POST /deliveries/{deliveryId}/delivered) */
  async confirmDelivered(deliveryId: string, factoryId?: string): Promise<{ success: boolean; data: SalesDeliveryRecord }> {
    return apiClient.post(this.getPath(factoryId) + `/deliveries/${deliveryId}/delivered`);
  }

  /** 按销售订单查询发货记录 (GET /deliveries/by-order/{orderId}) */
  async getDeliveriesByOrder(orderId: string, factoryId?: string): Promise<{ success: boolean; data: SalesDeliveryRecord[] }> {
    return apiClient.get(this.getPath(factoryId) + `/deliveries/by-order/${orderId}`);
  }

  // ==================== 成品库存 ====================

  /** 获取成品库存列表 */
  async getFinishedGoods(params?: { page?: number; size?: number }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<FinishedGoodsBatch> }> {
    return apiClient.get(this.getPath(factoryId) + '/finished-goods', { params });
  }

  /** 查询可用成品批次（按产品） */
  async getAvailableBatches(productTypeId: string, factoryId?: string): Promise<{ success: boolean; data: FinishedGoodsBatch[] }> {
    return apiClient.get(this.getPath(factoryId) + '/finished-goods/available', { params: { productTypeId } });
  }

  // ==================== 统计 ====================

  /** 销售统计数据 */
  async getStatistics(factoryId?: string): Promise<{ success: boolean; data: SalesStatistics }> {
    return apiClient.get(this.getPath(factoryId) + '/statistics');
  }
}

export const salesApiClient = new SalesApiClient();
