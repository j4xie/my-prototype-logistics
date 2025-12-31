/**
 * 供应商准入规则 API 客户端
 * 对接后端: SupplierAdmissionController.java
 */

import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

// ============ 类型定义 ============

/**
 * 拒绝原因
 */
export interface RejectionReason {
  code: string;
  description: string;
  requirement: string;
  currentValue: string;
}

/**
 * 准入评估结果
 */
export interface AdmissionEvaluationResult {
  admitted: boolean;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  triggeredRuleName: string;
  ruleConfigId: string;
  ruleVersion: number;
  rejectionReasons: RejectionReason[];
  improvements: string[];
  reason: string;
}

/**
 * 供货权限结果
 */
export interface SupplyPermissionResult {
  permitted: boolean;
  reason: string;
  historicalPassRate: number;
  supplyCount: number;
  lastSupplyDate: string | null;
  restrictions: string[];
}

/**
 * 抽样方案
 */
export interface SamplingPlan {
  samplePercentage: number;
  minSampleSize: number;
  maxSampleSize: number;
  calculatedSampleSize: number;
  acceptanceNumber: number;
  rejectionNumber: number;
}

/**
 * 检验项目
 */
export interface InspectionItem {
  name: string;
  method: string;
  standardValue: string;
  toleranceRange: string;
  mandatory: boolean;
  weight: number;
}

/**
 * 检验级别
 */
export type InspectionLevel = 'RELAXED' | 'NORMAL' | 'STRICT';

/**
 * 验收策略
 */
export interface AcceptanceStrategy {
  strategyId: string;
  inspectionLevel: InspectionLevel;
  samplingPlan: SamplingPlan;
  inspectionItems: InspectionItem[];
  fullInspection: boolean;
  description: string;
  rationale: string;
  ruleConfigId: string;
  ruleVersion: number;
}

/**
 * 准入规则配置
 */
export interface AdmissionRules {
  requireBusinessLicense: boolean;
  requireQualityCertificates: boolean;
  minRating: number;
  requireCreditLimit: boolean;
  minHistoricalPassRate: number;
  minSupplyCount: number;
}

/**
 * 验收规则配置
 */
export interface AcceptanceRules {
  newSupplierLevel: InspectionLevel;
  relaxedThreshold: number;
  strictThreshold: number;
  defaultSamplePercentage: number;
  highRiskSamplePercentage: number;
  minSampleSize: number;
  maxSampleSize: number;
}

/**
 * 供应商规则配置
 */
