/**
 * NumberInput - 数字输入组件
 *
 * 适配 React Native Paper TextInput 到 Formily
 * 支持整数和小数输入，带有增减按钮
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { TextInput, IconButton, useTheme } from 'react-native-paper';
import { connect, mapProps } from '@formily/react';
import type { Field } from '@formily/core';

interface NumberInputProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  showButtons?: boolean;
  suffix?: string;
  style?: object;
}

const InternalNumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  readOnly,
  error,
  min,
  max,
  step = 1,
  precision = 0,
  showButtons = true,
  suffix,
  style,
}) => {
  const theme = useTheme();

  const formatValue = useCallback((val: number | undefined): string => {
    if (val === undefined || val === null || isNaN(val)) return '';
    return precision > 0 ? val.toFixed(precision) : String(val);
  }, [precision]);

  const parseValue = useCallback((text: string): number | undefined => {
    if (!text || text === '-') return undefined;

    const parsed = precision > 0 ? parseFloat(text) : parseInt(text, 10);
    if (isNaN(parsed)) return undefined;

    // 应用边界限制
    let result = parsed;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;

    return result;
  }, [min, max, precision]);

  const handleTextChange = useCallback((text: string) => {
    // 允许输入负号和小数点
    const regex = precision > 0 ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    if (!regex.test(text) && text !== '') return;

    const parsed = parseValue(text);
    onChange?.(parsed);
  }, [onChange, parseValue, precision]);

  const handleIncrement = useCallback(() => {
    const current = value ?? 0;
    let newValue = current + step;
    if (max !== undefined && newValue > max) newValue = max;
    onChange?.(precision > 0 ? parseFloat(newValue.toFixed(precision)) : newValue);
  }, [value, step, max, onChange, precision]);

  const handleDecrement = useCallback(() => {
    const current = value ?? 0;
    let newValue = current - step;
    if (min !== undefined && newValue < min) newValue = min;
    onChange?.(precision > 0 ? parseFloat(newValue.toFixed(precision)) : newValue);
  }, [value, step, min, onChange, precision]);

  const isDisabled = disabled || readOnly;

  return (
    <View style={[styles.container, style]}>
      {showButtons && (
        <IconButton
          icon="minus"
          mode="contained-tonal"
          size={20}
          disabled={isDisabled || (min !== undefined && (value ?? 0) <= min)}
          onPress={handleDecrement}
          style={styles.button}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          value={formatValue(value)}
          onChangeText={handleTextChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={isDisabled}
          error={error}
          keyboardType="numeric"
          style={styles.input}
          outlineColor={theme.colors.outline}
          activeOutlineColor={theme.colors.primary}
          right={suffix ? <TextInput.Affix text={suffix} /> : undefined}
        />
      </View>

      {showButtons && (
        <IconButton
          icon="plus"
          mode="contained-tonal"
          size={20}
          disabled={isDisabled || (max !== undefined && (value ?? 0) >= max)}
          onPress={handleIncrement}
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  input: {
    backgroundColor: 'transparent',
    textAlign: 'center',
  },
  button: {
    margin: 0,
  },
});

/**
 * 连接 Formily 字段状态
 */
export const NumberInput = connect(
  InternalNumberInput,
  mapProps((props, field) => {
    const fieldState = field as Field;

    return {
      ...props,
      value: fieldState.value,
      onChange: (value: number | undefined) => {
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

export default NumberInput;
