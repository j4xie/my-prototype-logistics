/**
 * 意图识别相关类型定义
 *
 * 对应后端 IntentMatchResult.java
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

/**
 * 匹配方法枚举
 */
export type IntentMatchMethod = 'REGEX' | 'KEYWORD' | 'LLM' | 'NONE';

/**
 * 候选意图
 */
export interface CandidateIntent {
  /** 意图代码 */
  intentCode: string;
  /** 意图名称 */
  intentName: string;
  /** 意图分类 */
  intentCategory: string;
  /** 置信度 (0.0 - 1.0) */
  confidence: number;
  /** 匹配分数（原始分数） */
  matchScore: number;
  /** 匹配到的关键词 */
  matchedKeywords: string[];
  /** 匹配方法 */
  matchMethod: IntentMatchMethod;
  /** 意图描述 */
  description: string;
}

/**
 * 意图匹配结果
 */
export interface IntentMatchResult {
  /** 最佳匹配的意图配置 */
  bestMatch: AIIntentConfig | null;
  /** Top-N 候选意图列表（按置信度降序） */
  topCandidates: CandidateIntent[];
  /** 最佳匹配的置信度 (0.0 - 1.0) */
  confidence: number;
  /** 匹配方法 */
  matchMethod: IntentMatchMethod;
  /** 匹配到的关键词列表 */
  matchedKeywords: string[];
  /** 是否为强信号 */
  isStrongSignal: boolean;
  /** 是否需要用户确认 */
  requiresConfirmation: boolean;
  /** 澄清问题（当需要确认时生成） */
  clarificationQuestion?: string;
  /** 原始用户输入 */
  userInput: string;
}

/**
 * AI意图配置
 */
export interface AIIntentConfig {
  id: string;
  intentCode: string;
  intentName: string;
  intentCategory: string;
  description: string;
  keywords: string[];
  regexPatterns: string[];
  priority: number;
  sensitivityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  enabled: boolean;
}

/**
 * 意图识别请求
 */
export interface IntentRecognizeRequest {
  userInput: string;
  context?: Record<string, unknown>;
}

/**
 * 意图识别响应
 */
export interface IntentRecognizeResponse {
  success: boolean;
  data: IntentMatchResult;
  message?: string;
}

/**
 * 意图选择回调
 */
export interface IntentSelectionCallbacks {
  /** 用户选择意图时触发 */
  onSelect: (intent: CandidateIntent) => void;
  /** 用户取消选择时触发 */
  onCancel?: () => void;
  /** 用户选择"其他/自定义"时触发 */
  onCustom?: (userInput: string) => void;
}

/**
 * 意图执行响应
 */
export interface IntentExecuteResponse {
  success: boolean;
  /** 执行结果数据 */
  data?: {
    /** 执行的意图代码 */
    intentCode: string;
    /** 执行结果类型 */
    resultType: 'data' | 'message' | 'navigation' | 'action';
    /** 返回数据（当 resultType 为 data 时） */
    resultData?: unknown;
    /** 消息文本（当 resultType 为 message 时） */
    message?: string;
    /** 导航目标（当 resultType 为 navigation 时） */
    navigationTarget?: string;
    /** 操作已执行的标识（当 resultType 为 action 时） */
    actionCompleted?: boolean;
  };
  message?: string;
}

/**
 * 判断是否需要用户选择候选意图
 */
export function needsCandidateSelection(result: IntentMatchResult): boolean {
  if (!result.topCandidates || result.topCandidates.length < 2) {
    return false;
  }
  const top1 = result.topCandidates[0];
  const top2 = result.topCandidates[1];
  if (!top1 || !top2) {
    return false;
  }
  // 如果 top1 和 top2 置信度差距小于 0.2，需要用户选择
  const gap = top1.confidence - top2.confidence;
  return gap < 0.2;
}

/**
 * 判断是否有匹配结果
 */
export function hasIntentMatch(result: IntentMatchResult): boolean {
  return result.bestMatch !== null && result.confidence > 0;
}

/**
 * 判断是否需要 LLM fallback
 */
export function needsLlmFallback(result: IntentMatchResult): boolean {
  return result.bestMatch === null || result.confidence < 0.3;
}
