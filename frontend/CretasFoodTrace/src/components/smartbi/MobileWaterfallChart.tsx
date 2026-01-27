import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Svg, { Rect, Line, G } from 'react-native-svg';
import { CHART_SIZES } from './chartSizes';

/**
 * Single data point for waterfall chart
 */
export interface WaterfallDataPoint {
  /** Label for this bar */
  name: string;
  /** Numeric value (positive for increase, negative for decrease) */
  value: number;
  /** Type of bar: increase (green), decrease (red), or total (blue) */
  type: 'increase' | 'decrease' | 'total';
}

/**
 * Color configuration for waterfall chart
 */
export interface WaterfallColors {
  /** Color for positive/increase bars (default: #67c23a) */
  increase: string;
  /** Color for negative/decrease bars (default: #f56c6c) */
  decrease: string;
  /** Color for total bars (default: #409eff) */
  total: string;
}

/**
 * MobileWaterfallChart Props
 */
export interface MobileWaterfallChartProps {
  /** Data points for the waterfall chart */
  data: WaterfallDataPoint[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels (default: 220) */
  height?: number;
  /** Custom colors for bar types */
  colors?: WaterfallColors;
  /** Show value labels on bars (default: true) */
  showValues?: boolean;
  /** Unit suffix for values (e.g., 'kg', 'units') */
  unit?: string;
}

/**
 * Default colors for waterfall chart
 */
const DEFAULT_COLORS: WaterfallColors = {
  increase: '#67c23a',
  decrease: '#f56c6c',
  total: '#409eff',
};

/**
 * Chart layout constants
 */
const LAYOUT = {
  barWidth: 40,
  barGap: 20,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 30,
  paddingBottom: 50,
  labelFontSize: 10,
  valueFontSize: 11,
  connectorStrokeWidth: 1,
  connectorColor: '#9CA3AF',
  minBarHeight: 4,
};

/**
 * Calculated bar data with positions
 */
interface CalculatedBar {
  name: string;
  value: number;
  type: 'increase' | 'decrease' | 'total';
  x: number;
  y: number;
  barHeight: number;
  color: string;
  runningTotal: number;
}

/**
 * MobileWaterfallChart Component
 *
 * A waterfall (bridge) chart for visualizing cumulative changes in values.
 * Shows how an initial value is affected by a series of positive or negative values.
 *
 * @example
 * ```tsx
 * <MobileWaterfallChart
 *   title="Budget Analysis"
 *   data={[
 *     { name: 'Starting', value: 1000, type: 'total' },
 *     { name: 'Revenue', value: 500, type: 'increase' },
 *     { name: 'Costs', value: -300, type: 'decrease' },
 *     { name: 'Ending', value: 1200, type: 'total' },
 *   ]}
 *   unit="$"
 * />
 * ```
 */
export default function MobileWaterfallChart({
  data,
  title,
  height = 220,
  colors = DEFAULT_COLORS,
  showValues = true,
  unit = '',
}: MobileWaterfallChartProps): React.ReactElement {
  // Merge custom colors with defaults
  const chartColors = useMemo(
    () => ({ ...DEFAULT_COLORS, ...colors }),
    [colors]
  );

  // Check if data is valid
  const hasData = data.length > 0;

  // Calculate chart dimensions
  const chartWidth = useMemo(() => {
    const contentWidth =
      data.length * (LAYOUT.barWidth + LAYOUT.barGap) +
      LAYOUT.paddingLeft +
      LAYOUT.paddingRight;
    const screenWidth = Dimensions.get('window').width - 32;
    return Math.max(contentWidth, screenWidth);
  }, [data.length]);

  const chartHeight = height - (title ? 40 : 0);
  const drawableHeight = chartHeight - LAYOUT.paddingTop - LAYOUT.paddingBottom;

  // Calculate bar positions and running totals
  const calculatedBars = useMemo<CalculatedBar[]>(() => {
    if (!hasData) return [];

    // First pass: calculate all running totals
    let runningTotal = 0;
    const barsWithTotals = data.map((item) => {
      if (item.type === 'total') {
        runningTotal = item.value;
      } else {
        runningTotal += item.value;
      }
      return { ...item, runningTotal };
    });

    // Find min and max for scaling
    const allTotals = barsWithTotals.map((b) => b.runningTotal);
    const allValues = data.map((d) => Math.abs(d.value));
    const maxValue = Math.max(...allTotals, ...allValues);
    const minValue = Math.min(...allTotals, 0);
    const valueRange = maxValue - minValue || 1;

    // Calculate scale factor
    const scale = drawableHeight / valueRange;
    const baseline = LAYOUT.paddingTop + (maxValue * scale);

    // Second pass: calculate bar positions
    let prevRunningTotal = 0;
    return barsWithTotals.map((item, index) => {
      const x = LAYOUT.paddingLeft + index * (LAYOUT.barWidth + LAYOUT.barGap);
      let y: number;
      let barHeight: number;

      if (item.type === 'total') {
        // Total bars always start from the baseline (0)
        barHeight = Math.max(Math.abs(item.value) * scale, LAYOUT.minBarHeight);
        if (item.value >= 0) {
          y = baseline - barHeight;
        } else {
          y = baseline;
        }
      } else {
        // Increase/decrease bars float based on previous running total
        const startTotal = prevRunningTotal;
        const endTotal = item.runningTotal;
        barHeight = Math.max(Math.abs(item.value) * scale, LAYOUT.minBarHeight);

        if (item.value >= 0) {
          // Increase: bar goes up from previous total
          y = baseline - endTotal * scale;
        } else {
          // Decrease: bar goes down from previous total
          y = baseline - startTotal * scale;
        }
      }

      prevRunningTotal = item.runningTotal;

      return {
        ...item,
        x,
        y,
        barHeight,
        color:
          item.type === 'total'
            ? chartColors.total
            : item.type === 'increase'
            ? chartColors.increase
            : chartColors.decrease,
      };
    });
  }, [data, hasData, drawableHeight, chartColors]);

  // Calculate baseline Y position for connector lines
  const baselineY = useMemo(() => {
    if (!hasData || calculatedBars.length === 0) return 0;
    const allTotals = calculatedBars.map((b) => b.runningTotal);
    const maxValue = Math.max(...allTotals, ...data.map((d) => Math.abs(d.value)));
    const minValue = Math.min(...allTotals, 0);
    const valueRange = maxValue - minValue || 1;
    const scale = drawableHeight / valueRange;
    return LAYOUT.paddingTop + (maxValue * scale);
  }, [calculatedBars, hasData, drawableHeight, data]);

  // Format value for display
  const formatValue = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (absValue >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  // Render empty state
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

  // Determine if horizontal scroll is needed
  const screenWidth = Dimensions.get('window').width - 64;
  const needsScroll = chartWidth > screenWidth;

  const chartContent = (
    <Svg width={chartWidth} height={chartHeight}>
      <G>
        {/* Connector lines between bars */}
        {calculatedBars.map((bar, index) => {
          if (index === 0) return null;
          const prevBar = calculatedBars[index - 1];
          if (!prevBar) return null;

          // Calculate connector endpoints
          const prevEndX = prevBar.x + LAYOUT.barWidth;
          const prevEndY =
            prevBar.type === 'total' || prevBar.value >= 0
              ? prevBar.y
              : prevBar.y + prevBar.barHeight;
          const currStartY =
            bar.type === 'total'
              ? bar.y + (bar.value >= 0 ? bar.barHeight : 0)
              : bar.value >= 0
              ? bar.y + bar.barHeight
              : bar.y;

          // Only draw connector for non-total bars
          if (bar.type !== 'total') {
            return (
              <Line
                key={`connector-${index}`}
                x1={prevEndX}
                y1={prevEndY}
                x2={bar.x}
                y2={currStartY}
                stroke={LAYOUT.connectorColor}
                strokeWidth={LAYOUT.connectorStrokeWidth}
                strokeDasharray="3,3"
              />
            );
          }
          return null;
        })}

        {/* Bars */}
        {calculatedBars.map((bar, index) => (
          <Rect
            key={`bar-${index}`}
            x={bar.x}
            y={bar.y}
            width={LAYOUT.barWidth}
            height={bar.barHeight}
            fill={bar.color}
            rx={4}
            ry={4}
          />
        ))}

        {/* Value labels */}
        {showValues &&
          calculatedBars.map((bar, index) => {
            const valueText = `${bar.value >= 0 ? '+' : ''}${formatValue(bar.value)}${unit}`;
            const labelY = bar.value >= 0 ? bar.y - 6 : bar.y + bar.barHeight + 14;

            return (
              <G key={`value-${index}`}>
                <Rect
                  x={bar.x - 4}
                  y={labelY - 10}
                  width={LAYOUT.barWidth + 8}
                  height={14}
                  fill="transparent"
                />
              </G>
            );
          })}
      </G>
    </Svg>
  );

  return (
    <Surface style={styles.container} elevation={1}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      {needsScroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          <View>
            {chartContent}
            {/* X-axis labels */}
            <View style={[styles.labelsContainer, { width: chartWidth }]}>
              {calculatedBars.map((bar, index) => (
                <Text
                  key={`label-${index}`}
                  style={[
                    styles.axisLabel,
                    {
                      position: 'absolute',
                      left: bar.x,
                      width: LAYOUT.barWidth,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {bar.name}
                </Text>
              ))}
            </View>
            {/* Value labels overlay */}
            {showValues && (
              <View style={[styles.valuesOverlay, { width: chartWidth, height: chartHeight }]}>
                {calculatedBars.map((bar, index) => {
                  const valueText = `${bar.value >= 0 ? '+' : ''}${formatValue(bar.value)}${unit}`;
                  const labelY = bar.value >= 0 ? bar.y - 18 : bar.y + bar.barHeight + 2;

                  return (
                    <Text
                      key={`valueText-${index}`}
                      style={[
                        styles.valueLabel,
                        {
                          position: 'absolute',
                          left: bar.x - 4,
                          top: labelY,
                          width: LAYOUT.barWidth + 8,
                          color: bar.type === 'total' ? chartColors.total : bar.value >= 0 ? chartColors.increase : chartColors.decrease,
                        },
                      ]}
                    >
                      {valueText}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View>
          {chartContent}
          {/* X-axis labels */}
          <View style={[styles.labelsContainer, { width: chartWidth }]}>
            {calculatedBars.map((bar, index) => (
              <Text
                key={`label-${index}`}
                style={[
                  styles.axisLabel,
                  {
                    position: 'absolute',
                    left: bar.x,
                    width: LAYOUT.barWidth,
                  },
                ]}
                numberOfLines={2}
              >
                {bar.name}
              </Text>
            ))}
          </View>
          {/* Value labels overlay */}
          {showValues && (
            <View style={[styles.valuesOverlay, { width: chartWidth, height: chartHeight }]}>
              {calculatedBars.map((bar, index) => {
                const valueText = `${bar.value >= 0 ? '+' : ''}${formatValue(bar.value)}${unit}`;
                const labelY = bar.value >= 0 ? bar.y - 18 : bar.y + bar.barHeight + 2;

                return (
                  <Text
                    key={`valueText-${index}`}
                    style={[
                      styles.valueLabel,
                      {
                        position: 'absolute',
                        left: bar.x - 4,
                        top: labelY,
                        width: LAYOUT.barWidth + 8,
                        color: bar.type === 'total' ? chartColors.total : bar.value >= 0 ? chartColors.increase : chartColors.decrease,
                      },
                    ]}
                  >
                    {valueText}
                  </Text>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: chartColors.increase }]} />
          <Text style={styles.legendText}>Increase</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: chartColors.decrease }]} />
          <Text style={styles.legendText}>Decrease</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: chartColors.total }]} />
          <Text style={styles.legendText}>Total</Text>
        </View>
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
  scrollContent: {
    paddingRight: 16,
  },
  labelsContainer: {
    height: 36,
    position: 'relative',
  },
  axisLabel: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  valuesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  valueLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
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
