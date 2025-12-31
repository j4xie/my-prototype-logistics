/**
 * DynamicForm - 动态表单组件
 *
 * 封装 Formily 的 Form 创建和 FormProvider
 * 提供统一的动态表单渲染能力
 */

import React, { useMemo, useCallback, useImperativeHandle, forwardRef, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, useTheme, Snackbar } from 'react-native-paper';
import { createForm, Form, onFieldValueChange } from '@formily/core';
import { FormProvider, ISchema } from '@formily/react';
import { SchemaField } from './SchemaField';
import { AIAssistantButton } from '../components/AIAssistantButton';
import { EntityType } from '../../services/api/formTemplateApiClient';
import { EntityType as RuleEntityType } from '../../services/api/ruleConfigApiClient';
import { useRuleHooks, RuleExecutionResult } from '../hooks';
import {
  ValidationCorrectionModal,
  ValidationCorrectionModalProps,
} from '../../components/form/ValidationCorrectionModal';
import { ValidationError, FormFieldDefinition } from '../../services/api/formAssistantApiClient';

// 将 formTemplateApiClient 的 EntityType 转换为 ruleConfigApiClient 的 EntityType
const mapEntityTypeForRules = (entityType: EntityType | undefined): RuleEntityType => {
  if (!entityType) return 'MaterialBatch';
  const mapping: Record<EntityType, RuleEntityType> = {
    QUALITY_CHECK: 'QualityInspection',
    MATERIAL_BATCH: 'MaterialBatch',
    PROCESSING_BATCH: 'ProcessingBatch',
    SHIPMENT: 'Shipment',
    EQUIPMENT: 'Equipment',
    DISPOSAL_RECORD: 'DisposalRecord',
  };
  return mapping[entityType] ?? 'MaterialBatch';
};

// FormSchema 是一个简化的业务 Schema 类型
// 实际使用时会兼容 Formily 的 ISchema
export interface FormSchema {
  type: 'object';
  properties: Record<string, FieldSchema>;
}

export interface FieldSchema {
  type: string;
  title?: string;
  description?: string;
  required?: boolean;
  default?: any;
  enum?: Array<{ label: string; value: any }>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  'x-decorator'?: string;
  'x-decorator-props'?: Record<string, any>;
  'x-component'?: string;
  'x-component-props'?: Record<string, any>;
  'x-reactions'?: any;
  'x-validator'?: any[];
  properties?: Record<string, FieldSchema>;
}

export interface DynamicFormProps {
  schema: FormSchema;
  initialValues?: Record<string, any>;
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
  onValuesChange?: (values: Record<string, any>) => void;
  effects?: (form: Form) => void;
  disabled?: boolean;
  readOnly?: boolean;
  submitText?: string;
  showSubmitButton?: boolean;
  scrollable?: boolean;
  style?: object;
  contentStyle?: object;
  // AI 助手相关配置
  enableAIAssistant?: boolean;
  entityType?: EntityType;
  aiContext?: Record<string, unknown>;
  onAIFillSuccess?: (fieldValues: Record<string, unknown>, confidence: number) => void;
  onAIFillError?: (error: string) => void;
  // 规则 Hook 相关配置
  enableRuleHooks?: boolean;
  factoryId?: string;
  onRuleExecuted?: (result: RuleExecutionResult) => void;
  onRuleValidationError?: (errors: string[]) => void;
  onRuleWarning?: (warnings: string[]) => void;
}

export interface DynamicFormRef {
  form: Form;
  validate: () => Promise<void>;
  submit: () => Promise<void>;
  reset: () => void;
  getValues: () => Record<string, any>;
  setValues: (values: Record<string, any>) => void;
  setFieldValue: (path: string, value: any) => void;
  getFieldValue: (path: string) => any;
}

/**
 * DynamicForm 组件
 *
 * 用法示例:
 * ```tsx
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: {
 *       type: 'string',
 *       title: '姓名',
 *       required: true,
 *       'x-decorator': 'FormItem',
 *       'x-component': 'Input',
 *     },
 *     age: {
 *       type: 'number',
 *       title: '年龄',
 *       'x-decorator': 'FormItem',
 *       'x-component': 'NumberInput',
 *     },
 *   },
 * };
 *
 * <DynamicForm
 *   schema={schema}
 *   initialValues={{ name: '', age: 18 }}
 *   onSubmit={(values) => console.log(values)}
 * />
 * ```
 */
