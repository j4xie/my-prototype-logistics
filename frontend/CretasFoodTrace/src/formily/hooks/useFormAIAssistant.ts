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
}

/**
 * Hook 返回值
 */
export interface UseFormAIAssistantReturn {
  /** 使用 AI 解析文本/语音输入并填充表单 */
  parseWithAI: (userInput: string) => Promise<AIParseResult>;
  /** 使用 OCR 解析图片并填充表单 */
  parseWithOCR: (imageBase64: string) => Promise<AIParseResult>;
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
  const { formRef, entityType, schema, context, onAIFill, onError } = options;

  // 状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiFilledFields, setAIFilledFields] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<AIParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        const result: AIParseResult = {
          success: response.success,
          fieldValues: response.fieldValues,
          confidence: response.confidence,
          message: response.message,
          unparsedText: response.unparsedText,
        };

        setLastResult(result);

        if (response.success && Object.keys(response.fieldValues).length > 0) {
          // 填充表单
          fillFormWithValues(response.fieldValues);

          // 回调
          onAIFill?.(response.fieldValues, response.confidence);
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
    [entityType, formFields, context, fillFormWithValues, onAIFill, onError]
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

  return {
    parseWithAI,
    parseWithOCR,
    checkHealth,
    isProcessing,
    aiFilledFields,
    clearAIHighlight,
    lastResult,
    error,
  };
}

export default useFormAIAssistant;
