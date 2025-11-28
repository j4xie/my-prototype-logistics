import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 原材料类型管理API客户端
 * 总计13个API - 路径：/api/mobile/{factoryId}/materials/types/*
 */

export interface MaterialType {
  id: string;
  factoryId: string;
  materialCode: string;
  name: string;
  category?: string;
  specification?: string;
  unit: string;
  shelfLife?: number;
  storageType?: string;
  storageConditions?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 创建原材料类型请求参数
 */
export interface CreateMaterialTypeRequest {
  code?: string;  // 可选，由后端自动生成或用户提供
  name: string;
  category: string;
  specification?: string;
  unit: string;
  shelfLife?: number;
  storageType: string;
  storageConditions?: string;
  description?: string;
}

/**
 * 更新原材料类型请求参数（所有字段可选）
 */
export interface UpdateMaterialTypeRequest extends Partial<CreateMaterialTypeRequest> {
  isActive?: boolean;
}

class MaterialTypeApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/materials/types`;
  }

  async getMaterialTypes(params?: { factoryId?: string; isActive?: boolean }): Promise<{ data: MaterialType[] }> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  async createMaterialType(data: CreateMaterialTypeRequest, factoryId?: string): Promise<MaterialType> {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  async getMaterialTypeById(id: string, factoryId?: string): Promise<MaterialType> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  async updateMaterialType(id: string, data: UpdateMaterialTypeRequest, factoryId?: string): Promise<MaterialType> {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  async deleteMaterialType(id: string, factoryId?: string): Promise<void> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  async getActiveMaterialTypes(factoryId?: string): Promise<{ data: MaterialType[] }> {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  async getMaterialTypesByCategory(category: string, factoryId?: string): Promise<MaterialType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/category/${category}`);
  }

  async getMaterialTypesByStorageType(storageType: string, factoryId?: string): Promise<MaterialType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/storage-type/${storageType}`);
  }

  async searchMaterialTypes(keyword: string, factoryId?: string): Promise<{ data: { content: MaterialType[] } }> {
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: { keyword } });
  }

  async checkMaterialCodeExists(materialCode: string, factoryId?: string): Promise<{ exists: boolean }> {
    return await apiClient.get(`${this.getPath(factoryId)}/check-code`, { params: { materialCode } });
  }

  async getCategories(factoryId?: string): Promise<string[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/categories`);
  }

  async getLowStockMaterials(factoryId?: string): Promise<MaterialType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/low-stock`);
  }

  async batchUpdateStatus(ids: string[], isActive: boolean, factoryId?: string): Promise<void> {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, { ids, isActive });
  }
}

export const materialTypeApiClient = new MaterialTypeApiClient();
