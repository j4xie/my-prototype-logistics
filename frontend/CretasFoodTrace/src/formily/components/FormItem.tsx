/**
 * FormItem - 表单项包装器组件
 *
 * 为 Formily 字段提供统一的布局和错误显示
 * 适配 React Native Paper 设计风格
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, HelperText, useTheme } from 'react-native-paper';
import { connect, mapProps } from '@formily/react';
import type { Field, GeneralField } from '@formily/core';

interface FormItemProps {
  label?: string;
  required?: boolean;
  error?: string;
  description?: string;
  children?: React.ReactNode;
  style?: object;
}

const InternalFormItem: React.FC<FormItemProps> = ({
  label,
  required,
  error,
  description,
  children,
  style,
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>
            {label}
          </Text>
          {required && (
            <Text style={[styles.required, { color: theme.colors.error }]}>
              *
            </Text>
          )}
        </View>
      )}

      <View style={styles.content}>
        {children}
      </View>

      {error && (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      )}

      {!error && description && (
        <HelperText type="info" visible={!!description}>
          {description}
        </HelperText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  required: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    // 子组件容器
  },
});

/**
 * 连接 Formily 字段状态
 * 自动从字段获取 label、required、errors 等信息
 */
export const FormItem = connect(
  InternalFormItem,
  mapProps((props, field: GeneralField) => {
    const fieldState = field as Field;

    return {
      ...props,
      label: props.label ?? fieldState.title,
      required: props.required ?? fieldState.required,
      error: fieldState.selfErrors?.[0],
      description: props.description ?? fieldState.description,
    };
  })
);

export default FormItem;
