import { apiClient } from './apiClient';

export interface ProductType {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  category?: string;
  description?: string;
  unitPrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductTypeListResponse {
  success: boolean;
  message: string;
  data: {
    productTypes: ProductType[];
    pagination?: {
      current: number;
      total: number;
      count: number;
      limit: number;
    };
  };
}

class ProductTypeApiClient {
  private baseUrl = '/api/mobile/products/types';

  async getProductTypes(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }): Promise<ProductTypeListResponse> {
    return apiClient.get(this.baseUrl, { params });
  }
}

export const productTypeApiClient = new ProductTypeApiClient();
