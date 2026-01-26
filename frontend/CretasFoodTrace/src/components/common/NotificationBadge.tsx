import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';

/**
 * 通知气泡组件
 *
 * 功能：
 * - 显示未读通知数量
 * - 超过99显示99+
 * - 无未读时隐藏
 * - 支持自定义位置和大小
 *
 * @example
 * ```tsx
 * <NotificationBadge count={5} />
 * <NotificationBadge count={150} size="small" />
 * <NotificationBadge count={0} /> // 不显示
 * ```
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

interface NotificationBadgeProps {
  /** 未读数量 */
  count: number;
  /** 气泡大小 */
  size?: 'small' | 'medium' | 'large';
  /** 自定义背景色 */
  backgroundColor?: string;
  /** 自定义文字颜色 */
  textColor?: string;
}

// P3 Fix: Define styles first so SIZE_STYLES can reference them
const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
  },
  text: {
    fontWeight: 'bold',
  },
  // Small size
  containerSmall: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
  },
  textSmall: {
    fontSize: 9,
    lineHeight: 12,
  },
  // Medium size
  containerMedium: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
  },
  textMedium: {
    fontSize: 11,
    lineHeight: 14,
  },
  // Large size
  containerLarge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
  },
  textLarge: {
    fontSize: 13,
    lineHeight: 16,
  },
});

// P3 Fix: Extract size styles outside component to avoid object recreation
const SIZE_STYLES: Record<'small' | 'medium' | 'large', { container: StyleProp<ViewStyle>; text: StyleProp<TextStyle> }> = {
  small: {
    container: styles.containerSmall,
    text: styles.textSmall,
  },
  medium: {
    container: styles.containerMedium,
    text: styles.textMedium,
  },
  large: {
    container: styles.containerLarge,
    text: styles.textLarge,
  },
};

// P3 Fix: Wrap component with React.memo
export const NotificationBadge: React.FC<NotificationBadgeProps> = React.memo(({
  count,
  size = 'medium',
  backgroundColor = '#F44336',
  textColor = '#FFFFFF',
}) => {
  // 无未读时隐藏
  if (count <= 0) {
    return null;
  }

  // 超过99显示99+
  const displayText = count > 99 ? '99+' : count.toString();

  const { container, text } = SIZE_STYLES[size] || SIZE_STYLES.medium;

  return (
    <View style={[styles.container, container, { backgroundColor }]}>
      <Text style={[styles.text, text, { color: textColor }]}>{displayText}</Text>
    </View>
  );
});

NotificationBadge.displayName = 'NotificationBadge';

export default NotificationBadge;
