import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

export interface MaterialType {
  id: string;
  name: string;
  category?: string;
  unit: string;
  description?: string;
}

export const materialAPI = {
  getMaterialTypes: async (factoryId?: string): Promise<MaterialType[]> => {
    const fId = factoryId || DEFAULT_FACTORY_ID;
    // 使用 /active 端点获取激活的原材料类型（不需要分页参数）
    const response: any = await apiClient.get(`/api/mobile/${fId}/materials/types/active`);
    // 后端返回格式: { success: true, data: [...] }
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    // 兼容旧格式
    return Array.isArray(response) ? response : [];
  },

  createMaterialType: async (data: {
    name: string;
    category?: string;
    unit?: string;
    description?: string;
    code?: string;
  }, factoryId?: string): Promise<MaterialType> => {
    const fId = factoryId || DEFAULT_FACTORY_ID;
    // 如果没有提供code，生成一个基于name的code
    const materialData = {
      ...data,
      code: data.code || `MAT_${data.name.toUpperCase().replace(/\s+/g, '_')}`,
      isActive: true,
    };
    const response: any = await apiClient.post(`/api/mobile/${fId}/materials/types`, materialData);
    return response.data || response;
  },
};
