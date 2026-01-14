/**
 * AI 意图配置 API
 * 对应后端 AIIntentConfigController
 */
import { get, put, patch } from './request';
import type { ApiResponse } from '@/types/api';

// ============ 类型定义 ============

/**
 * AI 意图配置
 */
export interface AIIntentConfig {
  id: string;
  factoryId?: string;
  intentCode: string;
  intentName: string;
  intentCategory: string;
  sensitivityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredRoles?: string;
  quotaCost: number;
  cacheTtlMinutes: number;
  requiresApproval: boolean;
  approvalChainId?: string;
  keywords?: string;
  negativeKeywords?: string;
  negativeKeywordPenalty: number;
  regexPattern?: string;
  description?: string;
  handlerClass?: string;
  toolName?: string;
  maxTokens: number;
  responseTemplate?: string;
  isActive: boolean;
  priority: number;
  metadata?: string;
  configVersion: number;
  previousSnapshot?: string;
  semanticDomain?: string;
  semanticAction?: string;
  semanticObject?: string;
  semanticPath?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 意图列表查询参数
 */
export interface IntentListParams {
  keyword?: string;
  category?: string;
  sensitivityLevel?: string;
  isActive?: boolean;
}

// ============ API 方法 ============

/**
 * 获取意图配置列表
 */
export function getIntentList(
  factoryId: string,
  params?: IntentListParams
): Promise<ApiResponse<AIIntentConfig[]>> {
  return get(`/${factoryId}/ai-intents`, { params });
}

/**
 * 获取所有分类
 */
export function getIntentCategories(
  factoryId: string
): Promise<ApiResponse<string[]>> {
  return get(`/${factoryId}/ai-intents/categories`);
}

/**
 * 获取意图详情
 */
export function getIntentDetail(
  factoryId: string,
  intentCode: string
): Promise<ApiResponse<AIIntentConfig>> {
  return get(`/${factoryId}/ai-intents/${intentCode}`);
}

/**
 * 按敏感度获取意图
 */
export function getIntentsBySensitivity(
  factoryId: string,
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): Promise<ApiResponse<AIIntentConfig[]>> {
  return get(`/${factoryId}/ai-intents/sensitivity/${level}`);
}

/**
 * 更新意图配置
 */
export function updateIntent(
  factoryId: string,
  intentCode: string,
  data: Partial<AIIntentConfig>
): Promise<ApiResponse<AIIntentConfig>> {
  return put(`/${factoryId}/ai-intents/${intentCode}`, data);
}

/**
 * 切换意图启用状态
 */
export function toggleIntentActive(
  factoryId: string,
  intentCode: string,
  active: boolean
): Promise<ApiResponse<AIIntentConfig>> {
  return patch(`/${factoryId}/ai-intents/${intentCode}/active`, null, {
    params: { active }
  });
}

// 扩展 patch 方法以支持 params
import request from './request';

function patch<T>(url: string, data?: object | null, config?: object): Promise<ApiResponse<T>> {
  return request.patch(url, data, config);
}
