/**
 * DatePicker - 日期选择组件
 *
 * 使用 @react-native-community/datetimepicker 实现日期选择
 * 支持日期、时间和日期时间模式
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { TextInput, Button, Portal, Dialog, useTheme } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { connect, mapProps } from '@formily/react';
import type { Field } from '@formily/core';

type DatePickerMode = 'date' | 'time' | 'datetime';

interface DatePickerProps {
  value?: string | Date;
  onChange?: (value: string | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  mode?: DatePickerMode;
  minDate?: Date;
  maxDate?: Date;
  format?: string;
  style?: object;
}

const formatDate = (date: Date, mode: DatePickerMode): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  switch (mode) {
    case 'time':
      return `${hours}:${minutes}`;
    case 'datetime':
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case 'date':
    default:
      return `${year}-${month}-${day}`;
  }
};

const parseDate = (value: string | Date | undefined): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const InternalDatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  readOnly,
  error,
  mode = 'date',
  minDate,
  maxDate,
  style,
}) => {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseDate(value));
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const isDisabled = disabled || readOnly;

  const displayValue = useMemo(() => {
    if (!value) return '';
    const date = parseDate(value);
    return formatDate(date, mode);
  }, [value, mode]);

  const handlePress = () => {
    if (!isDisabled) {
      setTempDate(parseDate(value));
      setPickerMode(mode === 'time' ? 'time' : 'date');
      setShowPicker(true);
    }
  };

  const handleChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        if (mode === 'datetime' && pickerMode === 'date') {
          // 在 datetime 模式下，先选日期再选时间
          setTempDate(selectedDate);
          setPickerMode('time');
          setShowPicker(true);
        } else {
          const finalDate = mode === 'datetime' && pickerMode === 'time'
            ? new Date(
                tempDate.getFullYear(),
                tempDate.getMonth(),
                tempDate.getDate(),
                selectedDate.getHours(),
                selectedDate.getMinutes()
              )
            : selectedDate;
          onChange?.(formatDate(finalDate, mode));
          onBlur?.();
        }
      } else {
        onBlur?.();
      }
    } else {
      // iOS: 实时更新临时日期
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  }, [mode, pickerMode, tempDate, onChange, onBlur]);

  const handleConfirm = useCallback(() => {
    if (mode === 'datetime' && pickerMode === 'date') {
      setPickerMode('time');
    } else {
      onChange?.(formatDate(tempDate, mode));
      setShowPicker(false);
      onBlur?.();
    }
  }, [mode, pickerMode, tempDate, onChange, onBlur]);

  const handleCancel = useCallback(() => {
    setShowPicker(false);
    onBlur?.();
  }, [onBlur]);

  const handleClear = useCallback(() => {
    onChange?.(undefined);
  }, [onChange]);

  const getPlaceholder = (): string => {
    if (placeholder) return placeholder;
    switch (mode) {
      case 'time':
        return '选择时间';
      case 'datetime':
        return '选择日期时间';
      default:
        return '选择日期';
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Pressable onPress={handlePress} disabled={isDisabled}>
        <TextInput
          mode="outlined"
          value={displayValue}
          placeholder={getPlaceholder()}
          disabled={isDisabled}
          error={error}
          editable={false}
          pointerEvents="none"
          style={styles.input}
          outlineColor={theme.colors.outline}
          right={
            <TextInput.Icon
              icon="calendar"
              disabled={isDisabled}
              onPress={handlePress}
            />
          }
        />
      </Pressable>

      {/* iOS: 使用 Dialog 包装 */}
      {Platform.OS === 'ios' && showPicker && (
        <Portal>
          <Dialog visible={showPicker} onDismiss={handleCancel}>
            <Dialog.Title>
              {mode === 'datetime' && pickerMode === 'time' ? '选择时间' : '选择日期'}
            </Dialog.Title>
            <Dialog.Content>
              <DateTimePicker
                value={tempDate}
                mode={pickerMode}
                display="spinner"
                onChange={handleChange}
                minimumDate={minDate}
                maximumDate={maxDate}
                locale="zh-CN"
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={handleCancel}>取消</Button>
              <Button onPress={handleConfirm}>
                {mode === 'datetime' && pickerMode === 'date' ? '下一步' : '确定'}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}

      {/* Android: 直接显示 picker */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode={pickerMode}
          display="default"
          onChange={handleChange}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  input: {
    backgroundColor: 'transparent',
  },
});

/**
 * 连接 Formily 字段状态
 */
export const DatePicker = connect(
  InternalDatePicker,
  mapProps((props, field) => {
    const fieldState = field as Field;

    return {
      ...props,
      value: fieldState.value,
      onChange: (value: string | undefined) => {
        fieldState.setValue(value);
        fieldState.validate('onInput');
      },
      onBlur: () => {
        fieldState.validate('onBlur');
      },
      disabled: fieldState.disabled,
      readOnly: fieldState.readOnly,
      error: !!fieldState.selfErrors?.length,
    };
  })
);

export default DatePicker;