export const DynamicForm = forwardRef<DynamicFormRef, DynamicFormProps>(
  (
    {
      schema,
      initialValues,
      onSubmit,
      onValuesChange,
      effects,
      disabled = false,
      readOnly = false,
      submitText = '提交',
      showSubmitButton = true,
      scrollable = true,
      style,
      contentStyle,
      // AI 助手配置
      enableAIAssistant = false,
      entityType,
      aiContext,
      onAIFillSuccess,
      onAIFillError,
      // 规则 Hook 配置
      enableRuleHooks = false,
      factoryId,
      onRuleExecuted,
      onRuleValidationError,
      onRuleWarning,
    },
    ref
  ) => {
      // 内部 ref 用于 AI 助手
      const internalRef = useRef<DynamicFormRef>(null);
      const theme = useTheme();

      // Snackbar 状态 (用于显示规则警告)
      const [snackbarVisible, setSnackbarVisible] = React.useState(false);
      const [snackbarMessage, setSnackbarMessage] = React.useState('');

      // 校验修正弹窗状态
      const [validationModalVisible, setValidationModalVisible] = useState(false);
      const [currentValidationErrors, setCurrentValidationErrors] = useState<ValidationError[]>([]);
      const [currentSubmittedValues, setCurrentSubmittedValues] = useState<Record<string, unknown>>({});
      const [validationSessionId, setValidationSessionId] = useState<string | undefined>();

      // 从 schema 提取字段定义 (用于 AI 理解表单结构)
      const formFieldsFromSchema: FormFieldDefinition[] = useMemo(() => {
        if (!schema?.properties) return [];

        // 映射 schema type 到 FormFieldDefinition type
        const mapType = (schemaType: string, hasEnum: boolean): FormFieldDefinition['type'] => {
          if (hasEnum) return 'enum';
          switch (schemaType) {
            case 'string': return 'string';
            case 'number':
            case 'integer': return 'number';
            case 'boolean': return 'boolean';
            case 'array': return 'array';
            default: return 'string'; // 将 object 等其他类型映射为 string
          }
        };

        return Object.entries(schema.properties).map(([name, field]) => ({
          name,
          title: field.title || name,
          type: mapType(field.type, !!field.enum),
          required: field.required,
          description: field.description,
          enumOptions: field.enum?.map(e => typeof e === 'object'
            ? { label: e.label, value: e.value }
            : { label: String(e), value: e }
          ),
        }));
      }, [schema]);

      // 创建表单实例
      const form = useMemo(() => {
        const formInstance = createForm({
          initialValues,
          disabled,
          readOnly,
          effects: () => {
            // 注册值变化监听
            if (onValuesChange) {
              onFieldValueChange('*', () => {
                const values = formInstance.values;
                onValuesChange(values);
              });
            }

            // 注册用户自定义 effects
            if (effects) {
              effects(formInstance);
            }
          },
        });

        return formInstance;
      }, []);

      // 更新表单状态
      React.useEffect(() => {
        form.setPattern(disabled ? 'disabled' : readOnly ? 'readOnly' : 'editable');
      }, [form, disabled, readOnly]);

      // 规则 Hook
      const ruleHooks = useRuleHooks({
        formRef: internalRef,
        entityType: mapEntityTypeForRules(entityType),
        factoryId,
        enabled: enableRuleHooks && !!entityType,
        onAfterExecute: (result) => {
          onRuleExecuted?.(result);
        },
        onValuesModified: (modifiedValues) => {
          // 将规则修改的值应用到表单
          Object.entries(modifiedValues).forEach(([key, value]) => {
            form.setFieldState(key, (state) => {
              state.value = value;
            });
          });
        },
        onValidationError: (errors) => {
          onRuleValidationError?.(errors);
        },
        onError: (error) => {
          console.error('[DynamicForm] 规则执行错误:', error);
        },
      });

      // beforeCreate Hook 执行 (表单初始化时)
      useEffect(() => {
        if (!enableRuleHooks || !entityType) return;

        const executeBeforeCreate = async () => {
          try {
            const result = await ruleHooks.executeBeforeCreate(initialValues ?? {});
            if (result.modifiedValues && Object.keys(result.modifiedValues).length > 0) {
              // 应用规则返回的初始值修改
              form.setValues({ ...form.values, ...result.modifiedValues });
            }
          } catch (error) {
            console.error('[DynamicForm] beforeCreate Hook 执行失败:', error);
          }
        };

        // 等待表单初始化完成后执行
        const timer = setTimeout(executeBeforeCreate, 100);
        return () => clearTimeout(timer);
      }, [entityType, enableRuleHooks]);

      // 提交表单
      const handleSubmit = useCallback(async () => {
        try {
          // 1. 表单验证
          await form.validate();
          const values = form.values;

          // 2. 执行 beforeSubmit 规则 Hook
          if (enableRuleHooks && entityType) {
            const beforeSubmitResult = await ruleHooks.executeBeforeSubmit(values);

            // 检查规则验证错误 - 触发 AI 校验修正弹窗
            if (beforeSubmitResult.validationErrors && beforeSubmitResult.validationErrors.length > 0) {
              // 将规则验证错误转换为 ValidationError 格式
              const validationErrors: ValidationError[] = beforeSubmitResult.validationErrors.map((error, index) => {
                // 尝试从错误信息中解析字段名 (格式: "字段名: 错误信息" 或 "fieldName - 错误信息")
                const colonMatch = error.match(/^([^:：]+)[：:]\s*(.+)$/);
                const dashMatch = error.match(/^([^ -]+)\s*[-–]\s*(.+)$/);
                const match = colonMatch || dashMatch;

                // 安全提取字段名和错误信息
                const fieldName = match?.[1]?.trim();
                const errorMessage = match?.[2]?.trim();

                return {
                  field: fieldName ?? `validation_${index}`,
                  message: errorMessage ?? error,
                  rule: `drools_rule_${index}`,
                  currentValue: fieldName ? values[fieldName] : undefined,
                };
              });

              // 保存当前提交的值和错误信息，打开校验修正弹窗
              setCurrentValidationErrors(validationErrors);
              setCurrentSubmittedValues(values);
              setValidationModalVisible(true);

              // 通知父组件
              onRuleValidationError?.(beforeSubmitResult.validationErrors);

              // 抛出错误阻止提交，但不显示 Alert (由 Modal 处理)
              throw new Error('VALIDATION_CORRECTION_REQUIRED');
            }

            // 显示警告 (但不阻止提交)
            if (beforeSubmitResult.warnings && beforeSubmitResult.warnings.length > 0) {
              onRuleWarning?.(beforeSubmitResult.warnings);
              setSnackbarMessage(beforeSubmitResult.warnings.join('; '));
              setSnackbarVisible(true);
            }

            // 如果规则修改了值，使用修改后的值
            const finalValues = beforeSubmitResult.modifiedValues
              ? { ...values, ...beforeSubmitResult.modifiedValues }
              : values;

            // 3. 调用原始 onSubmit
            const submitResult = await onSubmit?.(finalValues);

            // 4. 执行 afterSubmit 规则 Hook
            await ruleHooks.executeAfterSubmit(finalValues, submitResult);
          } else {
            // 不启用规则 Hook 时直接提交
            await onSubmit?.(values);
          }
        } catch (errors) {
          console.error('表单提交失败:', errors);
          throw errors;
        }
      }, [form, onSubmit, enableRuleHooks, entityType, ruleHooks, onRuleWarning]);

      // 校验修正弹窗回调：应用 AI 建议的修正值
      const handleApplySuggestions = useCallback((correctedValues: Record<string, unknown>) => {
        // 将 AI 修正值应用到表单
        Object.entries(correctedValues).forEach(([key, value]) => {
          form.setFieldState(key, (state) => {
            state.value = value;
          });
        });

        // 关闭弹窗
        setValidationModalVisible(false);

        // 清空校验错误
        setCurrentValidationErrors([]);

        // 显示成功提示
        setSnackbarMessage('已应用 AI 修正建议，请检查后重新提交');
        setSnackbarVisible(true);
      }, [form]);

      // 校验修正弹窗回调：重试提交
      const handleRetrySubmit = useCallback(async () => {
        // 关闭弹窗
        setValidationModalVisible(false);

        // 清空校验错误
        setCurrentValidationErrors([]);

        // 延迟一帧后重新提交，确保 UI 更新
        setTimeout(() => {
          handleSubmit().catch((error) => {
            // 如果是校验修正错误，弹窗会再次打开，不需要额外处理
            if (error.message !== 'VALIDATION_CORRECTION_REQUIRED') {
              console.error('重试提交失败:', error);
            }
          });
        }, 100);
      }, [handleSubmit]);

      // 关闭校验修正弹窗
      const handleDismissValidationModal = useCallback(() => {
        setValidationModalVisible(false);
        // 保留错误信息，用户可能需要手动修改
      }, []);

      // 创建 ref 对象
      const formRefObject: DynamicFormRef = useMemo(() => ({
        form,
        validate: () => form.validate(),
        submit: handleSubmit,
        reset: () => form.reset(),
        getValues: () => form.values,
        setValues: (values) => form.setValues(values),
        setFieldValue: (path, value) => form.setFieldState(path, (state) => {
          state.value = value;
        }),
        getFieldValue: (path) => form.getFieldState(path)?.value,
      }), [form, handleSubmit]);

      // 暴露方法给父组件
      useImperativeHandle(ref, () => formRefObject, [formRefObject]);

      // 设置内部 ref 供 AI 助手使用
      React.useEffect(() => {
        (internalRef as React.MutableRefObject<DynamicFormRef | null>).current = formRefObject;
      }, [formRefObject]);

      const content = (
        <>
          <FormProvider form={form}>
            <View style={[styles.fieldsContainer, contentStyle]}>
              {/* 类型断言: FormSchema 兼容 ISchema */}
              <SchemaField schema={schema as unknown as ISchema} />
            </View>
          </FormProvider>

          {showSubmitButton && (
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={handleSubmit}
                disabled={disabled}
                style={styles.submitButton}
                buttonColor={theme.colors.primary}
              >
                {submitText}
              </Button>
            </View>
          )}
        </>
      );

      // AI 助手按钮 (仅当启用且有 entityType 时显示)
      const aiAssistantButton = enableAIAssistant && entityType && !disabled && !readOnly ? (
        <AIAssistantButton
          formRef={internalRef}
          entityType={entityType}
          schema={schema}
          context={aiContext}
          onAIFillSuccess={onAIFillSuccess}
          onAIFillError={onAIFillError}
        />
      ) : null;

      // 规则警告 Snackbar
      const ruleWarningSnackbar = (
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={4000}
          action={{
            label: '关闭',
            onPress: () => setSnackbarVisible(false),
          }}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>
      );

      // 校验修正弹窗 (AI 辅助纠错)
      const validationCorrectionModal = entityType ? (
        <ValidationCorrectionModal
          visible={validationModalVisible}
          onDismiss={handleDismissValidationModal}
          validationErrors={currentValidationErrors}
          submittedValues={currentSubmittedValues}
          entityType={entityType}
          formFields={formFieldsFromSchema}
          onApplySuggestions={handleApplySuggestions}
          onRetry={handleRetrySubmit}
          sessionId={validationSessionId}
          onSessionIdChange={setValidationSessionId}
        />
      ) : null;

      if (scrollable) {
        return (
          <View style={[styles.container, style]}>
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {content}
            </ScrollView>
            {aiAssistantButton}
            {ruleWarningSnackbar}
            {validationCorrectionModal}
          </View>
        );
      }

      return (
        <View style={[styles.container, style]}>
          {content}
          {aiAssistantButton}
          {ruleWarningSnackbar}
          {validationCorrectionModal}
        </View>
      );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  fieldsContainer: {
    padding: 16,
  },
  buttonContainer: {
    padding: 16,
    paddingTop: 8,
  },
  submitButton: {
    borderRadius: 8,
  },
  snackbar: {
    marginBottom: 16,
  },
});

export default DynamicForm;
