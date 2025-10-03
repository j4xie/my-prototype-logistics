import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HapticManager from '../../utils/haptics';

interface BigButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  size?: 'medium' | 'large' | 'xlarge';
  style?: ViewStyle;
  enableHaptic?: boolean; // 是否启用触觉反馈，默认true
}

/**
 * 大按钮组件 - 专为低文化员工设计
 * - 超大触控区域
 * - 大图标+大文字
 * - 颜色编码一致性
 */
export const BigButton: React.FC<BigButtonProps> = ({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'large',
  style,
  enableHaptic = true,
}) => {

  const handlePress = async () => {
    if (enableHaptic) {
      // 根据按钮变体触发不同的触觉反馈
      switch (variant) {
        case 'success':
          await HapticManager.confirm();
          break;
        case 'danger':
          await HapticManager.important();
          break;
        case 'warning':
          await HapticManager.warning();
          break;
        default:
          await HapticManager.buttonPress();
      }
    }
    onPress();
  };
  const getVariantStyles = (): { bg: string; text: string } => {
    if (disabled) {
      return { bg: '#D1D5DB', text: '#9CA3AF' };
    }

    switch (variant) {
      case 'success':
        return { bg: '#10B981', text: '#FFFFFF' }; // 绿色 - 安全/开始
      case 'danger':
        return { bg: '#EF4444', text: '#FFFFFF' }; // 红色 - 危险/结束
      case 'warning':
        return { bg: '#F59E0B', text: '#FFFFFF' }; // 黄色 - 警告
      case 'secondary':
        return { bg: '#6B7280', text: '#FFFFFF' }; // 灰色 - 次要
      case 'primary':
      default:
        return { bg: '#3B82F6', text: '#FFFFFF' }; // 蓝色 - 主要
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'medium':
        return {
          button: { paddingVertical: 16, paddingHorizontal: 24 },
          icon: 32,
          text: { fontSize: 18 },
        };
      case 'xlarge':
        return {
          button: { paddingVertical: 32, paddingHorizontal: 48 },
          icon: 56,
          text: { fontSize: 28 },
        };
      case 'large':
      default:
        return {
          button: { paddingVertical: 24, paddingHorizontal: 32 },
          icon: 40,
          text: { fontSize: 22 },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        sizeStyles.button,
        { backgroundColor: variantStyles.bg },
        disabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {icon && (
        <View style={styles.iconContainer}>
          <Ionicons
            name={icon}
            size={sizeStyles.icon}
            color={variantStyles.text}
          />
        </View>
      )}
      <Text
        style={[
          styles.text,
          sizeStyles.text,
          { color: variantStyles.text },
        ]}
      >
        {loading ? '处理中...' : title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 80,
  },
  disabled: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  iconContainer: {
    marginRight: 16,
  },
  text: {
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
