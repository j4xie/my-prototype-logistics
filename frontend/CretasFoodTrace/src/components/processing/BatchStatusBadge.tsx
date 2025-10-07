import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Chip, Icon } from 'react-native-paper';

export type BatchStatus =
  | 'planning'
  | 'in_progress'
  | 'paused'
  | 'quality_check'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface BatchStatusBadgeProps {
  status: BatchStatus;
  size?: 'small' | 'medium' | 'large';
}

/**
 * 批次状态徽章组件
 * 7种状态,不同颜色和图标
 */
export const BatchStatusBadge: React.FC<BatchStatusBadgeProps> = ({
  status,
  size = 'medium',
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'planning':
        return {
          label: '计划中',
          color: '#2196F3', // 蓝色
          backgroundColor: '#E3F2FD',
          icon: 'clock-outline',
        };
      case 'in_progress':
        return {
          label: '进行中',
          color: '#FF9800', // 橙色
          backgroundColor: '#FFF3E0',
          icon: 'play-circle',
        };
      case 'paused':
        return {
          label: '已暂停',
          color: '#F44336', // 红色
          backgroundColor: '#FFEBEE',
          icon: 'pause-circle',
        };
      case 'quality_check':
        return {
          label: '质检中',
          color: '#FFC107', // 黄色
          backgroundColor: '#FFF8E1',
          icon: 'shield-check',
        };
      case 'completed':
        return {
          label: '已完成',
          color: '#4CAF50', // 绿色
          backgroundColor: '#E8F5E9',
          icon: 'check-circle',
        };
      case 'failed':
        return {
          label: '已失败',
          color: '#C62828', // 深红色
          backgroundColor: '#FFCDD2',
          icon: 'close-circle',
        };
      case 'cancelled':
        return {
          label: '已取消',
          color: '#9E9E9E', // 灰色
          backgroundColor: '#F5F5F5',
          icon: 'cancel',
        };
      default:
        return {
          label: '未知',
          color: '#757575',
          backgroundColor: '#EEEEEE',
          icon: 'help-circle',
        };
    }
  };

  const config = getStatusConfig();
  const chipSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'medium';

  return (
    <Chip
      mode="flat"
      textStyle={[
        styles.chipText,
        { color: config.color },
        size === 'small' && styles.chipTextSmall,
        size === 'large' && styles.chipTextLarge,
      ]}
      style={[
        styles.chip,
        { backgroundColor: config.backgroundColor },
      ]}
      compact={size === 'small'}
    >
      <View style={styles.chipContent}>
        <Icon source={config.icon} size={size === 'small' ? 14 : size === 'large' ? 20 : 16} color={config.color} />
        <Text style={{ marginLeft: 4, color: config.color }}>{config.label}</Text>
      </View>
    </Chip>
  );
};

const styles = StyleSheet.create({
  chip: {
    borderRadius: 16,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: {
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextSmall: {
    fontSize: 11,
  },
  chipTextLarge: {
    fontSize: 15,
  },
});

export default BatchStatusBadge;
