/**
 * 意图执行 Hook - 封装完整的意图执行流程 + 澄清问题处理
 *
 * 功能:
 * 1. 调用 executeIntent API
 * 2. 自动拦截 NEED_MORE_INFO 响应
 * 3. 显示 ClarificationDialog 收集缺失参数
 * 4. 自动重试执行
 *
 * @example
 * ```tsx
 * const MyScreen = () => {
 *   const { executeIntent, isExecuting, ClarificationDialog } = useIntentExecution();
 *
 *   const handleVoiceCommand = async (userInput: string) => {
 *     const result = await executeIntent({ userInput, deviceId: 'device-001' });
 *     if (result.success) {
 *       Alert.alert('成功', result.message);
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <Button onPress={() => handleVoiceCommand('查询批次详情')} />
 *       <ClarificationDialog />
 *     </>
 *   );
 * };
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { aiApiClient } from '../services/api/aiApiClient';
import { ClarificationDialog, ClarificationDialogProps } from '../components/ai/ClarificationDialog';
import type { IntentExecuteRequest, IntentExecuteResponse, MissingParameter } from '../types/intent';

interface UseIntentExecutionOptions {
  /** 自动处理澄清问题 (默认 true) */
  autoHandleClarification?: boolean;
  /** 最大重试次数 (默认 3) */
  maxRetries?: number;
  /** 执行成功回调 */
  onSuccess?: (response: IntentExecuteResponse) => void;
  /** 执行失败回调 */
  onError?: (error: string) => void;
  /** 需要澄清时的回调 (返回 false 可阻止自动显示对话框) */
  onClarificationNeeded?: (questions: string[], params?: MissingParameter[]) => boolean;
}

interface UseIntentExecutionReturn {
  /** 执行意图 */
  executeIntent: (request: Omit<IntentExecuteRequest, 'factoryId'>) => Promise<IntentExecuteResponse | null>;
  /** 是否正在执行 */
  isExecuting: boolean;
  /** 最后一次执行结果 */
  lastResponse: IntentExecuteResponse | null;
  /** 澄清对话框组件 (需要渲染在界面中) */
  ClarificationDialog: React.FC;
  /** 手动重置状态 */
  reset: () => void;
}

export function useIntentExecution(options: UseIntentExecutionOptions = {}): UseIntentExecutionReturn {
  const {
    autoHandleClarification = true,
    maxRetries = 3,
    onSuccess,
    onError,
    onClarificationNeeded,
  } = options;

  // 状态
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResponse, setLastResponse] = useState<IntentExecuteResponse | null>(null);
  const [showClarificationDialog, setShowClarificationDialog] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [missingParameters, setMissingParameters] = useState<MissingParameter[] | undefined>();
  const [pendingRequest, setPendingRequest] = useState<Omit<IntentExecuteRequest, 'factoryId'> | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * 执行意图 (核心方法)
   */
  const executeIntent = useCallback(async (
    request: Omit<IntentExecuteRequest, 'factoryId'>
  ): Promise<IntentExecuteResponse | null> => {
    setIsExecuting(true);

    try {
      console.log('[useIntentExecution] 执行意图:', request);

      // 调用 API
      const response = await aiApiClient.executeIntent(request);
      setLastResponse(response);

      console.log('[useIntentExecution] 响应状态:', response.status);

      // 检查是否需要更多信息
      if (response.status === 'NEED_MORE_INFO' && autoHandleClarification) {
        const { clarificationQuestions: questions, missingParameters: params } = response;

        if (questions && questions.length > 0) {
          console.log('[useIntentExecution] 需要澄清问题:', questions);

          // 通知外部 (可选)
          const shouldShow = onClarificationNeeded?.(questions, params) ?? true;

          if (shouldShow) {
            // 保存当前请求用于重试
            setPendingRequest(request);
            setClarificationQuestions(questions);
            setMissingParameters(params);
            setShowClarificationDialog(true);
            setIsExecuting(false);
            return null; // 等待用户补充信息
          }
        }
      }

      // 检查是否成功
      if (response.success) {
        console.log('[useIntentExecution] 执行成功');
        setRetryCount(0);
        onSuccess?.(response);
      } else if (response.status === 'ERROR') {
        console.error('[useIntentExecution] 执行失败:', response.message);
        onError?.(response.message || '执行失败');
      }

      setIsExecuting(false);
      return response;

    } catch (error) {
      console.error('[useIntentExecution] API 调用失败:', error);
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      onError?.(errorMessage);
      setIsExecuting(false);
      return null;
    }
  }, [autoHandleClarification, onSuccess, onError, onClarificationNeeded]);

  /**
   * 处理澄清对话框提交
   */
  const handleClarificationSubmit = useCallback(async (answers: Record<string, any>) => {
    console.log('[useIntentExecution] 用户补充答案:', answers);

    if (!pendingRequest) {
      console.error('[useIntentExecution] 没有待重试的请求');
      return;
    }

    // 检查重试次数
    if (retryCount >= maxRetries) {
      Alert.alert('提示', '已达到最大重试次数，请重新输入');
      setShowClarificationDialog(false);
      setRetryCount(0);
      return;
    }

    setShowClarificationDialog(false);
    setRetryCount(prev => prev + 1);

    // 合并答案到请求参数
    const retryRequest: Omit<IntentExecuteRequest, 'factoryId'> = {
      ...pendingRequest,
      parameters: {
        ...(pendingRequest.parameters || {}),
        ...answers,
      },
    };

    console.log('[useIntentExecution] 重试请求:', retryRequest);

    // 重新执行
    await executeIntent(retryRequest);
  }, [pendingRequest, retryCount, maxRetries, executeIntent]);

  /**
   * 处理澄清对话框取消
   */
  const handleClarificationCancel = useCallback(() => {
    console.log('[useIntentExecution] 用户取消澄清');
    setShowClarificationDialog(false);
    setPendingRequest(null);
    setRetryCount(0);
    setIsExecuting(false);
  }, []);

  /**
   * 手动重置状态
   */
  const reset = useCallback(() => {
    setIsExecuting(false);
    setLastResponse(null);
    setShowClarificationDialog(false);
    setClarificationQuestions([]);
    setMissingParameters(undefined);
    setPendingRequest(null);
    setRetryCount(0);
  }, []);

  /**
   * 澄清对话框组件 (需要渲染)
   */
  const ClarificationDialogComponent: React.FC = useCallback(() => {
    return (
      <ClarificationDialog
        visible={showClarificationDialog}
        questions={clarificationQuestions}
        missingParameters={missingParameters}
        onSubmit={handleClarificationSubmit}
        onCancel={handleClarificationCancel}
      />
    );
  }, [
    showClarificationDialog,
    clarificationQuestions,
    missingParameters,
    handleClarificationSubmit,
    handleClarificationCancel,
  ]);

  return {
    executeIntent,
    isExecuting,
    lastResponse,
    ClarificationDialog: ClarificationDialogComponent,
    reset,
  };
}
