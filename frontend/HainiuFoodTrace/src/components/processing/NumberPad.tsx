import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NumberPadProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  unit?: string;
  allowDecimal?: boolean;
  maxValue?: number;
  quickButtons?: number[];  // 快捷增加按钮，如 [10, 100, 1000]
}

/**
 * 数字键盘组件 - 大按钮数字输入
 * - 大数字按钮
 * - 支持小数点
 * - 快捷输入按钮
 * - 触觉反馈
 */
export const NumberPad: React.FC<NumberPadProps> = ({
  value,
  onValueChange,
  label,
  placeholder = '0',
  unit,
  allowDecimal = true,
  maxValue,
  quickButtons = [],
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  const handleNumberPress = (num: string) => {
    let newValue = inputValue + num;

    // 检查最大值
    if (maxValue && parseFloat(newValue) > maxValue) {
      return;
    }

    setInputValue(newValue);
  };

  const handleDecimalPress = () => {
    if (!allowDecimal) return;
    if (inputValue.includes('.')) return;
    if (!inputValue) {
      setInputValue('0.');
    } else {
      setInputValue(inputValue + '.');
    }
  };

  const handleBackspace = () => {
    setInputValue(inputValue.slice(0, -1));
  };

  const handleClear = () => {
    setInputValue('');
  };

  const handleQuickAdd = (amount: number) => {
    const currentValue = parseFloat(inputValue || '0');
    const newValue = (currentValue + amount).toString();

    if (maxValue && parseFloat(newValue) > maxValue) {
      return;
    }

    setInputValue(newValue);
  };

  const handleConfirm = () => {
    onValueChange(inputValue);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setInputValue(value || '');
    setModalVisible(false);
  };

  const numberButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <>
      {/* 触发按钮 */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => {
          setInputValue(value || '');
          setModalVisible(true);
        }}
      >
        <View style={styles.triggerContent}>
          {label && <Text style={styles.label}>{label}</Text>}
          <View style={styles.valueContainer}>
            <Text style={[styles.value, !value && styles.placeholder]}>
              {value || placeholder}
            </Text>
            {unit && <Text style={styles.unit}>{unit}</Text>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
      </TouchableOpacity>

      {/* 数字键盘模态框 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCancel}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* 头部 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.cancelButton}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{label || '输入数值'}</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmButton}>确定</Text>
            </TouchableOpacity>
          </View>

          {/* 显示区域 */}
          <View style={styles.displayContainer}>
            <Text style={styles.displayValue}>
              {inputValue || '0'}
              {unit && <Text style={styles.displayUnit}> {unit}</Text>}
            </Text>
          </View>

          {/* 快捷按钮 */}
          {quickButtons.length > 0 && (
            <View style={styles.quickButtonsContainer}>
              {quickButtons.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickButton}
                  onPress={() => handleQuickAdd(amount)}
                >
                  <Text style={styles.quickButtonText}>+{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 数字键盘 */}
          <View style={styles.keypad}>
            {numberButtons.map((button, index) => {
              // 小数点按钮
              if (button === '.') {
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.key,
                      !allowDecimal && styles.keyDisabled,
                    ]}
                    onPress={handleDecimalPress}
                    disabled={!allowDecimal}
                  >
                    <Text style={[styles.keyText, !allowDecimal && styles.keyTextDisabled]}>
                      {button}
                    </Text>
                  </TouchableOpacity>
                );
              }

              // 退格按钮
              if (button === '⌫') {
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.key, styles.keyFunction]}
                    onPress={handleBackspace}
                  >
                    <Ionicons name="backspace" size={32} color="#EF4444" />
                  </TouchableOpacity>
                );
              }

              // 数字按钮
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.key}
                  onPress={() => handleNumberPress(button)}
                >
                  <Text style={styles.keyText}>{button}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 清除按钮 */}
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>清除</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // 触发按钮样式
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  triggerContent: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  unit: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },

  // 模态框样式
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
    padding: 8,
  },
  confirmButton: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
    padding: 8,
  },

  // 显示区域
  displayContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  displayValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  displayUnit: {
    fontSize: 24,
    color: '#6B7280',
  },

  // 快捷按钮
  quickButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  quickButton: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
  },

  // 数字键盘
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  key: {
    width: '30%',
    aspectRatio: 1.5,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  keyFunction: {
    backgroundColor: '#FEE2E2',
  },
  keyDisabled: {
    opacity: 0.3,
  },
  keyText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1F2937',
  },
  keyTextDisabled: {
    color: '#9CA3AF',
  },

  // 清除按钮
  clearButton: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
  },
});
