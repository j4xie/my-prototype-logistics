import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 表单模板API客户端
 *
 * 用于获取和管理动态表单模板 (Formily Schema)
 * 路径: /api/mobile/{factoryId}/form-templates/*
 *
 * 业务场景:
 * - 加载工厂自定义表单模板
 * - 与默认代码Schema合并
 * - 支持AI生成的自定义字段
 */

// ========== 类型定义 ==========

/**
 * 支持的实体类型
 */
export type EntityType =
  | 'QUALITY_CHECK'
  | 'MATERIAL_BATCH'
  | 'PROCESSING_BATCH'
  | 'SHIPMENT'
  | 'EQUIPMENT'
  | 'DISPOSAL_RECORD'
  | 'PRODUCT_TYPE'
  | 'PRODUCTION_PLAN'
  | 'SCALE_DEVICE'      // IoT电子秤设备
  | 'SCALE_PROTOCOL'    // 电子秤协议文档
  | 'ISAPI_DEVICE';     // ISAPI摄像头设备

/**
 * 模板来源
 */
export type TemplateSource = 'MANUAL' | 'AI_ASSISTANT' | 'IMPORT';

/**
 * 表单模板
 */
export interface FormTemplate {
  id: string;
  factoryId: string;
  entityType: EntityType;
  name: string;
  schemaJson: string;
  uiSchemaJson?: string;
  description?: string;
  version: number;
  isActive: boolean;
  source: TemplateSource;
  createdBy: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 创建模板请求
 */
export interface CreateTemplateRequest {
  entityType: EntityType;
  name: string;
  schemaJson: string;
  uiSchemaJson?: string;
  description?: string;
}

/**
 * 更新模板请求
 */
export interface UpdateTemplateRequest {
  name?: string;
  schemaJson?: string;
  uiSchemaJson?: string;
  description?: string;
}

/**
 * 模板统计信息
 */
export interface TemplateStatistics {
  totalCount: number;
  aiGeneratedCount: number;
  manualCount: number;
  configuredEntityTypes: EntityType[];
  supportedEntityTypes: EntityType[];
  coverageRate: number;
}

/**
 * 模板版本信息
 */
export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  name: string;
  schemaJson: string;
  uiSchemaJson?: string;
  description?: string;
  source?: TemplateSource;
  changeSummary?: string;
  createdBy?: number;
  createdAt: string;
}

/**
 * 版本比较结果
 */
export interface VersionCompareResult {
  versionFrom: number;
  versionTo: number;
  schemaChanges: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  nameChanged: boolean;
  descriptionChanged: boolean;
}

/**
 * 分页响应
 */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * API标准响应
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ========== API客户端类 ==========

