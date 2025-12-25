import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { getErrorMsg } from '../../utils/errorHandler';

/**
 * 转换率管理API客户端
 * 总计16个API - 路径：/api/mobile/{factoryId}/conversions/*
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

/**
 * 建议的转换率配置（基于历史数据计算）
 */
export interface SuggestedConversion {
  hasData: boolean;                    // 是否有历史数据
  sampleCount: number;                 // 样本数量（已完成批次数）
  suggestedRate?: number;              // 建议转换率
  suggestedWastageRate?: number;       // 建议损耗率
  totalMaterialConsumed?: number;      // 总消耗原料量
  totalProductOutput?: number;         // 总产出量
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';  // 置信度
  message: string;                     // 提示信息
}

class ConversionApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/conversions`;
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

  // 14. 基于历史数据获取建议的转换率
  async getSuggestedConversion(params: {
    materialTypeId: string;
    productTypeId: string;
    factoryId?: string;
  }): Promise<{ success: boolean; data?: SuggestedConversion; message?: string }> {
    const { factoryId, materialTypeId, productTypeId } = params;
    return await apiClient.get(`${this.getPath(factoryId)}/suggest`, {
      params: { materialTypeId, productTypeId }
    });
  }

  // 15. 导出转换率配置
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
    if ((result as any).success && (result as any).data) {
      const materialReq = Array.isArray((result as any).data) ? (result as any).data[0] : (result as any).data;
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
