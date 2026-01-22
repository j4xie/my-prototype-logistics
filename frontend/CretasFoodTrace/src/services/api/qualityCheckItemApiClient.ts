/**
 * 质检项配置 API 客户端
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */

import { apiClient } from './apiClient';

// ==================== 类型定义 ====================

export type QualityCheckCategory =
  | 'SENSORY'
  | 'PHYSICAL'
  | 'CHEMICAL'
  | 'MICROBIOLOGICAL'
  | 'PACKAGING';

export type SamplingStrategy =
  | 'FIRST_PIECE'
  | 'RANDOM'
  | 'BATCH_END'
  | 'FULL_INSPECTION'
  | 'PERIODIC'
  | 'AQL';

export type QualitySeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export interface QualityCheckItem {
  id: string;
  factoryId: string | null;
  itemCode: string;
  itemName: string;
  category: QualityCheckCategory;
  categoryDescription: string;
  description?: string;
  checkMethod?: string;
  standardReference?: string;

  // 标准值配置
  valueType: string;
  standardValue?: string;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  tolerance?: number;

  // 抽样配置
  samplingStrategy: SamplingStrategy;
  samplingStrategyDescription: string;
  samplingRatio: number;
  minSampleSize: number;
  aqlLevel?: number;

  // 严重程度和控制
  severity: QualitySeverity;
  severityDescription: string;
  severityWeight: number;
  isRequired: boolean;
  requirePhotoOnFail: boolean;
  requireNoteOnFail: boolean;
  sortOrder: number;
  enabled: boolean;
  version: number;

  // 统计信息
  bindingCount: number;

  // 审计字段
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QualityCheckItemBinding {
  id: string;
  factoryId: string;
  productTypeId: string;
  productTypeName?: string;
  qualityCheckItemId: string;

  // 关联的质检项信息
  qualityCheckItem?: QualityCheckItem;

  // 覆盖配置
  overrideStandardValue?: string;
  overrideMinValue?: number;
  overrideMaxValue?: number;
  overrideSamplingRatio?: number;
  overrideIsRequired?: boolean;

  // 生效的值
  effectiveStandardValue?: string;
  effectiveMinValue?: number;
  effectiveMaxValue?: number;
  effectiveSamplingRatio?: number;
  effectiveIsRequired?: boolean;

  sortOrder: number;
  enabled: boolean;
  notes?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateQualityCheckItemRequest {
  itemCode: string;
  itemName: string;
  category: QualityCheckCategory;
  description?: string;
  checkMethod?: string;
  standardReference?: string;
  valueType?: string;
  standardValue?: string;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  tolerance?: number;
  samplingStrategy?: SamplingStrategy;
  samplingRatio?: number;
  minSampleSize?: number;
  aqlLevel?: number;
  severity?: QualitySeverity;
  isRequired?: boolean;
  requirePhotoOnFail?: boolean;
  requireNoteOnFail?: boolean;
  sortOrder?: number;
  enabled?: boolean;
}

export interface UpdateQualityCheckItemRequest {
  itemName?: string;
  category?: QualityCheckCategory;
  description?: string;
  checkMethod?: string;
  standardReference?: string;
  valueType?: string;
  standardValue?: string;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  tolerance?: number;
  samplingStrategy?: SamplingStrategy;
  samplingRatio?: number;
  minSampleSize?: number;
  aqlLevel?: number;
  severity?: QualitySeverity;
  isRequired?: boolean;
  requirePhotoOnFail?: boolean;
  requireNoteOnFail?: boolean;
  sortOrder?: number;
  enabled?: boolean;
}

export interface BindQualityCheckItemRequest {
  productTypeId: string;
  qualityCheckItemId: string;
  overrideStandardValue?: string;
  overrideMinValue?: number;
  overrideMaxValue?: number;
  overrideSamplingRatio?: number;
  overrideIsRequired?: boolean;
  sortOrder?: number;
  enabled?: boolean;
  notes?: string;
}

export interface QualityCheckItemStatistics {
  total: number;
  byCategory: Record<QualityCheckCategory, number>;
  bySeverity: Record<QualitySeverity, number>;
  requiredCount: number;
  criticalCount: number;
}

interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * API 标准响应
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ==================== API 方法 ====================

const getBaseUrl = (factoryId: string) =>
  `/api/mobile/${factoryId}/quality-check-items`;

/**
 * 质检项配置 API 客户端
 */
export const qualityCheckItemApi = {
  // ==================== CRUD ====================

  /**
   * 创建质检项
   */
  async create(
    factoryId: string,
    request: CreateQualityCheckItemRequest
  ): Promise<QualityCheckItem> {
    const response = await apiClient.post<ApiResponse<QualityCheckItem>>(
      getBaseUrl(factoryId),
      request
    );
    return response.data;
  },

  /**
   * 更新质检项
   */
  async update(
    factoryId: string,
    itemId: string,
    request: UpdateQualityCheckItemRequest
  ): Promise<QualityCheckItem> {
    const response = await apiClient.put<ApiResponse<QualityCheckItem>>(
      `${getBaseUrl(factoryId)}/${itemId}`,
      request
    );
    return response.data;
  },

  /**
   * 删除质检项
   */
  async delete(factoryId: string, itemId: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`${getBaseUrl(factoryId)}/${itemId}`);
  },

  /**
   * 获取单个质检项
   */
  async getById(factoryId: string, itemId: string): Promise<QualityCheckItem> {
    const response = await apiClient.get<ApiResponse<QualityCheckItem>>(
      `${getBaseUrl(factoryId)}/${itemId}`
    );
    return response.data;
  },

  /**
   * 分页查询质检项
   */
  async list(
    factoryId: string,
    page: number = 1,
    size: number = 20,
    sort: string = 'category,sortOrder'
  ): Promise<PaginatedResponse<QualityCheckItem>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<QualityCheckItem>>>(
      getBaseUrl(factoryId),
      { params: { page, size, sort } }
    );
    return response.data;
  },

  // ==================== 查询方法 ====================

  /**
   * 按类别查询
   */
  async getByCategory(
    factoryId: string,
    category: QualityCheckCategory
  ): Promise<QualityCheckItem[]> {
    const response = await apiClient.get<ApiResponse<QualityCheckItem[]>>(
      `${getBaseUrl(factoryId)}/category/${category}`
    );
    return response.data;
  },

  /**
   * 获取必检项
   */
  async getRequired(factoryId: string): Promise<QualityCheckItem[]> {
    const response = await apiClient.get<ApiResponse<QualityCheckItem[]>>(
      `${getBaseUrl(factoryId)}/required`
    );
    return response.data;
  },

  /**
   * 获取关键项
   */
  async getCritical(factoryId: string): Promise<QualityCheckItem[]> {
    const response = await apiClient.get<ApiResponse<QualityCheckItem[]>>(
      `${getBaseUrl(factoryId)}/critical`
    );
    return response.data;
  },

  /**
   * 获取所有启用的质检项
   */
  async getEnabled(factoryId: string): Promise<QualityCheckItem[]> {
    const response = await apiClient.get<ApiResponse<QualityCheckItem[]>>(
      `${getBaseUrl(factoryId)}/enabled`
    );
    return response.data;
  },

  /**
   * 获取系统默认模板
   */
  async getSystemTemplates(factoryId: string): Promise<QualityCheckItem[]> {
    const response = await apiClient.get<ApiResponse<QualityCheckItem[]>>(
      `${getBaseUrl(factoryId)}/templates`
    );
    return response.data;
  },

  // ==================== 统计方法 ====================

  /**
   * 获取统计信息
   */
  async getStatistics(factoryId: string): Promise<QualityCheckItemStatistics> {
    const response = await apiClient.get<ApiResponse<QualityCheckItemStatistics>>(
      `${getBaseUrl(factoryId)}/statistics`
    );
    return response.data;
  },

  /**
   * 按类别统计
   */
  async countByCategory(
    factoryId: string
  ): Promise<Record<QualityCheckCategory, number>> {
    const response = await apiClient.get<ApiResponse<Record<QualityCheckCategory, number>>>(
      `${getBaseUrl(factoryId)}/statistics/by-category`
    );
    return response.data;
  },

  // ==================== 批量操作 ====================

  /**
   * 批量启用
   */
  async batchEnable(factoryId: string, itemIds: string[]): Promise<number> {
    const response = await apiClient.post<ApiResponse<number>>(
      `${getBaseUrl(factoryId)}/batch/enable`,
      itemIds
    );
    return response.data;
  },

  /**
   * 批量禁用
   */
  async batchDisable(factoryId: string, itemIds: string[]): Promise<number> {
    const response = await apiClient.post<ApiResponse<number>>(
      `${getBaseUrl(factoryId)}/batch/disable`,
      itemIds
    );
    return response.data;
  },

  /**
   * 从系统模板复制
   */
  async copyFromTemplate(factoryId: string): Promise<QualityCheckItem[]> {
    const response = await apiClient.post<ApiResponse<QualityCheckItem[]>>(
      `${getBaseUrl(factoryId)}/copy-from-template`
    );
    return response.data;
  },

  // ==================== 绑定管理 ====================

  /**
   * 绑定质检项到产品
   */
  async bind(
    factoryId: string,
    request: BindQualityCheckItemRequest
  ): Promise<QualityCheckItemBinding> {
    const response = await apiClient.post<ApiResponse<QualityCheckItemBinding>>(
      `${getBaseUrl(factoryId)}/bindings`,
      request
    );
    return response.data;
  },

  /**
   * 解除绑定
   */
  async unbind(factoryId: string, bindingId: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(
      `${getBaseUrl(factoryId)}/bindings/${bindingId}`
    );
  },

  /**
   * 更新绑定配置
   */
  async updateBinding(
    factoryId: string,
    bindingId: string,
    request: BindQualityCheckItemRequest
  ): Promise<QualityCheckItemBinding> {
    const response = await apiClient.put<ApiResponse<QualityCheckItemBinding>>(
      `${getBaseUrl(factoryId)}/bindings/${bindingId}`,
      request
    );
    return response.data;
  },

  /**
   * 获取产品的质检项绑定
   */
  async getProductBindings(
    factoryId: string,
    productTypeId: string
  ): Promise<QualityCheckItemBinding[]> {
    const response = await apiClient.get<ApiResponse<QualityCheckItemBinding[]>>(
      `${getBaseUrl(factoryId)}/bindings/product/${productTypeId}`
    );
    return response.data;
  },

  /**
   * 批量绑定质检项到产品
   */
  async batchBind(
    factoryId: string,
    productTypeId: string,
    itemIds: string[]
  ): Promise<QualityCheckItemBinding[]> {
    const response = await apiClient.post<ApiResponse<QualityCheckItemBinding[]>>(
      `${getBaseUrl(factoryId)}/bindings/batch`,
      itemIds,
      { params: { productTypeId } }
    );
    return response.data;
  },

  /**
   * 检查绑定是否存在
   */
  async checkBindingExists(
    factoryId: string,
    productTypeId: string,
    qualityCheckItemId: string
  ): Promise<boolean> {
    const response = await apiClient.get<ApiResponse<boolean>>(
      `${getBaseUrl(factoryId)}/bindings/exists`,
      { params: { productTypeId, qualityCheckItemId } }
    );
    return response.data;
  },

  /**
   * 获取质检项的统计数据（单个项目）
   */
  async getItemStatistics(
    factoryId: string,
    itemId: string
  ): Promise<{
    totalInspections: number;
    passCount: number;
    failCount: number;
    passRate: number;
    recentInspections: Array<{
      id: string;
      batchNumber: string;
      result: string;
      value: string;
      inspectedAt: string;
    }>;
  }> {
    const response = await apiClient.get<ApiResponse<{
      totalInspections: number;
      passCount: number;
      failCount: number;
      passRate: number;
      recentInspections: Array<{
        id: string;
        batchNumber: string;
        result: string;
        value: string;
        inspectedAt: string;
      }>;
    }>>(
      `${getBaseUrl(factoryId)}/${itemId}/statistics`
    );
    return response.data;
  },

  /**
   * 验证检测值
   */
  async validateValue(
    factoryId: string,
    itemId: string,
    value: unknown,
    productTypeId?: string
  ): Promise<boolean> {
    const response = await apiClient.post<ApiResponse<boolean>>(
      `${getBaseUrl(factoryId)}/${itemId}/validate`,
      value,
      { params: productTypeId ? { productTypeId } : undefined }
    );
    return response.data;
  },
};

