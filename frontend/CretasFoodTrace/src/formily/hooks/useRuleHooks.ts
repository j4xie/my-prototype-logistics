/**
 * useRuleHooks - 规则 Hook 触发机制
 *
 * 在 DynamicForm 生命周期中触发 RuleEventBinding 规则
 * 支持的 Hook 点:
 * - beforeCreate: 创建前（改默认值、补字段、编码）
 * - beforeSubmit: 提交前（复杂校验、合规检查）
 * - afterSubmit: 提交后（自动生成下游任务/通知）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */

import { useState, useCallback, useEffect, useMemo, RefObject } from 'react';
import { ruleConfigApiClient, RuleGroup, EntityType } from '../../services/api/ruleConfigApiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { DynamicFormRef } from '../core/DynamicForm';

// ==================== 类型定义 ====================

/**
 * Hook 点类型
 */
export type HookPoint =
  | 'beforeCreate'
  | 'beforeSubmit'
  | 'afterSubmit'
  | 'beforeTransition'
  | 'afterTransition';

/**
 * 规则绑定配置
 */
export interface RuleEventBinding {
  id: string;
  factoryId: string;
  entityType: EntityType;
  eventName: HookPoint;
  ruleGroup: RuleGroup;
  ruleIds: string[];
  enabled: boolean;
  priority: number;
  description?: string;
}

/**
 * 规则执行结果
 */
export interface RuleExecutionResult {
  success: boolean;
  hookPoint: HookPoint;
  rulesExecuted: number;
  results: RuleResult[];
  message: string;
  modifiedValues?: Record<string, unknown>;
  validationErrors?: string[];
  warnings?: string[];
}

/**
 * 单条规则结果
 */
export interface RuleResult {
  ruleId: string;
  ruleName: string;
  success: boolean;
  result: unknown;
  message?: string;
}

/**
 * Hook 选项
 */
export interface UseRuleHooksOptions {
  /**
   * 表单引用
   */
  formRef: RefObject<DynamicFormRef | null>;

  /**
   * 实体类型
   */
  entityType: EntityType;

  /**
   * 工厂 ID（可选，默认从上下文获取）
   */
  factoryId?: string;

  /**
   * 是否启用规则 Hook
   */
  enabled?: boolean;

  /**
   * 规则执行前回调
   */
  onBeforeExecute?: (hookPoint: HookPoint, data: Record<string, unknown>) => void;

  /**
   * 规则执行后回调
   */
  onAfterExecute?: (result: RuleExecutionResult) => void;

  /**
   * 值被规则修改时回调
   */
  onValuesModified?: (modifiedValues: Record<string, unknown>) => void;

  /**
   * 验证失败回调
   */
  onValidationError?: (errors: string[]) => void;

  /**
   * 错误回调
   */
  onError?: (error: string) => void;
}

/**
 * Hook 返回值
 */
export interface UseRuleHooksReturn {
  /**
   * 执行 beforeCreate Hook
   */
  executeBeforeCreate: (initialValues?: Record<string, unknown>) => Promise<RuleExecutionResult>;

  /**
   * 执行 beforeSubmit Hook
   */
  executeBeforeSubmit: (values: Record<string, unknown>) => Promise<RuleExecutionResult>;

  /**
   * 执行 afterSubmit Hook
   */
  executeAfterSubmit: (values: Record<string, unknown>, submitResult?: unknown) => Promise<RuleExecutionResult>;

  /**
   * 执行 beforeTransition Hook
   */
  executeBeforeTransition: (
    currentState: string,
    targetState: string,
    data: Record<string, unknown>
  ) => Promise<RuleExecutionResult>;

  /**
   * 执行 afterTransition Hook
   */
  executeAfterTransition: (
    previousState: string,
    currentState: string,
    data: Record<string, unknown>
  ) => Promise<RuleExecutionResult>;

  /**
   * 是否正在执行规则
   */
  isExecuting: boolean;

  /**
   * 最后一次执行结果
   */
  lastResult: RuleExecutionResult | null;

  /**
   * 错误信息
   */
  error: string | null;

  /**
   * 已加载的规则绑定
   */
  bindings: RuleEventBinding[];

  /**
   * 是否已加载绑定
   */
  isLoaded: boolean;

  /**
   * 重新加载规则绑定
   */
  reloadBindings: () => Promise<void>;
}

// ==================== 主 Hook ====================

/**
 * useRuleHooks - 规则 Hook 触发机制
 *
 * @example
 * ```tsx
 * const formRef = useRef<DynamicFormRef>(null);
 *
 * const {
 *   executeBeforeSubmit,
 *   executeAfterSubmit,
 *   isExecuting,
 *   error
 * } = useRuleHooks({
 *   formRef,
 *   entityType: 'ProcessingBatch',
 *   onValuesModified: (values) => {
 *     formRef.current?.setValues(values);
 *   },
 *   onValidationError: (errors) => {
 *     Alert.alert('验证失败', errors.join('\n'));
 *   }
 * });
 *
 * const handleSubmit = async (values) => {
 *   // 提交前执行规则
 *   const beforeResult = await executeBeforeSubmit(values);
 *   if (!beforeResult.success) {
 *     return; // 规则验证失败，阻止提交
 *   }
 *
 *   // 使用可能被规则修改的值
 *   const finalValues = beforeResult.modifiedValues || values;
 *   await api.submit(finalValues);
 *
 *   // 提交后执行规则（异步，不阻塞）
 *   executeAfterSubmit(finalValues);
 * };
 * ```
 */
