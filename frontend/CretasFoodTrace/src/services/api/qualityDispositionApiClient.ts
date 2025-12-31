/**
 * 质检处置 API 客户端
 *
 * 功能：
 * 1. 评估质检处置建议
 * 2. 获取可用处置动作
 * 3. 执行处置动作
 * 4. 查询处置历史
 * 5. 配置处置规则
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import { apiClient } from './apiClient';
import {
  DispositionAction,
  DispositionEvaluation,
  DispositionResult,
  DispositionHistory,
  ExecuteDispositionRequest,
  InspectionSummary,
  AlternativeAction,
} from '../../types/qualityDisposition';

// Re-export types for convenience
export {
  DispositionAction,
  DispositionEvaluation,
  DispositionResult,
  DispositionHistory,
  ExecuteDispositionRequest,
  InspectionSummary,
  AlternativeAction,
};

// ==================== 额外类型定义 ====================

/**
 * 质检结果（用于评估请求）
 */
export interface QualityCheckResult {
  inspectionId: string;
  productionBatchId: number;
  inspectorId: number;
  inspectionDate?: string;
  sampleSize: number;
  passCount: number;
  failCount: number;
  passRate?: number;
  result?: 'PASS' | 'FAIL' | 'CONDITIONAL';
  notes?: string;
}

/**
 * 处置动作详情
 */
export interface DispositionActionInfo {
  actionCode: DispositionAction;
  actionName: string;
  description: string;
  requiresApproval: boolean;
  approvalLevel?: 'SUPERVISOR' | 'MANAGER' | 'QUALITY_HEAD' | 'FACTORY_MANAGER';
  applicableCondition?: string;
}

/**
 * 创建处置规则请求
 */
export interface CreateDispositionRuleRequest {
  ruleName: string;
  description?: string;
  minPassRate: number;
  maxDefectRate?: number;
  action: DispositionAction;
  requiresApproval: boolean;
  approvalLevel?: 'SUPERVISOR' | 'MANAGER' | 'QUALITY_HEAD' | 'FACTORY_MANAGER';
  priority?: number;
  enabled?: boolean;
}

/**
 * 处置规则
 */
export interface DispositionRule {
  id: string;
  factoryId: string;
  ruleName: string;
  description?: string;
  minPassRate: number;
  maxDefectRate?: number;
  action: DispositionAction;
  requiresApproval: boolean;
  approvalLevel?: string;
  priority: number;
  version: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== API 客户端 ====================

/**
 * 质检处置 API
 */
export const qualityDispositionAPI = {
  /**
   * 评估质检处置建议
   *
   * @param factoryId 工厂ID
   * @param qualityResult 质检结果
   * @returns 处置评估结果
   */
  async evaluateDisposition(
    factoryId: string,
    qualityResult: QualityCheckResult
  ): Promise<DispositionEvaluation> {
    const response = await apiClient.post<DispositionEvaluation>(
      `/api/mobile/${factoryId}/quality-disposition/evaluate`,
      qualityResult
    );
    return response;
  },

  /**
   * 获取可用的处置动作列表
   *
   * @param factoryId 工厂ID
   * @returns 处置动作列表
   */
  async getAvailableActions(factoryId: string): Promise<DispositionActionInfo[]> {
    const response = await apiClient.get<DispositionActionInfo[]>(
      `/api/mobile/${factoryId}/quality-disposition/actions`
    );
    return response;
  },

  /**
   * 执行处置动作
   *
   * @param factoryId 工厂ID
   * @param request 执行处置请求
   * @returns 处置执行结果
   */
  async executeDisposition(
    factoryId: string,
    request: ExecuteDispositionRequest
  ): Promise<DispositionResult> {
    const response = await apiClient.post<DispositionResult>(
      `/api/mobile/${factoryId}/quality-disposition/execute`,
      request
    );
    return response;
  },

  /**
   * 获取处置历史
   *
   * @param factoryId 工厂ID
   * @param batchId 生产批次ID
   * @returns 处置历史列表
   */
  async getDispositionHistory(
    factoryId: string,
    batchId: number
  ): Promise<DispositionHistory[]> {
    const response = await apiClient.get<DispositionHistory[]>(
      `/api/mobile/${factoryId}/quality-disposition/history/${batchId}`
    );
    return response;
  },

  /**
   * 创建处置规则
   *
   * @param factoryId 工厂ID
   * @param request 规则创建请求
   * @returns 创建的规则
   */
  async createRule(
    factoryId: string,
    request: CreateDispositionRuleRequest
  ): Promise<DispositionRule> {
    const response = await apiClient.post<DispositionRule>(
      `/api/mobile/${factoryId}/quality-disposition/rules`,
      request
    );
    return response;
  },

  /**
   * 获取处置规则列表
   *
   * @param factoryId 工厂ID
   * @returns 规则列表
   */
  async getRules(factoryId: string): Promise<DispositionRule[]> {
    const response = await apiClient.get<DispositionRule[]>(
      `/api/mobile/${factoryId}/quality-disposition/rules`
    );
    return response;
  },
};

// Re-export helper functions from types for convenience
export {
  getActionLabel,
  getActionColor,
  getActionIcon,
  getStatusLabel,
  formatConfidence,
} from '../../types/qualityDisposition';

export default qualityDispositionAPI;
