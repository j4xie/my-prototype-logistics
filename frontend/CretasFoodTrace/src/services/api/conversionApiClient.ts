import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 转换率管理API客户端
 * 总计15个API - 路径：/api/mobile/{factoryId}/conversions/*
 */

export interface ConversionRate {
  id: string;
  factoryId: string;
  materialTypeId: string;
  productTypeId: string;
  conversionRate: number;
  wastageRate?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

class ConversionApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/conversions`;
  }

  // 1. 分页查询转换率配置
  async getConversionRates(params?: { factoryId?: string; page?: number; size?: number }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 创建转换率配置
  async createConversionRate(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 3. 获取转换率详情
  async getConversionRateById(id: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  // 4. 更新转换率配置
  async updateConversionRate(id: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  // 5. 删除转换率配置
  async deleteConversionRate(id: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  // 6. 根据原材料类型查询转换率
  async getConversionsByMaterial(materialTypeId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/material/${materialTypeId}`);
  }

  // 7. 根据产品类型查询转换率
  async getConversionsByProduct(productTypeId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/product/${productTypeId}`);
  }

  // 8. 获取特定原材料和产品的转换率
  async getSpecificConversionRate(params: {
    materialTypeId: string;
    productTypeId: string;
    factoryId?: string;
  }) {
    const { factoryId, ...query } = params;
    return await apiClient.get(`${this.getPath(factoryId)}/rate`, { params: query });
  }

  // 9. 计算原材料需求量
  async calculateMaterialRequirement(params: {
    productTypeId: string;
    productQuantity: number;
    factoryId?: string;
  }) {
    const { factoryId, ...data } = params;
    return await apiClient.post(`${this.getPath(factoryId)}/calculate/material-requirement`, data);
  }

  // 10. 计算产品产出量
  async calculateProductOutput(params: {
    materialTypeId: string;
    materialQuantity: number;
    factoryId?: string;
  }) {
    const { factoryId, ...data } = params;
    return await apiClient.post(`${this.getPath(factoryId)}/calculate/product-output`, data);
  }

  // 11. 验证转换率配置
  async validateConversionRate(data: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/validate`, data);
  }

  // 12. 批量激活/停用转换率配置
  async batchActivateConversions(ids: string[], isActive: boolean, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/activate`, { ids, isActive });
  }

  // 13. 获取转换率统计信息
  async getConversionStatistics(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics`);
  }

  // 14. 导出转换率配置
  async exportConversionRates(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: query,
      responseType: 'blob'
    });
  }

  // 15. 批量导入转换率配置
  async importConversionRates(file: File, factoryId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post(`${this.getPath(factoryId)}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  // 16. 预估原料用量（前端辅助方法，调用calculateMaterialRequirement）
  async estimateMaterialUsage(params: {
    productTypeId: string;
    plannedQuantity: number;
    factoryId?: string;
  }) {
    // 调用计算原材料需求量API
    const result = await this.calculateMaterialRequirement({
      productTypeId: params.productTypeId,
      productQuantity: params.plannedQuantity,
      factoryId: params.factoryId
    });

    // 转换返回格式以匹配前端期望
    if (result.success && result.data) {
      const materialReq = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        success: true,
        data: {
          plannedQuantity: params.plannedQuantity,
          estimatedUsage: materialReq.requiredQuantity || materialReq.quantity,
          conversionRate: materialReq.conversionRate || 0.6,
          wastageRate: materialReq.wastageRate || 0.05,
          materialTypeId: materialReq.materialTypeId,
          materialTypeName: materialReq.materialTypeName || materialReq.name
        }
      };
    }

    return result;
  }
}

export const conversionApiClient = new ConversionApiClient();
export default conversionApiClient;
