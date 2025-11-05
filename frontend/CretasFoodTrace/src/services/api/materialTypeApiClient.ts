import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

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
  unit: string;
  storageType?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

class MaterialTypeApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/materials/types`;
  }

  async getMaterialTypes(params?: { factoryId?: string; isActive?: boolean }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  async createMaterialType(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  async getMaterialTypeById(id: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  async updateMaterialType(id: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  async deleteMaterialType(id: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  async getActiveMaterialTypes(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  async getMaterialTypesByCategory(category: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/category/${category}`);
  }

  async getMaterialTypesByStorageType(storageType: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/storage-type/${storageType}`);
  }

  async searchMaterialTypes(keyword: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: { keyword } });
  }

  async checkMaterialCodeExists(materialCode: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/check-code`, { params: { materialCode } });
  }

  async getCategories(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/categories`);
  }

  async getLowStockMaterials(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/low-stock`);
  }

  async batchUpdateStatus(ids: string[], isActive: boolean, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, { ids, isActive });
  }
}

export const materialTypeApiClient = new MaterialTypeApiClient();
