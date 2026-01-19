import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, ListRenderItem } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { CHART_COLORS } from './chartSizes';

/**
 * Ranking item data structure
 */
export interface RankingItem {
  /** Unique identifier */
  id: string | number;
  /** Display label/name */
  label: string;
  /** Ranking value */
  value: number;
  /** Optional secondary label */
  subtitle?: string;
  /** Optional change indicator */
  change?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * MobileRankingList Props
 */
export interface MobileRankingListProps<T extends RankingItem> {
  /** List title */
  title?: string;
  /** Ranking data */
  data: T[];
  /** Key to use for value display (default: 'value') */
  valueKey?: keyof T;
  /** Key to use for label display (default: 'label') */
  labelKey?: keyof T;
  /** Maximum items to display (default: 10) */
  limit?: number;
  /** Value suffix (e.g., 'kg', 'units') */
  valueSuffix?: string;
  /** Value prefix (e.g., 'CNY') */
  valuePrefix?: string;
  /** Show rank badges for top 3 */
  showMedals?: boolean;
  /** Show progress bars */
  showProgress?: boolean;
  /** List height (enables scrolling if content exceeds) */
  maxHeight?: number;
  /** On item press */
  onItemPress?: (item: T, index: number) => void;
  /** Custom value formatter */
  valueFormatter?: (value: number) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Header right element */
  headerRight?: React.ReactNode;
}

/**
 * Medal colors for top 3
 */
const MEDAL_COLORS = {
  1: '#FFD700', // Gold
  2: '#C0C0C0', // Silver
  3: '#CD7F32', // Bronze
};

/**
 * Get rank badge style
 */
function getRankStyle(rank: number): { backgroundColor: string; color: string } {
  if (rank <= 3) {
    return {
      backgroundColor: MEDAL_COLORS[rank as 1 | 2 | 3],
      color: rank === 1 ? '#8B6914' : rank === 2 ? '#4A4A4A' : '#5C3D1E',
    };
  }
  return {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  };
}

/**
 * RankingListItem Component
 */
interface RankingListItemProps<T extends RankingItem> {
  item: T;
  index: number;
  maxValue: number;
  showMedals: boolean;
  showProgress: boolean;
  valueKey: keyof T;
  labelKey: keyof T;
  valueSuffix: string;
  valuePrefix: string;
  valueFormatter?: (value: number) => string;
  onPress?: () => void;
}

function RankingListItem<T extends RankingItem>({
  item,
  index,
  maxValue,
  showMedals,
  showProgress,
  valueKey,
  labelKey,
  valueSuffix,
  valuePrefix,
  valueFormatter,
  onPress,
}: RankingListItemProps<T>): React.ReactElement {
  const rank = index + 1;
  const rankStyle = getRankStyle(rank);
  const value = item[valueKey] as number;
  const label = item[labelKey] as string;
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  // Format value
  const formattedValue = valueFormatter
    ? valueFormatter(value)
    : `${valuePrefix}${value.toLocaleString('zh-CN')}${valueSuffix}`;

  // Determine bar color based on rank
  const barColor = rank <= 3
    ? CHART_COLORS.series[rank - 1]
    : CHART_COLORS.series[Math.min(rank - 1, CHART_COLORS.series.length - 1)];

  return (
    <Surface
      style={styles.itemContainer}
      elevation={0}
      onTouchEnd={onPress}
    >
      <View style={styles.itemContent}>
        {/* Rank badge */}
        {showMedals ? (
          <View style={[styles.rankBadge, { backgroundColor: rankStyle.backgroundColor }]}>
            <Text style={[styles.rankText, { color: rankStyle.color }]}>
              {rank}
            </Text>
          </View>
        ) : (
          <Text style={styles.rankNumber}>{rank}</Text>
        )}

        {/* Label and subtitle */}
        <View style={styles.labelContainer}>
          <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
          {item.subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>

        {/* Value and change */}
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{formattedValue}</Text>
          {item.change !== undefined && (
            <Text
              style={[
                styles.change,
                { color: item.change >= 0 ? CHART_COLORS.secondary : CHART_COLORS.danger },
              ]}
            >
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      {showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                { width: `${percentage}%`, backgroundColor: barColor },
              ]}
            />
          </View>
        </View>
      )}
    </Surface>
  );
}

/**
 * MobileRankingList Component
 *
 * A ranking list component using FlatList for efficient rendering.
 * Displays ranked items with optional medals, progress bars, and change indicators.
 *
 * @example
 * ```tsx
 * <MobileRankingList
 *   title="Top Products"
 *   data={[
 *     { id: 1, label: 'Product A', value: 1500, change: 5.2 },
 *     { id: 2, label: 'Product B', value: 1200, change: -2.1 },
 *     { id: 3, label: 'Product C', value: 900, change: 3.0 },
 *   ]}
 *   showMedals
 *   showProgress
 *   valueSuffix=" units"
 *   onItemPress={(item) => console.log('Pressed:', item)}
 * />
 * ```
 */
export default function MobileRankingList<T extends RankingItem>({
  title,
  data,
  valueKey = 'value' as keyof T,
  labelKey = 'label' as keyof T,
  limit = 10,
  valueSuffix = '',
  valuePrefix = '',
  showMedals = true,
  showProgress = true,
  maxHeight,
  onItemPress,
  valueFormatter,
  emptyMessage = 'No data available',
  headerRight,
}: MobileRankingListProps<T>): React.ReactElement {
  // Limit and sort data
  const sortedData = React.useMemo(() => {
    return [...data]
      .sort((a, b) => (b[valueKey] as number) - (a[valueKey] as number))
      .slice(0, limit);
  }, [data, valueKey, limit]);

  // Calculate max value for progress bars
  const maxValue = React.useMemo(() => {
    if (sortedData.length === 0) return 0;
    return Math.max(...sortedData.map(item => item[valueKey] as number));
  }, [sortedData, valueKey]);

  // Render item
  const renderItem: ListRenderItem<T> = useCallback(
    ({ item, index }) => (
      <RankingListItem
        item={item}
        index={index}
        maxValue={maxValue}
        showMedals={showMedals}
        showProgress={showProgress}
        valueKey={valueKey}
        labelKey={labelKey}
        valueSuffix={valueSuffix}
        valuePrefix={valuePrefix}
        valueFormatter={valueFormatter}
        onPress={onItemPress ? () => onItemPress(item, index) : undefined}
      />
    ),
    [maxValue, showMedals, showProgress, valueKey, labelKey, valueSuffix, valuePrefix, valueFormatter, onItemPress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: T) => String(item.id), []);

  // Empty component
  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    ),
    [emptyMessage]
  );

  return (
    <Surface style={styles.container} elevation={1}>
      {(title || headerRight) && (
        <View style={styles.header}>
          {title && (
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
          )}
          {headerRight}
        </View>
      )}

      <FlatList
        data={sortedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        style={maxHeight ? { maxHeight } : undefined}
        contentContainerStyle={styles.listContent}
        scrollEnabled={!!maxHeight}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  itemContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rankNumber: {
    width: 28,
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginRight: 12,
  },
  labelContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  change: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  progressContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 40, // Align with label (rank badge width + margin)
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
