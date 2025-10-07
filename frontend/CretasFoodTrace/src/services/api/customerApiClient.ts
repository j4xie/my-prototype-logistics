import { apiClient } from './apiClient';

export interface Customer {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  businessType?: string;
  creditLevel?: string;
  deliveryArea?: string;
  paymentTerms?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    productionPlans: number;
    shipmentRecords: number;
  };
}

export interface CustomerStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalShipments: number;
  totalSalesQuantity: number;
  recentOrders: any[];
}

export interface CustomerListResponse {
  success: boolean;
  message?: string;
  data: Customer[];
}

export interface CustomerDetailResponse {
  success: boolean;
  message?: string;
  data: Customer;
}

export interface CustomerStatsResponse {
  success: boolean;
  message?: string;
  data: {
    customer: Customer;
    stats: CustomerStats;
  };
}

class CustomerApiClient {
  private baseUrl = '/api/mobile/customers';

  /**
   * 获取客户列表
   */
  async getCustomers(params?: {
    isActive?: boolean;
  }): Promise<CustomerListResponse> {
    return apiClient.get(this.baseUrl, { params });
  }

  /**
   * 获取客户详情
   */
  async getCustomerById(id: string): Promise<CustomerDetailResponse> {
    return apiClient.get(`${this.baseUrl}/${id}`);
  }

  /**
   * 获取客户统计信息
   */
  async getCustomerStats(id: string): Promise<CustomerStatsResponse> {
    return apiClient.get(`${this.baseUrl}/${id}/stats`);
  }

  /**
   * 创建客户
   */
  async createCustomer(data: {
    name: string;
    contactPerson?: string;
    contactPhone?: string;
    address?: string;
    businessType?: string;
    creditLevel?: string;
    deliveryArea?: string;
    paymentTerms?: string;
  }): Promise<CustomerDetailResponse> {
    return apiClient.post(this.baseUrl, data);
  }

  /**
   * 更新客户
   */
  async updateCustomer(
    id: string,
    data: {
      name?: string;
      contactPerson?: string;
      contactPhone?: string;
      address?: string;
      businessType?: string;
      creditLevel?: string;
      deliveryArea?: string;
      paymentTerms?: string;
      isActive?: boolean;
    }
  ): Promise<CustomerDetailResponse> {
    return apiClient.put(`${this.baseUrl}/${id}`, data);
  }

  /**
   * 删除客户（软删除）
   */
  async deleteCustomer(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`${this.baseUrl}/${id}`);
  }
}

export const customerApiClient = new CustomerApiClient();