export function useRuleHooks(options: UseRuleHooksOptions): UseRuleHooksReturn {
  const {
    formRef,
    entityType,
    factoryId: propFactoryId,
    enabled = true,
    onBeforeExecute,
    onAfterExecute,
    onValuesModified,
    onValidationError,
    onError,
  } = options;

  // ==================== 状态 ====================

  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<RuleExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bindings, setBindings] = useState<RuleEventBinding[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // ==================== 获取 factoryId ====================

  const factoryId = useMemo(() => {
    return propFactoryId || getCurrentFactoryId();
  }, [propFactoryId]);

  // ==================== 加载规则绑定 ====================

  const loadBindings = useCallback(async () => {
    if (!enabled || !factoryId) {
      setBindings([]);
      setIsLoaded(true);
      return;
    }

    try {
      // 注意: 后端目前可能没有专门的 bindings 端点
      // 这里使用 getRulesByGroup 获取相关规则作为替代
      // TODO: 后端需要实现 /rules/bindings?entityType=xxx 端点

      const allBindings: RuleEventBinding[] = [];

      // 尝试获取各类规则组
      const ruleGroups: RuleGroup[] = ['validation', 'workflow', 'quality', 'alert'];

      for (const group of ruleGroups) {
        try {
          const rules = await ruleConfigApiClient.getRulesByGroup(group, factoryId);

          // 将规则转换为绑定格式
          // 这是临时方案，正式实现应该从后端获取 RuleEventBinding
          if (rules.length > 0) {
            // 根据规则组推断 hook 点
            const hookPoint = mapRuleGroupToHookPoint(group);
            if (hookPoint) {
              allBindings.push({
                id: `${entityType}-${group}`,
                factoryId,
                entityType,
                eventName: hookPoint,
                ruleGroup: group,
                ruleIds: rules.filter(r => r.enabled).map(r => r.id),
                enabled: true,
                priority: 10,
                description: `${group} rules for ${entityType}`,
              });
            }
          }
        } catch {
          // 忽略单个规则组加载失败
          console.warn(`Failed to load ${group} rules`);
        }
      }

      setBindings(allBindings);
      setIsLoaded(true);
      setError(null);
    } catch (err) {
      console.error('加载规则绑定失败:', err);
      setError('加载规则绑定失败');
      setBindings([]);
      setIsLoaded(true);
      onError?.('加载规则绑定失败');
    }
  }, [enabled, factoryId, entityType, onError]);

  // ==================== 初始化加载 ====================

  useEffect(() => {
    loadBindings();
  }, [loadBindings]);

  // ==================== 执行规则 ====================

  const executeRules = useCallback(
    async (
      hookPoint: HookPoint,
      data: Record<string, unknown>,
      context?: Record<string, unknown>
    ): Promise<RuleExecutionResult> => {
      // 如果未启用或未加载，返回空结果
      if (!enabled) {
        return {
          success: true,
          hookPoint,
          rulesExecuted: 0,
          results: [],
          message: '规则未启用',
        };
      }

      // 查找匹配的绑定
      const matchingBindings = bindings.filter(
        b => b.eventName === hookPoint && b.enabled
      );

      if (matchingBindings.length === 0) {
        return {
          success: true,
          hookPoint,
          rulesExecuted: 0,
          results: [],
          message: `无 ${hookPoint} 规则绑定`,
        };
      }

      setIsExecuting(true);
      setError(null);

      try {
        // 触发执行前回调
        onBeforeExecute?.(hookPoint, data);

        const allResults: RuleResult[] = [];
        let modifiedValues = { ...data };
        const validationErrors: string[] = [];
        const warnings: string[] = [];
        let overallSuccess = true;

        // 按优先级排序并执行
        const sortedBindings = [...matchingBindings].sort(
          (a, b) => a.priority - b.priority
        );

        for (const binding of sortedBindings) {
          for (const ruleId of binding.ruleIds) {
            try {
              // 调用后端测试规则（或执行规则）
              const testData = {
                ...modifiedValues,
                ...context,
                __hookPoint: hookPoint,
                __entityType: entityType,
              };

              const result = await ruleConfigApiClient.testRule(
                ruleId,
                testData,
                factoryId
              );

              const ruleResult: RuleResult = {
                ruleId,
                ruleName: ruleId, // TODO: 从规则详情获取名称
                success: result.success,
                result: result.results,
                message: result.message,
              };

              allResults.push(ruleResult);

              if (!result.success) {
                overallSuccess = false;

                // 提取验证错误
                if (result.message) {
                  validationErrors.push(result.message);
                }
              }

              // 检查规则是否修改了值
              if (result.results && Array.isArray(result.results)) {
                for (const r of result.results) {
                  if (r && typeof r === 'object' && 'modifiedFields' in r) {
                    const modified = (r as { modifiedFields: Record<string, unknown> }).modifiedFields;
                    modifiedValues = { ...modifiedValues, ...modified };
                  }
                  if (r && typeof r === 'object' && 'warning' in r) {
                    warnings.push(String((r as { warning: string }).warning));
                  }
                }
              }
            } catch (ruleError) {
              console.error(`规则 ${ruleId} 执行失败:`, ruleError);

              allResults.push({
                ruleId,
                ruleName: ruleId,
                success: false,
                result: null,
                message: ruleError instanceof Error ? ruleError.message : '规则执行失败',
              });

              // validation 规则失败应阻止提交
              if (binding.ruleGroup === 'validation') {
                overallSuccess = false;
                validationErrors.push(
                  ruleError instanceof Error ? ruleError.message : '验证规则执行失败'
                );
              }
            }
          }
        }

        // 构建最终结果
        const executionResult: RuleExecutionResult = {
          success: overallSuccess,
          hookPoint,
          rulesExecuted: allResults.length,
          results: allResults,
          message: overallSuccess
            ? `成功执行 ${allResults.length} 条规则`
            : `${validationErrors.length} 条规则验证失败`,
          modifiedValues:
            JSON.stringify(modifiedValues) !== JSON.stringify(data)
              ? modifiedValues
              : undefined,
          validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
        };

        setLastResult(executionResult);

        // 触发回调
        onAfterExecute?.(executionResult);

        if (executionResult.modifiedValues) {
          onValuesModified?.(executionResult.modifiedValues);
        }

        if (executionResult.validationErrors && executionResult.validationErrors.length > 0) {
          onValidationError?.(executionResult.validationErrors);
        }

        return executionResult;
      } catch (err) {
        console.error(`${hookPoint} 规则执行失败:`, err);
        const errorMessage = err instanceof Error ? err.message : '规则执行失败';
        setError(errorMessage);
        onError?.(errorMessage);

        const failResult: RuleExecutionResult = {
          success: false,
          hookPoint,
          rulesExecuted: 0,
          results: [],
          message: errorMessage,
          validationErrors: [errorMessage],
        };

        setLastResult(failResult);
        return failResult;
      } finally {
        setIsExecuting(false);
      }
    },
    [
      enabled,
      bindings,
      entityType,
      factoryId,
      onBeforeExecute,
      onAfterExecute,
      onValuesModified,
      onValidationError,
      onError,
    ]
  );

  // ==================== Hook 点方法 ====================

  const executeBeforeCreate = useCallback(
    async (initialValues: Record<string, unknown> = {}): Promise<RuleExecutionResult> => {
      return executeRules('beforeCreate', initialValues, {
        isNew: true,
      });
    },
    [executeRules]
  );

  const executeBeforeSubmit = useCallback(
    async (values: Record<string, unknown>): Promise<RuleExecutionResult> => {
      return executeRules('beforeSubmit', values, {
        formRef: formRef.current,
      });
    },
    [executeRules, formRef]
  );

  const executeAfterSubmit = useCallback(
    async (
      values: Record<string, unknown>,
      submitResult?: unknown
    ): Promise<RuleExecutionResult> => {
      return executeRules('afterSubmit', values, {
        submitResult,
      });
    },
    [executeRules]
  );

  const executeBeforeTransition = useCallback(
    async (
      currentState: string,
      targetState: string,
      data: Record<string, unknown>
    ): Promise<RuleExecutionResult> => {
      return executeRules('beforeTransition', data, {
        currentState,
        targetState,
        transitionType: 'state',
      });
    },
    [executeRules]
  );

  const executeAfterTransition = useCallback(
    async (
      previousState: string,
      currentState: string,
      data: Record<string, unknown>
    ): Promise<RuleExecutionResult> => {
      return executeRules('afterTransition', data, {
        previousState,
        currentState,
        transitionType: 'state',
      });
    },
    [executeRules]
  );

  const reloadBindings = useCallback(async () => {
    setIsLoaded(false);
    await loadBindings();
  }, [loadBindings]);

  // ==================== 返回 ====================

  return {
    executeBeforeCreate,
    executeBeforeSubmit,
    executeAfterSubmit,
    executeBeforeTransition,
    executeAfterTransition,
    isExecuting,
    lastResult,
    error,
    bindings,
    isLoaded,
    reloadBindings,
  };
}

// ==================== 辅助函数 ====================

/**
 * 将规则组映射到 Hook 点
 */
function mapRuleGroupToHookPoint(group: RuleGroup): HookPoint | null {
  switch (group) {
    case 'validation':
      return 'beforeSubmit';
    case 'workflow':
      return 'afterSubmit';
    case 'quality':
      return 'beforeSubmit';
    case 'alert':
      return 'afterSubmit';
    case 'costing':
      return null; // costing 有专门的 hook 点，暂不映射
    default:
      return null;
  }
}

export default useRuleHooks;