class FormTemplateApiClient {
  private getPath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/form-templates`;
  }

  /**
   * 获取指定实体类型的表单模板
   * 前端获取自定义Schema用于与默认Schema合并
   *
   * GET /api/mobile/{factoryId}/form-templates/{entityType}
   */
  async getByEntityType(
    entityType: EntityType,
    factoryId?: string
  ): Promise<ApiResponse<FormTemplate | null>> {
    try {
      const response = await apiClient.get<ApiResponse<FormTemplate | null>>(
        `${this.getPath(factoryId)}/${entityType}`
      );
      return response;
    } catch (error) {
      // 无自定义模板时返回null
      console.log(`[FormTemplateApiClient] 无自定义模板: ${entityType}`);
      return { success: true, data: null, message: '无自定义模板' };
    }
  }

  /**
   * 仅获取Schema JSON
   * 轻量接口，直接返回schema_json内容
   *
   * GET /api/mobile/{factoryId}/form-templates/{entityType}/schema
   */
  async getSchemaJson(
    entityType: EntityType,
    factoryId?: string
  ): Promise<string | null> {
    try {
      const response = await apiClient.get<string>(
        `${this.getPath(factoryId)}/${entityType}/schema`
      );
      return response || null;
    } catch (error) {
      console.log(`[FormTemplateApiClient] 无自定义Schema: ${entityType}`);
      return null;
    }
  }

  /**
   * 分页获取表单模板列表
   *
   * GET /api/mobile/{factoryId}/form-templates
   */
  async getTemplateList(
    params?: { page?: number; size?: number },
    factoryId?: string
  ): Promise<PageResponse<FormTemplate>> {
    const { page = 1, size = 10 } = params || {};
    const response = await apiClient.get<ApiResponse<PageResponse<FormTemplate>>>(
      `${this.getPath(factoryId)}`,
      { params: { page, size } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      content: [],
      page,
      size,
      totalElements: 0,
      totalPages: 0,
    };
  }

  /**
   * 创建表单模板
   *
   * POST /api/mobile/{factoryId}/form-templates
   */
  async createTemplate(
    request: CreateTemplateRequest,
    factoryId?: string
  ): Promise<FormTemplate> {
    const response = await apiClient.post<ApiResponse<FormTemplate>>(
      `${this.getPath(factoryId)}`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '创建模板失败');
    }

    return response.data;
  }

  /**
   * 创建或更新表单模板
   * 如果同类型模板已存在则更新，否则创建
   *
   * PUT /api/mobile/{factoryId}/form-templates/{entityType}
   */
  async createOrUpdateTemplate(
    entityType: EntityType,
    request: UpdateTemplateRequest,
    factoryId?: string
  ): Promise<FormTemplate> {
    const response = await apiClient.put<ApiResponse<FormTemplate>>(
      `${this.getPath(factoryId)}/${entityType}`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '保存模板失败');
    }

    return response.data;
  }

  /**
   * 更新模板 (根据ID)
   *
   * PUT /api/mobile/{factoryId}/form-templates/id/{id}
   */
  async updateTemplate(
    id: string,
    request: UpdateTemplateRequest,
    factoryId?: string
  ): Promise<FormTemplate> {
    const response = await apiClient.put<ApiResponse<FormTemplate>>(
      `${this.getPath(factoryId)}/id/${id}`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新模板失败');
    }

    return response.data;
  }

  /**
   * 启用/禁用模板
   *
   * PATCH /api/mobile/{factoryId}/form-templates/id/{id}/active
   */
  async setTemplateActive(
    id: string,
    active: boolean,
    factoryId?: string
  ): Promise<FormTemplate> {
    const response = await apiClient.put<ApiResponse<FormTemplate>>(
      `${this.getPath(factoryId)}/id/${id}/active`,
      null,
      { params: { active } }
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新模板状态失败');
    }

    return response.data;
  }

  /**
   * 删除模板
   *
   * DELETE /api/mobile/{factoryId}/form-templates/id/{id}
   */
  async deleteTemplate(id: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getPath(factoryId)}/id/${id}`);
  }

  /**
   * 获取支持的实体类型列表
   *
   * GET /api/mobile/{factoryId}/form-templates/entity-types
   */
  async getSupportedEntityTypes(factoryId?: string): Promise<EntityType[]> {
    const response = await apiClient.get<ApiResponse<EntityType[]>>(
      `${this.getPath(factoryId)}/entity-types`
    );

    if (response.success && response.data) {
      return response.data;
    }

    // 默认支持的类型
    return [
      'QUALITY_CHECK',
      'MATERIAL_BATCH',
      'PROCESSING_BATCH',
      'SHIPMENT',
      'EQUIPMENT',
      'DISPOSAL_RECORD',
      'PRODUCT_TYPE',
      'PRODUCTION_PLAN',
    ];
  }

  /**
   * 获取模板统计信息
   *
   * GET /api/mobile/{factoryId}/form-templates/statistics
   */
  async getStatistics(factoryId?: string): Promise<TemplateStatistics> {
    const response = await apiClient.get<ApiResponse<TemplateStatistics>>(
      `${this.getPath(factoryId)}/statistics`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      totalCount: 0,
      aiGeneratedCount: 0,
      manualCount: 0,
      configuredEntityTypes: [],
      supportedEntityTypes: [],
      coverageRate: 0,
    };
  }

  /**
   * 检查是否存在自定义模板
   *
   * GET /api/mobile/{factoryId}/form-templates/{entityType}/exists
   */
  async hasCustomTemplate(
    entityType: EntityType,
    factoryId?: string
  ): Promise<boolean> {
    try {
      const response = await apiClient.get<ApiResponse<boolean>>(
        `${this.getPath(factoryId)}/${entityType}/exists`
      );
      return response.success && response.data === true;
    } catch (error) {
      return false;
    }
  }

  // ========== 版本管理 API ==========

  /**
   * 获取模板版本历史
   *
   * GET /api/mobile/{factoryId}/form-templates/id/{id}/versions
   */
  async getVersionHistory(
    templateId: string,
    params?: { page?: number; size?: number },
    factoryId?: string
  ): Promise<PageResponse<TemplateVersion>> {
    const { page = 1, size = 10 } = params || {};
    try {
      const response = await apiClient.get<ApiResponse<PageResponse<TemplateVersion>>>(
        `${this.getPath(factoryId)}/id/${templateId}/versions`,
        { params: { page, size } }
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回列表的情况
      if (Array.isArray(response)) {
        return {
          content: response as unknown as TemplateVersion[],
          page,
          size,
          totalElements: (response as unknown as TemplateVersion[]).length,
          totalPages: 1,
        };
      }

      return {
        content: [],
        page,
        size,
        totalElements: 0,
        totalPages: 0,
      };
    } catch (error) {
      console.error('[FormTemplateApiClient] getVersionHistory error:', error);
      return {
        content: [],
        page,
        size,
        totalElements: 0,
        totalPages: 0,
      };
    }
  }

  /**
   * 获取特定版本详情
   *
   * GET /api/mobile/{factoryId}/form-templates/id/{id}/versions/{version}
   */
  async getVersionDetail(
    templateId: string,
    version: number,
    factoryId?: string
  ): Promise<TemplateVersion | null> {
    try {
      const response = await apiClient.get<ApiResponse<TemplateVersion>>(
        `${this.getPath(factoryId)}/id/${templateId}/versions/${version}`
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据的情况
      if ('templateId' in response) {
        return response as unknown as TemplateVersion;
      }

      return null;
    } catch (error) {
      console.error('[FormTemplateApiClient] getVersionDetail error:', error);
      return null;
    }
  }

  /**
   * 回滚到指定版本
   *
   * POST /api/mobile/{factoryId}/form-templates/id/{id}/rollback
   */
  async rollbackToVersion(
    templateId: string,
    version: number,
    reason?: string,
    factoryId?: string
  ): Promise<FormTemplate> {
    const response = await apiClient.post<ApiResponse<FormTemplate>>(
      `${this.getPath(factoryId)}/id/${templateId}/rollback`,
      { version, reason }
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '回滚失败');
    }

    return response.data;
  }

  /**
   * 比较两个版本的差异
   *
   * GET /api/mobile/{factoryId}/form-templates/id/{id}/versions/compare
   */
  async compareVersions(
    templateId: string,
    versionFrom: number,
    versionTo: number,
    factoryId?: string
  ): Promise<VersionCompareResult | null> {
    try {
      const response = await apiClient.get<ApiResponse<VersionCompareResult>>(
        `${this.getPath(factoryId)}/id/${templateId}/versions/compare`,
        { params: { from: versionFrom, to: versionTo } }
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据的情况
      if ('schemaChanges' in response) {
        return response as unknown as VersionCompareResult;
      }

      return null;
    } catch (error) {
      console.error('[FormTemplateApiClient] compareVersions error:', error);
      return null;
    }
  }
}

export const formTemplateApiClient = new FormTemplateApiClient();
export default formTemplateApiClient;
