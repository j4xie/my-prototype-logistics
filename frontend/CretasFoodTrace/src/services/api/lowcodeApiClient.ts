/**
 * 低代码系统 API Client
 * Lowcode System API Client
 *
 * 提供低代码页面配置、组件管理、AI生成等功能的API调用
 */

import { apiClient } from './apiClient';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 通用API响应类型
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

/**
 * 分页响应类型
 */
interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * 页面配置DTO
 */
export interface PageConfigDTO {
  pageId: string;
  factoryId: string;
  roleCode?: string;
  pageType: 'home' | 'dashboard' | 'list' | 'detail' | 'form';
  pageName: string;
  layoutConfig: string; // JSON
  themeConfig?: string; // JSON
  dataBindings?: string; // JSON
  status?: number;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 组件定义DTO
 */
export interface ComponentDefinitionDTO {
  componentType: string;
  name: string;
  category: string;
  icon?: string;
  propsSchema: string; // JSON
  defaultProps?: string; // JSON
  sizeConstraints?: string; // JSON
  aiDescription?: string;
}

/**
 * AI页面生成请求
 */
export interface AIPageGenerateRequest {
  prompt: string;
  pageType: string;
  roleCode?: string;
  currentConfig?: PageConfigDTO;
}

/**
 * AI建议操作
 */
export interface AISuggestedAction {
  actionCode: string;
  actionName: string;
  description: string;
}

/**
 * AI页面生成响应
 */
export interface AIPageGenerateResponse {
  pageConfig: PageConfigDTO;
  layoutConfig?: string; // JSON - 便捷访问
  themeConfig?: string; // JSON - 便捷访问
  explanation?: string;
  aiMessage?: string;
  suggestions?: string[];
  suggestedActions?: AISuggestedAction[];
}

/**
 * AI添加组件请求
 */
export interface AIComponentAddRequest {
  pageId: string;
  prompt: string;
  targetPosition?: { x: number; y: number };
}

/**
 * AI添加组件响应
 */
export interface AIComponentAddResponse {
  componentConfig: Record<string, unknown>;
  pageConfig: PageConfigDTO;
  layoutConfig?: string; // JSON - 便捷访问
  explanation?: string;
  aiMessage?: string;
  suggestedActions?: AISuggestedAction[];
}

/**
 * AI更新样式请求
 */
export interface AIStyleUpdateRequest {
  pageId: string;
  prompt: string;
}

/**
 * AI更新样式响应
 */
export interface AIStyleUpdateResponse {
  pageConfig: PageConfigDTO;
  layoutConfig?: string; // JSON - 便捷访问
  themeConfig?: string; // JSON - 便捷访问
  explanation?: string;
  aiMessage?: string;
  suggestedActions?: AISuggestedAction[];
}

/**
 * AI意图执行请求
 */
interface AIIntentExecuteRequest {
  userInput: string;
  intentCode: 'PAGE_GENERATE' | 'PAGE_COMPONENT_ADD' | 'PAGE_STYLE_UPDATE';
  context?: Record<string, unknown>;
}

/**
 * AI意图执行响应
 */
interface AIIntentExecuteResponse<T> {
  result: T;
  intentCode: string;
  message?: string;
}

// ============================================================================
// API Client
// ============================================================================

/**
 * 低代码系统 API 客户端
 */
class LowcodeApiClient {
  private readonly basePath = '/api/mobile';

