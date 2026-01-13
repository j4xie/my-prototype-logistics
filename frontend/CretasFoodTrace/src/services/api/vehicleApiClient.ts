/**
 * 车辆管理 API 客户端
 * 用于仓库装车管理
 */

import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 车辆信息
 */
export interface Vehicle {
  id: string;
  factoryId?: string;
  plateNumber: string;
  driver: string;
  phone: string;
  capacity: number;
  currentLoad: number;
  status: 'available' | 'loading' | 'dispatched' | 'maintenance';
  vehicleType?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 创建/更新车辆请求
 */
export interface VehicleRequest {
  plateNumber: string;
  driver?: string;
  phone?: string;
  capacity?: number;
  currentLoad?: number;
  vehicleType?: string;
  notes?: string;
}

/**
 * 车辆 API 客户端
 */
export const vehicleApiClient = {
  /**
   * 获取车辆列表
   * @param status 可选状态筛选
   */
  async getVehicles(status?: string): Promise<Vehicle[]> {
    const factoryId = getCurrentFactoryId();
    const params = status ? { status } : {};
    const response = await apiClient.get<Vehicle[]>(
      `/api/mobile/${factoryId}/vehicles`,
      { params }
    );
    return response || [];
  },

  /**
   * 获取可用车辆
   */
  async getAvailableVehicles(): Promise<Vehicle[]> {
    const factoryId = getCurrentFactoryId();
    const response = await apiClient.get<Vehicle[]>(
      `/api/mobile/${factoryId}/vehicles/available`
    );
    return response || [];
  },

  /**
   * 按状态获取车辆
   * @param status 车辆状态: available, loading, dispatched, maintenance
   */
  async getVehiclesByStatus(status: string): Promise<Vehicle[]> {
    return this.getVehicles(status);
  },

  /**
   * 获取车辆详情
   */
  async getVehicle(vehicleId: string): Promise<Vehicle> {
    const factoryId = getCurrentFactoryId();
    const response = await apiClient.get<Vehicle>(
      `/api/mobile/${factoryId}/vehicles/${vehicleId}`
    );
    if (!response) {
      throw new Error('车辆不存在');
    }
    return response;
  },

  /**
   * 创建车辆
   */
  async createVehicle(data: VehicleRequest): Promise<Vehicle> {
    const factoryId = getCurrentFactoryId();
    const response = await apiClient.post<Vehicle>(
      `/api/mobile/${factoryId}/vehicles`,
      data
    );
    if (!response) {
      throw new Error('创建失败');
    }
    return response;
  },

  /**
   * 更新车辆
   */
  async updateVehicle(vehicleId: string, data: Partial<VehicleRequest>): Promise<Vehicle> {
    const factoryId = getCurrentFactoryId();
    const response = await apiClient.put<Vehicle>(
      `/api/mobile/${factoryId}/vehicles/${vehicleId}`,
      data
    );
    if (!response) {
      throw new Error('更新失败');
    }
    return response;
  },

  /**
   * 更新车辆状态
   */
  async updateVehicleStatus(vehicleId: string, status: string): Promise<Vehicle> {
    const factoryId = getCurrentFactoryId();
    const response = await apiClient.patch<Vehicle>(
      `/api/mobile/${factoryId}/vehicles/${vehicleId}/status`,
      null,
      { params: { status } }
    );
    if (!response) {
      throw new Error('状态更新失败');
    }
    return response;
  },

  /**
   * 更新装载量
   */
  async updateCurrentLoad(vehicleId: string, load: number): Promise<Vehicle> {
    const factoryId = getCurrentFactoryId();
    const response = await apiClient.patch<Vehicle>(
      `/api/mobile/${factoryId}/vehicles/${vehicleId}/load`,
      null,
      { params: { load } }
    );
    if (!response) {
      throw new Error('装载量更新失败');
    }
    return response;
  },

  /**
   * 删除车辆
   */
  async deleteVehicle(vehicleId: string): Promise<void> {
    const factoryId = getCurrentFactoryId();
    await apiClient.delete(`/api/mobile/${factoryId}/vehicles/${vehicleId}`);
  },
};

export default vehicleApiClient;
