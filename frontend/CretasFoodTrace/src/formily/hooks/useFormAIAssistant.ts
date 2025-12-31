/**
 * AI 表单助手 Hook
 *
 * 提供 AI 辅助表单填写功能:
 * - 语音/文本输入 → AI 解析 → 表单自动填充
 * - 图片 OCR → 结构化数据 → 表单自动填充
 * - 高亮显示 AI 填充的字段
 *
 * @example
 * ```tsx
 * const formRef = useRef<DynamicFormRef>(null);
 * const {
 *   parseWithAI,
 *   parseWithOCR,
 *   isProcessing,
 *   aiFilledFields,
 *   clearAIHighlight,
 * } = useFormAIAssistant({
 *   formRef,
 *   entityType: EntityType.MATERIAL_BATCH,
 *   schema: materialBatchSchema,
 * });
 *
 * // 用户说: "帮我填一个带鱼批次，500公斤，温度-20度"
 * await parseWithAI("帮我填一个带鱼批次，500公斤，温度-20度");
 * // 表单自动填充，aiFilledFields 包含 AI 填充的字段名
 * ```
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */

import { useState, useCallback, useMemo, RefObject } from 'react';
import {
  formAssistantApiClient,
  FormParseRequest,
  FormParseResponse,
  OCRParseRequest,
  OCRParseResponse,
  FormFieldDefinition,
  ValidationError,
  ValidationFeedbackRequest,
  ValidationFeedbackResponse,
} from '../../services/api/formAssistantApiClient';
import { EntityType } from '../../services/api/formTemplateApiClient';
import type { DynamicFormRef, FormSchema } from '../core/DynamicForm';

// ========== 类型定义 ==========

/**
 * Hook 配置选项
 */
export interface UseFormAIAssistantOptions {
  /** 表单引用 */
  formRef: RefObject<DynamicFormRef | null>;
  /** 实体类型 */
  entityType: EntityType;
  /** 表单 Schema (用于提取字段定义) */
  schema?: FormSchema;
  /** 上下文信息 (如常用供应商、默认值等) */
  context?: Record<string, unknown>;
  /** AI 填充后的回调 */
  onAIFill?: (fieldValues: Record<string, unknown>, confidence: number) => void;
  /** 解析失败的回调 */
  onError?: (error: string) => void;
  /**
   * P1-1: 缺失必填字段的回调
   * 当 AI 解析成功但检测到缺失必填字段时触发
   * @param missingFields 缺失的字段名列表
   * @param suggestedQuestions AI 生成的追问列表
   * @param followUpQuestion 主要追问问题
   */
  onMissingFields?: (
    missingFields: string[],
    suggestedQuestions: string[],
    followUpQuestion?: string
  ) => void;
}

/**
 * AI 解析结果
 */
export interface AIParseResult {
  /** 是否成功 */
  success: boolean;
  /** 解析出的字段值 */
  fieldValues: Record<string, unknown>;
  /** 置信度 (0-1) */
  confidence: number;
  /** 消息/提示 */
  message?: string;
  /** 无法解析的文本 */
  unparsedText?: string;
  /** OCR 提取的原始文本 (仅 OCR 解析时) */
  extractedText?: string;

  // P1-1: 缺字段自动追问
  /** 缺失的必填字段名列表 */
  missingRequiredFields?: string[];
  /** AI生成的追问问题列表 */
  suggestedQuestions?: string[];
  /** 主要追问问题 (便于简单场景使用) */
  followUpQuestion?: string;
  /** 是否需要用户补充信息 */
  needsFollowUp?: boolean;
}

/**
 * 校验修正结果
 * 当表单校验失败时，AI 返回的修正建议
 */
export interface ValidationCorrectionResult {
  /** 是否成功获取修正建议 */
  success: boolean;
  /** 字段修正提示 (field -> hint) */
  correctionHints?: Record<string, string>;
  /** 修正后的值 (field -> correctedValue) */
  correctedValues?: Record<string, unknown>;
  /** AI 解释说明 */
  explanation?: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 会话ID (用于多轮对话) */
  sessionId?: string;
  /** 消息 */
  message?: string;
}

/**
 * Hook 返回值
 */
export interface UseFormAIAssistantReturn {
  /** 使用 AI 解析文本/语音输入并填充表单 */
  parseWithAI: (userInput: string) => Promise<AIParseResult>;
  /** 使用 OCR 解析图片并填充表单 */
  parseWithOCR: (imageBase64: string) => Promise<AIParseResult>;
  /** 处理表单校验错误，获取 AI 修正建议 */
  handleValidationError: (
    errors: ValidationError[],
    submittedValues: Record<string, unknown>,
    userInstruction?: string
  ) => Promise<ValidationCorrectionResult>;
  /** 检查 AI 服务健康状态 */
  checkHealth: () => Promise<boolean>;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** AI 填充的字段名列表 */
  aiFilledFields: string[];
  /** 清除 AI 高亮标记 */
  clearAIHighlight: () => void;
  /** 最后一次解析结果 */
  lastResult: AIParseResult | null;
  /** 最后一次校验修正结果 */
  lastValidationResult: ValidationCorrectionResult | null;
  /** 当前校验会话ID (用于多轮对话) */
  validationSessionId: string | null;
  /** 清除校验会话 */
  clearValidationSession: () => void;
  /** 错误信息 */
  error: string | null;
}

