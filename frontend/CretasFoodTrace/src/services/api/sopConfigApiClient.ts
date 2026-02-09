import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * SOP 配置管理 API 客户端
 * 对应后端: /api/mobile/{factoryId}/sop-configs/*
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

// ==================== 类型定义 ====================

/**
 * SOP 步骤配置
 */
export interface SopStep {
  /** 加工环节类型 (ProcessingStageType enum value) */
  stageType: string;
  /** 步骤顺序 (1-based) */
  orderIndex: number;
  /** 步骤名称 */
  name: string;
  /** 所需技能等级 (1-5) */
  requiredSkillLevel: number;
  /** 是否必需 */
  required?: boolean;
  /** 是否需要拍照 */
  photoRequired?: boolean;
  /** 时间限制 (分钟) */
  timeLimitMinutes?: number;
  /** 验证规则ID列表 */
  validationRuleIds?: string[];
  /** 备注 */
  notes?: string;
}

/**
 * 验证规则配置
 */
export interface ValidationRulesConfig {
  /** 开始时触发的规则 */
  onStart?: string[];
  /** 完成时触发的规则 */
  onComplete?: string[];
  /** 跨步骤验证规则 */
  crossStep?: string[];
}

/**
 * 拍照配置
 */
export interface PhotoConfig {
  /** 是否必需拍照 */
  required: boolean;
  /** 需要拍照的环节类型 */
  stages?: string[];
  /** 每个环节最少照片数 */
  minPhotosPerStage?: number;
  /** 每个环节最多照片数 */
  maxPhotosPerStage?: number;
}

/**
 * SOP 配置实体
 */
export interface SopConfig {
  id: string;
  factoryId: string;
  /** SOP 名称 */
  name: string;
  /** SOP 编码 */
  code: string;
  /** SOP 描述 */
  description?: string;
  /** 关联实体类型 (如: PRODUCTION_BATCH, MATERIAL_BATCH, QUALITY_CHECK) */
  entityType: string;
  /** 关联产品类型ID (可选，为空则适用于所有产品类型) */
  productTypeId?: string;
  /** 关联产品类型名称 (仅展示) */
  productTypeName?: string;
  /** 关联的规则组ID */
  ruleGroupId?: string;
  /** SOP 步骤配置 (JSON 数组) */
  steps?: SopStep[];
  /** 验证规则配置 (JSON 对象) */
  validationRules?: ValidationRulesConfig;
  /** 拍照配置 (JSON 对象) */
  photoConfig?: PhotoConfig;
  /** 版本号 */
  version: number;
  /** 是否启用 */
  isActive: boolean;
  /** 创建者用户ID */
  createdBy?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 创建 SOP 配置请求参数
 */
export interface CreateSopConfigRequest {
  name: string;
  code?: string; // 可选，由后端自动生成
  description?: string;
  entityType: string;
  productTypeId?: string;
  ruleGroupId?: string;
  steps?: SopStep[];
  validationRules?: ValidationRulesConfig;
  photoConfig?: PhotoConfig;
}

/**
 * 更新 SOP 配置请求参数（所有字段可选）
 */
export interface UpdateSopConfigRequest extends Partial<CreateSopConfigRequest> {
  isActive?: boolean;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

/**
 * SOP 配置 API 客户端类
 */
class SopConfigApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/sop-configs`;
  }

  /**
   * 获取 SOP 配置列表
   */
  async getSopConfigs(params?: {
    factoryId?: string;
    entityType?: string;
    productTypeId?: string;
    isActive?: boolean;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<SopConfig>> {
    const { factoryId, page = 1, size = 20, ...query } = params || {};
    const response = await apiClient.get<{ code: number; data: PaginatedResponse<SopConfig>; message: string; success: boolean }>(
      this.getPath(factoryId),
      { params: { page, size, ...query } }
    );
    return response.data;
  }

  /**
   * 创建 SOP 配置
   */
  async createSopConfig(
    data: CreateSopConfigRequest,
    factoryId?: string
  ): Promise<SopConfig> {
    const response = await apiClient.post<{ code: number; data: SopConfig; message: string; success: boolean }>(
      this.getPath(factoryId), data
    );
    return response.data;
  }

  /**
   * 获取 SOP 配置详情
   */
  async getSopConfigById(id: string, factoryId?: string): Promise<SopConfig> {
    const response = await apiClient.get<{ code: number; data: SopConfig; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/${id}`
    );
    return response.data;
  }

  /**
   * 更新 SOP 配置
   */
  async updateSopConfig(
    id: string,
    data: UpdateSopConfigRequest,
    factoryId?: string
  ): Promise<SopConfig> {
    const response = await apiClient.put<{ code: number; data: SopConfig; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/${id}`, data
    );
    return response.data;
  }

  /**
   * 删除 SOP 配置
   */
  async deleteSopConfig(id: string, factoryId?: string): Promise<void> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 启用/禁用 SOP 配置
   */
  async toggleSopConfigStatus(
    id: string,
    isActive: boolean,
    factoryId?: string
  ): Promise<SopConfig> {
    const response = await apiClient.put<{ code: number; data: SopConfig; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/${id}`, {
      isActive,
    });
    return response.data;
  }

  /**
   * 按实体类型获取 SOP 配置列表
   */
  async getSopConfigsByEntityType(
    entityType: string,
    factoryId?: string
  ): Promise<SopConfig[]> {
    const response = await this.getSopConfigs({
      factoryId,
      entityType,
      isActive: true,
    });
    return response.content;
  }

  /**
   * 按产品类型获取 SOP 配置列表
   */
  async getSopConfigsByProductType(
    productTypeId: string,
    factoryId?: string
  ): Promise<SopConfig[]> {
    const response = await this.getSopConfigs({
      factoryId,
      productTypeId,
      isActive: true,
    });
    return response.content;
  }

  /**
   * 检查 SOP 编码是否存在
   */
  async checkCodeExists(
    code: string,
    factoryId?: string
  ): Promise<{ exists: boolean }> {
    const response = await apiClient.get<{ code: number; data: { exists: boolean }; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/check-code`, {
      params: { code },
    });
    return response.data;
  }

  /**
   * 批量更新 SOP 配置状态
   */
  async batchUpdateStatus(
    ids: string[],
    isActive: boolean,
    factoryId?: string
  ): Promise<void> {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, {
      ids,
      isActive,
    });
  }
}

export const sopConfigApiClient = new SopConfigApiClient();
