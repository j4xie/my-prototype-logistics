/**
 * 抄码品称重日志 API 客户端 (W-ABA-1).
 *
 * 后端路径: /api/mobile/{factoryId}/material/abaca-log
 */

import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

// ========== 类型定义 ==========

export interface AbacaQuantityLog {
  id: string;
  factoryId: string;
  materialBatchId: string;
  rawMaterialTypeId: string;
  purchaseOrderItemId?: string;
  boxIndex: number;
  actualWeight: number;
  unit: string;
  weighingMethod: string;
  scaleDeviceId?: string;
  weighedAt: string;
  weighedBy: number;
  verifiedBy?: number;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  verified?: boolean;  // entity 派生 getter
}

export interface CreateAbacaLogRequest {
  /** 二选一: materialBatchId 优先, 否则后端按 batchNumber 在 factoryId 范围内 lookup */
  materialBatchId?: string;
  batchNumber?: string;
  /** 可选, 后端默认从 batch 取 */
  rawMaterialTypeId?: string;
  purchaseOrderItemId?: string;
  /** 不填则后端自动分配 = max(boxIndex) + 1 */
  boxIndex?: number;
  actualWeight: number;
  unit?: string;
  weighingMethod?: 'SCALE' | 'MANUAL' | 'IMPORTED';
  scaleDeviceId?: string;
  notes?: string;
}

export interface AbacaBatchSummary {
  logs?: AbacaQuantityLog[];
  log?: AbacaQuantityLog;
  batchTotalWeight: number;
  batchBoxCount: number;
}

// ========== Client ==========

class AbacaApiClient {
  private base(factoryId?: string): string {
    const f = getCurrentFactoryId(factoryId);
    if (!f) throw new Error('factoryId 必填');
    return `/api/mobile/${f}/material/abaca-log`;
  }

  /** 列表 — 按批次查全部称重 + 汇总. */
  async listByBatch(batchId: string, factoryId?: string): Promise<{ success: boolean; data: AbacaBatchSummary }> {
    return apiClient.get(this.base(factoryId), { params: { batchId } });
  }

  /** 详情 — 单条 + 批次汇总. */
  async getById(id: string, factoryId?: string): Promise<{ success: boolean; data: AbacaBatchSummary }> {
    return apiClient.get(`${this.base(factoryId)}/${id}`);
  }

  /** 单箱称重新增. 支持 batchNumber 替代 materialBatchId. */
  async create(data: CreateAbacaLogRequest, factoryId?: string): Promise<{ success: boolean; data: AbacaBatchSummary }> {
    return apiClient.post(this.base(factoryId), data);
  }

  /** 批量新增 (同批次 N 箱). */
  async createBatch(requests: CreateAbacaLogRequest[], factoryId?: string): Promise<{ success: boolean; data: AbacaBatchSummary }> {
    return apiClient.post(`${this.base(factoryId)}/batch`, requests);
  }

  /** 复核 (双签). */
  async verify(id: string, factoryId?: string): Promise<{ success: boolean; data: AbacaQuantityLog }> {
    return apiClient.put(`${this.base(factoryId)}/${id}/verify`);
  }

  /** 软删除. */
  async softDelete(id: string, factoryId?: string): Promise<{ success: boolean }> {
    return apiClient.delete(`${this.base(factoryId)}/${id}`);
  }
}

export const abacaApiClient = new AbacaApiClient();
