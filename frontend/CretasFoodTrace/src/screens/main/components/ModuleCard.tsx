import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { ModuleConfig } from '../../../types/navigation';
import { NeoCard, StatusBadge } from '../../../components/ui';
import { theme } from '../../../theme';

const { width } = Dimensions.get('window');
// 2 columns with spacing: 16(left) + 12(gap) + 16(right) = 44 total horizontal spacing
const CARD_WIDTH = (width - 44) / 2;

interface ModuleCardProps {
  module: ModuleConfig;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * Module Card Component (Neo Minimal Style)
 * 
 * Displays a clean white card with a colored icon container.
 */
export const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  onPress,
  disabled = false
}) => {
  const isAvailable = module.status === 'available';
  const isComingSoon = module.status === 'coming_soon';
  const isLocked = module.status === 'locked';

  // Calculate opacity for disabled states
  const containerOpacity = (!isAvailable && !isComingSoon) ? 0.6 : 1;

  // Get status badge config
  const renderStatusBadge = () => {
    if (isComingSoon) {
      return <StatusBadge status="即将上线" variant="info" style={styles.badge} />;
    }
    if (isLocked) {
      return <StatusBadge status="已锁定" variant="default" style={styles.badge} />;
    }
    if (module.progress !== undefined && module.progress < 100) {
      return <StatusBadge status={`${module.progress}%`} variant="warning" style={styles.badge} />;
    }
    return null;
  };

  return (
    <NeoCard
      style={[styles.container, { opacity: containerOpacity }]}
      onPress={(!disabled && isAvailable) ? onPress : undefined}
      padding="l"
    >
      {/* Header: Icon and Badge */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${module.color}15` }]}>
          <Icon source={module.icon} size={28} color={module.color} />
        </View>
        {renderStatusBadge()}
      </View>

      {/* Content: Title and Description */}
      <View style={styles.content}>
        <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
          {module.name}
        </Text>
        <Text variant="bodySmall" style={styles.description} numberOfLines={2}>
          {module.description}
        </Text>
      </View>
    </NeoCard>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginBottom: 12,
    height: 160,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.custom.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
  },
  content: {
    marginTop: 12,
  },
  title: {
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    lineHeight: 16,
  },
});
