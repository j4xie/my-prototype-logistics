import React from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Badge as PaperBadge, Text } from 'react-native-paper';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'small' | 'medium' | 'large';
  dot?: boolean;
  count?: number;
  maxCount?: number;
  showZero?: boolean;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'medium',
  dot = false,
  count,
  maxCount = 99,
  showZero = false,
  style,
}) => {
  // 如果是dot模式，直接显示小圆点
  if (dot) {
    return (
      <PaperBadge
        style={[
          styles.base,
          styles[variant],
          styles[`${size}Dot`],
          style,
        ]}
      />
    );
  }

  // 如果有count，显示数字
  if (typeof count === 'number') {
    if (count === 0 && !showZero) {
      return null;
    }

    const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

    return (
      <PaperBadge
        style={[
          styles.base,
          styles[variant],
          styles[size],
          style,
        ]}
      >
        {displayCount}
      </PaperBadge>
    );
  }

  // 自定义内容
  if (children) {
    return (
      <PaperBadge
        style={[
          styles.base,
          styles[variant],
          styles[size],
          style,
        ]}
      >
        {children}
      </PaperBadge>
    );
  }

  return null;
};

// 状态Badge组件
export const StatusBadge: React.FC<{
  status: 'active' | 'inactive' | 'pending' | 'success' | 'error';
  text?: string;
}> = ({ status, text }) => {
  const getVariant = () => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'secondary';
      case 'pending': return 'warning';
      case 'success': return 'success';
      case 'error': return 'danger';
      default: return 'default';
    }
  };

  const getDefaultText = () => {
    switch (status) {
      case 'active': return '活跃';
      case 'inactive': return '未激活';
      case 'pending': return '待处理';
      case 'success': return '成功';
      case 'error': return '错误';
      default: return '';
    }
  };

  return (
    <Badge variant={getVariant()}>
      {text || getDefaultText()}
    </Badge>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  
  // 变体样式
  default: {
    backgroundColor: '#757575',
  } as ViewStyle,
  
  primary: {
    backgroundColor: '#2196F3',
  } as ViewStyle,
  
  secondary: {
    backgroundColor: '#757575',
  } as ViewStyle,
  
  success: {
    backgroundColor: '#4caf50',
  } as ViewStyle,
  
  warning: {
    backgroundColor: '#ff9800',
  } as ViewStyle,
  
  danger: {
    backgroundColor: '#f44336',
  } as ViewStyle,
  
  // 尺寸样式
  small: {
    minHeight: 18,
    paddingHorizontal: 6,
    paddingVertical: 2,
  } as ViewStyle,
  
  medium: {
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  } as ViewStyle,
  
  large: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
  } as ViewStyle,
  
  // 点状样式
  smallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    padding: 0,
    minWidth: 8,
    minHeight: 8,
  } as ViewStyle,
  
  mediumDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    padding: 0,
    minWidth: 10,
    minHeight: 10,
  } as ViewStyle,
  
  largeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    padding: 0,
    minWidth: 12,
    minHeight: 12,
  } as ViewStyle,
});