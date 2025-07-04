// 物流模块API - 基础框架
import { api } from './client';

// 基础物流API框架 - 简化实现
export const logisticsApi = {
  // 获取运输订单
  getTransportOrders: async (params?: { status?: string; limit?: number }) => {
    const response = await api.get('/api/logistics/transport-orders', { params });
    return response.data;
  },

  // 获取配送管理
  getDeliveries: async (params?: { orderId?: string; status?: string }) => {
    const response = await api.get('/api/logistics/deliveries', { params });
    return response.data;
  },

  // 获取物流路线
  getRoutes: async (params?: { origin?: string; destination?: string }) => {
    const response = await api.get('/api/logistics/routes', { params });
    return response.data;
  },

  // 获取车辆信息
  getVehicles: async (params?: { status?: string; type?: string }) => {
    const response = await api.get('/api/logistics/vehicles', { params });
    return response.data;
  },

  // 获取物流追踪
  getTracking: async (orderId: string) => {
    const response = await api.get(`/api/logistics/tracking/${orderId}`);
    return response.data;
  }
};