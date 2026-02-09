/**
 * KPICardGrid
 *
 * Grid layout for displaying KPICard data with consistent styling.
 * Supports 2-column layout with trend indicators and status colors.
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

import React from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { KPICard } from '../../types/smartbi';

// Type-safe icon names
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * KPICardGrid Props
 */
export interface KPICardGridProps {
  /** Array of KPI cards */
  kpiCards: KPICard[];
  /** Number of columns (default: 2) */
  columns?: 2 | 3 | 4;
  /** Callback when card is pressed */
  onCardPress?: (kpi: KPICard) => void;
}

/**
 * Single KPI Card Props
 */
interface KPICardItemProps {
  kpi: KPICard;
  width: number;
  onPress?: () => void;
}

/**
 * Get status color configuration
 */
function getStatusConfig(status: KPICard['status']): {
  color: string;
  bgColor: string;
  icon: MCIconName;
} {
  switch (status) {
    case 'green':
      return {
        color: '#10B981',
        bgColor: '#D1FAE5',
        icon: 'check-circle',
      };
    case 'yellow':
      return {
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        icon: 'alert-circle',
      };
    case 'red':
      return {
        color: '#EF4444',
        bgColor: '#FEE2E2',
        icon: 'close-circle',
      };
    default:
      return {
        color: '#6B7280',
        bgColor: '#F3F4F6',
        icon: 'circle',
      };
  }
}

/**
 * Get trend configuration
 */
function getTrendConfig(trend: KPICard['trend']): {
  color: string;
  icon: MCIconName;
} {
  switch (trend) {
    case 'up':
      return { color: '#10B981', icon: 'trending-up' };
    case 'down':
      return { color: '#EF4444', icon: 'trending-down' };
    case 'flat':
    default:
      return { color: '#6B7280', icon: 'minus' };
  }
}

/**
 * KPICardItem Component
 */
function KPICardItem({ kpi, width, onPress }: KPICardItemProps): React.ReactElement {
  const statusConfig = getStatusConfig(kpi.status);
  const trendConfig = getTrendConfig(kpi.trend);
  const hasChange = kpi.changeRate !== undefined && kpi.changeRate !== null;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={{ width }}
    >
      <Surface style={styles.card} elevation={2}>
        {/* Status indicator dot */}
        <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />

        {/* KPI Title */}
        <Text style={styles.kpiTitle} numberOfLines={1}>
          {kpi.title}
        </Text>

        {/* KPI Value */}
        <View style={styles.valueRow}>
          <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
            {kpi.value}
          </Text>
          {kpi.unit && (
            <Text style={styles.kpiUnit}>{kpi.unit}</Text>
          )}
        </View>

        {/* Change indicator */}
        {hasChange && (
          <View style={styles.changeRow}>
            <MaterialCommunityIcons
              name={trendConfig.icon}
              size={14}
              color={trendConfig.color}
            />
            <Text style={[styles.changeText, { color: trendConfig.color }]}>
              {kpi.changeRate! >= 0 ? '+' : ''}
              {kpi.changeRate!.toFixed(1)}%
            </Text>
          </View>
        )}
      </Surface>
    </TouchableOpacity>
  );
}

/**
 * KPICardGrid Component
 */
export default function KPICardGrid({
  kpiCards,
  columns = 2,
  onCardPress,
}: KPICardGridProps): React.ReactElement | null {
  if (!kpiCards || kpiCards.length === 0) {
    return null;
  }

  // Calculate card width based on columns
  const padding = 16;
  const gap = 12;
  const cardWidth = (SCREEN_WIDTH - padding * 2 - gap * (columns - 1)) / columns;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {kpiCards.map((kpi, index) => (
          <KPICardItem
            key={`kpi-${kpi.key}-${index}`}
            kpi={kpi}
            width={cardWidth}
            onPress={onCardPress ? () => onCardPress(kpi) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
    minHeight: 100,
  },
  statusDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kpiTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    paddingRight: 20,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  kpiUnit: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
    marginBottom: 2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
