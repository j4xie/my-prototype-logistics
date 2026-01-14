/**
 * 首页装饰 API Client
 * Home Decoration API Client
 *
 * 提供首页布局配置、AI生成布局等功能的API调用
 */

import { apiClient } from './apiClient';
import type {
  AILayoutGenerateRequest,
  AILayoutGenerateResponse,
  SaveLayoutRequest,
  SaveLayoutResponse,
  PublishLayoutRequest,
  PublishLayoutResponse,
  BackendHomeLayoutDTO,
} from '../../types/decoration';

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
 * 首页装饰 API 客户端
 */
class DecorationApiClient {
  /**
   * AI生成布局
   * POST /api/mobile/{factoryId}/decoration/home-layout/ai-generate
   */
  async generateLayoutWithAI(
    factoryId: string,
    request: AILayoutGenerateRequest
  ): Promise<ApiResponse<AILayoutGenerateResponse>> {
    try {
      const response = await apiClient.post<ApiResponse<AILayoutGenerateResponse>>(
        `/api/mobile/${factoryId}/decoration/home-layout/ai-generate`,
        request
      );
      return response;
    } catch (error) {
      console.error('[DecorationAPI] AI生成布局失败:', error);
      throw error;
    }
  }

  /**
   * 获取工厂首页布局配置
   * GET /api/mobile/{factoryId}/decoration/home-layout
   */
  async getLayout(factoryId: string): Promise<ApiResponse<BackendHomeLayoutDTO>> {
    console.log('[DecorationAPI] getLayout 开始, factoryId:', factoryId);
    try {
      console.log('[DecorationAPI] 发送请求到:', `/api/mobile/${factoryId}/decoration/home-layout`);
      const response = await apiClient.get<ApiResponse<BackendHomeLayoutDTO>>(
        `/api/mobile/${factoryId}/decoration/home-layout`
      );
      console.log('[DecorationAPI] 请求成功, response.success:', response?.success);
      return response;
    } catch (error) {
      console.error('[DecorationAPI] 获取布局失败:', error);
      throw error;
    }
  }

  /**
   * 保存布局草稿
   * POST /api/mobile/{factoryId}/decoration/home-layout
   */
  async saveLayout(
    factoryId: string,
    request: SaveLayoutRequest
  ): Promise<ApiResponse<SaveLayoutResponse>> {
    try {
      const response = await apiClient.post<ApiResponse<SaveLayoutResponse>>(
        `/api/mobile/${factoryId}/decoration/home-layout`,
        request
      );
      return response;
    } catch (error) {
      console.error('[DecorationAPI] 保存布局失败:', error);
      throw error;
    }
  }

  /**
   * 发布布局
   * POST /api/mobile/{factoryId}/decoration/home-layout/publish
   */
  async publishLayout(
    factoryId: string,
    request: PublishLayoutRequest
  ): Promise<ApiResponse<PublishLayoutResponse>> {
    try {
      const response = await apiClient.post<ApiResponse<PublishLayoutResponse>>(
        `/api/mobile/${factoryId}/decoration/home-layout/publish`,
        request
      );
      return response;
    } catch (error) {
      console.error('[DecorationAPI] 发布布局失败:', error);
      throw error;
    }
  }

  /**
   * 重置为默认布局
   * POST /api/mobile/{factoryId}/decoration/home-layout/reset
   */
  async resetLayout(factoryId: string): Promise<ApiResponse<BackendHomeLayoutDTO>> {
    try {
      const response = await apiClient.post<ApiResponse<BackendHomeLayoutDTO>>(
        `/api/mobile/${factoryId}/decoration/home-layout/reset`
      );
      return response;
    } catch (error) {
      console.error('[DecorationAPI] 重置布局失败:', error);
      throw error;
    }
  }
}

export const decorationApiClient = new DecorationApiClient();
export default decorationApiClient;
