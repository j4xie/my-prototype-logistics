/**
 * Input - 文本输入组件
 *
 * 适配 React Native Paper TextInput 到 Formily
 * 支持单行和多行输入
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';
import { connect, mapProps } from '@formily/react';
import type { Field } from '@formily/core';

interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: object;
}

const InternalInput: React.FC<InputProps> = ({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  disabled,
  readOnly,
  error,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
}) => {
  const theme = useTheme();

  return (
    <TextInput
      mode="outlined"
      value={value ?? ''}
      onChangeText={onChange}
      onBlur={onBlur}
      onFocus={onFocus}
      placeholder={placeholder}
      disabled={disabled || readOnly}
      error={error}
      multiline={multiline}
      numberOfLines={multiline ? numberOfLines : undefined}
      maxLength={maxLength}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={[
        styles.input,
        multiline && { minHeight: numberOfLines * 24 + 32 },
        style,
      ]}
      outlineColor={theme.colors.outline}
      activeOutlineColor={theme.colors.primary}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    backgroundColor: 'transparent',
  },
});

/**
 * 连接 Formily 字段状态
 */
export const Input = connect(
  InternalInput,
  mapProps((props, field) => {
    const fieldState = field as Field;

    return {
      ...props,
      value: fieldState.value,
      onChange: (value: string) => {
        fieldState.setValue(value);
        fieldState.validate('onInput');
      },
      onBlur: () => {
        fieldState.validate('onBlur');
      },
      disabled: fieldState.disabled,
      readOnly: fieldState.readOnly,
      error: !!fieldState.selfErrors?.length,
      placeholder: props.placeholder ?? fieldState.description,
    };
  })
);

export default Input;