// ==================== 辅助常量 ====================

export const QUALITY_CHECK_CATEGORIES: {
  value: QualityCheckCategory;
  label: string;
  color: string;
}[] = [
  { value: 'SENSORY', label: '感官检测', color: '#9C27B0' },
  { value: 'PHYSICAL', label: '物理检测', color: '#2196F3' },
  { value: 'CHEMICAL', label: '化学检测', color: '#FF9800' },
  { value: 'MICROBIOLOGICAL', label: '微生物检测', color: '#F44336' },
  { value: 'PACKAGING', label: '包装检测', color: '#4CAF50' },
];

export const SAMPLING_STRATEGIES: {
  value: SamplingStrategy;
  label: string;
  description: string;
}[] = [
  { value: 'FIRST_PIECE', label: '首件检验', description: '每批次首件必检' },
  { value: 'RANDOM', label: '随机抽样', description: '按比例随机抽取样品' },
  { value: 'BATCH_END', label: '批次末检验', description: '每批次结束时检验' },
  { value: 'FULL_INSPECTION', label: '全检', description: '每件产品都检验' },
  { value: 'PERIODIC', label: '定时抽检', description: '按时间间隔抽检' },
  { value: 'AQL', label: 'AQL抽样', description: '按可接受质量水平抽样' },
];

export const QUALITY_SEVERITIES: {
  value: QualitySeverity;
  label: string;
  color: string;
  weight: number;
}[] = [
  { value: 'CRITICAL', label: '关键项', color: '#F44336', weight: 3 },
  { value: 'MAJOR', label: '主要项', color: '#FF9800', weight: 2 },
  { value: 'MINOR', label: '次要项', color: '#4CAF50', weight: 1 },
];

export const VALUE_TYPES: { value: string; label: string }[] = [
  { value: 'NUMERIC', label: '数值型' },
  { value: 'TEXT', label: '文本型' },
  { value: 'BOOLEAN', label: '布尔型' },
  { value: 'RANGE', label: '范围型' },
];

export default qualityCheckItemApi;
