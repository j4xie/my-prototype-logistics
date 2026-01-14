/** 装修模板 */
export interface DecorationTemplate {
  id?: number;
  name: string;
  code: string;
  description?: string;
  thumbnail?: string;
  previewUrl?: string;
  styleType: string;
  industryType?: string;
  themeConfig?: string;
  modulesConfig?: string;
  status?: number;
  isDefault?: number;
  useCount?: number;
  createTime?: string;
  updateTime?: string;
}

/** 装修模块 */
export interface DecorationModule {
  id?: number;
  name: string;
  code: string;
  moduleType: string;
  componentName?: string;
  paramsSchema?: string;
  defaultParams?: string;
  dataSourceType?: string;
  dataSourceApi?: string;
  status?: number;
  sortOrder?: number;
}

/** 主题预设 */
export interface DecorationTheme {
  id?: number;
  name: string;
  code: string;
  description?: string;
  previewImage?: string;
  colorConfig: string;
  styleTags?: string;
  industryTags?: string;
  status?: number;
  sortOrder?: number;
  useCount?: number;
}

/** 商户页面配置 */
export interface MerchantPageConfig {
  id?: number;
  merchantId: number;
  pageType: string;
  templateId?: number;
  themeConfig?: string;
  modulesConfig?: string;
  status?: number;
  publishTime?: string;
  aiGenerated?: number;
  aiPrompt?: string;
}

/** AI装修分析结果 */
export interface AiAnalysisResult {
  success: boolean;
  sessionId?: string;
  message?: string;
  industry?: string;
  style?: string;
  colorTone?: string;
  keywords?: string[];
  confidence?: number;
  recommendedThemes?: DecorationTheme[];
  bestMatchTheme?: DecorationTheme;
  recommendedModules?: ModuleConfig[];
  generatedConfig?: string;
  aiResponse?: string;
}

/** 模块配置 */
export interface ModuleConfig {
  moduleId?: number;
  moduleCode: string;
  moduleName: string;
  enabled: boolean;
  sortOrder: number;
  params?: Record<string, any>;
}

/** 查询参数 */
export interface DecorationQuery {
  name?: string;
  styleType?: string;
  industryType?: string;
  status?: number;
  current?: number;
  size?: number;
}

/** 分页结果 */
export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
}

/** API响应 */
export interface ApiResult<T> {
  code: number;
  msg: string;
  data: T;
}

// ==================== Phase 8: AI引导式装修管理 ====================

/** Prompt模板 */
export interface PromptTemplate {
  id?: number;
  name: string;
  code: string;
  industryType: string;
  imageType: string;
  styleType?: string;
  basePrompt: string;
  variablesDef?: string;
  negativePrompt?: string;
  recommendedSize?: string;
  qualityScore?: number;
  useCount?: number;
  status?: number;
  createTime?: string;
  updateTime?: string;
}

/** 关键词映射 */
export interface KeywordMapping {
  id?: number;
  keyword: string;
  mappingType: string;
  mappingValue: string;
  themeCode?: string;
  weight?: number;
  matchCount?: number;
  status?: number;
  createTime?: string;
}

/** AI会话记录 */
export interface AiSession {
  id?: number;
  sessionId: string;
  merchantId?: number;
  merchantName?: string;
  userPrompt?: string;
  aiAnalysis?: string;
  generatedConfig?: string;
  currentStep?: number;
  selectedIndustry?: string;
  selectedStyle?: string;
  selectedThemeCode?: string;
  feedbackScore?: number;
  status?: number;
  createTime?: string;
  updateTime?: string;
}

/** 商户AI使用统计 */
export interface MerchantAiUsage {
  merchantId: number;
  merchantName: string;
  totalSessions: number;
  completedSessions: number;
  appliedConfigs: number;
  avgFeedbackScore: number;
  lastUsedTime?: string;
  topIndustries?: string[];
  topStyles?: string[];
}

/** 关键词映射查询参数 */
export interface KeywordMappingQuery {
  keyword?: string;
  mappingType?: string;
  status?: number;
  current?: number;
  size?: number;
}

/** Prompt模板查询参数 */
export interface PromptTemplateQuery {
  name?: string;
  industryType?: string;
  imageType?: string;
  status?: number;
  current?: number;
  size?: number;
}

/** AI会话查询参数 */
export interface AiSessionQuery {
  merchantId?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
  current?: number;
  size?: number;
}
