import { apiClient } from './apiClient';

export interface WorkType {
  id: string;
  factoryId: string;
  typeCode: string;
  typeName: string;
  department?: 'farming' | 'processing' | 'logistics' | 'quality' | 'management';
  description?: string;
  colorCode?: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    timeClocks: number;
    workSessions: number;
  };
}

export interface CreateWorkTypeRequest {
  typeCode: string;
  typeName: string;
  department?: 'farming' | 'processing' | 'logistics' | 'quality' | 'management';
  description?: string;
  colorCode?: string;
}

export interface UpdateWorkTypeRequest {
  typeName?: string;
  department?: 'farming' | 'processing' | 'logistics' | 'quality' | 'management';
  description?: string;
  colorCode?: string;
  isActive?: boolean;
}

export interface GetWorkTypesParams {
  department?: string;
  isActive?: string;
}

export const workTypesApiClient = {
  // 获取工作类型列表
  getWorkTypes: async (params?: GetWorkTypesParams): Promise<{ success: boolean; data: WorkType[]; message?: string }> => {
    return apiClient.get('/mobile/work-types', { params });
  },

  // 创建工作类型
  createWorkType: async (data: CreateWorkTypeRequest): Promise<{ success: boolean; data: WorkType; message?: string }> => {
    return apiClient.post('/mobile/work-types', data);
  },

  // 获取工作类型详情
  getWorkTypeById: async (id: string): Promise<{ success: boolean; data: WorkType; message?: string }> => {
    return apiClient.get(`/mobile/work-types/${id}`);
  },

  // 更新工作类型
  updateWorkType: async (id: string, data: UpdateWorkTypeRequest): Promise<{ success: boolean; data: WorkType; message?: string }> => {
    return apiClient.put(`/mobile/work-types/${id}`, data);
  },

  // 删除工作类型
  deleteWorkType: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return apiClient.delete(`/mobile/work-types/${id}`);
  },

  // 初始化默认工作类型
  initializeDefaultWorkTypes: async (): Promise<{ success: boolean; data: { count: number }; message?: string }> => {
    return apiClient.get('/mobile/work-types/init-defaults');
  },
};