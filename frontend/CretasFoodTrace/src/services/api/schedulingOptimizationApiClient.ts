/**
 * 调度优化 API Client
 *
 * 对接 SchedulingOptimizationController (19个端点)
 * - 工厂配置管理
 * - 临时工管理
 * - SKU复杂度分析
 * - 公平性监控
 * - 复杂度路由
 *
 * @version 1.0.0
 * @since 2026-01-22
 */

import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';

// ========== 类型定义 ==========

export interface ApiResponse<T> {
  success: boolean;
  code?: number;
  message: string;
  data: T;
}

/** 工厂调度配置 */
export interface FactorySchedulingConfig {
  id?: string;
  factoryId: string;
  explorationRate: number;
  fairnessWeight: number;
  efficiencyWeight: number;
  learningRate: number;
  minExplorationRate: number;
  explorationDecayRate: number;
  tempWorkerBoost: number;
  newWorkerProtectionDays: number;
  autoAdaptEnabled: boolean;
  lastAdaptedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 有效配置 (考虑临时工调整) */
export interface EffectiveConfig {
  baseConfig: FactorySchedulingConfig;
  adjustedExplorationRate: number;
  adjustedFairnessWeight: number;
  isTempWorker: boolean;
  tempWorkerDays?: number;
  isNewWorker: boolean;
  workerDays?: number;
}

/** 临时工统计 */
export interface TempWorkerStats {
  totalTempWorkers: number;
  activeTempWorkers: number;
  convertedCount: number;
  avgRetentionDays: number;
  conversionRate: number;
  needsAssignmentCount: number;
}

/** 临时工详情 */
export interface TempWorkerDetail {
  workerId: number;
  workerName?: string;
  factoryId: string;
  hireDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  status: 'active' | 'converted' | 'terminated';
  totalAssignments: number;
  avgPerformance: number;
  conversionScore?: number;
  createdAt: string;
  updatedAt: string;
}

/** 临时工转正候选人 */
export interface TempWorkerConversionCandidate {
  workerId: number;
  workerName?: string;
  daysWorked: number;
  avgPerformance: number;
  totalAssignments: number;
  conversionScore: number;
  recommendation: string;
}

/** SKU复杂度配置文件 */
export interface SkuProfile {
  skuCode: string;
  factoryId: string;
  complexityLevel: number; // 1-5
  avgProcessTime: number;
  varianceRate: number;
  minSkillRequired: number;
  preferredWorkerType: 'any' | 'experienced' | 'expert';
  historicalEfficiency: number;
  sampleCount: number;
  lastUpdatedAt: string;
}

/** SKU复杂度漂移 */
export interface SkuComplexityDrift {
  skuCode: string;
  oldComplexity: number;
  newComplexity: number;
  driftDirection: 'up' | 'down';
  driftMagnitude: number;
  confidence: number;
  detectedAt: string;
  recommendation: string;
}

/** 公平性统计 */
export interface FairnessStats {
  factoryId: string;
  periodStart: string;
  periodEnd: string;
  totalWorkers: number;
  avgAssignmentsPerWorker: number;
  giniCoefficient: number;
  fairnessScore: number;
  underutilizedWorkers: number;
  overutilizedWorkers: number;
  balancedWorkers: number;
}

/** 公平性违规 */
export interface FairnessViolation {
  violationType: 'under_assignment' | 'over_assignment' | 'skill_mismatch' | 'consecutive_low_quality';
  workerId: number;
  workerName?: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: string;
  suggestedAction: string;
}

/** 调度复杂度 */
export interface SchedulingComplexity {
  level: 'simple' | 'moderate' | 'complex';
  score: number;
  factors: {
    workerCount: number;
    skuComplexity: number;
    deadlinePressure: number;
    resourceConstraints: number;
  };
  recommendedStrategy: string;
  estimatedSolveTime: number;
}

/** 调度上下文 (用于复杂度评估) */
export interface SchedulingContext {
  planDate: string;
  shiftType: 'day' | 'night' | 'full_day';
  workerCount: number;
  taskCount: number;
  skuCodes: string[];
  hasUrgentTasks: boolean;
  hasSkillConstraints: boolean;
}

/** 调度总览 */
export interface SchedulingOverview {
  config: FactorySchedulingConfig;
  tempWorkerStats: TempWorkerStats;
  fairnessStats: FairnessStats;
  skuDrifts: SkuComplexityDrift[];
  skuDriftCount: number;
  fairnessViolations: FairnessViolation[];
  violationCount: number;
  conversionCandidates: number;
}

/** 优化建议 */
export interface OptimizationSuggestion {
  id: string;
  type: 'worker_reallocation' | 'skill_training' | 'schedule_adjustment' | 'fairness_correction' | 'efficiency_improvement';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  estimatedImprovement: number;
  affectedWorkers?: number[];
  affectedTasks?: string[];
  createdAt: string;
}

/** 瓶颈分析结果 */
export interface BottleneckAnalysis {
  bottleneckType: 'worker_shortage' | 'skill_gap' | 'equipment_constraint' | 'material_delay' | 'scheduling_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  affectedTasks: number;
  estimatedDelay: number;
  suggestedActions: string[];
}

/** What-If 分析请求 */
export interface WhatIfRequest {
  scenario: 'add_worker' | 'remove_worker' | 'change_shift' | 'add_equipment' | 'priority_change';
  parameters: Record<string, unknown>;
}

/** What-If 分析结果 */
export interface WhatIfResult {
  scenarioId: string;
  scenario: string;
  originalMetrics: {
    completionProbability: number;
    efficiency: number;
    fairnessScore: number;
  };
  projectedMetrics: {
    completionProbability: number;
    efficiency: number;
    fairnessScore: number;
  };
  impact: {
    completionChange: number;
    efficiencyChange: number;
    fairnessChange: number;
  };
  recommendation: string;
  risks: string[];
}

/** 重排结果 */
export interface RescheduleResult {
  success: boolean;
  originalPlanId: string;
  newPlanId?: string;
  changes: {
    movedTasks: number;
    reallocatedWorkers: number;
    adjustedDeadlines: number;
  };
  improvements: {
    completionProbability: number;
    efficiency: number;
    fairness: number;
  };
  summary: string;
  warnings?: string[];
}

// ========== API Client ==========

class SchedulingOptimizationApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = requireFactoryId(factoryId);
    return `/api/mobile/${currentFactoryId}/scheduling`;
  }

  // ==================== 工厂配置 API ====================

  /**
   * 获取工厂调度配置
   */
  async getConfig(factoryId?: string): Promise<ApiResponse<FactorySchedulingConfig>> {
    return await apiClient.get(`${this.getPath(factoryId)}/config`);
  }

  /**
   * 更新工厂调度配置
   */
  async updateConfig(
    config: Partial<FactorySchedulingConfig>,
    factoryId?: string
  ): Promise<ApiResponse<FactorySchedulingConfig>> {
    return await apiClient.put(`${this.getPath(factoryId)}/config`, config);
  }

  /**
   * 获取工人的有效配置
   */
  async getEffectiveConfig(
    workerId: number,
    factoryId?: string
  ): Promise<ApiResponse<EffectiveConfig>> {
    return await apiClient.get(`${this.getPath(factoryId)}/config/effective/${workerId}`);
  }

  /**
   * 手动触发自适应学习
   */
  async triggerAdaptation(factoryId?: string): Promise<ApiResponse<string>> {
    return await apiClient.post(`${this.getPath(factoryId)}/config/adapt`);
  }

  // ==================== 临时工管理 API ====================

  /**
   * 获取临时工统计
   */
  async getTempWorkerStats(factoryId?: string): Promise<ApiResponse<TempWorkerStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/temp-workers/stats`);
  }

  /**
   * 注册临时工
   */
  async registerTempWorker(
    workerId: number,
    hireDate: string,
    expectedEndDate?: string,
    factoryId?: string
  ): Promise<ApiResponse<TempWorkerDetail>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/temp-workers/${workerId}`,
      { hireDate, expectedEndDate }
    );
  }

  /**
   * 临时工转正
   */
  async convertToPermanent(
    workerId: number,
    factoryId?: string
  ): Promise<ApiResponse<TempWorkerDetail>> {
    return await apiClient.post(`${this.getPath(factoryId)}/temp-workers/${workerId}/convert`);
  }

  /**
   * 获取转正候选人
   */
  async getConversionCandidates(factoryId?: string): Promise<ApiResponse<TempWorkerConversionCandidate[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/temp-workers/conversion-candidates`);
  }

  /**
   * 获取需要优先分配的临时工
   */
  async getTempWorkersNeedingAssignment(factoryId?: string): Promise<ApiResponse<number[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/temp-workers/needs-assignment`);
  }

  // ==================== SKU复杂度 API ====================

  /**
   * 获取SKU复杂度
   */
  async getSkuComplexity(skuCode: string, factoryId?: string): Promise<ApiResponse<SkuProfile>> {
    return await apiClient.get(`${this.getPath(factoryId)}/sku/${skuCode}/complexity`);
  }

  /**
   * 设置SKU复杂度
   */
  async setSkuComplexity(
    skuCode: string,
    complexityLevel: number,
    factoryId?: string
  ): Promise<ApiResponse<string>> {
    return await apiClient.put(`${this.getPath(factoryId)}/sku/${skuCode}/complexity`, {
      complexityLevel,
    });
  }

  /**
   * 获取适合新人练习的SKU
   */
  async getTrainingSkus(factoryId?: string): Promise<ApiResponse<string[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/sku/training`);
  }

  /**
   * 获取需要专家处理的SKU
   */
  async getExpertSkus(factoryId?: string): Promise<ApiResponse<string[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/sku/expert`);
  }

  /**
   * 检测SKU复杂度漂移
   */
  async detectSkuDrift(factoryId?: string): Promise<ApiResponse<SkuComplexityDrift[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/sku/drift`);
  }

  // ==================== 公平性监控 API ====================

  /**
   * 获取公平性统计
   */
  async getFairnessStats(factoryId?: string): Promise<ApiResponse<FairnessStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/fairness/stats`);
  }

  /**
   * 检测公平性违规
   */
  async getFairnessViolations(
    days: number = 7,
    factoryId?: string
  ): Promise<ApiResponse<FairnessViolation[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/fairness/violations`, {
      params: { days },
    });
  }

  /**
   * 重置公平性统计周期
   */
  async resetFairnessPeriod(factoryId?: string): Promise<ApiResponse<string>> {
    return await apiClient.post(`${this.getPath(factoryId)}/fairness/reset`);
  }

  // ==================== 复杂度路由 API ====================

  /**
   * 评估调度复杂度
   */
  async evaluateComplexity(
    context: SchedulingContext,
    factoryId?: string
  ): Promise<ApiResponse<SchedulingComplexity>> {
    return await apiClient.post(`${this.getPath(factoryId)}/complexity/evaluate`, context);
  }

  /**
   * 获取调度优化总览
   */
  async getOverview(factoryId?: string): Promise<ApiResponse<SchedulingOverview>> {
    return await apiClient.get(`${this.getPath(factoryId)}/overview`);
  }

  // ==================== 优化建议 API ====================

  /**
   * 获取优化建议列表
   */
  async getSuggestions(
    params?: {
      type?: string;
      priority?: string;
      limit?: number;
    },
    factoryId?: string
  ): Promise<ApiResponse<OptimizationSuggestion[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/suggestions`, { params });
  }

  /**
   * 执行分析
   */
  async analyze(
    params?: {
      scope?: 'full' | 'workers' | 'tasks' | 'fairness';
      date?: string;
    },
    factoryId?: string
  ): Promise<ApiResponse<{
    suggestions: OptimizationSuggestion[];
    bottlenecks: BottleneckAnalysis[];
    overallScore: number;
    analyzedAt: string;
  }>> {
    return await apiClient.post(`${this.getPath(factoryId)}/analyze`, params);
  }

  /**
   * 获取瓶颈分析
   */
  async getBottlenecks(
    date?: string,
    factoryId?: string
  ): Promise<ApiResponse<BottleneckAnalysis[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/bottlenecks`, {
      params: date ? { date } : undefined,
    });
  }

  /**
   * AI重排
   */
  async reschedule(
    params: {
      planId: string;
      strategy?: 'minimize_delay' | 'maximize_efficiency' | 'balance_fairness';
      preserveAssignments?: boolean;
    },
    factoryId?: string
  ): Promise<ApiResponse<RescheduleResult>> {
    return await apiClient.post(`${this.getPath(factoryId)}/reschedule`, params);
  }

  /**
   * What-If 分析
   */
  async whatIf(
    request: WhatIfRequest,
    factoryId?: string
  ): Promise<ApiResponse<WhatIfResult>> {
    return await apiClient.post(`${this.getPath(factoryId)}/what-if`, request);
  }
}

export const schedulingOptimizationApiClient = new SchedulingOptimizationApiClient();
