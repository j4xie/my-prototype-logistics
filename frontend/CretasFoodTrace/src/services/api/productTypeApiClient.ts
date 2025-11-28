import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 产品类型管理API客户端
 * 总计12个API - 路径：/api/mobile/{factoryId}/product-types/*
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

/**
 * 创建产品类型请求参数
 */
export interface CreateProductTypeRequest {
  name: string;
  productCode?: string;  // 可选，由后端自动生成或用户提供
  category?: string;
  description?: string;
  unitPrice?: number;
  unit?: string;
}

/**
 * 更新产品类型请求参数（所有字段可选）
 */
export interface UpdateProductTypeRequest extends Partial<CreateProductTypeRequest> {
  isActive?: boolean;
}

class ProductTypeApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/product-types`;
  }

  async getProductTypes(params?: { factoryId?: string; isActive?: boolean; limit?: number; page?: number }): Promise<{ data: ProductType[] }> {
    const { factoryId, ...query } = params || {};
    // apiClient拦截器已统一返回data
    const apiResponse = await apiClient.get<any>(this.getPath(factoryId), { params: query });

    // 处理分页响应：apiResponse.data.content
    if (apiResponse.data?.content) {
      return { data: apiResponse.data.content };
    }

    // 兼容直接返回数组的情况
    if (Array.isArray(apiResponse.data)) {
      return { data: apiResponse.data };
    }

    // 防御性编程：兼容旧格式
    if (Array.isArray(apiResponse)) {
      return { data: apiResponse };
    }

    console.warn('[ProductTypeAPI] 未预期的响应格式:', apiResponse);
    return { data: [] };
  }

  async createProductType(data: CreateProductTypeRequest, factoryId?: string): Promise<ProductType> {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  async getProductTypeById(id: string, factoryId?: string): Promise<ProductType> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  async updateProductType(id: string, data: UpdateProductTypeRequest, factoryId?: string): Promise<ProductType> {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  async deleteProductType(id: string, factoryId?: string): Promise<void> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  async getActiveProductTypes(factoryId?: string): Promise<ProductType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  async getProductTypesByCategory(category: string, factoryId?: string): Promise<ProductType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/category/${category}`);
  }

  async searchProductTypes(keyword: string, factoryId?: string): Promise<ProductType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: { keyword } });
  }

  async checkProductCodeExists(productCode: string, factoryId?: string): Promise<{ exists: boolean }> {
    return await apiClient.get(`${this.getPath(factoryId)}/check-code`, { params: { productCode } });
  }

  async getCategories(factoryId?: string): Promise<string[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/categories`);
  }

  async initDefaults(factoryId?: string): Promise<void> {
    return await apiClient.post(`${this.getPath(factoryId)}/init-defaults`);
  }

  async batchUpdateStatus(ids: string[], isActive: boolean, factoryId?: string): Promise<void> {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, { ids, isActive });
  }
}

export const productTypeApiClient = new ProductTypeApiClient();
