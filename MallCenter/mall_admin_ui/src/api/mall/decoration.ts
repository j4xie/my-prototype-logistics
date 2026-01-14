import { http } from "@/utils/http";
import type {
  DecorationTemplate,
  DecorationModule,
  DecorationTheme,
  MerchantPageConfig,
  AiAnalysisResult,
  DecorationQuery,
  PageResult,
  ApiResult,
  PromptTemplate,
  PromptTemplateQuery,
  KeywordMapping,
  KeywordMappingQuery,
  AiSession,
  AiSessionQuery,
  MerchantAiUsage
} from "./types/decoration";

// ==================== 模板管理 ====================

/** 获取模板分页列表 */
export const getTemplatesPage = (params: DecorationQuery) => {
  return http.request<ApiResult<PageResult<DecorationTemplate>>>(
    "get",
    "/mall/decoration/templates",
    { params }
  );
};

/** 获取模板详情 */
export const getTemplateById = (id: number) => {
  return http.request<ApiResult<DecorationTemplate>>(
    "get",
    `/mall/decoration/templates/${id}`
  );
};

/** 创建模板 */
export const createTemplate = (data: DecorationTemplate) => {
  return http.request<ApiResult<boolean>>("post", "/mall/decoration/templates", {
    data
  });
};

/** 更新模板 */
export const updateTemplate = (id: number, data: DecorationTemplate) => {
  return http.request<ApiResult<boolean>>(
    "put",
    `/mall/decoration/templates/${id}`,
    { data }
  );
};

/** 删除模板 */
export const deleteTemplate = (id: number) => {
  return http.request<ApiResult<boolean>>(
    "delete",
    `/mall/decoration/templates/${id}`
  );
};

// ==================== 模块管理 ====================

/** 获取所有模块 */
export const getModules = () => {
  return http.request<ApiResult<DecorationModule[]>>(
    "get",
    "/mall/decoration/modules"
  );
};

/** 获取模块详情 */
export const getModuleByCode = (code: string) => {
  return http.request<ApiResult<DecorationModule>>(
    "get",
    `/mall/decoration/modules/${code}`
  );
};

// ==================== 主题管理 ====================

/** 获取主题列表 */
export const getThemes = (styleTag?: string) => {
  return http.request<ApiResult<DecorationTheme[]>>(
    "get",
    "/mall/decoration/themes",
    { params: { styleTag } }
  );
};

/** 获取主题详情 */
export const getThemeByCode = (code: string) => {
  return http.request<ApiResult<DecorationTheme>>(
    "get",
    `/mall/decoration/themes/${code}`
  );
};

// ==================== 页面配置 ====================

/** 获取页面配置 */
export const getPageConfig = (merchantId?: number, pageType = "home") => {
  return http.request<ApiResult<MerchantPageConfig>>(
    "get",
    "/mall/decoration/page-config",
    { params: { merchantId, pageType } }
  );
};

/** 保存页面配置 */
export const savePageConfig = (data: MerchantPageConfig) => {
  return http.request<ApiResult<boolean>>(
    "post",
    "/mall/decoration/page-config",
    { data }
  );
};

/** 发布页面配置 */
export const publishPageConfig = (id: number) => {
  return http.request<ApiResult<boolean>>(
    "post",
    `/mall/decoration/page-config/${id}/publish`
  );
};

// ==================== AI智能装修 ====================

/** AI分析装修需求 */
export const analyzeDecoration = (prompt: string, merchantId?: number) => {
  return http.request<ApiResult<AiAnalysisResult>>(
    "post",
    "/mall/decoration/ai/analyze",
    { data: { prompt, merchantId } }
  );
};

/** 应用AI生成的配置 */
export const applyAiConfig = (sessionId: string) => {
  return http.request<ApiResult<boolean>>(
    "post",
    `/mall/decoration/ai/apply/${sessionId}`
  );
};

/** 精调AI配置 */
export const refineAiConfig = (sessionId: string, refinement: string) => {
  return http.request<ApiResult<AiAnalysisResult>>(
    "post",
    "/mall/decoration/ai/refine",
    { data: { sessionId, refinement } }
  );
};

/** 获取会话结果 */
export const getSessionResult = (sessionId: string) => {
  return http.request<ApiResult<AiAnalysisResult>>(
    "get",
    `/mall/decoration/ai/session/${sessionId}`
  );
};

