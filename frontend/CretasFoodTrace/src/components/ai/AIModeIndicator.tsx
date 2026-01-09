/**
 * AI 分析模式指示器组件
 *
 * 用于显示当前 AI 分析使用的模式（快速响应/深度分析）
 * 可以用于聊天消息气泡、分析结果头部、输入区域指示器等场景
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../../theme';
import type { AnalysisMode } from '../../services/ai/types';

/**
 * AI 模式指示器 Props
 */
export interface AIModeIndicatorProps {
  /** 分析模式 */
  mode: AnalysisMode;
  /** 是否显示文字标签，默认 true */
  showLabel?: boolean;
  /** 是否显示图标，默认 true */
  showIcon?: boolean;
  /** 尺寸，默认 'medium' */
  size?: 'small' | 'medium' | 'large';
  /** 自定义样式 */
  style?: StyleProp<ViewStyle>;
}

/**
 * 模式配置映射
 */
interface ModeConfig {
  icon: string;
  label: string;
  backgroundColor: string;
  textColor: string;
}

/**
 * 获取模式配置
 */
const getModeConfig = (mode: AnalysisMode): ModeConfig => {
  switch (mode) {
    case 'quick':
      return {
        icon: '\u26A1', // Lightning bolt emoji
        label: '快速响应',
        backgroundColor: '#E6F9E9', // Light green background
        textColor: theme.custom.colors.success, // iOS Green (#34C759)
      };
    case 'deep':
      return {
        icon: '\uD83E\uDDE0', // Brain emoji
        label: '深度分析',
        backgroundColor: '#F5F0FF', // Light purple background
        textColor: '#5856D6', // iOS Indigo
      };
    default:
      return {
        icon: '\u26A1',
        label: '快速响应',
        backgroundColor: '#E6F9E9',
        textColor: theme.custom.colors.success,
      };
  }
};

/**
 * 获取尺寸配置
 */
interface SizeConfig {
  paddingHorizontal: number;
  paddingVertical: number;
  fontSize: number;
  lineHeight: number;
  iconSize: number;
  gap: number;
  borderRadius: number;
}

const getSizeConfig = (size: 'small' | 'medium' | 'large'): SizeConfig => {
  switch (size) {
    case 'small':
      return {
        paddingHorizontal: 6,
        paddingVertical: 2,
        fontSize: 10,
        lineHeight: 14,
        iconSize: 10,
        gap: 2,
        borderRadius: theme.custom.borderRadius.xs,
      };
    case 'medium':
      return {
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 12,
        lineHeight: 16,
        iconSize: 12,
        gap: 4,
        borderRadius: theme.custom.borderRadius.s,
      };
    case 'large':
      return {
        paddingHorizontal: 12,
        paddingVertical: 6,
        fontSize: 14,
        lineHeight: 20,
        iconSize: 14,
        gap: 6,
        borderRadius: theme.custom.borderRadius.m,
      };
    default:
      return {
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 12,
        lineHeight: 16,
        iconSize: 12,
        gap: 4,
        borderRadius: theme.custom.borderRadius.s,
      };
  }
};

/**
 * AI 分析模式指示器组件
 *
 * @example
 * // 基本用法
 * <AIModeIndicator mode="quick" />
 *
 * @example
 * // 深度分析模式，大尺寸
 * <AIModeIndicator mode="deep" size="large" />
 *
 * @example
 * // 仅显示图标
 * <AIModeIndicator mode="quick" showLabel={false} />
 *
 * @example
 * // 仅显示文字
 * <AIModeIndicator mode="deep" showIcon={false} />
 */
export const AIModeIndicator: React.FC<AIModeIndicatorProps> = ({
  mode,
  showLabel = true,
  showIcon = true,
  size = 'medium',
  style,
}) => {
  const modeConfig = getModeConfig(mode);
  const sizeConfig = getSizeConfig(size);

  // 如果都不显示，则返回空
  if (!showLabel && !showIcon) {
    return null;
  }

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sizeConfig.paddingHorizontal,
    paddingVertical: sizeConfig.paddingVertical,
    borderRadius: sizeConfig.borderRadius,
    backgroundColor: modeConfig.backgroundColor,
    alignSelf: 'flex-start',
    gap: showIcon && showLabel ? sizeConfig.gap : 0,
  };

  return (
    <View style={[containerStyle, style]}>
      {showIcon && (
        <Text
          style={[
            styles.icon,
            {
              fontSize: sizeConfig.iconSize,
              lineHeight: sizeConfig.lineHeight,
            },
          ]}
        >
          {modeConfig.icon}
        </Text>
      )}
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: modeConfig.textColor,
              fontSize: sizeConfig.fontSize,
              lineHeight: sizeConfig.lineHeight,
            },
          ]}
        >
          {modeConfig.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  icon: {
    // Icon styles are applied dynamically
  },
  label: {
    fontWeight: '600',
  },
});

export default AIModeIndicator;
