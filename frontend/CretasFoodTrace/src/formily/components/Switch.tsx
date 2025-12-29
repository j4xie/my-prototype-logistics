/**
 * Switch - 开关组件
 *
 * 适配 React Native Paper Switch 到 Formily
 * 用于布尔值的切换
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Switch as PaperSwitch, Text, useTheme } from 'react-native-paper';
import { connect, mapProps } from '@formily/react';
import type { Field } from '@formily/core';

interface SwitchProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  checkedText?: string;
  uncheckedText?: string;
  style?: object;
}

const InternalSwitch: React.FC<SwitchProps> = ({
  value = false,
  onChange,
  disabled,
  readOnly,
  checkedText,
  uncheckedText,
  style,
}) => {
  const theme = useTheme();
  const isDisabled = disabled || readOnly;

  const handleChange = useCallback(() => {
    if (!isDisabled) {
      onChange?.(!value);
    }
  }, [value, onChange, isDisabled]);

  const statusText = value ? checkedText : uncheckedText;

  return (
    <View style={[styles.container, style]}>
      <PaperSwitch
        value={value}
        onValueChange={handleChange}
        disabled={isDisabled}
        color={theme.colors.primary}
      />
      {statusText && (
        <Text
          style={[
            styles.statusText,
            { color: value ? theme.colors.primary : theme.colors.onSurfaceVariant },
          ]}
        >
          {statusText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

/**
 * 连接 Formily 字段状态
 */
export const Switch = connect(
  InternalSwitch,
  mapProps((props, field) => {
    const fieldState = field as Field;

    return {
      ...props,
      value: !!fieldState.value,
      onChange: (value: boolean) => {
        fieldState.setValue(value);
        fieldState.validate('onInput');
      },
      disabled: fieldState.disabled,
      readOnly: fieldState.readOnly,
    };
  })
);

export default Switch;