// ==================== Phase 8: Prompt模板管理 ====================

/** 转换分页参数为 RuoYi 格式 */
const convertPageParams = (params: any) => {
  const { current, size, ...rest } = params;
  return {
    ...rest,
    pageNum: current || 1,
    pageSize: size || 10
  };
};

/** 获取Prompt模板分页列表 */
export const getPromptTemplatesPage = (params: PromptTemplateQuery) => {
  return http.request<ApiResult<PageResult<PromptTemplate>>>(
    "get",
    "/mall/decoration/prompt-templates",
    { params: convertPageParams(params) }
  );
};

/** 获取Prompt模板详情 */
export const getPromptTemplateById = (id: number) => {
  return http.request<ApiResult<PromptTemplate>>(
    "get",
    `/mall/decoration/prompt-templates/${id}`
  );
};

/** 创建Prompt模板 */
export const createPromptTemplate = (data: PromptTemplate) => {
  return http.request<ApiResult<boolean>>(
    "post",
    "/mall/decoration/prompt-templates",
    { data }
  );
};

/** 更新Prompt模板 */
export const updatePromptTemplate = (id: number, data: PromptTemplate) => {
  return http.request<ApiResult<boolean>>(
    "put",
    `/mall/decoration/prompt-templates/${id}`,
    { data }
  );
};

/** 删除Prompt模板 */
export const deletePromptTemplate = (id: number) => {
  return http.request<ApiResult<boolean>>(
    "delete",
    `/mall/decoration/prompt-templates/${id}`
  );
};

// ==================== 关键词映射管理 ====================

/** 获取关键词映射分页列表 */
export const getKeywordMappingsPage = (params: KeywordMappingQuery) => {
  return http.request<ApiResult<PageResult<KeywordMapping>>>(
    "get",
    "/mall/decoration/keyword-mappings",
    { params: convertPageParams(params) }
  );
};

/** 创建关键词映射 */
export const createKeywordMapping = (data: KeywordMapping) => {
  return http.request<ApiResult<boolean>>(
    "post",
    "/mall/decoration/keyword-mappings",
    { data }
  );
};

/** 更新关键词映射 */
export const updateKeywordMapping = (id: number, data: KeywordMapping) => {
  return http.request<ApiResult<boolean>>(
    "put",
    `/mall/decoration/keyword-mappings/${id}`,
    { data }
  );
};

/** 删除关键词映射 */
export const deleteKeywordMapping = (id: number) => {
  return http.request<ApiResult<boolean>>(
    "delete",
    `/mall/decoration/keyword-mappings/${id}`
  );
};

/** 批量导入关键词映射 */
export const batchImportKeywordMappings = (data: KeywordMapping[]) => {
  return http.request<ApiResult<number>>(
    "post",
    "/mall/decoration/keyword-mappings/batch",
    { data }
  );
};

// ==================== AI会话记录管理 ====================

/** 获取AI会话记录分页列表 */
export const getAiSessionsPage = (params: AiSessionQuery) => {
  return http.request<ApiResult<PageResult<AiSession>>>(
    "get",
    "/mall/decoration/ai-sessions",
    { params: convertPageParams(params) }
  );
};

/** 获取AI会话详情 */
export const getAiSessionById = (id: number) => {
  return http.request<ApiResult<AiSession>>(
    "get",
    `/mall/decoration/ai-sessions/${id}`
  );
};

/** 删除AI会话记录 */
export const deleteAiSession = (id: number) => {
  return http.request<ApiResult<boolean>>(
    "delete",
    `/mall/decoration/ai-sessions/${id}`
  );
};

// ==================== 商户AI使用统计 ====================

/** 获取商户AI使用统计列表 */
export const getMerchantAiUsageList = () => {
  return http.request<ApiResult<MerchantAiUsage[]>>(
    "get",
    "/mall/decoration/ai-usage/merchants"
  );
};

/** 获取AI使用总览统计 */
export const getAiUsageOverview = () => {
  return http.request<ApiResult<{
    totalSessions: number;
    completedSessions: number;
    appliedConfigs: number;
    avgFeedbackScore: number;
    todaySessions: number;
    weekSessions: number;
    topIndustries: Array<{ name: string; count: number }>;
    topStyles: Array<{ name: string; count: number }>;
  }>>("get", "/mall/decoration/ai-usage/overview");
};
