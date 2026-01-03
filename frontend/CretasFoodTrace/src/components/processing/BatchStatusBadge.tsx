import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Chip, Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

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
 * Batch Status Badge Component
 * 7 statuses with different colors and icons
 */
export const BatchStatusBadge: React.FC<BatchStatusBadgeProps> = ({
  status,
  size = 'medium',
}) => {
  const { t } = useTranslation('processing');

  const getStatusConfig = () => {
    switch (status) {
      case 'planning':
        return {
          label: t('batchStatus.planning'),
          color: '#2196F3',
          backgroundColor: '#E3F2FD',
          icon: 'clock-outline',
        };
      case 'in_progress':
        return {
          label: t('batchStatus.inProgress'),
          color: '#FF9800',
          backgroundColor: '#FFF3E0',
          icon: 'play-circle',
        };
      case 'paused':
        return {
          label: t('batchStatus.paused'),
          color: '#F44336',
          backgroundColor: '#FFEBEE',
          icon: 'pause-circle',
        };
      case 'quality_check':
        return {
          label: t('batchStatus.qualityCheck'),
          color: '#FFC107',
          backgroundColor: '#FFF8E1',
          icon: 'shield-check',
        };
      case 'completed':
        return {
          label: t('batchStatus.completed'),
          color: '#4CAF50',
          backgroundColor: '#E8F5E9',
          icon: 'check-circle',
        };
      case 'failed':
        return {
          label: t('batchStatus.failed'),
          color: '#C62828',
          backgroundColor: '#FFCDD2',
          icon: 'close-circle',
        };
      case 'cancelled':
        return {
          label: t('batchStatus.cancelled'),
          color: '#9E9E9E',
          backgroundColor: '#F5F5F5',
          icon: 'cancel',
        };
      default:
        return {
          label: t('batchStatus.unknown'),
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
