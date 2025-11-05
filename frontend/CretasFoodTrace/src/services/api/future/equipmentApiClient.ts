import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 设备管理API客户端
 * 总计24个API - 路径：/api/mobile/{factoryId}/equipment/*
 */

class EquipmentApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/equipment`;
  }

  // 1. 获取设备列表（分页）
  async getEquipment(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 创建设备
  async createEquipment(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 3. 获取设备详情
  async getEquipmentById(equipmentId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${equipmentId}`);
  }

  // 4. 更新设备
  async updateEquipment(equipmentId: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${equipmentId}`, data);
  }

  // 5. 删除设备
  async deleteEquipment(equipmentId: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${equipmentId}`);
  }

  // 6. 获取活跃设备列表
  async getActiveEquipment(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  // 7. 按类型获取设备
  async getEquipmentByType(type: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/type/${type}`);
  }

  // 8. 按状态获取设备
  async getEquipmentByStatus(status: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/status/${status}`);
  }

  // 9. 搜索设备
  async searchEquipment(keyword: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: { keyword } });
  }

  // 10. 检查设备编码是否存在
  async checkEquipmentCodeExists(equipmentCode: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/check-code`, {
      params: { equipmentCode }
    });
  }

  // 11. 更新设备状态
  async updateEquipmentStatus(equipmentId: string, status: string, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${equipmentId}/status`, { status });
  }

  // 12. 记录维护
  async recordMaintenance(equipmentId: string, data: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${equipmentId}/maintenance`, data);
  }

  // 13. 获取维护历史
  async getMaintenanceHistory(equipmentId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${equipmentId}/maintenance-history`);
  }

  // 14. 获取使用记录
  async getUsageHistory(equipmentId: string, params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${equipmentId}/usage-history`, {
      params
    });
  }

  // 15. 获取设备统计
  async getEquipmentStatistics(equipmentId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${equipmentId}/statistics`);
  }

  // 16. 获取总体统计
  async getOverallStatistics(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics/overall`);
  }

  // 17. 获取利用率统计
  async getUtilizationStatistics(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics/utilization`, {
      params
    });
  }

  // 18. 获取维护需求
  async getMaintenanceNeeds(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/maintenance-needs`);
  }

  // 19. 获取设备类型列表
  async getEquipmentTypes(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/types`);
  }

  // 20. 获取设备类型分布
  async getTypeDistribution(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/type-distribution`);
  }

  // 21. 获取状态分布
  async getStatusDistribution(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/status-distribution`);
  }

  // 22. 批量更新状态
  async batchUpdateStatus(ids: string[], status: string, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, { ids, status });
  }

  // 23. 导出设备列表
  async exportEquipment(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: query,
      responseType: 'blob'
    });
  }

  // 24. 批量导入设备
  async importEquipment(file: File, factoryId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post(`${this.getPath(factoryId)}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
}

export const equipmentApiClient = new EquipmentApiClient();
export default equipmentApiClient;
