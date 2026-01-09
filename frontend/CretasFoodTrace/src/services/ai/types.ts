/**
 * 集中式 AI 服务 - 统一类型定义
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */

// ============ 分析模式 ============

/** 分析模式类型 */
export type AnalysisMode = 'quick' | 'deep';

/** 分析模式检测结果 */
export interface AnalysisModeResult {
  /** 是否启用深度分析 */
  enableThinking: boolean;
  /** 思考预算 (10-100) */
  thinkingBudget: number;
  /** 检测到的模式 */
  mode: AnalysisMode;
  /** 匹配的关键词 (用于调试) */
  matchedKeywords: string[];
  /** 判断理由 */
  reason: string;
}

// ============ 统一 AI 响应 ============

/** AI 服务统一返回结构 */
export interface AIResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data: T;
  /** 使用的分析模式 */
  mode: AnalysisMode;
  /** 模式检测原因 (调试用) */
  modeReason: string;
  /** 响应时间 (毫秒) */
  responseTimeMs: number;
  /** 错误信息 (失败时) */
  errorMessage?: string;
}

// ============ 意图执行 ============

/** 意图执行选项 */
export interface IntentExecuteOptions {
  /** 显式指定意图代码 (跳过识别) */
  intentCode?: string;
  /** 实体类型 */
  entityType?: string;
  /** 实体ID */
  entityId?: string;
  /** 上下文参数 */
  context?: Record<string, unknown>;
  /** 预览模式 (不实际执行) */
  previewOnly?: boolean;
  /** 强制执行 (跳过确认) */
  forceExecute?: boolean;
  /** 会话ID (多轮对话) */
  sessionId?: string;
  /** 强制指定分析模式 (覆盖自动检测) */
  forceMode?: AnalysisMode;
}

/** 意图执行请求 (内部使用) */
export interface IntentExecuteRequest {
  userInput: string;
  intentCode?: string;
  entityType?: string;
  entityId?: string;
  context?: Record<string, unknown>;
  previewOnly?: boolean;
  forceExecute?: boolean;
  sessionId?: string;
  enableThinking: boolean;
  thinkingBudget: number;
}

/** 意图执行响应 */
export interface IntentExecuteResponse {
  success: boolean;
  intentCode?: string;
  intentName?: string;
  confidence?: number;
  message?: string;
  data?: unknown;
  needsMoreInfo?: boolean;
  clarificationQuestion?: string;
  sessionId?: string;
  suggestions?: string[];
}

// ============ 成本分析 ============

/** 成本分析维度 */
export type CostAnalysisDimension = 'overall' | 'daily' | 'weekly';

/** 成本分析请求 */
export interface CostAnalysisRequest {
  /** 开始日期 (YYYY-MM-DD) */
  startDate: string;
  /** 结束日期 (YYYY-MM-DD) */
  endDate: string;
  /** 分析维度 */
  dimension?: CostAnalysisDimension;
  /** 用户问题 */
  question?: string;
  /** 强制指定分析模式 (覆盖自动检测) */
  forceMode?: AnalysisMode;
}

/** 成本分析响应 */
export interface CostAnalysisResponse {
  success: boolean;
  analysis?: string;
  summary?: {
    totalCost?: number;
    averageCost?: number;
    trend?: string;
  };
  details?: unknown;
  message?: string;
}

/** 批次成本分析请求 */
export interface BatchCostAnalysisRequest {
  /** 批次ID */
  batchId: number | string;
  /** 用户问题 */
  question?: string;
  /** 会话ID */
  sessionId?: string;
  /** 分析类型 */
  analysisType?: 'default' | 'deep' | 'comparison';
  /** 强制指定分析模式 */
  forceMode?: AnalysisMode;
}

/** 批次对比请求 */
export interface BatchComparisonRequest {
  /** 批次ID列表 (2-5个), 支持 string 或 number */
  batchIds: (string | number)[];
  /** 对比维度 */
  dimension?: 'cost' | 'efficiency' | 'quality' | 'comprehensive';
  /** 用户问题 */
  question?: string;
  /** 强制指定分析模式 */
  forceMode?: AnalysisMode;
}

// ============ SSE 流式响应 ============

/** SSE 事件类型 */
export type SSEEventType = 'start' | 'thinking' | 'content' | 'done' | 'error';

/** SSE 事件数据 */
export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  thinking?: string;
  error?: string;
  metadata?: {
    mode?: AnalysisMode;
    thinkingBudget?: number;
    startTime?: number;
  };
}

/** SSE 回调函数 */
export interface SSECallbacks {
  /** 开始事件 */
  onStart?: (metadata: SSEEvent['metadata']) => void;
  /** 思考过程 (仅深度模式) */
  onThinking?: (content: string) => void;
  /** 内容流 */
  onContent?: (content: string) => void;
  /** 完成 */
  onDone?: (fullContent: string) => void;
  /** 错误 */
  onError?: (error: string) => void;
}

// ============ 表单助手 ============

/** 表单实体类型 */
export type FormEntityType =
  | 'MATERIAL_BATCH'
  | 'PRODUCT_TYPE'
  | 'QUALITY_CHECK'
  | 'ENCODING_RULE'
  | 'FACTORY';

/** 表单助手请求 */
export interface FormAssistRequest {
  /** 用户输入 */
  userInput: string;
  /** 目标实体类型 */
  entityType: FormEntityType;
  /** 现有字段列表 */
  existingFields?: string[];
  /** 上下文数据 */
  context?: Record<string, unknown>;
  /** 强制指定分析模式 */
  forceMode?: AnalysisMode;
}

/** 表单字段建议 */
export interface FormFieldSuggestion {
  /** 字段名 */
  fieldName: string;
  /** 字段类型 */
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'array';
  /** 字段标签 */
  label: string;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  defaultValue?: unknown;
  /** 验证规则 */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  /** 选项 (select 类型) */
  options?: Array<{ label: string; value: string }>;
}

/** 表单助手响应 */
export interface FormAssistResponse {
  success: boolean;
  /** 生成的 Schema */
  schema?: Record<string, unknown>;
  /** 字段建议 */
  suggestions?: FormFieldSuggestion[];
  /** AI 解释 */
  explanation?: string;
  /** 错误信息 */
  message?: string;
}

// ============ 通用 ============

/** AI 服务配置 */
export interface AIServiceConfig {
  /** 基础 URL */
  baseUrl?: string;
  /** 默认超时 (毫秒) */
  timeout?: number;
  /** 是否启用日志 */
  enableLogging?: boolean;
  /** 默认分析模式 */
  defaultMode?: AnalysisMode;
}
