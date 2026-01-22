import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { BarChart as RNBarChart } from 'react-native-chart-kit';
import { CHART_COLORS, CHART_CONFIG, CHART_SIZES } from './chartSizes';

/**
 * Bar chart data item
 */
export interface BarDataItem {
  /** Label for the bar */
  label: string;
  /** Value */
  value: number;
  /** Optional color override */
  color?: string;
}

/**
 * MobileBarChart Props
 */
export interface MobileBarChartProps {
  /** Chart title */
  title?: string;
  /** X-axis labels */
  labels: string[];
  /** Bar values */
  data: number[];
  /** Chart width (default: fullWidth) */
  width?: number;
  /** Chart height (default: 220) */
  height?: number;
  /** Display bars horizontally */
  horizontal?: boolean;
  /** Y-axis suffix (e.g., 'kg', 'units') */
  yAxisSuffix?: string;
  /** Y-axis prefix */
  yAxisPrefix?: string;
  /** Number of decimal places */
  decimalPlaces?: number;
  /** Show value labels on bars */
  showValuesOnTopOfBars?: boolean;
  /** Bar color */
  barColor?: string;
  /** Custom colors for each bar (same length as data) */
  barColors?: string[];
  /** Flat style (no gradient) */
  flatStyle?: boolean;
  /** On bar press */
  onBarPress?: (index: number, value: number) => void;
}

/**
 * Horizontal bar item for custom horizontal bar chart
 */
interface HorizontalBarItemProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  index: number;
  suffix?: string;
  onPress?: () => void;
}

/**
 * HorizontalBarItem Component
 * Custom horizontal bar for ranking-style charts
 */
function HorizontalBarItem({
  label,
  value,
  maxValue,
  color,
  index,
  suffix = '',
  onPress,
}: HorizontalBarItemProps): React.ReactElement {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <View style={horizontalStyles.barContainer} onTouchEnd={onPress}>
      <View style={horizontalStyles.labelRow}>
        <Text style={horizontalStyles.rankNumber}>{index + 1}</Text>
        <Text style={horizontalStyles.label} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        <Text style={horizontalStyles.value}>
          {value.toLocaleString('zh-CN')}{suffix}
        </Text>
      </View>
      <View style={horizontalStyles.barBackground}>
        <View
          style={[
            horizontalStyles.barFill,
            { width: `${percentage}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

const horizontalStyles = StyleSheet.create({
  barContainer: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rankNumber: {
    width: 20,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    marginRight: 8,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 20,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});

/**
 * MobileBarChart Component
 *
 * A bar chart component using react-native-chart-kit.
 * Supports both vertical and horizontal bar layouts.
 *
 * @example
 * ```tsx
 * // Vertical bars
 * <MobileBarChart
 *   title="Monthly Output"
 *   labels={['Jan', 'Feb', 'Mar', 'Apr']}
 *   data={[120, 150, 90, 180]}
 *   yAxisSuffix=" kg"
 * />
 *
 * // Horizontal bars (ranking style)
 * <MobileBarChart
 *   title="Top Products"
 *   labels={['Product A', 'Product B', 'Product C']}
 *   data={[1500, 1200, 900]}
 *   horizontal
 * />
 * ```
 */
export default function MobileBarChart({
  title,
  labels,
  data,
  width = CHART_SIZES.fullWidth.width,
  height = CHART_SIZES.fullWidth.height,
  horizontal = false,
  yAxisSuffix = '',
  yAxisPrefix = '',
  decimalPlaces = 0,
  showValuesOnTopOfBars = false,
  barColor = CHART_COLORS.primary,
  barColors,
  flatStyle = false,
  onBarPress,
}: MobileBarChartProps): React.ReactElement {
  // Edge case: Empty data check
  const hasData = data.length > 0 && labels.length > 0;

  // Normalize data: ensure labels and data arrays are same length, handle negative values
  const normalizedData = useMemo(() => {
    if (!hasData) return [];
    // Take the minimum length to avoid mismatch
    const length = Math.min(labels.length, data.length);
    return data.slice(0, length).map(v => Math.max(0, v ?? 0)); // Clamp negative to 0
  }, [data, labels.length, hasData]);

  const normalizedLabels = useMemo(() => {
    if (!hasData) return [];
    const length = Math.min(labels.length, data.length);
    return labels.slice(0, length);
  }, [labels, data.length, hasData]);

  // Chart data structure
  const chartData = useMemo(() => ({
    labels: normalizedLabels,
    datasets: [
      {
        data: normalizedData.length > 0 ? normalizedData : [0],
        colors: barColors
          ? barColors.slice(0, normalizedData.length).map(c => () => c)
          : undefined,
      },
    ],
  }), [normalizedLabels, normalizedData, barColors]);

  // Chart configuration
  const chartConfig = useMemo(() => ({
    ...CHART_CONFIG,
    decimalPlaces,
    color: (opacity = 1) => {
      const r = parseInt(barColor.slice(1, 3), 16);
      const g = parseInt(barColor.slice(3, 5), 16);
      const b = parseInt(barColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },
    barPercentage: 0.7,
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#E5E7EB',
      strokeWidth: 1,
    },
    fillShadowGradient: barColor,
    fillShadowGradientOpacity: 1,
    fillShadowGradientTo: flatStyle ? barColor : undefined,
  }), [decimalPlaces, barColor, flatStyle]);

  // Edge case: Show "No data" message when data is empty
  if (!hasData) {
    return (
      <Surface style={styles.container} elevation={1}>
        {title && (
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
        )}
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data available</Text>
        </View>
      </Surface>
    );
  }

  // For horizontal layout, use custom horizontal bars
  if (horizontal) {
    const maxValue = Math.max(...normalizedData, 1);

    return (
      <Surface style={styles.container} elevation={1}>
        {title && (
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
        )}
        <ScrollView
          style={styles.horizontalScrollView}
          contentContainerStyle={styles.horizontalContent}
          showsVerticalScrollIndicator={false}
        >
          {normalizedLabels.map((label, index) => (
            <HorizontalBarItem
              key={`bar-${index}`}
              label={label}
              value={normalizedData[index] ?? 0}
              maxValue={maxValue}
              color={barColors?.[index] ?? CHART_COLORS.series[index % CHART_COLORS.series.length] ?? CHART_COLORS.primary}
              index={index}
              suffix={yAxisSuffix}
              onPress={onBarPress ? () => onBarPress(index, normalizedData[index] ?? 0) : undefined}
            />
          ))}
        </ScrollView>
      </Surface>
    );
  }

  // Vertical bar chart
  return (
    <Surface style={styles.container} elevation={1}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      <View style={styles.chartWrapper}>
        <RNBarChart
          data={chartData}
          width={width}
          height={height - (title ? 40 : 0)}
          chartConfig={chartConfig}
          style={styles.chart}
          yAxisSuffix={yAxisSuffix}
          yAxisLabel={yAxisPrefix}
          withHorizontalLabels
          withVerticalLabels
          withInnerLines
          showValuesOnTopOfBars={showValuesOnTopOfBars}
          fromZero
          segments={4}
          flatColor={flatStyle}
          withCustomBarColorFromData={!!barColors}
        />
      </View>
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
  title: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#1F2937',
  },
  chartWrapper: {
    marginLeft: -16,
    marginRight: -16,
  },
  chart: {
    borderRadius: 8,
  },
  horizontalScrollView: {
    maxHeight: 300,
  },
  horizontalContent: {
    paddingBottom: 8,
  },
  noDataContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
