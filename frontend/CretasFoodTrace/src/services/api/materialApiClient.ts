import { apiClient } from './apiClient';

export interface MaterialType {
  id: string;
  name: string;
  category?: string;
  unit: string;
  description?: string;
}

export const materialAPI = {
  getMaterialTypes: async (): Promise<MaterialType[]> => {
    const response: any = await apiClient.get('/api/mobile/materials/types');
    return response.data || response || [];
  },

  createMaterialType: async (data: {
    name: string;
    category?: string;
    unit?: string;
    description?: string;
  }): Promise<MaterialType> => {
    const response: any = await apiClient.post('/api/mobile/materials/types', data);
    return response.data || response;
  },
};