export interface SupplierRuleConfig {
  id: string;
  factoryId: string;
  version: number;
  enabled: boolean;
  admissionRules: AdmissionRules;
  acceptanceRules: AcceptanceRules;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 生成验收策略请求
 */
export interface GenerateAcceptanceStrategyRequest {
  supplierId: string;
  materialTypeId: string;
  quantity: number;
}

/**
 * 批量评估请求
 */
export interface BatchEvaluateRequest {
  supplierIds: string[];
}

/**
 * 批量评估结果
 */
export interface BatchEvaluationResult {
  [supplierId: string]: AdmissionEvaluationResult;
}

/**
 * 供应商综合报告
 */
export interface SupplierReport {
  supplierId: string;
  supplierName: string;
  admissionEvaluation: AdmissionEvaluationResult;
  supplyPermission: SupplyPermissionResult;
  historicalData: {
    totalSupplyCount: number;
    averagePassRate: number;
    lastSupplyDate: string | null;
    totalQuantitySupplied: number;
  };
  recommendations: string[];
}

/**
 * API 响应包装
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ============ 辅助函数 ============

/**
 * 获取评级对应的颜色
 */
export function getGradeColor(grade: 'A' | 'B' | 'C' | 'D'): string {
  const colors: Record<string, string> = {
    A: '#52c41a', // 绿色
    B: '#1890ff', // 蓝色
    C: '#faad14', // 黄色
    D: '#ff4d4f', // 红色
  };
  return colors[grade] || '#999999';
}

/**
 * 获取评级对应的标签
 */
export function getGradeLabel(grade: 'A' | 'B' | 'C' | 'D'): string {
  const labels: Record<string, string> = {
    A: '优秀 (90+)',
    B: '良好 (80-90)',
    C: '合格 (60-80)',
    D: '不合格 (<60)',
  };
  return labels[grade] || '未知';
}

/**
 * 获取检验级别对应的颜色
 */
export function getInspectionLevelColor(level: InspectionLevel): string {
  const colors: Record<InspectionLevel, string> = {
    RELAXED: '#52c41a', // 绿色 - 宽松
    NORMAL: '#1890ff',  // 蓝色 - 正常
    STRICT: '#ff4d4f',  // 红色 - 加严
  };
  return colors[level];
}

/**
 * 获取检验级别对应的标签
 */
export function getInspectionLevelLabel(level: InspectionLevel): string {
  const labels: Record<InspectionLevel, string> = {
    RELAXED: '宽松检验',
    NORMAL: '正常检验',
    STRICT: '加严检验',
  };
  return labels[level];
}

// ============ API 客户端 ============

class SupplierAdmissionApiClient {
  /**
   * 获取 API 路径
   */
  private getPath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请确保已登录工厂账户');
    }
    return `/api/mobile/${currentFactoryId}/supplier-admission`;
  }

  // ============ 准入评估 ============

  /**
   * 评估单个供应商的准入资格
   */
  async evaluateAdmission(
    supplierId: string,
    factoryId?: string
  ): Promise<AdmissionEvaluationResult> {
    const response = await apiClient.get<ApiResponse<AdmissionEvaluationResult>>(
      `${this.getPath(factoryId)}/evaluate/${supplierId}`
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '评估供应商准入失败');
  }

  /**
   * 批量评估多个供应商
   */
  async batchEvaluate(
    supplierIds: string[],
    factoryId?: string
  ): Promise<BatchEvaluationResult> {
    const response = await apiClient.post<ApiResponse<BatchEvaluationResult>>(
      `${this.getPath(factoryId)}/evaluate/batch`,
      { supplierIds }
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '批量评估供应商失败');
  }

  // ============ 供货权限 ============

  /**
   * 检查供应商对特定材料的供货权限
   */
  async checkSupplyPermission(
    supplierId: string,
    materialTypeId: string,
    factoryId?: string
  ): Promise<SupplyPermissionResult> {
    const response = await apiClient.get<ApiResponse<SupplyPermissionResult>>(
      `${this.getPath(factoryId)}/permission/${supplierId}`,
      { params: { materialTypeId } }
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '检查供货权限失败');
  }

  // ============ 验收策略 ============

  /**
   * 生成验收策略
   */
  async generateAcceptanceStrategy(
    request: GenerateAcceptanceStrategyRequest,
    factoryId?: string
  ): Promise<AcceptanceStrategy> {
    const response = await apiClient.post<ApiResponse<AcceptanceStrategy>>(
      `${this.getPath(factoryId)}/acceptance-strategy`,
      request
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '生成验收策略失败');
  }

  // ============ 规则配置 ============

  /**
   * 获取供应商规则配置
   */
  async getRuleConfiguration(factoryId?: string): Promise<SupplierRuleConfig> {
    const response = await apiClient.get<ApiResponse<SupplierRuleConfig>>(
      `${this.getPath(factoryId)}/rules`
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '获取规则配置失败');
  }

  /**
   * 更新供应商规则配置
   */
  async updateRuleConfiguration(
    config: Partial<SupplierRuleConfig>,
    factoryId?: string
  ): Promise<SupplierRuleConfig> {
    const response = await apiClient.put<ApiResponse<SupplierRuleConfig>>(
      `${this.getPath(factoryId)}/rules`,
      config
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '更新规则配置失败');
  }

  // ============ 综合报告 ============

  /**
   * 获取供应商综合评估报告
   */
  async getSupplierReport(
    supplierId: string,
    factoryId?: string
  ): Promise<SupplierReport> {
    const response = await apiClient.get<ApiResponse<SupplierReport>>(
      `${this.getPath(factoryId)}/report/${supplierId}`
    );
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '获取供应商报告失败');
  }
}

export const supplierAdmissionApiClient = new SupplierAdmissionApiClient();
