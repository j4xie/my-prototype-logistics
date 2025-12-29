import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';
import type {
  WorkerRecommendation,
  WorkerPerformanceRank,
  LinUCBModel,
  ModelTrainingStats,
  RecommendWorkersRequest,
  RecordAllocationRequest,
  CompleteFeedbackRequest,
} from '../../types/dispatcher';

/**
 * LinUCB 人员分配算法 API 客户端
 * 路径：/api/mobile/{factoryId}/scheduling/linucb/*
 *
 * LinUCB (Linear Upper Confidence Bound) 是一种上下文老虎机算法，
 * 用于在动态人员分配场景中平衡探索与利用。
 *
 * 核心功能：12个端点
 * - 工人推荐 (2个)
 * - 反馈记录 (2个)
 * - 模型管理 (5个)
 * - 模型训练 (1个)
 * - 统计分析 (2个)
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// ========== 类型定义 ==========

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UCBScoreResponse {
  workerId: number;
  ucbScore: number;
}

export interface RecordAllocationResponse {
  feedbackId: string;
}

export interface CompleteFeedbackResponse {
  feedbackId: string;
  reward: number;
}

export interface TrainModelsResponse {
  processedFeedbacks: number;
}

// ========== API 客户端类 ==========

class LinUCBApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = requireFactoryId(factoryId);
    return `/api/mobile/${currentFactoryId}/scheduling/linucb`;
  }

  // ==================== 工人推荐 ====================

  /**
   * 1. 获取AI推荐的工人分配列表
   *
   * 使用 LinUCB 算法计算每个候选工人的 UCB 分数，
   * 返回按分数降序排列的推荐列表。
   *
   * @param data 推荐请求（任务特征 + 候选工人ID列表）
   * @param factoryId 工厂ID
   * @returns 排序后的工人推荐列表
   */
  async recommendWorkers(
    data: RecommendWorkersRequest,
    factoryId?: string
  ): Promise<ApiResponse<WorkerRecommendation[]>> {
    return await apiClient.post(`${this.getPath(factoryId)}/recommend-workers`, data);
  }

  /**
   * 2. 计算单个工人的UCB分数
   *
   * UCB = θ^T * x + α * sqrt(x^T * A^(-1) * x)
   *
   * @param workerId 工人ID
   * @param context 上下文特征向量 (12维)
   * @param factoryId 工厂ID
   * @returns UCB分数
   */
  async computeUCB(
    workerId: number,
    context: number[],
    factoryId?: string
  ): Promise<ApiResponse<UCBScoreResponse>> {
    return await apiClient.post(`${this.getPath(factoryId)}/compute-ucb`, {
      workerId,
      context,
    });
  }

  // ==================== 反馈记录 ====================

  /**
   * 3. 记录工人分配（分配时调用）
   *
   * 在分配工人时调用，记录分配上下文，用于后续模型更新。
   *
   * @param data 分配记录请求
   * @param factoryId 工厂ID
   * @returns 反馈记录ID
   */
  async recordAllocation(
    data: RecordAllocationRequest,
    factoryId?: string
  ): Promise<ApiResponse<RecordAllocationResponse>> {
    return await apiClient.post(`${this.getPath(factoryId)}/record-allocation`, data);
  }

  /**
   * 4. 完成分配反馈（任务完成时调用）
   *
   * 在任务完成时调用，提供实际产量和工时，用于计算奖励并更新模型。
   *
   * @param data 反馈完成请求
   * @param factoryId 工厂ID
   * @returns 计算的奖励值
   */
  async completeFeedback(
    data: CompleteFeedbackRequest,
    factoryId?: string
  ): Promise<ApiResponse<CompleteFeedbackResponse>> {
    return await apiClient.post(`${this.getPath(factoryId)}/complete-feedback`, data);
  }

  // ==================== 模型管理 ====================

  /**
   * 5. 获取工人的LinUCB模型
   *
   * @param workerId 工人ID
   * @param factoryId 工厂ID
   * @returns LinUCB模型信息
   */
  async getModel(workerId: number, factoryId?: string): Promise<ApiResponse<LinUCBModel>> {
    return await apiClient.get(`${this.getPath(factoryId)}/models/${workerId}`);
  }

  /**
   * 6. 获取工厂所有模型列表
   *
   * @param factoryId 工厂ID
   * @returns 模型列表
   */
  async getAllModels(factoryId?: string): Promise<ApiResponse<LinUCBModel[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/models`);
  }

  /**
   * 7. 重置工人模型
   *
   * 重置模型参数，重新开始学习。
   *
   * @param workerId 工人ID
   * @param factoryId 工厂ID
   */
  async resetModel(workerId: number, factoryId?: string): Promise<ApiResponse<void>> {
    return await apiClient.delete(`${this.getPath(factoryId)}/models/${workerId}`);
  }

  /**
   * 8. 重置工厂所有模型
   *
   * @param factoryId 工厂ID
   */
  async resetAllModels(factoryId?: string): Promise<ApiResponse<void>> {
    return await apiClient.delete(`${this.getPath(factoryId)}/models`);
  }

  // ==================== 模型训练 ====================

  /**
   * 9. 触发模型批量更新
   *
   * 处理未处理的反馈记录，更新所有相关模型。
   *
   * @param factoryId 工厂ID
   * @returns 处理的反馈数量
   */
  async trainModels(factoryId?: string): Promise<ApiResponse<TrainModelsResponse>> {
    return await apiClient.post(`${this.getPath(factoryId)}/train`);
  }

  // ==================== 统计分析 ====================

  /**
   * 10. 获取工人AI评分排行榜
   *
   * 根据平均奖励值排名，展示表现最好的工人。
   *
   * @param limit 返回数量限制
   * @param factoryId 工厂ID
   * @returns 排行列表
   */
  async getWorkerRanking(
    limit: number = 10,
    factoryId?: string
  ): Promise<ApiResponse<WorkerPerformanceRank[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/worker-ranking`, {
      params: { limit },
    });
  }

  /**
   * 11. 获取模型训练统计
   *
   * 返回模型数量、更新次数、平均奖励等统计信息。
   *
   * @param factoryId 工厂ID
   * @returns 训练统计信息
   */
  async getTrainingStats(factoryId?: string): Promise<ApiResponse<ModelTrainingStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/training-stats`);
  }

  // ==================== 辅助方法 ====================

  /**
   * 12. 提取任务特征 (6维)
   *
   * 本地计算，用于准备推荐请求。
   * [任务量, 截止时间, 产品类型编码, 优先级, 复杂度, 车间编码]
   */
  extractTaskFeatures(taskInfo: {
    quantity?: number;
    deadlineHours?: number;
    productType?: string;
    priority?: number;
    complexity?: number;
    workshopId?: string;
  }): number[] {
    const normalize = (value: number, min: number, max: number): number => {
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };

    const encodeString = (value?: string): number => {
      if (!value) return 0.5;
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
      }
      return Math.abs(hash % 1000) / 1000;
    };

    return [
      normalize(taskInfo.quantity ?? 100, 0, 1000),        // 任务量
      normalize(taskInfo.deadlineHours ?? 8, 0, 24),       // 截止时间
      encodeString(taskInfo.productType),                   // 产品类型编码
      (taskInfo.priority ?? 5) / 10.0,                     // 优先级
      (taskInfo.complexity ?? 3) / 5.0,                    // 复杂度
      encodeString(taskInfo.workshopId),                    // 车间编码
    ];
  }

  /**
   * 提取工人特征 (6维)
   *
   * 本地计算，用于准备推荐请求。
   * [技能等级, 经验天数, 近期效率, 是否临时工, 今日工时, 疲劳度]
   */
  extractWorkerFeatures(workerInfo: {
    skillLevel?: number;
    experienceDays?: number;
    recentEfficiency?: number;
    isTemporary?: boolean;
    todayWorkHours?: number;
    fatigueLevel?: number;
  }): number[] {
    const normalize = (value: number, min: number, max: number): number => {
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };

    return [
      normalize(workerInfo.skillLevel ?? 3, 1, 5),          // 技能等级
      normalize(workerInfo.experienceDays ?? 90, 0, 365),   // 经验天数
      workerInfo.recentEfficiency ?? 0.8,                   // 近期效率
      workerInfo.isTemporary ? 0.5 : 1.0,                   // 是否临时工
      normalize(workerInfo.todayWorkHours ?? 0, 0, 12),     // 今日工时
      workerInfo.fatigueLevel ?? 0.2,                       // 疲劳度
    ];
  }

  /**
   * 合并特征为上下文向量 (12维)
   */
  combineFeatures(taskFeatures: number[], workerFeatures: number[]): number[] {
    return [...taskFeatures, ...workerFeatures];
  }

  /**
   * 快捷方法：获取任务的工人推荐
   *
   * 自动提取特征并调用推荐API。
   */
  async getRecommendationsForTask(
    taskInfo: {
      quantity?: number;
      deadlineHours?: number;
      productType?: string;
      priority?: number;
      complexity?: number;
      workshopId?: string;
    },
    candidateWorkerIds: number[],
    factoryId?: string
  ): Promise<ApiResponse<WorkerRecommendation[]>> {
    const taskFeatures = this.extractTaskFeatures(taskInfo);

    return this.recommendWorkers(
      {
        taskFeatures: {
          quantity: taskInfo.quantity ?? 100,
          deadlineHours: taskInfo.deadlineHours ?? 8,
          productType: taskInfo.productType ?? '',
          priority: taskInfo.priority ?? 5,
          complexity: taskInfo.complexity ?? 3,
          workshopId: taskInfo.workshopId ?? '',
        },
        candidateWorkerIds,
      },
      factoryId
    );
  }
}

export const linucbApiClient = new LinUCBApiClient();
