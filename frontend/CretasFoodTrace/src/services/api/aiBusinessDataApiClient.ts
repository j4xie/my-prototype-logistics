/**
 * AI 业务数据初始化 API Client
 * 用于调用 AI 生成业务数据并持久化
 */

import { apiClient } from './apiClient';
import { useAuthStore } from '../../store/authStore';

// ==================== Types ====================

/**
 * 产品类型数据
 */
export interface ProductTypeData {
  code: string;
  name: string;
  category?: string;
  unit?: string;
  description?: string;
  productionTimeMinutes?: number;
  shelfLifeDays?: number;
}

/**
 * 原材料类型数据
 */
export interface MaterialTypeData {
  code: string;
  name: string;
  category?: string;
  unit?: string;
  storageType?: string;
  shelfLifeDays?: number;
  description?: string;
}

/**
 * 转换率数据
 */
export interface ConversionRateData {
  materialTypeCode: string;
  productTypeCode: string;
  rate: number;
  wastageRate?: number;
  description?: string;
}

/**
 * AI 业务数据初始化请求
 */
export interface AIBusinessDataRequest {
  productTypes?: ProductTypeData[];
  materialTypes?: MaterialTypeData[];
  conversionRates?: ConversionRateData[];
}

/**
 * 创建结果统计
 */
export interface CreationStats {
  productTypesCreated: number;
  productTypesSkipped: number;
  materialTypesCreated: number;
  materialTypesSkipped: number;
  conversionsCreated: number;
  conversionsSkipped: number;
}

/**
 * AI 业务数据初始化响应
 */
export interface AIBusinessDataResponse {
  success: boolean;
  message: string;
  stats?: CreationStats;
  createdProductTypeIds?: string[];
  createdMaterialTypeIds?: string[];
  createdConversionIds?: string[];
}

/**
 * 预览项
 */
export interface PreviewItem {
  code: string;
  name: string;
  exists: boolean;
}

/**
 * 预览响应
 */
export interface PreviewResponse {
  productTypes: PreviewItem[];
  materialTypes: PreviewItem[];
  stats: {
    totalProductTypes: number;
    totalMaterialTypes: number;
    totalConversions: number;
  };
}

/**
 * 工厂批量初始化请求 (调用 Python AI 服务)
 */
export interface FactoryBatchInitRequest {
  factoryDescription: string;
  factoryName?: string;
  industryHint?: string;
  includeBusinessData?: boolean;
}

/**
 * Schema 定义
 */
export interface EntitySchemaDefinition {
  entityType: string;
  entityName: string;
  fields: Array<{
    name: string;
    title: string;
    type: string;
    required?: boolean;
    component?: string;
    componentProps?: Record<string, unknown>;
    validators?: unknown[];
  }>;
  description?: string;
}

/**
 * 建议的业务数据
 */
export interface SuggestedBusinessData {
  productTypes: ProductTypeData[];
  materialTypes: MaterialTypeData[];
  conversionRates?: ConversionRateData[];
}

/**
 * 工厂批量初始化响应 (Python AI 服务返回)
 */
export interface FactoryBatchInitResponse {
  success: boolean;
  schemas: EntitySchemaDefinition[];
  suggestedData?: SuggestedBusinessData;
  industryCode: string;
  industryName: string;
  aiSummary?: string;
  message: string;
}

// ==================== API Functions ====================

/**
 * 获取工厂 ID
 */
function getFactoryId(): string {
  const { user } = useAuthStore.getState();
  return user?.factoryId || '';
}

/**
 * 调用 AI 批量初始化工厂 (通过 Python 服务)
 * 生成表单配置和业务数据建议
 */
export async function batchInitializeFactory(
  request: FactoryBatchInitRequest,
  factoryId?: string
): Promise<FactoryBatchInitResponse> {
  const fid = factoryId || getFactoryId();

  // 调用 Java 代理端点，Java 会转发到 Python AI 服务
  const response = await apiClient.post<{ code: number; data: FactoryBatchInitResponse; message: string; success: boolean }>(
    `/api/platform/factories/${fid}/ai-initialize`,
    {
      factory_description: request.factoryDescription,
      factory_name: request.factoryName,
      industry_hint: request.industryHint,
      include_business_data: request.includeBusinessData ?? true,
    }
  );

  return response.data;
}

/**
 * 预览业务数据
 * 检查哪些数据会被创建，哪些会被跳过
 */
export async function previewBusinessData(
  request: AIBusinessDataRequest,
  factoryId?: string
): Promise<PreviewResponse> {
  const fid = factoryId || getFactoryId();

  const response = await apiClient.post<{ code: number; data: PreviewResponse; message: string; success: boolean }>(
    `/api/mobile/${fid}/ai/business-data/preview`,
    request
  );

  return response.data;
}

/**
 * 初始化业务数据
 * 将 AI 建议的数据持久化到数据库
 */
export async function initializeBusinessData(
  request: AIBusinessDataRequest,
  factoryId?: string
): Promise<AIBusinessDataResponse> {
  const fid = factoryId || getFactoryId();

  const response = await apiClient.post<{ code: number; data: AIBusinessDataResponse; message: string; success: boolean }>(
    `/api/mobile/${fid}/ai/business-data/initialize`,
    request
  );

  return response.data;
}

/**
 * 一键初始化: AI 生成 + 持久化
 * 便捷方法，结合 batchInitializeFactory 和 initializeBusinessData
 */
export async function oneClickInitialize(
  description: string,
  factoryName?: string,
  industryHint?: string,
  factoryId?: string
): Promise<{
  aiResponse: FactoryBatchInitResponse;
  initResult?: AIBusinessDataResponse;
}> {
  const fid = factoryId || getFactoryId();

  // 1. 调用 AI 生成配置和建议
  const aiResponse = await batchInitializeFactory({
    factoryDescription: description,
    factoryName,
    industryHint,
    includeBusinessData: true,
  }, fid);

  // 2. 如果有建议的业务数据，持久化它
  if (aiResponse.success && aiResponse.suggestedData) {
    const initResult = await initializeBusinessData({
      productTypes: aiResponse.suggestedData.productTypes,
      materialTypes: aiResponse.suggestedData.materialTypes,
      conversionRates: aiResponse.suggestedData.conversionRates,
    }, fid);

    return { aiResponse, initResult };
  }

  return { aiResponse };
}

// 默认导出
const aiBusinessDataApi = {
  batchInitializeFactory,
  previewBusinessData,
  initializeBusinessData,
  oneClickInitialize,
};

export default aiBusinessDataApi;
