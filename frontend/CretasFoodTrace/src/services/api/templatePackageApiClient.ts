import { apiClient } from './apiClient';
import { EntityType } from './formTemplateApiClient';

/**
 * 行业模板包API客户端
 *
 * 平台管理员用于初始化工厂表单模板
 * 路径: /api/platform/template-packages/*
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */

// ========== 类型定义 ==========

/**
 * 行业模板包
 */
export interface IndustryTemplatePackage {
  id: string;
  industryCode: string;
  industryName: string;
  description?: string;
  entityTypes: EntityType[];
  /** 每个实体类型的 Schema 配置 */
  templates?: Record<string, object>;
  /** 模板数量 (entityTypes.length) */
  schemaCount?: number;
  version: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 模板包详情（包含完整Schema）
 */
export interface TemplatePackageDetail extends IndustryTemplatePackage {
  /** 原始 JSON 字符串形式 */
  templatesJson?: string;
  /** 解析后的模板对象 */
  templates: Record<string, object>;
}

/**
 * 初始化工厂请求
 */
export interface InitializeFactoryRequest {
  templatePackageId: string;
  overwriteExisting?: boolean;
}

/**
 * 初始化结果
 */
export interface InitializeFactoryResult {
  factoryId: string;
  templatesCreated: number;
  entityTypes: EntityType[];
  message: string;
}

/**
 * 创建模板包请求
 */
export interface CreateTemplatePackageRequest {
  industryCode: string;
  industryName: string;
  description?: string;
  templatesJson: string;
  isDefault?: boolean;
}

/**
 * 更新模板包请求
 */
export interface UpdateTemplatePackageRequest {
  industryName?: string;
  description?: string;
  templatesJson?: string;
  isDefault?: boolean;
}

/**
 * 模板使用情况
 */
export interface TemplateUsageInfo {
  templateId: string;
  usageCount: number;
  factories: Array<{
    factoryId: string;
    factoryName: string;
    initializedAt: string;
  }>;
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

class TemplatePackageApiClient {
  private basePath = '/api/platform/template-packages';

  /**
   * 获取所有行业模板包列表
   *
   * GET /api/platform/template-packages
   */
  async getTemplatePackages(): Promise<IndustryTemplatePackage[]> {
    try {
      const response = await apiClient.get<ApiResponse<IndustryTemplatePackage[]>>(
        this.basePath
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数组
      if (Array.isArray(response)) {
        return response as IndustryTemplatePackage[];
      }

      return [];
    } catch (error) {
      console.error('[TemplatePackageApiClient] getTemplatePackages error:', error);
      return [];
    }
  }

  /**
   * 获取模板包详情
   *
   * GET /api/platform/template-packages/{id}
   */
  async getTemplatePackageDetail(id: string): Promise<TemplatePackageDetail | null> {
    try {
      const response = await apiClient.get<ApiResponse<TemplatePackageDetail>>(
        `${this.basePath}/${id}`
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据
      if ('templatesJson' in response) {
        return response as unknown as TemplatePackageDetail;
      }

      return null;
    } catch (error) {
      console.error('[TemplatePackageApiClient] getTemplatePackageDetail error:', error);
      return null;
    }
  }

  /**
   * 获取默认模板包
   *
   * GET /api/platform/template-packages/default
   */
  async getDefaultTemplatePackage(): Promise<IndustryTemplatePackage | null> {
    try {
      const response = await apiClient.get<ApiResponse<IndustryTemplatePackage>>(
        `${this.basePath}/default`
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据
      if ('industryCode' in response) {
        return response as unknown as IndustryTemplatePackage;
      }

      return null;
    } catch (error) {
      console.error('[TemplatePackageApiClient] getDefaultTemplatePackage error:', error);
      return null;
    }
  }

  /**
   * 初始化工厂模板
   *
   * POST /api/platform/factories/{factoryId}/initialize-templates
   */
  async initializeFactory(
    factoryId: string,
    request: InitializeFactoryRequest
  ): Promise<InitializeFactoryResult> {
    const response = await apiClient.post<ApiResponse<InitializeFactoryResult>>(
      `/api/platform/factories/${factoryId}/initialize-templates`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '初始化失败');
    }

    return response.data;
  }

  /**
   * 检查工厂是否已初始化模板
   *
   * GET /api/platform/factories/{factoryId}/templates-initialized
   */
  async isFactoryInitialized(factoryId: string): Promise<boolean> {
    try {
      const response = await apiClient.get<ApiResponse<{ initialized: boolean }>>(
        `/api/platform/factories/${factoryId}/templates-initialized`
      );

      if (response.success && response.data) {
        return response.data.initialized;
      }

      return false;
    } catch (error) {
      console.error('[TemplatePackageApiClient] isFactoryInitialized error:', error);
      return false;
    }
  }

  // ========== CRUD 管理方法 ==========

  /**
   * 创建模板包
   *
   * POST /api/platform/template-packages
   */
  async createTemplatePackage(
    request: CreateTemplatePackageRequest
  ): Promise<IndustryTemplatePackage> {
    const response = await apiClient.post<ApiResponse<IndustryTemplatePackage>>(
      this.basePath,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '创建模板失败');
    }

    return response.data;
  }

  /**
   * 更新模板包
   *
   * PUT /api/platform/template-packages/{id}
   */
  async updateTemplatePackage(
    id: string,
    request: UpdateTemplatePackageRequest
  ): Promise<IndustryTemplatePackage> {
    const response = await apiClient.put<ApiResponse<IndustryTemplatePackage>>(
      `${this.basePath}/${id}`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新模板失败');
    }

    return response.data;
  }

  /**
   * 删除模板包
   *
   * DELETE /api/platform/template-packages/{id}
   *
   * @throws 如果模板正在被使用则无法删除
   */
  async deleteTemplatePackage(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${this.basePath}/${id}`
    );

    if (!response.success) {
      throw new Error(response.message || '删除模板失败');
    }
  }

  /**
   * 设置默认模板
   *
   * PUT /api/platform/template-packages/{id}/set-default
   */
  async setDefaultTemplate(id: string): Promise<void> {
    const response = await apiClient.put<ApiResponse<void>>(
      `${this.basePath}/${id}/set-default`,
      {}
    );

    if (!response.success) {
      throw new Error(response.message || '设置默认模板失败');
    }
  }

  /**
   * 获取模板使用情况
   *
   * GET /api/platform/template-packages/{id}/usage
   */
  async getTemplateUsage(id: string): Promise<TemplateUsageInfo> {
    const response = await apiClient.get<ApiResponse<TemplateUsageInfo>>(
      `${this.basePath}/${id}/usage`
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取使用情况失败');
    }

    return response.data;
  }
}

export const templatePackageApiClient = new TemplatePackageApiClient();
export default templatePackageApiClient;
