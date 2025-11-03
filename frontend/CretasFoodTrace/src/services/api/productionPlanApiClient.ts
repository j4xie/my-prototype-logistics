import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 生产计划管理API客户端 - MVP精简版
 * MVP保留：12个核心API
 * 已移除：8个高级API（暂停/恢复、批量操作、统计导出功能）
 * 路径：/api/mobile/{factoryId}/production-plans/*
 */

export interface ProductionPlan {
  id: string;
  planNumber: string;
  factoryId: string;
  productTypeId: string;
  customerId: string;
  plannedQuantity: number;
  actualQuantity?: number;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

class ProductionPlanApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/production-plans`;
  }

  // ===== 核心CRUD操作 (6个API) =====

  // 1. 获取生产计划列表（分页）
  async getProductionPlans(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 创建生产计划
  async createProductionPlan(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 3. 获取生产计划详情
  async getProductionPlanById(planId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${planId}`);
  }

  // 4. 更新生产计划
  async updateProductionPlan(planId: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${planId}`, data);
  }

  // 5. 删除生产计划
  async deleteProductionPlan(planId: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${planId}`);
  }

  // ===== 生产流程控制 (3个API) =====

  // 6. 开始生产
  async startProduction(planId: string, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${planId}/start`);
  }

  // 7. 完成生产
  async completeProduction(planId: string, actualQuantity: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${planId}/complete`, {
      actualQuantity
    });
  }

  // 8. 取消生产计划
  async cancelProductionPlan(planId: string, reason?: string, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${planId}/cancel`, { reason });
  }

  // ===== 材料管理 (1个API) =====

  // 9. 记录材料消耗
  async recordMaterialConsumption(planId: string, consumption: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${planId}/consumption`, consumption);
  }

  // ===== 快速查询 (2个API) =====

  // 10. 获取今日生产计划
  async getTodayPlans(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/today`);
  }

  // 11. 获取待执行的计划
  async getPendingExecutionPlans(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/pending-execution`);
  }

  // ===== 库存辅助 (1个方法) =====

  // 12. 获取可用库存（前端辅助方法）
  // 注意：这个方法调用material-batches API来获取库存信息
  async getAvailableStock(params?: { productTypeId?: string; factoryId?: string }) {
    const factoryId = params?.factoryId || DEFAULT_FACTORY_ID;

    if (params?.productTypeId) {
      // 有产品ID：查询该产品所需原料的库存和转换率
      try {
        // 1. 先获取产品的转换率配置（确定需要哪种原料）
        const conversionRes = await apiClient.get(
          `/api/mobile/${factoryId}/conversions/product/${params.productTypeId}`
        );

        if (conversionRes.success && conversionRes.data && conversionRes.data.length > 0) {
          const conversion = conversionRes.data[0];
          const materialTypeId = conversion.materialTypeId;

          // 2. 查询该原料的所有可用批次
          const batchesRes = await apiClient.get(
            `/api/mobile/${factoryId}/material-batches/material-type/${materialTypeId}`
          );

          if (batchesRes.success && batchesRes.data) {
            const batches = Array.isArray(batchesRes.data) ? batchesRes.data : batchesRes.data.batches || [];
            const totalAvailable = batches.reduce((sum: number, b: any) =>
              sum + (b.remainingQuantity || b.availableQuantity || 0), 0
            );

            return {
              success: true,
              data: {
                materialType: {
                  id: materialTypeId,
                  name: conversion.materialTypeName || conversion.materialType?.name
                },
                batches,
                totalAvailable,
                conversionRate: conversion.conversionRate || conversion.rate,
                wastageRate: conversion.wastageRate || 0.05
              }
            };
          }
        }

        // 未配置转换率
        return {
          success: true,
          data: {
            materialType: null,
            batches: [],
            totalAvailable: 0,
            conversionRate: null,
            wastageRate: null
          }
        };
      } catch (error) {
        console.error('获取产品库存失败:', error);
        throw error;
      }
    } else {
      // 无产品ID：查询所有原料的库存汇总
      try {
        const statsRes = await apiClient.get(
          `/api/mobile/${factoryId}/material-batches/inventory/statistics`
        );

        if (statsRes.success && statsRes.data) {
          return {
            success: true,
            data: {
              summary: statsRes.data.byMaterialType || statsRes.data.summary || []
            }
          };
        }

        return statsRes;
      } catch (error) {
        console.error('获取库存汇总失败:', error);
        throw error;
      }
    }
  }

  // ===== MVP暂不使用的功能 =====
  /*
   * 以下功能在MVP阶段暂不实现，后续根据需要逐步添加：
   *
   * 1. pauseProduction - 暂停生产
   *    原因：MVP仅支持开始→完成/取消的简单流程，不支持暂停
   *    POST /api/mobile/{factoryId}/production-plans/{planId}/pause
   *
   * 2. resumeProduction - 恢复生产
   *    原因：MVP仅支持开始→完成/取消的简单流程，不支持恢复
   *    POST /api/mobile/{factoryId}/production-plans/{planId}/resume
   *
   * 3. batchCreatePlans - 批量创建生产计划
   *    原因：批量操作属于高级特性，MVP阶段采用单个创建
   *    POST /api/mobile/{factoryId}/production-plans/batch
   *
   * 4. allocateMaterialBatches - 分配原材料批次
   *    原因：MVP阶段在创建计划时直接处理材料分配
   *    POST /api/mobile/{factoryId}/production-plans/{planId}/batches
   *
   * 5. updateActualCosts - 更新实际成本
   *    原因：成本分析功能独立处理，不在生产计划中更新
   *    PUT /api/mobile/{factoryId}/production-plans/{planId}/costs
   *
   * 6. getPlansByStatus - 按状态获取生产计划
   *    原因：可在前端使用getProductionPlans并传入status参数筛选
   *    GET /api/mobile/{factoryId}/production-plans/status/{status}
   *
   * 7. getPlansByDateRange - 按日期范围获取生产计划
   *    原因：可在前端使用getProductionPlans并传入日期参数筛选
   *    GET /api/mobile/{factoryId}/production-plans/date-range
   *
   * 8. getProductionStatistics - 获取生产统计
   *    原因：统计分析功能，MVP阶段暂不需要
   *    GET /api/mobile/{factoryId}/production-plans/statistics
   *
   * 9. exportProductionPlans - 导出生产计划
   *    原因：导出功能属于高级特性，MVP阶段暂不实现
   *    GET /api/mobile/{factoryId}/production-plans/export
   */
}

export const productionPlanApiClient = new ProductionPlanApiClient();
export default productionPlanApiClient;
