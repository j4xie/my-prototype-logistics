// 农业模块API - 基础框架
import { api } from './client';

// 基础农业API框架 - 简化实现
export const farmingApi = {
  // 获取农场列表
  getFarms: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/api/farming/farms', { params });
    return response.data;
  },

  // 获取田地列表
  getFields: async (params?: { farmId?: string; status?: string }) => {
    const response = await api.get('/api/farming/fields', { params });
    return response.data;
  },

  // 获取种植计划
  getPlantingPlans: async (params?: { fieldId?: string; season?: string }) => {
    const response = await api.get('/api/farming/planting-plans', { params });
    return response.data;
  },

  // 获取收获记录
  getHarvestRecords: async (params?: { farmId?: string; dateFrom?: string; dateTo?: string }) => {
    const response = await api.get('/api/farming/harvest-records', { params });
    return response.data;
  },

  // 获取农场活动
  getFarmActivities: async (params?: { farmId?: string; type?: string }) => {
    const response = await api.get('/api/farming/activities', { params });
    return response.data;
  }
};