import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 产品类型管理API客户端
 * 总计12个API - 路径：/api/mobile/{factoryId}/products/types/*
 */

export interface ProductType {
  id: string;
  factoryId: string;
  productCode: string;
  name: string;
  category?: string;
  description?: string;
  unitPrice?: number;
  unit?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

class ProductTypeApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/products/types`;
  }

  async getProductTypes(params?: { factoryId?: string; isActive?: boolean; limit?: number; page?: number }) {
    const { factoryId, ...query } = params || {};
    // apiClient拦截器已统一返回data
    const apiResponse = await apiClient.get<any>(this.getPath(factoryId), { params: query });
    // 兼容旧格式：包装成 {data: [...]}
    if (apiResponse.content) {
      return { data: apiResponse.content };
    }
    return { data: apiResponse };
  }

  async createProductType(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  async getProductTypeById(id: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  async updateProductType(id: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  async deleteProductType(id: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  async getActiveProductTypes(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  async getProductTypesByCategory(category: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/category/${category}`);
  }

  async searchProductTypes(keyword: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: { keyword } });
  }

  async checkProductCodeExists(productCode: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/check-code`, { params: { productCode } });
  }

  async getCategories(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/categories`);
  }

  async initDefaults(factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/init-defaults`);
  }

  async batchUpdateStatus(ids: string[], isActive: boolean, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, { ids, isActive });
  }
}

export const productTypeApiClient = new ProductTypeApiClient();
