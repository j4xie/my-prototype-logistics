/**
 * MetricCardGrid
 *
 * Grid layout for displaying MetricResult cards from analysis results.
 * Supports responsive 2-3 column layouts with trend indicators.
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

import React from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Type-safe icon names
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

import type { MetricResult } from '../../types/smartbi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * MetricCardGrid Props
 */
export interface MetricCardGridProps {
  /** Array of metric results */
  metrics: MetricResult[];
  /** Number of columns (default: 2) */
  columns?: 2 | 3;
  /** Callback when card is pressed */
  onCardPress?: (metric: MetricResult) => void;
}

/**
 * Single Metric Card Props
 */
interface MetricCardProps {
  metric: MetricResult;
  width: number;
  onPress?: () => void;
}

/**
 * Get trend color and icon
 */
function getTrendConfig(direction?: 'UP' | 'DOWN' | 'STABLE'): {
  color: string;
  icon: MCIconName;
  bgColor: string;
} {
  switch (direction) {
    case 'UP':
      return {
        color: '#10B981',
        icon: 'trending-up',
        bgColor: '#D1FAE5',
      };
    case 'DOWN':
      return {
        color: '#EF4444',
        icon: 'trending-down',
        bgColor: '#FEE2E2',
      };
    case 'STABLE':
    default:
      return {
        color: '#6B7280',
        icon: 'minus',
        bgColor: '#F3F4F6',
      };
  }
}

/**
 * MetricCard Component
 */
function MetricCard({ metric, width, onPress }: MetricCardProps): React.ReactElement {
  const trendConfig = getTrendConfig(metric.changeDirection);
  const hasChange = metric.changePercent !== undefined && metric.changePercent !== null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Surface style={[styles.card, { width }]} elevation={1}>
        {/* Metric name */}
        <Text style={styles.metricName} numberOfLines={1}>
          {metric.metricName}
        </Text>

        {/* Metric value */}
        <View style={styles.valueRow}>
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
            {metric.formattedValue}
          </Text>
          {metric.unit && (
            <Text style={styles.metricUnit}>{metric.unit}</Text>
          )}
        </View>

        {/* Change indicator */}
        {hasChange && (
          <View style={[styles.changeContainer, { backgroundColor: trendConfig.bgColor }]}>
            <MaterialCommunityIcons
              name={trendConfig.icon}
              size={12}
              color={trendConfig.color}
            />
            <Text style={[styles.changeText, { color: trendConfig.color }]}>
              {metric.changePercent! >= 0 ? '+' : ''}
              {metric.changePercent!.toFixed(1)}%
            </Text>
          </View>
        )}
      </Surface>
    </TouchableOpacity>
  );
}

/**
 * MetricCardGrid Component
 */
export default function MetricCardGrid({
  metrics,
  columns = 2,
  onCardPress,
}: MetricCardGridProps): React.ReactElement | null {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  // Calculate card width based on columns (with minimum width to prevent negative values)
  const padding = 16;
  const gap = 12;
  const cardWidth = Math.max(
    100, // Minimum width
    (SCREEN_WIDTH - padding * 2 - gap * (columns - 1)) / columns
  );

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {metrics.map((metric, index) => (
          <MetricCard
            key={`metric-${metric.metricCode}-${index}`}
            metric={metric}
            width={cardWidth}
            onPress={onCardPress ? () => onCardPress(metric) : undefined}
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
    padding: 14,
  },
  metricName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  metricUnit: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