  /**
   * 获取页面列表
   * GET /api/mobile/{factoryId}/lowcode/pages
   */
  async getPages(
    factoryId: string,
    roleCode?: string
  ): Promise<ApiResponse<PageConfigDTO[]>> {
    try {
      const params = roleCode ? { roleCode } : undefined;
      const response = await apiClient.get<ApiResponse<PageConfigDTO[]>>(
        `${this.basePath}/${factoryId}/lowcode/pages`,
        { params }
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 获取页面列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取页面配置
   * GET /api/mobile/{factoryId}/lowcode/pages/{pageId}
   */
  async getPage(
    factoryId: string,
    pageId: string,
    roleCode?: string
  ): Promise<ApiResponse<PageConfigDTO>> {
    try {
      const params = roleCode ? { roleCode } : undefined;
      const response = await apiClient.get<ApiResponse<PageConfigDTO>>(
        `${this.basePath}/${factoryId}/lowcode/pages/${pageId}`,
        { params }
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 获取页面配置失败:', error);
      throw error;
    }
  }

  /**
   * 创建页面
   * POST /api/mobile/{factoryId}/lowcode/pages
   */
  async createPage(
    factoryId: string,
    config: PageConfigDTO
  ): Promise<ApiResponse<PageConfigDTO>> {
    try {
      const response = await apiClient.post<ApiResponse<PageConfigDTO>>(
        `${this.basePath}/${factoryId}/lowcode/pages`,
        config
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 创建页面失败:', error);
      throw error;
    }
  }

  /**
   * 更新页面
   * PUT /api/mobile/{factoryId}/lowcode/pages/{pageId}
   */
  async updatePage(
    factoryId: string,
    pageId: string,
    config: Partial<PageConfigDTO>
  ): Promise<ApiResponse<PageConfigDTO>> {
    try {
      const response = await apiClient.put<ApiResponse<PageConfigDTO>>(
        `${this.basePath}/${factoryId}/lowcode/pages/${pageId}`,
        config
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 更新页面失败:', error);
      throw error;
    }
  }

  /**
   * 发布页面
   * POST /api/mobile/{factoryId}/lowcode/pages/{pageId}/publish
   */
  async publishPage(
    factoryId: string,
    pageId: string
  ): Promise<ApiResponse<PageConfigDTO>> {
    try {
      const response = await apiClient.post<ApiResponse<PageConfigDTO>>(
        `${this.basePath}/${factoryId}/lowcode/pages/${pageId}/publish`
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 发布页面失败:', error);
      throw error;
    }
  }

  /**
   * 删除页面
   * DELETE /api/mobile/{factoryId}/lowcode/pages/{pageId}
   */
  async deletePage(
    factoryId: string,
    pageId: string
  ): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(
        `${this.basePath}/${factoryId}/lowcode/pages/${pageId}`
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 删除页面失败:', error);
      throw error;
    }
  }

  /**
   * 获取组件列表
   * GET /api/mobile/{factoryId}/lowcode/components
   */
  async getComponents(
    factoryId: string,
    roleCode?: string
  ): Promise<ApiResponse<ComponentDefinitionDTO[]>> {
    try {
      const params = roleCode ? { roleCode } : undefined;
      const response = await apiClient.get<ApiResponse<ComponentDefinitionDTO[]>>(
        `${this.basePath}/${factoryId}/lowcode/components`,
        { params }
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 获取组件列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取组件详情
   * GET /api/mobile/lowcode/components/{componentType}
   */
  async getComponent(
    componentType: string
  ): Promise<ApiResponse<ComponentDefinitionDTO>> {
    try {
      const response = await apiClient.get<ApiResponse<ComponentDefinitionDTO>>(
        `${this.basePath}/lowcode/components/${componentType}`
      );
      return response;
    } catch (error) {
      console.error('[LowcodeAPI] 获取组件详情失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // AI Operations - 通过意图执行接口
  // ============================================================================

  /**
   * AI生成页面
   * POST /api/mobile/{factoryId}/ai/intent/execute
   * intentCode: PAGE_GENERATE
   */
  async aiGeneratePage(
    factoryId: string,
    request: AIPageGenerateRequest
  ): Promise<ApiResponse<AIPageGenerateResponse>> {
    try {
      const intentRequest: AIIntentExecuteRequest = {
        userInput: request.prompt,
        intentCode: 'PAGE_GENERATE',
        context: {
          pageType: request.pageType,
          roleCode: request.roleCode,
          currentConfig: request.currentConfig,
        },
      };

      const response = await apiClient.post<ApiResponse<AIIntentExecuteResponse<AIPageGenerateResponse>>>(
        `${this.basePath}/${factoryId}/ai/intent/execute`,
        intentRequest
      );

      // 解包意图执行响应
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.result,
          message: response.data.message,
        };
      }

      return {
        success: response.success,
        message: response.message,
        code: response.code,
      };
    } catch (error) {
      console.error('[LowcodeAPI] AI生成页面失败:', error);
      throw error;
    }
  }

  /**
   * AI添加组件
   * POST /api/mobile/{factoryId}/ai/intent/execute
   * intentCode: PAGE_COMPONENT_ADD
   */
  async aiAddComponent(
    factoryId: string,
    request: AIComponentAddRequest
  ): Promise<ApiResponse<AIComponentAddResponse>> {
    try {
      const intentRequest: AIIntentExecuteRequest = {
        userInput: request.prompt,
        intentCode: 'PAGE_COMPONENT_ADD',
        context: {
          pageId: request.pageId,
          targetPosition: request.targetPosition,
        },
      };

      const response = await apiClient.post<ApiResponse<AIIntentExecuteResponse<AIComponentAddResponse>>>(
        `${this.basePath}/${factoryId}/ai/intent/execute`,
        intentRequest
      );

      // 解包意图执行响应
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.result,
          message: response.data.message,
        };
      }

      return {
        success: response.success,
        message: response.message,
        code: response.code,
      };
    } catch (error) {
      console.error('[LowcodeAPI] AI添加组件失败:', error);
      throw error;
    }
  }

  /**
   * AI更新样式
   * POST /api/mobile/{factoryId}/ai/intent/execute
   * intentCode: PAGE_STYLE_UPDATE
   */
  async aiUpdateStyle(
    factoryId: string,
    request: AIStyleUpdateRequest
  ): Promise<ApiResponse<AIStyleUpdateResponse>> {
    try {
      const intentRequest: AIIntentExecuteRequest = {
        userInput: request.prompt,
        intentCode: 'PAGE_STYLE_UPDATE',
        context: {
          pageId: request.pageId,
        },
      };

      const response = await apiClient.post<ApiResponse<AIIntentExecuteResponse<AIStyleUpdateResponse>>>(
        `${this.basePath}/${factoryId}/ai/intent/execute`,
        intentRequest
      );

      // 解包意图执行响应
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.result,
          message: response.data.message,
        };
      }

      return {
        success: response.success,
        message: response.message,
        code: response.code,
      };
    } catch (error) {
      console.error('[LowcodeAPI] AI更新样式失败:', error);
      throw error;
    }
  }
}

export const lowcodeApiClient = new LowcodeApiClient();
export default lowcodeApiClient;