// ========== Hook 实现 ==========

/**
 * AI 表单助手 Hook
 */
export function useFormAIAssistant(
  options: UseFormAIAssistantOptions
): UseFormAIAssistantReturn {
  const { formRef, entityType, schema, context, onAIFill, onError, onMissingFields } = options;

  // 状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiFilledFields, setAIFilledFields] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<AIParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 校验修正相关状态 (Phase 1.2)
  const [lastValidationResult, setLastValidationResult] = useState<ValidationCorrectionResult | null>(null);
  const [validationSessionId, setValidationSessionId] = useState<string | null>(null);

  // 从 Schema 提取字段定义
  const formFields = useMemo<FormFieldDefinition[] | undefined>(() => {
    if (!schema) return undefined;
    return formAssistantApiClient.extractFieldsFromSchema(schema);
  }, [schema]);

  /**
   * 将 AI 解析结果填充到表单
   */
  const fillFormWithValues = useCallback(
    (fieldValues: Record<string, unknown>) => {
      if (!formRef.current) {
        console.warn('[useFormAIAssistant] formRef.current is null');
        return;
      }

      const filledFields: string[] = [];

      // 逐个字段填充
      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        if (value !== undefined && value !== null) {
          try {
            formRef.current?.setFieldValue(fieldName, value);
            filledFields.push(fieldName);
          } catch (err) {
            console.warn(`[useFormAIAssistant] 无法设置字段 ${fieldName}:`, err);
          }
        }
      });

      // 记录 AI 填充的字段
      setAIFilledFields((prev) => [...new Set([...prev, ...filledFields])]);

      console.log('[useFormAIAssistant] AI 填充字段:', filledFields);
    },
    [formRef]
  );

  /**
   * 使用 AI 解析文本/语音输入
   */
  const parseWithAI = useCallback(
    async (userInput: string): Promise<AIParseResult> => {
      if (!userInput.trim()) {
        const result: AIParseResult = {
          success: false,
          fieldValues: {},
          confidence: 0,
          message: '输入不能为空',
        };
        setLastResult(result);
        return result;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const request: FormParseRequest = {
          userInput,
          entityType,
          formFields,
          context,
        };

        console.log('[useFormAIAssistant] 发送 AI 解析请求:', {
          entityType,
          inputLength: userInput.length,
          fieldCount: formFields?.length ?? 0,
        });

        const response: FormParseResponse =
          await formAssistantApiClient.parseFormInput(request);

        // P1-1: 检测是否需要追问
        const hasMissingFields = response.missingRequiredFields && response.missingRequiredFields.length > 0;
        const needsFollowUp = hasMissingFields ?? false;

        const result: AIParseResult = {
          success: response.success,
          fieldValues: response.fieldValues,
          confidence: response.confidence,
          message: response.message,
          unparsedText: response.unparsedText,
          // P1-1: 缺字段自动追问
          missingRequiredFields: response.missingRequiredFields,
          suggestedQuestions: response.suggestedQuestions,
          followUpQuestion: response.followUpQuestion,
          needsFollowUp,
        };

        setLastResult(result);

        if (response.success && Object.keys(response.fieldValues).length > 0) {
          // 填充表单
          fillFormWithValues(response.fieldValues);

          // 回调
          onAIFill?.(response.fieldValues, response.confidence);

          // P1-1: 如果有缺失字段，触发回调
          if (needsFollowUp && response.missingRequiredFields && response.suggestedQuestions) {
            console.log('[useFormAIAssistant] 检测到缺失必填字段:', response.missingRequiredFields);
            console.log('[useFormAIAssistant] 追问建议:', response.suggestedQuestions);
            onMissingFields?.(
              response.missingRequiredFields,
              response.suggestedQuestions,
              response.followUpQuestion
            );
          }
        } else if (!response.success) {
          setError(response.message || 'AI 解析失败');
          onError?.(response.message || 'AI 解析失败');
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'AI 服务不可用';
        console.error('[useFormAIAssistant] AI 解析错误:', err);

        const result: AIParseResult = {
          success: false,
          fieldValues: {},
          confidence: 0,
          message: errorMessage,
        };

        setLastResult(result);
        setError(errorMessage);
        onError?.(errorMessage);

        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [entityType, formFields, context, fillFormWithValues, onAIFill, onError, onMissingFields]
  );

  /**
   * 使用 OCR 解析图片
   */
  const parseWithOCR = useCallback(
    async (imageBase64: string): Promise<AIParseResult> => {
      if (!imageBase64) {
        const result: AIParseResult = {
          success: false,
          fieldValues: {},
          confidence: 0,
          message: '图片不能为空',
        };
        setLastResult(result);
        return result;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const request: OCRParseRequest = {
          imageBase64,
          entityType,
          formFields,
        };

        console.log('[useFormAIAssistant] 发送 OCR 解析请求:', {
          entityType,
          imageSize: imageBase64.length,
          fieldCount: formFields?.length ?? 0,
        });

        const response: OCRParseResponse =
          await formAssistantApiClient.parseFormOCR(request);

        const result: AIParseResult = {
          success: response.success,
          fieldValues: response.fieldValues,
          confidence: response.confidence,
          message: response.message,
          extractedText: response.extractedText,
        };

        setLastResult(result);

        if (response.success && Object.keys(response.fieldValues).length > 0) {
          // 填充表单
          fillFormWithValues(response.fieldValues);

          // 回调
          onAIFill?.(response.fieldValues, response.confidence);
        } else if (!response.success) {
          setError(response.message || 'OCR 解析失败');
          onError?.(response.message || 'OCR 解析失败');
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'OCR 服务不可用';
        console.error('[useFormAIAssistant] OCR 解析错误:', err);

        const result: AIParseResult = {
          success: false,
          fieldValues: {},
          confidence: 0,
          message: errorMessage,
        };

        setLastResult(result);
        setError(errorMessage);
        onError?.(errorMessage);

        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [entityType, formFields, fillFormWithValues, onAIFill, onError]
  );

  /**
   * 检查 AI 服务健康状态
   */
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await formAssistantApiClient.checkHealth();
      return response.available;
    } catch (err) {
      console.warn('[useFormAIAssistant] 健康检查失败:', err);
      return false;
    }
  }, []);

  /**
   * 清除 AI 高亮标记
   */
  const clearAIHighlight = useCallback(() => {
    setAIFilledFields([]);
  }, []);

  /**
   * 处理表单校验错误，获取 AI 修正建议 (Phase 1.2)
   *
   * 当表单校验失败时，将错误信息发送给 AI，获取修正建议
   * AI 会分析错误原因并提供字段修正值
   *
   * @param errors 校验错误列表
   * @param submittedValues 用户提交的值
   * @param userInstruction 用户补充说明 (可选)
   * @returns AI 修正建议
   */
  const handleValidationError = useCallback(
    async (
      errors: ValidationError[],
      submittedValues: Record<string, unknown>,
      userInstruction?: string
    ): Promise<ValidationCorrectionResult> => {
      if (errors.length === 0) {
        const result: ValidationCorrectionResult = {
          success: false,
          confidence: 0,
          message: '没有校验错误需要处理',
        };
        setLastValidationResult(result);
        return result;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const request: ValidationFeedbackRequest = {
          sessionId: validationSessionId ?? undefined,
          entityType,
          formFields,
          submittedValues,
          validationErrors: errors,
          userInstruction,
        };

        console.log('[useFormAIAssistant] 发送校验反馈请求:', {
          entityType,
          errorCount: errors.length,
          hasSessionId: !!validationSessionId,
          hasUserInstruction: !!userInstruction,
        });

        const response: ValidationFeedbackResponse =
          await formAssistantApiClient.submitValidationFeedback(request);

        const result: ValidationCorrectionResult = {
          success: response.success,
          correctionHints: response.correctionHints,
          correctedValues: response.correctedValues,
          explanation: response.explanation,
          confidence: response.confidence,
          sessionId: response.sessionId,
          message: response.message,
        };

        setLastValidationResult(result);

        // 更新会话 ID (用于多轮对话)
        if (response.sessionId) {
          setValidationSessionId(response.sessionId);
        }

        if (!response.success) {
          setError(response.message || 'AI 修正建议获取失败');
          onError?.(response.message || 'AI 修正建议获取失败');
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'AI 服务不可用';
        console.error('[useFormAIAssistant] 校验反馈错误:', err);

        const result: ValidationCorrectionResult = {
          success: false,
          confidence: 0,
          message: errorMessage,
        };

        setLastValidationResult(result);
        setError(errorMessage);
        onError?.(errorMessage);

        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [entityType, formFields, validationSessionId, onError]
  );

  /**
   * 清除校验会话 (Phase 1.2)
   *
   * 重置校验会话状态，开始新的校验对话
   */
  const clearValidationSession = useCallback(() => {
    setValidationSessionId(null);
    setLastValidationResult(null);
  }, []);

  return {
    parseWithAI,
    parseWithOCR,
    handleValidationError,
    checkHealth,
    isProcessing,
    aiFilledFields,
    clearAIHighlight,
    lastResult,
    lastValidationResult,
    validationSessionId,
    clearValidationSession,
    error,
  };
}

export default useFormAIAssistant;
