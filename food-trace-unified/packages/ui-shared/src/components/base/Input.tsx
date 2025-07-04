import React, { useState } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { TextInput, TextInputProps, HelperText } from 'react-native-paper';

export interface InputProps extends Omit<TextInputProps, 'mode'> {
  label: string;
  variant?: 'outlined' | 'flat';
  size?: 'small' | 'medium' | 'large';
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  variant = 'outlined',
  size = 'medium',
  error,
  helperText,
  required = false,
  fullWidth = true,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const inputStyles = [
    styles.base,
    styles[size],
    fullWidth && styles.fullWidth,
    isFocused && styles.focused,
    error && styles.error,
    style,
  ];

  const displayLabel = required ? `${label} *` : label;

  return (
    <>
      <TextInput
        {...props}
        label={displayLabel}
        mode={variant}
        style={inputStyles}
        error={!!error}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        theme={{
          colors: {
            primary: '#2196F3',
            error: '#f44336',
          },
        }}
      />
      {(error || helperText) && (
        <HelperText type={error ? 'error' : 'info'}>
          {error || helperText}
        </HelperText>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'transparent',
  } as ViewStyle,
  
  small: {
    minHeight: 48,
  } as ViewStyle,
  
  medium: {
    minHeight: 56,
  } as ViewStyle,
  
  large: {
    minHeight: 64,
  } as ViewStyle,
  
  fullWidth: {
    alignSelf: 'stretch',
  } as ViewStyle,
  
  focused: {
    // 可以添加聚焦时的特殊样式
  } as ViewStyle,
  
  error: {
    // 错误状态的特殊样式
  } as ViewStyle,
});