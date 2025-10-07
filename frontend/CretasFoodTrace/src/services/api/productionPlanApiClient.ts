import { apiClient } from './apiClient';

// ==================== 类型定义 ====================

export interface ProductionPlan {
  id: string;
  planNumber: string;
  factoryId: string;
  productType: {
    id: string;
    name: string;
    code: string;
  };
  customer: {
    id: string;
    name: string;
    code: string;
  };
  plannedQuantity: number;
  estimatedMaterialUsage: number;
  actualMaterialUsed?: number;
  actualQuantity?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'shipped' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: number;
    fullName: string;
  };
  _count?: {
    materialConsumptions: number;
    shipmentRecords: number;
  };
}

export interface CreateProductionPlanRequest {
  productTypeId: string;
  customerId: string;
  plannedQuantity: number;
  selectedBatches?: {
    batchId: string;
    quantity: number;
    unitPrice: number;
  }[];
  notes?: string;
}

export interface UpdateProductionPlanRequest {
  plannedQuantity?: number;
  actualQuantity?: number;
  notes?: string;
  status?: string;
}

export interface ConsumeMaterialRequest {
  batchId: string;
  consumedQuantity: number;
  notes?: string;
}

export interface CreateShipmentRequest {
  shippedQuantity: number;
  actualWeight: number;
  qualityGrade?: string;
  shippedAt?: string;
  notes?: string;
}

export interface MaterialConsumption {
  id: string;
  planId: string;
  batchId: string;
  consumedQuantity: number;
  notes?: string;
  consumedAt: string;
  batch: {
    id: string;
    batchNumber: string;
    rawMaterialCategory: string;
  };
  recorder?: {
    id: number;
    fullName: string;
  };
}

export interface ShipmentRecord {
  id: string;
  shipmentNumber: string;
  planId: string;
  customerId: string;
  shippedQuantity: number;
  actualWeight: number;
  qualityGrade?: string;
  shippedAt: string;
  notes?: string;
  plan?: {
    planNumber: string;
    productType: {
      name: string;
    };
  };
  customer: {
    id: string;
    name: string;
    code: string;
  };
  recorder?: {
    id: number;
    fullName: string;
  };
}

export interface AvailableStock {
  batchId: string;
  batchNumber: string;
  materialCategory: string;
  totalWeight: number;
  consumed: number;
  available: number;
  percentage: number;
  createdAt: string;
}

export interface StockSummary {
  category: string;
  totalAvailable: number;
  batchCount: number;
}

export interface ProductionPlanListResponse {
  success: boolean;
  message: string;
  data: {
    plans: ProductionPlan[];
    pagination: {
      current: number;
      total: number;
      count: number;
      limit: number;
    };
  };
}

export interface ProductionPlanResponse {
  success: boolean;
  message: string;
  data: ProductionPlan;
}

export interface AvailableStockResponse {
  success: boolean;
  message: string;
  data: {
    stockList: AvailableStock[];
    summary: StockSummary[];
    totalBatches: number;
  };
}

export interface ShipmentListResponse {
  success: boolean;
  message: string;
  data: {
    shipments: ShipmentRecord[];
    pagination: {
      current: number;
      total: number;
      count: number;
      limit: number;
    };
  };
}

// ==================== API客户端 ====================

class ProductionPlanApiClient {
  private baseUrl = '/api/mobile/production-plans';

  /**
   * 获取生产计划列表
   */
  async getProductionPlans(params?: {
    page?: number;
    limit?: number;
    status?: string;
    productTypeId?: string;
    merchantId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ProductionPlanListResponse> {
    return apiClient.get(this.baseUrl, { params });
  }

  /**
   * 获取生产计划详情
   */
  async getProductionPlanById(id: string): Promise<ProductionPlanResponse> {
    return apiClient.get(`${this.baseUrl}/${id}`);
  }

  /**
   * 创建生产计划
   */
  async createProductionPlan(data: CreateProductionPlanRequest): Promise<ProductionPlanResponse> {
    return apiClient.post(this.baseUrl, data);
  }

  /**
   * 更新生产计划
   */
  async updateProductionPlan(id: string, data: UpdateProductionPlanRequest): Promise<ProductionPlanResponse> {
    return apiClient.put(`${this.baseUrl}/${id}`, data);
  }

  /**
   * 开始生产
   */
  async startProduction(id: string): Promise<ProductionPlanResponse> {
    return apiClient.post(`${this.baseUrl}/${id}/start`);
  }

  /**
   * 完成生产
   */
  async completeProduction(id: string, actualQuantity: number): Promise<ProductionPlanResponse> {
    return apiClient.post(`${this.baseUrl}/${id}/complete`, { actualQuantity });
  }

  /**
   * 记录原料消耗
   */
  async consumeMaterial(id: string, data: ConsumeMaterialRequest): Promise<{
    success: boolean;
    message: string;
    data: MaterialConsumption;
  }> {
    return apiClient.post(`${this.baseUrl}/${id}/consume-material`, data);
  }

  /**
   * 获取可用原料库存
   */
  async getAvailableStock(params?: {
    productTypeId?: string;
    materialCategory?: string;
  }): Promise<AvailableStockResponse> {
    return apiClient.get(`${this.baseUrl}/available-stock`, { params });
  }

  /**
   * 记录成品出库
   */
  async createShipment(id: string, data: CreateShipmentRequest): Promise<{
    success: boolean;
    message: string;
    data: ShipmentRecord;
  }> {
    return apiClient.post(`${this.baseUrl}/${id}/ship`, data);
  }

  /**
   * 获取出库记录列表
   */
  async getShipments(params?: {
    page?: number;
    limit?: number;
    merchantId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ShipmentListResponse> {
    return apiClient.get(`${this.baseUrl}/shipments/list`, { params });
  }
}

export const productionPlanApiClient = new ProductionPlanApiClient();
