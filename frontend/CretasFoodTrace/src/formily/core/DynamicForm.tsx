/**
 * DynamicForm - 动态表单组件
 *
 * 封装 Formily 的 Form 创建和 FormProvider
 * 提供统一的动态表单渲染能力
 */

import React, { useMemo, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { createForm, Form, onFieldValueChange } from '@formily/core';
import { FormProvider, ISchema } from '@formily/react';
import { SchemaField } from './SchemaField';
import { AIAssistantButton } from '../components/AIAssistantButton';
import { EntityType } from '../../services/api/formTemplateApiClient';

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
    },
    ref
  ) => {
      // 内部 ref 用于 AI 助手
      const internalRef = useRef<DynamicFormRef>(null);
      const theme = useTheme();

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

      // 提交表单
      const handleSubmit = useCallback(async () => {
        try {
          await form.validate();
          const values = form.values;
          await onSubmit?.(values);
        } catch (errors) {
          console.error('表单验证失败:', errors);
          throw errors;
        }
      }, [form, onSubmit]);

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
          </View>
        );
      }

      return (
        <View style={[styles.container, style]}>
          {content}
          {aiAssistantButton}
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
});

export default DynamicForm;
